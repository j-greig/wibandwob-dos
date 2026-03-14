---
id: e042
title: "Asciicker Engine v2 — Novel ASCII 3D from First Principles"
status: not-started
started: 2026-03-14
---

# E042 — Asciicker Engine v2: Novel ASCII 3D from First Principles

## Vision

Build a new 3D ASCII engine in TypeScript, informed by three sources:

1. **The original Asciicker C++ engine** — isometric software rasterizer
   with heightmap terrain, triangle projection, barycentric interpolation,
   2x2 sample downsampling, and a post-pass that creates cliff/lighting
   illusions from elevation bits. Full analysis in `vendor/reference/ENGINE_ANALYSIS.md`.

2. **Classic raycaster techniques** — DDA grid traversal, vertical strip
   rendering, floor/ceiling casting. The Lode Vandevenne tutorial lineage.
   Reference in `vendor/reference/RAYCASTER_REFERENCES.md`.

3. **WibWob-DOS as medium** — the engine's output is patchable signal.
   Every frame can be captured via `captureText`, piped to TouchLab,
   composited with other windows, processed through FX scripts. The CLI
   makes the engine's visual output a Unix-pipeable stream. The desktop
   is both the display AND the signal routing layer.

Not a port. Not a clone. A novel engine that cherry-picks the best of
each source and produces something that could only exist in a terminal.

## What Makes This Novel

### The char density ladder IS the rendering pipeline

Traditional engines: geometry -> rasterize -> shade -> pixel colour.
This engine: geometry -> rasterize -> shade -> char density + fg/bg.

The terminal cell is a 2-colour dithering unit. Each cell blends its
fg and bg colours spatially through the glyph shape. The Asciicker
`auto_mat` LUT exploits this: 6 glyphs (` ..::%`) times 2 (fg/bg swap)
gives 12 luminance levels per colour pair. That's a rendering technique
unique to terminal output.

The char density ladder (`█▓▒░·. `) is both the shading model and the
aesthetic. Feedback decay in TouchLab uses the same ladder. The engine
and the compositor speak the same visual language.

### The desktop is the framebuffer

In a normal game engine, output goes to a GPU framebuffer. Here, output
goes to a blessed box, which is a window on the WibWob-DOS desktop,
which is capturable via `captureText()`, which means:

- TouchLab can CAPTURE the engine's output as a source node
- The engine's terrain can be composited with figlet text, contour
  fields, skeleton dancers, primer art
- FX scripts can glitch/shear/kaleidoscope the 3D world
- The CLI can pipe the world through `sed`, `awk`, `tr` and back
- Multiple engine instances can feed each other (split-screen
  multiplayer via capture)

The recursive desktop concept from E041 applies directly. The 3D
engine is just another visual signal source. The most complex one,
but architecturally identical to a wave generator or figlet renderer.

### Virus/Zarch flight model in ASCII

The Virus (David Braben, 1988) flight model — triangular craft with
thrust/gravity physics floating over heightmap terrain — maps perfectly
to this engine. Gravity as constant downward acceleration, thrust as
player-controlled upward force, inertia-based movement. The camera
follows the craft. The shadow projects onto terrain below.

