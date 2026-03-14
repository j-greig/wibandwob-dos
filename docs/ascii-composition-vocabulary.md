# ASCII Composition Vocabulary

## TL;DR

WibWob-DOS is not trying to clone TouchDesigner.
The useful thing to borrow is a tiny composition vocabulary for terminal art:
source, parameter, transform, mix, output, and preview.

Current reusable path:

- animated subsurface bridge: `createEmbeddedLivePlayer(...)`
- layer compositor: `composeAsciiLayers(...)`
- text block helper: `renderAsciiTextBlock(...)`
- canonical proving surface: `microapps/demo-touchlab-mvp/`

Current judgement on Blessed custom stream routing:

- interesting in theory
- too awkward and too unproven for the current composition contract
- not required for the first reusable scaffolding pass
- treat as future investigation, not current architecture

## Why this exists

TouchLab MVP already proved that WibWob-DOS wants more than isolated windows.
It wants small composable visual operators inside one parent surface.

The mistake would be to jump straight to a giant patcher runtime.
The useful move is smaller: define stable names for the pieces we already have,
extract only the shared helpers, and keep the host contract honest.

## Vocabulary

### Source

A thing that generates or supplies ASCII / ANSI material.

Examples:

- animated waveform generator
- static text phrase
- typed input buffer
- primer-derived text block
- future webcam-to-ASCII frame source

A source should be readable as content, not only as side effects.

### Parameter

A value that changes how a source, transform, or mix behaves.

Examples:

- phrase selection
- blend mode
- colour choice
- animation on/off
- seed, speed, density, threshold

A parameter is not the art itself. It steers the art.

### Transform

A step that reshapes one source.

Examples:

- clip
- mask
- smear
- threshold
- remap glyphs
- offset or scroll

This pass does not extract a dedicated transform host yet. The role is named now
so future helpers can land under one vocabulary instead of ad hoc names.

### Mix

A step that combines multiple sources or transformed sources into one frame.

Current reusable helper:

- `composeAsciiLayers(width, height, layers, mode)`

Current modes:

- `overwrite`
- `mask`

### Output

The final visible frame or panel that a human actually reads as the result.

In TouchLab MVP, the MIX node is the current output.

### Preview

A smaller or intermediate surface used to inspect a source or transform without
making it the final output.

In TouchLab MVP, the source nodes act as previews of the materials feeding the
output.

## Reusable scaffolding that now exists

### 1. Embedded animated surface bridge

`createEmbeddedLivePlayer(...)` builds on the existing lazy-mounted animation
path. It gives a module one way to say:

- this child box is an animated surface
- derive its viewport from the mounted target
- start and stop it cleanly
- feed frames back into a larger composition

Why this matters:

- no raw `setInterval` glue per module
- no second parallel animation host
- one cleanup path
- one mount/lifecycle story

### 2. ASCII layer compositor

`composeAsciiLayers(...)` is the current tiny mix primitive.

That is enough for the first composition scaffold because it lets a module say:

- here are my materials
- here is my blend rule
- produce one output frame

### 3. ASCII text material helper

`renderAsciiTextBlock(...)` is a tiny text-material helper.
It is not glamorous, but it keeps source construction from scattering trivial
text-grid code everywhere.

## What is reusable versus what stays TouchLab-local

Reusable now:

- vocabulary: source, parameter, transform, mix, output, preview
- `createEmbeddedLivePlayer(...)`
- `composeAsciiLayers(...)`
- `renderAsciiTextBlock(...)`

Still local to TouchLab MVP for now:

- nested draggable panel chrome
- node inspector layout
- arrow rendering between nodes
- TouchLab-specific keyboard and mouse affordances
- exact node graph shape

## Current adopters and blockers

Real adopter landed:

- `microapps/demo-touchlab-mvp/`
  - GEN is a source using the embedded animation bridge
  - TEXT is a source
  - INPUT is a parameter/source hybrid
  - MIX is the output node using shared layer composition

Explicit blocker / defer:

- `microapps/zine/`
  - Zine already has a central live-panel tick loop tied to canvas items
  - moving it to per-panel embedded animated players would need a mount and
    lifecycle registry for many dynamic content nodes
  - that is a real follow-on, not a reason to pretend this pass adopted Zine

## What we are NOT copying from TouchDesigner

Not in scope:

- GPU shaders
- a universal node editor for the whole OS
- a full patch graph runtime
- arbitrary stream piping between nested Blessed screens
- pretending terminal cells are video textures

The terminal-native version stays smaller and more honest.

## Stream-routing note

Blessed custom duplex stream routing remains an interesting research trail, but
for this story it is too awkward to be the foundation.

Reasoning:

- it would create a more fragile contract than the current target-box model
- it is not needed to prove composable animated subsurfaces
- it would drag the work toward a host/runtime seam change instead of a helper
  extraction pass

So the current answer is: noted, deferred, not foundational.

## Canon shape after S12

When building a composition-oriented module, prefer thinking in this order:

1. define sources
2. define parameters
3. define any transforms
4. define how they mix
5. define the output surface
6. expose previews where useful
7. keep cleanup, resize, and restyle attached to the same host/window contract
