from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.mcp_tools as mcp_tools


def _registry_commands() -> set[str]:
    registry_source = Path("app/command_registry.cpp").read_text(encoding="utf-8")
    return set(
        re.findall(r'\{"([a-z_]+)"\s*,\s*"[^"]+"\s*,\s*(?:true|false)\}', registry_source)
    )


def test_all_registry_commands_have_mcp_command_tool_mapping() -> None:
    registry_commands = _registry_commands()
    builder_map = mcp_tools._command_tool_builders()
    missing = sorted(registry_commands - set(builder_map.keys()))
    assert not missing, f"Missing MCP command-tool mapping for registry commands: {missing}"
