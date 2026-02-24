"""Contract tests: Node MCP bridge architecture invariants.

The embedded Wib&Wob agent uses exactly 2 generic MCP tools that discover
and execute commands at runtime via the REST API. This test ensures:
  - mcp_tools.js has exactly the expected tools
  - Tools call the correct REST endpoints
  - claude_sdk_bridge.js does not hardcode tool names or reference phantom tools

There is NO tools/api_server/mcp_tools.py — Python MCP is auto-derived
from FastAPI routes via FastApiMCP(app).
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NODE_MCP = ROOT / "app" / "llm" / "sdk_bridge" / "mcp_tools.js"
BRIDGE = ROOT / "app" / "llm" / "sdk_bridge" / "claude_sdk_bridge.js"


def _node_tool_names() -> set[str]:
    """Extract tool names from mcp_tools.js tool() calls."""
    src = NODE_MCP.read_text()
    return set(re.findall(r'tool\(\s*["\']([a-z_]+)["\']', src))


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_node_mcp_has_expected_tools():
    """Node MCP should have exactly 2 generic tools."""
    names = _node_tool_names()
    expected = {"tui_list_commands", "tui_menu_command"}
    assert names == expected, (
        f"Node MCP tools changed!\n"
        f"  Expected: {sorted(expected)}\n"
        f"  Got: {sorted(names)}\n"
        f"The Node MCP is intentionally generic (2 tools). "
        f"New commands are discovered at runtime via GET /commands."
    )


def test_tui_list_commands_calls_commands_endpoint():
    """tui_list_commands must call GET /commands to discover the registry."""
    src = NODE_MCP.read_text()
    assert "/commands" in src, (
        "tui_list_commands should call GET /commands for registry discovery"
    )


def test_tui_menu_command_calls_menu_endpoint():
    """tui_menu_command must call POST /menu/command to execute."""
    src = NODE_MCP.read_text()
    assert "/menu/command" in src, (
        "tui_menu_command should call POST /menu/command for execution"
    )


def test_bridge_no_hardcoded_mcp_tool_names():
    """claude_sdk_bridge.js should NOT contain hardcoded mcp__tui-control__ strings."""
    src = BRIDGE.read_text()
    hardcoded = re.findall(r'"mcp__tui-control__[a-z_]+"', src)
    assert not hardcoded, (
        f"Bridge still has {len(hardcoded)} hardcoded MCP tool names — "
        f"should auto-derive from mcpServer.tools:\n"
        f"  {hardcoded[:5]}..."
    )


def test_bridge_no_phantom_tool_references():
    """Bridge should not reference tools that don't exist in mcp_tools.js."""
    bridge_src = BRIDGE.read_text()
    node_tools = _node_tool_names()
    # Check for references to old/phantom tool names
    phantom_patterns = ["tui_create_window", "tui_open_window", "tui_close_window"]
    found_phantoms = []
    for phantom in phantom_patterns:
        if phantom in bridge_src and phantom not in node_tools:
            found_phantoms.append(phantom)
    assert not found_phantoms, (
        f"Bridge references phantom tools not in mcp_tools.js: {found_phantoms}\n"
        f"Actual Node MCP tools: {sorted(node_tools)}\n"
        f"Fix claude_sdk_bridge.js to use tui_menu_command instead."
    )
