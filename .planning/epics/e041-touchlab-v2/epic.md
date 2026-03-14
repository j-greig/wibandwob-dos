---
id: e041
title: "TouchLab v2 — TouchDesigner for ASCII Art"
status: in-progress
started: 2026-03-14
---

# E041 — TouchLab v2: TouchDesigner for ASCII Art

## Vision

TouchDesigner for the terminal. A node-based visual composition lab where
every signal is ASCII text, every transform operates on character grids,
and the entire WibWob-DOS desktop is both the canvas and a patchable
signal source.

The key insight: WibWob-DOS already has a rich library of visual
primitives (figlet, terrain, contour, skeleton, primers, webcam) and a
CLI that can capture any window's output as text. TouchLab v2 wires all
of that into a node graph where sources generate, transforms modify,
compositors blend, and channel operators automate parameters over time.

The recursive angle: the CLI captures window output. TouchLab consumes
that output as a source node. TouchLab's own output can be captured by
the CLI. The desktop becomes a modular synth that feeds on itself. The
FX scripts (lava-lamp, kaleidoscope, tui-acid, liquid-shear) already
prove the concept in shell scripts. TouchLab v2 makes it interactive,
visual, and real-time.

## The Five Operator Families

Modelled on TouchDesigner's operator taxonomy, translated to ASCII.

### 1. GEN ops — generators (create signal from nothing)

Each generator is a function `(width, height, tick, params) -> string[][]`
that fills a grid. Every generator exposes 2-3 tweakable knobs.

| Generator | SDK primitive | Knobs |
|-----------|--------------|-------|
| wave | `waveLine` from grid-canvas | frequency, amplitude, charset |
| figlet | `renderFiglet`, `responsiveFiglet` (200+ fonts) | font, text, width |
| terrain | `createTerrainMap` + `renderTerrainMap` | terrain type, seed, camera pan |
| contour | `renderContourFromHills` | seed, nLevels, mode (chaos/order/hybrid) |
| skeleton | `renderSkeletonAt` + `POSE_PRESETS` | pose, auto-dance toggle |
| noise | (new) random char field | density, charset, seed |
| cellular | (new) 1D elementary automata | rule (30/90/110), seed row |
| primer | ContentService file load | file path, scroll offset |
| capture | `captureText(windowId)` via control API | target window ID, poll rate |
| bars | `bar` from grid-canvas | levels array, label |
| lissajous | (new) parametric curves | a, b, delta, char |
| text | `renderAsciiTextBlock` | phrase, alignment |

The CAPTURE generator is the recursive bridge. It grabs live text output
from any other running window (plasma, asciicker, glitchbox, another
touchlab, the chat window, anything) and pipes it into the node graph
as a source. Every window becomes a patchable oscillator.

### 2. XFORM ops — transforms (modify a signal)

Each transform reads one input grid, outputs one grid.
`(grid, tick, params) -> grid`

| Transform | What it does |
|-----------|-------------|
| scroll | shift content by (dx, dy) per tick, wrap or clamp |
| mirror | flip horizontal, vertical, or both |
| feedback | blend current frame with previous at reduced intensity using char decay ladder: `█ -> ▓ -> ▒ -> ░ -> · -> space`. Creates trails, echoes, ghosts. This is the single most important transform — TouchDesigner's Feedback TOP creates 90% of interesting visuals |
| displace | use density of grid A to shift positions in grid B |
| threshold | binary: above density = `█`, below = space |
| remap | charset swap: define source->target char mappings |
| crop | extract subregion |
| tile | repeat source to fill area |
| glitch | random line displacement, char substitution (same as smear.py --mode glitch) |
| shear | horizontal skew per row (same as smear.py --mode shear) |
| invert | swap filled/empty characters |
| fade | distance-based density falloff from a centre point |

The glitch and shear transforms are the same operations the FX shell
scripts use (lava-lamp.sh, liquid-shear.sh, tui-acid.sh, kaleidoscope.sh)
but running per-frame inside the node graph instead of via CLI capture
loops.

### 3. COMP ops — compositors (combine multiple signals)

Each compositor takes N input grids and produces one output grid.
`(grids[], params) -> grid`

| Compositor | Behaviour |
|-----------|-----------|
| layer | front occludes back (existing overwrite mode) |
| mask | one grid controls where another is visible (existing) |
| add | non-space chars from all layers coexist |
| multiply | denser char wins |
| difference | show char only where layers disagree |
| xor | show char only where exactly one layer has content |
| crossfade | interpolate between two sources via density parameter (0.0 = all A, 1.0 = all B) |

### 4. CHOP ops — channel operators (control signals over time)

NOT visual grids. Parameter streams that drive generator/transform knobs.
Each CHOP outputs a float 0-1 that can be wired to any knob.

| CHOP | Output |
|------|--------|
| LFO | sine/triangle/saw/square oscillator. Wire to any knob: terrain slowly pans, figlet font cycles, contour levels breathe |
| noise | smooth Perlin-style random value stream |
| beat | pulse on BPM divisions (whole, half, quarter, eighth). Rhythmic parameter changes |
| envelope | ADSR shape, triggered by beat or manual keypress |

CHOPs are what make it feel alive. Without them the node graph is
static. With them every parameter is in motion.

### 5. PATCH — the node graph itself

Every node is a draggable sub-window inside TouchLab. Connections
are data, not decoration.

| Feature | Detail |
|---------|--------|
| arbitrary routing | any output to any input, not hardcoded 3-to-1 |
| chain topology | GEN -> XFORM -> XFORM -> COMP -> output |
| fan-in | multiple GENs into one COMP |
| fan-out | one GEN into multiple XFORMs |
| click-to-connect | click output port on node A, click input port on node B |
| connection overlay | wires drawn on grid-canvas following the routing graph |
| node types | visual: coloured by family (GEN=green, XFORM=yellow, COMP=blue, CHOP=magenta, OUT=white) |

