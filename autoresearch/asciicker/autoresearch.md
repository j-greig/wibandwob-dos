# Autoresearch — Asciicker Port v2 (Triangle Rasterizer)

## Objective
Rewrite the asciicker renderer from scratch as a proper software rasterizer,
matching the original C++ engine's architecture. The v1 tile renderer is
retired — it cannot produce gap-free terrain or correct 3D depth.

See `ENGINE_ANALYSIS.md` for the full C++ reverse-engineering report.

## What v1 got wrong
- One projected point per terrain cell, stamped as a 2-wide block → gaps everywhere
- No triangle rasterization → no sub-cell coverage, no depth interpolation
- No post-pass → no auto_mat dithering, no cliff illusion, no 2x2 downsampling
- Movement directions felt wrong because projection didn't match camera yaw properly
- Minimap was inverted

## Architecture (from ENGINE_ANALYSIS.md)

The original is a 3-stage pipeline:

```
World data → Sample buffer (2x resolution) → Post-pass → Terminal cells
```

1. **Projection**: isometric with 30° elevation, yaw-rotatable
2. **Triangle rasterizer**: barycentric fill with depth test, shared by terrain + meshes
3. **Post-pass**: 2x2 sample blocks → one terminal cell via auto_mat dithering

### Key constants
- HEIGHT_SCALE = 16 (z units per visual cell of height)
- HEIGHT_CELLS = 4 (height vertices per patch side = 5)
- VISUAL_CELLS = 8 (material cells per patch side)
- ds = 2 * zoom / VISUAL_CELLS (screen samples per world visual cell)
- sin30 = 0.5, cos30 = 0.866

### Projection formulas (TypeScript)
```ts
sx = cosYaw * ds * X + sinYaw * ds * Y + cx
sy = -sinYaw * sin30 * ds * X + cosYaw * sin30 * ds * Y + (cos30/HEIGHT_SCALE * ds * HEIGHT_CELLS) * Z + cy
```
where X = x * HEIGHT_CELLS, Y = y * HEIGHT_CELLS (premultiplied coords).

## Module Structure
Split early per god-file-prevention rule. Each file < 300 lines.

```
modules/asciicker/
  index.ts          — module setup, window, game loop, input, HUD
  projection.ts     — buildProjection(), projectVertex()
  rasterize.ts      — rasterizeTriangle() with barycentric coords + depth test
  sample-buffer.ts  — Sample type, buffer create/clear
  terrain.ts        — procedural terrain gen (height[5][5] + visual[8][8] + diag)
  terrain-render.ts — project patch vertices, split quads to triangles, rasterize
  postpass.ts       — 2x2 downsample, auto_mat LUT, cliff glyphs, water tint
  materials.ts      — auto_mat table generation, material shade lookup
  ansi.ts           — convert terminal cell buffer to ANSI escape string
  world-objects.ts  — trees/bushes/rocks as procedural mesh-like objects
  npcs.ts           — NPC state, patrol AI, combat
  formats/
    a3d.ts          — .a3d terrain loader (Phase 3)
    xp.ts           — .xp sprite loader (Phase 3)
    akm.ts          — .akm PLY mesh loader (Phase 3)
```

## Phase Plan

### Phase 1: Triangle-based terrain (the visual breakthrough)
This is the minimum viable renderer — gap-free terrain with depth.

**Story 1.1: Projection module**
- Port exact projection matrix from render.cpp:2785-2815
- buildProjection(zoom, yawDeg, camera, dw, dh) → projection object
- projectVertex(proj, x, y, z) → { sx, sy }
- AC: projecting (0,0,0) lands at screen centre, yaw rotates correctly

**Story 1.2: Sample buffer + triangle rasterizer**
- Sample { height, visual, diffuse, flags } as typed array (SoA or AoS)
- rasterizeTriangle(buffer, w, h, tri, blend) with barycentric coords
- Depth test: larger height wins (matching original)
- Edge pairing rule to prevent double-fill
- AC: rasterizing a single triangle fills correct pixels, no gaps at shared edges

**Story 1.3: Terrain patch generation**
- Procedural terrain: height[5][5] vertices + visual[8][8] material cells + diag bits
- Each height quad → 2 triangles (diag bit selects / or \ split)
- Project all 5x5 vertices through projection, rasterize all triangles
- AC: terrain fills screen with zero gaps, height creates visible depth

**Story 1.4: Simple post-pass (no auto_mat yet)**
- Read sample buffer, convert each sample to one terminal cell
- Use visual index → biome colour mapping (simplified materials)
- Compute diffuse from height gradients
- AC: coloured terrain visible, no blue-sky bleedthrough

### Phase 2: Visual richness (auto_mat + cliff illusion)
This is what makes it LOOK like asciicker.

**Story 2.1: auto_mat LUT generation**
- Port create_auto_mat() — maps RGB15 → (bg, fg, glyph) triple
- Glyph ramp: " ..::%"  with fg/bg swap at midpoint = 12 effective levels
- Precompute 32*32*32*3 lookup table at module load
- AC: arbitrary RGB colour maps to visually correct terminal cell

