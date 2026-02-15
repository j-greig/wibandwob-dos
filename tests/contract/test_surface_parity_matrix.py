from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.mcp_tools as mcp_tools


MENU_TO_REGISTRY = {
    "cmCascade": "cascade",
    "cmTile": "tile",
    "cmCloseAll": "close_all",
    "cmSaveWorkspace": "save_workspace",
    "cmOpenWorkspace": "open_workspace",
    "cmScreenshot": "screenshot",
    "cmPatternContinuous": "pattern_mode",
    "cmPatternTiled": "pattern_mode",
}


def _menu_symbols() -> set[str]:
    src = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")
    return set(re.findall(r"case (cm[A-Za-z0-9_]+):", src))


def _registry_commands() -> set[str]:
    src = Path("app/command_registry.cpp").read_text(encoding="utf-8")
    return set(re.findall(r'\{"([a-z_]+)"\s*,\s*"[^"]+"\s*,\s*(?:true|false)\}', src))


def test_surface_parity_matrix() -> None:
    menu_symbols = _menu_symbols()
    registry_commands = _registry_commands()
    builder_map = mcp_tools._command_tool_builders()

    # Menu -> registry mapping must exist.
    for menu_symbol, command_name in MENU_TO_REGISTRY.items():
        assert menu_symbol in menu_symbols, f"Menu symbol missing: {menu_symbol}"
        assert command_name in registry_commands, f"Registry command missing for {menu_symbol}: {command_name}"

    # Registry commands in migrated set must have MCP command-tool mapping.
    migrated_registry_set = set(MENU_TO_REGISTRY.values())
    missing_mcp = sorted(migrated_registry_set - set(builder_map.keys()))
    assert not missing_mcp, f"MCP command-tool mapping missing for: {missing_mcp}"
