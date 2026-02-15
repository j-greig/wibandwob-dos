from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Optional

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.controller as controller_module
from tools.api_server.controller import Controller
from tools.api_server.events import EventHub


class _FakeWebSocket:
    def __init__(self) -> None:
        self.messages = []

    async def send_text(self, payload: str) -> None:
        self.messages.append(payload)


def _fake_send_cmd(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
    if cmd == "exec_command":
        return "ok"
    if cmd == "get_state":
        return '{"windows":[],"pattern_mode":"continuous"}'
    if cmd == "get_canvas_size":
        return '{"width":80,"height":25}'
    return "ok"


def test_snapshot_round_trip_and_event_emission(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(controller_module, "send_cmd", _fake_send_cmd)

    async def _run() -> None:
        events = EventHub()
        ws = _FakeWebSocket()
        await events.add(ws)

        controller = Controller(events)
        result = await controller.exec_command("cascade", {})
        assert result["ok"] is True

        state = await controller.get_state()
        snapshot = {
            "pattern_mode": state.pattern_mode,
            "canvas": {"w": state.canvas_width, "h": state.canvas_height},
            "windows": [
                {
                    "id": w.id,
                    "title": w.title,
                    "x": w.rect.x,
                    "y": w.rect.y,
                    "w": w.rect.w,
                    "h": w.rect.h,
                }
                for w in state.windows
            ],
        }

        encoded = json.dumps(snapshot, sort_keys=True)
        decoded = json.loads(encoded)
        assert decoded == json.loads(encoded)

        emitted = [json.loads(m) for m in ws.messages]
        assert any(e.get("event") == "command.executed" for e in emitted)
        assert any(
            e.get("event") == "command.executed" and e.get("data", {}).get("command") == "cascade"
            for e in emitted
        )

    asyncio.run(_run())
