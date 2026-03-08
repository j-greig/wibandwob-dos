---
id: E019
title: Rogue TUI Port
status: not-started
issue: 119
pr: ~
depends_on: []
---

# E019 — Wibwob Roguelike in the TUI

## TL;DR

Port the existing browser roguelike (`wibandwob-rogue`) to run as a first-class window inside WibWob-DOS. Wibwob, Scramble, and the ridge sentinel roam castle/forest/mountain maps inside the TUI desktop. An agent can play it through the same control surface a human uses. Stream it on Twitch. This is the first playable game in the OS.

## Read First

- `/Users/james/Repos/wibandwob-dos/AGENTS.md`
- `/Users/james/Repos/wibandwob-rogue/public/game.js` — monolithic browser game (2000+ lines; engine + renderer + input + DOM all mixed)
- `/Users/james/Repos/wibandwob-rogue/public/maps/overworld.js` — world generation (castle + forest + mountain, 288×72 tiles)
- `/Users/james/Repos/wibandwob-rogue/public/src/state/gameState.js` — entity/state shape
- `/Users/james/Repos/wibandwob-rogue/public/src/ai/behaviors.js` — behavior registry

## What Exists

The browser roguelike already ships:
- deterministic world generation across three biomes (castle, forest, mountain ridge)
- player entity `◕‿◕‿◕༽` with HJKL + arrow movement, squeeze mechanic
- Scramble `/ᐠ｡ꞈ｡ᐟ\` roaming forest/ridge
- ridge sentinel on the plateau
- mech cannon, magick system, FOV, turn loop
- behavior registry for AI (wobblers, screamers, mechs)
- multiplayer via PartyKit (optional for this port)

None of this needs to be reinvented. The game logic is sound. What needs replacing is the browser rendering and input layer.

## Why Now

E018 builds a terrain substrate. This epic builds something you can actually play. The roguelike already has characters, biomes, monsters, and a game loop. Port it first, then the terrain work in E018 can feed into a richer world later. Shipping a playable game in the TUI desktop is a stronger proof of concept than a landscape generator.

## Architecture

### Approach: Thin Adapter Pass

Do not rewrite the engine. Shim the renderer and input layer to blessed. Keep ROT.js (RNG, FOV, pathfinding). Drop the DOM, canvas, minimap, multiplayer for the first slice.

Split:

```
modules-private/wibwob-rogue/
  module.json              — microapp registration
  rogue-window.ts          — blessed window factory; owns focus, cleanup, describeState()
  rogue-renderer.ts        — replaces ROT.Display; draws tiles to blessed box
  rogue-input.ts           — maps blessed key events to game commands
  rogue-engine/            — thin wrapper around the rogue core (headless)
    engine.ts              — initState(seed), step(command), getFrame()
    overworld-adapter.ts   — strips window.createOverworldGenerator to a plain import
    rot-shim.ts            — provides ROT.RNG / FOV / Path in a Node/Bun context
