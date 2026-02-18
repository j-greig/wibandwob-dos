"""Tests for F02: PartyKit bridge — state diffing, delta application, WS URL building (E008)."""

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))
from partykit_bridge import (
    build_ws_url,
    compute_delta,
    windows_from_state,
    apply_delta_to_ipc,
    PartyKitBridge,
)

# ── URL building ──────────────────────────────────────────────────────────────

class TestBuildWsUrl:
    def test_https_to_wss(self):
        url = build_ws_url("https://wibwob.user.partykit.dev", "my-room")
        assert url == "wss://wibwob.user.partykit.dev/party/my-room"

    def test_http_to_ws(self):
        url = build_ws_url("http://localhost:1999", "test")
        assert url == "ws://localhost:1999/party/test"

    def test_trailing_slash_stripped(self):
        url = build_ws_url("http://localhost:1999/", "test")
        assert url == "ws://localhost:1999/party/test"


# ── windows_from_state ────────────────────────────────────────────────────────

class TestWindowsFromState:
    def test_extracts_windows_by_id(self):
        state = {
            "windows": [
                {"id": "w1", "type": "test_pattern", "x": 0, "y": 0},
                {"id": "w2", "type": "gradient", "x": 10, "y": 5},
            ]
        }
        windows = windows_from_state(state)
        assert "w1" in windows
        assert "w2" in windows
        assert windows["w1"]["type"] == "test_pattern"

    def test_empty_state(self):
        assert windows_from_state({}) == {}

    def test_windows_missing_id_skipped(self):
        state = {"windows": [{"type": "test_pattern"}]}
        assert windows_from_state(state) == {}


# ── compute_delta ─────────────────────────────────────────────────────────────

def win(wid, **kw):
    return {"id": wid, "type": "test_pattern", "x": 0, "y": 0, **kw}


class TestComputeDelta:
    def test_no_change_returns_none(self):
        w = {"w1": win("w1")}
        assert compute_delta(w, w) is None

    def test_add_window(self):
        old = {}
        new = {"w1": win("w1")}
        delta = compute_delta(old, new)
        assert delta is not None
        assert len(delta["add"]) == 1
        assert delta["add"][0]["id"] == "w1"
        assert "remove" not in delta
        assert "update" not in delta

    def test_remove_window(self):
        old = {"w1": win("w1")}
        new = {}
        delta = compute_delta(old, new)
        assert delta is not None
        assert "w1" in delta["remove"]
        assert "add" not in delta

    def test_update_window(self):
        old = {"w1": win("w1", x=0)}
        new = {"w1": win("w1", x=10)}
        delta = compute_delta(old, new)
        assert delta is not None
        assert len(delta["update"]) == 1
        assert delta["update"][0]["x"] == 10

    def test_mixed_delta(self):
        old = {"w1": win("w1"), "w2": win("w2")}
        new = {"w1": win("w1", x=5), "w3": win("w3")}
        delta = compute_delta(old, new)
        assert delta is not None
        assert "w3" in [w["id"] for w in delta["add"]]
        assert "w2" in delta["remove"]
        assert any(w["id"] == "w1" for w in delta["update"])

    def test_empty_to_empty_returns_none(self):
        assert compute_delta({}, {}) is None


# ── apply_delta_to_ipc ────────────────────────────────────────────────────────

class TestApplyDeltaToIpc:
    def test_add_calls_create_window(self):
        calls = []
        with patch("state_diff.ipc_command", side_effect=lambda p, c, params: calls.append((c, params)) or True):
            delta = {"add": [{"id": "w1", "type": "gradient", "rect": {"x": 5, "y": 2, "w": 40, "h": 20}}]}
            apply_delta_to_ipc("/tmp/fake.sock", delta)
        assert any(c == "create_window" for c, _ in calls)

    def test_remove_calls_close_window(self):
        calls = []
        with patch("state_diff.ipc_command", side_effect=lambda p, c, params: calls.append((c, params)) or True):
            apply_delta_to_ipc("/tmp/fake.sock", {"remove": ["w1", "w2"]})
        close_calls = [p for c, p in calls if c == "close_window"]
        assert len(close_calls) == 2

    def test_update_calls_move_window(self):
        calls = []
        with patch("state_diff.ipc_command", side_effect=lambda p, c, params: calls.append((c, params)) or True):
            delta = {"update": [{"id": "w1", "rect": {"x": 10, "y": 5}}]}
            apply_delta_to_ipc("/tmp/fake.sock", delta)
        move_calls = [p for c, p in calls if c == "move_window"]
        assert len(move_calls) == 1
        assert move_calls[0]["x"] == 10


# ── AC-3: orchestrator spawns bridge for multiplayer ─────────────────────────

class TestOrchestratorSpawnsBridge:
    def test_bridge_spawned_for_multiplayer(self, tmp_path):
        sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))
        from orchestrator import Orchestrator
        from room_config import RoomConfig

        orch = Orchestrator(project_root=tmp_path)
        cfg = RoomConfig(
            room_id="mp-room",
            instance_id=2,
            ttyd_port=7682,
            multiplayer=True,
            partykit_room="mp-room",
            partykit_server="http://localhost:1999",
        )

        popen_calls = []

        def fake_popen(cmd, env=None, **kwargs):
            popen_calls.append(cmd)
            m = MagicMock()
            m.poll.return_value = None
            return m

        with patch("orchestrator.subprocess.Popen", side_effect=fake_popen):
            orch.spawn_room(cfg)

        cmds_flat = [" ".join(c) for c in popen_calls]
        assert any("partykit_bridge" in c for c in cmds_flat), \
            f"Expected partykit_bridge in spawn calls, got: {cmds_flat}"

    def test_bridge_not_spawned_for_single_player(self, tmp_path):
        sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))
        from orchestrator import Orchestrator
        from room_config import RoomConfig

        orch = Orchestrator(project_root=tmp_path)
        cfg = RoomConfig(room_id="sp-room", instance_id=1, ttyd_port=7681)

        popen_calls = []

        def fake_popen(cmd, env=None, **kwargs):
            popen_calls.append(cmd)
            m = MagicMock()
            m.poll.return_value = None
            return m

        with patch("orchestrator.subprocess.Popen", side_effect=fake_popen):
            orch.spawn_room(cfg)

        cmds_flat = [" ".join(c) for c in popen_calls]
        assert not any("partykit_bridge" in c for c in cmds_flat), \
            "Bridge must NOT be spawned for single-player rooms"
