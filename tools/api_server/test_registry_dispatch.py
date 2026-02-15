#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Optional, Tuple, List

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.controller as controller_module  # noqa: E402
from tools.api_server.controller import Controller  # noqa: E402
from tools.api_server.events import EventHub  # noqa: E402


def _registry_payload() -> Dict[str, object]:
    return {
        "version": "v1",
        "commands": [
            {"name": "cascade", "description": "Cascade all windows on desktop", "requires_path": False},
            {"name": "tile", "description": "Tile all windows on desktop", "requires_path": False},
            {"name": "close_all", "description": "Close all windows", "requires_path": False},
            {"name": "save_workspace", "description": "Save current workspace", "requires_path": False},
            {"name": "open_workspace", "description": "Open workspace from a path", "requires_path": True},
            {"name": "screenshot", "description": "Capture screen to a text snapshot", "requires_path": False},
        ],
    }


async def _run() -> None:
    sent: List[Tuple[str, Dict[str, str]]] = []

    def fake_send_cmd(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
        sent.append((cmd, dict(kv or {})))
        if cmd == "exec_command":
            return "ok"
        if cmd == "get_capabilities":
            return json.dumps(_registry_payload())
        if cmd == "get_state":
            return '{"windows":[],"pattern_mode":"continuous"}'
        if cmd == "get_canvas_size":
            return '{"width":80,"height":25}'
        return "ok"

    original = controller_module.send_cmd
    controller_module.send_cmd = fake_send_cmd
    try:
        ctl = Controller(EventHub())
        result = await ctl.exec_command("cascade", {})
        assert result["ok"] is True, result
        assert sent[0][0] == "exec_command", sent
        assert sent[0][1].get("name") == "cascade", sent

        caps = await ctl.get_capabilities()
        assert "cascade" in caps["commands"], caps
        assert "open_workspace" in caps["commands"], caps
    finally:
        controller_module.send_cmd = original


if __name__ == "__main__":
    asyncio.run(_run())
    print("PASS: registry dispatch path uses canonical exec_command + capabilities source")
