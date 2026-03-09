# E017 — Scramble Brains: C++ vs TS Crosscheck

> Written 2026-03-09 after reading both codebases in full.
> C++ source: `~/Repos/wibandwob-dos-last-days-of-tvision/app/scramble_engine.{h,cpp}` + `scramble_view.{h,cpp}` (937 lines)
> TS source: `src/services/scramble-brain.ts` + `src/windows/misc-windows.ts openCompanionWindow`

---

## TL;DR

`ScrambleBrain` (TS service) is **fully implemented and better than the C++ version**.
`openCompanionWindow` (TS window) is **completely hollow** — 4 moods on a timer, zero connection to the brain.

The gap is entirely in the window layer. The brain just needs wiring up.

---

## C++ architecture (what existed)

### ScrambleHaikuClient
- Three auth backends: Claude CLI (`popen claude -p`), Anthropic API key (curl), OpenRouter free tier fallback
- Async via `popen` + `fcntl(O_NONBLOCK)` + `poll()` called from event loop — primitive but functional
- Rate limit: 1 call/second
- Voice filter: lowercase enforcement + kaomoji append if missing

### ScrambleEngine
- Slash commands: `/help`, `/who`, `/cmds` (lists all registry commands)
- Idle quip pool: 15 hardcoded one-liners, randomly surfaced unprompted
- `voiceFilter()`: lowercases all output, appends kaomoji `(=^..^=)` / `/ᐠ｡ꞈ｡ᐟ\` if none present

### TScrambleView (cat art panel)
- 3 pose states: `spDefault`, `spSleeping`, `spCurious`
- Cat ASCII art per pose (8 lines × 12 chars)
- Speech bubble: word-wrapped, fades after 5 seconds
- Idle pose timer: 10hz tick, pose changes randomly

### TScrambleMessageView (history panel)
- Scrollable word-wrapped message list
- Sender prefix: `you:` / `scramble:`
- Shown only in tall mode

### TScrambleInputView (input panel)
- Single-line text input with cursor blink
- Thinking spinner when LLM is in flight
- `onSubmit` callback

### TScrambleWindow (container)
- Three display states: `hidden`, `smol` (cat + bubble only), `tall` (cat + message history + input)
- `cmScrambleExpand` command toggles smol ↔ tall
- `changeBounds()` re-layouts children on resize
- `focusInput()` used after LLM reply

---

## TS current state

### ScrambleBrain (DONE — better than C++)

| Feature | C++ | TS |
|---------|-----|----|
| LLM backend | curl/popen hack | pi-agent-core Agent (proper SDK) |
| Auth | 3 manual backends | pi AuthStorage + ModelRegistry (auto) |
| Async | popen + poll() | async/await (clean) |
| Rate limiting | manual time_t | `createRateLimiter` service |
| Slash commands | /help /who /cmds | /help /sleep /wake /meow /pet |
| History | none | `ScrambleMessage[]` with timestamps |
| Desktop context | none | `desktopSummary` passed to LLM |
| Sleeping mode | none (pose only) | `/sleep` `/wake` commands |
| Abort | none | `abort()` + `activeRequestId` guard |
| Dispose | none | `dispose()` cleans up properly |
| Voice filter | lowercase + kaomoji | MISSING |
| Idle quips | 15-quip pool | MISSING |
| /who | ✓ | MISSING |
| /cmds | ✓ (registry list) | MISSING |

### openCompanionWindow (HOLLOW)

```ts
// Current reality:
const moods = [ "lurking", "judging layout", "cat online", "purring in ANSI" ];
setInterval(() => bubble.setContent(moods[tick % 4]), 2400);
// ScrambleBrain is never instantiated. Never imported. Completely unused.
```

---

## What needs building

### Window layer (the whole job)

Model it on `src/services/wibwob-agent-session.ts` + the agent chat window.
Architecture is nearly identical — input box, message list, status display.

**Layout (smol mode, default):**
```
┌─ Scramble ──────────────────┐
│   /\_/\                     │
│  ( o.o )   [speech bubble]  │
│   > ^ <                     │
│  /|   |\                    │
│ (_|   |_)                   │
│    | |                      │
└─────────────────────────────┘
```

**Layout (tall mode, after first message):**
```
┌─ Scramble ──────────────────┐
│   /\_/\                     │
│  ( o.o )                    │
│   > ^ <                     │
├─────────────────────────────┤
│ you: hey scramble           │
│ scramble: adequate. (=^..^=)│
│ you: what do you think of   │
│   the layout?               │
│ scramble: the sidebar is    │
│   an affront. /ᐠ- -ᐟ\      │
├─────────────────────────────┤
│ > [input here]  [thinking…] │
└─────────────────────────────┘
```

### Stories for E017

**S01 — Wire ScrambleBrain into companion window**
- Instantiate `ScrambleBrain` in `openCompanionWindow`
- Pass `desktopSummary` from state service on each send
- Keep mood cycling but sync cat pose to `brain.status`:
  - idle → spDefault
  - thinking → spCurious
  - error/offline → spSleeping

**S02 — Input line + message history**
- Add blessed `input` element at bottom of window (same pattern as agent chat)
- Add blessed `log` or scrollable `box` for message history
- Enter key → `brain.send(text)` → append to display
- Show thinking indicator while `brain.status === "thinking"`

**S03 — Smol / tall toggle**
- Default: smol (cat art + speech bubble, no input/history)
- `t` key or click → toggle tall (shows history + input)
- Window resize: smol = 30×10, tall = 30×24 (or whatever fits)
- In smol mode: last LLM reply shown as speech bubble under cat for 5s then fades

**S04 — Voice filter + idle quips**
- Add `voiceFilter(text)` to `ScrambleBrain`: lowercase + append kaomoji if none present
- Add idle quip pool (port from C++ + new ones): surface one unprompted every 30–90s
- Idle quip appears as speech bubble in smol, as assistant message in tall

**S05 — Slash commands + API parity**
- Add `/who` and `/cmds` to the slash router
- `describeState()`: `{ mood, status, lastMessage, historyLength, displayState }`
- Register: `scramble.say { text }`, `scramble.toggle-size`, `scramble.pet`
- Control API routes: `POST /scramble/say`, `GET /scramble/state`

---

## Key files to touch

| File | What changes |
|------|-------------|
| `src/windows/misc-windows.ts` | Replace openCompanionWindow entirely |
| `src/services/scramble-brain.ts` | Add voiceFilter, idle quips, /who, /cmds |
| `src/core/command-catalog.ts` | Add scramble.say, scramble.toggle-size, scramble.pet |
| `src/services/control-api.ts` | Add /scramble/* routes |
| `src/core/types.ts` | Add "companion" appType details if needed |

## Reference: wibwob-agent-session.ts pattern

The Wib&Wob agent window is the direct blueprint for the input+history pattern.
Read that before touching the companion window. Same blessed structure.

## C++ cat art to port (3 poses)

```
Default:          Sleeping:         Curious:
   /\_/\             /\_/\            /\_/\
  ( o.o )           ( -.- )          ( o.O )
   > ^ <             > ^ <            > ^ <
  /|   |\           /|   |\          /|   |\
 (_|   |_)         (_|   |_)        (_|   |_)
    | |                | |              | |
   (___)              (___)            (___)
```
