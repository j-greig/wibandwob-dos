"""Auto-derived parity test: C++ window_type_registry vs Python WindowType enum,
PLUS agent reachability — can the embedded Wib&Wob agent actually SPAWN each type?

Both sides are parsed from source — no hardcoded lists.  Adding a new type
to k_specs[] without updating models.py, schemas.py, AND providing an open_*
command will fail this test.

The key insight: window types in the registry are useless to the agent unless
there's a command to create them. The Node MCP bridge only has tui_menu_command
→ POST /menu/command → exec_registry_command(). So every spawnable type needs
either:
  (a) an open_<slug> command in command_registry.cpp, OR
  (b) a create_window IPC command route (reachable via POST /windows but NOT
      via the embedded agent's tui_menu_command tool)

This test enforces (a) because that's the agent's only path.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.api_server.models import WindowType


# ── Parsers ────────────────────────────────────────────────────────────────────


def _cpp_registry_slugs() -> list[dict[str, object]]:
    """Parse k_specs[] entries from window_type_registry.cpp.

    Returns list of {"slug": str, "spawnable": bool} dicts.
    Spawnable = spawn function is not 'nullptr'.
    """
    src = (REPO_ROOT / "app" / "window_type_registry.cpp").read_text(encoding="utf-8")
    results = []
    for m in re.finditer(r'\{\s*"([a-z_]+)"\s*,', src):
        slug = m.group(1)
        after = src[m.end():m.end() + 50]
        spawnable = "nullptr" not in after.split(",")[0]
        results.append({"slug": slug, "spawnable": spawnable})
    return results


def _python_enum_slugs() -> set[str]:
    return {t.value for t in WindowType}


def _schema_create_types() -> set[str]:
    """Parse the Literal[...] type list from WindowCreate in schemas.py."""
    src = (REPO_ROOT / "tools" / "api_server" / "schemas.py").read_text(encoding="utf-8")
    m = re.search(r"class WindowCreate.*?Literal\[(.*?)\]", src, re.DOTALL)
    assert m, "Could not find WindowCreate Literal type list in schemas.py"
    return set(re.findall(r'"([a-z_]+)"', m.group(1)))


def _command_registry_commands() -> set[str]:
    """All command names from get_command_capabilities()."""
    src = (REPO_ROOT / "app" / "command_registry.cpp").read_text(encoding="utf-8")
    return set(re.findall(r'\{"([a-z_]+)"\s*,\s*"[^"]+"\s*,\s*(?:true|false)\}', src))


def _open_commands_target_slugs() -> dict[str, str]:
    """Map open_* command names to the window type slug they spawn.

    Most follow the pattern open_<slug> → <slug>.
    Known aliases are handled explicitly.
    """
    # Start with all open_* commands
    cmds = _command_registry_commands()
    open_cmds = {c for c in cmds if c.startswith("open_")}

    # Map command → slug. Most are open_<slug> → <slug>.
    # Known aliases where the command name doesn't match the registry slug:
    ALIASES = {
        "open_apps": "app_launcher",
        "open_paint_file": "paint",
        "open_workspace": None,  # workspace management, not a window type
        "open_primer": "text_view",  # opens a text_view with a primer file
    }

    result = {}
    for cmd in open_cmds:
        if cmd in ALIASES:
            slug = ALIASES[cmd]
            if slug is not None:
                result[cmd] = slug
        else:
            result[cmd] = cmd.removeprefix("open_")
    return result


# ── Tests: Python ↔ C++ enum parity ───────────────────────────────────────────


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
    """Python enum should not have phantom types that don't exist in C++."""
    cpp_slugs = {s["slug"] for s in _cpp_registry_slugs()}
    py_slugs = _python_enum_slugs()
    phantom = sorted(py_slugs - cpp_slugs)
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


