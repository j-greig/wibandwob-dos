# E034 Layout Audit: FLEX vs GRID Classification

**Scope**: Four WibWob-DOS microapp modules  
**Goal**: Determine which layout primitive (FLEX / GRID / both / other) each module currently uses  
**Date**: 2026-03-12  
**Status**: Complete

---

## Executive Summary

| Module | Current Approach | Classification | Fit for FLEX? | Fit for GRID? | Refactor Potential |
|--------|------------------|-----------------|---------------|----------------|--------------------|
| **dashboard** | blessed-contrib grid, 7 tabbed layouts | **GRID only** | No | Yes ✓ | Medium — already grid-oriented |
| **dashboard-xxl** | Custom virtual canvas + manual blessed positioning | **OTHER** | No | No | Low — custom rendering layer |
| **wibwob-tr808** | `createStack()` vertical flex | **FLEX only** | Yes ✓ | No | High — pure stack, minimal math |
| **wibwob-tidepool** | `createStack()` vertical flex with 4 children | **FLEX only** | Yes ✓ | No | High — pure stack, minimal math |

---

## Detailed Audit

### 1. microapps/dashboard/index.ts

**File Size**: ~700 lines  
**Primary Construct**: blessed-contrib grid system

#### Current Layout Approach

**Tab 1–4 (System, Network, App Metrics, World Map)**:
```typescript
const grid = new contrib.grid({ rows: 12, cols: 12, screen: container as any });

const line = grid.set(0, 0, 4, 6, contrib.line, {...});
const bar = grid.set(0, 6, 4, 6, contrib.bar, {...});
const spark = grid.set(4, 0, 2, 6, contrib.sparkline, {...});
// ... 8 more widgets positioned in a 12×12 grid
```

**Tab 5 (Creative Lab)**:
```typescript
const clockBox = blessed.box({
  parent: container, top: 0, left: 0, right: 0, height: 8,
  label: " Figlet Clock ", border: { type: "line" },
});
const gradientBox = blessed.box({
  parent: container, top: 8, left: 0, width: "50%", height: 12,
  label: " Colour Gradients ", ...
});
const artBox = blessed.box({
  parent: container, top: 8, left: "50%", right: 0, height: 12,
  label: " Animated Art ", ...
});
const marqueeBox = blessed.box({
  parent: container, top: 20, left: 0, right: 0, bottom: 0,
  label: " Figlet Marquee ", ...
});
```

**Tab 6 (Mosaic)**:
```typescript
const cells: MosaicCell[] = [];
for (const def of layout) {
  const box = blessed.box({
    parent: container,
    top: `${(def.row / ROWS * 100).toFixed(1)}%`,
    left: `${(def.col / COLS * 100).toFixed(1)}%`,
    height: `${(def.rowSpan / ROWS * 100).toFixed(1)}%`,
    width: `${(def.colSpan / COLS * 100).toFixed(1)}%`,
    border: { type: "line" },
  });
}
```

**Tab 7 (Emoji)**:
```typescript
for (let i = 0; i < EMOJI_TESTS.length && i < GCOLS * GROWS; i++) {
  const row = Math.floor(i / GCOLS), col = i % GCOLS;
  const box = blessed.box({
    parent: container,
    top: `${(row / GROWS * 100).toFixed(1)}%`,
    left: `${(col / GCOLS * 100).toFixed(1)}%`,
    width: `${(100 / GCOLS).toFixed(1)}%`,
    height: `${(100 / GROWS).toFixed(1)}%`,
  });
}
```

#### Classification

**GRID only** — tabs 1–4 use `contrib.grid.set()`, which is declarative 2D grid. Tabs 5–7 use blessed boxes with percentage-based positioning but follow grid math (row/col → top/left/height/width).

#### FLEX Fit: **No**
- Tab 1–4 are explicitly 2D multi-row, multi-column layouts.
- Tab 5 is a vertical stack (could use FLEX) but is mixed with side-by-side positioning.
- Tabs 6–7 are grid-based (multiple rows and columns).

#### GRID Fit: **Yes** ✓
- All tabs could be expressed as `createGrid(rows, cols, gap)`.
- Tab 1–4 are already using grid primitives; drop-in replacement.
- Tabs 5–7 use percentage math that maps cleanly to grid template rows/cols.

