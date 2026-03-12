# Textual Layout System → WibWob-DOS Mapping

**Date:** March 12, 2026  
**Research:** Textual (Python TUI framework, vendor/textual/)  
**Target:** WibWob-DOS layout primitives (src/core/ui-parts.ts, src/core/window-chrome.ts)  
**Purpose:** Identify which Textual naming patterns and concepts we should adopt vs. diverge from

---

## 1. Textual Layout Concepts — Complete Inventory

### 1.1 Layout Modes

| Textual API | CSS Property | Python Property | Effect |
|---|---|---|---|
| `layout: vertical` | `layout: vertical;` | `widget.styles.layout = "vertical"` | Children flow top-to-bottom. Width auto-fills parent. Height explicit or `fr`. Auto-scrollbar on overflow-y. |
| `layout: horizontal` | `layout: horizontal;` | `widget.styles.layout = "horizontal"` | Children flow left-to-right. Height defaults to 100% of parent. Width explicit or `fr`. Overflow-x: auto for scrolling. |
| `layout: grid` | `layout: grid;` | `widget.styles.layout = "grid"` | Children arranged in grid via `grid-size`, `grid-columns`, `grid-rows`. Auto-fill on demand if rows omitted. |

### 1.2 Grid-Specific Properties

| Textual API | CSS Property | Python Property | Effect |
|---|---|---|---|
| Grid dimensions | `grid-size: 3` or `grid-size: 3 5;` | `widget.styles.grid_size_columns = 3` / `grid_size_rows = 5` | Specify grid columns (required), rows (optional, auto-create if omitted). |
| Column sizing | `grid-columns: 2fr 1fr 1fr;` | `widget.styles.grid_columns = "2fr 1fr 1fr"` | Per-column width. Supports fixed (px), `fr`, `%`, `auto`. Cycles if fewer specs than columns. |
| Row sizing | `grid-rows: 1fr 6 25%;` | `widget.styles.grid_rows = "1fr 6 25%"` | Per-row height. Supports fixed (px), `fr`, `%`, `auto`. Cycles if fewer specs than rows. |
| Gutter spacing | `grid-gutter: 1;` or `grid-gutter: 1 2;` | `grid_gutter_vertical = "1"` / `grid_gutter_horizontal = "2"` | Spacing between grid cells. One value = both axes. Two values = vertical, horizontal. Applied only *between* cells, not at edges. |

### 1.3 Spanning & Positioning

| Textual API | CSS Property | Python Property | Effect | Scope |
|---|---|---|---|---|
| Column spanning | `column-span: 3;` | `widget.styles.column_span = 3` | Widget occupies N columns in grid. | Grid children only |
| Row spanning | `row-span: 2;` | `widget.styles.row_span = 2` | Widget occupies N rows in grid. | Grid children only |
| Docking | `dock: left;` (or top, right, bottom) | `widget.styles.dock = "left"` | Fix widget to edge, remove from layout flow. Stacks in yield order if multiple docks to same edge. | Any widget |

### 1.4 Alignment Properties

| Textual API | CSS Property | Python Property | Effect | Targets |
|---|---|---|---|---|
| Child alignment | `align: center middle;` or `align-horizontal: center; align-vertical: middle;` | `widget.styles.align = ("center", "middle")` / `align_horizontal = "center"` / `align_vertical = "middle"` | How children are positioned within a container. Horizontal: `left`, `center`, `right`. Vertical: `top`, `middle`, `bottom`. | Container's children |
| Content alignment | `content-align: center middle;` | `widget.styles.content_align = ("center", "middle")` / `content_align_horizontal = "center"` / `content_align_vertical = "middle"` | How content is positioned *inside* a widget (e.g., text in a label). | Widget's own content |

### 1.5 Sizing Units

Textual supports four sizing modes:

| Unit | Example | Behavior |
|---|---|---|
| Fixed pixels | `20` or `20px` | Exact cell count. |
| Fractional (fr) | `1fr`, `2fr` | Proportional share of remaining space. Share = unit value / total fr. |
| Percentage | `50%` | Percentage of parent dimension. |
| Auto | `auto` | Size to content. Only valid in `grid-columns` or `grid-rows`. |

---

## 2. WibWob-DOS Current Layout System

### 2.1 Core Primitives (src/core/ui-parts.ts)

