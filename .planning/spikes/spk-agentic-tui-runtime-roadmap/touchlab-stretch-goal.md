---
id: spk-agentic-tui-runtime-roadmap-touchlab-stretch-goal
title: TouchLab Stretch Goal
status: in-progress
created: 2026-03-08
depends_on: [spk-agentic-tui-runtime-roadmap, spk-agentic-tui-runtime-roadmap-patchbay-lab-build]
---

# TouchLab Stretch Goal

## Intent

TouchLab should be a second microapp, not part of Patchbay Lab.

Patchbay proves the SDK coverage harness and nested-panel direction. TouchLab
should instead prove a more radical creative runtime idea: a terminal-native
operator workspace with freely draggable nested floating windows inside one
parent TouchLab window, closer in spirit to TouchDesigner, Max/MSP, or Pure
Data than to a normal desktop app.

## Core proposition

Build a local multi-stage ASCII pipeline inside one parent TouchLab surface:

- nested floating subwindows inside the TouchLab window
- visible links/arrows between stages
- one stage can transform or combine output from another
- the whole arrangement remains semantically stateful and commandable

## Candidate first pipeline

### Window A — generator

- generative pattern source
- likely contour/generative art derived from existing app primitives

### Window B — primer/text source

- selected primer or text-derived source window
- could provide mask text, texture text, or semantic source material

### Window C — webcam avatar source

- webcam tracking input
- use Google MediaPipe to detect face position
- convert detected face position into a simple moving ASCII smiley-face avatar
- the smiley should move within the ASCII webcam window to correspond to the
  tracked human face position

### Window D — blended output

- combine generator output, primer influence, and webcam/avatar position
- examples:
  - overlay smiley avatar on generative terrain/pattern field
  - let primer text modulate density, mask, or symbol choice
  - use webcam position to steer composition or blend region

## Why this matters

If TouchLab works, it proves the SDK/runtime stack can handle:

- nested floating windows inside one app
- creative pipelines rather than isolated surfaces
- transform relationships between windows
- visible connection affordances
- live non-text input feeding an ASCII output pipeline
- composition rich enough for future VJ/screensaver/art runtime work

## Stretch technical goals

- [ ] Add a nested floating-window model inside one microapp canvas
- [ ] Support drag/move of nested subwindows
- [ ] Add visible ASCII arrows or labels between linked stages
- [ ] Add one generator stage from existing generative primitives
- [ ] Add one primer/text stage from existing content primitives
- [ ] Add one webcam-tracking stage using MediaPipe-based face position
- [ ] Convert face position into a moving ASCII smiley avatar in-window
- [ ] Add one blended-output stage combining the three inputs
- [ ] Surface all stage state through `describeState()`
- [ ] Keep the whole pipeline inspectable and commandable via registry/API

## Next MVP sprint

- [~] Prove real nested mouse dragging end to end
- [x] Add nested resize behavior with keyboard fallback and corner grips
- [x] Add visible ASCII arrows or link labels between source nodes and the mix node
- [x] Add one selected-node inspector / parameter strip inside the parent window
- [x] Allow changing at least one per-node visual parameter live
      example: title color, body fg/bg, or border color
- [x] Add one more transformation mode beyond plain overwrite composition
      example: mask, max-density, xor-ish glyph preference, or tint priority
- [x] Restore controlled motion on the generator layer with an explicit pause toggle
- [x] Expose selected node + per-node visual params in `describeState()`

Design note:
- use a TouchDesigner-style parameter inspector first, not a floating text-input
  flyout
- canonical interaction should be:
  select node -> inspect parameters -> tweak -> see output change live
- current MVP keeps the inspector permanently visible, with `i` collapsing it to a
  slim sliver rather than hiding it entirely
- current MVP now includes clickable FG/BG palette swatches inside the inspector

## Architectural implications

TouchLab likely requires seams that Patchbay only hints at:

- reusable nested panel/window chrome primitive
- local z-order and focus model inside one microapp
- local connection-graph model
- richer data-passing contracts between windows/operators
- better handling of non-keyboard inputs as first-class runtime sources

## Recommendation

Do not start TouchLab before:

- Patchbay remains stable as the simpler proving app
- module runtime / reload direction is clearer
- nested panel/window chrome has at least one reusable primitive path

TouchLab should be treated as a major proving ground for the future creative
runtime, not as an opportunistic feature branch.
