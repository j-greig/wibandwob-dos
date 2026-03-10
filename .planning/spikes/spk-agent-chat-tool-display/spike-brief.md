---
id: SPK-agent-chat-tool-display
title: Agent Chat Tool Display — Collapse Stacking Tool Results
status: done
type: spike
tags: [agent-ux, chat-window, tool-display, blessed]
issue: ~
---

# SPK — Agent Chat Tool Display

## Problem

When the Wib&Wob agent makes many sequential tool calls (e.g. choreographing
GlitchBox: pose, move, state, field × 10+), the tool result lines stack up
and fill the entire chat window. The human can no longer see the agent's
actual conversational text — Wib/Wob personality, decisions, commentary — 
because it's buried above a wall of `✓ run_command ...` lines.

The chat window becomes a log viewer instead of a conversation.

## Current behaviour

Each tool call produces a `[tool]` status message and a `[done]`/`[fail]`
result. `renderTranscript()` in `wibwob-agent-render.ts` collapses these
into one line per call:

```
  ✓ glitchbox.pose → {"ok":true,"preset":"wave"}
  ✓ glitchbox.state → {"ok":true,"energy":10,"mood":"feral"}
  ✓ glitchbox.field → {"ok":true,"mood":"chaos"}
  ✓ glitchbox.move → {"ok":true,"from":{"x":50,"y":9},"to"...
  ✓ glitchbox.pose → {"ok":true,"preset":"arms-raised"}
  ... (20 more lines)
```

Partial fix already in: tool results truncated to 60 chars, microapp prefix
stripped. But the line COUNT is still the problem — 20 tool calls = 20 lines
eating the viewport.

## Desired behaviour

Tool call blocks should collapse when there are many consecutive calls.
The conversation — human prompts and Wib/Wob replies — should always be
the dominant visual element.

### Option A: Fold consecutive tool calls

When N consecutive tool lines appear between text messages, show:
```
  ✓ 12 commands run (glitchbox.pose, .state, .field, .move ...)
```
Expand on click or key? Or just always collapsed.

### Option B: Cap visible tool lines

Show first 2 and last 1 of a consecutive tool block:
```
  ✓ glitchbox.open → ok
  ✓ glitchbox.gen → ok
  ... 8 more
  ✓ glitchbox.pose → arms-raised
```

### Option C: Separate tool panel

Tool calls render in a slim sidebar or footer strip, not in the main
transcript. Conversation stays clean. Tool activity visible but not
dominant.

### Option D: Streaming-aware collapse

During streaming, show the CURRENT tool call inline (as now). Once the
assistant text block arrives, retroactively collapse all tool calls from
that turn into a summary line.

## Key files

| File | Role |
|------|------|
| `src/windows/wibwob-agent-render.ts` | `renderTranscript()`, `renderMessage()` — where tool lines are formatted |
| `src/windows/wibwob-agent-window.ts` | Chat window, subscribes to agent snapshot, calls `renderTranscript()` |
| `src/services/wibwob-agent-session.ts` | Agent session — emits `[tool]`/`[done]`/`[fail]` status messages |
| `src/core/types.ts` | `ChatMessageEntry` type |

## Acceptance criteria

- [ ] AC-1: 10+ consecutive tool calls between text messages collapse to ≤3 visible lines
- [ ] AC-2: Human prompts and Wib/Wob replies remain fully visible and untruncated
- [ ] AC-3: Current/active tool call still shows inline during streaming
- [ ] AC-4: Failed tool calls (`[fail]`) always visible — never collapsed
- [ ] AC-5: Works with any tool, not just glitchbox commands