**Example refactor (Tab 5)**:
```typescript
const grid = createGrid(
  ["8fr", "12fr"],  // rows: clock, content
  ["1fr", "1fr"],   // cols: left, right
  0                 // gap
);

grid.addChild("clock", { row: 0, col: [0, 2] }, clockBox);  // span both cols
grid.addChild("gradient", { row: 1, col: 0 }, gradientBox);
grid.addChild("art", { row: 1, col: 1 }, artBox);
grid.addChild("marquee", { row: 2, col: [0, 2] }, marqueeBox);
```

#### Manual Layout Code Replaceable: **~150–200 lines**
- Tab 1–4: 10 `grid.set()` calls per tab × 4 tabs = 40 lines → replaced by 1 grid definition.
- Tab 5: 4 blessed.box() with manual top/left/right/height → 1 grid definition.
- Tabs 6–7: percentage math loops → grid template definitions.
- **Net savings**: Eliminate percentage-to-pixel math, blessed-contrib grid abstraction, manual row/col calculus.

#### Composition Needs: **None**
- All layout is self-contained within tab containers.
- No internal flex or nested grids.

---

### 2. microapps/dashboard-xxl/index.ts

**File Size**: ~400 lines  
**Primary Construct**: Custom virtual canvas + blessed positioning

#### Current Layout Approach

**Virtual Canvas**:
```typescript
type VCanvas = string[][];
function createCanvas(w: number, h: number): VCanvas { ... }
function blit(c: VCanvas, ox: number, oy: number, lines: string[]) { ... }
function viewport(c: VCanvas, vx: number, vy: number, vw: number, vh: number): string { ... }
```

**Mosaic Layout** (fractional positioning):
```typescript
const mosaicLayout: MosaicCell[] = [
  { ...g(0, 0, 2, 3), type: "figlet", text: "SYMBIENT", font: "slant" },
  { ...g(0, 3, 1, 1), type: "pattern", patternIdx: 0 },
  // ...
];

function g(row: number, col: number, rs: number, cs: number) {
  return { x: col / GRID_COLS, y: row / GRID_ROWS, w: cs / GRID_COLS, h: rs / GRID_ROWS };
}
```

**TUI Window Layout** (blessed):
```typescript
const viewBox = blessed.box({
  parent: body, top: 0, left: 0, right: 0, bottom: 1,
  tags: false, style: { fg: "white", bg: "black" },
});
const statusBar = blessed.box({
  parent: body, bottom: 0, left: 0, right: 0, height: 1,
});
```

**Viewport Panning** (manual pan logic):
```typescript
function clampPan() {
  const vw = (viewBox.width as number) || 80;
  const vh = (viewBox.height as number) || 24;
  panX = Math.max(0, Math.min(CANVAS_W - vw, panX));
  panY = Math.max(0, Math.min(CANVAS_H - vh, panY));
}

function updateView() {
  const vw = (viewBox.width as number) || 80;
  const vh = (viewBox.height as number) || 24;
  clampPan();
  viewBox.setContent(viewport(canvas, panX, panY, vw, vh));
}
```

#### Classification

**OTHER** — Neither FLEX nor GRID.

This module uses three distinct layout systems:
1. **Custom virtual canvas**: A 2D character buffer rendered independently of the TUI layout system. No grid primitives.
2. **Fractional mosaic positioning**: Cells positioned as `x, y, w, h` (0–1 range), then rendered onto the canvas. Not a grid or flex constraint; just fractional coordinates.
3. **Manual pan/viewport math**: Viewport clipping, clamping, and offset calculation is hardcoded.

#### FLEX Fit: **No**
- The viewport is essentially a scrollable container with manual pan logic.
- Could *theoretically* be FLEX (header + view + status bar), but the core rendering (custom canvas) doesn't benefit.

#### GRID Fit: **No**
- The mosaic is positioned using fractional coordinates, not grid template rows/cols.
- Canvas rendering is character-by-character, not grid-cell-based.
- Could be forced into a grid model, but would lose the custom canvas abstraction.

