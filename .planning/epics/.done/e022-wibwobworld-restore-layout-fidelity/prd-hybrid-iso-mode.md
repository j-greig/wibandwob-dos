# PRD: WibWobWorld Hybrid Iso Mode (Contour + Isometric Split)

## Goal
Implement a **single-window hybrid render mode** in `microapps-private/wibwobworld/index.ts` where:
- LEFT pane shows the existing contour/terrain map view.
- RIGHT pane shows an isometric terrain projection derived from the same world.
- Both panes update from the same world state and remain side-by-side in the WibWobWorld window.

## Root Cause (Intent Gap)
The current `"hybrid"` mode in `renderTerrainMap(...)` is a per-cell contour/terrain blend, not a split-pane hybrid. The intended feature is a **layout-level hybrid composition** (2 renderers in one window), using the iso projection logic from `microapps-private/wibwobworld-iso/index.ts` (`renderIso`).

## Product Behavior

### 1) Visual layout and proportions
- Hybrid mode uses the body content area (between header and status bars) as a 2-column split.
- LEFT pane: map viewport (`mapBox`) rendered with `renderTerrainMap(...)` in **contour/terrain map style**.
- RIGHT pane: iso viewport (`isoBox`) rendered with `renderIso(...)` rows.
- Split ratio in v1: **50/50**, with `leftW = Math.max(1, Math.floor(innerBodyW / 2))`, `rightW = Math.max(1, innerBodyW - leftW)`.
- First-person mode remains full-width in `fpBox` (no iso pane).
- v1 keeps this strictly inside WibWobWorld; no second window.

### 2) `renderIso` contract
`renderIso(artifact: SavedTerrainArtifact, width: number, height: number): string[]`
- Input:
  - `artifact.map` with terrain cells/biomes/elevation/water.
  - `artifact.focus` for player marker placement.
  - Viewport `width`/`height` for target text canvas.
- Output:
  - Array of tagged rows (`string[]`) suitable for `setContent(rows.join("\n"))` on a Blessed `tags: true` box.
- Rendering behavior:
  - Samples map using stride so iso diamond fits viewport.
  - Projects sampled cells to pseudo-isometric coordinates.
  - Paints biome-colored top glyphs, optional vertical columns for elevation, and focus marker `@` on top.
  - Returns right-trimmed rows.

### 3) Correct dimension source
For render/layout sizing in this feature, dimensions must come from the **frame parent** (`frame.parent.width/height` semantics), not `win.body.width/height`.
- Requirement: derive inner frame dimensions from the body’s parent node dimensions before `root.layout(...)`.
- Rationale: `win.body.width/height` can resolve to non-numeric values and produce `NaN` in this path.

### 4) Artifact caching rule
Iso source artifact must be cached and recreated **only when any of these change**:
- `seed`
- `seaLevel`
- `levels`
- `terrainIdx`

Must **not** recreate artifact on every render tick (e.g., resize repaint, cursor movement, sidebar toggle, key repeat unrelated to those keys).

Cache shape:
- `hybridArtifactCacheKey: string` (`${seed}|${seaLevel.toFixed(4)}|${levels}|${terrainIdx}`)
- `hybridArtifact: SavedTerrainArtifact | undefined`

On cache miss:
- Rebuild terrain/focus artifact in-memory.
On cache hit:
- Reuse existing artifact and only rerender text for current viewport size.

### 5) `isoBox` layout and ownership
- `isoBox` is a new blessed box created in `openWorld(...)` as a child of `bodyNode` (sibling of `mapBox` and `fpBox`).
- `isoBox` uses:
  - `tags: true`
  - `style: host.theme().body`
  - geometry managed via `applyRect(...)`/layout code (no `hide/show` toggling).
- In `body.layout(rect)`:
  - `renderMode === "hybrid"`: place `mapBox` left half, `isoBox` right half, collapse `fpBox`, collapse `infoBlock` in v1.
  - non-hybrid map modes: `mapBox` full area (or existing sidebar behavior), collapse `isoBox` and `fpBox`.
  - firstperson: `fpBox` full area, collapse `mapBox` and `isoBox`.

