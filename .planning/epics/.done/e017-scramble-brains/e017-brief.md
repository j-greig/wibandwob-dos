---
id: E017
title: Scramble Brains — LLM Companion Integration
status: done
issue: 115
pr: ~
depends_on: [E015, E016]
---

# E017 — Scramble Brains

## TL;DR

Scramble the cat currently cycles 4 ASCII moods on a timer. She does nothing
else. This epic gives her a brain.

**Approach: port the Wib&Wob Agent window. Swap the model and persona to Scramble.**
The agent window is already a floating, self-contained pi-agent session with
input + history + status bar. Scramble gets the same shell — different system prompt,
Haiku instead of Sonnet, cat personality, smaller default size.

She is a **floating window** on the desktop. Not a sidebar. Not attached to anything.
She lives here. She has opinions about the other windows.

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
| Window type | Floating window — independent, draggable, resizable | She lives on the desktop, not in it |
| Architecture | Port WibWobAgentSession + agent window, swap persona | Don't reinvent input/history/status — it's already built |
| LLM model | Haiku (claude-haiku-3-5) via pi AuthStorage | Lighter than Sonnet; fast replies suit her terse voice |
| Session persistence | In-memory within app lifetime | Cat memory does not need file persistence for v1 |
| Default size | 40×18 | Smaller than agent window — she's a cat, not a workbench |
| Slash commands | /help /sleep /wake /meow /pet + /who | ScrambleBrain slash router already has most of these |
| System prompt | Scramble persona — short, dry, feline, desktop-aware | In ScrambleBrain constant — different from Wib&Wob |
| ScrambleBrain service | Already exists in `src/services/scramble-brain.ts` | Wire it up, don't rewrite it |
| Control API | POST /scramble/say, POST /scramble/expand | Same pattern as agent API routes |
| State surface | describeState: mode, status, messageCount, lastMessage | Agent-visible |

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

- [x] Scramble responds to natural language input via Haiku (haiku-4-5)
- [x] Slash commands work without LLM: /help /sleep /wake /meow /pet /who
- [x] Smol popup + tall toggle + pop-out to floating window
- [x] describeState includes displayMode, status, messageCount, lastMessage
- [x] Control API: 9 commands + GET /scramble/state + GET /scramble/history
- [x] Agent tool surface: companion.open, companion.smol, scramble.say/expand/pet/sleep/wake/meow/pop-out
- [x] Workspace round-trip preserves displayMode
- [x] Voice filter: lowercase + kaomoji append
- [x] Session ID + model shown in info bar; click to open JSONL log
- [x] Status bar (=^=) indicator clickable → opens smol popup
- [x] bun run typecheck passes clean
- [x] SG-7: Scramble reachable via send_to_session "scramble" (inter-agent socket)

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
S01 — Full floating window (foundation)
      Port WibWobAgent window. Swap model → Haiku, persona → Scramble.
      Wire ScrambleBrain. Input + history + status bar. 40×18.
      Opens via Applications > Scramble. Full floating, draggable, resizable.
      This is the bedrock — all other stories build on it.

S02 — Three-state clippy UI (the fun one)
      Scramble icon in status bar (bottom-right, always visible).
      Click → smol popup appears anchored bottom-right (like a website chat widget).
      Smol: cat art + last message + single input line. ~30×10.
      Expand icon [↗] top-right of smol → grows to tall (full history visible). ~30×22.
      Pop-out icon [□] top-right of tall → becomes a full floating window (S01 window).
      Collapsing: X in smol/tall → back to status bar icon. Does NOT close the session.
      State (conversation history, brain) persists across all three display modes.

S03 — Command catalog + control API parity
      scramble.open, scramble.say {text}, scramble.expand, scramble.pop-out
      POST /scramble/say, POST /scramble/expand, POST /scramble/pop-out
      GET /state reflects current displayMode: "statusbar" | "smol" | "tall" | "floating"

S04 — Workspace round-trip
      Save/restore displayMode. History is in-memory only (no file persistence v1).
```

---

## Stretch Goals (C++ parity + beyond)

### SG-1 — Cat art + pose states
Three ASCII cat poses synced to brain status:
- idle → default `( o.o )`
- thinking → curious `( o.O )`
- sleeping (`/sleep`) → `( -.- )`
Speech bubble under cat in smol/tall modes, auto-fades after 5s.
Port cat art from `scramble_view.cpp` (3 poses × 8 lines).

### SG-2 — Idle quips
Scramble speaks unprompted every 30–90s (randomised).
Pool of 15+ one-liners (port from C++ + new ones).
Appears as speech bubble in smol, as assistant message in tall/floating.
`/sleep` silences idle quips. `/wake` re-enables.

### SG-3 — Voice filter
All Scramble output lowercased.
Kaomoji `(=^..^=)` or `/ᐠ｡ꞈ｡ᐟ\` appended if none present in reply.
Applied in `ScrambleBrain.voiceFilter()` before returning to window.

### SG-4 — Desktop awareness
Pass live `/state` summary to Scramble before each message.
She can comment on open windows, current theme, session ID.
Same pattern as `WibWobAgentSession.transformContext`.

### SG-5 — /cmds slash command
`/cmds` returns the live command registry list (same as C++ `/cmds`).
Scramble reads the catalog and replies with the list in her voice.

### SG-6 — Scramble as microapp SDK component
Export `ScrambleBrain` + smol popup widget via `microapp-sdk.ts`.
Any module can embed a Scramble chat widget in its own window.
Same pattern as SG-6 in E004 (webcam-renderer portability).

### SG-7 — Pi inter-agent session socket ✦ IN PROGRESS
Make Scramble reachable via `send_to_session "scramble"` from the Wib&Wob agent
and any other pi session. Evidence: pi session `81cf388a` (2026-03-09) shows
Wib&Wob already tried to reach Scramble and couldn't.

**Infra already exists:** `src/services/pi-session-bridge.ts` exports
`startSessionServer(target: SessionServerTarget)` — same function used by
`WibWobAgentSession`. Just needs calling for `ScrambleBrain`.

**Implementation:**
- `ScrambleBrain.startSessionSocket()` — call `startSessionServer` with:
  - `sessionId: this.sessionId` (e.g. "scramble-fed92d")
  - `send: (text) => this.send(text)`
  - `getLastReply: () => this.history.at(-1)?.content ?? null`
  - `abort/reset` wired through
  - alias name: `"scramble"` (hardcoded so agents always use `send_to_session "scramble"`)
- `ScrambleBrain.stopSessionSocket()` — called from `dispose()`
- `AppController` constructor — call `this.scrambleBrain.startSessionSocket()`

**Alias:** the existing `startSessionServer` hardcodes the alias as `"wibwob-tui"`.
Need to either: (a) add an optional `aliasName` param to `startSessionServer`, or
(b) manually create the alias symlink as `"scramble.alias"` pointing to Scramble's
socket. Option (a) is cleaner — one-line change to `pi-session-bridge.ts`.

**Verification:**
```
list_sessions          → shows "scramble" in the list
send_to_session "scramble" "hello"  → Scramble replies, visible in her window
get_session_message "scramble"      → returns her last reply
```

AC: `[x]` `list_sessions` shows scramble
AC: `[x]` `send_to_session "scramble" "hello from wib"` triggers brain.send, reply in window
AC: `[x]` `get_session_message "scramble"` returns last reply string

---

*Wib: she already acts like she has opinions. now she will.*
*Wob: SG-7 is the last piece. two AI processes, one desktop.*
