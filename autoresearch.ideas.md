# Autoresearch Ideas

## Active: Asciicker Port (ASCII 3D Game Engine)
- Current: 8.4 (RENDER:8.7 WORLD:8.2 CONTROLS:8.1 BEAUTY:8.1 CRAFT:8.9)
- Target: 9.0+ via faithful port of original engine
- Files: `modules/asciicker/*.ts` (multi-file)
- Plan: `autoresearch.md` — 6 phases, 17 stories
- Reference: `/tmp/asciicker/` (C++ source, MIT)

### Architecture notes from studying the original

**The visual secret: fg+bg dithering.**
Every terrain cell uses BOTH fg AND bg colour. The two colours plus glyph choice
create a dithering effect — effectively tripling visual density vs fg-only.
The auto_mat table in render.cpp maps any RGB to the closest (fg, bg, glyph)
triplet from the 256-colour palette. This is the core visual technique.

**Terrain patches, not individual columns.**
The original rasterizes terrain as QUAD patches (HEIGHT_CELLS=4, VISUAL_CELLS=8).
Each patch is a grid of quads, each quad split into 2 triangles. The triangles
are rasterized with Bresenham scanline fill + depth test. This handles all
camera angles without gaps. My column-based approach needs 2x-wide hack at
certain angles.

**Meshes are coloured PLY files.**
Trees, houses, rocks etc are PLY ascii meshes with per-vertex RGBA colour.
Each triangle face is rasterized independently with vertex colour interpolation.
This means trees are actual 3D geometry, not sprites — they have depth and
occlude correctly from any camera angle.

**Sprites are multi-frame atlases.**
player-nude.xp is 126x72 cells, containing 18 animation frames × multiple
directions. The atlas layout: 9 columns (front-facing frames) × 9 columns
(side-facing frames), with each column being 7 cells wide × 9 cells tall.

### Next concrete steps
1. Split index.ts into multi-file architecture (render.ts, terrain.ts, etc)
2. Port the exact projection matrix from render.cpp
3. Port CP437 table from game_app.cpp
4. Port auto_mat dithering table for fg+bg+glyph selection
5. Parse palette.gz for correct colour mapping
6. Parse game_map_y8.a3d for the actual terrain
7. Parse .akm PLY meshes for trees/objects

### Performance notes
- 256×256 terrain with viewRange=24 = ~2304 columns per frame
- 2-wide rendering doubles to ~4608 buffer writes
- At 8fps this is ~37K writes/sec — fast enough in JS
- The bottleneck is the ANSI string construction, not the math
