# Layout Audit: WibWob-DOS Modules (E034)

## Scope
Analyze layout patterns across 8 production and demo modules to determine FLEX/GRID/CANVAS usage, composition needs, and UiPart interface adequacy.

**Modules audited:**
1. modules/zine/index.ts
2. modules/sy2-chronicles/index.ts
3. modules/hello-world/index.ts
4. modules/slap-editor/index.ts
5. modules/glitchbox/index.ts
6. modules/heartbeat/index.ts
7. modules/ansi-lab/index.ts
8. modules/e026-demo/index.ts

---

## 1. zine/index.ts

### Layout Approach
- **Container:** Scrollable canvas (root → bodyArea → sidePanel.main + sidePanel.sidebar)
- **Content:** ZineItem[] (panels + headers) positioned absolutely on canvas
- **Key primitives:** 
  - `layoutColumns()` + `layoutPanels()` from SDK (returns x/y/w/h placements)
  - Manual position overrides via `panelPositionOverrides` Map
  - Drag-to-move by mutating override map
- **Rendering:** Grid-based (ZineItem has x, y, w, h integers)
- **Sidebar:** createSidebarPanel (blessed boxes, fixed width toggle)

### Classification
**FLEX + GRID + CANVAS (hybrid)**
- **FLEX:** Toolbar buttons (createButtonBar)
- **GRID:** Implicit 2D grid from layoutColumns/layoutPanels (each item gets absolute x/y position on canvas)
- **CANVAS:** User drag overrides + scroll clipping — positional rendering requires manual clip/hidden logic

### Column Layout Pattern
`layoutColumns()` in zine/index.ts uses CEPanelDef with `col: 0|1|2` field to assign panels to columns, then calls SDK function. **This is GRID-like** — it's 2D flow constrained by column index, not a pure 1D flex.

**Question:** Can layoutColumns fit as a grid primitive?
- ✅ YES — it's computing column widths + vertical stacking within each column. This is a 2-column grid with variable row heights.
- **Building blocks:** Need `createGrid(cols: 2, rowSizes: [], colSizes: [])` or `createResponsiveGrid()`.

### Composition Needs
- ✅ Panel nesting: Zine loads panels + renders them as ZineNode (frame + titleBar + content). Child content boxes can receive rendered text from panel-types.renderPanel().
- ✅ Sidebar toggle: Uses createSidebarPanel (separate concern, works orthogonally to canvas).

### Responsive Needs
- ⚠️ **Partial:** Canvas width drives layoutColumns/layoutPanels dimension calcs, but there's no breakpoint API. Fixed panel widths (w: 40, h: 10, etc.) are hardcoded in YAML.
- Could benefit from: `breakpoints({ minWidth: 60, rules: { panelW: 30, panelH: 8 } })`

### Patterns NOT Fitting FLEX/GRID
1. **Drag-to-move override system** — not layout-driven; it's interactive mutation of position state. Belongs in CANVAS layer, not layout.
2. **Hot-reload canvas merge** — overlay new items + preserve user overrides. Unique to this app, not a layout primitive.
3. **Scroll clipping visibility** — manual .hidden flag based on viewTop/viewBot. This is composite (layout + scroll manager + renderer).

### UiPart Coverage
- **Current interface:** `{ node, layout, update, restyle, destroy }`
- **Gaps for Zine:**
  - `node` ✅ (ZineNode.frame is blessed.Widgets.BoxElement)
  - `layout(rect)` ⚠️ *Partial* — zine computes internal grid, then applies per-panel frame.left/top. Could be wrapped as UiPart.
  - `update(props)` ✅ (contentOverrides, panelPositionOverrides passed externally; no direct update API needed)
  - `restyle()` ✅ (applyStyles() called on theme change)
  - `destroy()` ✅ (rebuild() clears zineNodes)
  - **Missing:** `captureText()`, `describeState()` — but these are on window, not on UiPart.

---

## 2. sy2-chronicles/index.ts

### Layout Approach
*(File truncated at 1645/2501 lines; reading available sections)*
- **Container:** Scrollable canvas (root → toolbar + canvas + statusBar)
- **Content:** PanelDef[] (text, figlet, ascii-art, pixel, infographic, mixed, webcam types)
- **Key primitives:**
  - `layoutPanels()` → placements (x, y per panel)
  - `layoutColumns()` for column-based flow (panels with col: 0, 1, 2)
  - Manual panelPositionOverrides for user drags
  - Optional terrainSize override for resizable panels
