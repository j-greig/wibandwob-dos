---
id: spk-agentic-tui-runtime-roadmap-p3-touchlab-mvp
title: P3 TouchLab MVP Build
status: in-progress
created: 2026-03-08
depends_on: [spk-agentic-tui-runtime-roadmap, spk-agentic-tui-runtime-roadmap-touchlab-stretch-goal]
---

# P3 TouchLab MVP Build

## Goal

Build the smallest believable composition proof:

- one parent microapp window
- three draggable nested source windows inside it
- one nested output window that composites the three sources

This is a quick sprint, not the full TouchLab stretch goal.

## Scope

- nested floating subwindows inside one parent window
- mouse-drag on subwindow title bars
- three simple source surfaces
- one composite surface fed by the three sources
- semantic state describing positions and current pipeline text

## Acceptance Checklist

- [x] Scaffold `modules/touchlab-mvp`
- [x] Open one parent `TouchLab MVP` window
- [x] Render four nested subwindows inside the parent canvas
- [~] Make at least three nested source subwindows draggable by mouse
- [x] Pipe three ASCII sources into one composite output subwindow
- [x] Surface nested-window positions via `describeState()`
- [x] Surface composite text summary via `describeState()`
- [x] Provide at least one direct command that opens the app
- [x] `bun run typecheck`
- [x] restart
- [x] screenshot

## Simplifications

- no formal `WindowPort` model yet
- no control API link/unlink routes yet
- no responsive reflow yet
- no webcam stage yet
- no preserved nested layout persistence yet

## Blockers / downgrade rule

If true mouse dragging cannot be made reliable within three fix attempts:

- keep the four nested windows
- downgrade movement to keyboard nudging
- record mouse dragging as blocked rather than stalling the whole `P3` proof

## Current proof note

- nested movement is verified through window input (`h/j/k/l`) and reflected in
  `/state` plus screenshots
- mouse-drag wiring is implemented on nested title bars, but this sprint has
  not yet automated a trustworthy mouse-drag verification path
