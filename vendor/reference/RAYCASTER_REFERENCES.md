# Raycaster and 3D ASCII Engine Reference Material

## Canonical Raycasting Tutorial

**Lode Vandevenne's raycasting tutorial** (lodev.org/cgtutor/raycasting.html)
The definitive walkthrough. Wolfenstein-style raycaster from scratch.
Covers: DDA algorithm, wall rendering, floor/ceiling, sprites, texture mapping.
Every JS/TS raycaster port references this. The maths port 1:1 to TypeScript.

## Key GitHub Repos

### JS/TS Raycasters
- `nicklockwood/RetroRampage` — Swift but the best-written tutorial of the
  maths. Each chapter builds incrementally. The explanations are better than
  any JS-specific repo.
- `3DSage/OpenGL-Raycaster_v1` — C, very clean, easy to read. Good for
  understanding the DDA loop without framework noise.
- `permadi.com/tutorial/raycast/` — classic early web tutorial, still
  referenced everywhere. Java applets but the maths is language-agnostic.

### Isometric / Axonometric Engines
- The original Asciicker by msokalski (github.com/msokalski/asciicker) —
  C++ isometric ASCII engine. Full analysis in ENGINE_ANALYSIS.md.
  Key insight: NOT a raycaster. It's a software rasterizer with triangle
  projection, barycentric interpolation, and a 2x2 sample-to-cell post-pass.

### ASCII-Specific 3D
- `a1k0n/donut.c` — the famous spinning donut. Shows how to project 3D
  geometry to ASCII using luminance-to-char mapping. The density ladder
  concept (`.,-~:;=!*#$@`) is directly applicable.
- `wwcd` style engines — various terminal 3D demos that project to
  character cells using brightness/density mapping.

## The Two Approaches

### Raycasting (Wolfenstein style)
- Cast rays from camera through each screen column
- Find wall intersection via DDA grid traversal
- Render vertical strips based on distance
- Good for: indoor environments, corridors, mazes
- Simple, fast, limited to 2.5D (no true elevation changes)
- The Lode tutorial covers this completely

### Software Rasterization (Asciicker style)
- Project 3D triangles to screen space
- Fill triangles with barycentric interpolation
- Depth buffer resolves occlusion
- Good for: outdoor terrain, elevation, complex geometry
- More complex but handles true 3D terrain with height variation
- ENGINE_ANALYSIS.md covers the Asciicker implementation

## What Our Engine Should Cherry-Pick

From Asciicker (isometric rasterizer):
- The projection maths (section 1 of ENGINE_ANALYSIS.md)
- The heightmap terrain model (5x5 height vertices, 8x8 material cells)
- The 2x2 sample downsampling to terminal cells
- The char density ladder for lighting
- The post-pass elevation/cliff illusion (cheaper than real wall geometry)
- The .a3d terrain format parser

From raycasters:
- The DDA algorithm for efficient grid traversal (useful for visibility)
- The concept of rendering vertical strips (useful for first-person mode)
- Floor/ceiling casting for indoor scenes

From WibWob-DOS primitives:
- `blankGrid` / `gridToText` for output
- `createTimer` for animation loop
- Theme tokens for colour coherence
- `captureText` for piping output to TouchLab
- `describeState` for agent introspection
- `renderFiglet` for in-world text rendering
- Contour/terrain generators as alternative terrain sources

## Virus / Zarch Reference

David Braben's Virus (1988, Acorn Archimedes / Amiga / Atari ST):
- Triangular ship over vector landscape
- Thrust/gravity physics (press fire to thrust upward)
- Flat-shaded polygon terrain with true 3D
- The landscape was a heightmap rendered as filled polygons
- Camera tracked the ship from behind/above
- Shooting, collecting pods, avoiding enemies
- The terrain rendering is conceptually identical to Asciicker's
  approach: heightmap -> triangles -> project -> fill -> depth test
- The physics model (gravity + thrust + inertia) is simple and
  would map well to an ASCII world

Key design elements worth borrowing:
- The feeling of floating over terrain with momentum
- Gravity as constant downward acceleration
- Thrust as player-controlled upward force
- The camera following the player with slight lag
- Shadow of the ship projected onto terrain below
