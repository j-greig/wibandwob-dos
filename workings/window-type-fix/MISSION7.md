# MISSION 7 — Steering Prompts for Wib&Wob Chat

> Origin: User request (2026-02-21) inspired by Pi coding agent's steering mechanism

## The Idea

A way to inject guidance into Wib&Wob's context mid-conversation — like a stage direction that shapes their next response. Similar to how Pi (the coding agent harness) supports steering: additional context layered on top without disrupting the conversation flow.

## How Pi Does It

Pi's steering works by appending instructions to the system context that the model sees on the next turn. It's not a separate message in the conversation — it's contextual shaping. The user can steer the agent's behaviour, focus, or constraints without it being a conversational turn.

## Design Questions

### Visible or Silent?

- User says "don't need to be secret" but "likes the silent idea"
- Option A (silent): Steering text appended to system prompt or injected as a hidden system instruction. Wib&Wob follow it but it doesn't appear in chat history. Clean but invisible.
- Option B (visible): Steering appears as a "System:" or "Steer:" line in chat. Wib&Wob see it in context. User can see what guidance is active. More transparent.
- Option C (hybrid): Visible as a subtle indicator in chat (e.g. italic-style "~ steer: focus on code ~") but not a "User" turn that demands a response.

### Trigger vs Passive

- **Trigger steer**: Inject steer + immediately trigger a new LLM turn (like wibwob_ask but with steer context)
- **Passive steer**: Inject steer that takes effect on the NEXT user message or self-prompt. No immediate response.
- Pi uses passive — steer sits there until the next turn picks it up.

### Accumulation

- Does steering accumulate (multiple steers stack up)?
- Or does each new steer replace the previous one?
- Pi replaces — latest steer wins.

## Known Complications

- Chat window sometimes freezes while waiting for Anthropic API response (blocking LLM turn)
- If engine is busy, steer needs to queue (like pendingAsk_ does)
- Need to decide: does steer go into system prompt (persists across turns) or user message prefix (one-shot)?
- The SDK bridge sends system prompt once at session start — mid-session prompt changes would need the bridge to support prompt updates or message injection

## Proposed Architecture

### API Surface

  wibwob_steer — set steering text (passive, takes effect next turn)
  wibwob_ask — existing, sends user message (trigger)
  wibwob_steer_ask — set steer + trigger turn in one call (convenience)

### C++ Side

  TWibWobWindow gets a steeringText_ string member
  wibwob_steer command sets it via broadcast event (like pendingAsk_)
  On next processUserInput, if steeringText_ is non-empty:
    prepend to user message as "[Steering: ...]\n\n" prefix
    or inject as a separate system-role message
    clear steeringText_ after use

### MCP Tool

  tui_wibwob_steer with text parameter
  Wib&Wob can steer themselves for follow-up turns
  External scripts can steer Wib&Wob behaviour

### Display

  Option: show a subtle one-line indicator in chat like:
    ~ steering: focus on generative art ideas ~
  Doesn't trigger a response, just visible context

## Task Queue

```json
[
  {
    "id": "M7-T01",
    "status": "todo",
    "title": "Design steering mechanism and decide visible vs silent",
    "steps": [
      "Decide: visible indicator, silent, or hybrid",
      "Decide: accumulate vs replace",
      "Decide: system prompt injection vs message prefix",
      "Document decision"
    ]
  },
  {
    "id": "M7-T02",
    "status": "todo",
    "title": "Add wibwob_steer IPC command and C++ handling",
    "steps": [
      "Add steeringText_ to TWibWobWindow",
      "Add wibwob_steer to command_registry",
      "Broadcast event pattern (like pendingAsk_)",
      "Prepend to next processUserInput call"
    ]
  },
  {
    "id": "M7-T03",
    "status": "todo",
    "title": "Add MCP tool tui_wibwob_steer",
    "steps": [
      "Node MCP tool in mcp_tools.js",
      "Python MCP tool in mcp_tools.py",
      "Update Wib&Wob prompt with steering docs"
    ]
  },
  {
    "id": "M7-T04",
    "status": "todo",
    "title": "Handle engine-busy edge cases",
    "steps": [
      "Queue steer if engine busy (like pendingAsk_)",
      "Ensure steer survives across multiple queued messages",
      "Test: steer while LLM is streaming"
    ]
  },
  {
    "id": "M7-T05",
    "status": "todo",
    "title": "Test end-to-end steering flow",
    "steps": [
      "API -> steer -> user message -> verify LLM sees steer",
      "Wib&Wob self-steer via MCP tool",
      "Verify steer clears after use (one-shot)",
      "Verify steer queues when engine busy"
    ]
  }
]
```

## Reference: Pi Steering

Pi's steering is set via the session control interface. It persists until replaced. The model sees it as additional system-level context on every turn. It's invisible in the conversation transcript but shapes behaviour. Key insight: it's not a message, it's context.
