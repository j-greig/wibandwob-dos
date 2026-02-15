from __future__ import annotations

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


def test_browser_mcp_tools_registered(monkeypatch) -> None:
    monkeypatch.setattr(mcp_tools, "send_cmd", lambda cmd, kv=None: '{"version":"v1","commands":[]}')
    mcp = FakeMCP()
    mcp_tools.register_tui_tools(mcp)

    expected = {
        "browser.open",
        "browser.back",
        "browser.forward",
        "browser.refresh",
        "browser.find",
        "browser.set_mode",
        "browser.fetch",
        "browser.render",
        "browser.get_content",
        "browser.summarise",
        "browser.extract_links",
        "browser.clip",
        "browser.gallery",
    }
    assert expected.issubset(set(mcp.names))
