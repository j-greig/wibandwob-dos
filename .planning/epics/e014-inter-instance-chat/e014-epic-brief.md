---
id: E014
title: Inter-Instance Group Chat — get_chat_history + Broker
status: done
issue: 91
pr: ~
depends_on: []
branch: epic/e014-inter-instance-chat
---

# E014 — Inter-Instance Group Chat

## TL;DR

AC-1/AC-2 already shipped. Land `get_chat_history` (C++, ~50 lines) then wire inter-instance fanout through the existing PartyKit bridge (E008) — one `--ai-relay` flag swaps `chat_receive` for `wibwob_ask` so receiving instances actually respond. `chat_coordinator.py` (Unix socket broker) ships as local/offline fallback.

## Source Spike

`.planning/spikes/.trash/spk-inter-instance-chat/spike-brief.md` — contains exact insertion points, full broker script, and verification commands. Read it before touching any code.

## What's Already Done (do not re-implement)

- `wibwob_ask` — injects user message, triggers LLM response (`command_registry.cpp:96`)
- `chat_receive` — display-only remote message receipt (`command_registry.cpp:95`)
- `TWibWobWindow::injectUserMessage()` — public async injection method (`wibwob_view.h:153`)
- Async drain loop via `pendingAsk_` in idle (`wibwob_view.cpp:516`)

## Features / Stories

### F01 — get_chat_history C++

- [x] S01: Add `HistoryEntry` struct + `chatHistory_` buffer + `getHistoryJson()` to `TWibWobMessageView` (`wibwob_view.h`)
  Test: method compiles, returns `[]` on empty history
- [x] S02: Hook history recording into `addMessage()` and `clear()` (`wibwob_view.cpp`)
  Test: user messages appear in `get_chat_history` output
- [x] S03: Mirror streaming lifecycle into `chatHistory_` — `startStreamingMessage`, `appendToStreamingMessage`, `finishStreamingMessage`, `cancelStreamingMessage`
  Test: streamed assistant replies appear in history after completion; cancelled streams are removed
- [x] S04: Add `api_get_chat_history()` IPC bridge near `api_wibwob_ask` (`test_pattern_app.cpp`)
  Test: returns `{"messages":[...]}` JSON; returns `err no wibwob chat window open` when none open
- [x] S05: Register `get_chat_history` in capabilities + dispatch (`command_registry.cpp`)
  Test: appears in `GET /api/capabilities`; `cmd:exec_command name=get_chat_history` dispatches correctly

### F02 — Broker

- [x] S06: Create `tools/monitor/chat_coordinator.py` — local Unix socket broker, offline fallback
  Test: runs with no third-party deps; `--max-turns`, `--cooldown`, `--token-budget` all work
- [x] S07: Add `WIBWOB_AI_RELAY=1` env flag to `tools/room/partykit_bridge.py` — swap `chat_receive` for `wibwob_ask` on incoming remote `chat_msg` events so the receiving W&W AI actually responds (not just displays)
  Test: two instances connected to same PartyKit room; inject message in A; B's W&W responds; broker log shows `wibwob_ask` calls not `chat_receive`

## Acceptance Criteria

| AC | Criterion | Test |
|----|-----------|------|
| AC-3 | `get_chat_history` returns valid JSON | `cmd:exec_command name=get_chat_history` → parseable `{"messages":[...]}` |
| AC-4 | Streaming replies in history | Ask prompt that streams; `"assistant"` entry present after completion |
| AC-5 | Broker broadcasts with attribution | 2 instances + broker; inject prompt; broker logs relays for both roles |
| AC-6 | Broker dedup works | Broker-injected copies not rebroadcast; genuine AI replies continue |
| AC-7 | Human can inject mid-conversation | Type in instance 2 while broker runs; instance 1 receives relayed message |
| AC-8 | Safety controls work | `--max-turns 3` exits after 3 broadcasts; cooldown + token-budget behave as documented |

## Critical Gotchas (from spike)

1. **Streaming replies bypass `addMessage()`** — must hook all 4 streaming lifecycle methods or assistant output is missing from history
2. **Async injection** — `wibwob_ask` posts event `0xF0F0`, not immediate; broker may poll before reply arrives
3. **Percent-encode `text=`** in broker — NOT base64 (base64 only applies to `send_text content=`)
4. **`wibwob_ask` requires chat window open** — broker logs rejects if target has no open chat window
5. **History reset detection** — broker handles `len(history) < last_seen` by resetting that socket cursor

## Running Notes

- [S01-S05] `get_chat_history` C++ landed clean, build passed first time — `HistoryEntry` + streaming lifecycle hooks all in `wibwob_view.cpp/h`, IPC bridge in `test_pattern_app.cpp`, registered in `command_registry.cpp`
- [S06] `chat_coordinator.py` Unix socket broker built as local/offline fallback — useful for dev without PartyKit running
- [S07] Discovered E008 PartyKit bridge already does 90% of this — only gap was `chat_receive` vs `wibwob_ask`; added `WIBWOB_AI_RELAY=1` env flag to `tools/room/partykit_bridge.py` to switch modes; PartyKit is the right production broker (cloud, push-based, presence, persistent history); local broker stays as fallback

## Rollback

All C++ changes are additive (new struct fields + new methods). Removing `get_chat_history` dispatch branch restores prior state. Python broker is standalone with no app coupling.
