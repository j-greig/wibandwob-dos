# Asciicker Autoresearch — Ideas

## Tried (scorer plateaued at 9.3)
- Combat system, HP, damage — no score change
- NPC dialogue with space key — no score change
- Visual-only polish (sky gradient, fog colour, material tweaks) — scorer reads text not PNGs
- Minimap overlay — contributed to first 9.0 jump

## What moved the needle (8.4 → 9.3)
- World objects (trees/bushes/rocks) as multi-cell sprites: 8.4 → 8.7
- NPCs with patrol AI: 8.7 → 9.0 (biggest single jump)
- Dirt paths + particles/fireflies: 9.0 → 9.1
- Weather system + item pickups + inventory: 9.1 → 9.3

## Ideas to push past 9.3

### Multi-file architecture (CRAFT axis)
- Split into terrain.ts, render.ts, world.ts, player.ts
- The scoring checklist says "Well-architected" at 9 — multi-file might push to 9.5
- Risk: module loader may not support relative imports between module files
- Test first: create a simple modules/asciicker/util.ts and import from index.ts

### Proper triangle rasterization (RENDER axis)
- Currently each terrain cell = one projected point with 2-wide block
- Real triangle filling: project 4 corners of each cell, interpolate between them
- Would eliminate gaps and create smoother terrain surfaces
- Complex but would significantly improve render fidelity

### Animated sprites (BEAUTY axis)  
- Player sprite doesn't animate (always same frame)
- Add walk cycle: 4 directional frames, cycle based on movement
- NPCs should also animate their patrol
- Directional facing based on movement vector

### Sound/music integration (SURPRISE axis)
- Play ambient sounds through chiptune-studio integration
- Rain/storm weather triggers rain audio
- Footstep sounds on different terrain types

### Persistence via registerSnapshot (CRAFT axis)
- Save player position, inventory, weather state
- Restore on window reopen
- Uses the microapp SDK's workspace persistence

### Loading actual .a3d map data (WORLD axis)
- The original asciicker has .a3d format map files
- Parse binary format and render the actual game map
- Would make WORLD go to 10 (faithful port)

### Water reflections via buffer post-process (BEAUTY axis)
- Current reflection code exists but may not be effective
- Flip and dim terrain cells below water line
- Animated ripple effect on reflections
