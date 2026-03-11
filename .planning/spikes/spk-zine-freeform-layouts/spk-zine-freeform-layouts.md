---
id: spk-zine-freeform-layouts
title: "Zine Freeform Canvas + Auto-Layout Modes"
status: in-progress
created: 2026-03-11
depends_on: []
tags: [zine, layout, interaction]
---

# Zine Freeform Canvas + Auto-Layout Modes

## TL;DR

A new kind of zine document with NO columns. Panels have explicit x/y/w/h
positions. Two interaction modes: FREEFORM (user drags panels anywhere,
positions persist to YAML) and AUTO-LAYOUT (algorithmic arrangement toggled
by keystroke). Multiple auto-layout algorithms: masonry, grid, stack, etc.

Column-based zines (existing) are unchanged. This is a new layout path
triggered by the absence of a `columns` field in the canvas YAML.

## Motivation

The column layout is editorial: structured, magazine-style, responsive.
But some canvases want to be mood boards, idea walls, or spatial compositions
where the user places things freely. The zine already has drag support
(panelPositionOverrides, mouse handlers) but it is bolted onto a column
layout. This spike makes freeform the primary mode for column-less documents
and adds auto-layout as a convenience toggle.

## What Already Exists

Reusable code in the current zine module (modules/zine/index.ts):

| Capability | Location | Reuse notes |
|-----------|----------|-------------|
| Click-to-focus + drag-to-move | Lines 668-735, handleMouse | Full drag lifecycle: mousedown captures offset from panel origin, mousemove updates position, mouseup releases. Already content-space-aware via pointerToContent(). |
| Position overrides | panelPositionOverrides Map, lines 145, 497-500 | Intercepts layout-engine positions per panel. Cleared on hot-reload/file-switch. For freeform: these become the PRIMARY positions, not overrides. |
| Render clamping | Lines 509-535, effectiveX/effectiveW | Clamps frame.left + width so panels cannot exceed viewport. Prevents right-edge bleed. Works regardless of layout mode. |
| Hit testing | hitPanel() in panel-layout.ts | Point-in-rect against all panel nodes. Used for click and double-click dispatch. Layout-agnostic. |
| YAML write-back | saveContentToYaml(), line 631 | Uses YAML.parseDocument for surgical edits preserving comments/formatting. Same pattern for writing x/y positions. |
| Double-click editor dispatch | EDITOR_DISPATCH map, openInEditor() | Type-based dispatch (text->editor, markdown->editor). Layout-agnostic. |
| Scrollable canvas | blessed scrollable box with scroll handlers | Vertical scroll with keyboard + mouse wheel. Freeform needs this for tall canvases. |

Key observation: the drag system is ALREADY freeform-capable. The gap
is that renderLayoutAndContent() always runs a layout engine and
overwrites positions, then drag overrides are applied on top. For true
freeform, the layout engine step is skipped entirely.

## YAML Schema Extension

Current column-based canvas:

    meta:
      title: "My Zine"
      format: "sy2-canvas-v1"
      columnHeaders: true
    columns:
      0: { header: "Col A" }
    panels:
      - id: foo
        col: 0
        w: 48
        h: 10

Proposed freeform canvas (no columns field, has layout field):

    meta:
      title: "My Board"
      format: "sy2-canvas-v1"
      layout: freeform          # freeform | masonry | grid | stack
    panels:
      - id: note-one
        type: text
        title: "First thought"
        x: 10                   # explicit position
        y: 5
        w: 30
        h: 8
        text: "whatever"

Detection uses the `format` field in meta (already parsed by content-loader):

    format: "sy2-canvas-v1"       -->  column layout (existing)
    format: "zine-freeform-v1"    -->  freeform / auto-layout modes

Dispatch in zine module:

    const isFreeform = doc.format === "zine-freeform-v1";

One field, one check, no inference from missing columns. Extensible to
future formats without overloading existing fields.

## Layout Modes

### Freeform (F)

Default for column-less documents. Panels placed at their YAML x/y. User
drags to reposition. Positions saved back to YAML on release (debounced).
No auto-arrangement. Canvas scrolls vertically to accommodate content.

### Masonry (M)

Pack panels into N columns (N chosen by viewport width / target column
width). Each panel placed in the shortest column. Panels keep their
natural w/h. Classic Pinterest/Masonry layout.

Algorithm:
  1. Determine N from viewport: N = max(1, floor(vw / targetColWidth))
  2. Initialise N column heights to 0
  3. For each panel (sorted by YAML order):
     a. Find shortest column
     b. Place panel at (colX, colHeight)
     c. Advance that column's height by panel.h + gap
  4. Panels keep natural width, clamped to column width

### Grid (G)

Uniform grid. All panels rendered at the same w/h (the median or a
configurable cell size). Sorted A-Z by title. Good for overview/index.

### Stack (S)

Single column, full viewport width. Panels stacked vertically in YAML
order. Simple scroll-through reading mode.

### Future candidates (TBD)

- Force-directed: panels repel each other, connected panels attract
- Treemap: area-proportional rectangles (useful for data zines)
- Timeline: horizontal axis = time, vertical = category

