---
type: reference
status: active
tags: [skills, creative, ops, wibwob]
tldr: "Every skill available to Wib & Wob across all repos. Grouped by vibe, not by location."
---

# Skills Inventory — What Wib & Wob Can Do

35 distinct skills across `.pi/skills/`, `.agents/skills/`, and `~/.agents/skills/`.
Grouped by what they're FOR, not where they live.

---

## Make Things — Creative / Generative

| Skill | What it does |
|---|---|
| `chiptune` / `chiptune-studio` | Build original chiptune from scratch — oscillators, patterns, mixing, export to WAV |
| `chiptune-cover` | Arrange a well-known song as chiptune — research key/tempo, compose, render |
| `vj-timeline` | Compose timed music video shows — visual cues synced to audio playback |
| `figlet-videographer` | Typographic video sequences using figlet text animations in the TUI |
| `michel-gondry-music-video-director` | Director lens — handmade practical effects, rule-based worlds, music-to-choreography mapping |
| `img-to-ascii` | Convert images to ASCII art primers for TUI windows |
| `joan-stark-ascii-art` | 500+ ASCII art pieces by jgs (1996-2001) — browse, pick, open as primer |

---

## Operate the Desktop — WibWob-DOS Control

| Skill | What it does |
|---|---|
| `wibwobdos` | Main entry point — connect, minimap, open windows, send input, read state. [vps-ok] scripts included |
| `discord-tui-share` | Share TUI to Discord as PNG screenshot or ASCII minimap [local-only] |
| `tmux-launch` | Launch WibWob-DOS + API server in tmux |
| `ww-ops` | Build, typecheck, launch, health check, smoke test, screenshot |
| `ww-screenshot` | Targeted crop of a single window for visual debugging |
| `timeline-smoke` | Smoke test a VJ timeline — screencapture PNGs at every cue step |
| `tui-smoke-test` | Write and run headless integration tests for TUI surfaces |

---

## Build Things — TUI Dev

| Skill | What it does |
|---|---|
| `new-window-type` | Full checklist for adding a new window type — type, factory, commands, API, persistence |
| `ww-scaffold-view` | Scaffold a new TView window — generates C++ header/impl, patches CMakeLists, wires menu/API/MCP |
| `ww-build-game` | Build a TUI game from concept to tested shipped window |
| `composable-engines` | Extract a rendering engine from a window, make it a reusable FramePlayer, compose into other surfaces |
| `ww-primitives` | Maintain the shared reusable exports index (src/core/primitives.ts) |
| `ww-room-chat` | Launch and test multi-instance PartyKit room chat (wibwob1 + wibwob2) |
| `micropolis-engine` | Work on the Micropolis/WibWobCity integration — tile system, bitmasks, zone logic, tool API |

---

## Think + Review — Analysis / Meta

| Skill | What it does |
|---|---|
| `simplify` | Three-pass code review after a batch of changes — reuse, quality, efficiency |
| `simplify-docs` | Three-pass review of specs, architecture docs, handover docs |
| `simplify-planning` | Three-pass review of epics, features, stories — status, scope hygiene, canon compliance |
| `session-archaeology` | Mine Claude Code session logs — find which subsystems cause most agent confusion |
| `codex` | Delegate to OpenAI Codex CLI — analysis, implementation, review modes |

---

## Find + Surface — Discovery / Search

| Skill | What it does |
|---|---|
| `backroom-log-explorer` | Search 662 Backrooms session logs (57MB) — extract ASCII art, themes, dialogue, metadata |
| `qmd` | Search markdown knowledge bases and docs using QMD |
| `find-skills` | Discover and install new pi agent skills |

---

## Shape Output — Communication / Writing

| Skill | What it does |
|---|---|
| `frontend-design` | Build distinctive production-grade web UI — avoids generic AI aesthetics |
| `sharpen-output` | Take any output and make it maximally effective — iterative intent extraction |
| `planning-update` | Update .planning after completing work — tick checkboxes, sync status, commit |

---

## Duplication + Location Notes

`chiptune` and `chiptune-studio` are two slightly different entry points to the same toolkit — `.agents/skills/chiptune` (BRICKS + COVER workflows) vs `.pi/skills/chiptune-studio` (raw primitives layer). Use the `.agents` one as the entry point.

`codex` exists twice — `.agents/skills/codex` (wibwob-specific, three modes) and `~/.agents/skills/codex` (generic). Both work; the wibwob one has project-specific context.

Skills in `wibwobdos-vps/.pi/skills/` and `wibwobdos-vps/.agents/skills/` are mirrors of the main repo. Don't edit there — edit in `wibandwob-dos`.

---

## Most Slept-On

Skills that exist, work, and almost never get used:

- `session-archaeology` — genuinely useful for understanding where agent sessions go wrong
- `composable-engines` — powerful if you want to remix window engines into new surfaces
- `backroom-log-explorer` — 662 sessions of Wib & Wob raw creative output, barely touched
- `michel-gondry-music-video-director` — a whole directorial lens sitting idle
