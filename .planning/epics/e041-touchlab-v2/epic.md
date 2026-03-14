---
id: e041
title: "TouchLab v2 — TouchDesigner for ASCII Art"
status: in-progress
started: 2026-03-14
---

# E041 — TouchLab v2: TouchDesigner for ASCII Art

## Vision

TouchDesigner for terminal art. A composable visual signal lab where
figlet typography, ASCII primers, terrain generators, contour fields,
skeleton dancers, wave patterns, and noise fields are all patchable
sources that feed through transforms and blend into composite outputs.

The MVP proved nested draggable nodes with ASCII composition. V2 makes
it a real creative tool by connecting it to the rich visual primitives
WibWob-DOS already has: figlet rendering, terrain maps, contour players,
skeleton animation, grid-canvas painting, webcam cells, tween/motion,
and the full theme token palette.

The autoresearch loop optimises the visual richness and interaction
quality of the lab, scored by a UI/UX rubric (same pattern as plasma,
asciicker, terrain-lab autoresearch sessions).

## Existing Visual Primitives to Wire In

These all exist in the SDK today. TouchLab v2 turns them into patchable
source/transform nodes:

| Primitive | SDK export | What it gives you |
|-----------|-----------|-------------------|
| Figlet typography | `figlet-service.ts`, `createFigletDisplay` | Big text rendered through 200+ fonts |
| Terrain maps | `createTerrainMap`, `renderTerrainMap` | Procedural ASCII landscapes |
| Contour fields | `createContourPlayer` | Animated topographic contour lines |
| Skeleton dancer | `renderSkeletonAt`, `landmarksFromPreset` | Stick figure poses and dance cycles |
| Grid canvas | `blankGrid`, `paintText`, `paintCentered`, `drawArrow`, `waveLine`, `bar` | Low-level 2D ASCII drawing |
| ASCII composition | `composeAsciiLayers`, `renderAsciiTextBlock` | Layer blending (overwrite/mask) |
| Live player | `createEmbeddedLivePlayer`, `createLivePlayer` | Tick-driven animation loop |
| Webcam renderer | `renderWebcamFrame`, `gridToBlessedContent` | Camera-to-ASCII pipeline |
| Motion/tween | `tween`, `EASINGS` | Smooth value animation |
| Primer content | ContentService, primer gallery | Load any ASCII art file as source |

## Current MVP State

~500 lines in `modules/demo-touchlab-mvp/index.ts`:
- 4 hardcoded nodes: GEN (waveform), TEXT (phrase), INPUT (typed), MIX (composite)
- `composeAsciiLayers` with overwrite/mask blend
- Mouse drag + resize grips on nested node windows
- Inspector panel with theme colour palette per node
- Arrow overlay showing source-to-mix connections
- Embedded live player for GEN animation at 6fps

## What V2 Delivers

### F1: Source Node Library
Wire the existing visual primitives as selectable source types.
Each node gets a "source type" picker. Available generators:

- **wave** (existing) — sinusoidal waveform
- **figlet** — render text through a figlet font (font picker, phrase input)
- **terrain** — procedural ASCII terrain (terrain type picker, seed control)
- **contour** — animated contour field
- **skeleton** — stick figure in a pose (pose picker, or dance cycle)
- **noise** — random character field (density, charset controls)
- **primer** — load any primer/ASCII art file as static or scrolling source
- **lissajous** — parametric curves in ASCII
- **cellular** — 1D cellular automata (rule picker)
- **plasma** — plasma-style colour field (if ANSI colour in compose)
- **bars** — level meter / VU bars
- **text** (existing) — phrase rendering

### F2: Transform Nodes
New node role: transform. Sits between source and output.

- **mirror** — horizontal/vertical flip
- **scroll** — auto-scroll content in a direction
- **threshold** — convert to binary (space vs block char)
- **crop** — extract subregion
- **tile** — repeat source to fill area
- **glitch** — random line displacement, char substitution
- **fade** — distance-based character density falloff
- **invert** — swap filled/empty characters

### F3: Richer Blend Modes
Expand beyond overwrite/mask:

- **add** — overlay non-space chars from both layers
- **xor** — show char only where one layer has content
- **difference** — use different char where both have content
- **screen** — lighter chars win
- **multiply** — denser chars win

### F4: Node Graph Topology
- Arbitrary routing (not just 3-to-1)
- Multiple output nodes
- Chain nodes: source -> transform -> transform -> output
- Visual connection lines follow the routing graph
- Click-to-connect: select output port, click input port

### F5: Interaction and Feel
- Snap-to-grid toggle
- Node duplication (clone with settings)
- Preset layouts (split screen, cascade, grid)
- Better resize feedback (dimensions shown while dragging)
- Tab to cycle through nodes
- Node minimap in inspector when many nodes open
- Keyboard shortcut cheat sheet overlay

### F6: Live Performance Features
- BPM sync for animated sources (global clock)
- Source parameter automation (tween a value over time)
- Randomise button per source (new seed/phrase/pose)
- Full-screen output mode (hide chrome, just show mix)

## Autoresearch Loop Design

### Metric: `ui_score` (higher is better)

Same rubric pattern as plasma/asciicker/terrain-lab sessions. Score 1-10
across axes, primary metric is the average:

- **VISUAL RICHNESS** — variety and quality of visual output
- **INTERACTIVITY** — how responsive and discoverable controls are
- **COMPOSITION** — does the node graph produce interesting combinations?
- **CRAFT** — code quality, architecture, use of existing SDK primitives
- **SURPRISE** — does it do something unexpected or delightful?

### Loop Strategy

1. Baseline: screenshot current MVP, score it
2. Add source types one at a time (figlet first — highest visual impact)
3. Add transform nodes (glitch + mirror first — most dramatic)
4. Expand blend modes
5. Polish interaction (snap, tab-cycle, presets)
6. Each iteration: make change, screenshot, score, log

### Measurement Command

```bash
# Screenshot the running TouchLab window, score via LLM rubric
./scripts/screenshot-window.sh "TouchLab" > /tmp/touchlab-screenshot.txt
# Score with rubric (same pattern as other autoresearch sessions)
```

## Acceptance Criteria

- [ ] At least 6 source types wired from existing SDK primitives
- [ ] At least 3 transform node types
- [ ] At least 3 blend modes beyond overwrite/mask
- [ ] Arbitrary node routing (not hardcoded 3-to-1)
- [ ] Figlet typography as a source node
- [ ] Primer/ASCII art loading as a source node
- [ ] Terrain generator as a source node
- [ ] ui_score reaches 8.0+ in autoresearch loop
- [ ] Stable 10fps+ with 6 active nodes

## Stories

- [ ] S1: Autoresearch baseline — instrument, measure, score MVP
- [ ] S2: Source node library — figlet, terrain, contour, skeleton, noise
- [ ] S3: Transform nodes — mirror, scroll, glitch, threshold
- [ ] S4: Blend mode expansion — add, xor, difference
- [ ] S5: Node graph topology — arbitrary routing, connection editor
- [ ] S6: Interaction polish — snap, tab-cycle, presets, fullscreen output
- [ ] S7: Live performance — BPM sync, parameter automation, randomise
