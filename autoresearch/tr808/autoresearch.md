# Autoresearch — TR-808 Drum Machine UI

## Objective

Improve the TR-808 drum machine visual quality. Two files in scope:
- `microapps/wibwob-tr808/renderer.ts` — pure text renderer (layout, colours, characters)
- `microapps/wibwob-tr808/index.ts` — microapp host wiring (window size, key bindings)

Score screenshots against a 5-axis rubric. Higher is better.

## Real TR-808 Reference

The Roland TR-808 has a distinctive visual identity:
- Horizontal layout with instruments as rows
- 16-step sequencer buttons in 4 colour-coded groups of 4:
  Group 1 (1-4): red/orange, Group 2 (5-8): orange/yellow,
  Group 3 (9-12): yellow, Group 4 (13-16): white
- Large rotary knobs per instrument (LEVEL, TONE, DECAY, etc.)
- Transport section: START/STOP, TEMPO slider, MODE selector
- Wood side panels, silver/grey metal face
- Clean, spacious layout with clear labelling

## Rubric — Five Axes (each 1-10)

### LAYOUT (L)
Faithful to TR-808 spatial organisation. Step grid prominent, instruments readable.

### READABILITY (R)
Instrument names, step states, params, transport all clearly scannable.

### AESTHETIC (A)
Colour-coded step groups, theme-consistent, wood panel feel, visual energy.

### COHERENCE (Co)
Feels like one designed instrument. Header, grid, transport, status connected.

### CHARACTER (Ch)
Feels like a TR-808, not a generic grid. Personality, charm, iconic details.

## Primary Metric
ui_score = (L + R + A + Co + Ch) / 5

## Constraints
- No new npm dependencies
- Must pass `bun run typecheck`
- Module must load and appear in app
- Use theme tokens via `host.theme()` — never hardcode colours
- Renderer is a pure function: engine state → string. No blessed dependency.

## What's Been Tried
(none yet)
