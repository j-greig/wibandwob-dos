---
id: E028
title: Responsive Column Layout System
status: not-started
issue: ~
pr: ~
depends_on: [E016]
---

# E028 — Responsive Column Layout System

A CSS-like column/grid layout engine for the WibWob-DOS desktop. Windows
arrange inside named column containers that reflow responsively based on
terminal width — 3 columns on wide terminals, 2 on medium, 1 on narrow.

---

## Problem

Currently all windows float freely in a single flat container. Tiling is
all-or-nothing (`tile_windows` command). There is no way to define spatial
zones (sidebar, main, inspector) that windows flow into, and no responsive
behaviour when the terminal resizes.

---

## Prior art

**Textual (Python TUI framework):**
- CSS-subset layout engine: `grid-columns`, `grid-rows`, `fr` units, `auto`
- `GridLayout.arrange()` resolves scalars → pixel regions per cell
- Column/row spans, gutter, min/max width constraints, auto-sizing
- Breakpoints not built-in but achievable via reactive watchers on app size

**Rich (Python terminal rendering):**
- `Columns` widget: wraps renderables into N columns, reflows on width change
- `Table` with flexible column widths
- No responsive breakpoints — purely width-proportional

**Blessed (our runtime):**
- No layout engine. All positioning is manual (top/left/width/height).
- Our `createStack`, `createColumns` primitives handle simple cases
- E025's `panel-layout.ts` does content reflow inside a single window

**CSS Grid/Flexbox (web):**
- `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`
- `@media` breakpoints for responsive column collapse
- This is the mental model we want, adapted for terminal cells

---

## Design

### Column containers

A `ColumnLayout` defines named zones on the desktop:

```
┌─────────────┬──────────────────────┬─────────────┐
│   sidebar   │        main          │  inspector  │
│   (20col)   │       (1fr)          │   (30col)   │
│             │                      │             │
│  [window]   │  [window]  [window]  │  [window]   │
│  [window]   │  [window]            │             │
└─────────────┴──────────────────────┴─────────────┘
```

- Each column has a width: fixed (`30`), fractional (`1fr`), or auto
- Windows assigned to a column arrange within it (tile, stack, or free)
- Unassigned windows float above the column grid (current behaviour)

### Responsive breakpoints

```
wide   (>= 160 cols):  3 columns — sidebar | main | inspector
medium (80-159 cols):   2 columns — main | inspector (sidebar hidden)
narrow (< 80 cols):     1 column  — main only (everything stacks)
```

Breakpoints are configurable per layout. On terminal resize, columns
collapse/expand and windows reflow into the surviving columns.

### Window-to-column assignment

- Commands: `layout.assign {windowId} {column}`
- Or automatic: window types have a default column (e.g. chat → sidebar,
  primer → main, finder → inspector)
- Agent and human can override assignments

### Intra-column arrangement

Within a column, windows arrange using existing patterns:
- Tile (equal-height stack)
- Cascade (overlapping, offset)
- Free (manual position within column bounds)

Default: tile within column.

---

## Build order

### S01 — Column container primitive
- `ColumnLayout` class: defines columns with fixed/fr/auto widths
- Resolves column widths on screen resize
- Blessed overlay zones (invisible containers that define bounds)
- AC: 3-column layout renders, columns resize with terminal

### S02 — Window-to-column assignment
- `layout.assign` command + API endpoint
- Default column mapping per window kind
- Windows clamp to their column bounds on assign
- AC: assign window to column, window snaps to column bounds

### S03 — Responsive breakpoints
- Breakpoint definitions: wide/medium/narrow thresholds
- On resize: detect breakpoint change, collapse/expand columns
- Windows in collapsed columns move to fallback column
- AC: resize terminal from 200 to 80 cols, columns collapse correctly

### S04 — Intra-column tiling
- Tile windows within a column (vertical stack, equal height)
- Respect column bounds, not full desktop
- AC: 4 windows in main column tile vertically within column bounds

### S05 — Layout presets and persistence
- Named layouts: "studio" (3-col), "focus" (1-col), "review" (2-col)
- Save/restore via workspace snapshots
- Agent can switch layouts via command
- AC: switch between presets, layout persists across restart

---

## Acceptance criteria

- [ ] AC-1: 3-column layout with fixed + fr widths renders correctly
- [ ] AC-2: Terminal resize causes column width recalculation
- [ ] AC-3: Windows assigned to columns snap to column bounds
- [ ] AC-4: Breakpoint collapse: 3 cols → 2 → 1 on narrow terminal
- [ ] AC-5: Windows in collapsed columns migrate to fallback column
- [ ] AC-6: Intra-column tiling works (vertical stack within bounds)
- [ ] AC-7: Layout presets switchable via command
- [ ] AC-8: Agent can assign windows + switch layouts via API
- [ ] AC-9: Unassigned windows float freely above column grid
- [ ] AC-10: `describeState()` includes column layout info
- [ ] AC-11: `bun run typecheck` clean

---

## Research notes

Textual's `GridLayout.arrange()` is the closest prior art — it resolves
scalar column specs (`1fr`, `auto`, `30`) into pixel regions, handles
spans, gutters, and min/max constraints. Our implementation will be
simpler (no cell spans, no nested grids) but the scalar resolution
approach is proven and worth following.

Key difference from Textual: we are laying out independent WINDOWS
(each with their own chrome, drag, resize) not widgets. The column
system constrains window bounds but windows remain draggable within
(and potentially across) columns.
