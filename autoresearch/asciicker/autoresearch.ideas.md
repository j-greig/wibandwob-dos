# Autoresearch Ideas — Asciicker 3D ASCII World Renderer

## Done / Stale
- DONE: heightmap terrain with fractal noise, 8 biomes
- DONE: isometric + 3D projection with yaw rotation
- DONE: depth buffer, back-to-front column rendering
- DONE: player sprite from asciicker player-nude.xp (5x8 multi-cell)
- DONE: screen-relative WASD movement
- DONE: fog-of-distance, sky gradient, twinkling stars
- DONE: rivers carved mountain-to-sea with sandy banks
- DONE: procedural stone ruins on grassland
- DONE: 2-wide column rendering (fixes vertical stripe gaps)
- STALE: imported player sprite at original scale — too small to affect scoring

## Live Ideas
- NPC sprites — port more .xp character files from asciicker source
- Animated water with foam caps (started in earlier configs, could push further)
- Day/night cycle — shift sky gradient + lighting over time
- Weather effects — rain particles, fog density changes
- Map persistence — save/load terrain seeds + player position
- Minimap in corner showing top-down view of explored area
- Biome transitions — smoother blending at boundaries instead of hard edges
- Tree/object LOD — simpler glyphs at distance, detailed up close
- Sound integration — biome-specific ambient via chiptune-studio
- Multi-level terrain — caves/tunnels below surface (heightmap as layers)
- Collision detection — buildings/ruins as solid obstacles
- Object interaction — enter buildings, pick up items
- Frame rate adaptive detail — reduce column count at low fps
