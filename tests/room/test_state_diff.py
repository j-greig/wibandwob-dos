"""Tests for F03: State diffing module (E008)."""

import json
import socket
import sys
import threading
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))
from state_diff import (
    windows_from_state,
    state_hash,
    compute_delta,
    apply_delta,
    apply_delta_to_ipc,
    _encode_param,
    ipc_command,
)


def win(wid: str, **kw) -> dict:
    return {"id": wid, "type": "test_pattern", "x": 0, "y": 0, "w": 40, "h": 20, **kw}


# ── windows_from_state ────────────────────────────────────────────────────────

class TestWindowsFromState:
    def test_list_shape(self):
        state = {"windows": [win("w1"), win("w2", x=10)]}
        result = windows_from_state(state)
        assert set(result.keys()) == {"w1", "w2"}

    def test_dict_shape(self):
        # PartyKit canonical shape uses dict
        state = {"windows": {"w1": win("w1"), "w2": win("w2")}}
        result = windows_from_state(state)
        assert set(result.keys()) == {"w1", "w2"}

    def test_empty(self):
        assert windows_from_state({}) == {}

    def test_skips_entries_without_id(self):
        state = {"windows": [{"type": "test_pattern"}, win("w1")]}
        result = windows_from_state(state)
        assert list(result.keys()) == ["w1"]

    def test_normalises_width_height_to_w_h(self):
        """api_get_state emits w/h; older snapshots may have width/height.
        windows_from_state must canonicalise so compute_delta sees stable keys
        and does not produce spurious update deltas every poll cycle."""
        state = {"windows": [{"id": "w1", "type": "gradient",
                               "x": 5, "y": 3, "width": 40, "height": 20}]}
        result = windows_from_state(state)
        assert "w" in result["w1"]
        assert "h" in result["w1"]
        assert result["w1"]["w"] == 40
        assert result["w1"]["h"] == 20

    def test_excludes_internal_types_list(self):
        """wibwob and scramble windows are internal singletons — never sync."""
        state = {"windows": [
            win("w1"),
            {"id": "w2", "type": "wibwob", "x": 0, "y": 0, "w": 80, "h": 24},
            {"id": "w3", "type": "scramble", "x": 0, "y": 0, "w": 28, "h": 14},
        ]}
        result = windows_from_state(state)
        assert "w1" in result
        assert "w2" not in result
        assert "w3" not in result

    def test_excludes_internal_types_dict(self):
        """Internal type exclusion applies to PartyKit dict shape too."""
        state = {"windows": {
            "w1": win("w1"),
            "w2": {"id": "w2", "type": "wibwob", "x": 0, "y": 0, "w": 80, "h": 24},
        }}
        result = windows_from_state(state)
        assert "w1" in result
        assert "w2" not in result
        assert "width" not in result["w1"]
        assert "height" not in result["w1"]

    def test_normalise_does_not_duplicate_w_h(self):
        """If w/h already present, width/height are dropped without overwriting."""
        state = {"windows": [{"id": "w1", "w": 40, "h": 20,
                               "width": 99, "height": 99}]}
        result = windows_from_state(state)
        assert result["w1"]["w"] == 40
        assert result["w1"]["h"] == 20


# ── state_hash ────────────────────────────────────────────────────────────────

class TestStateHash:
    def test_same_state_same_hash(self):
        w = {"w1": win("w1")}
        assert state_hash(w) == state_hash(w)

    def test_different_state_different_hash(self):
        assert state_hash({"w1": win("w1")}) != state_hash({"w1": win("w1", x=5)})

    def test_empty_state_hash(self):
        h = state_hash({})
        assert len(h) == 64  # sha256 hex

    def test_order_independent(self):
        # Dict with same keys in different insertion order
        a = {"w1": win("w1"), "w2": win("w2")}
        b = {"w2": win("w2"), "w1": win("w1")}
        assert state_hash(a) == state_hash(b)


# ── compute_delta ─────────────────────────────────────────────────────────────

