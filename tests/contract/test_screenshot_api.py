from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.controller as controller_module
import tools.api_server.main as main_module
from tools.api_server.controller import Controller
from tools.api_server.events import EventHub
from fastapi.testclient import TestClient


def _write_fake_capture(root: Path, suffix: str = ".txt") -> Path:
    shots = root / "logs" / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S", time.localtime())
    p = shots / f"tui_{ts}{suffix}"
    p.write_text("frame-capture", encoding="utf-8")
    return p


def test_screenshot_api_uses_ipc_capture_and_returns_existing_path(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(controller_module, "send_cmd", lambda cmd, kv=None: _write_fake_capture(tmp_path, ".txt") and "ok")

    async def _run() -> None:
        ctl = Controller(EventHub())
        ctl._repo_root = tmp_path
        res = await ctl.screenshot(None)
        assert res["ok"] is True
        assert Path(res["path"]).exists()
        assert res["file_exists"] is True
        assert res["bytes"] > 0

    asyncio.run(_run())


def test_screenshot_api_copies_capture_to_requested_path(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(controller_module, "send_cmd", lambda cmd, kv=None: _write_fake_capture(tmp_path, ".ans") and "ok")

    target = tmp_path / "artifacts" / "capture.ans"

    async def _run() -> None:
        ctl = Controller(EventHub())
        ctl._repo_root = tmp_path
        res = await ctl.screenshot(str(target))
        assert res["ok"] is True
        assert res["path"] == str(target)
        assert target.exists()
        assert target.read_text(encoding="utf-8") == "frame-capture"

    asyncio.run(_run())


def test_screenshot_api_returns_error_if_no_output_created(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(controller_module, "send_cmd", lambda cmd, kv=None: "ok")

    async def _run() -> None:
        ctl = Controller(EventHub())
        ctl._repo_root = tmp_path
        res = await ctl.screenshot(None)
        assert res["ok"] is False
        assert res["error"] == "screenshot_missing_output"

    asyncio.run(_run())


def test_screenshot_route_returns_400_on_capture_failure(monkeypatch) -> None:
    async def _fake_fail(self, path):
        return {"ok": False, "error": "screenshot_missing_output"}

    monkeypatch.setattr(controller_module.Controller, "screenshot", _fake_fail)
    client = TestClient(main_module.make_app())
    resp = client.post("/screenshot", json={"path": "/tmp/missing.txt"})
    assert resp.status_code == 400
    assert "screenshot_missing_output" in resp.text


def test_screenshot_route_returns_metadata_on_success(monkeypatch) -> None:
    async def _fake_ok(self, path):
        return {"ok": True, "path": "/tmp/ok.txt", "backend": "ipc_screenshot", "bytes": 123, "file_exists": True}

    monkeypatch.setattr(controller_module.Controller, "screenshot", _fake_ok)
    client = TestClient(main_module.make_app())
    resp = client.post("/screenshot", json={"path": "/tmp/ok.txt"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["path"] == "/tmp/ok.txt"
    assert body["backend"] == "ipc_screenshot"
