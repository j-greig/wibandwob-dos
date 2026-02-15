from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Dict, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.controller as controller_module
from tools.api_server.controller import Controller
from tools.api_server.events import EventHub


def test_workspace_persistence_path(monkeypatch) -> None:
    sent = []

    def _fake_send_cmd(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
        sent.append((cmd, dict(kv or {})))
        if cmd == "get_state":
            return '{"windows":[],"pattern_mode":"continuous"}'
        if cmd == "get_canvas_size":
            return '{"width":80,"height":25}'
        return "ok"

    monkeypatch.setattr(controller_module, "send_cmd", _fake_send_cmd)

    async def _run() -> None:
        ctl = Controller(EventHub())
        await ctl.save_workspace("workspaces/s02.json")
        await ctl.open_workspace("workspaces/s02.json")

    asyncio.run(_run())

    assert ("export_state", {"path": "workspaces/s02.json", "format": "json"}) in sent
    assert ("import_state", {"path": "workspaces/s02.json", "mode": "replace"}) in sent
