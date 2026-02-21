"""Auto-derived parity test: C++ window_type_registry vs Python WindowType enum.

Both sides are parsed from source — no hardcoded lists.  Adding a new type
to k_specs[] without updating models.py (or vice-versa) will fail this test.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.api_server.models import WindowType


def _cpp_registry_slugs() -> list[dict[str, object]]:
    """Parse k_specs[] entries from window_type_registry.cpp.

    Returns list of {"slug": str, "spawnable": bool} dicts.
    Spawnable = spawn function is not 'nullptr'.
    """
    src = (REPO_ROOT / "app" / "window_type_registry.cpp").read_text(encoding="utf-8")
    # Match lines like:  { "gradient",  spawn_gradient,  match_gradient  },
    # or:                { "wibwob",   nullptr,          match_wibwob    },
    pattern = re.compile(
        r'\{\s*"([a-z_]+)"\s*,\s*(\w+)\s*,\s*\w+\s*\}',
    )
    results = []
    for m in pattern.finditer(src):
        slug = m.group(1)
        spawn_fn = m.group(2)
        results.append({"slug": slug, "spawnable": spawn_fn != "nullptr"})
    return results


def _python_enum_slugs() -> set[str]:
    return {t.value for t in WindowType}


def _schema_create_types() -> set[str]:
    """Parse the Literal[...] type list from WindowCreate in schemas.py."""
    src = (REPO_ROOT / "tools" / "api_server" / "schemas.py").read_text(encoding="utf-8")
    # Find the Literal block inside WindowCreate
    m = re.search(r"class WindowCreate.*?Literal\[(.*?)\]", src, re.DOTALL)
    assert m, "Could not find WindowCreate Literal type list in schemas.py"
    return set(re.findall(r'"([a-z_]+)"', m.group(1)))


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_cpp_registry_is_nonempty():
    specs = _cpp_registry_slugs()
    assert len(specs) >= 20, f"Expected >=20 C++ registry entries, got {len(specs)}"


def test_every_cpp_slug_in_python_enum():
    """Every C++ window type slug must have a matching Python WindowType value."""
    cpp_slugs = {s["slug"] for s in _cpp_registry_slugs()}
    py_slugs = _python_enum_slugs()
    missing = sorted(cpp_slugs - py_slugs)
    assert not missing, (
        f"C++ window types missing from Python WindowType enum: {missing}\n"
        f"Add them to tools/api_server/models.py WindowType class."
    )


def test_every_spawnable_cpp_slug_in_schema():
    """Every spawnable C++ type must appear in WindowCreate's Literal type list."""
    spawnable = {s["slug"] for s in _cpp_registry_slugs() if s["spawnable"]}
    schema_types = _schema_create_types()
    missing = sorted(spawnable - schema_types)
    assert not missing, (
        f"Spawnable C++ types missing from WindowCreate schema: {missing}\n"
        f"Add them to tools/api_server/schemas.py WindowCreate.type Literal."
    )


def test_no_python_enum_values_absent_from_cpp():
    """Python enum should not have phantom types that don't exist in C++.

    Exception: 'wallpaper' is a Python-only virtual type (not in C++ registry).
    """
    cpp_slugs = {s["slug"] for s in _cpp_registry_slugs()}
    py_slugs = _python_enum_slugs()
    # wallpaper is a known Python-only type (rendered by API, not C++ registry)
    allowed_python_only = {"wallpaper"}
    phantom = sorted((py_slugs - cpp_slugs) - allowed_python_only)
    assert not phantom, (
        f"Python WindowType has values not in C++ registry: {phantom}\n"
        f"Either add to window_type_registry.cpp or remove from models.py."
    )


def test_no_duplicate_schema_entries():
    """WindowCreate Literal should have no duplicate type strings."""
    src = (REPO_ROOT / "tools" / "api_server" / "schemas.py").read_text(encoding="utf-8")
    m = re.search(r"class WindowCreate.*?Literal\[(.*?)\]", src, re.DOTALL)
    assert m
    types = re.findall(r'"([a-z_]+)"', m.group(1))
    dupes = sorted(t for t in types if types.count(t) > 1)
    assert not dupes, f"Duplicate entries in WindowCreate Literal: {set(dupes)}"