- **Toolbar:** createButtonBar (search, map, pause)
- **Arrow overlay:** Vector drawing between related panels (custom rendering)

### Classification
**FLEX + GRID + CANVAS**
- **FLEX:** Button bar (createButtonBar)
- **GRID:** layoutPanels/layoutColumns (2D positional grid with col-based assignment)
- **CANVAS:** Drag-to-move, arrow drawing, scroll clipping, resizable terrain panel

### Column Layout Pattern
Same as Zine: `layoutColumns()` drives columnHeaderMap + column widths. Panels marked `col: 0|1|2` flow into their columns.

### Composition Needs
- ✅ Panel nesting: Panels have renderPanel(tick, width, height) content function.
- ✅ Modular loading: Merge hardcoded PANEL_DEFS + JSON files from CONTENT_DIR.

### Responsive Needs
- ⚠️ **Hardcoded:** terrainSize override is for `id="terrain-hill"` only. No breakpoint system.

### Patterns NOT Fitting FLEX/GRID
1. **Arrow overlay drawing** — semantic connector between panels, not layout. Requires canvas-level composition.
2. **Resizable terrain grip** — single panel with manual size state; breaks grid assumption of fixed sizes.
3. **Live panel updates** (tick-based content render) — animation loop, not layout concern.

### UiPart Coverage
- **Similar gaps to Zine:**
  - Missing: resizable panel interface (would need `updateSize(w, h)` or dynamic sizing in update()).
  - Need: composition model for overlays (arrow drawing on top of panels).

---

## 3. hello-world/index.ts

### Layout Approach
- **Responsive design:** Breakpoint-driven (S/M/L/XL → different layouts)
- **Primitives:** inlines candidate **createGrid** (not yet in SDK)
  ```ts
  function createGrid(opts: GridOptions): Grid {
    set(row, col, rowSpan, colSpan, node)
    layout(rect) // computes colWidths/rowHeights + applies
  }
  ```
- **Layouts:**
  - **XL (95+ x 26+):** toolbar + xlGrid (2x2: contour span-2+stats, clock) + cats
  - **L (65+ x 18+):** toolbar + contour + clock (side-by-side)
  - **M (40+ x 12+):** banner + info
  - **S (< 40):** banner only
- **Compass alignment:** Manual align/valign positioning within banner container

### Classification
**FLEX + GRID (no CANVAS)**
- **FLEX:** Response breakpoints switch between modes
- **GRID:** createGrid inlined (not SDK), 2x2 with fractional sizing (`colSizes: ["2fr", "1fr"]`)
- **Layout:** compass alignment for typographic centering (nw/n/ne/w/c/e/sw/s/se)

### Composition Needs
- ✅ Banner as floating text within transparent container (compass positioning)
- ✅ Grid with span-2 (contour panel spans both rows in left column)

### Responsive Needs
- ✅✅ **EXCELLENT:** Four breakpoints cover the full range. Banner adjusts font via responsiveFiglet(). Panel visibility toggled per mode.
- Could improve: Toolbar hidden at M/S sizes — use `child.visible?.()` pattern from createStack.

### UiPart Coverage
- **createGrid missing from SDK** — this module **inlines it** as proof-of-concept.
- **Interface match:** Grid.set() + Grid.layout() + Grid.destroy() closely mirrors UiPart.
- **Gaps:**
  - No `update(props)` — grid doesn't recalculate on property change, only on `layout(rect)` resize.
  - No `restyle()` — child nodes styled separately.
  - **Recommendation:** Wrap as `createGridPart(parent, opts): UiPart<void>` for full SDK integration.

---

## 4. slap-editor/index.ts

### Layout Approach
- **Two-column (no gaps):**
  - gutterBox: fixed width (dynamic based on line count), left side
  - textBox: remaining space, right side
  - statusBar: fixed 1-line footer
- **Rendering:** Manual text layout (grid of blessed tags for cursor/selection)
- **No createStack/createColumns** — all layout is imperative

