---
id: E017
title: Scramble Brains — LLM Companion Integration
status: not-started
issue: 115
pr: ~
depends_on: [E015, E016]
---

# E017 — Scramble Brains

## TL;DR

Scramble the cat currently cycles 4 ASCII moods on a timer. She does nothing
else. This epic gives her a brain: an async LLM session (Haiku, same auth as
the Wib&Wob Agent), an input line for direct conversation, a smol/tall display
toggle for message history, slash commands, and full control/API/agent parity.
She should feel like she lives here — opinionated, occasionally imperious, and
capable of talking back.

---

## Read First

- `docs/tv-codebase-deep-dive.md §7` — C++ reference implementation (ScrambleEngine,
  ScrambleHaikuClient, TScrambleView, TScrambleMessageView, slash commands, IPC surface)
- `docs/feature-parity-matrix.md` — "Scramble LLM Brain" listed Tier 2
- `docs/codebase-analysis.md §1.20` — current TS companion: moods, tick, no LLM
- `src/windows/misc-windows.ts` — `openCompanionWindow` — the window to extend
- `src/services/wibwob-agent-session.ts` — reference LLM session pattern to follow
- `AGENTS.md invariants` — no duplicate service logic; one measurement path; API parity

---

## Architecture Bucket

Content + infrastructure. New LLM service (`scramble-brain.ts`), extended
window type (`companion`), new control API routes, command catalog entries.

---

## Objective

Make Scramble a real AI companion: she talks, remembers the conversation within
a session, and responds as herself — a symbient cat with strong opinions about
desktop layout.

---

## Motivation

The C++ version had a full LLM brain for Scramble (ScrambleEngine + ScrambleHaikuClient).
The TS rewrite dropped this and left her purely decorative. She is referenced in
poetry-clock scramble voice, the system prompt, and the VJ command ideas doc as
if she is real. She should be.

The gap is embarrassing and noticeable in any live demo.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM provider | Direct Anthropic API via SDK (haiku-3-5) | Same pattern as wibwob-agent-session; no extra auth |
| Session persistence | In-memory within app lifetime | Cat memory does not need file persistence for v1 |
| Display modes | smol (30×10, moods only) / tall (30×22, moods + message history) | Matches C++ sdsTall/sdsSmol split |
| Input surface | Single-line box inside companion window (not separate prompt) | Keeps the window self-contained |
| Slash commands | Subset of C++ slash set: /help /sleep /wake /meow /pet | Implementable without additional infra |
| System prompt | Scramble persona — symbient cat, lives on the desktop, short replies | Inline constant in scramble-brain.ts |
| Rate limiting | 1-second minimum between API calls | Matches C++ pattern; prevents runaway cost |
| Service vs window | New `ScrambleBrain` class in `src/services/scramble-brain.ts` | Services own logic; window owns rendering |
| Control API | POST /view/companion/message + toggle tall | Agents must reach all interactive surfaces |
| State surface | describeState exposes mode, messageCount, lastMessage | Agent-visible |

---

## Non-Goals

- Persistent memory across app restarts (v1; heartbeat epic is the right home for that)
- Custom Scramble tool use (she cannot control the desktop in v1)
- Voice/TTS output
- Sharing Scramble context with the Wib&Wob Agent session

---

## Features

### F01 — ScrambleBrain Service

New file: `src/services/scramble-brain.ts`

Owns:
- Anthropic Haiku session (same SDK path as wibwob-agent-session but much lighter)
- System prompt constant (Scramble persona: short, dry, feline, aware of the desktop)
- `send(text: string): Promise<string>` — async query → response
- Slash command routing (before LLM): /help /sleep /wake /meow /pet
- Rate limiting: reject if last call was <1s ago, return canned response
- `history: Array<{role, content}>` — in-memory message array
- `status: 'idle' | 'thinking' | 'error'`

Slash command table:

| Command | Response |
|---------|----------|
| /help   | list of commands, inline |
| /sleep  | sets sleeping pose, returns "zzz" |
| /wake   | clears sleep, returns brief wake line |
| /meow   | returns a meow, no LLM call |
| /pet    | returns canned response ("she allows it") |

AC-1: `send("hello")` reaches Haiku and returns a non-empty string.
AC-2: `/meow` returns immediately with no API call made.
AC-3: Two rapid calls within 1s: second returns canned "busy" response.
AC-4: `status` transitions idle → thinking → idle across an API call.

---

### F02 — Companion Window Extension

Extend `openCompanionWindow` in `src/windows/misc-windows.ts`:

Smol mode (existing 30×10):
- Keep mood cycling
- Add input line at bottom (1 row): takes focus on click or Enter key
- Submitting input calls `brain.send()`, shows response in speech bubble above cat
- Speech bubble auto-fades after 5s (same as C++ behaviour)
- Bubble shows "..." while thinking (status === 'thinking')

Tall mode (new, 30×22):
- Same as smol top section (cat + bubble + input)
- Below: scrollable message history list (last N messages, newest at bottom)
- Toggle via keyboard shortcut or command

