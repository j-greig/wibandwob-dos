# Autoresearch — Asciicker Port

## Objective
Port the asciicker 3D ASCII game engine (github.com/msokalski/asciicker, MIT)
to TypeScript as a WibWob-DOS module. Not a reimagination — a faithful port of
the original's rendering pipeline, map data, sprites, meshes, and gameplay.

## Reference Materials
- **C++ source**: `/tmp/asciicker/` — 136K lines (cloned from github, MIT)
- **Gameplay GIF**: `/Users/james/Repos/wibandwob-dos/asciicker-gameplay-animted.gif`
  — animated recording of actual gameplay. Extract frames with ffmpeg to study
  water reflections, 3D camera rotation, mesh rendering, sprite animation,
  lighting, and the fg+bg dithering in action. Invaluable visual reference.
  `ffmpeg -i asciicker-gameplay-animted.gif -vf "select=eq(n\,N)" -frames:v 1 /tmp/frame.png`

## Reference Codebase

### Original architecture (what we're porting)
| System | C++ files | Lines | What it does |
|--------|-----------|-------|-------------|
| Terrain | terrain.cpp/h | 2954 | Heightmap patches, load/save .a3d format |
| World | world.cpp/h | 5316 | BSP tree, mesh instances, sprite instances, items |
| Render | render.cpp/h | 4359 | CPU rasterizer: 3D→AnsiCell buffer with depth, materials, lighting |
| Sprite | sprite.cpp/h | 1660 | Load .xp (REXPaint gzip), multi-frame animation atlas |
| Physics | physics.cpp/h | 1695 | Collision, gravity, movement |
| Game | game.cpp/h | 10588 | Player, NPCs, combat, inventory, AI |

### Key data formats
- **Map** `.a3d`: header "AS3D", terrain patches + world instances (binary)
- **Meshes** `.akm`: PLY ascii — vertices with RGBA colour + triangle faces
- **Sprites** `.xp`: gzip REXPaint — layers of (glyph:i32, fg:RGB, bg:RGB) cells, column-major
- **Palette** `palette.gz`: gzip — 256 RGB triplets for the ANSI colour mapping

### Core rendering concept
Each screen cell = `AnsiCell { fg: u8, bg: u8, glyph: u8, spare: u8 }`.
The renderer writes to a flat `AnsiCell[w*h]` buffer using a depth test per cell.
Terrain patches are rasterized as triangle pairs. Meshes rasterized face-by-face.
Sprites blitted with transparency. Then the buffer is printed as ANSI escape codes.

The visual richness comes from BOTH fg AND bg colour per cell — the two colours
create a dithering effect that doubles effective colour resolution.

## Module Structure
This port uses multiple files under `modules/asciicker/`:

| File | Responsibility |
|------|---------------|
| `index.ts` | Module entry, window setup, game loop, input |
| `render.ts` | 3D→AnsiCell rasterizer, projection, depth buffer |
| `terrain.ts` | Heightmap patches, terrain generation or .a3d loading |
| `world.ts` | World objects: mesh instances, sprite instances |
| `sprite.ts` | .xp parser, sprite blitting, animation |
| `mesh.ts` | .akm PLY parser, mesh face rasterization |
| `material.ts` | Material/palette system, glyph selection, lighting |
| `physics.ts` | Collision, movement, gravity |
| `cp437.ts` | CP437→Unicode glyph mapping table (256 entries) |

## Phase Plan

### Phase 1: Faithful render pipeline (RENDER axis)
Goal: match the original's projection, depth buffer, and per-cell output.

**Story 1.1: AnsiCell buffer + ANSI output**
- AnsiCell type: { fg, bg, glyph, depth }
- Buffer clear, write with depth test
- Convert buffer to ANSI escape string with fg+bg per cell
- AC: buffer renders correctly in blessed window with per-cell colour

**Story 1.2: Isometric projection matching original**
- Port the exact transform matrix from render.cpp lines 2780-2830
- 30° pitch, yaw-rotatable, architectural perspective
- Zoom control, screen centering
- AC: projection matches original's visual angle and proportions

**Story 1.3: Terrain patch rasterization**
- Port terrain patch structure (HEIGHT_CELLS=4, VISUAL_CELLS=8)
- Rasterize patch quads as triangle pairs (Bresenham fill)
- Height offset creates depth — higher cells occupy higher screen rows
- AC: flat terrain renders as filled grid, height variations show depth

**Story 1.4: Surface normal lighting**
- Compute normals from height differences
- Directional light dot product → diffuse value
- Map diffuse to material shade levels
- AC: terrain shows light/shadow based on height slope

### Phase 2: Materials + visual richness (BEAUTY axis)
Goal: match the original's fg+bg dithering and glyph variety.

