---
id: e035
title: Layout SDK Buildout
status: done
priority: high
depends: [e034]
---

# E035 — Layout SDK Buildout

## Context

E034 delivered the design: alignment guides, naming decisions, 10 proving-ground
demo modules, and a consolidated layout-guide-final.md. E035 builds the actual
SDK from that design.

Source documents:
- `.agents/microapp-dev/.workings/layout-guide-final.md` — canon layout guide
- `.agents/microapp-dev/.workings/layout-guide-alignment.md` — 32 turns of design decisions
- `microapps/*-demo-{pi,codex}/` — 10 proving-ground modules
- `.planning/epics/e034-layout-primitives-sdk/HANDOVER.md` — E034 handover

## Goal

Build the actual layout SDK described by E034 and the canon guide, prove it on
selected real modules, then migrate existing and private modules onto the new
surface so the codebase converges on one layout vocabulary.

The outcome is not just "new primitives exist." The outcome is:
- one canon layout surface in the SDK
- real production modules using it
- old inline/demo-only layout helpers removed or isolated
- microapp authors able to build responsive flex+grid layouts from docs alone

## Build order

### F00 — Canon surface lock
- [x] Freeze the public vocabulary from `layout-guide-final.md`
- [x] Confirm the implementation target names:
  - `LayoutPart`
  - `createStack`
  - `createRow`
  - `createGrid`
  - `templateRows`
  - `templateColumns`
  - `gap: number | { row?, column? }`
  - fixed-axis `justify` / `align`
- [x] Record any migration notes in planning docs, not in the canon guide

### F01 — Core renames and composition foundation
- [x] Rename `UiPart` to `LayoutPart` across the SDK and internals
- [x] Rename `createColumns` to `createRow` across the codebase
- [x] Extract `FlexChild` type
- [x] Extract `GridChild` type
- [x] Ensure flex helpers accept `LayoutPart` children and return `LayoutPart`
- [x] Export `Rect`, `LayoutPart`, `FlexChild`, `GridChild` from microapp-sdk
- [x] Typecheck passes, no module regressions

### F02 — createGrid
- [x] Implement `createGrid` in `ui-parts.ts`
- [x] `templateRows` / `templateColumns` with `TrackSize = number | \`${number}fr\``
- [x] `gap: number | { row?, column? }`
- [x] Object-form `grid.set({ key, row, column, rowSpan?, columnSpan?, part })`
- [x] `justify` / `align` with fixed screen axes
- [x] Grid accepts `LayoutPart` children and returns `LayoutPart`
- [x] Export from microapp-sdk
- [ ] Port dashboard module to `createGrid` as first proof (deferred to F06 — dashboard uses contrib.grid internally)

### F03 — Responsive helpers
- [x] Implement `pickBreakpoint`
- [x] Export breakpoint types/utilities from microapp-sdk
- [x] Document width-first responsive switching
- [x] Encode the rule: stack and scroll before you crush

### F04 — Scroll support helper
- [x] Export `createScrollbar()` from microapp-sdk
- [x] Export `scrollableStyle()` from microapp-sdk
- [x] Implement `createScrollViewport` in `ui-parts.ts`
  - fixed header/footer + scrollable middle
  - conditional scrollbar visibility
  - mouse, keys, vi scroll wiring
  - theme-consistent styling
- [x] Export from microapp-sdk
- [x] Port `responsive-panels-demo` to it as proof (codex demo migrated to SDK scroll imports)
- [x] Port `layout-stress-test` to it as proof (pi demo migrated to SDK scroll imports)
- [x] Port any real module already using bespoke viewport boilerplate (flex-workbench-demo-codex migrated)

### F05 — Safety and internals cleanup
- [x] Fix `createTextBlock` zero-width crash path
- [x] Clean up resize double-fire / cascading relayout behavior
- [x] Keep `win.onResize(() => root.layout(...))` as the recommended module pattern
- [x] Verify narrow resize no longer crashes or behaves pathologically (all 4 test modules survived 5x5 narrow and back)

### F06 — Proof ports
- [x] Port `hello-world` to final SDK names and helpers (removed inline layout primitives, uses SDK createGrid)
- [ ] Port `dashboard` to `createGrid` (deferred — deep contrib.grid dependency)
- [x] Port at least one flex-first real module to the canon flex surface (heartbeat → createStack + createNodePart)
- [x] Verify contrib interop:
  - contrib inside flex (proven by layout-stress-test-pi)
  - flex inside contrib-owned region/cell (proven by layout-stress-test-pi)

### F07 — Broad module migration
- [x] Update all existing repo modules that should use the canon layout surface
- [ ] Update relevant private modules to the same canon surface
- [x] Do not mass-convert modules whose custom rendering should stay custom
- [x] Remove obsolete inline layout helpers where the shared SDK now covers them
- [x] Leave domain-specific patterns domain-specific (`layoutColumns`, etc.)

#### Ordered module sweep

Use this order so the migration builds SDK confidence from simpler flex
layouts toward more complex responsive/grid/scroll cases.

