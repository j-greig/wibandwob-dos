---
Status: not-started
Type: epic
GitHub issue: —
PR: —
---

# E018 — WibWobWorld Terrain Foundation

## TL;DR

Create `WibWobWorld`, the first reusable terrain-generation surface for a future SimCity 2000 / Dwarf Fortress-style TUI game played inside the full WibWob-DOS desktop. The first shipped slice is not a game yet: it is a deterministic landscape generator with elevation-aware terrain classification, water, vegetation, hills, peaks, and API-visible state. `WibWobWorld` ships as a new private microapp in `modules-private/`, while the existing built-in `Contour Studio` stays intact as a prototype.

## Top-Level Product Assumptions

- `WibWobWorld` is not just a terrain toy; it is the first private gameplay microapp in a larger agent-played desktop world
- the whole WibWob-DOS TUI desktop is the gameplay surface
- the in-app agent should eventually be able to play through the same desktop surfaces a human sees
- the agent should be able to open support windows during play
- support windows may include readers, notes, logs, prompts, and a gameplay diary
- OBS/Twitch streaming is part of the intended usage context
- the existing built-in `Contour Studio` remains untouched as the old prototype
- stretch goal later: quasi-3D / isometric rendering over the same terrain model, not a second terrain system

## External Engine Notes

Useful context from the adjacent MVP repo:

- local MVP repo: [/Users/james/Repos/wibandwob-rogue](/Users/james/Repos/wibandwob-rogue)
- MVP package manifest: [/Users/james/Repos/wibandwob-rogue/package.json](/Users/james/Repos/wibandwob-rogue/package.json)
- vendored ROT build: [/Users/james/Repos/wibandwob-rogue/libs/rot/rot.min.js](/Users/james/Repos/wibandwob-rogue/libs/rot/rot.min.js)

Current recommendation:
- use `rot-js` as the underlying roguelike toolkit for map generation, FOV, pathfinding, RNG, and turn scheduling
- use WibWob-DOS as the desktop/window/playback architecture
- keep game-specific state, agents, diaries, and multi-window play flows in custom code rather than searching for a monolithic TS/JS TUI game engine

Why:
- `rot-js` is mature and directly relevant to roguelike simulation
- terminal UI libraries like Blessed or Terminal Kit help with rendering/input, but they are not game-management engines
- there does not appear to be a strong drop-in TS/JS engine for the full "agent-played desktop roguelike/sim" problem

Upstream references:
- `rot-js` homepage: https://ondras.github.io/rot.js/hp/
- `rot-js` GitHub: https://github.com/ondras/rot.js
- `rot-js` npm: https://www.npmjs.com/package/rot-js
- `terminal-kit` GitHub: https://github.com/cronvel/terminal-kit
- `terminal-kit` npm: https://www.npmjs.com/package/terminal-kit
- `blessed` GitHub: https://github.com/chjj/blessed

## Read First

- [/Users/james/Repos/wibandwob-dos/AGENTS.md](/Users/james/Repos/wibandwob-dos/AGENTS.md)
- [/Users/james/Repos/wibandwob-dos/docs/000-docs-overview.md](/Users/james/Repos/wibandwob-dos/docs/000-docs-overview.md)
- [/Users/james/Repos/wibandwob-dos/src/services/contour-engine.ts](/Users/james/Repos/wibandwob-dos/src/services/contour-engine.ts)
- [/Users/james/Repos/wibandwob-dos/src/windows/contour-window.ts](/Users/james/Repos/wibandwob-dos/src/windows/contour-window.ts)
- [/Users/james/Repos/wibandwob-dos/src/windows/terrain-lab-window.ts](/Users/james/Repos/wibandwob-dos/src/windows/terrain-lab-window.ts)

## Architecture Bucket

Content surfaces + simulation foundation.

## Objective

Build a modular terrain substrate that can later support:
- elevation-aware exploration
- uphill/downhill traversal
- water and basin logic
- future z-band / multi-layer exploration
- later settlement / simulation systems

The first milestone is `WibWobWorld`, not the full game.

## Product Context

The long-term goal is to use the full WibWob-DOS desktop as the visible gameplay architecture.

- an in-app agent should eventually be able to play the game through the same desktop surfaces a human sees
- OBS can stream the TUI desktop to Twitch while the agent plays
- the agent should be able to spawn supporting windows during play
- those supporting windows may include readers, notes, logs, prompts, and a gameplay diary

This means the terrain slice must behave like a first-class desktop app surface:
- open through the command registry
- expose semantic `describeState()`
- remain controllable via the local HTTP API
- coexist cleanly with the rest of the desktop