```typescript
type UiPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;        // Apply dimensions & position
  update(props: Props): void;      // Update content
  restyle(): void;                  // Apply theme
  destroy(): void;                  // Cleanup
};

type Rect = { top: number; left: number; width: number; height: number };

type StackChild = {
  key: string;
  basis: number | string;          // Fixed px OR "Nfr" (e.g. "2fr")
  part: UiPart<any>;
  visible?: () => boolean;         // Conditional show/hide
};
```

### 2.2 Layout Functions

| WibWob API | Effect | Maps To Textual |
|---|---|---|
| `createStack(parent, children)` | Vertical linear layout. Width auto-fills. Height from basis. | `layout: vertical` |
| `createColumns(parent, children)` | Horizontal linear layout. Height fills parent. Width from basis. | `layout: horizontal` |
| `applyRect(node, rect)` | Absolute positioning via {top, left, width, height}. | `position: absolute` + manual coords |
| `createNodePart(node)` | Wrap blessed.box as UiPart for layout participation. | Box in layout tree |
| `StackChild.basis` | `number` = fixed px; `"Nfr"` = fractional unit. | `grid-columns: Nfr`, `grid-rows: Nfr` |
| `StackChild.visible` | Function returning boolean. Hide/show based on condition. | N/A (Textual has `display: none`, different model) |

### 2.3 Component Builders (Higher-Level SDK)

| WibWob API | Maps to |
|---|---|
| `createHeaderBar(parent, opts)` | Fake dock (fixed height 1, always top) |
| `createStatusBar(parent, opts)` | Fake dock (fixed height 1, always bottom) |
| `createSidebarPanel(parent, children, opts)` | Fake dock (fixed width sidebar + main content) with toggle |
| `createButtonBar(parent, buttons)` | Horizontal flex layout |
| `createFigletDisplay(parent)` | Scrollable vertical content |
| `createTextBlock(parent)` | Text wrapping container |
| `createInputLine(parent)` | Single-line input |
| `createMessageHistory(parent)` | Scrollable message list |
| `createCollapsibleBlock(parent, title, children)` | Expandable/collapsible section (manual toggle via update) |
| `createContentStack(parent, children)` | Scrollable vertical container |

### 2.4 Window Chrome (src/core/window-chrome.ts)

| API | Effect |
|---|---|
| `ChromeMode` | "standard" (frame + chrome), "toolbar" (compact), "frameless" (no chrome) |
| `CHROME_PADDING` | Per-mode size overhead: standard={2w, 2h}, toolbar={4w, 5h}, frameless={0,0} |
| `contentToWindowSize()` | Convert content dimensions to window dimensions including chrome |
| `getChromeModeForWindow()` | Select chrome mode by WindowKind |

---

## 3. Mapping: Textual ↔ WibWob

### 3.1 Layout Flow (✓ Aligned)

| Textual | WibWob | Alignment |
|---|---|---|
| `layout: vertical` | `createStack()` | ✓ Identical semantics. Textual: top-to-bottom. WibWob: top-to-bottom. |
| `layout: horizontal` | `createColumns()` | ✓ Identical semantics. Textual: left-to-right. WibWob: left-to-right. |

### 3.2 Sizing Units (✓ Aligned)

| Textual | WibWob | Alignment |
|---|---|---|
| `2fr` | `"2fr"` (StackChild.basis) | ✓ Identical. Fractional unit parsing + allocation via createLinearLayout(). |
| `20` (fixed) | `20` (StackChild.basis) | ✓ Identical. Fixed pixel sizing. |
| `50%` | ✗ Not supported | ⚠ Textual supports %; WibWob does not. |
| `auto` | ✗ Not supported | ⚠ Textual supports auto-size-to-content; WibWob does not. |

### 3.3 Grid Layout (✗ WibWob Missing — CRITICAL GAP)

| Textual | WibWob | Status |
|---|---|---|
| `layout: grid` | ✗ Does not exist | **MISSING.** Modules resort to manual applyRect() for grid-like layouts. |
| `grid-size: 3 5` | ✗ Does not exist | **MISSING.** No way to declare grid dimensions. |
| `grid-columns: 2fr 1fr 1fr` | ✗ Does not exist | **MISSING.** No per-column width specification. |
| `grid-rows: 1fr 6 25%` | ✗ Does not exist | **MISSING.** No per-row height specification. |
| `grid-gutter: 1 2` | ✗ Does not exist | **MISSING.** No built-in gap/spacing. |
| `column-span: 3` | ✗ Does not exist | **MISSING.** No cell spanning. Module workaround: manually calculate. |
| `row-span: 2` | ✗ Does not exist | **MISSING.** No cell spanning. |