### Classification
**CUSTOM (neither FLEX nor GRID)**
- Hard-coded column widths (gutterW computed by EditorEngine.gutterWidth())
- Manual positioning: textBox.left = gutterW; textBox.width = totalWidth - gutterW
- Cursor/selection via blessed tag injection in text content

### Composition Needs
- ❌ No child composition — purely flat (gutter + text + status).
- Could benefit: Extract cursor/selection renderer as reusable component.

### Responsive Needs
- ✅ Partial: Width/height computed per render, gutter width recalculated.
- ✅ Soft-wrap not implemented (width drives textWidth, used for cursor positioning).

### Patterns NOT Fitting FLEX/GRID
1. **Gutter width calculation** — tied to line count (e.g., 999 lines → 3-char gutter + space). Not a layout dimension.
2. **Cursor/selection rendering** — blessed tag overlays in string content. Not a layout concern.
3. **Scroll offset (scroll.row, scroll.col)** — independent x/y panning, not a layout dimension.

### UiPart Coverage
- **Not used** — slap-editor predates or avoids createStack/createColumns.
- **Could benefit:** Wrap entire editor as UiPart with `update({ filePath })` + internal layout re-calc.
- **Gap:** No composition API — editor is a monolith.

---

## 5. glitchbox/index.ts

### Layout Approach
- **Container:** root (vertical sections)
  - fieldLayer (animating background, bottom-3)
  - skeletonLayer (foreground, skeleton art overlay, bottom-3, transparent)
  - poseBar (createButtonBar, height 1, positioned at bottom-3)
  - moodBar (createButtonBar, height 1, positioned at bottom-2)
  - statusBar (height 1, bottom)
- **No explicit FLEX/GRID** — all absolute positioning via createButtonBar + manual layout calls

### Classification
**CANVAS + Button Bar (FLEX for toolbar)**
- **FLEX:** createButtonBar for poseBar + moodBar (buttons auto-fit)
- **CANVAS:** fieldLayer (generative art grid), skeletonLayer (manual skeleton rendering at x/y)
- **Composition:** Two independent layers (field + skeleton) composited by z-order (skeletonLayer.setFront())

### Composition Needs
- ✅ Layer composition: fieldLayer (background) + skeletonLayer (foreground).
- ✅ Generative art engine (cellular automata grid) — independent from skeleton.
- ✅ Pose animation library (POSE_ANIM frames, DANCE_SEQUENCE).

### Responsive Needs
- ⚠️ **Hardcoded:** canvasSize() estimates w/h from lpos or root dimensions. No breakpoint-driven layout change.
- Buttons wrap if window too narrow — createButtonBar doesn't handle breakpoints.

### Patterns NOT Fitting FLEX/GRID
1. **Generative art grid** — independent simulation, not a UI layout. Rendered as text blob.
2. **Skeleton positioning** — (x, y) coordinates, not grid-aligned. Free-form 2D canvas.
3. **Layer z-order management** — semantic composition, not layout.
4. **Haiku autonomous tick** — time-based agent, not layout.

### UiPart Coverage
- **Partially used:**
  - poseBar/moodBar: createButtonBar (wraps as UiPart internally, but not exposed here).
  - fieldLayer/skeletonLayer: raw blessed boxes, not wrapped.
- **Gap:** No composition primitive for "two independent rendering layers."
  - **Recommendation:** `createLayerComposition(parent, [ { key: "field", zIndex: 0, render }, { key: "skeleton", zIndex: 1, render } ])`

---

## 6. heartbeat/index.ts

### Layout Approach
- **Simple vertical stack:**
  - pulseBox (frame 0 of waveform)
  - heartBox (♡ icon + BPM)
  - uptimeBox (uptime counter)
- All absolute positioned within win.body, no FLEX/GRID

### Classification
**CUSTOM (flat layout)**
- Hard-coded positions: top: 1, 3, 5 (staggered vertically)
- No layout engine; manual top/left assignment.

### Composition Needs
- ❌ No nesting; purely flat.

### Responsive Needs
- ⚠️ Hard-coded spacing. If window resizes, layout doesn't reflow.

### UiPart Coverage
- ✅ Simple enough that each box could be wrapped as individual UiPart, but no composition needed.

---

## 7. ansi-lab/index.ts