#### Manual Layout Code Replaceable: **~80 lines**
- Pan/clamp/viewport logic is unavoidable for custom rendering.
- The 4 blessed boxes (viewBox + statusBar) could use a simple FLEX stack (~5 lines).
- Net savings: Minor. The custom rendering layer is orthogonal to layout primitives.

#### Composition Needs: **None**
- No internal flex or grid. The module is self-contained.
- The virtual canvas is the core payload; layout is a thin wrapper.

**Note**: This module is a proof-of-concept for exhibition-scale rendering (800×200 canvas). Refactoring the layout wrapper is low-value. The custom canvas approach is intentional.

---

### 3. microapps/wibwob-tr808/index.ts

**File Size**: ~450 lines  
**Primary Construct**: `host.ui.createStack()` vertical flex layout

#### Current Layout Approach

```typescript
const headerBar = host.ui.createHeaderBar(win.body, { leftInset: 1 });
const display = host.ui.createTextBlock(win.body, { paddingLeft: 0, paddingTop: 0 });
const statusBar = host.ui.createStatusBar(win.body, { leftInset: 1 });
const root = host.ui.createStack(win.body, [
  { key: "header", basis: 1, part: headerBar },
  { key: "display", basis: "1fr", part: display },
  { key: "status", basis: 1, part: statusBar },
]);

function render() {
  const innerW = Math.max(0, Number(win.body.width) || 0);
  const innerH = Math.max(0, Number(win.body.height) || 0);
  root.layout({ top: 0, left: 0, width: innerW, height: innerH });
  // ...
}
```

#### Classification

**FLEX only** ✓

Pure 1D vertical stack:
- `createStack()` is a flex container (vertical).
- Three children with flex basis: `1` (fixed line), `"1fr"` (grows), `1` (fixed line).
- Single call to `root.layout()` distributes space vertically.

#### FLEX Fit: **Yes** ✓✓
- Ideal fit. The module *already* uses FLEX implicitly via `createStack()`.
- Three stacked children, evenly distributed horizontally (they all fill width).

#### GRID Fit: **No**
- No 2D layout needed.
- Could force a 1×3 grid, but FLEX is semantically correct.

#### Manual Layout Code Replaceable: **~10 lines**
- The stack setup is already minimal.
- No manual positioning math.
- If `createStack()` didn't exist, you'd write:
  ```typescript
  const headerH = 1;
  const statusH = 1;
  const displayH = innerH - headerH - statusH;
  headerBar.layout({ top: 0, left: 0, width: innerW, height: headerH });
  display.layout({ top: 1, left: 0, width: innerW, height: displayH });
  statusBar.layout({ top: 1 + displayH, left: 0, width: innerW, height: 1 });
  ```
  This is 5 lines of manual arithmetic. `createStack()` eliminates it.

#### Composition Needs: **None**
- No nested layout. All three parts are siblings in a single stack.

**Note**: This module is a *showcase* of how `createStack()` simplifies FLEX. It's the ideal pattern. No refactoring needed.

---

### 4. microapps/wibwob-tidepool/index.ts

**File Size**: ~350 lines  
**Primary Construct**: `host.ui.createStack()` vertical flex layout

#### Current Layout Approach

```typescript
const headerBar = host.ui.createHeaderBar(win.body, { leftInset: 1 });
const display = host.ui.createTextBlock(win.body, { paddingLeft: 0, paddingTop: 0 });
const buttonBar = host.ui.createButtonBar<TideMode>(
  win.body,
  [
    { id: "all", label: "ALL" },
    { id: "algae", label: "◦Alg" },
    // ...
  ],
  (id) => { highlight = id === "all" ? null : id; render(); }
);
const statusBar = host.ui.createStatusBar(win.body, { leftInset: 1 });

const root = host.ui.createStack(win.body, [
  { key: "header", basis: 1, part: headerBar },
  { key: "display", basis: "1fr", part: display },
  { key: "buttons", basis: 1, part: buttonBar },
  { key: "status", basis: 1, part: statusBar },
]);

function render() {
  const innerW = Math.max(60, Number(win.body.width) || 100);
  const innerH = Math.max(20, Number(win.body.height) || 30);
  root.layout({ top: 0, left: 0, width: innerW, height: innerH });
  const displayH = Math.max(5, innerH - 3);  // height: totalH - header(1) - buttons(1) - status(1)
  // ...
}
```