**Module Workarounds for Grid:**
- `dashboard`: hand-positioned absolute boxes with top/left/width/height
- `dashboard-xxl`: manual {row, col, rowSpan, colSpan} + pixel math
- `wibwob-tr808`: step-button grid via applyRect loop
- `wibwob-tidepool`: sidebar + grid area with applyRect

**Recommendation:** Implement `createGrid()` as a high-priority primitive.

### 3.4 Docking (⚠ WibWob Partial — Fake Pattern)

| Textual | WibWob | Status |
|---|---|---|
| `dock: top` / `dock: bottom` / `dock: left` / `dock: right` | `createHeaderBar()` / `createStatusBar()` (fixed-basis in createStack) | ⚠ **FAKED.** Docking behavior approximated by fixed-height/width children in linear layout. Works but is not semantic. |
| Multiple docks to same edge stack in yield order | N/A | ⚠ Not really supported. Multiple headers would need explicit nesting. |
| Dock removes from flow, fixed to edge | Faked: headerBar/statusBar always first/last in stack | ✓ Functionally works but not true docking. |

**Module Use of Faked Dock:**
- All modules: headerBar (fixed 1 row) + body (1fr) + statusBar (fixed 1 row)
- `hello-world`: floating art box with bottom/right + manual show/hide (Textual-style dock behavior)
- `zine`/`sy2-chronicles`: toolbar at root height - 1 (fake bottom dock)

**Recommendation:** Consider whether to formalize docking or keep the current pattern. Current pattern is simpler and already works.

### 3.5 Content & Child Alignment (⚠ WibWob Minimal)

| Textual | WibWob | Status |
|---|---|---|
| `align: center middle` (children alignment) | ✗ Mostly not available | ⚠ **NOT BUILT IN.** Modules that need content centering build custom. Example: `createHeaderBar()` uses manual `renderAlignedBar()` with left/right alignment only. |
| `content-align: center middle` (content alignment) | ✗ Mostly not available | ⚠ **NOT BUILT IN.** Individual widgets implement their own alignment. |
| Horizontal alignment: `left`, `center`, `right` | Implicit in widget implementations | Partial. `createHeaderBar()` supports left/right via `renderAlignedBar()`. |
| Vertical alignment: `top`, `middle`, `bottom` | Implicit in widget implementations | Minimal. Blessed layout defaults handle this. |

**Recommendation:** Low priority. Most modules don't need this — flex layout already does what's needed.

### 3.6 Overflow & Scrolling

| Textual | WibWob | Status |
|---|---|---|
| `overflow-y: auto` (vertical scroll) | Implicit in scrollable containers | ✓ Works. `createStack()` with height 1fr children on fixed parent causes scroll. |
| `overflow-x: auto` (horizontal scroll) | Implicit in scrollable containers | ✓ Works. `createColumns()` can scroll horizontally if needed. |
| `overflow: hidden` | blessed element visibility | ✓ Clipping happens automatically via blessed. |

---

## 4. What Textual Has That WibWob Doesn't

### Critical Gaps

1. **Grid Layout System**
   - Textual: `layout: grid` + `grid-size`, `grid-columns`, `grid-rows`, cell spanning
   - WibWob: No built-in grid. Modules resort to manual applyRect() math.
   - **Impact:** HIGH. Every module that needs grid-like layouts reinvents it.
   - **Module count affected:** 5+ (dashboard, dashboard-xxl, tr808, tidepool, patterns)

2. **Grid Gutter / Gap**
   - Textual: `grid-gutter: 1 2` (vertical + horizontal spacing)
   - WibWob: No built-in gap. Modules hardcode spacing.
   - **Impact:** MEDIUM. Affects visual consistency and code clarity.

3. **Auto-Sizing to Content**
   - Textual: `grid-columns: auto` or `grid-rows: auto`
   - WibWob: Must manually measure content and pass fixed size
   - **Impact:** MEDIUM. Useful for sidebar widths, button rows.

