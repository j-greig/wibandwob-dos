from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Optional

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


def _fake_send_cmd(_cmd: str, _kv: Optional[Dict[str, str]] = None) -> str:
    return "ok"


def test_actor_attribution_on_command_event(monkeypatch) -> None:
    monkeypatch.setattr(controller_module, "send_cmd", _fake_send_cmd)

    async def _run() -> None:
        hub = EventHub()
        ws = _FakeWebSocket()
        await hub.add(ws)

        controller = Controller(hub)
        result = await controller.exec_command("cascade", {}, actor="tester")
        assert result["ok"] is True
        assert result["actor"] == "tester"

        payloads = [json.loads(m) for m in ws.messages]
        event = next(p for p in payloads if p.get("event") == "command.executed")
        assert event["data"]["command"] == "cascade"
        assert event["data"]["actor"] == "tester"

    asyncio.run(_run())