## Interaction Design

### Mode toggle

Toolbar button or keystroke cycles layout mode:
  F -> M -> G -> S -> F

Or direct keys: Shift+F, Shift+M, Shift+G, Shift+S.

When switching FROM freeform TO an auto-layout: positions are computed,
panelPositionOverrides are cleared. When switching TO freeform FROM auto:
current computed positions become the new overrides (preserving arrangement).

### Drag in freeform mode

Already implemented. Enhancements needed:
  - Save positions to YAML on mouse-up (debounced 500ms)
  - Snap-to-grid option (configurable grid size, default 2 chars)
  - Visual guides: faint grid lines when dragging

### Drag in auto-layout modes

Dragging a panel in an auto-layout mode switches to freeform for THAT
panel only (hybrid mode). Or: drag is disabled in auto modes, user must
switch to freeform first. TBD which is less confusing.

## Implementation Plan

### Phase 1: Freeform mode (smallest slice) — DONE

1. [x] CanvasDocument extended with `format` and `layout` fields
2. [x] content-loader parses `format`, `layout`, panel `x`/`y` from YAML
3. [x] CEPanelDef extended with optional `x`, `y`
4. [x] Zine renderLayoutAndContent: freeform path skips layout engine,
       builds ZineItems directly from panel x/y/w/h
5. [x] Format discriminator: `zine-freeform-v1` vs `sy2-canvas-v1`
6. [x] All 3 existing canvas files have format field
7. [x] Drag positions save to YAML on mouse-up (debounced 500ms)
8. [x] Test canvas: content/freeform-test/freeform-test.canvas.yaml
9. [x] Verified: freeform and column canvases work side by side
10. [ ] Toolbar shows current layout mode (not yet)

### Phase 2: Masonry auto-layout

1. Add layoutMasonry() to panel-layout.ts
2. Wire into zine module as a layout mode option
3. Masonry column count responsive to viewport width

### Phase 3: Grid + Stack

1. Add layoutGrid() and layoutStack() to panel-layout.ts
2. Wire into mode toggle cycle

### Phase 4: Polish

1. Snap-to-grid in freeform
2. Mode indicator in status bar
3. Smooth transitions between modes (animate? or just snap)

## Files to Touch

| File | Change |
|------|--------|
| src/core/canvas-types.ts | Add `format` field to CanvasDocument, `layout` mode enum, optional x/y to panel types |
| modules/sy2-chronicles/content-loader.ts | Parse `format`, `layout`, `x`, `y` from YAML; expose format in CanvasDocument |
| modules/sy2-chronicles/panel-types.ts | Add optional `x`, `y` to CEPanelDef |
| src/core/panel-layout.ts | Add layoutMasonry, layoutGrid, layoutStack functions |
| modules/zine/index.ts | Freeform path in renderLayoutAndContent, mode toggle, position save |
| src/services/microapp-sdk.ts | Re-export new layout functions |

## Relationship to Column Layout

Column-based zines (with a `columns` field) continue to use layoutColumns()
with the responsive breakpoint system (proportional shrink, row-wrapping
at MIN_USABLE_WIDTH=18). This spike does NOT change column behaviour.

The two paths are mutually exclusive per document:

    columns field present  -->  layoutColumns() with responsive breakpoints
    columns field absent   -->  freeform / auto-layout mode system

A document cannot mix column-assigned and freeform panels. If you want
some structure, use columns. If you want spatial freedom, use freeform.

## Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Where are freeform positions stored? | In the canvas YAML (x/y fields on each panel) | One file = one document. No sidecar drift. YAML.parseDocument preserves comments. |
| Can panels overlap? | Yes | Creative canvas. Overlap is a feature, not a bug. Click-to-front handles z-order. |
| Hot-reload behaviour? | Respect YAML positions, clear drag overrides | Same as column mode. External edit = fresh state. |
| Z-order in freeform? | Click-to-front at runtime, YAML order as initial z | Add optional `z` field to YAML later if needed. Runtime z-order via blessed node reordering. |
| Drag in auto-layout modes? | Disabled. Switch to freeform first. | Hybrid mode (drag one panel out of auto) is confusing. Clean separation is clearer. |
| Snap-to-grid? | Optional, off by default, toggle with a key | Grid size = 2 chars. Useful for alignment but should not be forced. Phase 4 polish. |

## Open Questions (genuinely undecided)

- Should auto-layout modes persist to the YAML `layout` field when toggled,
  or is the mode purely runtime? If persisted, opening the file always shows
  the last-used layout. If runtime, it always opens in freeform.

- Should masonry sort panels by title (A-Z), by YAML order, or by area
  (largest first)? Different orderings produce very different visual results.
  Probably make it configurable: `meta.masonrySort: yaml | title | area`.

- Canvas size in freeform: fixed dimensions from meta, or infinite scroll?
  Infinite vertical scroll already works. Horizontal scroll does not exist
  in blessed. So freeform panels are effectively unbounded vertically but
  bounded horizontally by viewport width.