4. **Percentage Sizing**
   - Textual: `width: 50%`, `grid-columns: 50% 50%`
   - WibWob: No % support. Must use fr or fixed px.
   - **Impact:** LOW. Fr units are more flexible anyway.

### Nice-to-Have Gaps

5. **Formal Content Alignment**
   - Textual: `content-align: center middle`
   - WibWob: Ad-hoc per-widget
   - **Impact:** LOW. Would improve code clarity but not essential.

6. **Semantic Dock**
   - Textual: `dock: left` removes from flow, pins to edge
   - WibWob: Faked via fixed-basis children
   - **Impact:** LOW. Current pattern works. Formalization is cleaner but not required.

---

## 5. What WibWob Has That Textual Doesn't

### Architectural Differences

1. **Overlapping Windows with Z-Order**
   - WibWob: Full window manager with window-facade, focus stack, drag, resize, shadows
   - Textual: No window manager concept. Single renderable tree. Must build from scratch.
   - **Impact:** NONE. Textual not trying to do this. Different problem domain.

2. **Microapp SDK**
   - WibWob: High-level SDK (createWindow, registerCommand, theme access)
   - Textual: Framework provides widgets, not SDK pattern
   - **Impact:** WibWob architectural choice. SDK isolation + modularity.

3. **Theme System with Runtime Switching**
   - WibWob: 25+ semantic tokens, restyleAll() hooks, external theme loading
   - Textual: No theme system. Colours per-widget, no switching API.
   - **Impact:** WibWob-specific. Desktop app needs theming. Textual assumes app-default colors.

4. **Conditional Visibility via StackChild.visible**
   - WibWob: `visible?: () => boolean` on children. Dynamic show/hide based on condition.
   - Textual: `display: none` CSS property (static, not condition-based)
   - **Impact:** NICE-TO-HAVE. Useful for responsive layouts (e.g., figlet font fallback).

5. **Workspace Save/Restore**
   - WibWob: State service persists window layout, positions, content
   - Textual: Application responsibility (not framework feature)
   - **Impact:** WibWob-specific. Desktop app needs this.

6. **Control API & State JSON**
   - WibWob: HTTP control surface (:8099), `/state` endpoint for agent automation
   - Textual: No built-in remote control / API
   - **Impact:** WibWob-specific. Agent integration feature.

7. **Terminal Widget**
   - WibWob: blessed.terminal with PTY bridge
   - Textual: No built-in terminal emulator (must compose from scratch or integrate xterm)
   - **Impact:** FEATURE, not layout. Terminal is a microapp module, not a primitive.

---

## 6. Recommended Naming Pattern Adoptions

### 6.1 ADOPT: Grid Property Names

**Current WibWob (future):**
```typescript
// If we implement grid, use Textual names
type GridConfig = {
  cols: number;                      // grid-columns count
  rows?: number;                     // grid-rows count (optional, auto-create)
  colSizes?: (string | number)[];    // grid-columns: "2fr 1fr auto"
  rowSizes?: (string | number)[];    // grid-rows: "1fr 6 25%"
  gutter?: number | [number, number]; // grid-gutter: 1 2
};
```

**Why:** Textual's names are CSS-derived and already familiar to web developers. Consistency with web layout vocabulary.

### 6.2 ADOPT: Fr Unit Syntax

**Current:** ✓ Already aligned.  
**Names:** Keep `"2fr"` as string in StackChild.basis. Already matches Textual.

### 6.3 ADOPT: Dock Naming (Optional Formalization)

If we ever formalize docking:

```typescript
// Textual's edge names
type DockEdge = "top" | "right" | "bottom" | "left";

// WibWob could add:
function dock(parent: blessed.Widgets.Node, edge: DockEdge, part: UiPart, opts?: {}): UiPart
```

**Why:** Matches Textual + CSS convention. Clear semantics.

### 6.4 DIVERGE: Layout Property (Keep createStack / createColumns)

**Recommendation:** Do NOT adopt `layout: vertical` / `layout: horizontal` as CSS properties in WibWob.

**Why:**
- WibWob layouts are selected at **code time** (`createStack` vs `createColumns`), not style time.
- This is **intentional** — the SDK primitives are compositional and testable.
- Textual's CSS-style layout selection is fine for a single-tree framework.
- WibWob's function-based composition is more explicit for multi-window/multi-module context.

