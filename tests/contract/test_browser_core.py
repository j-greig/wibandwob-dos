from __future__ import annotations

import asyncio
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.controller as controller_module
from tools.api_server.controller import Controller
from tools.api_server.events import EventHub


def _bundle(url: str) -> dict:
    return {
        "url": url,
        "title": f"title:{url}",
        "markdown": f"# {url}\ncontent",
        "tui_text": f"text:{url}",
        "links": [{"id": 1, "text": "next", "url": "https://example.com/next"}],
        "assets": [],
        "meta": {"cache": "miss"},
    }


def test_browser_open_and_history_navigation(monkeypatch) -> None:
    monkeypatch.setattr(controller_module, "fetch_render_bundle", lambda url, **_: _bundle(url))
    monkeypatch.setattr(controller_module, "send_cmd", lambda cmd, kv=None: "")

    async def _run() -> None:
        ctl = Controller(EventHub())
        a = await ctl.browser_open("https://example.com/a")
        wid = a["window_id"]
        await ctl.browser_open("https://example.com/b", window_id=wid, mode="same")
        await ctl.browser_open("https://example.com/c", window_id=wid, mode="same")

        back = await ctl.browser_back(wid)
        assert back["url"].endswith("/b")
        back2 = await ctl.browser_back(wid)
        assert back2["url"].endswith("/a")
        fwd = await ctl.browser_forward(wid)
        assert fwd["url"].endswith("/b")

    asyncio.run(_run())