**Story 2.2: 2x2 downsample post-pass**
- Render to 2x resolution sample buffer
- Each 2x2 block → average RGB → auto_mat lookup → one terminal cell
- This is the core of the doubled colour resolution
- AC: terrain shows smooth colour gradients, not blocky biome boundaries

**Story 2.3: Cliff/elevation illusion**
- Visual cell bit 0x8000 = elevated
- Post-pass reads elevation patterns across neighbours
- Selects material shade row (lower/high/raise/low)
- Silhouette glyphs ─ and _ for ledges
- AC: height drops show visible cliff edges, not just colour changes

**Story 2.4: Surface normal lighting**
- Compute dzdx, dzdy from height grid
- Directional light dot product → diffuse 0-255
- diffuse/17 → shade bucket 0-15 → material lookup
- AC: terrain shows light/shadow based on slope direction

### Phase 3: Real data (faithful port)
Load the actual game map and assets instead of procedural terrain.

**Story 3.1: .a3d terrain loader**
- Parse binary: AS3D header + FilePatch records
- Each patch: x, y, visual[8][8], height[5][5], diag
- visual bit 0x8000 = elevation flag, lower 7 bits = material
- AC: game_map_y8.a3d loads, patch count matches original

**Story 3.2: .xp sprite loader**
- Gunzip + parse: version, layers, width, height
- COLUMN-MAJOR cell order (cell = x * height + y)
- Layer 0 = colour key, layer 1 = height, layer 2 = image
- XPCell: u32 glyph + RGB fg + RGB bg = 10 bytes
- AC: player-nude.xp loads with correct dimensions and colours

**Story 3.3: .akm mesh loader**
- ASCII PLY parser: vertices (xyz + rgba), triangle faces
- Fan-triangulate quads
- AC: tree-1.akm loads with correct vertex/face count

**Story 3.4: Sprite rendering**
- Position sprite in 3D, project to sample buffer
- Blit with transparency (colour key from layer 0)
- Reflection mode: mirror Z around water level
- AC: player sprite visible on terrain, correctly occluded by height

**Story 3.5: Mesh rendering**
- Transform mesh vertices through camera matrix
- Rasterize coloured triangles through same rasterizer as terrain
- AC: tree mesh renders as 3D object, depth-correct with terrain

### Phase 4: Water + effects
**Story 4.1: Water plane + reflections**
- Global water height, quantised to sample increments
- Reflection pass: negate Z projection, re-render terrain
- Merge normal + reflected in post-pass
- AC: water areas show reflected terrain/objects

**Story 4.2: Water surface animation**
- Post-pass detects submerged cells
- Animated noise perturbation on colour
- AC: water surface ripples

### Phase 5: Gameplay (re-add from v1)
Re-integrate the gameplay features from v1 that worked well.

**Story 5.1: Player movement + camera**
- WASD screen-relative movement with correct yaw mapping
- Smooth camera follow with lerp
- Q/E rotation, +/- zoom
- Height-following on terrain surface

**Story 5.2: NPCs + combat**
- Patrol AI, hostile/friendly NPCs
- Space to interact/attack
- HP system, damage, defeat rewards

**Story 5.3: Weather + items + inventory**
- Weather cycling with visual overlays
- Item pickups, inventory tracking
- Day/night cycle

### Phase 6: Polish
**Story 6.1: registerSnapshot persistence**
- Save/restore player position, seed, inventory

**Story 6.2: Help overlay + minimap**
- H key shows controls
- Minimap using actual terrain data

## Scoring
Same 5 axes (each 1-10, averaged):
- **RENDER** — 3D rendering fidelity (triangles, depth, no gaps, lighting)
- **WORLD** — terrain, objects, map fidelity
- **CONTROLS** — movement, camera, responsiveness
- **BEAUTY** — visual richness (auto_mat dithering, cliff illusion, water)
- **CRAFT** — code quality, multi-file architecture, lifecycle

Current baseline: 9.3 (v1 tile renderer)
Target: genuine improvement through correct architecture, not feature stuffing

## Constraints
- Files: `modules/asciicker/*.ts` (multi-file, each < 300 lines)
- Must pass `bun run typecheck`
- Keep fps ≤ 8 (125ms+ interval)
- Import only from blessed and `../../src/services/microapp-sdk.js`
- Reference data files in `modules/asciicker/data/`
- All lifecycle hooks maintained in index.ts

## Key Risk (from ENGINE_ANALYSIS.md)
> The largest hidden risk is not projection. It is the post-pass. That is
> where terrain materials, elevation, dithering, water tint, and final
> glyph selection happen.

The post-pass is where the visual magic lives. Get it right and the port
looks like asciicker. Get it wrong and it looks like a tile renderer
with fancier projection math.

## Reference
- `ENGINE_ANALYSIS.md` — full C++ reverse-engineering (962 lines)
- `/tmp/asciicker/` — original C++ source (MIT licence)
- `reference-frames/` — 15 PNGs from original gameplay
- `autoresearch.ideas.md` — v1 ideas (some still relevant for Phase 5-6)