**Story 2.1: Material system port**
- Port Material struct: shade[4][16] = 4 light levels × 16 sub-materials
- Each shade entry = { fg, bg, glyph }
- Material assigned per terrain visual cell
- AC: terrain cells show varied fg+bg+glyph combinations

**Story 2.2: CP437 glyph table**
- Full 256-entry CP437→Unicode mapping (from game_app.cpp)
- Glyph index stored in AnsiCell, converted at output time
- AC: all 256 CP437 characters render correctly as Unicode

**Story 2.3: Palette port**
- Load palette.gz: 256 RGB→ANSI colour entries
- Or port the auto_mat table from render.cpp (RGB→closest fg+bg+glyph)
- AC: colours match the original's look

### Phase 3: World data (WORLD axis)
Goal: load and render the actual game map, not procedural terrain.

**Story 3.1: .a3d terrain loader**
- Parse the binary format: header, patch index, height/visual maps
- Reconstruct the original game terrain
- AC: game_map_y8.a3d loads and renders recognisable terrain

**Story 3.2: .akm mesh loader**
- Parse PLY ascii: vertices (xyz + RGBA), triangle faces
- Store as renderable face list
- AC: tree-1.akm loads and has correct vertex count

**Story 3.3: Mesh face rasterization**
- Transform mesh vertices through camera matrix
- Rasterize coloured triangles to AnsiCell buffer
- Depth test per cell
- AC: a tree mesh renders as a multi-cell 3D object on terrain

**Story 3.4: .xp sprite loader**
- Parse gzip REXPaint: layers of column-major cells
- Extract animation frames from atlas layout
- AC: player-nude.xp loads all frames, character.xp loads preview

**Story 3.5: World instance placement**
- Load instance data from .a3d (position, yaw, mesh/sprite ref)
- Place trees, bushes, rocks, houses at their map positions
- AC: world objects appear at correct positions matching original

### Phase 4: Player + controls (CONTROLS axis)
Goal: walk through the world like the original game.

**Story 4.1: Player movement**
- WASD screen-relative movement
- Height-following (player walks on terrain surface)
- Collision with world objects
- AC: player walks smoothly, can't walk through trees

**Story 4.2: Camera system**
- Smooth follow with Z-tracking
- Q/E yaw rotation (free angle, not just 90° steps)
- +/- zoom
- AC: camera tracks player smoothly, rotation feels natural

**Story 4.3: Sprite animation**
- Walking animation: cycle frames based on movement direction
- Idle animation when standing still
- Direction-dependent sprite selection (8 angles)
- AC: player sprite animates when walking, faces movement direction

### Phase 5: Water + effects (BEAUTY axis continued)
Goal: animated water, reflections, weather.

**Story 5.1: Water surface**
- Flat water plane at configurable level
- Animated glyph cycling (ripple effect)
- Distinct blue palette for water cells
- AC: water areas ripple and look like the original

**Story 5.2: Water reflections**
- Terrain/objects above water reflect below water line
- Reflection uses inverted y-coordinate + dimmed colours
- AC: trees near water show visible reflections

**Story 5.3: Day/night cycle**
- Light direction rotates over time
- Palette shifts: warm dawn → bright day → orange dusk → blue night
- AC: world lighting changes gradually over play time

### Phase 6: NPCs + gameplay (SURPRISE axis)
Goal: the world has life, not just scenery.

**Story 6.1: NPC spawning**
- Place NPC sprites at world positions
- Simple patrol AI (random walk within radius)
- AC: NPCs visible and moving in the world

**Story 6.2: Combat basics**
- Attack animation when clicking/pressing space
- NPC health, player health, damage
- AC: player can fight NPCs, health bars visible

## Scoring
5 axes (each 1-10, averaged):
- **RENDER** — 3D rendering fidelity (projection, depth, occlusion, lighting)
- **WORLD** — terrain, objects, map fidelity to original
- **CONTROLS** — movement, camera, responsiveness
- **BEAUTY** — visual richness (fg+bg dithering, glyph variety, palette)
- **CRAFT** — code quality, architecture, performance, lifecycle

Current: RENDER:8.7 WORLD:8.2 CONTROLS:8.1 BEAUTY:8.1 CRAFT:8.9 = **8.4**

## Constraints
- Files: `modules/asciicker/*.ts` (multiple files allowed)
- Must pass `bun run typecheck`
- Keep fps ≤ 8 (125ms+ interval)
- Import only from blessed and `../../src/services/microapp-sdk.js`
- Reference data files copied to `modules/asciicker/data/`
- All lifecycle hooks maintained in index.ts

## Reload Pattern
```bash
# Close + reopen (module code re-evaluated on window creation)
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json; d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.asciicker': print(w['id'])
" | while read id; do
  curl -s -X POST http://127.0.0.1:8099/windows/close \
    -H 'Content-Type: application/json' -d "{\"id\":$id}"
done
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.asciicker.open"}'
```