#### Classification

**FLEX only** ✓

Pure 1D vertical stack:
- `createStack()` with four children.
- Basis: `1` (fixed), `"1fr"` (grows), `1` (fixed), `1` (fixed).
- Single layout call distributes space.

#### FLEX Fit: **Yes** ✓✓
- Ideal fit, identical to TR-808.
- Four stacked children, all filling width.

#### GRID Fit: **No**
- No 2D layout.
- Could force a 1×4 grid, but FLEX is semantically correct.

#### Manual Layout Code Replaceable: **~5 lines**
- Already minimal, same as TR-808.
- Manual alternative:
  ```typescript
  const headerH = 1, buttonH = 1, statusH = 1, displayH = innerH - 3;
  headerBar.layout({ top: 0, left: 0, width: innerW, height: headerH });
  display.layout({ top: 1, left: 0, width: innerW, height: displayH });
  buttonBar.layout({ top: 1 + displayH, left: 0, width: innerW, height: buttonH });
  statusBar.layout({ top: 1 + displayH + buttonH, left: 0, width: innerW, height: statusH });
  ```

#### Composition Needs: **None**
- No nesting. All four parts are siblings in a single stack.

**Note**: Also a showcase of FLEX. The `displayH` calculation is app-specific (not a layout primitive concern) and belongs in `render()`, not in the layout system.

---

## Patterns & Observations

### Pattern 1: blessed-contrib Grid (dashboard)

**Status**: Works, but uses external library.

**Pros**:
- Declarative 2D positioning.
- Built-in widget set (line, bar, sparkline, gauge, etc.).
- Mature and feature-complete.

**Cons**:
- Depends on `blessed-contrib` (not a WibWob primitive).
- Hard to slot into a unified layout system.
- Mixing `contrib.grid` with manual blessed positioning is confusing.

**Recommendation**: Keep as-is. If a custom `createGrid()` primitive is developed, migrate to it. For now, `contrib.grid` is sufficient.

---

### Pattern 2: Manual Canvas Rendering (dashboard-xxl)

**Status**: Intentional, works for exhibition rendering.

**Pros**:
- Total rendering control.
- Decouples from terminal size; can render to any buffer size.
- Proof-of-concept for wall-scale displays.

**Cons**:
- Not composable with other TUI modules.
- Manual pan logic is error-prone.
- Viewport math is hardcoded.

**Recommendation**: Keep as-is. This is a research/demo module. If you build a general-purpose "pannable viewport" primitive later, this could migrate. For now, it's isolated enough.

---

### Pattern 3: createStack Vertical Flex (tr808, tidepool)

**Status**: Ideal. Both modules are canonical FLEX examples.

**Pros**:
- Zero manual layout math.
- Composable (can nest stacks).
- Responsive to window resize.
- Fits HTML/CSS mental model.

**Cons**:
- Requires `createStack()` to be implemented (it is).

**Recommendation**: This is the *reference pattern*. New modules should follow this model. If you build more flex-based modules, they should use `createStack()`.

---

### Pattern 4: Percentage-Based Positioning (dashboard tabs 5–7)

**Status**: Works, but unnecessary.

**Pros**:
- Relatively readable (percentages are easier than pixel math).

**Cons**:
- Manual row/col → percentage conversion is error-prone.
- Hard to maintain when layout changes.
- No semantic connection to grid structure.

**Recommendation**: If you migrate dashboard tabs 5–7, replace with explicit `createGrid()` definitions.

---

## Refactor Roadmap

### High Priority (FLEX modules — minimal effort)
1. **wibwob-tr808** and **wibwob-tidepool**: Already using `createStack()`. No changes needed. ✓

### Medium Priority (blessed-contrib — moderate effort)
2. **dashboard**: Consider migrating from `contrib.grid` to a future `createGrid()` primitive.
   - Effort: Medium (need to understand all 7 tabs).
   - Value: Medium (unifies layout system, but `contrib.grid` already works).
   - Timeline: Post-E034.

