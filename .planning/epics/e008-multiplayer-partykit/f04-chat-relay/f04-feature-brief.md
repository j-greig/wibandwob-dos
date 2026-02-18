# F04: Chat Relay

## Parent

- Epic: `e008-multiplayer-partykit`
- Epic brief: `.planning/epics/e008-multiplayer-partykit/e008-epic-brief.md`

## Objective

Scramble chat messages from one WibWob instance appear in the Scramble window of all other instances in the same PartyKit room. Relay is bidirectional: local → PartyKit → remote instances.

## Architecture

**Outgoing (local → PartyKit):**
- C++ app tracks non-slash Scramble messages in a `chatLog_` circular buffer (max 50 entries, each with seq number)
- `api_get_state` includes `chat_log` array in response
- Bridge poll loop detects new entries (seq > `last_chat_seq`) and pushes `chat_msg` to PartyKit WebSocket

**Incoming (PartyKit → local):**
- Bridge `receive_loop` receives `chat_msg` from WebSocket
- Skips echo (messages with own `instance` ID)
- Calls IPC command `chat_receive sender=X text=Y` on local WibWob instance
- C++ `api_chat_receive` adds message to Scramble message view without AI processing

## New C++ IPC Command

`chat_receive sender=<name> text=<message>` — displays a remote chat message in Scramble's message history. Does NOT invoke the AI engine. Returns `ok` or `err`.

## get_state Extension

`api_get_state` now returns:
```json
{
  "windows": [...],
  "chat_log": [
    {"seq": 1, "sender": "you", "text": "hello world"},
    ...
  ]
}
```

## Acceptance Criteria

- [x] **AC-1:** Local Scramble chat messages are forwarded to PartyKit as `chat_msg`
  - Test: `TestPollLoopChatForwarding::test_new_chat_entry_forwarded`
- [x] **AC-2:** Already-forwarded messages are not re-sent (seq tracking)
  - Test: `TestPollLoopChatForwarding::test_already_seen_not_forwarded`
- [x] **AC-3:** Incoming `chat_msg` from remote instances is injected into local Scramble
  - Test: `TestIncomingChatRelay::test_remote_chat_calls_ipc`
- [x] **AC-4:** Echo (own instance messages) is suppressed on receive
  - Test: `TestIncomingChatRelay::test_own_echo_ignored`
- [x] **AC-5:** `chat_receive` IPC command displays message in Scramble without AI
  - Test: `TestIncomingChatRelay::test_remote_chat_calls_ipc` (IPC mock)

## Tests

- `tests/room/test_chat_relay.py` — 11 tests, all passing
- C++ builds clean: `cmake --build ./build --target test_pattern`

## Status

Status: done
GitHub issue: #65
PR: —
