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


# ── AC-1: bridge push_delta sends state_delta to WebSocket ────────────────────

class TestBridgePushDelta:
    def test_push_delta_sends_state_delta_message(self):
        """Bridge sends {type: state_delta, delta: ...} to WS when state changes."""
        bridge = PartyKitBridge("1", "http://localhost:1999", "test-room")
        bridge._ws = AsyncMock()
        bridge._ws.send = AsyncMock()

        delta = {"add": [{"id": "w1", "type": "test_pattern", "x": 0, "y": 0}]}
        asyncio.run(bridge.push_delta(delta))

        bridge._ws.send.assert_called_once()
        sent = json.loads(bridge._ws.send.call_args[0][0])
        assert sent["type"] == "state_delta"
        assert sent["delta"] == delta

    def test_push_delta_noop_when_ws_none(self):
        bridge = PartyKitBridge("1", "http://localhost:1999", "test-room")
        bridge._ws = None
        asyncio.run(bridge.push_delta({"add": []}))
        # No exception raised


# ── AC-4: bridge reconnects on disconnect ────────────────────────────────────

class TestBridgeReconnect:
    def test_reconnect_delay_under_5s(self):
        """RECONNECT_DELAY constant must be <= 5s as specified by AC-4."""
        import partykit_bridge
        assert partykit_bridge.RECONNECT_DELAY <= 5

    def test_run_loop_retries_after_exception(self):
        """run() catches WS connection errors and retries (does not propagate)."""
        bridge = PartyKitBridge("1", "http://localhost:1999", "test-room")
        connect_calls = []

        async def fake_connect(url):
            connect_calls.append(url)
            if len(connect_calls) == 1:
                raise OSError("connection refused")
            # On second call, raise CancelledError to exit the loop
            raise asyncio.CancelledError

        async def run_test():
            try:
                import websockets.asyncio.client as ws_client
            except ImportError:
                pytest.skip("websockets not installed")

            with patch.object(ws_client, "connect", side_effect=fake_connect), \
                 patch("asyncio.sleep", new_callable=AsyncMock):
                try:
                    await bridge.run()
                except asyncio.CancelledError:
                    pass

        asyncio.run(run_test())
        assert len(connect_calls) >= 2, "Expected at least one reconnect attempt"

    def test_clean_disconnect_triggers_reconnect(self):
        """run() must reconnect when receive_loop exits cleanly (no exception).

        Root cause of deadlock: asyncio.gather() waits for ALL tasks. If
        receive_loop ends normally, poll_loop and event_subscribe_loop keep
        running forever — reconnect never triggers.

        Fix: asyncio.wait(FIRST_COMPLETED) + cancel pending tasks + raise
        ConnectionError so the outer except clause handles the reconnect.
        """
        bridge = PartyKitBridge("1", "http://localhost:1999", "test-room")
        connect_calls = []

        class FakeWs:
            async def __aenter__(self):
                return self
            async def __aexit__(self, *_):
                pass
            send = AsyncMock()
            async def __aiter__(self):
                return self
            async def __anext__(self):
                raise StopAsyncIteration  # receive_loop exits cleanly

        async def fake_connect(url):
            connect_calls.append(url)
            if len(connect_calls) == 1:
                return FakeWs()
            raise asyncio.CancelledError

        async def run_test():
            try:
                import websockets.asyncio.client as ws_client
            except ImportError:
                pytest.skip("websockets not installed")

            with patch.object(ws_client, "connect", side_effect=fake_connect), \
                 patch("asyncio.sleep", new_callable=AsyncMock), \
                 patch("partykit_bridge.ipc_get_state", return_value=None):
                try:
                    await bridge.run()
                except (asyncio.CancelledError, Exception):
                    pass

        asyncio.run(run_test())
        assert len(connect_calls) >= 2, "Clean disconnect must trigger reconnect"


# ── Sync loop prevention ──────────────────────────────────────────────────────

class TestReceiveLoopNoEcho:
    def test_receive_delta_adopts_local_state_as_baseline(self):
        """After applying a remote state_delta, last_windows must reflect the
        actual local IPC state, NOT the remote window IDs.

        Root cause of the infinite-window bug: the C++ app assigns its own IDs
        (e.g. 'w2') when create_window is called, but the remote delta carried
        'w1'. If we store 'w1' in last_windows, the next poll sees 'w2' in the
        local state, computes a diff, and re-broadcasts — infinite loop.

        Fix: after apply_delta_to_ipc, read the real local state via ipc_get_state
        and use that as the new baseline.
        """
        bridge = PartyKitBridge("2", "http://localhost:1999", "test-room")
        bridge.last_windows = {}

        remote_delta = {
            "add": [{"id": "w1", "type": "test_pattern", "x": 5, "y": 5, "w": 40, "h": 20}]
        }
        # C++ assigns its own ID "w2" (not "w1") when create_window is called
        local_state_after = {
            "windows": [{"id": "w2", "type": "test_pattern", "x": 5, "y": 5, "w": 40, "h": 20}]
        }

        async def run():
            # _state_lock is normally created in run() — initialise it here for the test.
            bridge._state_lock = asyncio.Lock()
            raw_msg = json.dumps({"type": "state_delta", "delta": remote_delta})

            async def async_messages():
                yield raw_msg

            with patch("partykit_bridge.apply_delta_to_ipc"), \
                 patch("partykit_bridge.ipc_get_state", return_value=local_state_after):
                await bridge.receive_loop(async_messages())

        asyncio.run(run())

        assert "w2" in bridge.last_windows, "Must track local ID w2, not remote w1"
        assert "w1" not in bridge.last_windows, "Remote ID w1 must not persist in baseline"
