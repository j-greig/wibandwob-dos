---
id: spk-agentic-tui-runtime-roadmap-patchbay-lab-build
title: Patchbay Lab v1 Build
status: in-progress
created: 2026-03-08
depends_on: [spk-agentic-tui-runtime-roadmap, spk-agentic-tui-runtime-roadmap-sdk-proving-app-shortlist]
---

# Patchbay Lab v1 Build

## Goal

Build the first real SDK coverage harness as a microapp module using the
current microapp SDK, without waiting for runtime reload or connection-graph
work.

## Scope

Patchbay Lab v1 should prove:

- one real module can be built entirely against the current SDK path
- the current SDK is sufficient for a composed control-room style app
- helper windows can be spawned and tracked by one microapp
- semantic state and snapshot support are usable for a richer app
- world chat, terrain, animation, and layout primitives can coexist in one app

## Acceptance Checklist

- [x] Scaffold `modules/patchbay-lab`
- [x] Register open command and menu/palette entry
- [x] Build one main Patchbay Lab window
- [x] Compose the main window using SDK layout primitives
- [x] Add a mode button bar for at least three views
- [x] Add one terrain bench using SDK terrain helpers
- [x] Add one animation bench using `createAnimatedPanel`
- [x] Add one chat bench using `host.worldChat`
- [x] Add one nested primer gallery subview with internal tab bar and picker
- [x] Add one state/inspector pane driven by semantic state
- [x] Add helper-window spawn/close controls and ownership tracking
- [x] Add snapshot save/restore for the main Patchbay Lab window
- [x] Add `describeState()` and `captureText()`
- [x] Record any SDK friction discovered while building v1
- [x] `bun run typecheck`

## Non-goals

- [ ] No module hot reload implementation in this story
- [ ] No formal window connection graph in this story
- [ ] No persistent agent memory system in this story
- [ ] No multi-agent roster UI in this story

## Known likely friction

- composed layouts still lean on raw Blessed nodes at the edges
- helper-window ownership is app-local rather than runtime-modeled
- chat interaction primitives are service-shaped, not yet connection-graph-shaped
- input/editing affordances are still primitive for richer notes or patch text

## SDK Friction Discovered

- terrain-heavy surfaces can flood `/state` if `contentPreview` mirrors the
  rendered text too literally; semantic previews need to stay concise while
  `captureText()` carries the heavy output
- helper-window ownership is still module-local bookkeeping rather than a
  runtime-owned concept
- richer patchbay-style note editing still falls off the current primitive edge
  because the SDK does not yet expose a comfortable composable input surface
- nested gallery composition still leans on raw Blessed boxes inside one custom
  surface part; it works, but it shows where higher-order SDK sublayout helpers
  would reduce hand wiring

## Patchbay v2 Stretch Goal

Patchbay v2 should evolve from a coverage harness into a terminal-native
operator graph more akin to TouchDesigner, Max/MSP, or Pure Data: multiple
windows acting as chained transformation stages rather than isolated apps.

### Intent

Use one concrete creative pipeline to pressure the still-untouched seams:

- linked multi-window composition
- explicit arrows or visible connection overlays
- data passing between windows
- SDK-compatible reuse of older app primitives
- richer transform chains for creative and VJ-like workflows

### Candidate pipeline

- `Window A — source generator`
  example: contour/generative pattern surface
- `Window B — text or primer source`
  example: selected primer or text-derived mask/source
- `Window C — blended output`
  example: ASCII composite, mask, overwrite, warp, dither, or contour-informed
  remix

### V2 target behaviors

- [ ] Spawn the three-window pipeline from Patchbay
- [ ] Make each stage semantically stateful via `describeState()`
- [ ] Show explicit source/transform/output roles in window metadata
- [ ] Add visible ASCII arrows or labels linking the stages
- [ ] Add one simple blend operator that combines generator output and primer
      content
- [ ] Keep the whole pipeline commandable through the registry/API
- [ ] Use the pipeline as an excuse to migrate or align older app primitives
      toward the SDK path where useful

### Why this matters

- it becomes the first concrete proof of the future connection graph
- it turns "window as app" into "window as operator"
- it aligns directly with the art/VJ/screensaver ambition
- it pressures the SDK toward reusable transforms rather than isolated demos