### Low Priority (Custom canvas — low value)
3. **dashboard-xxl**: Leave as-is. Custom rendering is intentional.
   - Future: If a "pannable viewport" primitive is extracted, consider a follow-up.

---

## Recommendations for E034+

### 1. Formalize `createGrid()` Primitive
If you're building a unified layout system, document and implement:
```typescript
interface GridChild {
  key: string;
  row: number | [number, number];    // start or [start, end]
  col: number | [number, number];
  part: UiPart;
}

function createGrid(
  templateRows: (string | number)[],    // "1fr", "auto", "100px", etc.
  templateCols: (string | number)[],
  gap?: number,
  children?: GridChild[]
): UiPart { ... }
```

### 2. Stabilize `createStack()` / `createFlex()`
Both TR-808 and Tide Pool rely on `createStack()`. Ensure it's:
- Well-documented.
- Supports nested stacks.
- Handles edge cases (zero-height children, negative space, etc.).

### 3. Guideline: FLEX by Default
For new modules:
1. **FLEX first**: Use `createStack()` for vertical or row-based layouts.
2. **GRID when needed**: 2D layouts (tables, dashboards, mosaic).
3. **Manual only if**: Custom rendering (like dashboard-xxl) requires it.

### 4. Update `.agents/specs/window-system.md`
Add a **Layout Patterns** section:
- When to use FLEX (1D, hierarchical).
- When to use GRID (2D, uniform cells).
- When to resort to manual positioning (custom canvas, panning, etc.).
- Examples for each.

### 5. Test Composition
Once GRID is stable, test:
- FLEX inside GRID (e.g., stack inside grid cell).
- GRID inside FLEX (e.g., grid inside stack child).
- Nested stacks (flex inside flex).

---

## Summary Table

| Module | Current Primitive | Classification | Refactor Effort | Recommendation |
|--------|-------------------|-----------------|-----------------|-----------------|
| dashboard | `contrib.grid` | GRID only | Medium | Migrate to `createGrid()` post-E034 |
| dashboard-xxl | Custom canvas | OTHER | Low | Keep as-is (research/demo) |
| wibwob-tr808 | `createStack()` | FLEX only | None | Reference pattern ✓ |
| wibwob-tidepool | `createStack()` | FLEX only | None | Reference pattern ✓ |

---

## Code Snippets for Posterity

### Would createGrid() work for dashboard tab 5?
**Yes.** Here's a sketch:

```typescript
const grid = createGrid(
  ["8", "12", "8"],           // rows: clock, content, marquee (in cells)
  ["1fr", "1fr"],             // cols: left, right
  0
);

grid.addChild("clock", { row: 0, col: [0, 1] }, clockBox);
grid.addChild("gradient", { row: 1, col: 0 }, gradientBox);
grid.addChild("art", { row: 1, col: 1 }, artBox);
grid.addChild("marquee", { row: 2, col: [0, 1] }, marqueeBox);
```

Instead of:
```typescript
const clockBox = blessed.box({
  parent: container, top: 0, left: 0, right: 0, height: 8,
});
const gradientBox = blessed.box({
  parent: container, top: 8, left: 0, width: "50%", height: 12,
});
const artBox = blessed.box({
  parent: container, top: 8, left: "50%", right: 0, height: 12,
});
const marqueeBox = blessed.box({
  parent: container, top: 20, left: 0, right: 0, bottom: 0,
});
```

### Would createStack() work for dashboard tab 1?
**No.** Tab 1 is a 12×12 grid with 8 widgets of different sizes. FLEX can't express 2D layouts. You need GRID.

---

## Files Reviewed

1. `/Users/james/Repos/wibandwob-dos/microapps/dashboard/index.ts` (700 lines)
2. `/Users/james/Repos/wibandwob-dos/microapps/dashboard-xxl/index.ts` (400 lines)
3. `/Users/james/Repos/wibandwob-dos/microapps/wibwob-tr808/index.ts` (450 lines)
4. `/Users/james/Repos/wibandwob-dos/microapps/wibwob-tidepool/index.ts` (350 lines)

**Total Analyzed**: ~2,000 lines of layout code.

---

**Signed off**: Claude Code Scout  
**Next Step**: Review findings, decide on `createGrid()` spec, update `.agents/specs/window-system.md`