**Anti-example (what NOT to do):**
```typescript
// ✗ DON'T do this
const stack = blessed.box({ parent, style: { layout: "vertical" } });
// Layout selected via style property instead of primitive function
```

### 6.5 DIVERGE: Content Alignment in Textual CSS Style

**Recommendation:** Do NOT adopt `content-align` as a CSS property in WibWob.

**Why:**
- WibWob uses **blessed's built-in alignment**, not custom alignment logic.
- Blessed handles text alignment via `align` property (left/center/right).
- Adding `content-align` as a style property would require new layout logic.
- Low payoff for current use cases.

---

## 7. Priority Implementation Order (If Building Grid)

### Phase 1: Core Grid Primitive (High Impact)

```typescript
// src/core/ui-parts.ts

type GridConfig = {
  cols: number;                          // Required: column count
  rows?: number;                         // Optional: row count (auto if omitted)
  colSizes?: (string | number)[];        // ["2fr", "1fr", "auto"] or [40, 1fr]
  rowSizes?: (string | number)[];        // Same format
  gutter?: number | [number, number];    // (vert) or (vert, horiz)
};

export function createGrid(
  parent: blessed.Widgets.Node,
  items: { part: UiPart; col: number; row: number; colSpan?: number; rowSpan?: number }[],
  config: GridConfig
): UiPart<void>;
```

**Why First:**
- Unblocks 5+ modules
- Code reduction: eliminates manual applyRect loops
- Single source of truth for grid math

### Phase 2: Grid Cell Spanning (Medium Impact)

Extend createGrid to support colSpan, rowSpan on each item.

**Why Second:**
- Necessary for complex layouts (e.g., dashboard headers)
- Builds on phase 1 logic

### Phase 3: Auto-Sizing (Lower Priority)

Support `"auto"` in colSizes/rowSizes to size columns/rows to content.

**Why Third:**
- Fewer modules need this
- Can measure content separately if needed

### Phase 4: Dock Formalization (Optional)

Add explicit `dock()` function if the pattern becomes clearer.

**Why Fourth (Optional):**
- Current fake-dock pattern already works
- Formalization is polish, not feature

---

## 8. Textual Naming Patterns We Should NOT Adopt

### 8.1 CSS Selectors for Layout

**Textual:**
```css
/* Style by class/ID */
#my-grid {
  layout: grid;
  grid-size: 3;
  grid-columns: 2fr 1fr 1fr;
}

#header {
  dock: top;
}
```

**WibWob:** ✗ Do not adopt.

**Why:**
- WibWob SDK returns UiPart objects, not DOM nodes.
- CSS selectors assume a DOM tree.
- Blessed supports CSS selectors, but we abstract them away in the SDK.
- Function-based API is more composable for microapps.

### 8.2 Dynamic Style Changes via CSS

**Textual:**
```python
widget.styles.layout = "grid"  # Change layout at runtime
widget.styles.grid_size_columns = 5
```

**WibWob:** Partially adopted, but with caution.

**Why:**
- WibWob determines layout at **composition time**, not runtime.
- Changing layout dynamically is rare in the current architecture.
- Responsive breakpoints are handled via `StackChild.visible` and responsive figlet fonts, not runtime layout swaps.

### 8.3 Percentage-Based Sizing

**Textual:** `width: 50%`, `grid-columns: 50%`

**WibWob:** ✗ Do not adopt.

**Why:**
- Fr units are more powerful (proportional, not fixed ratio).
- Terminal cells are irregular (2:1 aspect), so percentages are ambiguous.
- Existing fr math already handles responsive sizing.

---

## 9. Cross-Reference: Spec Interactions

These findings should be reflected in the subsystem specs:

| Spec | Section | Update |
|---|---|---|
| `.agents/specs/window-system.md` | Window geometry & layout | Note the createGrid proposal and adoption of Textual naming for grid properties |
| `.agents/specs/state-and-api.md` | State schema for windows | When grid is implemented, window state should include grid config |
| `docs/building-custom-modules.md` | Layout primitives section | Add createGrid() example once implemented |
| `.agents/AGENTS.md` | Layout Primitives section (chore-audit-layout-primitives) | Update with priority order and phase breakdown |

---

## 10. Summary Table: Adoption Checklist

