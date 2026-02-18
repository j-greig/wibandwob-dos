"""Tests for F03: State diffing module (E008)."""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))
from state_diff import (
    windows_from_state,
    state_hash,
    compute_delta,
    apply_delta,
    apply_delta_to_ipc,
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
        return calls, fake_cmd

    def test_add_creates_window(self):
        calls, fake = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [win("w1", rect={"x": 5, "y": 2, "w": 40, "h": 20})]
            })
        assert any(c == "create_window" for c, _ in calls)

    def test_remove_closes_window(self):
        calls, fake = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake):
            apply_delta_to_ipc("/tmp/fake.sock", {"remove": ["w1", "w2"]})
        close = [p for c, p in calls if c == "close_window"]
        assert len(close) == 2

    def test_update_moves_window(self):
        calls, fake = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "update": [{"id": "w1", "rect": {"x": 10, "y": 5}}]
            })
        move = [p for c, p in calls if c == "move_window"]
        assert len(move) == 1
        assert move[0]["x"] == 10

    def test_returns_applied_commands(self):
        with patch("state_diff.ipc_command", return_value=True):
            applied = apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [win("w1")],
                "remove": ["w2"],
            })
        assert len(applied) == 2
        assert any("create_window" in a for a in applied)
        assert any("close_window" in a for a in applied)

    def test_empty_delta_no_calls(self):
        calls, fake = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake):
            applied = apply_delta_to_ipc("/tmp/fake.sock", {})
        assert calls == []
        assert applied == []

    def test_add_uses_toplevel_coords_flat_format(self):
        """apply_delta_to_ipc reads x/y/w/h from top level (flat IPC delta format).

        PartyKit deltas carry x/y/w/h at the top level of each window entry,
        not nested under a 'rect' sub-dict. _rect() must fall back to the win
        dict itself so windows are created at the correct position, not 0,0.
        """
        calls, fake = self._capture()
        with patch("state_diff.ipc_command", side_effect=fake):
            apply_delta_to_ipc("/tmp/fake.sock", {
                "add": [{"id": "w1", "type": "test_pattern", "x": 5, "y": 3, "w": 40, "h": 20}]
            })
        create = [p for c, p in calls if c == "create_window"]
        assert len(create) == 1
        assert create[0]["x"] == 5
        assert create[0]["y"] == 3
