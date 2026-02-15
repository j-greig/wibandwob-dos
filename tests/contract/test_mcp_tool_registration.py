from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.mcp_tools as mcp_tools


class FakeMCP:
    def __init__(self) -> None:
        self.names = []

    def tool(self, name: str):
        self.names.append(name)

        def _decorator(func):
            return func

        return _decorator


def test_registers_command_tools_from_registry_capabilities(monkeypatch) -> None:
    payload = {
        "version": "v1",
        "commands": [
            {"name": "cascade", "description": "d", "requires_path": False},
            {"name": "pattern_mode", "description": "d", "requires_path": False},
            {"name": "open_workspace", "description": "d", "requires_path": True},
        ],
    }
    monkeypatch.setattr(mcp_tools, "send_cmd", lambda cmd, kv=None: json.dumps(payload))

    mcp = FakeMCP()
    mcp_tools.register_tui_tools(mcp)

    assert "tui_cascade_windows" in mcp.names
    assert "tui_set_pattern_mode" in mcp.names
    assert "tui_open_workspace" in mcp.names
    assert "tui_tile_windows" not in mcp.names


def test_fallback_registration_when_registry_unavailable(monkeypatch) -> None:
    def _raise(_cmd, kv=None):
        raise RuntimeError("ipc unavailable")

    monkeypatch.setattr(mcp_tools, "send_cmd", _raise)
    mcp = FakeMCP()
    mcp_tools.register_tui_tools(mcp)

    for tool_name in [
        "tui_cascade_windows",
        "tui_tile_windows",
        "tui_close_all_windows",
        "tui_set_pattern_mode",
        "tui_screenshot",
        "tui_save_workspace",
        "tui_open_workspace",
    ]:
        assert tool_name in mcp.names