class TestComputeDelta:
    def test_no_change(self):
        w = {"w1": win("w1")}
        assert compute_delta(w, w) is None

    def test_empty_to_empty(self):
        assert compute_delta({}, {}) is None

    def test_add(self):
        delta = compute_delta({}, {"w1": win("w1")})
        assert delta is not None
        assert len(delta["add"]) == 1
        assert "remove" not in delta
        assert "update" not in delta

    def test_remove(self):
        delta = compute_delta({"w1": win("w1")}, {})
        assert delta is not None
        assert "w1" in delta["remove"]
        assert "add" not in delta

    def test_update(self):
        old = {"w1": win("w1", x=0)}
        new = {"w1": win("w1", x=10)}
        delta = compute_delta(old, new)
        assert delta is not None
        assert any(w["x"] == 10 for w in delta["update"])

    def test_mixed(self):
        old = {"w1": win("w1"), "w2": win("w2")}
        new = {"w1": win("w1", x=5), "w3": win("w3")}
        delta = compute_delta(old, new)
        assert delta is not None
        assert any(w["id"] == "w3" for w in delta["add"])
        assert "w2" in delta["remove"]
        assert any(w["id"] == "w1" for w in delta["update"])

    def test_add_then_remove_converges(self):
        base = {}
        after_add = {"w1": win("w1")}
        after_remove = {}
        d1 = compute_delta(base, after_add)
        assert d1 is not None
        d2 = compute_delta(after_add, after_remove)
        assert d2 is not None
        assert "w1" in d2["remove"]


# ── apply_delta (pure) ────────────────────────────────────────────────────────

class TestApplyDelta:
    def test_add(self):
        result = apply_delta({}, {"add": [win("w1")]})
        assert "w1" in result

    def test_remove(self):
        result = apply_delta({"w1": win("w1")}, {"remove": ["w1"]})
        assert "w1" not in result

    def test_update(self):
        result = apply_delta({"w1": win("w1", x=0)}, {"update": [win("w1", x=10)]})
        assert result["w1"]["x"] == 10

    def test_does_not_mutate_input(self):
        original = {"w1": win("w1")}
        apply_delta(original, {"add": [win("w2")]})
        assert "w2" not in original

    def test_round_trip(self):
        """apply_delta(old, compute_delta(old, new)) == new."""
        old = {"w1": win("w1"), "w2": win("w2")}
        new = {"w1": win("w1", x=5), "w3": win("w3")}
        delta = compute_delta(old, new)
        assert delta is not None
        result = apply_delta(old, delta)
        assert "w2" not in result
        assert "w3" in result
        assert result["w1"]["x"] == 5

    def test_upsert_on_update(self):
        """update on non-existing id creates it."""
        result = apply_delta({}, {"update": [win("w1", x=5)]})
        assert "w1" in result


# ── apply_delta_to_ipc ────────────────────────────────────────────────────────

