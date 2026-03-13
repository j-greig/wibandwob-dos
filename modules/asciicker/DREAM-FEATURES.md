# Asciicker — Dream Features

A TypeScript reimplementation of the asciicker rendering engine for WibWob-DOS.
Not a port of the full game — a faithful recreation of the 3D ASCII rendering
concept as a blessed microapp window.

Original: https://github.com/msokalski/asciicker (MIT, C++/WASM)

---

## Core Concept

Asciicker renders a 3D voxel/heightmap world entirely in ASCII characters
with 256-colour ANSI foreground+background per cell. The original uses:
- Heightmap terrain (patches with height values)
- Isometric-ish projection (yaw-rotatable camera)
- CP437 glyph set for terrain texturing
- 256-colour palette for lighting/materials
- Sprite-based characters and objects
- Physics, combat, inventory

We are NOT porting combat/inventory/multiplayer. We ARE porting:
1. The 3D terrain renderer (heightmap → ASCII cells)
2. Camera controls (yaw rotation, zoom, WASD movement)
3. A procedural terrain generator
4. Sprite rendering for a player character
5. Day/night lighting cycle

---

## Phase 1: Core Renderer (MVP)

### 1. Heightmap Terrain
- 2D grid of height values (uint16)
- Each cell has a material/colour
- Height creates visual depth through vertical stacking
- Higher cells occlude lower cells behind them

### 2. Isometric Projection
- Top-down-ish view with depth
- Camera position (x, y, z) controls viewport
- Yaw rotation (4 or 8 directions)
- Zoom level affects visible area

### 3. ASCII Material System
- Each terrain type maps to a glyph + fg/bg colour pair
- Grass: various green shades, glyphs like ., :, ;
- Water: blue tones, ~ ≈ characters
- Stone: grey, # ▓ █ characters
- Sand: yellow/brown, . · ∙
- Trees: green on brown, ♣ ♠ ▲ △

### 4. Depth Rendering
- Cells rendered back-to-front
- Height creates the 3D effect by shifting cells upward
- Shading based on surface normal (lighter tops, darker sides)
- Simple shadow from a directional light

---

## Phase 2: World & Movement

### 5. Procedural Terrain Generation
- Perlin/simplex noise for heightmap
- Biome assignment based on height + moisture
- Rivers cut through terrain following gravity
- Flat areas for settlements

### 6. Player Character
- Simple sprite: @ or a multi-char figure
- WASD movement across the terrain
- Camera follows player
- Collision with terrain height

### 7. Camera Controls
- Q/E: rotate yaw
- +/-: zoom in/out
- Arrow keys or WASD: move player/camera
- Smooth scrolling (lerp camera to target)

---

## Phase 3: Polish & Life

### 8. Day/Night Cycle
- Palette shifts over time
- Dawn/dusk colour temperature changes
- Night: darker palette, stars in sky cells
- Shadows rotate with sun position

### 9. Animated Elements
- Water surface ripples (cycling glyphs)
- Swaying trees (slight glyph variation)
- Clouds casting moving shadows
- Weather effects (rain as falling characters)

### 10. NPCs / Creatures
- Simple AI-driven sprites wandering the terrain
- Animals following paths
- Villagers in settlements

### 11. Sound Landscape
- If chiptune available: ambient sounds based on biome
- Water near rivers, wind on mountains, birds in forests

---

## Stretch Goals

### 12. World Editor Mode
- Click to raise/lower terrain
- Paint materials
- Place objects/sprites

### 13. Multiplayer View
- Show other WibWob-DOS instances as characters
- Via PartyKit room integration

### 14. Procedural Quests
- Agent-generated quest text
- Simple fetch/explore objectives
- Tied to terrain features

---

*The goal is to make the blessed window feel like a living world
you can walk through, not just a tech demo. Start with terrain
that looks RIGHT, then add life.*