### Layout Approach
- **Single scrollable box** (content) + status bar
- Cycle through 10 test functions, each returns formatted string
- No layout engine; purely text rendering

### Classification
**CUSTOM (single-pane, scrollable text)**
- blessed.box with scrollable: true
- Manual string formatting per test (ANSI escapes, blessed tags)
- No composition.

### Responsive Needs
- ⚠️ Test output doesn't reflow on resize — static content only.

### UiPart Coverage
- ❌ Not a use case for UiPart — it's a text viewer, not a layout.

---

## 8. e026-demo/index.ts

### Layout Approach
- **Explicit FLEX-based composition:**
  ```ts
  topRow = host.ui.createColumns(win.body, [
    { key: "tl", basis: "1fr", part: p1 },
    { key: "tr", basis: "1fr", part: p2 },
  ]);
  botRow = host.ui.createColumns(win.body, [
    { key: "bl", basis: "1fr", part: p3 },
    { key: "br", basis: "1fr", part: p4 },
  ]);
  root = host.ui.createStack(win.body, [
    { key: "top", basis: "1fr", part: topRow },
    { key: "bot", basis: "1fr", part: botRow },
    { key: "bar", basis: 1,     part: bar    },
  ]);
  ```
- **Primitives used:**
  - createStack (vertical FLEX)
  - createColumns (horizontal FLEX)
  - createBorderedPanel (custom border + active state)
  - createButtonBar (FLEX bar)
  - createTreeWidget (interactive tree, consumable UiPart)
  - createRenderMonitor (FPS tracker)
  - tweenWindowPosition, tweenWindowSize (motion helpers)

### Classification
**FLEX only (pure hierarchical flex layout)**
- Stack + Columns + ButtonBar are all 1D flexbox-style.
- 2x2 grid = 2 stacked rows, each with 2 columns.
- No absolute positioning (CANVAS), no 2D grid.

### Composition Needs
- ✅ Panel composition: BorderedPanel wraps content (UiPart), applies border+style.
- ✅ Tree as first-class widget (TreeWidget → UiPart).
- ✅ Motion tweening (independent animation loop, not layout-driven).
- ✅ RenderMonitor (FPS telemetry, separate concern).

### Responsive Needs
- ⚠️ No breakpoints — layout is fixed (4-panel grid). If window < 110x36, panels shrink but stay in 2x2 layout.
- Could improve: Add mode switching (e.g., S: 1-column, L: 2x2, XL: 3-column with sidebar).

### UiPart Coverage
- ✅✅ **EXCELLENT:** Uses createStack, createColumns, createButtonBar, createBorderedPanel.
- ✅ Each part conforms to UiPart interface.
- ✅ Composition is clean: root.layout() cascades to child parts.

---

## Summary Table

| Module | Layout Type | FLEX | GRID | CANVAS | Complexity |
|--------|-------------|------|------|--------|------------|
| **Zine** | Scrollable canvas grid | ✓ | ✓ | ✓ | High |
| **sy2-chronicles** | Scrollable canvas grid + arrow overlay | ✓ | ✓ | ✓ | High |
| **hello-world** | Responsive breakpoint-driven grid | ✓ | ✓ | ✗ | Medium |
| **slap-editor** | Two-column imperative layout | ✗ | ✗ | ✓ | Medium |
| **glitchbox** | Layer composition + bar buttons | ✓ | ✗ | ✓ | Medium |
| **heartbeat** | Flat vertical stack (hard-coded) | ✗ | ✗ | ✓ | Low |
| **ansi-lab** | Single scrollable pane | ✗ | ✗ | ✗ | Low |
| **e026-demo** | Pure hierarchical flex (2x2 grid via flex) | ✓ | ✗ | ✗ | Low |

---

## Key Findings

### 1. FLEX is sufficient for ~40% of layouts (hello-world, e026-demo)
- createStack + createColumns (1D flexbox model) are well-designed and cover simple grids.
- **E026-demo is the best-practice reference** — clean composition, no CANVAS hacks.

### 2. GRID primitives are missing, but patterns emerge
Both **Zine** and **sy2-Chronicles** reinvent grid layout:
- `layoutColumns()` + `layoutPanels()` in microapp-sdk
- Both compute x, y, w, h for each item
- Both apply absolute positions manually