### 6) Guard conditions
Hard bail from render pass when layout is not drawable:
- `if (innerW < 1 || innerH < 1) return;`
- For hybrid pane draws, also require computed pane widths/heights >= 1 before calling renderers.

## Exact File Changes (`microapps-private/wibwobworld/index.ts`)

### Add
1. `renderIso(...)` helper (ported from `microapps-private/wibwobworld-iso/index.ts`, no file IO code).
2. Iso constants/helpers used by `renderIso`:
   - `ISO_EXAGGERATION`
   - biome color/glyph lookup helpers.
3. In-memory hybrid artifact cache state inside `openWorld(...)`:
   - `hybridArtifactCacheKey`
   - `hybridArtifact`
   - helper `getHybridArtifact(): SavedTerrainArtifact` implementing cache rule above.
4. New `isoBox` blessed node and optional `isoPart` wrapper for restyle/destroy consistency.

### Modify
1. `body.layout(rect)`:
   - Add explicit branch for `renderMode === "hybrid"` with 50/50 map+iso split.
   - Ensure non-active panes are collapsed via zero-width rects.
2. Main `render()`:
   - Use parent-frame dimension source for `root.layout(...)`.
   - Add guard `innerW/innerH < 1` early return.
   - In hybrid mode:
     - render left map rows via existing `renderTerrainMap(...)` flow into `mapBox`.
     - render right iso rows via `renderIso(getHybridArtifact(), isoViewportW, isoViewportH)` into `isoBox`.
   - In non-hybrid modes keep current behavior.
3. `restyle()` and cleanup paths:
   - include `isoBox` style updates and destroy path.
4. `describeState()` payload:
   - include hybrid-specific viewport metadata (`hybridLeftWidth`, `hybridRightWidth`) when mode is hybrid.

### Keep unchanged
- Command IDs and command registry surface.
- Existing firstperson renderer and controls.

## What NOT to do (v1 constraints)
- No iso camera rotation/orbit controls.
- No artifact file read/write for hybrid rendering.
- No separate iso microapp window for this feature.
- No new control/API endpoint required for v1.

## Fix Options and Tradeoffs
1. Inline port of `renderIso` into `wibwobworld/index.ts` (recommended)
- Pros: fastest delivery, no cross-module dependency wiring.
- Cons: duplicated iso logic between microapps.

2. Extract shared iso renderer into a common service and import from both microapps
- Pros: single source of truth.
- Cons: larger refactor scope and higher integration risk for this slice.

3. Reuse saved JSON export pipeline as iso source
- Pros: leverages existing artifact schema.
- Cons: violates v1 no-file-IO constraint and adds unnecessary latency/fragility.

## Risks and Tests to Add

### Risks
- Layout regressions when switching among `terrain/contours/hybrid/firstperson`.
- Dimension-source mismatch can still produce blank panes if parent sizing is wrong.
- Cache invalidation errors could desync iso pane from map pane after parameter changes.

### Tests
1. Mode-switch layout smoke test
- Assert hybrid shows non-empty content in both `mapBox` and `isoBox`.
- Assert firstperson hides `isoBox` and fills `fpBox`.

2. Cache invalidation test
- Instrument cache rebuild count.
- Verify rebuild occurs only when one of `seed/seaLevel/levels/terrainIdx` changes.
- Verify no rebuild on cursor move, sidebar toggle, or plain rerender.

3. Resize robustness test
- Repeated resize events do not throw and panes redraw.
- Guard condition prevents renderer calls when width/height collapse to zero.

4. State metadata parity test
- In hybrid mode, `describeState()` includes render mode and split widths.

## Acceptance Criteria
- Selecting `HYBRID` in WibWobWorld produces left contour map + right iso terrain in one window.
- Right pane is generated from `renderIso` behavior as defined above.
- No per-tick artifact recreation; cache rule strictly enforced.
- No file I/O and no secondary window used by hybrid mode.