class TestApplyDeltaToIpc:
    def _capture(self):
        calls = []
        def fake_cmd(sock_path, cmd, params):
            calls.append((cmd, params))
            return True
        def fake_raw(sock_path, cmd, params):
            calls.append((cmd, params))
            # create_window now returns JSON with a local id
            if cmd == "create_window":
                return "{\"success\":true,\"id\":\"w_local\"}"
            return "{\"success\":true}"
        return calls, fake_cmd, fake_raw

    def test_add_creates_window(self):
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [win("w1", rect={"x": 5, "y": 2, "w": 40, "h": 20})]
            })
        assert any(c == "create_window" for c, _ in calls)

    def test_remove_closes_window(self):
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {"remove": ["w1", "w2"]})
        close = [p for c, p in calls if c == "close_window"]
        assert len(close) == 2

    def test_update_moves_window(self):
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "update": [{"id": "w1", "rect": {"x": 10, "y": 5}}]
            })
        move = [p for c, p in calls if c == "move_window"]
        assert len(move) == 1
        assert move[0]["x"] == 10

    def test_returns_applied_commands(self):
        with patch("state_diff.ipc_command", return_value=True), \
             patch("state_diff.ipc_command_raw", return_value='{"success":true,"id":"w_local"}'):
            applied = apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [win("w1")],
                "remove": ["w2"],
            })
        assert len(applied) == 2
        assert any("create_window" in a for a in applied)
        assert any("close_window" in a for a in applied)

    def test_failed_commands_logged_with_fail_prefix(self):
        """IPC failures are logged as 'FAIL <cmd>' so the bridge can surface them.

        When ipc_command returns False (e.g. close_window on unknown ID),
        apply_delta_to_ipc must still record the attempt with a FAIL prefix
        rather than silently dropping it. This makes ID-mismatch bugs visible.
        """
        with patch("state_diff.ipc_command", return_value=False), \
             patch("state_diff.ipc_command_raw", return_value='{"error":"nope"}'):
            applied = apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [win("w1")],
                "remove": ["w99"],
                "update": [{"id": "w99", "x": 5, "y": 5}],
            })
        assert all(a.startswith("FAIL ") for a in applied), \
            f"All commands should fail: {applied}"
        assert any("create_window" in a for a in applied)
        assert any("close_window" in a for a in applied)

    def test_empty_delta_no_calls(self):
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            applied = apply_delta_to_ipc("/tmp/fake.sock", {})
        assert calls == []
        assert applied == []

    def test_add_uses_toplevel_coords_flat_format(self):
        """apply_delta_to_ipc reads x/y/w/h from top level (flat IPC delta format).

        PartyKit deltas carry x/y/w/h at the top level of each window entry,
        not nested under a 'rect' sub-dict. _rect() must fall back to the win
        dict itself so windows are created at the correct position, not 0,0.
        """
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [{"id": "w1", "type": "test_pattern", "x": 5, "y": 3, "w": 40, "h": 20}]
            })
        create = [p for c, p in calls if c == "create_window"]
        assert len(create) == 1
        assert create[0]["x"] == 5
        assert create[0]["y"] == 3

    def test_update_resize_uses_width_height(self):
        """resize_window IPC command must use 'width'/'height', not 'w'/'h'.

        C++ api_ipc.cpp reads kv["width"] and kv["height"] for resize_window.
        Sending 'w'/'h' causes the resize to silently fail (key not found → 0).
        """
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "update": [{"id": "w1", "x": 0, "y": 0, "w": 80, "h": 40}]
            })
        resize = [p for c, p in calls if c == "resize_window"]
        assert len(resize) == 1
        assert "width" in resize[0], "resize_window must send 'width', not 'w'"
        assert "height" in resize[0], "resize_window must send 'height', not 'h'"
        assert resize[0]["width"] == 80
        assert resize[0]["height"] == 40
        assert "w" not in resize[0]
        assert "h" not in resize[0]

    def test_size_only_update_no_spurious_move(self):
        """Size-only update delta must NOT send move_window x=0 y=0.

        Root cause: .get('x', 0) default would force a spurious move-to-origin
        for deltas that only carry w/h changes.
        """
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "update": [{"id": "w1", "w": 80, "h": 40}]
            })
        move_calls = [p for c, p in calls if c == "move_window"]
        assert len(move_calls) == 0, "No move_window for size-only delta"
        resize_calls = [p for c, p in calls if c == "resize_window"]
        assert len(resize_calls) == 1

    def test_position_only_update_no_spurious_resize(self):
        """Position-only update delta must NOT send resize_window."""
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "update": [{"id": "w1", "x": 5, "y": 3}]
            })
        resize_calls = [p for c, p in calls if c == "resize_window"]
        assert len(resize_calls) == 0, "No resize_window for position-only delta"
        move_calls = [p for c, p in calls if c == "move_window"]
        assert len(move_calls) == 1
        assert move_calls[0]["x"] == 5

    def test_add_file_backed_window_forwards_path(self):
        """create_window for text_view/frame_player must include the path param.

        Without path, the C++ IPC handler returns 'err missing path' and the
        window is not created on the remote instance.
        """
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [{"id": "w1", "type": "text_view", "x": 0, "y": 0,
                          "w": 80, "h": 24, "path": "/home/user/notes.txt"}]
            })
        create = [p for c, p in calls if c == "create_window"]
        assert len(create) == 1
        assert create[0]["path"] == "/home/user/notes.txt"

    def test_add_no_path_key_when_missing(self):
        """create_window for non-file-backed windows must NOT send path param."""
        calls, fake_cmd, fake_raw = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [{"id": "w1", "type": "test_pattern", "x": 0, "y": 0,
                          "w": 40, "h": 20}]
            })
        create = [p for c, p in calls if c == "create_window"]
        assert len(create) == 1
        assert "path" not in create[0]

    def test_add_updates_id_map_from_create_window_response(self):
        calls, fake_cmd, fake_raw = self._capture()
        id_map = {}
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw",
                   side_effect=lambda p, c, params: calls.append((c, params)) or '{"success":true,"id":"w_local"}'):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [{"id": "w_remote", "type": "test_pattern", "x": 0, "y": 0, "w": 40, "h": 20}]
            }, id_map=id_map)
        assert id_map.get("w_remote") == "w_local"
        assert any(c == "create_window" for c, _ in calls)

    def test_update_translates_remote_id_via_id_map(self):
        calls, fake_cmd, fake_raw = self._capture()
        id_map = {"w_remote": "w_local"}
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "update": [{"id": "w_remote", "rect": {"x": 10, "y": 5}}]
            }, id_map=id_map)
        move = [p for c, p in calls if c == "move_window"]
        assert len(move) == 1
        assert move[0]["id"] == "w_local"

    def test_remove_translates_remote_id_via_id_map(self):
        calls, fake_cmd, fake_raw = self._capture()
        id_map = {"w_remote": "w_local"}
        with patch("state_diff.ipc_command", side_effect=fake_cmd), \
             patch("state_diff.ipc_command_raw", side_effect=fake_raw):
            apply_delta_to_ipc("/tmp/fake.sock", {"remove": ["w_remote"]}, id_map=id_map)
        close = [p for c, p in calls if c == "close_window"]
        assert len(close) == 1
        assert close[0]["id"] == "w_local"
        assert "w_remote" not in id_map