**Candidate SDK primitive:**
```ts
export type GridOptions = {
  cols: number;
  rows: number;
  colSizes?: (number | "1fr")[];  // e.g., ["2fr", "1fr"]
  rowSizes?: (number | "1fr")[];
  gap?: number | [rowGap, colGap];
  items: { row: number; col: number; rowSpan?: number; colSpan?: number; part: UiPart }[];
};

export function createGrid(parent: blessed.Widgets.Node, opts: GridOptions): UiPart<void>
```

**Note:** hello-world already inlines this as proof-of-concept (L:67-120). Should be extracted to SDK.

### 3. CANVAS (absolute positioning + interactive override) solves real problems
Both Zine and sy2-Chronicles need:
- User drag-to-move (override computed positions)
- Scroll clipping (show/hide panels based on viewport)
- Manual visibility toggle

**This is not FLEX or GRID.** It's a **viewport-aware canvas** — a different abstraction.

**Candidate SDK feature:**
```ts
export type CanvasItem = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  node: blessed.Widgets.BoxElement;
};

export function createScrollableCanvas(parent: blessed.Widgets.Node): {
  addItem(item: CanvasItem): void;
  removeItem(id: string): void;
  layout(rect: Rect): void;  // recompute clipping, scroll viewport
  // ... scroll handling
}
```

### 4. Composition patterns

| Pattern | Modules | Recommendation |
|---------|---------|-----------------|
| **Layer composition** (field + foreground) | glitchbox, sy2-chronicles (arrow overlay) | Add `createLayerGroup(parent, layers: { zIndex, part }[]): UiPart` |
| **Scrollable container** | zine, sy2-chronicles, ansi-lab | Current createStack/blessed.box(scrollable: true) works; no new primitive needed |
| **Responsive breakpoints** | hello-world | Extract `createResponsiveLayout(breakpoints: Breakpoint[]): (rect) => UiPart` helper |
| **Resizable panels** | sy2-chronicles (terrain) | Add resize grip API; allow `update({ w, h })` in UiPart |

### 5. UiPart interface is sufficient BUT:

**Coverage by module:**
| Aspect | Current Status | Gap |
|--------|---|---|
| **node** | ✅ All wrap blessed boxes | None |
| **layout(rect)** | ✅ Works for FLEX, partial for GRID/CANVAS | GRID needs explicit API; CANVAS needs scroll/clip logic |
| **update(props)** | ✅ Used by header/status bars | Missing: dynamic sizing (w, h), visibility toggle |
| **restyle()** | ✅ All hook theme changes | Works well |
| **destroy()** | ✅ All implement cleanup | Works well |
| **Missing:** captureText(), describeState() | N/A (window methods, not UiPart) | Might want `captureContent()` on UiPart for composition |

**Recommendation:**
```ts
export type UiPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
  
  // NEW — optional:
  captureText?(): string;        // for nested parts in compound widgets
  onFocus?(): void;               // for focus management in trees/tables
  onBlur?(): void;
};
```

### 6. layoutColumns (Zine column flow) ~~as a GRID primitive~~

> **DECISION:** layoutColumns stays as a domain-specific pattern for zine,
> NOT an SDK primitive. It consumes PanelDef[], bakes in zine semantics,
> and is not a reusable composition surface. See 05-module-audit-summary.md.

`layoutColumns(defs, viewportWidth, { columnHeaders, ... }): { items: ZineItem[] }`

**This is NOT pure grid math.** It's:
1. Assign items to columns by `col: 0|1|2`
2. Compute column widths (equal split by default)
3. Stack items within each column (flexbox-style)
4. Optionally render column headers at top
5. Return x, y positions in unified layout

**Can it be expressed as GRID?**
- ✅ YES, with a hybrid: `createColumnFlow(columns: ColumnDef[], items: Item[]): UiPart`
  - Internal: Compute 2D grid positions
  - External: expose as single UiPart with cascading layout

**Better pattern:**
```ts
export function createColumnFlow(
  parent: blessed.Widgets.Node,
  opts: { columns: number; columnHeaders?: Map<number, string> }
): {
  addItem(item: { id: string; col: number; part: UiPart }): void;
  layout(rect: Rect): void;
} & UiPart<void>
```

---

## Recommendations

### Immediate (E034 scope — layout audit)

