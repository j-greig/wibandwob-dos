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
from tools.api_server.models import Rect, WindowType


class _FakeWebSocket:
    def __init__(self) -> None:
        self.messages = []

    async def send_text(self, payload: str) -> None:
        self.messages.append(payload)


def test_instance_isolation(monkeypatch) -> None:
    monkeypatch.setattr(controller_module, "send_cmd", lambda cmd, kv=None: "")

    async def _run() -> None:
        hub_a = EventHub()
        hub_b = EventHub()
        ws_a = _FakeWebSocket()
        ws_b = _FakeWebSocket()
        await hub_a.add(ws_a)
        await hub_b.add(ws_b)

        ctl_a = Controller(hub_a)
        ctl_b = Controller(hub_b)

        await ctl_a.create_window(WindowType.test_pattern, "A", Rect(1, 1, 20, 8), {})

        state_a = await ctl_a.get_state()
        state_b = await ctl_b.get_state()

        assert len(state_a.windows) >= 1
        assert len(state_b.windows) == 0

        assert len(ws_a.messages) >= 1
        assert len(ws_b.messages) == 0

    asyncio.run(_run())
