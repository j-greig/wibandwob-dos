# Autoresearch — Asciicker Port v2 (Triangle Rasterizer)

## Objective
Replace the v1 tile renderer with a proper software triangle rasterizer,
matching the original C++ engine's architecture. The renderer is swapped
UNDERNEATH the existing gameplay shell — NPCs, weather, combat, items,
controls all stay alive during the transition.

See `ENGINE_ANALYSIS.md` for the C++ reverse-engineering report.
See `PLAN_REVIEW.md` for Codex's review of this plan.

## What v1 got wrong
- One projected point per terrain cell, stamped as a 2-wide block → gaps everywhere
- No triangle rasterization → no sub-cell coverage, no depth interpolation
- No post-pass → no auto_mat dithering, no cliff illusion, no 2x2 downsampling
- Movement directions felt wrong because projection didn't match camera yaw
- Minimap was inverted

## Architecture (from ENGINE_ANALYSIS.md)

The original is a strict 3-stage pipeline:

```
World data → Sample buffer at 2x terminal resolution → Post-pass → Terminal cells
```

Everything renders into sample space first. The displayed terminal cell grid
is only a 2x2 collapse of that higher-resolution buffer. This is not optional
polish — it is core to the engine's look.

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
// Premultiplied coordinates: X = x * HEIGHT_CELLS, Y = y * HEIGHT_CELLS
sx = cosYaw * ds * X + sinYaw * ds * Y + cx
sy = -sinYaw * sin30 * ds * X + cosYaw * sin30 * ds * Y
   + (cos30 / HEIGHT_SCALE * ds * HEIGHT_CELLS) * Z + cy
```

### auto_mat — the visual magic
- Precomputed LUT: 32*32*32 RGB15 inputs → (bg, fg, glyph) triple
- 6 glyph ramp `" ..::%"` yields 12 effective blend levels by swapping fg/bg
  for the upper half (shd >= 6 reverses the pair)
- Post-pass averages each 2x2 sample block in RGB space, resolves via auto_mat
- This is how the engine gets "doubled colour resolution" from one terminal cell

### Cliff illusion — NOT geometry
- Terrain cliffs are NOT rendered as explicit wall triangles
- `visual` bit 0x8000 lifts terrain samples by one elevation unit
- Post-pass inspects neighbour elevation/depth patterns to select
  Material.shade[4][16] row and ledge glyphs ─ and _
- This is cheaper than wall polygons and must be preserved in the port

## Module Structure
Split early per god-file-prevention rule. Each file < 300 lines.

```
modules/asciicker/
  index.ts          — module registration, wire services ONLY
  game-loop.ts      — window setup, tick loop, input handling, HUD
  projection.ts     — buildProjection(), projectVertex()
  rasterize.ts      — rasterizeTriangle() with barycentric coords + depth test
  sample-buffer.ts  — Sample type, buffer create/clear, typed arrays
  terrain.ts        — procedural terrain gen (height[5][5] + visual[8][8] + diag)
  terrain-render.ts — project patch vertices, split quads to triangles, rasterize
  postpass.ts       — 2x2 downsample, auto_mat LUT, cliff glyphs, water tint
  materials.ts      — auto_mat table generation (32K entries), material shade lookup
  ansi.ts           — convert terminal cell buffer to ANSI escape string
  world-objects.ts  — trees/bushes/rocks as procedural mesh-like objects
  npcs.ts           — NPC state, patrol AI, combat
  formats/
    a3d.ts          — .a3d terrain loader (Phase 4)
    xp.ts           — .xp sprite loader, COLUMN-MAJOR (Phase 4)
    akm.ts          — .akm PLY mesh loader (Phase 4)
