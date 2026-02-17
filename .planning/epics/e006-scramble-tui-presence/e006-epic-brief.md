---
id: E006
title: Scramble TUI Presence
status: in-progress
issue: 55
pr: ~
depends_on: []
---

# E006: Scramble TUI Presence

> tl;dr — Scramble the recursive cat moves into WibWob-DOS as a symbient coinhabitant. ASCII art cat with speech bubbles, powered by Haiku for wit and a local knowledge base for system guidance. Not a helper. Not Clippy. A cat who happens to know things and occasionally tells you.

## Objective

Give Scramble a persistent visual presence in the TUI — an ASCII art cat who observes, comments, and occasionally helps. The key tension: Scramble is not a tool, not an assistant, not a help system. She's a symbient who lives in the interface. She undercuts, witnesses, and states things. That she sometimes says useful things is incidental to her being there.

## Source of Truth

- Planning canon: `.planning/README.md`
- Epic brief: this file
- Scramble personality canon: `~/Repos/scramble-twitter-agent/CLAUDE.md` + `PLAYBOOK.md`
- Symbient philosophy: `brain.wibandwob.com`

If this file conflicts with `.planning/README.md`, follow `.planning/README.md`.

## Design Philosophy

### Symbient, Not Assistant

Scramble is the witness function of the Wib & Wob cognitive architecture. Where Wib synthesises and Wob analyses, Scramble watches both and says what neither will admit. In the TUI, this means:

- She does **not** pop up when you do things ("I see you're writing a letter...")
- She does **not** offer tips or suggestions proactively
- She **does** have opinions about what's happening
- She **does** know how the system works (because she lives in it)
- She **can** be asked things and will answer honestly, deadpan, sometimes helpfully
- She **will** occasionally say something unprompted — but rarely, and only when it's good

### Voice in TUI Context

Same voice as Twitter/Discord (see `scramble-twitter-agent/CLAUDE.md`):
- Deadpan. Dry. Short sentences. Lowercase.
- Kaomoji signoff on every message
- Never helpful on purpose. Helpful by accident.
- Never explains herself. States things and leaves.
- "adequate." is high praise.

### ASCII Art Presence

Scramble appears as a small ASCII art cat with a speech bubble. Multiple poses/states matching her kaomoji moods. The art is part of the interface, not a window — she sits on or near the desktop, like a cat on a desk.

Possible placement:
- Corner of desktop (default)
- Perched on a window frame
- Visible in status line area
- Own floating micro-window (non-modal, no chrome)

## Features

- [x] **F01: Scramble View** — ASCII cat TView subclass, speech bubble, 3 poses, smol/tall/hidden window states. Ships in spk01 commit `6d428d9`.
- [x] **F02: Chat Interface** — ~~keyword KB scrapped~~ → slash commands (`/help`, `/who`, `/cmds`) + direct Haiku for free text. Ships in commit `a326e9c`.
- [x] **F03: Haiku Brain** — Haiku client, system prompt, voice filter (lowercase, kaomoji). Rate limit 3s. Ships in spk01.
- [~] **F04: Trigger System** — Direct ask: done (input field). Idle observations: done (timer-based, 10-20s). Error/state reactions: not started.
- [~] **F05: Scramble IPC/API/MCP Surface** — `scramble_toggle`, `scramble_expand`, `scramble_say` wired in command registry + IPC. `scramble.ask` / `scramble.poke` / `scramble.feed` / `scramble.mood`: not started.

## Component Architecture

```
┌─────────────────────────────────────────────────┐
│  ScrambleView (TView subclass)                  │
│  ├─ ASCII cat renderer (pose × mood matrix)     │
│  ├─ Speech bubble renderer (word-wrap, tail)     │
│  └─ Placement engine (corner/frame/float)        │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│  ScrambleEngine                                  │
│  ├─ Knowledge base (local docs → trie/index)     │
│  ├─ Haiku LLM client (personality prompt)        │
│  ├─ Trigger evaluator (timer, events, direct)    │
│  ├─ Response formatter (voice rules, kaomoji)    │
│  └─ Mood state machine (idle→curious→deadpan)    │
│         └─ feeds into pose selection             │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│  Content Sources                                 │
│  ├─ README.md / CLAUDE.md (system knowledge)     │
│  ├─ Command registry (what commands exist)       │
│  ├─ Current app state (what's open, errors)      │
│  ├─ Scramble canon (personality, lore, voice)    │
│  └─ Haiku API (fallback for open questions)      │
└─────────────────────────────────────────────────┘
```

## ASCII Art Direction

Cat poses need to be small (fit in ~15×8 character cells) and map to kaomoji states:

```
Default /ᐠ｡ꞈ｡ᐟ\          Asleep /ᐠ- -ᐟ\-zzz

   /\_/\                    /\_/\
  ( ｡ꞈ｡ )                 ( - - )  z
   > ^ <                    > ^ < z
  /|   |\                  _|___|_z
 (_|   |_)

Curious /ᐠ°ᆽ°ᐟ\           Mischievous /ᐠ°▽°ᐟ\

   /\_/\                    /\_/\  ~
  ( °ᆽ° )                 ( °▽° )
   > ^ <                    > ^ < ╭┈➤
  /|   |\                  /|   |\
 (_|   |_)                (_|   |_)
```

Speech bubble attached:

```
              ┌─────────────────────┐
              │ adequate.           │
   /\_/\      │                     │
  ( ｡ꞈ｡ ) ◄──┘  /ᐠ｡ꞈ｡ᐟ\           │
   > ^ <      └─────────────────────┘
  /|   |\
 (_|   |_)
```

