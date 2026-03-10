---
Status: ready-for-agent
Type: implementation-brief
Epic: e018-contour-studio-v2-terrain-foundation
Audience: Pi
---

# Pi Brief — WibWobWorld Iso / 3D MVP

## Goal

Build the first useful pseudo-3D / isometric view for `WibWobWorld` as a **second private microapp window**, not as a mode inside the main `WibWobWorld` window.

This is deliberate:
- `WibWobWorld` stays the top-down overworld surface
- `WibWobWorld Iso` is a sibling renderer experiment
- both windows should be able to stay open at the same time
- if the iso view proves stable and clearly belongs in the same UX later, we can merge it into the main view as a render mode

Do **not** start by merging the two windows.

## What Already Exists

The data/export seam and iso scaffold are already in place.

Code:
- [/Users/james/Repos/wibandwob-dos/modules-private/wibwobworld/index.ts](/Users/james/Repos/wibandwob-dos/modules-private/wibwobworld/index.ts)
- [/Users/james/Repos/wibandwob-dos/modules-private/wibwobworld-iso/index.ts](/Users/james/Repos/wibandwob-dos/modules-private/wibwobworld-iso/index.ts)
- [/Users/james/Repos/wibandwob-dos/modules-private/wibwobworld-iso/module.json](/Users/james/Repos/wibandwob-dos/modules-private/wibwobworld-iso/module.json)
- [/Users/james/Repos/wibandwob-dos/src/services/terrain-model.ts](/Users/james/Repos/wibandwob-dos/src/services/terrain-model.ts)

Commands already wired:
- `microapp.wibwobworld.open`
- `microapp.wibwobworld.save-terrain-export`
- `microapp.wibwobworld-iso.open`
- `microapp.wibwobworld-iso.set-source`
- `microapp.wibwobworld-iso.reload`

Current state:
- `WibWobWorld` can export a structured terrain artifact to `scratch/captures/*.json`
- `WibWobWorld Iso` can open one of those files and render a minimal pseudo-isometric preview
- `/state` already reports `sourcePath`, source terrain metadata, and iso-view metadata

## Why The Earlier Smoke Spec Was Wrong

Do **not** build the iso view against plain contour text captures alone.

Reason:
- text captures do not reliably preserve elevation
- text captures do not preserve sea level
- text captures do not preserve biome classification
- text captures do not preserve water semantics in a machine-readable way

The correct fixture input is the structured `WibWobWorld` JSON artifact, with text capture used only as a review/debug companion if helpful.

## Canonical Artifact Contract

Export shape lives in:
- [/Users/james/Repos/wibandwob-dos/src/services/terrain-model.ts](/Users/james/Repos/wibandwob-dos/src/services/terrain-model.ts)

Relevant type:
- `SavedTerrainArtifact`

The artifact contains:
- `version`
- `source`
- `exportedAt`
- `renderMode`
- `levels`
- `playerLabel`
- `playerGlyph`
- `playerSprite`
- `focus`
- `map`

The embedded `map` contains:
- `width`
- `height`
- `seed`
- `terrainIdx`
- `terrainName`
- `seaLevel`
- `minElevation`
- `maxElevation`
- `waterCoverage`
- `vegetationEnabled`
- `hills`
- `cells`

Each cell includes:
- `elevation`
- `relativeElevation`
- `waterDepth`
- `isWater`
- `biome`
- `treeDensity`

This is the contract the iso view should trust.

## Product / UX Intent

Think of this as the start of a world-map camera, closer to:
- an SNES `Super Mario World` overworld camera
- or a toy isometric terrain viewer

Not yet:
- a full game
- a pathfinder
- a true 3D engine
- a merged render mode in the main window

The full WibWob-DOS desktop remains the gameplay surface. Long term, an agent can keep:
- `WibWobWorld` open
- `WibWobWorld Iso` open
- reader / notes / diary windows open
- later a roguelike room view open from `E019`

## Architecture Rules