## Why WibWobWorld First

`WibWobWorld` is the right first game-facing seam, while the built-in `Contour Studio` remains a prototype.

- `Contour Studio` already proves the contour prototype and should not be destabilized.
- `Terrain Lab` is a composition demo proving the player can be embedded with side panels.
- the game-facing work should start as a separate sibling app surface so iteration can be more aggressive
- putting it in `modules-private/` matches the likely product boundary for game-specific work

Target outcome:
- `WibWobWorld` generates a SimCity 2000-ish TUI landscape with water, vegetation, hills, ridges, and peaks
- the existing `Contour Studio` remains available as the old prototype
- the same terrain model can later be consumed by gameplay windows or other simulation views

## Current State

Today the terrain stack already provides:
- deterministic terrain archetypes (`archipelago`, `ridge valley`, `meadow`, etc.)
- hill generation
- normalized heightmap generation
- marching-squares contour rendering
- animated contour player embedding

Current gaps:
- no reusable terrain map object
- no explicit sea level
- no water classification
- no vegetation pass
- no gameplay-facing tile classes
- no semantic distinction between surface rendering and raw contour lines

## Design

### Core Rule

Do not turn the existing built-in `Contour Studio` into the terrain model.

Keep this split:
- `modules-private/wibwobworld/`
  - microapp shell, keys, focus, `describeState()`, command registration
- `contour-engine.ts`
  - terrain archetypes, raw hills, raw heightmap, contour rendering
- `terrain-model.ts` (new)
  - terrain semantics: signed/relative elevation, sea level, biome classification, water coverage
- `terrain-render.ts` (new)
  - glyph + colour rendering for terrain views

That keeps the feature modular, testable, and reusable by future game windows.

### Module Placement

Implementation target:
- new microapp under `modules-private/`
- loaded by `src/services/module-loader.ts`
- opened through dynamic `microapp.*` commands

Important note:
- `modules-private/` is a git submodule
- planning and integration notes can live in this repo
- actual private module code should be authored in the private modules repo, then pulled in through the submodule

### Proposed New Modules

#### F01 — `src/services/terrain-model.ts`

Owns conversion from raw heightmap to terrain semantics.

Responsibilities:
- derive signed or relative elevation from normalized heightmap
- apply `seaLevel`
- classify tiles into water / shore / land / hill / peak / vegetation bands
- compute metrics like water coverage and min/max elevation
- remain pure and framework-free

Suggested shape:

```ts
type TerrainBiome =
  | "deep-water"
  | "shallow-water"
  | "shore"
  | "plain"
  | "forest"
  | "hill"
  | "ridge"
  | "peak";

type TerrainCell = {
  elevation: number;
  relativeElevation: number;
  waterDepth: number;
  isWater: boolean;
  biome: TerrainBiome;
  treeDensity: number;
};

type TerrainMap = {
  width: number;
  height: number;
  seed: number;
  terrainName: string;
  seaLevel: number;
  minElevation: number;
  maxElevation: number;
  waterCoverage: number;
  cells: TerrainCell[][];
};
```

#### F02 — `src/services/terrain-render.ts`

Owns terrain glyph and colour selection.

Responsibilities:
- render terrain rows from `TerrainMap`
- support render modes:
  - `terrain`
  - `contours`
  - `hybrid`
- keep water visually dominant
- avoid inline window-local style logic

### Terrain Classification Rules

First-pass classes:
- `deep-water`
- `shallow-water`
- `shore`
- `plain`
- `forest`
- `hill`
- `ridge`
- `peak`

First-pass semantics:
- cells below sea level become water
- shallow band near sea level becomes shore
- vegetation appears on suitable land bands, not in deep water or on sharp peaks
- hills/ridges/peaks derive from relative elevation thresholds

### Render Rules

Suggested first-pass glyphs:
- deep water: `≈`
- shallow water: `~`
- shore: `.`
- plain: `,`
- forest: `t` or `Y`
- hill: `n`
- ridge: `^`
- peak: `A`

Suggested colour direction:
- water: blue / cyan family
- vegetation: green family
- shore: sand / tan
- hills: olive / muted brown-green
- peaks: pale stone / gray

Important rule:
- introduce semantic terrain colour tokens rather than hardcoded literals inside the window

### Window Behavior

`WibWobWorld` should support:
- deterministic reroll from seed
- terrain archetype switching
- sea level adjustment
- vegetation toggle
- contour level adjustment
- save/export snapshot

