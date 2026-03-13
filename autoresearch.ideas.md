# Autoresearch Ideas

## Active: Asciicker (ASCII 3D World)
- Current: 8.1 (RENDER:8.4 WORLD:7.8 CONTROLS:8.1 BEAUTY:7.6 CRAFT:8.8)
- Target: 9.0+ across all axes
- File: `modules/asciicker/index.ts` (single file)
- Dream features: `modules/asciicker/DREAM-FEATURES.md`
- Reference: `/tmp/asciicker/` (cloned C++ codebase, MIT license)

### Key findings from studying the C++ source:
- AnsiCell = {fg: uint8, bg: uint8, glyph: uint8} per cell
- Material system: shade[4][16] = 4 light levels x 16 directional glyphs
- Terrain patches: heightmap cells with visual map overlay
- Back-to-front rendering with height offset creating depth parallax
- CP437 to Unicode glyph mapping (256 chars -> UTF-8)
- Camera: yaw-rotatable isometric with 30deg architectural perspective
- Sprites are .xp (REXPaint gzip) format: per-cell glyph + fg RGB + bg RGB

### Per-cell ANSI colour in blessed:
`tags: false` + raw `\x1b[38;5;N;48;5;Nm` escape codes in setContent()
gives per-cell fg+bg colour. Proven by e026-demo module.

### Next improvements to try:
- Import actual player sprite from .xp files (REXPaint gzip format)
- Better cliff/side face rendering — more vertical steps for tall terrain
- Fog of distance (fade colours to grey at view edge)
- Minimap overlay in corner
- Trees/structures as multi-cell sprites on terrain
- Day/night cycle affecting palette
- Particle effects (rain, leaves)
- Smooth sub-cell movement interpolation

## Proven Patterns
### ANSI per-cell colour
Works for: any module needing spatial colour variation
Recipe: tags:false, \x1b[38;5;N;48;5;Nm prefix per cell, \x1b[0m reset

### Feature-checklist LLM scoring
Works for: autoresearch scorers that plateau
Recipe: enumerate 10 concrete features per axis, scorer counts present features,
maps count to score. Prevents vague rounding to convenient values.

## Rubric (active)
RENDER, WORLD, CONTROLS, BEAUTY, CRAFT (5 axes, each 1-10, averaged)