1. Keep `WibWobWorld Iso` as a separate private microapp for now.
2. Do not add a second terrain-generation path.
3. Do not infer terrain from ASCII when the JSON artifact already exists.
4. Keep logic split:
   - file loading / app wiring in the iso microapp
   - projection math in a reusable service if it starts to grow
5. Preserve API/state parity.
6. Treat resize/focus/close as first-class requirements, not polish.

## What To Improve

The current iso scaffold is intentionally minimal. Your job is to make it visually and structurally useful.

Priority areas:
- better projection
- clearer sense of height
- clearer distinction between water / shore / land / vegetation / peaks
- stable behavior on resize
- readable output at both medium and large window sizes

Good targets:
- water reads lower than land
- ridges and peaks visually stand up from flats
- forests decorate terrain without destroying readability
- the player/focus marker still reads clearly

## Suggested Implementation Direction

Start from:
- [/Users/james/Repos/wibandwob-dos/modules-private/wibwobworld-iso/index.ts](/Users/james/Repos/wibandwob-dos/modules-private/wibwobworld-iso/index.ts)

Likely next seam if needed:
- `src/services/terrain-iso-render.ts`

That service could own:
- sampling / decimation
- projection coordinates
- vertical exaggeration
- stacked column or slope glyph selection
- colour application
- clipping to viewport

The microapp should stay thin:
- command path
- file loading
- window wiring
- `describeState()`
- `captureText()`

## Render Direction

Pragmatic first pass is enough. It does not need to be pretty-perfect.

Promising techniques in TUI:
- offset diamond projection
- vertical columns using `|`, `/`, `\`, `_`
- elevation exaggeration by raising higher tiles upward
- colour + glyph combos by biome
- water as lower, flatter, wider surfaces
- peaks as sparse bright caps

You can stay ASCII-heavy or mix in a little Unicode if it remains stable.

Do not let pretty glyph choices break alignment.

## Controls / Commands

Already available:
- open by file path
- switch source file
- reload current file

If you add controls, keep them simple and API-visible.

Reasonable additions if useful:
- vertical exaggeration up/down
- sample density / zoom
- toggle biome colouring
- toggle column shading

Only add them if they materially help the MVP.

## Smoke / Verification Procedure

Use the API, not guesswork.

1. Restart the app so the latest microapp code is loaded.
2. Confirm health:

```bash
curl -s http://127.0.0.1:8099/health
```

3. Open `WibWobWorld`:

```bash
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.open"}'
```

4. Export terrain:

```bash
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld.save-terrain-export"}'
```

5. Get the newest artifact:

```bash
ls -1t scratch/captures/wibwobworld_*.json | head -n 1
```

6. Open the iso window against that file:

```bash
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwobworld-iso.open","args":{"path":"scratch/captures/FILE.json"}}'
```

7. Read `/state` and verify:
- both windows are present
- `wibwobworld-iso` has the expected `sourcePath`
- viewport metadata updates after resize if you support it

8. Screenshot or export for review.

## Acceptance Target

Ship when these are true:

- [ ] `WibWobWorld Iso` opens as a second microapp window while `WibWobWorld` stays open
- [ ] it loads a structured `WibWobWorld` JSON artifact, not just a text capture
- [ ] the same input renders deterministically on repeated opens
- [ ] water reads as lower than land
- [ ] at least one ridge / hill artifact clearly reads with height
- [ ] resize does not crash or wedge the app
- [ ] `/state` exposes `sourcePath`, render metadata, and viewport metadata
- [ ] `captureText()` or export output is useful enough for review

## Non-Goals

Do not do these in this pass:
- merge iso into the main `WibWobWorld` window
- invent a second terrain model
- rework overworld gameplay
- solve portal / room transitions from `E019`
- depend on bare contour text as the only fixture

## Handoff Note

If the iso view lands well as a sibling surface, we can later decide whether to:
- keep it as a dedicated inspection window
- or fold it into `WibWobWorld` as another render mode

That decision should come **after** the MVP proves stable and readable.
