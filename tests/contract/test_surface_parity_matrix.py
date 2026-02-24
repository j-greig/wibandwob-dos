"""Auto-derived surface parity: C++ command registry ↔ dispatch + menu.

Parses source files directly — no running servers needed. Adding a command
to get_command_capabilities() without wiring dispatch will fail.

NOTE: There is no tools/api_server/mcp_tools.py. Python MCP is auto-derived
from FastAPI routes via FastApiMCP(app). Node MCP uses 2 generic tools
(tui_list_commands + tui_menu_command) that discover commands at runtime.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _registry_commands() -> set[str]:
    """Parse all command names from get_command_capabilities() in command_registry.cpp."""
    src = (REPO_ROOT / "app" / "command_registry.cpp").read_text(encoding="utf-8")
    return set(re.findall(r'\{"([a-z_]+)"\s*,\s*"[^"]+"\s*,\s*(?:true|false)\}', src))


def _dispatched_commands() -> set[str]:
    """Parse all command names handled in exec_registry_command() dispatch."""
    src = (REPO_ROOT / "app" / "command_registry.cpp").read_text(encoding="utf-8")
    # Match: if (name == "xxx")
    return set(re.findall(r'if\s*\(name\s*==\s*"([a-z_]+)"\)', src))


def _menu_handled_symbols() -> set[str]:
    """Parse all `case cmXxx:` symbols from wwdos_app.cpp."""
    src = (REPO_ROOT / "app" / "wwdos_app.cpp").read_text(encoding="utf-8")
    return set(re.findall(r"case (cm[A-Za-z0-9_]+):", src))


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_registry_is_nonempty():
    cmds = _registry_commands()
    assert len(cmds) >= 15, f"Expected >=15 registry commands, got {len(cmds)}"


def test_every_registry_command_has_dispatch():
    """Every command in the registry must have a dispatch case in exec_registry_command()."""
    registry = _registry_commands()
    dispatched = _dispatched_commands()
    missing = sorted(registry - dispatched)
    assert not missing, (
        f"Registry commands with no dispatch in exec_registry_command(): {missing}\n"
        f"Add if (name == \"<cmd>\") cases in app/command_registry.cpp."
    )


def test_no_phantom_dispatch():
    """Dispatch cases should not reference commands absent from the registry."""
    registry = _registry_commands()
    dispatched = _dispatched_commands()
    phantom = sorted(dispatched - registry)
    assert not phantom, (
        f"Dispatched commands not in registry: {phantom}\n"
        f"Either add to get_command_capabilities() or remove dispatch case."
    )


def test_menu_has_window_commands():
    """TUI menu should have cm* symbols for common window operations.

    NOTE: cm* symbol names are historical and don't follow a clean naming
    convention from registry command names. This test checks that key
    window management symbols exist, not a 1:1 mapping.
    """
    menu_syms = _menu_handled_symbols()
    # Essential window management commands that must be in the menu
    required_syms = {
        "cmCascade", "cmTile", "cmCloseAll",
    }
    missing = sorted(required_syms - menu_syms)
    assert not missing, (
        f"Essential menu symbols missing from handleEvent: {missing}"
    )
