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


def test_gallery_window_toggle(monkeypatch) -> None:
    monkeypatch.setattr(
        controller_module,
        "fetch_render_bundle",
        lambda url, **_: {
            "url": url,
            "title": "t",
            "markdown": "# t",
            "tui_text": "t",
            "links": [],
            "assets": [],
            "meta": {"cache": "miss"},
        },
    )
    monkeypatch.setattr(controller_module, "send_cmd", lambda cmd, kv=None: "")

    async def _run() -> None:
        ctl = Controller(EventHub())
        opened = await ctl.browser_open("https://example.com/gallery")
        result = await ctl.browser_toggle_gallery(opened["window_id"])
        assert result["ok"] is True
        first = result["gallery_window_id"]
        again = await ctl.browser_toggle_gallery(opened["window_id"])
        assert again["ok"] is True
        assert again["gallery_window_id"] == first
        assert again["reused"] is True

    asyncio.run(_run())