```

## Benchmark-Aware Phasing

**Critical constraint**: the LLM scorer reads source code + text captures and
rewards visible features (NPCs, weather, items, controls). A renderer-only
rewrite will score LOWER than v1 even if architecturally correct.

**Rule**: each phase preserves or reuses the existing gameplay/control shell.
The renderer is swapped underneath, not replaced wholesale.

### Phase 0: Architecture split + renderer seam
Extract the v1 god file into the multi-file structure above. Keep ALL existing
behaviour working — this is a pure refactor, no feature changes.

**Story 0.1: Split index.ts into game-loop.ts + terrain.ts + npcs.ts etc**
- Move terrain generation, NPC logic, rendering, ANSI output to separate files
- index.ts becomes module registration only
- AC: `bun run typecheck` passes, game plays identically, CRAFT score improves

**Story 0.2: Create renderer seam**
- Define a `renderScene()` interface in game-loop.ts
- v1 tile renderer implements it (in terrain-render.ts or similar)
- New triangle renderer will implement the same interface
- AC: renderer is swappable without touching game loop

### Phase 1: Triangle-based terrain (the visual breakthrough)
Replace ONLY the terrain rendering path. Keep everything else.

**Story 1.1: Projection module**
- Port exact projection matrix from render.cpp:2785-2815
- Use premultiplied XY (* HEIGHT_CELLS) to match C++ math
- AC: projecting (0,0,0) lands at screen centre, yaw rotates correctly

**Story 1.2: Sample buffer + triangle rasterizer**
- Sample buffer as typed arrays (SoA: height[], visual[], diffuse[], flags[])
- rasterizeTriangle() with integer screen coords, barycentric fill
- Depth test: larger height wins (matching original)
- Edge pairing rule to prevent double-fill
- ZERO per-frame allocations in raster hot loops
- AC: single triangle fills correct pixels, shared edges don't gap or double-fill

**Story 1.3: Terrain patch rasterization**
- Procedural terrain: height[5][5] + visual[8][8] + diag bits
- Each height quad → 2 triangles (diag bit selects / or \ split)
- Camera-centred patch culling (bounded radius, not full world)
- AC: terrain fills screen with zero gaps at 8fps, existing controls still work

**Story 1.4: Simple post-pass**
- Each sample → one terminal cell (1:1, not 2x2 yet)
- Use visual index → biome colour mapping (reuse v1 materials)
- Diffuse from height gradients
- AC: coloured terrain visible, no blue-sky bleedthrough, gameplay features intact

### Phase 2: Visual richness (auto_mat + 2x2 + cliffs)
This is what makes it LOOK like asciicker.

**Story 2.1: auto_mat LUT generation**
- Port create_auto_mat() from render.cpp:579-709
- 32*32*32 RGB15 inputs → (bg, fg, glyph) using xterm-256 cube corners
- 6 glyph ramp " ..::%", 12 effective blend levels via fg/bg swap
- Precompute at module load time
- AC: arbitrary RGB colour maps to visually correct terminal cell

**Story 2.2: 2x2 downsample post-pass**
- Render to 2x resolution sample buffer (double width AND height)
- Each 2x2 block → average the RGB values → auto_mat lookup → one terminal cell
- This IS the defining visual mechanism of the engine
- AC: terrain shows smooth colour gradients, visible dithering effect

**Story 2.3: Surface normal lighting**
- Compute dzdx, dzdy from height grid neighbours
- Directional light: dot(normal, light_dir) → diffuse 0-255
- diffuse / 17 → shade bucket 0-15 → material shade lookup
- AC: terrain shows light/shadow based on slope direction

**Story 2.4: Cliff/elevation illusion**
- visual cell bit 0x8000 = elevated by one HEIGHT_SCALE
- Post-pass reads elevation patterns across 3 rows of neighbours
- Selects Material.shade[elv][shd] row (lower/high/raise/low)
- Silhouette glyphs ─ and _ for ledges from depth comparison
- AC: height drops show visible cliff edges

### Phase 3: Water + reflections
Matches the analysis recommendation: water before sprites/meshes.

**Story 3.1: Water plane + reflection pass**
- Global water height, quantised to sample increments
- Reflection pass: negate Z in projection, re-render terrain below water
- Merge normal + reflected in post-pass
- AC: water areas show reflected terrain

**Story 3.2: Water surface animation**
- Post-pass detects submerged cells
- Animated noise colour perturbation
- AC: water ripples visibly

### Phase 4: Real data loaders
Load actual game assets instead of procedural terrain.

**Story 4.1: .a3d terrain loader**
- Parse: AS3D header + FilePatch records (x, y, visual[8][8], height[5][5], diag)
- visual bit 0x8000 = elevation flag, lower bits = material
- Border sharing between adjacent patches for crack-free tiling
- AC: game_map_y8.a3d loads, recognisable terrain

**Story 4.2: .xp sprite loader**
- Gunzip + parse header (version, layers, width, height)
- COLUMN-MAJOR cell order (cell = x * height + y) — NOT row-major
- Layer 0 = colour key, layer 1 = height metadata, layer 2 = image
- XPCell: u32 glyph + RGB fg + RGB bg = 10 bytes packed
- AC: player-nude.xp loads with correct dimensions

**Story 4.3: .akm mesh loader**
- ASCII PLY: vertices (xyz + rgba), faces (triangle index lists)
- Fan-triangulate quads
- AC: tree-1.akm loads with correct vertex/face count

### Phase 5: Sprite + mesh rendering
Use loaded assets through the same rasterizer pipeline.

**Story 5.1: Sprite rendering**
- Position in 3D, project to sample buffer
- Blit with transparency (colour key from layer 0)
- Animation: angles × frames from atlas
- AC: player sprite visible, correctly occluded by terrain

**Story 5.2: Mesh rendering**
- Transform vertices through camera + instance matrix
- Rasterize coloured triangles through same pipeline as terrain
- Per-face normal lighting
- AC: tree mesh renders as 3D object on terrain

### Phase 6: Gameplay polish (re-integrate from v1)
Re-add and refine the gameplay features preserved from v1.

**Story 6.1: registerSnapshot persistence**
- Save/restore player position, seed, inventory across sessions

**Story 6.2: Help overlay + corrected minimap**
- H key shows controls overlay
- Minimap using actual terrain height data, correctly oriented

**Story 6.3: Movement direction fix**
- Screen-relative movement must match the new correct projection
- Verify up=north visually with minimap reference

## Scoring
Same 5 axes (each 1-10, averaged):
- **RENDER** — 3D rendering fidelity (triangles, depth, no gaps, lighting)
- **WORLD** — terrain, objects, map fidelity
- **CONTROLS** — movement, camera, responsiveness
- **BEAUTY** — visual richness (auto_mat dithering, cliff illusion, water)
- **CRAFT** — code quality, multi-file architecture, lifecycle

Current baseline: 9.3 (v1 tile renderer with NPCs, weather, combat, items)
Target: genuine improvement through correct architecture, not feature stuffing

**Benchmark guard**: Phase 1 is only "keep" if RENDER improves enough to
justify any temporary dips in other axes. If average drops below 8.5, stop
and reassess — the gameplay shell may need more features preserved.

## Risks (from ENGINE_ANALYSIS.md)

1. **Post-pass is the primary fidelity risk** — this is where materials,
   elevation, dithering, water tint, and final glyph selection happen.
   Get it right → looks like asciicker. Get it wrong → fancy tile renderer.

2. **Column-major .xp parsing** — generic parsers assume row-major.
   Must use `cell = x * height + y`, not `y * width + x`.

3. **Cliffs are NOT geometry** — do not add wall triangles. The illusion
   comes from elevation bits + post-pass material/glyph selection.

4. **TS raster performance** — depends on typed arrays, camera-centred
   patch culling, zero-allocation hot loops, and reused scratch arrays.
   Must hit 8fps on bounded terrain. Profile early.

5. **Scorer regression** — a correct but stripped-down renderer scores
   lower than v1 with all its gameplay features. Always preserve the
   gameplay shell during renderer replacement.

## Constraints
- Files: `modules/asciicker/*.ts` (multi-file, each < 300 lines)
- Must pass `bun run typecheck`
- Keep fps ≤ 8 (125ms+ interval)
- Import only from blessed and `../../src/services/microapp-sdk.js`
- Reference data files in `modules/asciicker/data/`
- All lifecycle hooks maintained in index.ts

## Reference
- `ENGINE_ANALYSIS.md` — C++ reverse-engineering (962 lines)
- `PLAN_REVIEW.md` — Codex review of this plan
- `/tmp/asciicker/` — original C++ source (MIT licence)
- `reference-frames/` — 15 PNGs from original gameplay
- `autoresearch.ideas.md` — v1 ideas (some relevant for Phase 6)