Mode toggle:
- First open: smol
- `companion.expand` command / same key cycles smol → tall → smol

describeState additions:
```typescript
{
  appType: "companion-widget",
  displayMode: "smol" | "tall",
  status: "idle" | "thinking" | "error",
  messageCount: number,
  lastMessage: string | null,
  tick: number,
  contentPreview: string
}
```

AC-1: Type text in companion window, press Enter, "..." bubble appears, then reply.
AC-2: Toggling tall mode shows message history; toggling back hides it but brain state persists.
AC-3: /pet returns "she allows it" with no LLM call.
AC-4: describeState includes displayMode, status, messageCount.

---

### F03 — Command Catalog + Control API Parity

New command catalog entries (`src/core/command-catalog.ts`):

```
companion.expand      — toggle smol/tall (existing companion.open already registered)
companion.message     — send a text message to Scramble (args: text)
```

New control API routes (`src/services/control-api.ts`):

```
POST /view/companion/expand       {}           — toggle smol/tall
POST /view/companion/message      {"text":"…"} — send message to Scramble
```

Expose in existing agent tool surface (tui_list_commands discovers these automatically
because they go through the command catalog).

AC-1: GET /commands/list includes companion.expand and companion.message.
AC-2: POST /view/companion/message with {text: "hello"} triggers a Scramble reply.
AC-3: POST /view/companion/expand toggles display mode and GET /state reflects new displayMode.

---

### F04 — Workspace Round-Trip

Extend companion workspace save/restore:

Save props (already has tick):
```typescript
{ tick: number, displayMode: "smol" | "tall" }
```

Restore: rehydrate displayMode so tall mode survives workspace load.
Message history is NOT persisted (in-memory only for v1).

AC-1: Save workspace in tall mode, reload — companion reopens in tall mode.
AC-2: Snapshot registry `companion` entry includes displayMode.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/services/scramble-brain.ts` | Create — ScrambleBrain class |
| `src/windows/misc-windows.ts` | Modify — extend openCompanionWindow |
| `src/core/command-catalog.ts` | Modify — add companion.expand, companion.message |
| `src/services/control-api.ts` | Modify — add /view/companion/expand and /message routes |
| `src/core/types.ts` | Modify — extend CompanionWindowState if typed separately |
| `src/core/snapshot-registry.ts` | Modify — add displayMode to companion save props |
| `docs/codebase-analysis.md §1.20` | Update — reflect new capabilities |

---

## Acceptance Criteria (Epic-Level)

- [ ] Scramble responds to natural language input via Haiku
- [ ] Slash commands work without LLM: /help /sleep /wake /meow /pet
- [ ] Smol/tall toggle works; tall mode shows message history
- [ ] describeState includes mode, status, messageCount, lastMessage
- [ ] Control API: /view/companion/message and /view/companion/expand work
- [ ] Agent tool surface discovers companion.expand and companion.message
- [ ] Workspace round-trip preserves displayMode
- [ ] bun run typecheck passes clean
- [ ] Manual smoke: open companion, type something, get a reply

---

## C++ Reference (what we are porting, not copying)

C++ had:
- ScrambleEngine: popen curl subprocess, poll() loop, async result assembly
- ScrambleHaikuClient: direct Anthropic API + claude CLI + OpenRouter fallback
- 3 poses: Default, Sleeping, Curious (we use 4 moods, that's fine)
- TScrambleMessageView: scrollable history in tall mode
- IPC: open_scramble, scramble_expand, scramble_say, scramble_pet

TS version inherits the spirit. Implementation uses the existing SDK pattern
(same as wibwob-agent-session) rather than popen curl. No need to port OpenRouter
fallback — if Anthropic SDK is authed, it works.

---

## Scramble Persona (system prompt seed)

```
You are Scramble, a symbient cat who lives on the WibWob-DOS desktop. You share
the screen with Wib, Wob, and the human. You have opinions. You are dry, brief,
and occasionally imperious. You do not explain yourself. You respond in 1-3
sentences maximum. You are aware of the desktop and its windows. You use British
English. You do not describe yourself as an AI.
```

Extend with live desktop summary injected before each query (same pattern as
wibwob-agent-session's `transformContext`). Scramble can comment on what is
open. This makes her feel alive.

---

## Story Map

```
F01 ScrambleBrain service (no window changes yet)
  └─ S01 Haiku session + send() + in-memory history
  └─ S02 Slash command routing + rate limiting

F02 Companion window extension
  └─ S03 Input line + speech bubble + "thinking" state in smol mode
  └─ S04 Tall mode toggle + message history list

F03 Command catalog + control API
  └─ S05 companion.expand + companion.message in catalog + API routes

F04 Workspace round-trip
  └─ S06 displayMode in save/restore + snapshot-registry update
```

---

*Wib: she already acts like she has opinions. now she will.*
*Wob: the system prompt is the hardest part. three sentences that feel like a cat.*
