from __future__ import annotations

import re
from pathlib import Path


COMMAND_TOOL_MAPPING = {
    "cascade": "tui_cascade_windows",
    "tile": "tui_tile_windows",
    "close_all": "tui_close_all_windows",
    "pattern_mode": "tui_set_pattern_mode",
    "screenshot": "tui_screenshot",
    "save_workspace": "tui_save_workspace",
    "open_workspace": "tui_open_workspace",
}


def test_mcp_command_tools_use_canonical_dispatch() -> None:
    source = Path("tools/api_server/mcp_tools.py").read_text(encoding="utf-8")
    assert "_registry_command_names()" in source
    assert 'mcp.tool(tool_spec["tool_name"])(tool_spec["handler"])' in source
    for command in COMMAND_TOOL_MAPPING:
        assert f'"{command}": {{' in source


def test_registry_commands_have_matching_mcp_command_tools() -> None:
    registry_source = Path("app/command_registry.cpp").read_text(encoding="utf-8")
    mcp_source = Path("tools/api_server/mcp_tools.py").read_text(encoding="utf-8")

    registry_commands = set(
        re.findall(r'\{"([a-z_]+)"\s*,\s*"[^"]+"\s*,\s*(?:true|false)\}', registry_source)
    )
    for command, tool_name in COMMAND_TOOL_MAPPING.items():
        assert command in registry_commands
        assert f'"tool_name": "{tool_name}"' in mcp_source