## The Recursive Desktop

The CLI already enables this (CREATIVE_PIPES.md proves it):

```
wibwob screenshot | smear --mode glitch | wibwob primer.open
```

TouchLab v2 internalises this loop. The CAPTURE generator does
`captureText(windowId)` every tick. The whole desktop is signal.

Concrete scenarios:

- Plasma window output feeds through a threshold transform into a
  mask compositor that reveals figlet text only where plasma is dense
- Asciicker's 3D terrain captured live, fed through feedback decay,
  composited with a contour field — the game world leaves ghostly
  trails as the camera moves
- GlitchBox skeleton dancers captured and tiled 4x, each copy
  sheared at different angles — a kaleidoscope of stick figures
- TouchLab's own MIX output captured by a second TouchLab instance,
  fed through glitch transform — recursive self-observation
- The Wib&Wob chat window captured as source, text scrolls through
  a figlet font renderer, composited over terrain — conversation
  becomes landscape

The FX shell scripts (lava-lamp, kaleidoscope, tui-acid, pinball,
liquid-shear, upside-down, jgsbreeder, zoo) are all expressible as
TouchLab patches. The difference: they run as one-shot shell loops
with file I/O. TouchLab runs them live, interactive, tweakable,
at frame rate.

## What Makes This Specifically WibWob

Not a TouchDesigner clone. Things TD cannot do:

- **Figlet as texture** — render text through 200+ fonts, use the
  letterforms as displacement maps, masks, or density sources.
  Typography becomes signal
- **Primer as signal** — Joan Stark's cat, a poem, a piece of code,
  any ASCII art file becomes a patchable source
- **Skeleton as CHOP driver** — stick figure joint positions output
  float values. Raise the arm, a parameter goes up. Dance drives
  the visuals
- **Theme tokens as colour space** — 9 theme colours are the entire
  palette. Crossfade between theme tokens. Everything stays
  aesthetically coherent across themes
- **Char decay as luminance** — the `█▓▒░·` density ladder is the
  terminal-native analogue to pixel brightness. Feedback, threshold,
  crossfade all operate on this ladder. It is what makes feedback
  trails look genuinely good in ASCII
- **Desktop as oscillator** — no other tool treats its own window
  manager output as a patchable signal source. The recursive capture
  loop is unique to this medium
- **CLI as patch language** — `wibwob capture 3 | wibwob inject 7`
  makes the shell itself a patching surface. Unix pipes as signal
  routing

## Autoresearch Loop

### Metric: `ui_score` (higher is better)

Scored 1-10 across five axes, primary metric is the average:

- **RICHNESS** — variety and quality of visual output from the node graph
- **INTERACTION** — how discoverable and responsive the controls are
- **COMPOSITION** — does the patch produce interesting combinations?
- **CRAFT** — code quality, SDK reuse, architecture
- **SURPRISE** — does it do something unexpected or delightful?

Same rubric pattern as plasma, asciicker, terrain-lab autoresearch
sessions. LLM-scored from screenshots.

### Loop Strategy

1. Baseline: score current MVP
2. Build node graph data structure (arbitrary routing replaces hardcoded 3-to-1)
3. Add generators one at a time (figlet first — highest visual impact)
4. Add feedback transform (the single biggest visual unlock)
5. Add CAPTURE generator (the recursive desktop bridge)
6. Add CHOP LFO (makes everything breathe)
7. Expand blend modes
8. Polish interaction
9. Each iteration: change, screenshot, score, log

### Priority Order (what moves the needle most)

1. **Feedback transform** — creates 90% of visual interest
2. **Figlet generator** — unique to this tool, massive visual impact
3. **CAPTURE generator** — the recursive desktop concept
4. **Contour generator** — richest existing visual primitive
5. **LFO CHOP** — makes everything alive
6. **Crossfade compositor** — density interpolation between sources
7. **Glitch/shear transforms** — proven in FX scripts
8. **Terrain generator** — already exists, just wire it in
9. **Skeleton generator** — unique, connects to GlitchBox
10. **Node graph topology** — arbitrary routing, click-to-connect

## Acceptance Criteria

- [ ] Node graph data structure with arbitrary routing
- [ ] At least 6 GEN types wired from existing SDK primitives
- [ ] Feedback transform with char decay ladder
- [ ] CAPTURE generator that reads live window output
- [ ] At least 3 XFORM types beyond feedback
- [ ] At least 3 COMP modes beyond overwrite/mask
- [ ] At least 1 CHOP type (LFO) driving a generator knob
- [ ] Figlet typography as a generator node
- [ ] Contour field as a generator node
- [ ] CLI `wibwob capture <id>` pipes window text to stdout
- [ ] ui_score reaches 8.0+ in autoresearch loop
- [ ] Stable 10fps+ with 6 active nodes

## Stories

- [ ] S1: Autoresearch baseline — instrument, measure, score MVP
- [ ] S2: Node graph data structure — arbitrary routing, typed ports
- [ ] S3: GEN library — figlet, terrain, contour, skeleton, noise, cellular
- [ ] S4: Feedback transform with char decay
- [ ] S5: CAPTURE generator — live window-to-node pipe
- [ ] S6: XFORM library — scroll, mirror, glitch, shear, threshold, remap
- [ ] S7: COMP expansion — add, multiply, difference, xor, crossfade
- [ ] S8: CHOP LFO — parameter automation
- [ ] S9: Interaction polish — snap, tab-cycle, presets, fullscreen output
- [ ] S10: CLI integration — `wibwob capture`, `wibwob inject`