# ── _encode_param (percent-encoding) ──────────────────────────────────────────

class TestEncodeParam:
    def test_plain_value_unchanged(self):
        assert _encode_param("hello") == "hello"

    def test_spaces_encoded(self):
        encoded = _encode_param("hello world")
        assert " " not in encoded
        assert "hello" in encoded

    def test_slash_encoded(self):
        encoded = _encode_param("/tmp/my path/file.txt")
        assert " " not in encoded

    def test_number_converts_to_string(self):
        assert _encode_param(42) == "42"

    def test_ipc_command_accepts_ok_response(self):
        """ipc_command returns True for legacy 'ok...' responses."""
        with patch("state_diff.ipc_send", return_value="ok"):
            assert ipc_command("/tmp/fake.sock", "move_window", {"id": "w1", "x": 5, "y": 5})

    def test_ipc_command_accepts_success_json_response(self):
        """ipc_command returns True for {'success':true} JSON (used by move/resize/close handlers)."""
        with patch("state_diff.ipc_send", return_value='{"success":true}'):
            assert ipc_command("/tmp/fake.sock", "move_window", {"id": "w1", "x": 5, "y": 5})

    def test_ipc_command_rejects_error_json(self):
        """ipc_command returns False for error responses."""
        with patch("state_diff.ipc_send", return_value='{"error":"Window not found"}'):
            assert not ipc_command("/tmp/fake.sock", "move_window", {"id": "w99", "x": 0, "y": 0})

    def test_ipc_command_rejects_none(self):
        """ipc_command returns False when ipc_send returns None (timeout/disconnect)."""
        with patch("state_diff.ipc_send", return_value=None):
            assert not ipc_command("/tmp/fake.sock", "move_window", {"id": "w1", "x": 5, "y": 5})

    def test_ipc_command_encodes_all_values(self):
        """ipc_command must percent-encode values so spaces don't break IPC tokenisation.

        The IPC server tokenises on spaces; a path like '/tmp/my dir/x' would be
        truncated after 'dir/' if not encoded. All param values must be encoded.
        """
        captured = []
        def fake_send(sock_path, command, timeout=2.0):
            captured.append(command)
            return "ok"
        with patch("state_diff.ipc_send", side_effect=fake_send):
            ipc_command("/tmp/fake.sock", "open_text", {"path": "/tmp/my folder/notes.txt"})
        assert captured, "ipc_send should have been called"
        cmd = captured[0]
        # The space in the path must be percent-encoded in the IPC command string
        assert " " not in cmd.split("path=", 1)[-1], \
            f"Space leaked into IPC param: {cmd!r}"


