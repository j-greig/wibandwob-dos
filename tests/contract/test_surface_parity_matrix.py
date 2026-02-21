"""Auto-derived surface parity: C++ command registry → MCP tool builders.

Parses both sides from source — no hardcoded mapping dicts. Adding a command
to get_command_capabilities() without a matching MCP tool builder will fail.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.mcp_tools as mcp_tools


def _registry_commands() -> set[str]:
    """Parse all command names from get_command_capabilities() in command_registry.cpp."""
    src = (REPO_ROOT / "app" / "command_registry.cpp").read_text(encoding="utf-8")
    return set(re.findall(r'\{"([a-z_]+)"\s*,\s*"[^"]+"\s*,\s*(?:true|false)\}', src))


def _menu_handled_symbols() -> set[str]:
    """Parse all `case cmXxx:` symbols from test_pattern_app.cpp."""
    src = (REPO_ROOT / "app" / "test_pattern_app.cpp").read_text(encoding="utf-8")
    return set(re.findall(r"case (cm[A-Za-z0-9_]+):", src))


def _mcp_tool_builder_commands() -> set[str]:
    """Commands that have an MCP tool builder in mcp_tools.py."""
    return set(mcp_tools._command_tool_builders().keys())


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_registry_is_nonempty():
    cmds = _registry_commands()
    assert len(cmds) >= 15, f"Expected >=15 registry commands, got {len(cmds)}"


def test_every_registry_command_has_mcp_tool():
    """Every C++ command registry entry must have a corresponding MCP tool builder."""
    registry = _registry_commands()
    mcp_cmds = _mcp_tool_builder_commands()
    missing = sorted(registry - mcp_cmds)
    assert not missing, (
        f"C++ registry commands missing MCP tool builders: {missing}\n"
        f"Add entries to _command_tool_builders() in tools/api_server/mcp_tools.py."
    )


def test_no_phantom_mcp_tools():
    """MCP tool builders should not reference commands absent from C++ registry."""
    registry = _registry_commands()
    mcp_cmds = _mcp_tool_builder_commands()
    # Some MCP tools may be Python-only (theme commands routed differently)
    # but _command_tool_builders specifically wraps registry commands.
    phantom = sorted(mcp_cmds - registry)
    assert not phantom, (
        f"MCP tool builders reference commands not in C++ registry: {phantom}\n"
        f"Either add to command_registry.cpp or remove from mcp_tools.py."
    )
