# Autoresearch — Terrain Lab

## Objective

Improve Terrain Lab visual quality, especially the right sidebar panel.
Single file in scope: `src/windows/terrain-lab-window.ts` (164 lines).

## Current State
- ASCII terrain art fills left ~75% of window — already looks great
- Right sidebar has: Mode, Terrain, Levels, Seed, Keys section
- Sidebar is plain text with no colour or structure
- Title bar shows terrain type + seed + mode
- Status bar shows keyboard shortcuts

## Rubric — Five Axes (each 1-10)

### LAYOUT (L)
Effective use of space. Terrain art prominent, sidebar well-proportioned.

### READABILITY (R)
Mode, terrain type, params, keyboard shortcuts all clearly scannable.

### AESTHETIC (A)
Colour accents, visual hierarchy, theme consistency.

### COHERENCE (Co)
Feels like one designed tool. Sidebar and terrain connected visually.

### CHARACTER (Ch)
Feels like an exploration/generation tool. Personality, delight.

## Primary Metric
ui_score = (L + R + A + Co + Ch) / 5

## Constraints
- Only modify `src/windows/terrain-lab-window.ts`
- Must pass `bun run typecheck`
- RESTART required after changes (it's in `src/`)
- Use theme tokens — never hardcode colours
