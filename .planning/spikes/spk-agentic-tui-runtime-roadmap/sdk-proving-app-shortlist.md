---
id: spk-agentic-tui-runtime-roadmap-sdk-proving-app-shortlist
title: SDK Proving App Shortlist and Recommended Coverage Harness
status: in-progress
created: 2026-03-08
depends_on: [spk-agentic-tui-runtime-roadmap]
---

# SDK Proving App Shortlist and Recommended Coverage Harness

## Purpose

Capture the ranked shortlist of candidate apps to build against the emerging
microapp SDK so the next proving implementation is chosen deliberately for
coverage, not novelty.

This doc exists as a sibling artifact to the main runtime roadmap so future
agents can reuse the evaluation without excavating chat history.

## Current SDK Coverage Target

The proving app should exercise as much of the current SDK and host surface as
possible:

- `createWindow`
- `registerCommand`
- `registerSnapshot`
- layout primitives:
  `createStack`, `createColumns`, `createHeaderBar`, `createStatusBar`,
  `createTextBlock`, `createRule`, `createButtonBar`, `createAnimatedPanel`,
  `createNodePart`, `applyRect`
- animation helpers:
  `createContourPlayer`, `createLazyMountedPlayer`, `AnimatedPanelPlayer`
- terrain helpers:
  `createTerrainMap`, `getTerrainFocusPoint`, `createSavedTerrainArtifact`,
  `renderTerrainMap`, `findTerrainPeak`, `terrainNames`
- host capabilities:
  `theme()`, `geometry`, `worldChat`, semantic window state via
  `describeState()` and `captureText()`
- multi-window behavior:
  spawning helper windows, coordination, and later reload compatibility

## Ranked Shortlist

### 1. Patchbay Lab

Covers the most surface area with the least fake-demo energy. Think Max/MSP for
WibWob-DOS: a canvas-like control room with panels for commands, world chat,
terrain/animation preview, layout presets, and spawned linked windows. It can
exercise:

- `createWindow`, `registerCommand`, `registerSnapshot`
- `createStack`, `createColumns`, `createHeaderBar`, `createStatusBar`,
  `createTextBlock`, `createRule`, `createButtonBar`, `createAnimatedPanel`,
  `createNodePart`
- `createContourPlayer`, `createLazyMountedPlayer`, terrain helpers,
  `worldChat`
- agent-facing state via `describeState()` and `captureText()`
- multi-window coordination, which is the real missing frontier

Why rank `#1`:

- max coverage
- directly aligned with the connected-windows / creative-patching goal
- exposes SDK gaps fast
- good benchmark for hot reload later

Coverage score: `10/10`

### 2. Microapp Workbench

A builder/debugger microapp for agents: left pane = scaffold/templates, center
= live preview, right pane = state/command/snapshot inspector. It can spawn
preview windows and log friction while building modules.

Why rank `#2`:

- best for agentic authoring workflow
- ideal for testing docs + affordances + scaffold path
- slightly less creative and less multi-window-native than Patchbay Lab

Coverage score: `9/10`

### 3. Symbient Studio

A multi-agent desktop surface with roster, event feed, shared notes, and small
satellite windows for each symbient. Good for testing identity/presence,
authored-by metadata, memory concepts, and inter-agent coordination.

Why rank `#3`:

- strategically important
- directly tests the symbient vision
- risks becoming premature product design before the runtime seams are ready

Coverage score: `8/10`

### 4. Screensaver Composer

A scene sequencer that spawns, resizes, and reflows windows, swaps
arrangements, and drives animated micro-surfaces over time. Strong for layout,
animation, presets, workspace restore, and future mobile/reflow thinking.

Why rank `#4`:

- useful and on-brand
- good for art-gallery mode
- weaker for command/API coverage than Patchbay Lab or Microapp Workbench

Coverage score: `7/10`

### 5. World Console

A combined `wibwobworld + world-chat + poetry-clock + event-log` orchestration
app with mini sidecars. Strong brownfield proof, but narrower than Patchbay
Lab.

Why rank `#5`:

- practical
- easier to build quickly
- lower coverage of the general-purpose SDK composition problem

Coverage score: `6/10`

## Recommendation

Build **Patchbay Lab** first.

It should be explicitly designed as the coverage harness for the SDK, not just
as a product feature. Each pane or spawned helper window should correspond to
one current capability family:

- `Commands` pane:
  run registered actions and log outcomes
- `State` pane:
  show selected window `describeState()` output
- `Layout` pane:
  exercise stack/columns/button-bar/rules/headers/status composition
- `Animation` pane:
  exercise contour and lazy-mounted players
- `Terrain` pane:
  exercise terrain model/render helpers
- `Chat` pane:
  exercise `worldChat` subscribe/send/join
- `Windows` pane:
  spawn linked helper micro-windows and arrange them
- `Snapshot` pane:
  prove save/restore behavior
- `Agent Notes` pane:
  temporary note/log surface now; later candidate hook for memory/event work

## Patchbay Lab Spec

### Intent

Patchbay Lab should function as the canonical SDK coverage harness: one app
that quickly reveals whether the current SDK is ergonomic enough for humans and
agents to build creative, connected, reloadable microapps.

### Core behaviors

- open as a single main control-room window
- spawn satellite helper windows for targeted capability tests
- make internal state visible and agent-readable through `describeState()`
- expose compact controls through button bars and command registration
- support snapshot save/restore so the proving surface itself is persistent
- keep at least one animated surface and one world-chat surface active
- produce obvious friction notes when an SDK seam feels awkward

### Minimum pane set

- `Command Deck`
  lists supported actions and triggers module-local commands
- `Layout Playground`
  uses stack/columns/rules/header/status/button bar in one composed layout
- `Animation Bench`
  plays contour-driven or lazy-mounted animation surfaces
- `Terrain Bench`
  renders terrain views and artifacts using SDK terrain helpers
- `Chat Bench`
  joins a world chat channel, subscribes to updates, and shows transport state
- `Window Deck`
  spawns, focuses, and closes helper windows owned by the app
- `State Inspector`
  shows the app's own semantic state and selected helper-window metadata

### What it proves

If Patchbay Lab works well, then the SDK is good enough for:

- agent-authored microapps
- multi-window linked compositions
- creative and live surfaces
- future hot reload work
- future symbient orchestration

If it feels awkward to build, the awkwardness will be highly diagnostic rather
than hidden.

## Suggested build order inside the app

- [ ] Create the main Patchbay Lab window with command registration
- [ ] Add the composed layout shell using current SDK primitives
- [ ] Add one animated pane using `createAnimatedPanel`
- [ ] Add one terrain pane using SDK terrain helpers
- [ ] Add one chat pane using `host.worldChat`
- [ ] Add one helper-window launcher and ownership tracking
- [ ] Add snapshot support
- [ ] Add semantic state reporting and text capture
- [ ] Record friction notes back into the main roadmap spike

## Selection Summary

If the goal is **maximum SDK coverage**, choose `Patchbay Lab`.

If the goal is **best agent-author workflow**, choose `Microapp Workbench`.

If the goal is **earliest symbient/product expression**, choose
`Symbient Studio`.

Current recommendation remains: `Patchbay Lab` first.
