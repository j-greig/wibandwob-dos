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

Extract the layout system from hello-world v2 and the proving-ground demos into
a clean, DRY, CSS-aligned SDK that third-party agents and module authors can use
without reading 3000 lines of alignment docs.

## Features

### F00 — Core renames and type extraction
- [ ] Rename `UiPart` to `LayoutPart` across codebase
- [ ] Rename `createColumns` to `createRow` across codebase
- [ ] Extract `FlexChild` type (distinct from current `StackChild`)
- [ ] Extract `GridChild` type
- [ ] Export `Rect`, `LayoutPart`, `FlexChild`, `GridChild` from microapp-sdk
- [ ] Typecheck passes, all modules still work

### F01 — createGrid
- [ ] Implement `createGrid` in ui-parts.ts
- [ ] `templateRows` / `templateColumns` with `TrackSize = number | \`${number}fr\``
- [ ] `gap: number | { row?, column? }`
- [ ] Object-form `grid.set({ key, row, column, rowSpan?, columnSpan?, part })`
- [ ] `justify` / `align` (fixed screen axes: justify=horizontal, align=vertical)
- [ ] Returns `LayoutPart` — nestable inside flex, flex nestable inside grid
- [ ] Export from microapp-sdk
- [ ] Port dashboard module to createGrid as proof

### F02 — Scrollable viewport helper
- [ ] Export `createScrollbar()` from microapp-sdk
- [ ] Export `scrollableStyle()` from microapp-sdk
- [ ] Implement `createScrollViewport` in ui-parts.ts
  - Fixed header/footer + scrollable middle
  - Conditional scrollbar (auto/always/never)
  - Mouse, keys, vi scroll wiring
  - Theme-consistent styling
- [ ] Export from microapp-sdk
- [ ] Port responsive-panels-demo to use it as proof
- [ ] Port layout-stress-test to use it as proof

### F03 — createTextBlock safety fix
- [ ] Fix createTextBlock to clamp minimum width to 1
- [ ] Or: make scrollable opt-in rather than default
- [ ] Verify narrow resize no longer crashes

### F04 — Responsive helpers
- [ ] Implement `pickBreakpoint` utility
- [ ] Document width-first breakpoint pattern
- [ ] Export from microapp-sdk

### F05 — Module ports
- [ ] Port hello-world v2 to final SDK names
- [ ] Port dashboard to createGrid
- [ ] Port poetry-clock to final SDK names
- [ ] Port zine scrollable viewport to createScrollViewport
- [ ] Verify all ported modules at multiple window sizes

### F06 — Documentation
- [ ] Write final `docs/building-custom-modules.md` layout section
- [ ] Update `.agents/microapp-sdk.md` with new exports
- [ ] Migration guide: old names to new names
- [ ] Remove or archive proving-ground demo modules

## Acceptance Criteria

1. `bun run typecheck` passes
2. All existing modules work at current sizes
3. Dashboard uses createGrid, not manual positioning
4. Responsive modules survive narrow→wide resize without crash
5. Scrollable viewports use shared helper, not bespoke boilerplate
6. Module authors can build a responsive flex+grid layout by reading
   the SDK docs alone, without looking at alignment docs or demos

## Non-goals

- CSS multi-column layout primitive
- min/max sizing system
- auto tracks
- margin/padding DSL
- flex-wrap in core (stays proving-ground)

## Key decisions (from E034)

- Two primitives only: flex and grid
- `createStack` (vertical) + `createRow` (horizontal) + `createGrid`
- `gap: number | { row?, column? }` — not { rowGap, columnGap }
- Object-form grid.set only — no positional args
- Fixed screen axes: justify=horizontal, align=vertical
- Stack and scroll before you crush (responsive rule 1)
- Scrollable viewport is a support helper, not a third primitive
- flex-wrap is part of the model but deferred from core
