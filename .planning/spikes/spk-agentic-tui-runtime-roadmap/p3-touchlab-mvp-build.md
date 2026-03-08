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

## Acceptance Checklist

- [x] Scaffold `modules/touchlab-mvp`
- [x] Open one parent `TouchLab MVP` window
- [x] Render four nested subwindows inside the parent canvas
- [~] Make at least three nested source subwindows draggable by mouse
- [x] Make nested subwindows resizable with keyboard fallback
- [x] Pipe three ASCII sources into one composite output subwindow
- [x] Add visible ASCII arrows or link labels between sources and the output
- [x] Add one selected-node inspector / parameter strip inside the parent window
- [x] Allow changing per-node `fg` and `bg` live
- [x] Add one text-input source node
- [x] Restore visible motion without reintroducing uncontrolled state churn
- [x] Surface nested-window positions via `describeState()`
- [x] Surface selected node + colors + blend mode via `describeState()`
- [x] Provide at least one direct command that opens the app
- [x] `bun run typecheck`
- [x] restart
- [x] screenshot

## Simplifications

- [x] No formal `WindowPort` model yet
- [x] No control API link/unlink routes yet
- [x] No responsive reflow yet
- [x] No webcam stage yet
- [x] No persistence yet

## Downgrade rule

If true mouse dragging cannot be made reliable within three fix attempts:

- keep the four nested windows
- keep keyboard nudging as the proof path
- record mouse dragging as blocked rather than stalling the sprint

## Verification Notes

- [x] Keyboard/API proof path works: `1/2/3/4`, `h/j/k/l`, `[`/`]`, `-`/`=`, `b`
- [x] Keyboard resize fallback works: `,` `.` `n` `m`
- [x] Animation is back on the generative layer, with `Space` pausing it
- [x] `/state` reflects node positions, selected node, blend mode, and color labels
- [x] screenshot proves nested windows, arrows, inspector, and composite output
- [~] Mouse dragging is implemented on nested title bars, but automated proof is still missing because the control API has no nested mouse-event route
- [x] Inspector is persistent and TouchDesigner-like by default, with `i` to collapse it to a slim parameter sliver
- [x] Inspector includes clickable FG/BG palette swatches tied to theme-token labels
