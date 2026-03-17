---
id: E034
title: Layout Primitives SDK
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E034 — Layout Primitives SDK

Extract the layout primitives proven in hello-world v2 into the microapp SDK,
then port existing modules to use them. Eliminates repeated manual grid/position
code across the codebase.

---

## Problem

Every module that needs a grid, responsive breakpoints, or positioned elements
reinvents the same patterns:

- dashboard: hand-positioned absolute boxes
- dashboard-xxl: manual {row, col, rowSpan, colSpan} + pixel math
- tr808: manual step-button grid with absolute positioning
- tidepool: manual sidebar + grid area with applyRect
- hello-world v2: inlined createGrid, pickBreakpoint, compass positioning

The audit (`.planning/chores/menu-nav-figlet-audit/chore-audit-layout-primitives.txt`)
documents the full gap analysis against blessed-contrib and Textual.

---

## What was proven in hello-world v2

Three primitives built inline and validated:

1. **createGrid** — CSS Grid-like layout with fr/fixed track sizes, row/col
   spans, and gap. Used for the XL 2-col grid (contour spanning 2 rows,
   stats top-right, clock bottom-right).

2. **pickBreakpoint** — Responsive breakpoint picker. Given width/height,
   returns the matching layout mode from an ordered list. Used for
   XL/L/M/S responsive switching.

3. **Compass positioning** — Position a tight-fit inner box within an outer
   transparent container. Nine positions (NW/N/NE/W/C/E/SW/S/SE). Used
   for figlet banner alignment. Key insight: move the container, not
   the content (blessed align/valign is broken for multi-line text).

---

## Build order

### F01 — Extract primitives to SDK

#### S01 — createGrid in microapp-sdk
- Move createGrid, resolveTrackSizes, and supporting types from
  hello-world/index.ts to src/services/microapp-sdk.ts (or a new
  src/core/layout-primitives.ts re-exported from the SDK)
- Export: createGrid, Grid, GridOptions, TrackSize, Rect, applyRect
- Hello-world imports from SDK instead of inlining
- AC: hello-world works identically, no inlined grid code
- AC: bun run typecheck clean

#### S02 — pickBreakpoint in microapp-sdk
- Move pickBreakpoint and Breakpoint type to SDK
- Export: pickBreakpoint, Breakpoint
- Hello-world imports from SDK
- AC: responsive switching works identically

#### S03 — Compass positioning in microapp-sdk
- Move COMPASS_ALIGN, compass types, and the container-positioning
  pattern to SDK as a reusable primitive
- Shape: positionInContainer(inner, outer, compass) or similar
- Export: Compass, COMPASS_ALIGN, positionInContainer
- Hello-world imports from SDK
- AC: compass toolbar works identically

### F02 — Port modules to SDK grid

#### S04 — Port dashboard to createGrid
- Replace hand-positioned absolute boxes with createGrid
- Measure code reduction
- AC: dashboard renders identically at all sizes
- AC: net line reduction documented

#### S05 — Port dashboard-xxl to createGrid
- Replace manual pixel math grid with createGrid
- AC: virtual canvas grid renders identically

#### S06 — Port tr808 to createGrid
- Replace manual step-button grid with createGrid
- AC: step sequencer grid renders and clicks correctly

#### S07 — Port tidepool to createGrid
- Replace manual sidebar + grid with createGrid + createStack
- AC: tidepool layout renders identically

### F03 — Responsive grid features

#### S08 — Column collapse breakpoints
- createGrid gains optional responsive config: at breakpoint X,
  reflow N-col grid to M-col
- Shape: responsive option on GridOptions, or a wrapper
- AC: a 3-col grid collapses to 2-col then 1-col on resize

#### S09 — Auto-sized rows/columns
- Track size "auto" measures content and allocates accordingly
- AC: a grid with one auto-width column sizes to its content

---

## Acceptance criteria

### SDK extraction
- [ ] AC-1: createGrid exported from microapp-sdk, hello-world uses it
- [ ] AC-2: pickBreakpoint exported from microapp-sdk
- [ ] AC-3: Compass positioning exported from microapp-sdk
- [ ] AC-4: All three primitives have JSDoc with usage examples
- [ ] AC-5: bun run typecheck clean after extraction

### Module ports
- [ ] AC-6: At least 2 modules ported to SDK createGrid
- [ ] AC-7: Net code reduction measured and documented
- [ ] AC-8: No visual regressions in ported modules

### Responsive
- [ ] AC-9: Column collapse works on at least one grid
- [ ] AC-10: Auto-sized tracks work for at least one use case

---

## Non-goals

- Full CSS Grid spec compliance (subgrid, named lines, etc)
- Dock primitive (current pattern of fixed-basis stack children works fine)
- Breaking changes to existing createStack/createColumns API

---

## Evidence

- Layout audit: `.planning/chores/menu-nav-figlet-audit/chore-audit-layout-primitives.txt`
- Hello-world v2 proving ground: `microapps/hello-world/index.ts`
- Vendor comparison (blessed-contrib Grid, Textual Grid): audit section 3-4