# ── _ipc_auth_handshake ────────────────────────────────────────────────────────

class TestIpcAuthHandshake:
    """Tests for the HMAC challenge-response auth handshake in ipc_send."""

    def test_handshake_skipped_when_no_secret(self):
        """With no AUTH_SECRET set, ipc_send should connect and send command directly."""
        import state_diff as sd
        original_secret = sd._AUTH_SECRET
        try:
            sd._AUTH_SECRET = ""
            mock_sock = MagicMock()
            mock_sock.recv.return_value = b"ok\n"
            with patch("socket.socket") as MockSocket:
                MockSocket.return_value.__enter__ = MagicMock(return_value=mock_sock)
                MockSocket.return_value = mock_sock
                # _ipc_auth_handshake returns True immediately when no secret
                from state_diff import _ipc_auth_handshake
                result = _ipc_auth_handshake(mock_sock)
                assert result is True
                mock_sock.recv.assert_not_called()
        finally:
            sd._AUTH_SECRET = original_secret

    def _make_auth_server(self, secret: str) -> tuple:
        """Create a real Unix socket pair that performs the HMAC handshake server-side."""
        import hmac, hashlib, tempfile, os
        sock_path = tempfile.mktemp(suffix=".sock")
        server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        server.bind(sock_path)
        server.listen(1)

        nonce = "deadbeef0123456789abcdef"

        def server_thread():
            conn, _ = server.accept()
            conn.sendall((json.dumps({"type": "challenge", "nonce": nonce}) + "\n").encode())
            data = conn.recv(512).decode().strip()
            msg = json.loads(data)
            mac = hmac.new(secret.encode(), nonce.encode(), "sha256").hexdigest()
            if msg.get("type") == "auth" and msg.get("hmac") == mac:
                conn.sendall(b'{"type":"auth_ok"}\n')
            else:
                conn.sendall(b'{"type":"auth_fail"}\n')
            conn.close()
            server.close()
            os.unlink(sock_path)

        t = threading.Thread(target=server_thread, daemon=True)
        t.start()
        return sock_path, t

    def test_handshake_succeeds_with_correct_secret(self):
        import state_diff as sd
        secret = "test-secret-xyz"
        original = sd._AUTH_SECRET
        try:
            sd._AUTH_SECRET = secret
            sock_path, t = self._make_auth_server(secret)
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            client.settimeout(3.0)
            client.connect(sock_path)
            from state_diff import _ipc_auth_handshake
            result = _ipc_auth_handshake(client)
            client.close()
            t.join(timeout=2)
            assert result is True
        finally:
            sd._AUTH_SECRET = original

    def test_handshake_fails_with_wrong_secret(self):
        import state_diff as sd
        correct_secret = "correct-secret"
        wrong_secret = "wrong-secret"
        original = sd._AUTH_SECRET
        try:
            sd._AUTH_SECRET = wrong_secret
            sock_path, t = self._make_auth_server(correct_secret)
            client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            client.settimeout(3.0)
            client.connect(sock_path)
            from state_diff import _ipc_auth_handshake
            result = _ipc_auth_handshake(client)
            client.close()
            t.join(timeout=2)
            assert result is False
        finally:
            sd._AUTH_SECRET = original
