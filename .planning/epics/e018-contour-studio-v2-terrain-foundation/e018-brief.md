---
Status: not-started
Type: epic
GitHub issue: —
PR: —
---

# E018 — Contour Studio v2 Terrain Foundation

## TL;DR

Turn `Contour Studio` into the first reusable terrain-generation surface for a future SimCity 2000 / Dwarf Fortress-style TUI game. The first shipped slice is not a game yet: it is a deterministic landscape generator with elevation-aware terrain classification, water, vegetation, hills, peaks, and API-visible state. `Contour Studio v2` is the thin UI shell; reusable terrain logic lives in new services.

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

The first milestone is `Contour Studio v2`, not the full game.

## Why Contour Studio First

`Contour Studio` is the cleaner first seam than `Terrain Lab`.

- `Contour Studio` is already a dedicated terrain canvas window.
- `Terrain Lab` is a composition demo proving the player can be embedded with side panels.
- A game-adjacent first step should produce a reusable terrain model and a focused landscape generator surface, not a more complex lab shell.

Target outcome:
- `Contour Studio v2` generates a SimCity 2000-ish TUI landscape with water, vegetation, hills, ridges, and peaks
- the same terrain model can later be consumed by a game window, `Terrain Lab`, or other simulation views

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

Do not turn `Contour Studio` into the terrain model.

Keep this split:
- `contour-window.ts`
  - UI wiring, keys, focus, `describeState()`
- `contour-engine.ts`
  - terrain archetypes, raw hills, raw heightmap, contour rendering
- `terrain-model.ts` (new)
  - terrain semantics: signed/relative elevation, sea level, biome classification, water coverage
- `terrain-render.ts` (new)
  - glyph + colour rendering for terrain views

That keeps the feature modular, testable, and reusable by future game windows.

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

`Contour Studio v2` should support:
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

- [ ] **AC-1:** `Contour Studio v2` opens through the existing command path and still behaves as a first-class window.
  - Test: open via `POST /commands/run {"id":"contour.open"}` and verify focus, movement, resize, close, and `/state` all work.

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

- [ ] **AC-7:** `Contour Studio v2` remains a reusable foundation rather than the game itself.
  - Test: the terrain model can be consumed later by a second window without extracting logic back out of the window.

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

- [ ] **F04 — Contour Studio v2 integration**
  - update `contour-window.ts`
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