# ── Tests: Agent reachability ──────────────────────────────────────────────────
#
# The embedded Wib&Wob agent uses Node MCP with 2 tools:
#   tui_list_commands  → GET /commands
#   tui_menu_command   → POST /menu/command → exec_registry_command()
#
# So the ONLY way the agent can spawn a window is via an open_* command.
# Window types without an open_* command are invisible to the agent.


# Types that are intentionally NOT directly openable by the agent.
# Each must have a comment explaining WHY.
AGENT_SPAWN_EXCEPTIONS = {
    # Content types - these are sub-views or internal types, not standalone windows
    "score",          # score overlay, spawned by games internally
    "test_pattern",   # legacy test pattern, opened via menu only (not useful for agent)

    # Generative art types - opened via open_test_pattern / pattern_mode commands
    # or via POST /windows but not needed as standalone agent commands.
    # TODO: Consider adding open_* for these if agents need them.
    "animated_gradient",
    "ascii",
    "blocks",
    "cube",
    "gradient",
    "life",
    "monster_cam",
    "monster_portal",
    "monster_verse",
    "mycelium",
    "orbit",
    "torus",
    "verse",

    # Composite types - spawned as part of other workflows
    "browser",        # spawned by open_apps/open_gallery, not standalone
    "frame_player",   # spawned with a path param via other commands
    # paint is reachable via open_paint_file (alias) — but only with a path
    # TODO(P1): Add open_paint command for blank canvas creation
}


def test_every_spawnable_type_reachable_by_agent():
    """Every spawnable window type must be reachable by the embedded agent.

    Either:
    1. There's an open_<slug> (or aliased) command in the registry, OR
    2. The type is in AGENT_SPAWN_EXCEPTIONS with a documented reason.

    If this test fails, the agent literally cannot create that window type.
    Fix by adding an open_<slug> command to command_registry.cpp.
    """
    spawnable = {s["slug"] for s in _cpp_registry_slugs() if s["spawnable"]}
    open_targets = set(_open_commands_target_slugs().values())

    unreachable = sorted(spawnable - open_targets - AGENT_SPAWN_EXCEPTIONS)
    assert not unreachable, (
        f"Window types the agent CANNOT spawn (no open_* command): {unreachable}\n"
        f"\n"
        f"Fix: add open_<type> command to app/command_registry.cpp for each.\n"
        f"Or if intentionally not agent-spawnable, add to AGENT_SPAWN_EXCEPTIONS\n"
        f"in this test with a comment explaining why."
    )


def test_no_stale_spawn_exceptions():
    """AGENT_SPAWN_EXCEPTIONS should not list types that now HAVE open_* commands.

    If someone adds an open_* command for a type, remove it from exceptions.
    """
    open_targets = set(_open_commands_target_slugs().values())
    stale = sorted(AGENT_SPAWN_EXCEPTIONS & open_targets)
    assert not stale, (
        f"Types in AGENT_SPAWN_EXCEPTIONS that now have open_* commands: {stale}\n"
        f"Remove them from AGENT_SPAWN_EXCEPTIONS in this test."
    )


def test_spawn_exceptions_are_real_types():
    """Every exception must be an actual window type slug."""
    all_slugs = {s["slug"] for s in _cpp_registry_slugs()}
    bogus = sorted(AGENT_SPAWN_EXCEPTIONS - all_slugs)
    assert not bogus, (
        f"AGENT_SPAWN_EXCEPTIONS references non-existent types: {bogus}\n"
        f"Remove them."
    )


def test_open_command_targets_are_real_types():
    """Every open_* command must target a real window type slug."""
    all_slugs = {s["slug"] for s in _cpp_registry_slugs()}
    targets = _open_commands_target_slugs()
    bogus = {cmd: slug for cmd, slug in targets.items() if slug not in all_slugs}
    assert not bogus, (
        f"open_* commands target non-existent window types: {bogus}\n"
        f"Fix the alias mapping in _open_commands_target_slugs() or add the type."
    )