In ASCII this becomes: a 3-char triangle craft (`/^\`) hovering over
procedural terrain, with the density ladder showing distance fog and
the char decay showing engine exhaust trails (via feedback if piped
through TouchLab).

## Architecture

### From ENGINE_ANALYSIS.md — what to keep

| Component | Keep? | Why |
|-----------|-------|-----|
| Isometric projection maths | YES | The sin30/cos30 skew is elegant and correct |
| Triangle rasterizer with barycentrics | YES | Core of the renderer, well-documented |
| 5x5 height / 8x8 material mixed-resolution | YES | Smart memory/visual tradeoff |
| 2x2 sample downsampling post-pass | YES | This IS the Asciicker look |
| Elevation bit cliff illusion | YES | Cheaper than real wall geometry |
| .a3d terrain format | YES | Can load original Asciicker maps |
| .xp sprite format | MAYBE | Only if we want original sprite compat |
| .akm mesh format (ASCII PLY) | MAYBE | Low priority, meshes are tertiary |
| Column-major everything | ADAPT | TS convention is row-major |
| auto_mat LUT (RGB15 -> cell) | REIMAGINE | Use theme tokens instead of raw xterm |

### From raycasters — what to borrow

| Technique | Use for |
|-----------|---------|
| DDA grid traversal | Visibility culling, line-of-sight checks |
| Vertical strip rendering | Optional first-person camera mode |
| Floor casting | Indoor scenes if we ever want corridors |

### From WibWob-DOS — what to integrate

| Primitive | Integration |
|-----------|-------------|
| `blankGrid` / `gridToText` | Output buffer |
| `createTimer` | Render loop |
| Theme tokens | Colour palette — terrain biomes map to theme colours |
| `captureText` | Pipe engine output to TouchLab / CLI |
| `describeState` | Agent introspection of world state |
| `renderFiglet` | In-world text (signs, labels, landmarks) |
| Contour engine | Alternative terrain generation source |
| `EASINGS` / `tween` | Camera movement, smooth physics |

### Module structure

```
modules/asciicker-v2/
  index.ts              — microapp entry, blessed wiring, input handling
  engine/
    projection.ts       — camera matrix, world-to-screen, buildProjection()
    rasterize.ts        — triangle rasterizer with depth buffer
    terrain.ts          — heightmap patch model, biome materials
    postpass.ts         — 2x2 downsampling, cliff illusion, lighting
    water.ts            — reflection plane, underwater tint
    physics.ts          — gravity, thrust, inertia, collision
    camera.ts           — follow-cam, orbit, first-person modes
  formats/
    a3d.ts              — .a3d terrain loader (from ENGINE_ANALYSIS.md)
    xp.ts               — .xp sprite loader (column-major)
  generators/
    procedural.ts       — noise-based terrain generation
    contour-bridge.ts   — WibWob contour engine as terrain source
  module.json
```

## Autoresearch Loop

### Metric: `ui_score` (higher is better)

Same rubric as other visual modules:

- **RENDER** — does the 3D projection look correct and convincing?
- **TERRAIN** — is the landscape interesting, varied, readable?
- **INTERACTION** — camera controls, movement, responsiveness
- **PERFORMANCE** — frame rate stability at target resolution
- **NOVELTY** — does this feel like something new, not just a port?

### Loop Strategy

1. Projection + flat terrain grid (prove the maths work)
2. Heightmap with biome materials (prove the terrain pipeline)
3. Post-pass with density shading (prove the Asciicker look)
4. Physics + flight model (prove it's a game not a renderer)
5. Water reflections
6. Integration with TouchLab capture pipeline
7. Procedural terrain generation
8. Polish and optimise

## Acceptance Criteria

- [ ] Isometric projection renders correctly at terminal resolution
- [ ] Heightmap terrain with at least 4 biome types
- [ ] 2x2 sample downsampling post-pass produces Asciicker-style output
- [ ] Cliff illusion via elevation bits (not explicit wall geometry)
- [ ] Depth buffer resolves triangle occlusion correctly
- [ ] Camera controls: orbit, zoom, pan
- [ ] Physics: gravity + thrust flight model (Virus/Zarch style)
- [ ] Procedural terrain generation (not just loaded .a3d files)
- [ ] Output capturable via `captureText` for TouchLab piping
- [ ] Stable 10fps+ at 80x24 terminal resolution
- [ ] Can load at least one original .a3d map file
- [ ] ui_score reaches 8.0+ in autoresearch loop

## Stories

- [ ] S1: Autoresearch baseline — scaffold module, empty canvas
- [ ] S2: Projection maths — buildProjection(), projectWorld()
- [ ] S3: Triangle rasterizer — rasterizeTriangle() with depth buffer
- [ ] S4: Terrain patches — heightmap model, quad-to-triangle split
- [ ] S5: Post-pass — 2x2 downsampling, char density shading
- [ ] S6: Biome materials — colour/glyph per terrain type
- [ ] S7: Cliff illusion — elevation bits, side-face glyphs
- [ ] S8: Camera system — orbit, zoom, follow-cam
- [ ] S9: Physics — gravity, thrust, inertia, collision
- [ ] S10: Water — reflection plane, underwater tint
- [ ] S11: Procedural terrain — noise generator, contour bridge
- [ ] S12: .a3d loader — parse original Asciicker maps
- [ ] S13: TouchLab integration — captureText piping
- [ ] S14: Polish — performance, interaction, visual quality
