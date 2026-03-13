# Autoresearch — WibWobWorld Terrain Views

## Objective
Transform WibWobWorld's rendering across all view modes. Make ISO view feel like
SimCity 2000 isometric with terrain objects. Make 3D/firstperson view feel like
standing on a hilltop looking at a landscape — rolling hills, distant sea, trees,
houses, depth fog. Add terrain objects (trees, houses, simple geometric ASCII-friendly
shapes) that render in BOTH iso and 3D modes.

## Current State
- ISO mode: single-glyph-per-cell diamonds, vertical columns, basic biome colouring
- 3D/firstperson mode: y-buffer raycaster but VERY sparse — just sky dots and ground
  underscores with almost no visible terrain features
- No objects on terrain (no trees, no houses, no structures)
- 5 render modes: terrain, contours, iso, hybrid, firstperson

## Architecture
- `modules/wibwobworld/index.ts` — module shell, layout, controls (981 lines)
- `modules/wibwobworld/render-iso.ts` — iso renderer (105 lines)
- `src/services/terrain-render.ts` — all non-iso renderers including firstperson
- `src/services/terrain-model.ts` — TerrainCell, TerrainMap, biome types
- `src/services/contour-engine.ts` — heightmap generation, hill system

## Key Files to Modify
- `modules/wibwobworld/render-iso.ts` — SimCity-style iso with objects
- `src/services/terrain-render.ts` — dramatically improved firstperson renderer
- `src/services/terrain-model.ts` — add object placement data to TerrainCell

## Target Improvements

### 1. Terrain Objects (affects all modes)
Place objects on terrain during map generation:
- Trees: `♣` `♠` `⌂` on forest/plain biomes (varying density)
- Houses: `⌂` `■` on plain biomes near shore (sparse, clustered)
- Rocks: `�ite` `●` on hill/ridge biomes
- Flowers: `*` `✿` on plain biomes (sparse)
- Boats: `⛵` on shallow water near shore
Objects stored in TerrainCell so all renderers can use them.

### 2. ISO View — SimCity 2000 Style
- Multi-cell buildings with roofs (not just single glyphs)
- Trees rendered as 2-cell tall sprites (trunk + canopy)
- Visible terrain layering with shading on south faces
- Better colour palette: lush greens, warm browns, blue water
- Grid lines or tile borders visible at closer zoom
- Player marker more prominent

### 3. 3D/Firstperson View — Standing on a Hill
The view should feel like:
- Standing on top of a hill looking out at rolling terrain
- Distant hills visible with atmospheric perspective (fog/fade)
- Sea visible at horizon when facing water
- Trees visible as vertical elements breaking the skyline
- Houses visible as small squares on plains
- Better sky: gradient from dark blue at top to light at horizon
- Ground texture varies: grass, dirt, sand near shore
- Depth cueing: distant features use dimmer colours
- Higher elevation scaling so terrain relief is dramatic

### 4. Hybrid View Polish
- Left pane (contour map) + right pane (iso) already works
- Ensure objects visible in both panes

## Rubric
5-axis: LAYOUT, READABILITY, COHERENCE, STYLE, FUNCTIONALITY — each 1-10, averaged.

- LAYOUT: spatial arrangement, how well views use available space
- READABILITY: can you parse terrain features, identify objects, understand depth
- COHERENCE: do all view modes feel like the same world
- STYLE: visual richness, colour usage, WibWob personality
- FUNCTIONALITY: do views feel genuinely useful/immersive, object variety

## Constraints
- Modify: `modules/wibwobworld/` files, `src/services/terrain-render.ts`, `src/services/terrain-model.ts`
- Must pass `bun run typecheck`
- RESTART required after changes (touching src/ files)
- Keep all 5 existing render modes working