| Concept | Textual Name | Adopt? | Notes |
|---|---|---|---|
| Vertical flow | `layout: vertical` | Indirect | Keep `createStack()` name; semantics aligned |
| Horizontal flow | `layout: horizontal` | Indirect | Keep `createColumns()` name; semantics aligned |
| Fr units | `2fr` | ✓ YES | Already used; matches exactly |
| Grid layout | `layout: grid` | ⚠ IF IMPLEMENTED | Use grid-size, grid-cols, grid-rows names |
| Grid gutter | `grid-gutter: 1 2` | ⚠ IF IMPLEMENTED | Adopt naming exactly |
| Column sizing | `grid-columns: 2fr 1fr` | ⚠ IF IMPLEMENTED | Adopt naming exactly |
| Row sizing | `grid-rows: 1fr 6` | ⚠ IF IMPLEMENTED | Adopt naming exactly |
| Cell spanning | `column-span`, `row-span` | ⚠ IF IMPLEMENTED | Adopt naming exactly |
| Docking | `dock: top/right/bottom/left` | ✓ IF FORMALIZED | Adopt naming; currently faked |
| Child alignment | `align: center middle` | ✗ NO | Not critical; blessed defaults sufficient |
| Content alignment | `content-align: center middle` | ✗ NO | Low payoff for WibWob use cases |
| Percentage sizing | `width: 50%` | ✗ NO | Fr units superior for terminals |
| Auto-sizing | `grid-columns: auto` | ⚠ OPTIONAL | Nice-to-have; lower priority |

---

## 11. Actionable Recommendations

### Immediate (No Code Changes)

1. **Adopt naming:** If grid primitive is built, use Textual names (`grid-size`, `grid-columns`, `grid-rows`, `grid-gutter`, `column-span`, `row-span`).
2. **Document alignment:** Add to AGENTS.md that WibWob layout intentionally diverges from CSS-style (functions, not properties) due to SDK-first architecture.

### Near-Term (If Grid Spike is Approved)

1. **Prototype createGrid()** following the Phase 1 spec in section 7.
2. **Measure impact:** Port one module (dashboard or tr808) and measure code reduction.
3. **Update specs:** Reflect grid naming and behavior in `.agents/specs/window-system.md`.
4. **Update AGENTS.md:** Priority order for createGrid + responsive breakpoints + dock formalization.

### Deferred (Future Sessions)

1. **Auto-sizing:** Implement `"auto"` support in grid columns/rows.
2. **Dock formalization:** Consider `dock()` function if pattern clarifies.
3. **Responsive breakpoints:** Extend responsive logic for grid column collapse (3-col → 2-col → 1-col).

---

## Appendix A: Textual vs. CSS Grid (Web)

Textual's naming is CSS-inspired but not identical to CSS Grid:

| Feature | CSS Grid | Textual | WibWob Planned |
|---|---|---|---|
| Grid template | `grid-template-columns: repeat(3, 1fr)` | `grid-columns: 1fr 1fr 1fr` (or repeated: `grid-columns: 1fr`) | Same as Textual (if implemented) |
| Gutter | `column-gap`, `row-gap` | `grid-gutter: 1 2` | `grid-gutter: 1 2` (matches Textual) |
| Implicit rows | Auto-fill / auto-fit | Auto-create if rows omitted | `rows?: number` (optional) |
| Cell spanning | `grid-column: span 2` | `column-span: 2` | `column-span: 2` (matches Textual) |

**Observation:** Textual made CSS Grid simpler for terminal use:
- Single `grid-gutter` instead of separate column/row gaps
- Integer-based spans instead of `span N` notation
- Implicit auto-row creation (no auto-fit complexity)

WibWob should adopt Textual's simplifications, not CSS Grid's full complexity.

---

## Appendix B: Related Files in This Session

- **Read:** `.planning/chores/menu-nav-figlet-audit/chore-audit-layout-primitives.txt` (section 4: "WHAT TEXTUAL HAS")
- **Read:** `.planning/spikes/spk-opentui-vs-blessed/report.md` (section 4, feature table)
- **Read:** `vendor/textual/docs/guide/layout.md`, `docs/styles/layout.md`, grid/*.md
- **Read:** `src/core/ui-parts.ts`, `src/core/window-chrome.ts`

---

**End of Mapping Document**

Generated: March 12, 2026  
Scout: Claude Code  
Status: Ready for epic planning or prototype phase