```

The browser `game.js` is NOT imported directly. The rogue-engine layer extracts core logic (state, map gen, AI step, FOV) and calls it without DOM globals.

### Key Technical Decisions

**ROT.js in Bun:** `rot-js` is an npm package. It works in Node/Bun without a browser if you shim `window` for the parts that need it (RNG seed, FOV map). The Display class is dropped entirely.

**Multi-cell sprites:** `◕‿◕‿◕༽` spans multiple terminal columns due to Unicode width. Map the player to a single visible cell `◕` for the TUI render pass, or pad carefully. Revisit aesthetics after the game loop runs.

**Turn loop:** The game is already turn-driven on input. No animation loop needed. Each keypress calls `step(command)` → `getFrame()` → redraw the blessed box. Timer-driven effects (magick regen, star animation) can be dropped for the first slice.

**Map size:** 288×72 is large. The blessed window will show a viewport (camera) over the map, not the whole thing. Camera is already implemented in the browser version — port it directly.

**Window behavior:**
- opens through the command registry as a microapp
- exposes `describeState()` with: `biome`, `playerPos`, `seed`, `turn`, `hp`, `magick`, `lastMessage`
- controllable via `POST /windows/input` — agent sends keypresses exactly as a human would
- `GET /state` returns live semantic game state for agent use without scraping the screen

### What Gets Dropped (First Slice)

- DOM, canvas, minimap, splash screen, modals
- PartyKit multiplayer
- Mech cannon (uses `window.mechLogs` — isolate later)
- Music, audio
- Map export modal

### What Stays

- World generation (all three biomes)
- Player movement, squeeze mechanic, FOV
- Scramble + ridge sentinel AI
- Magick system (simplified — no timer, just turn-based regen)
- Message log (rendered as a status bar or side panel in the blessed window)

## Milestones

### M01 — Headless engine runs in Bun

Extract the core from `game.js` into a headless `rogue-engine/` module.

- `overworld-adapter.ts` strips `window.createOverworldGenerator` to a plain export
- `rot-shim.ts` provides ROT.RNG + FOV in Bun without DOM
- `engine.ts` exposes `initState(seed)`, `step(command)`, `getFrame()`
- `getFrame()` returns `Array<{x,y,ch,fg,bg}>` — no blessed, no canvas
- Smoke test: call `initState(42)` → `step('move-east')` × 10 → verify state changes without errors

AC: engine runs headless in a Bun test file with no `window` or `document`.

### M02 — First render in a blessed window

Wire the headless engine to a blessed box inside WibWob-DOS.

- `rogue-renderer.ts` paints `getFrame()` output into a blessed box line by line
- Viewport/camera centres on player position
- `rogue-input.ts` maps blessed key events to engine commands (HJKL, arrows, squeeze)
- Window opens via `microapp.wibwob.rogue.open` command
- Player moves around the castle; world renders in terminal colours

AC: open the window, move Wibwob around the castle, no crashes.

### M03 — Monsters, FOV, message log

- Scramble and the ridge sentinel are active and visible
- FOV is applied (explored/visible/dark tile states)
- Message log renders in a status strip at the bottom of the window
- `describeState()` reports biome, playerPos, turn, lastMessage
- Controllable via `POST /windows/input` — agent can play by sending keys

AC: an agent can navigate from castle to forest to mountain via the API and read its location from `/state`.

### M04 — Polish and integration

- Colour palette tuned for phosphor/dark themes via semantic tokens (no inline colour literals)
- Player sprite improved for terminal (single-cell or narrow multi-cell)
- Window chrome, focus, resize, close all work cleanly
- `bun run typecheck` clean
- Committed to `modules-private/`

AC: opens, plays, closes, `/state` parity, typecheck clean.

## Acceptance Criteria

- [ ] **AC-1:** Window opens via `microapp.wibwob.rogue.open` and closes cleanly.
- [ ] **AC-2:** Player moves across all three biomes with HJKL/arrow keys.
- [ ] **AC-3:** Scramble and ridge sentinel are visible and moving.
- [ ] **AC-4:** FOV obscures unexplored tiles.
- [ ] **AC-5:** Message log updates on movement and encounters.
- [ ] **AC-6:** `describeState()` returns biome, playerPos, turn, lastMessage, seed.
- [ ] **AC-7:** Agent can play via `POST /windows/input` and read game state from `GET /state`.
- [ ] **AC-8:** No DOM, canvas, or `window` globals in the engine layer.
- [ ] **AC-9:** `bun run typecheck` clean.
- [ ] **AC-10:** Existing browser roguelike in `wibandwob-rogue` is untouched.

## Risks

- **Unicode sprite width:** `◕‿◕‿◕༽` is 9+ columns wide. Terminal grid alignment will break without careful width handling. Mitigation: use a single-cell placeholder first, revisit sprite art later.
- **ROT.js DOM assumptions:** Some ROT internals may touch `window` or `document` even for RNG/FOV. Mitigation: run it in Bun and find the failure points early (M01 exists for exactly this).
- **Map size vs terminal size:** 288×72 is wider than any terminal. Mitigation: viewport/camera is already in the browser version — port it directly.
- **`game.js` coupling:** Core logic and browser wiring are tangled. Mitigation: the adapter pass does not untangle them — it only shims what needs shimming. Full extraction is a later epic.

## Out of Scope

- Rewriting the game engine
- Multiplayer in the TUI
- New biomes, items, or game mechanics
- Combat beyond what already exists
- Rivers, erosion, or terrain simulation (that is E018)
- Saving/loading game state

## Follow-On

If this lands cleanly:
1. Feed E018 terrain substrate into a new map generator for the rogue (richer world, water, elevation)
2. Agent plays a full session live with WibWob-DOS windows as supporting surfaces (log viewer, map overview, gameplay diary)
3. OBS streams the TUI to Twitch while the agent plays
