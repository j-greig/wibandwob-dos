# Plan Review — `autoresearch.md`

## Verdict

The plan is directionally correct and broadly matches the reverse-engineering in [`ENGINE_ANALYSIS.md`](/Users/james/Repos/wibandwob-dos/autoresearch/asciicker/ENGINE_ANALYSIS.md). The main gaps are:

- it under-specifies the 2x2 sample-buffer contract, even though that is a defining architectural constraint
- it slightly misstates `auto_mat` as a simple RGB15-to-cell map without enough emphasis on the 12-step fg/bg-swap behavior
- it gets the cliff mechanism mostly right, but needs to say more clearly that cliffs are a post-pass/material-selection illusion, not a terrain-wall pass
- it does not treat scorer behavior as a first-class constraint, so an early rewrite could regress the benchmark even if the renderer is more correct
- it is optimistic on performance unless rasterization scope is explicitly bounded

## 1. Consistency Check

The current phase order is mostly consistent with the recommended port order in [`ENGINE_ANALYSIS.md`](/Users/james/Repos/wibandwob-dos/autoresearch/asciicker/ENGINE_ANALYSIS.md#L874):

- Projection before rasterization: consistent
- Terrain top-surface rendering before water/sprites/meshes: consistent
- Water before sprites/meshes: inconsistent with the analysis recommendation

The analysis recommends:

1. projection
2. triangle rasterizer
3. terrain top-surface shading/material lookup
4. 2x2 post-pass
5. reflection/water
6. sprites
7. meshes

The plan instead puts sprites and meshes in Phase 3 before water in Phase 4. That is not fatal, but it contradicts the stated “maximum visual impact” order. If the goal is fidelity to the original engine architecture, water should stay ahead of or at least alongside sprite/mesh work. If the goal is benchmark score, sprites may still be worth pulling earlier because they are scorer-visible. The plan should say which objective wins.

## 2. Completeness Check

### Missing or under-specified items

#### 2x2 downsample model

This is present, but not clear enough. The plan currently says “render to 2x resolution sample buffer” and “each 2x2 block -> average RGB -> auto_mat lookup”. That is too compressed for the most important visual mechanism in the engine.

What should be stated explicitly:

- the sample buffer is the authoritative render target; terminal cells are only a post-pass view
- all terrain, water reflections, sprites, and meshes render into sample space first
- the terminal output is derived strictly by collapsing each 2x2 sample block into one cell
- this is not optional polish; without it, the output will not read like asciicker

#### `auto_mat` LUT accuracy

The current wording is directionally right but slightly too simple. The plan should explicitly mention:

- `auto_mat` is `32 * 32 * 32 * 3`
- output is `(bg, fg, glyph)`
- the 6-character ramp `" ..::%"` becomes 12 effective blend levels by swapping fg/bg for the upper half
- the LUT is approximating arbitrary RGB15 colours by choosing a best pair from nearby xterm cube corners, not merely quantizing to one colour

Without that, Phase 2.1 reads like a generic palette map, which risks an implementation that misses the key trick.

#### Cliff illusion mechanism

The plan is close, but should be firmer:

- no explicit cliff-wall geometry for terrain
- elevated samples come from `visual` bit `0x8000`
- post-pass inspects neighborhood elevation patterns to choose `shade[4][16]` row
- silhouette glyphs `-` and `_` are added from depth/elevation comparisons in the final pass

Right now “cliff/elevation illusion” is correct, but still leaves room for an implementer to drift back toward “draw vertical faces”.

#### `.xp` parsing gotcha

This is included and accurate. No change needed except making it a named risk, not just a loader acceptance criterion.

#### Risk summary items

The plan only carries forward risk #1 from the analysis. It should also explicitly include:

- risk #2: column-major `.xp` parsing
- risk #3: assuming cliffs are geometry
- performance risk: triangle rasterizer in TypeScript can fail budget if patch traversal is too broad or allocations slip into hot loops

### Missing engineering details that matter

- Patch UV/material sampling is absent. The analysis calls out exact `u,v` lookup over `visual[8][8]`; the plan should mention that terrain samples interpolate into visual-space material coordinates, not just “use visual index”.
- Premultiplied patch/world XY (`* HEIGHT_CELLS`) is absent from implementation guidance. That matters for matching the C++ math and reducing repeated work.
- Border sharing between adjacent patches is absent. It matters once real `.a3d` data lands, because crack-free borders are a geometry/data invariant, not only a rasterizer property.

## 3. Feasibility Check

### Triangle rasterizer

Feasible, but only with aggressive scoping.

What is realistic:

- integer screen coords
- typed-array sample buffers
- structure-of-arrays in hot paths
- terrain-only rasterization first
- fixed 8 fps target
- reuse scratch arrays and triangle setup storage

What is risky if attempted too early:

- generic “blend(sample, z, bc)” callbacks in the inner loop
- per-pixel object creation
- rendering the entire world every frame without patch culling
- adding sprites, meshes, reflections, and terrain into one unoptimized pass before measuring

Recommendation: Phase 1 should explicitly limit terrain rendering to a cull radius around camera and treat “terrain-only sample-space renderer at 8 fps” as its own acceptance gate.

### File-size constraint

Feasible, but the proposed structure is still too coarse in a few places. `index.ts` as “module setup, window, game loop, input, HUD” will likely exceed 300 lines again if gameplay remains there during the rewrite. Split it earlier:

- `index.ts` should register the module and wire services only
- move loop/input/HUD/state into siblings

### Water reflections

Feasible, but the plan should scope them as a second render using mirrored projection and then a post-pass merge. “Merge normal + reflected in post-pass” is fine, but do not imply a full water-surface geometry system.

## 4. Scoring Check

This is the biggest planning weakness.

The scorer in [`autoresearch.sh`](/Users/james/Repos/wibandwob-dos/autoresearch/asciicker/autoresearch.sh#L87) heavily rewards currently visible world/control features:

- WORLD checks biomes, water, vegetation, weather, explorable terrain
- CONTROLS checks movement, camera follow, yaw, zoom, player visibility, collision, status
- BEAUTY checks glyph variety, colour variety, water effects, status bar, coherence
- CRAFT reads the source, so multi-file architecture helps

That means a renderer-only rewrite can score lower than v1 even if it is architecturally correct.

### Specific risk

Phase 1 as written ends with:

- gap-free terrain
- simple colours
- no auto_mat
- no cliff illusion

If that phase is implemented by replacing the existing module wholesale, the scorer will likely see:

- RENDER up
- WORLD down
- CONTROLS down if player/camera shell is temporarily missing or reduced
- BEAUTY down
- CRAFT up slightly

Net result: likely worse than 9.3.

### What will actually produce stepwise score gains

The phased plan only works for the benchmark if each phase preserves or reuses the current visible shell:

- keep WASD, yaw, zoom, status bar, player marker/sprite, and basic world variation alive during renderer swaps
- keep procedural world generation until `.a3d` is ready
- do not remove weather/water/objects/NPC evidence from source until replacements exist

The right benchmark-aware reading is:

- Phase 1 should replace only the terrain render path, not reset the whole module
- gameplay/world shell from v1 should remain in place as a compatibility layer until equivalent replacements land

## 5. Proposed Plan Changes

## Recommended structural rewrite

Add an explicit Phase 0 and tighten the later order.

### Phase 0: Rewrite safety rails

- Keep the existing gameplay/control shell alive while replacing the renderer underneath it
- Split `index.ts` immediately so CRAFT improves before renderer work starts
- Add a benchmark guard: Phase 1 is only “keep” if average score does not fall materially below baseline unless RENDER jumps enough to justify a temporary dip

This phase is not engine fidelity work; it is benchmark protection.

### Revised order

1. Phase 0: architecture split + renderer seam + preserve current controls/world shell
2. Phase 1: projection + terrain rasterizer + sample buffer
3. Phase 2: true 2x2 post-pass + `auto_mat` + cliff illusion + material shading
4. Phase 3: water/reflection pass
5. Phase 4: real data loaders (`.a3d`, `.xp`, `.akm`)
6. Phase 5: sprite/mesh rendering from loaded assets
7. Phase 6: gameplay/persistence/polish

Why this order:

- it matches the analysis more closely
- it keeps the benchmark safer
- it delays the file-format work until the renderer contract is stable

If benchmark score is the dominant goal over engine fidelity, move `.xp` sprite loading earlier as a narrow slice, but say explicitly that this is a scorer-driven deviation.

## Suggested text changes for `autoresearch.md`

These are the changes I would make when you edit the plan later.

### Replace the pipeline description with this stronger version

> The original is a strict 3-stage pipeline:
>
> `World data -> sample buffer at 2x terminal resolution -> post-pass -> terminal cells`
>
> Everything renders into sample space first. The displayed terminal cell grid is only a 2x2 collapse of that higher-resolution buffer. This is not optional polish; it is core to the engine’s look.

### Tighten Phase 1 acceptance criteria

Add:

- terrain-only renderer holds 8 fps on a bounded camera-centered patch set
- existing movement/camera/status shell remains functional during renderer replacement
- no per-frame allocations in raster hot paths

### Tighten Phase 2.1 / 2.2 wording

Replace with:

- `auto_mat` precomputes `32*32*32` RGB15 inputs into `(bg, fg, glyph)`
- 6 glyph ramp `" ..::%"` yields 12 effective blend levels by reversing fg/bg order for the upper half
- post-pass averages each 2x2 sample block in RGB space, then resolves the final terminal cell through `auto_mat`

### Tighten Phase 2.3 wording

Replace with:

- terrain cliffs are not rendered as explicit wall triangles
- `visual` bit `0x8000` lifts terrain samples by one elevation unit
- post-pass inspects neighbor elevation/depth patterns to select `Material.shade[4][16]` row and ledge glyphs `-` / `_`

### Expand the risk section

Add:

- Post-pass is the primary fidelity risk
- `.xp` is column-major; generic row-major parsers will silently load wrong
- cliffs are a post-pass illusion, not extra terrain geometry
- TS raster performance depends on typed arrays, culling, and zero-allocation hot loops

## Bottom Line

The plan is fundamentally sound, but it needs one correction in emphasis:

- the hard problem is not “triangle rasterization” in isolation
- the hard problem is “sample-space renderer plus faithful post-pass” while preserving enough visible world/control shell to avoid autoresearch score collapse

If that is made explicit, the plan will match the engine analysis and the benchmark reality much better.