1. **Extract createGrid to SDK** (from hello-world)
   - Signature: `createGrid(parent, { cols, rows, colSizes, rowSizes, gap, items }): UiPart`
   - Tests: 2x2 equal, 2-column unequal (2fr/1fr), span-2
   - Matches: hello-world XL/L, partial match for sy2-chronicles

2. **Document CANVAS pattern** (for Zine, sy2-Chronicles)
   - Not a primitive, but a recipe: blessed.box(scrollable) + manual clipping + drag override Map
   - Add code comment pointing modules here

3. **Note missing UiPart features**
   - `captureText()` for recursive capture in nested parts
   - `update({ w, h })` for resizable panels
   - Deferred to E035 (UiPart v2)

### Medium term (E035+ scope)

4. **createLayerGroup** for composite rendering (glitchbox, sy2-chronicles arrow overlay)

5. **createResponsiveLayout** breakpoint helper (hello-world's pattern is good; make it SDK)

6. **createColumnFlow** — hybrid grid/flex for Zine's layoutColumns

7. **Resize grip API** for terrain-style resizable panels

---

## Architecture Notes

### Three layout families in WibWob-DOS

| Family | Primitives | Use Case | Complexity |
|--------|-----------|----------|-----------|
| **FLEX (1D)** | createStack, createColumns, createButtonBar | Toolbars, dashboards, uniform grids | Low |
| **GRID (2D)** | createGrid (proposed) | Magazine-style panel layouts with spans | Medium |
| **CANVAS** | blessed.box(scrollable) + manual override | Free-form drawing, drag-to-move, user-defined positions | High |

**Current state:**
- FLEX: ✅ SDK-complete, best-practice in e026-demo
- GRID: ⚠️ Inlined in hello-world, missing from SDK
- CANVAS: ❌ Anti-pattern (Zine/sy2-Chronicles reinvent); no SDK support

**Target state (E035):**
- FLEX: ✅ stable (no changes)
- GRID: ✅ SDK-native (extract + test)
- CANVAS: ✅ documented pattern + helpers (scroll, clip, drag override)

---

## Context: Where layoutColumns Fits

Currently in `src/services/microapp-sdk.js`:
```ts
export function layoutColumns(
  defs: PanelDef[],
  viewportWidth: number,
  opts: { columnHeaders?: Map<number, string> }
): { items: ZineItem[]; contentHeight: number }
```

**Usage:** Zine + sy2-Chronicles call this to compute grid (not FLEX/GRID API, custom domain logic).

**Opportunity:** If extracted to GRID primitive, layoutColumns becomes a **preset:**
```ts
// SDK
export function createColumnFlow(parent, { columns: 2, columnHeaders }): UiPart {
  return createGrid(parent, {
    cols: 2,
    colSizes: ["1fr", "1fr"],
    rowSizes: ["auto"],  // dynamic per item
    items: computed dynamically
  });
}
```

But this is **lower priority** than extracting createGrid first (hello-world's basic grid works for both).

---

## Files to Update

1. `src/core/ui-parts.ts` — add createGrid (extract from hello-world)
2. `src/services/microapp-sdk.js` — export createGrid
3. `.agents/specs/layout-system.md` — (create, if not existing) document FLEX/GRID/CANVAS families
4. `.pi/skills/new-window-type/SKILL.md` — reference FLEX/GRID/CANVAS decision tree
5. `.planning/` — log E034 findings in epic/feature summary

---

## Appendix: Quick Reference

### Do use:
- ✅ createStack + createColumns for any grid-like layout (hello-world, e026-demo pattern)
- ✅ createButtonBar for toolbars/palettes
- ✅ blessed.box with fixed top/left for status bars, headers, floating windows

### Don't use:
- ❌ Manual left/width calculation (slap-editor, heartbeat pattern) — use createColumns instead
- ❌ Hardcoded grid positioning (Zine style) — wait for createGrid, then switch
- ❌ Position override Map without documenting CANVAS pattern

### Defer:
- ⏳ createLayerGroup (glitchbox pattern — works today, formalize later)
- ⏳ Responsive breakpoints (hello-world inlined; extract later as createResponsiveLayout)
- ⏳ Resize grips (sy2-chronicles terrain; deferred to E035 UiPart v2)

