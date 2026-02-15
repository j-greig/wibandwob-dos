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


def test_browser_ai_actions(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(
        controller_module,
        "fetch_render_bundle",
        lambda url, **_: {
            "url": url,
            "title": "T",
            "markdown": "# Title\n\nSee [x](https://example.com/x)",
            "tui_text": "Title\n[x]",
            "links": [{"id": 1, "text": "x", "url": "https://example.com/x"}],
            "assets": [],
            "meta": {"cache": "miss"},
        },
    )
    monkeypatch.setattr(controller_module, "send_cmd", lambda cmd, kv=None: "")

    async def _run() -> None:
        ctl = Controller(EventHub())
        opened = await ctl.browser_open("https://example.com")
        wid = opened["window_id"]

        mode = await ctl.browser_set_mode(wid, "figlet_h1", "key-inline")
        assert mode["ok"]

        summary = await ctl.browser_summarise(wid, target="new_window")
        assert summary["ok"]
        assert summary["window_id"]

        links = await ctl.browser_extract_links(wid)
        assert links["ok"]
        assert len(links["links"]) == 1

        clip_path = tmp_path / "clip.md"
        clip = await ctl.browser_clip(wid, path=str(clip_path), include_images=False)
        assert clip["ok"]
        assert clip_path.exists()

    asyncio.run(_run())
