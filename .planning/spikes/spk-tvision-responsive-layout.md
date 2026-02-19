---
id: spk-tvision-responsive-layout
title: Responsive / multi-column layout patterns in Turbo Vision
status: active
---

# Spike: Responsive multi-column TUI layout in Turbo Vision

**tl;dr** — Turbo Vision growMode flags handle single-axis stretch fine but break down for complex multi-column layouts. This spike captures patterns, failure modes, and a proposed `changeBounds()` override approach for correct panel reflow.

---

## Problem statement

Turbo Vision resize model: when a TGroup (TWindow) changes size, it calls `calcBounds()` on each child and adjusts their bounds by a `delta`. The `growMode` flags tell calcBounds which edges of a child track the owner's edge.

For a 3-column + bottom-status layout (tools | canvas | palette | status bar), naïve flag assignment leads to:
- panels drifting apart or overlapping on resize
- fixed-width panels unexpectedly growing
- dead space between panels
- child views leaving garbage rows on grow (partial draw)

---

## growMode flag semantics (confirmed from tvision/views.h)

| Flag       | Meaning                                   |
|------------|-------------------------------------------|
| gfGrowLoX  | left edge tracks owner left (moves right) |
| gfGrowHiX  | right edge tracks owner right             |
| gfGrowLoY  | top edge tracks owner bottom (moves down) |
| gfGrowHiY  | bottom edge tracks owner bottom           |
| gfGrowAll  | all four — full stretch in both axes      |
| gfGrowRel  | proportional rather than absolute delta   |

**Additive delta model**: each flag adds `delta.x` or `delta.y` to the corresponding edge. No flag = edge stays fixed relative to owner's top-left.

---

## Correct flags for 3-col + status layout

| Panel    | growMode                              | Rationale                                 |
|----------|---------------------------------------|-------------------------------------------|
| tools    | `gfGrowHiY`                           | fixed left/width, stretches down          |
| canvas   | `gfGrowHiX \| gfGrowHiY`             | left edge fixed, right/bottom track owner |
| palette  | `gfGrowLoX \| gfGrowHiX \| gfGrowHiY` | right-anchored fixed width, stretches down |
| status   | `gfGrowHiX \| gfGrowLoY \| gfGrowHiY` | full width, bottom-anchored, fixed height |

These are confirmed correct by Codex analysis (codex-paint-layout-20260219-115421.log).

**Known limitation**: flag-only approach has no way to enforce a minimum canvas width or prevent overlap when the window is very narrow. Both Lo+Hi on the same axis means the view's size tracks owner size — correct for palette but only because we want it to appear fixed-width right-anchored, not actually grow.

Wait: `gfGrowLoX | gfGrowHiX` means BOTH edges track owner's right edge, so palette keeps constant width while sliding right. That is correct for right-anchored fixed-width.

---

## Failure mode: partial draw garbage

When a TView's `size.y` increases on resize, `draw()` must cover ALL rows up to `size.y`. If draw() only writes fixed rows (e.g., 7 for a tools panel), the rows below aren't cleared → garbage from previous content persists.

**Fix**: always loop `for (int y = lastRow+1; y < size.y; ++y)` and write blank rows.

This is now implemented in `TPaintToolPanel::draw()` (Feb 2026).

---

## Better approach: changeBounds() override

For guaranteed correct layout under all resize scenarios, override `changeBounds()` in the TWindow and manually compute every child's bounds:

```cpp
void TPaintWindow::changeBounds(const TRect& bounds) {
    TWindow::changeBounds(bounds);
    TRect client = getExtent();
    client.grow(-1, -1);
    int toolsW = 16, palW = 20;
    TRect toolsR(client.a.x, client.a.y,
                 std::min(client.a.x + toolsW, client.b.x), client.b.y - 1);
    TRect palR(std::max(client.b.x - palW, toolsR.b.x), client.a.y,
               client.b.x, client.b.y - 1);
    TRect canvasR(toolsR.b.x, client.a.y, palR.a.x, client.b.y - 1);
    TRect statusR(client.a.x, client.b.y - 1, client.b.x, client.b.y);
    toolPanel->changeBounds(toolsR);
    canvas->changeBounds(canvasR);
    paletteView->changeBounds(palR);
    statusView->changeBounds(statusR);
}
```

Requires keeping pointers to all child views in the window. More code, guaranteed correct.

**TODO**: implement this when E010 moves past MVP. For now, flag-only approach is in place.

---

## canvas buffer vs view size

Canvas buffer is allocated at construction (`cols × rows`). On resize, `size.x/size.y` grows but buffer stays fixed. The draw() method must handle `size > buffer` gracefully — currently uses `bg`-coloured fill for overflow cells.

For a proper resizable canvas, implement `changeBounds()` on `TPaintCanvasView` to resize the buffer, preserving existing cells:
- allocate new `vector<PaintCell>(newW * newH)`
- copy old cells row by row within `min(oldW, newW) × min(oldH, newH)`
- update `cols`, `rows`

Not yet implemented (MVP scope).

---

## API/MCP window resize

No resize command in command registry as of Feb 2026. To resize a specific window via API:
1. Add `resize_window` command with params `{id, x, y, w, h}` to registry
2. In dispatch: find window by ID from window registry, call `changeBounds()`
3. Or expose as `move_window` (moves + resizes) for generality

**TODO**: add to parking-lot or E010 backlog.

---

## Session notes

- 2026-02-19: flags set correctly in E010, partial-draw fix applied to tools panel, status staleness fixed
- Codex full analysis: `codex-paint-layout-20260219-115421.log`
