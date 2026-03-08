---
id: spk-agentic-tui-runtime-roadmap-agentic-devlog
title: Agentic Devlog
status: in-progress
created: 2026-03-08
updated: 2026-03-08
depends_on: [spk-agentic-tui-runtime-roadmap]
---

# Agentic Devlog

Canonical place to record what it feels like to build against the live WibWob-DOS runtime as an agent.

Rules:
- Log friction the first time it is clearly real.
- If the same thing fails three times, record it even if not yet fixed.
- If a fix is found, record both the failure mode and the winning approach.
- Prefer concrete notes tied to scripts, APIs, or runtime surfaces over vague complaints.

## Current Notes

### 2026-03-08 — Patchbay, reload, TouchLab MVP

- `tmux` plus `./scripts/screenshot-window.sh` is the most useful visual verification loop right now.
  Why:
  - screenshot crops are much easier to read than full-pane captures
  - `tmux send-keys` is the only reliable way to prove real keyboard behavior end to end
  Keep:
  - `tmux attach -t wibwob`
  - `tmux send-keys -t wibwob:0 ...`
  - `./scripts/screenshot-window.sh "Window Title"`

- `/state` is essential and high-value.
  Why:
  - it gives a semantic proof path separate from visual proof
  - it made it easy to see selected node, positions, blend mode, and color labels
  Gap:
  - for richer microapps, `/state` should expose more focused app-local state without requiring screen scraping

- `/windows/input` is useful, but it is not sufficient for proving real interactive behavior by itself.
  Why:
  - it injects logical input into a window record
  - it does not prove Blessed key focus, global key routing, or mouse behavior
  Result:
  - agent work still needs `tmux send-keys` to prove actual keyboard UX

- Missing nested mouse automation path.
  Why this matters:
  - nested draggable/resizable panes can be implemented in Blessed
  - but there is no agent-facing API to synthesize mouse down/move/up inside a parent window surface
  Consequence:
  - nested drag/resize can be built, but cannot be robustly smoke-tested by an agent
  Winning approach so far:
  - route nested drag/resize off the generic `screen.on("mouse")` stream and inspect
    `data.action`, matching the top-level window manager path
  Wishlist:
  - `POST /windows/mouse` with `id`, `action`, `x`, `y`, maybe `button`
  - or a higher-level `POST /windows/gesture/drag`

- Runtime reload proof needed text-visible changes, not just color changes.
  Failure mode:
  - color changes are hard to prove in pane captures
  Winning approach:
  - use title/body text plus `/state`
  Outcome:
  - keep color-based proof as secondary, never primary

- Loader stdout scribble was a real TUI failure mode.
  Failure mode:
  - module loader logs printed into the live terminal surface and overwrote the UI
  Fix:
  - move loader lifecycle messages onto file logging instead of stdout
  Principle:
  - any runtime/service logging that can hit the same tty as Blessed should be treated as a UI corruption risk

- Restart is required after runtime wiring changes, but not after pure module edits.
  Friction:
  - easy to forget whether a change is “runtime machinery” or “microapp source”
  Improvement idea:
  - add a script or note that classifies edits into:
    - reload-safe
    - restart-required

- TouchLab exposed a real distinction between:
  - semantic control input
  - actual focused-user input
  Fix:
  - handle screen-level keypress only when the TouchLab window is focused
  Lesson:
  - agent-proofed `/windows/input` should not be mistaken for end-user UX proof

- Multi-character input over `/windows/input` needs explicit app-level handling.
  Failure mode:
  - payloads like `3hello` were interpreted as a sequence of command tokens and text in an awkward way
  Fix:
  - select the input node with the first token, then treat the rest as text payload when appropriate
  Wishlist:
  - an explicit app-control route for structured input would be cleaner than overloading character streams

- Nested app panes should reuse desktop-window concepts, but not clone the whole outer window manager blindly.
  Current useful reuse:
  - title bar
  - border
  - focus styling
  - resize grip
  - move/resize semantics
  Missing canon:
  - a shared nested chrome primitive for microapps
  Recommendation:
  - extract a `panel chrome` / nested-window primitive later instead of hand-rolling every microapp

- Inspector/palette visibility should stay persistent by default.
  Observation:
  - a TouchDesigner-style always-visible parameter area was easier to use than a hidden flyout
  Good compromise:
  - persistent panel with a slim collapsed mode

- Animation should be explicit, local, and pausable.
  Failure mode:
  - global ticking made unrelated values change every second and made the app feel broken
  Fix:
  - restore motion only on the generative layer
  - keep text/input sources stable unless deliberately edited
  - add a pause toggle (`Space`)
  Lesson:
  - motion is important for creative feel, but it must not mutate semantic controls invisibly

## Proposed Follow-ons

- [ ] Add a `nested interaction smoke` script that can at least prove keyboard move/resize/focus for nested panes
- [ ] Add a `POST /windows/mouse` API for click/drag/release automation
- [ ] Add a `reload-safe vs restart-required` helper or docs note for agent workflows
- [ ] Add a shared nested panel/window chrome primitive so microapps stop reimplementing border/title/grip/focus
- [ ] Add structured app-control endpoints or conventions for richer inputs than raw key streams
