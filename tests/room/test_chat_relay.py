"""Tests for F04: Chat relay — bridge forwards local chat to PartyKit, applies remote chat via IPC."""

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))
from partykit_bridge import PartyKitBridge


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_bridge() -> PartyKitBridge:
    b = PartyKitBridge("1", "http://localhost:1999", "test-room")
    b._ws = AsyncMock()
    b._ws.send = AsyncMock()
    return b


def state_with_chat(entries: list) -> dict:
    return {"windows": [], "chat_log": entries}


async def _receive_message(bridge: PartyKitBridge, raw_msg: str) -> None:
    """Simulate receiving one WebSocket message through receive_loop."""
    async def fake_ws_iter():
        yield raw_msg
    await bridge.receive_loop(fake_ws_iter())


# ── push_chat: outgoing message format ───────────────────────────────────────

class TestPushChat:
    def test_sends_correct_fields(self):
        bridge = make_bridge()
        asyncio.run(bridge.push_chat("you", "hello world"))
        bridge._ws.send.assert_called_once()
        sent = json.loads(bridge._ws.send.call_args[0][0])
        assert sent["type"] == "chat_msg"
        assert sent["sender"] == "you"
        assert sent["text"] == "hello world"
        assert sent["instance"] == "1"

    def test_no_send_when_ws_none(self):
        bridge = make_bridge()
        bridge._ws = None
        asyncio.run(bridge.push_chat("you", "hello"))
        # Should not raise, just return silently


# ── poll_loop: detect and forward new chat entries ────────────────────────────

class TestPollLoopChatForwarding:
    def _run_poll_once(self, bridge: PartyKitBridge, state: dict) -> None:
        """Run one iteration of poll_loop by making asyncio.sleep raise StopAsyncIteration."""
        call_count = 0

        async def fake_sleep(_):
            nonlocal call_count
            call_count += 1
            raise asyncio.CancelledError

        with patch("partykit_bridge.ipc_get_state", return_value=state), \
             patch("partykit_bridge.compute_delta", return_value=None), \
             patch("partykit_bridge.windows_from_state", return_value={}), \
             patch("asyncio.sleep", side_effect=fake_sleep):
            try:
                asyncio.run(bridge.poll_loop())
            except asyncio.CancelledError:
                pass

    def test_new_chat_entry_forwarded(self):
        bridge = make_bridge()
        state = state_with_chat([{"seq": 1, "sender": "you", "text": "hello"}])
        self._run_poll_once(bridge, state)

        bridge._ws.send.assert_called_once()
        sent = json.loads(bridge._ws.send.call_args[0][0])
        assert sent["type"] == "chat_msg"
        assert sent["text"] == "hello"
        assert sent["sender"] == "you"

    def test_already_seen_not_forwarded(self):
        bridge = make_bridge()
        bridge.last_chat_seq = 3
        state = state_with_chat([
            {"seq": 1, "sender": "you", "text": "old1"},
            {"seq": 2, "sender": "you", "text": "old2"},
            {"seq": 3, "sender": "you", "text": "old3"},
        ])
        self._run_poll_once(bridge, state)
        bridge._ws.send.assert_not_called()

    def test_only_new_entries_forwarded(self):
        bridge = make_bridge()
        bridge.last_chat_seq = 1
        state = state_with_chat([
            {"seq": 1, "sender": "you", "text": "old"},
            {"seq": 2, "sender": "you", "text": "new1"},
            {"seq": 3, "sender": "you", "text": "new2"},
        ])
        self._run_poll_once(bridge, state)
        assert bridge._ws.send.call_count == 2
        texts = [json.loads(c[0][0])["text"] for c in bridge._ws.send.call_args_list]
        assert texts == ["new1", "new2"]
        assert bridge.last_chat_seq == 3

    def test_empty_chat_log_no_send(self):
        bridge = make_bridge()
        state = state_with_chat([])
        self._run_poll_once(bridge, state)
        bridge._ws.send.assert_not_called()

    def test_missing_chat_log_no_error(self):
        bridge = make_bridge()
        state = {"windows": []}  # no chat_log key
        self._run_poll_once(bridge, state)
        bridge._ws.send.assert_not_called()


# ── receive_loop: apply incoming chat_msg via IPC ─────────────────────────────

class TestIncomingChatRelay:
    def test_remote_chat_calls_ipc(self):
        bridge = make_bridge()
        raw_msg = json.dumps({
            "type": "chat_msg",
            "sender": "james",
            "text": "check out this window",
            "instance": "2",
        })

        with patch("partykit_bridge.ipc_command", return_value=True) as mock_ipc:
            asyncio.run(_receive_message(bridge, raw_msg))

        mock_ipc.assert_called_once_with(
            bridge.sock_path,
            "exec_command",
            {"name": "chat_receive", "sender": "james", "text": "check out this window"},
        )

    def test_own_echo_ignored(self):
        bridge = make_bridge()
        raw_msg = json.dumps({
            "type": "chat_msg",
            "sender": "you",
            "text": "hello",
            "instance": "1",  # same instance
        })

        with patch("partykit_bridge.ipc_command", return_value=True) as mock_ipc:
            asyncio.run(_receive_message(bridge, raw_msg))

        mock_ipc.assert_not_called()

    def test_empty_text_not_forwarded(self):
        bridge = make_bridge()
        raw_msg = json.dumps({
            "type": "chat_msg",
            "sender": "james",
            "text": "",
            "instance": "2",
        })

        with patch("partykit_bridge.ipc_command", return_value=True) as mock_ipc:
            asyncio.run(_receive_message(bridge, raw_msg))

        mock_ipc.assert_not_called()

    def test_missing_instance_treated_as_remote(self):
        bridge = make_bridge()
        raw_msg = json.dumps({
            "type": "chat_msg",
            "sender": "friend",
            "text": "hi there",
        })

        with patch("partykit_bridge.ipc_command", return_value=True) as mock_ipc:
            asyncio.run(_receive_message(bridge, raw_msg))

        mock_ipc.assert_called_once()
        _, cmd, params = mock_ipc.call_args[0]
        assert cmd == "exec_command"
        assert params["name"] == "chat_receive"
        assert params["text"] == "hi there"
