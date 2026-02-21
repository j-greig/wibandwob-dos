"""Contract tests: Node MCP tools must stay in sync with Python MCP surface.

These tests parse source files directly — no running servers needed.
They catch drift between:
  - app/llm/sdk_bridge/mcp_tools.js (Node MCP tools for embedded agent)
  - tools/api_server/mcp_tools.py (Python MCP tools for external clients)
  - app/llm/sdk_bridge/claude_sdk_bridge.js (SDK bridge tool whitelist)
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NODE_MCP = ROOT / "app" / "llm" / "sdk_bridge" / "mcp_tools.js"
PY_MCP = ROOT / "tools" / "api_server" / "mcp_tools.py"
BRIDGE = ROOT / "app" / "llm" / "sdk_bridge" / "claude_sdk_bridge.js"


def _node_tool_names() -> set[str]:
    """Extract tool names from mcp_tools.js tool() calls."""
    src = NODE_MCP.read_text()
    # Pattern: tool(\n  "tui_xxx",  or tool("tui_xxx",
    return set(re.findall(r'tool\(\s*["\']([a-z_]+)["\']', src))


def _python_tool_names() -> set[str]:
    """Extract tool names from Python MCP registrations."""
    src = PY_MCP.read_text()
    # tool_name fields from _command_tool_builders
    names = set(re.findall(r'"tool_name":\s*"([^"]+)"', src))
    # @mcp.tool("tui_xxx") decorators
    names |= set(re.findall(r'@mcp\.tool\(\s*"([^"]+)"', src))
    return names


# --- Tests ---

def test_node_tools_nonempty():
    names = _node_tool_names()
    assert len(names) >= 10, f"Expected >=10 Node MCP tools, got {len(names)}: {names}"


def test_python_tools_nonempty():
    names = _python_tool_names()
    assert len(names) >= 10, f"Expected >=10 Python MCP tools, got {len(names)}: {names}"


def test_every_python_command_tool_has_node_equivalent():
    """Every Python MCP command tool should have a matching Node tool."""
    py = _python_tool_names()
    node = _node_tool_names()
    # Some Python tools are intentionally not in the Node bridge:
    # - browser.* tools: complex multi-step browser control (agent uses tui_create_window type=browser)
    # - browser_* legacy aliases
    # - tui_terminal_*_cmd: duplicates of tui_terminal_write/read
    # - tui_batch_layout, tui_focus_window, tui_timeline_*: specialist/advanced tools
    allowed_python_only = {
        "tui_terminal_write_cmd",
        "tui_terminal_read_cmd",
        "tui_batch_layout",
        "tui_focus_window",
        "tui_timeline_cancel",
        "tui_timeline_status",
    }
    # Browser tools use dot-notation or legacy underscored names
    allowed_python_only |= {n for n in py if n.startswith("browser")}
    missing = py - node - allowed_python_only
    assert not missing, (
        f"Python MCP tools missing from Node mcp_tools.js:\n"
        f"  {sorted(missing)}\n"
        f"Node has: {sorted(node)}\n"
        f"Python has: {sorted(py)}"
    )


def test_create_window_not_restrictive_enum():
    """tui_create_window should use z.string(), not z.enum() for type."""
    src = NODE_MCP.read_text()
    # Find the tui_create_window tool definition and check its type field
    # Should NOT have z.enum for the type parameter
    match = re.search(
        r'tool\(\s*"tui_create_window".*?type:\s*(z\.\w+)',
        src,
        re.DOTALL
    )
    assert match, "Could not find tui_create_window tool definition"
    validator = match.group(1)
    assert validator != "z.enum", (
        f"tui_create_window type uses {validator} — should be z.string() "
        f"to avoid hardcoding window types"
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
