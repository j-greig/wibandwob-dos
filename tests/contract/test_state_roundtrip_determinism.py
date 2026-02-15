from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.controller as controller_module
from tools.api_server.controller import Controller
from tools.api_server.events import EventHub
from tools.api_server.models import Rect, WindowType


def test_export_import_roundtrip_is_deterministic(monkeypatch, tmp_path: Path) -> None:
    def _raise(_cmd, _kv=None):
        raise RuntimeError("ipc unavailable")

    monkeypatch.setattr(controller_module, "send_cmd", _raise)

    async def _run() -> tuple[dict, dict]:
        src = Controller(EventHub())
        await src.create_window(WindowType.test_pattern, "A", Rect(1, 1, 20, 8), {})
        await src.create_window(WindowType.text_editor, "B", Rect(5, 2, 30, 10), {})
        src._state.pattern_mode = "tiled"

        p1 = tmp_path / "snap1.json"
        p2 = tmp_path / "snap2.json"

        assert (await src.export_state(str(p1), "json"))["ok"]

        dst = Controller(EventHub())
        assert (await dst.import_state(str(p1), "replace"))["ok"]
        assert (await dst.export_state(str(p2), "json"))["ok"]

        a = json.loads(p1.read_text(encoding="utf-8"))
        b = json.loads(p2.read_text(encoding="utf-8"))
        return a, b

    a, b = asyncio.run(_run())
    assert a == b
