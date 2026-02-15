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


def test_state_event_logging(monkeypatch, tmp_path: Path) -> None:
    log_path = tmp_path / "events.ndjson"
    monkeypatch.setenv("WWD_STATE_EVENT_LOG_PATH", str(log_path))
    monkeypatch.setattr(controller_module, "send_cmd", lambda cmd, kv=None: "")

    async def _run() -> None:
        ctl = Controller(EventHub())
        await ctl.create_window(WindowType.test_pattern, "A", Rect(1, 1, 20, 8), {})
        await ctl.exec_command("cascade", {}, actor="tester")

    asyncio.run(_run())

    lines = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    event_types = [e["event"] for e in lines]
    assert "window.created" in event_types
    assert "command.executed" in event_types
    cmd_event = next(e for e in lines if e["event"] == "command.executed")
    assert cmd_event["actor"] == "tester"
