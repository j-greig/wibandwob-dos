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


def _fake_send_cmd_import_fails(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
    if cmd == "import_state":
        return "err import apply failed"
    if cmd == "get_state":
        return json.dumps({"windows": [], "pattern_mode": "continuous"})
    if cmd == "get_canvas_size":
        return json.dumps({"width": 80, "height": 25})
    return "ok"


def test_open_workspace_applies_state_failure_is_not_silent(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(controller_module, "send_cmd", _fake_send_cmd_import_fails)

    bad_snapshot = tmp_path / "bad_snapshot.json"
    bad_snapshot.write_text("{", encoding="utf-8")

    async def _run() -> Dict[str, object]:
        ctl = Controller(EventHub())
        return await ctl.open_workspace(str(bad_snapshot))

    res = asyncio.run(_run())

    assert res.get("ok") is False
    assert "error" in res


def test_open_workspace_does_not_set_last_workspace_on_failure(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(controller_module, "send_cmd", _fake_send_cmd_import_fails)

    bad_snapshot = tmp_path / "bad_snapshot.json"
    bad_snapshot.write_text("{", encoding="utf-8")

    async def _run() -> tuple[Dict[str, object], object]:
        ctl = Controller(EventHub())
        res = await ctl.open_workspace(str(bad_snapshot))
        st = await ctl.get_state()
        return res, st.last_workspace

    res, last_workspace = asyncio.run(_run())
    assert res.get("ok") is False
    assert last_workspace is None
