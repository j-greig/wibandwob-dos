---
id: e035
title: Layout SDK Buildout
status: not-started
priority: high
depends: [e034]
---

# E035 — Layout SDK Buildout

## Context

E034 delivered the design: alignment guides, naming decisions, 10 proving-ground
demo modules, and a consolidated layout-guide-final.md. E035 builds the actual
SDK from that design.

Source documents:
- `.agents/module-dev/.workings/layout-guide-final.md` — canon layout guide
- `.agents/module-dev/.workings/layout-guide-alignment.md` — 32 turns of design decisions
- `modules/*-demo-{pi,codex}/` — 10 proving-ground modules
- `.planning/epics/e034-layout-primitives-sdk/HANDOVER.md` — E034 handover

## Goal

Build the actual layout SDK described by E034 and the canon guide, prove it on
selected real modules, then migrate existing and private modules onto the new
surface so the codebase converges on one layout vocabulary.

The outcome is not just "new primitives exist." The outcome is:
- one canon layout surface in the SDK
- real production modules using it
- old inline/demo-only layout helpers removed or isolated
- module authors able to build responsive flex+grid layouts from docs alone

## Build order

### F00 — Canon surface lock
- [ ] Freeze the public vocabulary from `layout-guide-final.md`
- [ ] Confirm the implementation target names:
  - `LayoutPart`
  - `createStack`
  - `createRow`
  - `createGrid`
  - `templateRows`
  - `templateColumns`
  - `gap: number | { row?, column? }`
  - fixed-axis `justify` / `align`
- [ ] Record any migration notes in planning docs, not in the canon guide

### F01 — Core renames and composition foundation
- [ ] Rename `UiPart` to `LayoutPart` across the SDK and internals
- [ ] Rename `createColumns` to `createRow` across the codebase
- [ ] Extract `FlexChild` type
- [ ] Extract `GridChild` type
- [ ] Ensure flex helpers accept `LayoutPart` children and return `LayoutPart`
- [ ] Export `Rect`, `LayoutPart`, `FlexChild`, `GridChild` from microapp-sdk
- [ ] Typecheck passes, no module regressions

### F02 — createGrid
- [ ] Implement `createGrid` in `ui-parts.ts`
- [ ] `templateRows` / `templateColumns` with `TrackSize = number | \`${number}fr\``
- [ ] `gap: number | { row?, column? }`
- [ ] Object-form `grid.set({ key, row, column, rowSpan?, columnSpan?, part })`
- [ ] `justify` / `align` with fixed screen axes
- [ ] Grid accepts `LayoutPart` children and returns `LayoutPart`
- [ ] Export from microapp-sdk
- [ ] Port dashboard module to `createGrid` as first proof

### F03 — Responsive helpers
- [ ] Implement `pickBreakpoint`
- [ ] Export breakpoint types/utilities from microapp-sdk
- [ ] Document width-first responsive switching
- [ ] Encode the rule: stack and scroll before you crush

### F04 — Scroll support helper
- [ ] Export `createScrollbar()` from microapp-sdk
- [ ] Export `scrollableStyle()` from microapp-sdk
- [ ] Implement `createScrollViewport` in `ui-parts.ts`
  - fixed header/footer + scrollable middle
  - conditional scrollbar visibility
  - mouse, keys, vi scroll wiring
  - theme-consistent styling
- [ ] Export from microapp-sdk
- [ ] Port `responsive-panels-demo` to it as proof
- [ ] Port `layout-stress-test` to it as proof
- [ ] Port any real module already using bespoke viewport boilerplate

### F05 — Safety and internals cleanup
- [ ] Fix `createTextBlock` zero-width crash path
- [ ] Clean up resize double-fire / cascading relayout behavior
- [ ] Keep `win.onResize(() => root.layout(...))` as the recommended module pattern
- [ ] Verify narrow resize no longer crashes or behaves pathologically

### F06 — Proof ports
- [ ] Port `hello-world` to final SDK names and helpers
- [ ] Port `dashboard` to `createGrid`
- [ ] Port at least one flex-first real module to the canon flex surface
- [ ] Verify contrib interop:
  - contrib inside flex
  - flex inside contrib-owned region/cell

### F07 — Broad module migration
- [ ] Update all existing repo modules that should use the canon layout surface
- [ ] Update relevant private modules to the same canon surface
- [ ] Do not mass-convert modules whose custom rendering should stay custom
- [ ] Remove obsolete inline layout helpers where the shared SDK now covers them
- [ ] Leave domain-specific patterns domain-specific (`layoutColumns`, etc.)

#### Ordered module sweep

Use this order so the migration builds SDK confidence from simpler flex
layouts toward more complex responsive/grid/scroll cases.

##### Wave 1 — Reference and low-risk flex modules
- [ ] `modules/heartbeat`
- [ ] `modules/wibwob-poetry-clock`
- [ ] `modules/wibwobworld`
- [ ] `modules/world-chatroom`

##### Wave 2 — Responsive flex and viewport patterns
- [ ] `modules/hello-world`
- [ ] `modules/wibwob-tidepool`
- [ ] `modules/touchlab-mvp`
- [ ] `modules/patchbay-lab`

##### Wave 3 — Grid-first production modules
- [ ] `modules/dashboard`
- [ ] `modules/dashboard-xxl`
- [ ] `modules/wibwob-tr808`

##### Wave 4 — Rich content / editor / scroll surfaces
- [ ] `modules/zine`
- [ ] `modules/slap-editor`
- [ ] `modules/sy2-chronicles`
- [ ] `modules/ansi-lab`
- [ ] `modules/glitchbox`

##### Wave 5 — Reference catalogue and utility/demo modules
- [ ] `modules/e026-demo`
- [ ] `modules/example-primers`
- [ ] `modules/wibwob-figlet-fonts`

##### Wave 6 — Terminal/custom-rendering review
- [ ] `modules/terminal`

##### Wave 7 — Proving-ground flex demo cleanup
- [ ] `modules/flex-wrap-demo-pi`
- [ ] `modules/flex-wrap-demo-codex`
- [ ] `modules/flex-bands-demo-pi`
- [ ] `modules/flex-bands-demo-codex`
- [ ] `modules/responsive-panels-demo-pi`
- [ ] `modules/responsive-panels-demo-codex`
- [ ] `modules/flex-workbench-demo-pi`
- [ ] `modules/flex-workbench-demo-codex`
- [ ] `modules/layout-stress-test-pi`
- [ ] `modules/layout-stress-test-codex`

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
- [ ] Promote the final layout guide into the right long-term docs location
- [ ] Update `docs/building-custom-modules.md`
- [ ] Update agent-facing SDK docs with the final exports
- [ ] Write a migration note for old names and old patterns
- [ ] Decide which proving-ground demo modules to keep, archive, or delete
- [ ] Review the E035 parking-lot list with a human and make keep/exempt/retire decisions
- [ ] Run final parity sweep across responsive and grid modules

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
