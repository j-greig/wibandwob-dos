"""Contract test: every C++ view that calls setTimer must also call killTimer.

Parses source files directly — no running TUI needed.
Catches: timer UAF bugs where a view's timer fires after destruction.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "app"


def _find_timer_usage() -> list[dict]:
    """Scan all .cpp files in app/ for setTimer/killTimer calls.

    Returns list of {file, set_count, kill_count} dicts.
    Only includes files that call setTimer at least once.
    """
    results = []
    for cpp in sorted(APP_DIR.glob("*.cpp")):
        if "test" in cpp.name:
            continue
        text = cpp.read_text(encoding="utf-8")
        sets = len(re.findall(r"\bsetTimer\b", text))
        kills = len(re.findall(r"\bkillTimer\b", text))
        if sets > 0:
            results.append({
                "file": cpp.name,
                "set_count": sets,
                "kill_count": kills,
            })
    return results


def _has_destructor_with_kill(cpp_path: Path) -> bool:
    """Check if a .cpp file has a destructor that calls killTimer or a stop wrapper."""
    text = cpp_path.read_text(encoding="utf-8")

    # Collect all function names that call killTimer (e.g. stopTimer, stopPollTimer)
    kill_wrappers = set(["killTimer"])
    for m in re.finditer(r"(?:void\s+\w+::)?(\w*[Tt]imer\w*)\s*\([^)]*\)\s*\{([^}]*)\}", text):
        if "killTimer" in m.group(2):
            kill_wrappers.add(m.group(1))

    # Find destructor blocks (~ followed by class name, possibly multi-line)
    destructor_pattern = re.compile(r"~\w+[^{]*\{(.*?)\}", re.DOTALL)
    for m in destructor_pattern.finditer(text):
        body = m.group(1)
        for wrapper in kill_wrappers:
            if wrapper in body:
                return True
    return False


def test_every_timer_setter_has_cleanup():
    """Every file that calls setTimer must have at least as many killTimer calls."""
    usage = _find_timer_usage()
    assert len(usage) >= 10, f"Expected >=10 files with timers, got {len(usage)}"

    mismatched = []
    for entry in usage:
        if entry["kill_count"] < entry["set_count"]:
            mismatched.append(
                f"{entry['file']}: {entry['set_count']} setTimer vs "
                f"{entry['kill_count']} killTimer"
            )

    assert not mismatched, (
        f"Files with more setTimer than killTimer calls (timer UAF risk):\n"
        + "\n".join(f"  {m}" for m in mismatched)
    )


def test_timer_views_have_destructor_cleanup():
    """Every view .cpp with setTimer should have killTimer in a destructor or stopTimer."""
    usage = _find_timer_usage()

    missing_cleanup = []
    for entry in usage:
        cpp_path = APP_DIR / entry["file"]
        if not _has_destructor_with_kill(cpp_path):
            missing_cleanup.append(entry["file"])

    assert not missing_cleanup, (
        f"Files with timers but no destructor/stopTimer cleanup:\n"
        + "\n".join(f"  {m}" for m in missing_cleanup)
        + "\nAdd killTimer() in destructor to prevent timer UAF on window close."
    )
