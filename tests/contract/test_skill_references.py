"""Contract test: skills must not reference deleted or moved files.

Parses SKILL.md files for file path references and verifies they exist.
Catches: stale references to mcp_tools.py, moved scripts, deleted modules.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_DIRS = [
    REPO_ROOT / ".claude" / "skills",
    REPO_ROOT / ".pi" / "skills",
]

# Patterns that look like file references in skill docs
FILE_REF_PATTERNS = [
    # backtick-wrapped paths: `tools/api_server/mcp_tools.py`
    re.compile(r"`((?:tools|app|tests|scripts|modules)/[a-zA-Z0-9_./-]+\.\w+)`"),
    # bare paths after keywords: references mcp_tools.py
    re.compile(r"(?:reference|import|from|load|read)\s+[`'\"]?((?:tools|app)/[a-zA-Z0-9_./-]+\.(?:py|js|cpp|h))[`'\"]?"),
]

# Known exceptions: paths that are OK to reference even if not on disk
# (e.g. paths that only exist inside Docker, or example paths)
EXCEPTIONS = {
    "tools/api_server/test_ipc.py",  # may not exist locally
    "tools/api_server/test_move.py",
}

# Scripts that only exist inside Docker containers, not on host
DOCKER_ONLY_SCRIPTS = {
    "start-wibwobdos.sh",
}


def _collect_skill_files() -> list[Path]:
    """Find all SKILL.md files in skill directories."""
    files = []
    for d in SKILL_DIRS:
        if d.exists():
            files.extend(d.rglob("SKILL.md"))
    return sorted(files)


def _extract_file_refs(text: str) -> set[str]:
    """Extract file path references from skill text."""
    refs = set()
    for pattern in FILE_REF_PATTERNS:
        for m in pattern.finditer(text):
            refs.add(m.group(1))
    return refs


def test_skills_exist():
    """At least one skill directory should have SKILL.md files."""
    skills = _collect_skill_files()
    assert len(skills) >= 5, f"Expected >=5 skills, found {len(skills)}"


def test_no_references_to_deleted_mcp_tools():
    """No skill should reference the deleted tools/api_server/mcp_tools.py."""
    skills = _collect_skill_files()
    offenders = []
    for skill_path in skills:
        text = skill_path.read_text(encoding="utf-8")
        if "mcp_tools.py" in text:
            # Allow if it says "no longer" or "removed" or "moved"
            context_ok = any(
                phrase in text.lower()
                for phrase in ["no longer", "removed", "moved", "deleted", "deprecated"]
            )
            if not context_ok:
                rel = skill_path.relative_to(REPO_ROOT)
                offenders.append(str(rel))

    assert not offenders, (
        f"Skills still reference deleted mcp_tools.py without noting it was removed:\n"
        + "\n".join(f"  {o}" for o in offenders)
    )


def test_skill_referenced_scripts_exist():
    """Scripts referenced in SKILL.md files should exist on disk."""
    skills = _collect_skill_files()
    missing = []
    for skill_path in skills:
        skill_dir = skill_path.parent
        text = skill_path.read_text(encoding="utf-8")
        # Find script references that look skill-local: ./scripts/foo.sh or
        # .claude/skills/name/scripts/foo.sh or .pi/skills/name/scripts/foo.sh
        # Skip repo-root references like ./scripts/dev-start.sh
        for m in re.finditer(
            r"(?:\.claude/skills/\w[\w-]*/|\.pi/skills/\w[\w-]*/|\./)?"
            r"scripts/([a-zA-Z0-9_.-]+\.(?:sh|py))",
            text,
        ):
            full_match = m.group(0)
            script_name = m.group(1)
            # If it looks like a repo-root script (./scripts/ or scripts/dev-start.sh
            # without a skill prefix), check repo root
            if full_match.startswith("./scripts/") or full_match == f"scripts/{script_name}":
                # Could be repo root OR skill local — check both
                if (REPO_ROOT / "scripts" / script_name).exists():
                    continue
                if (skill_dir / "scripts" / script_name).exists():
                    continue
            else:
                # Skill-local reference
                if (skill_dir / "scripts" / script_name).exists():
                    continue
            if script_name in DOCKER_ONLY_SCRIPTS:
                continue
            rel = skill_path.relative_to(REPO_ROOT)
            missing.append(f"{rel} references scripts/{script_name} (not found)")

    assert not missing, (
        f"Skills reference scripts that don't exist:\n"
        + "\n".join(f"  {m}" for m in missing)
    )
