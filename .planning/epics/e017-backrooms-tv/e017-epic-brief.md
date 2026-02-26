---
id: E017
title: Backrooms TV — Live ASCII Art Generator Window
status: not-started
issue: 103
pr: ~
depends_on: []
---

# E017 — Backrooms TV

## TL;DR

A TVision window that runs the wibandwob-backrooms v3 generator as a subprocess, captures its streaming stdout, and renders ASCII art line-by-line in real time — like a TV channel playing generative art. Configurable theme, primers, turns, and playback controls.

## Motivation

The backrooms generator creates multi-turn ASCII art conversations between Wib & Wob. The new v3 pipeline (Pi SDK, `wibandwob-backrooms/src/ui/cli-v3.ts`) streams output near-instantly. Piping that into a native TVision window turns WibWob-DOS into a live art gallery / ambient display.

## Architecture Sketch

```
┌──────────────────────────────────────────────┐
│  TBackroomsTvView (C++ TView subclass)       │
│  ├─ Scrollable text buffer (ring buffer)     │
│  ├─ Timer-driven read from child stdout pipe │
│  ├─ State: playing / paused / idle           │
│  └─ Config: theme, primers[], turns, model   │
└───────────────────┬──────────────────────────┘
                    │ popen / posix_spawn
┌───────────────────▼──────────────────────────┐
│  npx tsx wibandwob-backrooms/src/ui/cli-v3.ts│
│  --theme "X" --turns N --primers "a,b,c"     │
│  (stdout streams ASCII art in real time)     │
└──────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Subprocess, not embedded** — the generator is a Node.js/TypeScript process. WibWob-DOS spawns it as a child process and reads stdout via a pipe. No FFI, no embedding Node in C++.
2. **Timer-driven polling** — a `TTimerId` fires every ~50ms, reads available bytes from the pipe's fd, appends to the view's text buffer, and calls `drawView()`.
3. **Ring buffer display** — the view holds N lines (configurable, default ~200). Oldest lines scroll off the top. New content appears at the bottom, TV-style.
4. **Channel metaphor** — each "channel" is a theme + primer set. Switching channel kills the current subprocess and spawns a new one.

## Features

- [ ] **F01: Backrooms TV view** — C++ TView with scrolling text buffer, timer-driven pipe reader, draw logic
- [ ] **F02: Generator bridge** — spawn `cli-v3.ts` subprocess, manage lifecycle (start/stop/restart), pipe stdout
- [ ] **F03: Registry + menu** — command ID, registry capability, View menu item, IPC/REST dispatch
- [ ] **F04: Channel controls** — theme picker, primer selector, turns config, play/pause/skip hotkeys

## Acceptance Criteria

AC-1: `open_backrooms_tv` command opens a resizable window displaying streaming text.
Test: Open via menu/command, verify window appears in `/state` JSON with type `backrooms_tv`.

AC-2: View spawns `cli-v3.ts` subprocess and streams its stdout into the text buffer.
Test: Open window, wait 5s, verify text buffer is non-empty and contains ASCII art characters.

AC-3: Closing the window kills the child process (no orphans).
Test: Open window, note child PID, close window, verify PID no longer exists.

AC-4: Channel switch (new theme) restarts the subprocess with new args.
Test: IPC command `backrooms_tv_set_theme` with new theme, verify old process killed and new one spawned.

AC-5: `cmake --build ./build --target wwdos` passes with new files.
Test: Build succeeds with zero errors.

## Open Questions

- Should the view support multiple simultaneous channels (multiple windows)?
  Likely yes — each window instance manages its own subprocess.
- Should completed art be auto-saved to a gallery folder?
  Defer to F04 or a follow-on.
- Path to `wibandwob-backrooms` repo — hardcoded sibling path (`../wibandwob-backrooms`) or configurable?
  Start with env var `WIBWOB_BACKROOMS_PATH` with fallback to sibling dir.

## Non-Goals (This Epic)

- Embedding Node.js runtime in C++
- Two-way interaction (sending input to the generator)
- Primer file browsing UI (use existing primer window for that)