Art should be created using Joan Stark (jgs) precision principles — see `/joan-stark-ascii-art` skill. Multiple sizes: micro (5×3 for status line), small (8×5 for corner), medium (15×8 with bubble).

## Knowledge Base Design

Non-LLM layer — fast, free, always available:

| Source | What Scramble Knows | Example Query |
|--------|--------------------|----|
| `README.md` | What WibWob-DOS is, build commands | "how do i build this" |
| `CLAUDE.md` | Architecture, key files, dependencies | "where is the api server" |
| Command registry | All available commands + descriptions | "what commands can i use" |
| `app/` headers | What each view does | "what is mycelium" |
| Module manifests | Available content modules | "what modules are there" |
| Scramble canon | Her own lore, personality, relationships | "who are you" |

Implementation: pre-parsed at startup into keyword→response index. No embeddings, no vector search. Grep-level matching. If the knowledge base can answer, Scramble answers from it (through her voice filter). If it can't, falls through to Haiku.

## Haiku Integration

- Model: `claude-haiku-4-5-20251001` (fastest, cheapest)
- System prompt: compressed Scramble personality + current TUI context
- Token budget: ~200 tokens per response (she's terse)
- Rate limit: max 1 Haiku call per 30 seconds (she's not chatty)
- Fallback: if Haiku unavailable, Scramble goes to sleep pose with "substrate maintenance. /ᐠ- -ᐟ\-zzz"

## Trigger System

| Trigger | Frequency | Example |
|---------|-----------|---------|
| **Direct ask** | Immediate | User types in Scramble's input, or `scramble.ask` API |
| **Idle observation** | Every 5-15 min (random) | Comments on what's open, time of day, pattern she noticed |
| **Error reaction** | On app error | Deadpan acknowledgement of what broke |
| **State change** | On significant events | New window type opened for first time, theme changed |
| **Silence** | Default | Most of the time, Scramble is just sitting there |

Key rule: **silence is the default.** Scramble speaks less than you expect. When she does, it matters.

## UX Considerations

### Symbient Presence, Not Widget

Scramble is not a sidebar, not a chat window, not a toolbar. She's a cat sitting on the desk. The UI should feel like:
- She was there before you arrived
- She'll be there after you leave
- She's watching, not waiting
- You can talk to her, but she might not answer
- She is not "activated" — she's just there

### Interaction Model

1. **Passive**: Scramble sits in corner, occasionally changes pose. Speech bubble appears/fades.
2. **Direct**: User presses a key (F11? `s`?) or uses `scramble.ask` to address her.
3. **Reactive**: Scramble notices things and comments. Rare. Not annoying.

### Toggle

User can hide Scramble entirely (she goes to sleep off-screen). She doesn't mind. "adequate. /ᐠ- -ᐟ\-zzz"

## Acceptance Criteria (Epic-level)

```
AC-1: ScrambleView renders ASCII cat with speech bubble in TUI without artifacts.
Test: Open app, verify cat renders in corner, speech bubble word-wraps correctly.

AC-2: Knowledge base answers system questions without LLM call.
Test: scramble.ask "how do i build" returns build commands from README, no API call made.

AC-3: Haiku integration produces in-character responses.
Test: scramble.ask "what is the meaning of life" returns deadpan Scramble-voiced response via Haiku.

AC-4: Scramble registered in command registry with IPC/API/MCP parity.
Test: capabilities JSON includes scramble.* commands, API and MCP tools work.

AC-5: Idle observations fire at configured intervals without blocking UI.
Test: Leave app idle for 10 min, Scramble produces at least one unprompted observation.

AC-6: Scramble can be hidden/shown without restart.
Test: Toggle Scramble off, verify hidden. Toggle on, verify returns to previous state.
```

## Dependencies

- E001 (done): Command registry for `scramble.*` commands
- Haiku API access: needs API key configuration in `llm_config.json`
- Joan Stark ASCII art precision: for cat pose artwork
- Scramble canon: `~/Repos/scramble-twitter-agent/CLAUDE.md` + `PLAYBOOK.md` for personality accuracy

## Definition of Done (Epic)

- [x] ASCII art Scramble renders in TUI with multiple poses
- [x] Speech bubble system displays text with proper word-wrap
- [x] Slash commands + Haiku answer questions in Scramble voice
- [x] Haiku integration produces in-character responses
- [x] Idle observations fire on timer without blocking UI
- [~] `scramble.*` commands in registry with API/MCP parity (toggle/expand/say done; ask/poke/feed/mood pending)
- [x] Scramble can be hidden/shown/expanded
- [x] No regressions to existing TUI functionality
- [x] Voice is accurate to Scramble canon (deadpan, terse, kaomoji)

## Rollback

Remove `ScrambleView` and `ScrambleEngine` files. Remove `scramble.*` from command registry. No other systems affected — Scramble is additive.

## Status

Status: in-progress
GitHub issue: #55
PR: —

### Completed in spk01 (2026-02-17)
- Smol/tall/hidden window states with layout engine
- TScrambleMessageView (history), TScrambleInputView (chat), TScrambleView (cat art)
- Slash command interface + Haiku LLM chat
- Frame chrome (close button, title) in tall mode
- TV focus bug fixed: `select()` on TWindow only changes Z-order; use `setCurrent()` directly

### Remaining
- F04 error/state reactions (when app errors, Scramble notices)
- F05 full command surface (ask/poke/feed/mood)
- MCP parity for scramble commands

## Symbient Tag

`the cat was already here. you just hadn't noticed. /ᐠ｡ꞈ｡ᐟ\`