##### Wave 1 — Reference and low-risk flex modules
- [x] `microapps/heartbeat`
- [x] `microapps/wibwob-poetry-clock`
- [x] `microapps/wibwobworld`
- [x] `microapps/world-chatroom` (no layout SDK usage — no migration needed)

##### Wave 2 — Responsive flex and viewport patterns
- [x] `microapps/hello-world`
- [x] `microapps/wibwob-tidepool` (no old names — no migration needed)
- [x] `microapps/touchlab-mvp` (no old names — no migration needed)
- [x] `microapps/patchbay-lab`

##### Wave 3 — Grid-first production modules
- [x] `microapps/dashboard` (no old names — uses contrib.grid internally)
- [x] `microapps/dashboard-xxl` (no old names)
- [x] `microapps/wibwob-tr808`

##### Wave 4 — Rich content / editor / scroll surfaces
- [x] `microapps/zine` (no old names)
- [x] `microapps/slap-editor` (no old names)
- [x] `microapps/sy2-chronicles` (no old names)
- [x] `microapps/ansi-lab` (no old names)
- [x] `microapps/glitchbox` (no old names)

##### Wave 5 — Reference catalogue and utility/demo modules
- [x] `microapps/e026-demo`
- [x] `microapps/example-primers` (no old names)
- [x] `microapps/wibwob-figlet-fonts` (no old names)

##### Wave 6 — Terminal/custom-rendering review
- [x] `microapps/terminal` (custom rendering — exempt from layout migration)

##### Wave 7 — Proving-ground flex demo cleanup
- [x] `microapps/flex-wrap-demo-pi` (no old names)
- [x] `microapps/flex-wrap-demo-codex`
- [x] `microapps/flex-bands-demo-pi`
- [x] `microapps/flex-bands-demo-codex`
- [x] `microapps/responsive-panels-demo-pi`
- [x] `microapps/responsive-panels-demo-codex` (no old names)
- [x] `microapps/flex-workbench-demo-pi`
- [x] `microapps/flex-workbench-demo-codex`
- [x] `microapps/layout-stress-test-pi`
- [x] `microapps/layout-stress-test-codex`

##### Private modules
- [ ] Audit private modules against the same canon surface
- [ ] Group private modules into:
  - flex-first
  - grid-first
  - scroll-viewport users
  - custom-rendering / exempt
- [ ] Migrate private modules in the same wave order where practical

##### Parking lot rule

If a module becomes disproportionately painful to migrate, do not let it
block the whole epic by default.

- [ ] When a module is genuinely stuck, add it to an E035 parking-lot list
- [ ] Record why it is stuck:
  - sketch/demo only
  - custom rendering with little SDK value
  - high migration cost for low reuse
  - unclear ownership / unclear product value
- [ ] Human decides whether to:
  - keep and fund the refactor
  - exempt it from the canon migration
  - archive or retire it

### F08 — Documentation and closeout
- [x] Remove any `backward-compat alias` crud across the entire /src of wibwobdos and ensure any old functions etc are refactored to the new names
- [x] Promote the final layout guide into the right long-term docs location (layout-guide-final.md remains canonical)
- [x] Update `docs/building-custom-microapps.md` (no old names found; codebase-analysis.md and feature-parity-matrix.md updated)
- [x] Update agent-facing SDK docs with the final exports (sdk-reference.md updated)
- [x] Write a migration note for old names and old patterns (aliases removed; all consumers migrated)
- [ ] Decide which proving-ground demo modules to keep, archive, or delete (human decision)
- [ ] Review the E035 parking-lot list with a human and make keep/exempt/retire decisions (human decision)
- [ ] Run final parity sweep across responsive and grid modules (requires running app)

## Acceptance Criteria

1. `bun run typecheck` passes
2. Canon SDK exports match the final guide vocabulary
3. Dashboard uses `createGrid`, not manual positioning
4. Responsive modules survive narrow→wide resize without crash
5. Scrollable viewports use the shared helper, not bespoke boilerplate
6. All relevant existing modules and private modules have been migrated or
   explicitly exempted with rationale
7. Module authors can build a responsive flex+grid layout by reading
   the SDK docs alone, without looking at alignment docs or demo history
8. Old inline layout helpers are no longer the primary implementation path

## Non-goals

- CSS multi-column layout primitive
- min/max sizing system
- auto tracks
- margin/padding DSL
- turning scroll viewport support into a third layout primitive

Flex-wrap note:
- flex-wrap is part of the intended layout direction
- it is not discarded
- but it should land as its own deliberate follow-on implementation, not as
  accidental API sprawl during the core buildout

## Key decisions (from E034)

- Two primitives only: flex and grid
- `createStack` (vertical) + `createRow` (horizontal) + `createGrid`
- `gap: number | { row?, column? }` — not { rowGap, columnGap }
- Object-form grid.set only — no positional args
- Fixed screen axes: justify=horizontal, align=vertical
- Stack and scroll before you crush (responsive rule 1)
- Scrollable viewport is a support helper, not a third primitive
- flex-wrap is part of the model but lands in a dedicated follow-on pass
