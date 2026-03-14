# What to keep from v1

Honest audit of 1434 lines. The tile renderer is dead but
half the codebase is gameplay logic that works fine.

## KEEP AS-IS (~500 lines)

### Noise functions (lines 131-155, 24 lines)
- hash2d(), smoothNoise(), fractal()
- Pure math, no rendering dependency
- → moves to `terrain.ts`

### Camera struct (lines 488-496, 8 lines)
- { x, y, z, yaw, pitch, zoom }
- → moves to `game-loop.ts`

### Module lifecycle (lines 977-1000, ~20 lines)
- setup(), registerCommand, createWindow, maximize
- → stays in `index.ts`

### Input handling (lines 1370-1400, ~30 lines)
- Keypress handler: WASD/arrows, Q/E, +/-, Space, H, M
- Key set with timeout
- → moves to `game-loop.ts`

### NPC system (lines 1025-1104, ~80 lines)
- NPC interface, spawn logic, patrol AI, hostile chase
- interactWithNPC() with dialogue/combat
- → moves to `npcs.ts`

### Weather system (lines 1105-1120, ~15 lines)
- Weather cycling: clear/rain/fog/storm
- weatherTick, weather state transitions
- → moves to `game-loop.ts` or `weather.ts`

### Item pickups (lines 1121-1150, ~30 lines)
- Item interface, spawn on terrain, collection logic
- Inventory tracking
- → moves to `game-loop.ts` or `items.ts`

### Combat (lines 1340-1370, ~30 lines)
- Player HP, attack cooldown, hostile NPC damage
- interactWithNPC() combat branch
- Already in NPC system above

### Movement + collision (lines 1151-1210, ~60 lines)
- Screen-relative movement with yaw transform
- Terrain collision (deep water block, slope slowdown)
- Camera lerp follow
- → moves to `game-loop.ts`

### Status bar / HUD (lines 1300-1340, ~40 lines)
- Position, altitude, biome, weather, HP, inventory, controls text
- sep + status blessed boxes
- → moves to `game-loop.ts`

### describeState + captureText (lines 1405-1434, ~30 lines)
- Semantic state for API/agents
- Text capture for screenshots
- → stays in `game-loop.ts`

### onCleanup, onResize, onRestyle (~20 lines)
- Lifecycle hooks
- → stays in `game-loop.ts`

## ADAPT (~300 lines)

### Biome types + materials (lines 29-109, 80 lines)
- Biome enum: KEEP
- biomeNames: KEEP
- MATERIALS object with glyph arrays and colour codes: ADAPT
  - v2 needs RGB values for auto_mat input, not direct ANSI fg/bg
  - The glyph arrays are irrelevant — auto_mat picks glyphs
  - Keep as "biome → base RGB colour" mapping
- → moves to `materials.ts`, simplified to RGB palette

### Terrain generation (lines 156-311, 155 lines)
- genTerrain(), getH(), getBiome(): ADAPT
- v1 outputs: cells[y*w+x] = { height, biome }
- v2 needs: patches of height[5][5] + visual[8][8] + diag
- The noise functions and biome thresholds are fine
- Need to restructure output format to match C++ patch model
- → moves to `terrain.ts`, rewritten to output patches

### ANSI output (lines 920-976, 56 lines)
- bufferToAnsi(): REWRITE
- v2 post-pass produces terminal cells directly
- Need new function: terminalCellsToAnsi()
- Much simpler — just emit fg/bg/glyph per cell
- → moves to `ansi.ts`

## THROW AWAY (~620 lines)

### Sample type (lines 19-28, 9 lines)
- Wrong type. v2 Sample needs: height, visual, diffuse, flags
- Using typed arrays (SoA), not objects

### Player sprite (lines 110-130, 20 lines)
- Hardcoded ASCII art of the player character
- Will be replaced by .xp sprite loader
- Keep temporarily as fallback until Phase 4

### World objects (lines 312-487, 175 lines)
- OBJ_SPRITES, ObjKind enum, placeObjects(), WorldObj
- ASCII art stamps for trees/bushes/rocks/houses
- Will be replaced by .akm mesh rendering
- Keep temporarily as fallback until Phase 5

### Projection (lines 497-534, 37 lines)
- projectPoint() — WRONG. Single point projection, not matrix-based
- Replace with buildProjection() + projectVertex() from ENGINE_ANALYSIS.md

### 3D Renderer (lines 535-919, 384 lines)
- renderScene() — THE CORE PROBLEM
- Tile stamping: project point, draw 2x1 block
- No triangle fill, no depth interpolation
- Water reflections (screen-space hack, not real reflection pass)
- NPC/object blitting (sprite stamps, not projected)
- Particles, minimap overlay
- ALL of this is replaced by the triangle rasterizer pipeline

## The transition plan

Phase 0 splits the file but keeps v1 rendering working.
Then Phase 1 swaps ONLY the renderScene() implementation:

```
v1: renderScene() → tile stamp each cell → bufferToAnsi()
v2: renderScene() → project patches → rasterize triangles → post-pass → ansi
```

The gameplay shell (NPCs, weather, items, combat, input, HUD)
calls renderScene() and doesn't care which implementation runs.
That's the seam.
