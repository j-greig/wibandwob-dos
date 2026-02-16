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


def _bundle(url: str, image_mode: str) -> dict:
    status = "ready" if image_mode in ("key-inline", "all-inline") else "deferred"
    return {
        "url": url,
        "title": "Mode Test",
        "markdown": "# Title\n\nBody",
        "tui_text": "Title",
        "links": [],
        "assets": [
            {
                "id": "img1",
                "source_url": "https://img.example.com/1.png",
                "alt": "one",
                "anchor_index": 1,
                "status": status,
                "ansi_block": "ANSI BLOCK" if status == "ready" else "",
                "render_meta": {"backend": "chafa", "width_cells": 80, "height_cells": 10, "duration_ms": 12, "cache_hit": False},
            }
        ],
        "meta": {"cache": "miss"},
    }


def test_mode_switch_and_gallery_and_state_persistence(monkeypatch) -> None:
    monkeypatch.setattr(controller_module, "send_cmd", lambda cmd, kv=None: "")
    monkeypatch.setattr(
        controller_module,
        "fetch_render_bundle",
        lambda url, **kwargs: _bundle(url, kwargs.get("image_mode", "none")),
    )

    async def _run() -> None:
        ctl = Controller(EventHub())
        opened = await ctl.browser_open("https://example.com/modes")
        wid = opened["window_id"]

        mode = await ctl.browser_set_mode(wid, headings="figlet_h1", images="key-inline")
        assert mode["ok"] is True
        assert mode["image_mode"] == "key-inline"

        content = await ctl.browser_get_content(wid, fmt="text")
        assert "[images mode=key-inline]" in content["content"]

        gallery = await ctl.browser_toggle_gallery(wid)
        assert gallery["ok"] is True
        assert gallery["gallery_window_id"]

        mode_after = await ctl.browser_set_mode(wid, headings=None, images="gallery")
        assert mode_after["image_mode"] == "gallery"

        snapshot = ctl._snapshot_from_state()  # noqa: SLF001
        browser_windows = [w for w in snapshot["windows"] if w["id"] == wid]
        assert browser_windows
        assert browser_windows[0]["props"]["image_mode"] == "gallery"

    asyncio.run(_run())