Suggested keys:
- `m` cycle render mode: terrain / contours / hybrid
- `t` cycle terrain archetype
- `r` reseed
- `+` / `-` contour levels
- `[` / `]` lower / raise sea level
- `v` toggle vegetation overlay
- `s` save snapshot

### API / State Parity

`describeState()` should expose enough semantics for agent and control use:
- `renderMode`
- `terrain`
- `seed`
- `levels`
- `seaLevel`
- `waterCoverage`
- `minElevation`
- `maxElevation`
- `vegetationEnabled`
- `contentPreview`

This is mandatory. The control surface must not need to infer terrain state from rendered text alone.

## Acceptance Criteria

- [ ] **AC-1:** `WibWobWorld` opens through the module command path and behaves as a first-class window.
  - Test: open via the registered `microapp.*.open` command and verify focus, movement, resize, close, and `/state` all work.

- [ ] **AC-2:** Terrain generation is deterministic by seed and terrain type.
  - Test: same seed + terrain + viewport + options produce the same terrain metadata and visible output.

- [ ] **AC-3:** Below-sea-level terrain renders as water.
  - Test: adjusting sea level changes water coverage and visibly changes terrain output.

- [ ] **AC-4:** Vegetation renders only on suitable land bands.
  - Test: vegetation toggle changes output; forests do not appear in deep water or peak bands.

- [ ] **AC-5:** `describeState()` reports semantic terrain data, not just a preview string.
  - Test: `/state` includes terrain, seed, seaLevel, waterCoverage, minElevation, maxElevation, renderMode, vegetationEnabled.

- [ ] **AC-6:** Rendering logic is split cleanly from terrain semantics.
  - Test: new terrain model service can be imported and exercised without Blessed.

- [ ] **AC-7:** `WibWobWorld` remains a reusable foundation rather than the game itself.
  - Test: the terrain model can be consumed later by a second window without extracting logic back out of the window.

- [ ] **AC-8:** the existing built-in `Contour Studio` remains unchanged as a prototype surface.
  - Test: `contour.open` still opens the old built-in window, and `WibWobWorld` opens separately.

## Planned Features / Stories

- [ ] **F01 — Terrain model extraction**
  - add `terrain-model.ts`
  - derive terrain map from existing heightmap
  - compute semantic elevation and biome bands

- [ ] **F02 — Water pass / sea level**
  - add configurable `seaLevel`
  - classify water / shore / land
  - compute `waterCoverage`

- [ ] **F03 — Terrain renderer**
  - add `terrain-render.ts`
  - render terrain-only and hybrid modes
  - introduce semantic terrain colours

- [ ] **F04 — WibWobWorld microapp integration**
  - add the microapp shell in `modules-private/`
  - register commands and snapshot behavior
  - keep UI thin
  - wire state + keybindings to new services

- [ ] **F05 — Vegetation pass**
  - deterministic tree placement
  - simple suitability heuristic by elevation band

- [ ] **F06 — Save/export/state parity**
  - export snapshots
  - verify API visibility and live state parity

- [ ] **F07 — Game bootstrap follow-on**
  - use `TerrainMap` as the substrate for a future playable terrain/game view
  - likely next: cursor + inspect tile + movement cost by elevation delta

## Out of Scope

For this epic’s first shipped slice:
- full SimCity simulation
- full Dwarf Fortress simulation
- rivers and erosion
- subterranean layers
- construction, economy, population, combat
- pathfinding-heavy gameplay
- settlement systems

Those depend on the terrain substrate landing cleanly first.

## Stretch Goal

If the first terrain substrate lands cleanly, a strong follow-on visual experiment is:
- quasi-3D / isometric rendering of generated terrain in the TUI

Constraints:
- difficult in a terminal, but not impossible
- should remain a rendering layer over the same terrain model rather than a separate terrain system
- should not compromise the simpler top-down terrain slice required for M01

## Risks

- Normalized `0..1` height output may be too flattened for convincing water/shore bands unless relative elevation is handled carefully.
- Colour choices can regress theme consistency if implemented as inline literals instead of semantic tokens.
- If water/vegetation logic lands inside `contour-window.ts`, the feature will become harder to reuse for the actual game.
- If the first slice tries to include rivers, erosion, and z-bands together, scope will blow up.

## Follow-On Path

If E018 lands cleanly, the next game-adjacent slice should be:
1. cursor + tile inspection over `TerrainMap`
2. slope-aware movement costs
3. region / basin detection
4. future z-band exploration

That is the correct path toward the larger game idea without collapsing into premature simulation complexity.
