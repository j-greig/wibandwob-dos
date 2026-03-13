# Autoresearch Ideas

## Completed Apps
- LLM Orch Studio: 3.6 → 8.0
- Antopolis: 5.4 → 9.0+
- File Manager: 4.4 → 10.0
- Terrain Lab: 4.8 → 8.0
- Plasma: 5.4 → 8.0
- Code Editor: 4.4 → 9.2 (syntax highlighting, welcome screen, toolbar, relative line numbers)

## Paused Apps
- Music Player: 4.2 → 7.4 (4 viz modes, idle animations)
- TR-808: 5.4 → 6.4 (ANSI colours, preset loading fixed)
- Primer Gallery: 6.4 → 7.4 (tab counts, divider, header bar, status bar)
- Spore Clock: 5.6 → 8.5 (substrate memory, wild colonies, colour blending, decay, competition, colony names)

## Active: Asciicker (ASCII 3D World)
- Baseline: scaffold only (1.8 estimate)
- Target: 8.0+ across all axes
- File: `modules/asciicker/index.ts` (single file)
- Dream features: `modules/asciicker/DREAM-FEATURES.md`
- Reference: `/tmp/asciicker/` (cloned C++ codebase, MIT license)

### Key implementation ideas from studying the C++ source:
- AnsiCell = {fg: uint8, bg: uint8, glyph: uint8} per cell — render into flat buffer
- Material system: shade[4][16] = 4 light levels × 16 directional glyphs
- Terrain patches: heightmap cells with visual map overlay
- Back-to-front rendering with height offset creating depth parallax
- CP437 to Unicode glyph mapping (256 chars → UTF-8)
- Bresenham line drawing for edges/outlines
- Camera: yaw-rotatable isometric projection

### Rendering approach for blessed:
- Render into a string buffer (not actual ANSI — blessed handles colours via style)
- Use canvas.setContent() with plain chars, canvas.style.fg for colour
- For per-cell colour: would need blessed tags mode or ANSI escape injection
- Alternative: render the whole scene as a single-colour ASCII art (simpler, still impressive)
- Better alternative: use raw ANSI escape codes with tags:false and setContent()

### Phase priorities:
1. Heightmap + isometric renderer (core 3D effect)
2. Procedural terrain with biomes
3. WASD movement + camera
4. Material/colour system
5. Animated water, day/night
6. Player sprite, NPCs

## Proven Patterns
### ANSI Sidebar (for art+sidebar layouts)
Works for: Terrain Lab, Plasma, any createTextBlock sidebar
Recipe: A.cyn/yel/gry constants, setContent() bypass, section headers, active lists, bars

### Cellular Automaton Animation (for Spore Clock)
Works for: any living/breathing display module

## Rubric (active — Asciicker)
RENDER, WORLD, CONTROLS, BEAUTY, CRAFT (5 axes, each 1-10, averaged)

## Rubric (paused — Spore Clock)
GROWTH, TIME, BEAUTY, SURPRISE, CRAFT

## Rubric (paused — general UI apps)
LAYOUT, READABILITY, COHERENCE, STYLE, FUNCTIONALITY
