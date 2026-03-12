# Layout Primitives: WibWob-DOS vs CSS / Tailwind Audit

**Date:** 2026-03-12  
**Scope:** All layout functions, types, and concepts from `ui-parts.ts`, `panel-layout.ts`, `canvas-types.ts`, `modules/hello-world/index.ts`, `microapp-sdk.ts`

> **CORRECTIONS (post-review decisions):**
>
> This doc was generated before the final architecture review. The following
> recommendations in this doc are WRONG and superseded:
>
> - DO NOT extract Compass/COMPASS_ALIGN to SDK. "Compass" is demo vocabulary
>   from hello-world. The SDK uses CSS-standard justify/align two-axis system:
>   `{ justify: "start" | "center" | "end", align: "start" | "center" | "end" }`.
>   See Codex review in 05-module-audit-summary.md.
> - DO NOT treat layoutColumns as an SDK primitive. It is a domain-specific
>   pattern for zine, not a peer of flex/grid.
> - The composition interface is LayoutPart (not UiPart). See Codex review.
> - Breakpoints are ascending: xs/sm/md/lg/xl (Tailwind order).
>
> The CSS mapping table below remains accurate. The recommendations are stale.

---

## Critical Naming Issues Found

### 🔴 SEVERE: `createColumns` vs CSS Flexbox Direction

| Aspect | WibWob Name | CSS Equivalent | Tailwind | Assessment | Canon Name |
|--------|------------|---|---|---|---|
| **Vertical stack (flex-direction: column)** | `createStack()` | flexbox with `flex-direction: column` | `flex flex-col` | ✅ Correct, matches CSS meaning | `createStack` |
| **Horizontal stack (flex-direction: row)** | `createColumns()` | flexbox with `flex-direction: row` | `flex flex-row` | ❌ MISLEADING — says "columns" but means "rows". A "row" is a horizontal container for columns. | `createRow` |
| **Magazine-style multi-column** | `layoutColumns()` | CSS `columns` property / multi-column layout | `columns-* | break-*` | ✅ Correct — actually uses multi-column semantics | `layoutColumns` |

**Problem:** The name collision is severe.  
- `createColumns()` creates a *horizontal flex container* (a "row" visually)
- `layoutColumns()` creates a *multi-column magazine layout*
- These are completely different CSS concepts, but the names suggest they're related

**Recommendation:**  
Rename `createColumns()` → `createRow()` to align with flexbox mental model and avoid collision with the magazine-layout concept.

---

### 🔴 MAJOR: Breakpoint Naming is Backwards

| WibWob Name | Min Size | Tailwind Name | Min Size | Problem | Suggested Canon |
|---|---|---|---|---|---|
| `S` (small screen) | < 40w | `sm` (small) | 640px | Inverse logic: S=small device (confusing), `sm`=small *breakpoint* (clearer). WibWob S means the condition is `w < 40`, Tailwind `sm` means the condition is `w >= 640px`. | `xs` or `compact` |
| `M` (medium) | 40+ x 12+ | `md` (medium) | 768px | Same issue | `sm` |
| `L` (large) | 65+ x 18+ | `lg` (large) | 1024px | Same issue | `md` |
| `XL` (extra large) | 95+ x 26+ | `xl` (extra large) | 1280px | Same issue | `lg` |

**Problem:**  
WibWob breakpoints are device-centric ("S" = "small device" = worst case), but the naming suggests content-centric ("S" = "small content").  
Tailwind's naming is clearer: `sm`, `md`, `lg` increment upward as the *viewport* grows, matching `minWidth` checks.

**Recommendation:**  
Rename breakpoints to match Tailwind's ascending scale: S→xs, M→sm, L→md, XL→lg (or add Tailwind's 2xl/3xl tiers).

---

### 🟡 MAJOR: Compass System Not Exposed as SDK Primitive

| WibWob Concept | CSS Equivalent | Tailwind Equivalent | Location | SDK Export | Status |
|---|---|---|---|---|---|
| `Compass` type (9 cardinal points: NW/N/NE/W/C/E/SW/S/SE) | `justify-content` + `align-items` | `justify-{start\|center\|end}` + `items-{start\|center\|end}` | `modules/hello-world/index.ts` (inlined) | ❌ NOT exported | ⚠️ Candidate |
| `COMPASS_ALIGN` mapping | Maps cardinal → `{align, valign}` blessed props | Maps to Tailwind spacing/alignment | `modules/hello-world/index.ts` (inlined) | ❌ NOT exported | ⚠️ Candidate |
| `pickBreakpoint()` helper | Media query logic | Tailwind directives or `@apply` | `modules/hello-world/index.ts` (inlined) | ❌ NOT exported | ⚠️ Candidate |

**Problem:**  
The compass system and responsive breakpoint logic live *inlined* in hello-world as "candidates for SDK extraction" but are never extracted. They're proven design patterns that should be shared primitives.

**Recommendation:**  
Promote `Compass`, `COMPASS_ALIGN`, and `pickBreakpoint()` to SDK exports in `microapp-sdk.ts` → `ui-parts.ts`.

---

### 🟡 MAJOR: `createGrid()` Not in SDK

| Aspect | WibWob Status | CSS | Tailwind | Canon Location |
|---|---|---|---|---|
| **CSS Grid support** | Inlined in hello-world only | `grid`, `grid-template-rows`, `grid-template-columns`, `grid-column`, `grid-row` | `grid`, `grid-cols-*`, `grid-rows-*`, `col-span-*`, `row-span-*` | ⚠️ Should be in SDK |
| **Track sizing (rows/cols)** | `TrackSize = number \| "${number}fr"` | `fr` unit, or pixel values | `col-span-*`, `w-*` for fixed; `1fr` syntax via Tailwind CSS | ✅ Matches CSS |
| **Grid gaps** | `gap?: number \| [number, number]` | `gap`, `row-gap`, `column-gap` | `gap-*`, `gap-x-*`, `gap-y-*` | ✅ Matches |
| **Cell spanning** | `GridCell: {row, col, rowSpan, colSpan}` | `grid-column`, `grid-row` with spans | `col-span-*`, `row-span-*` | ✅ Matches |

**Problem:**  
`createGrid()` is a complete, working CSS Grid implementation but is hidden in a demo module. Every panel-based microapp (zine, sy2-chronicles) could reuse it.

**Recommendation:**  
Extract `createGrid()` to `src/core/grid-layout.ts` and export via `microapp-sdk.ts`.

---

### 🟡 MAJOR: Flex `basis` Property Naming

| WibWob | Property Name | CSS | Tailwind | Status |
|---|---|---|---|---|
| `StackChild.basis` | `basis: number \| string` | `flex-basis` | `basis-*` | ✅ Correct but underdocumented |
| `basis` unit | `"${number}fr"` | `fr` unit | N/A (Tailwind uses predefined values) | ✅ Matches CSS Grid syntax |
| Fixed values | `basis: 10` (pixels) | `10px` | `basis-10` (2.5rem) | ✅ Matches |
| Fractional growth | `basis: "2fr"` | `2fr` | No direct equivalent (Tailwind uses flex-grow) | ⚠️ Works but mixing fr + basis is unconventional CSS |

**Note:** WibWob correctly uses the `fr` unit for fractional flex growth, matching CSS Grid syntax. This is good design.

---

## Complete Mapping Table

### Layout Containers

| WibWob Name | WibWob Signature | CSS Equivalent | Tailwind | Assessment | Canon Name |
|---|---|---|---|---|---|
| `createStack` | `(parent, children: StackChild[]) → UiPart` | `display: flex; flex-direction: column` | `flex flex-col` | ✅ Correct | `createStack` |
| `createRow` *[currently `createColumns`]* | `(parent, children: StackChild[]) → UiPart` | `display: flex; flex-direction: row` | `flex flex-row` | ❌ Rename from `createColumns` | `createRow` |
| `createGrid` | `(parent, opts: GridOptions) → Grid` | `display: grid; grid-template-rows/columns` | `grid grid-cols-* grid-rows-*` | ⚠️ Not in SDK | Extract to SDK |
| `layoutColumns` | `(panels, maxWidth, opts) → ZineLayoutResult` | `columns: auto; column-gap: 2` (magazine layout) | `columns-* gap-*` | ✅ Correct | `layoutColumns` |
| `layoutPanels` | `(panels, maxWidth) → LayoutResult` | No direct CSS equivalent; custom row-wrap logic | No direct equivalent (use grid or flexbox) | ⚠️ Ad-hoc layout | Consider merging with `layoutColumns` |

### Flex Child Sizing

| WibWob | Type | CSS Property | Tailwind Class | Status |
|---|---|---|---|---|
| `StackChild.basis` | `number \| "${number}fr"` | `flex-basis` | `basis-*` / `grow-*` | ✅ Correct, good fr syntax |
| `applyRect()` | Applies rect to blessed node | Sets `top, left, width, height` | Bless. only (not Tailwind) | ✅ Correct |

### Alignment & Positioning

| WibWob Name | Concept | CSS Equivalent | Tailwind Equivalent | Location | Export Status | Canon |
|---|---|---|---|---|---|---|
| `Compass` (9-point) | Cardinal alignment (NW/N/NE/W/C/E/SW/S/SE) | `justify-content` + `align-items` + `align-self` | `justify-{start\|center\|end}` `items-{start\|center\|end}` | `hello-world/index.ts` | ❌ Inlined only | Promote to SDK |
| `COMPASS_ALIGN` | Maps compass → blessed `{align, valign}` props | Manual property mapping | N/A (conceptual) | `hello-world/index.ts` | ❌ Inlined only | Promote to SDK |
| Flex alignment | Not explicitly exposed | `justify-content`, `align-items`, `justify-self`, `align-self` | `justify-*`, `items-*`, `self-*` | SDK layer | ⚠️ Inferred from layout | Add explicit alignment options |

### Responsive Design

| WibWob | Breakpoint Values | CSS | Tailwind | Location | Export Status | Canon |
|---|---|---|---|---|---|---|
| `S` | `< 40w or < 12h` (smallest) | N/A | `sm: 640px` | Various modules | ✅ Used but not named consistently | Rename to `xs` |
| `M` | `40w+ and 12h+` | N/A | `md: 768px` | Various | ✅ | Rename to `sm` |
| `L` | `65w+ and 18h+` | N/A | `lg: 1024px` | Various | ✅ | Rename to `md` |
| `XL` | `95w+ and 26h+` (largest) | N/A | `xl: 1280px` | Various | ✅ | Rename to `lg` |
| `pickBreakpoint()` | Media query matching logic | CSS media queries `@media (min-width: ...)` | Tailwind responsive prefixes `md:`, `lg:` | `hello-world/index.ts` | ❌ Inlined only | Promote to SDK |

### Box / Container Types

| WibWob Name | Properties | CSS / Tailwind Role | Assessment |
|---|---|---|---|
| `Rect` | `{top, left, width, height}` | DOMRect or CSS properties | ✅ Correct; bless-native |
| `UiPart<Props>` | `{node, layout(), update(), restyle(), destroy()}` | Component interface | ✅ Correct; blessed-native pattern |
| `StackChild` | `{key, basis, part, visible?}` | Flex item spec | ✅ Correct |
| `ContentStackChild` | `{key, node, contentHeight()}` | Custom vertical stack item | ✅ Correct; specialized |

### Sidebar Layout

| WibWob Name | Signature | CSS Equivalent | Tailwind | Assessment |
|---|---|---|---|---|
| `SidebarWidth` | `SidebarWidthFixed \| SidebarWidthPercent` | `width: 200px` vs `width: 25%` | `w-48` vs `w-1/4` | ✅ Correct |
| `SidebarPanel` | Sidebar + divider + main content | CSS Grid or flexbox with sidebar | `grid grid-cols-[200px_1fr]` | ✅ Correct |
| `resolveSidebarWidth()` | Responsive sizing with min/max | `clamp(value, min, max)` or media queries | Tailwind responsive + tailwind-safe-list | ✅ Correct |
| `createSidebarPanel()` | Factory for sidebar + main layout | N/A | Grid or flex component | ✅ Correct |

### Typography / Text Rendering

| WibWob Name | Concept | CSS | Tailwind | SDK Export |
|---|---|---|---|---|
| `createHeaderBar` | Fixed-height header row | `position: sticky` or `top: 0` | Tailwind sticky | ✅ Exported |
| `createStatusBar` | Fixed-height status bar | `position: fixed` or sticky | Tailwind sticky/fixed | ✅ Exported |
| `createTextBlock` | Scrollable text area | `overflow: auto; white-space: pre-wrap` | `overflow-auto whitespace-pre-wrap` | ✅ Exported |
| `createFigletDisplay` | ASCII art display (figlet) | `<pre>` + monospace font | `font-mono whitespace-pre` | ✅ Exported |

### Interactive Components

| WibWob Name | CSS Role | Tailwind Concept | SDK Export |
|---|---|---|---|
| `createInputLine` | `<input type="text">` | Tailwind form input | ✅ Exported |
| `createMessageHistory` | `<ul>` message list | Tailwind list layout | ✅ Exported |
| `createRule` | Separator / divider | Tailwind divider classes `border-*` | ✅ Exported |
| `createButtonBar` | Toolbar with buttons | Tailwind button group | ✅ Exported |
| `createBorderedPanel` | Bordered container | CSS `border` property | ✅ Exported |
| `createCollapsibleBlock` | Accordion / disclosure | HTML `<details>` element | ✅ Exported |
| `createSelectableList` | `<select>` or `<ul>` with selection | Tailwind list selection | ✅ Exported |
| `createInlineSearch` | Bottom-anchored search bar | Sticky input overlay | ✅ Exported |
| `createTabs` | Tab container | HTML `<tabs>` / CSS Grid + radio buttons | ✅ Exported |

### Advanced / Specialized Layouts

| WibWob Name | Purpose | CSS | Tailwind | Location | Export Status |
|---|---|---|---|---|---|
| `ContentStack` | Variable-height children, scrollable | `overflow: auto` + custom positioning | `overflow-auto` + custom layout | `ui-parts.ts` | ✅ Exported |
| `createRestyleBundle` | Declarative theme application | N/A (WibWob-specific) | N/A | `ui-parts.ts` | ✅ Exported |
| `ZineItem` | Positioned canvas item (panel/header/divider/spacer) | Grid or absolute positioning | `absolute` positioning | `canvas-types.ts` | ✅ Exported |
| `ZineLayoutResult` | Result of column layout | N/A (WibWob-specific) | N/A | `canvas-types.ts` | ✅ Exported |

### Pattern & Animation

| WibWob Name | Purpose | CSS Role | Note |
|---|---|---|---|
| `PatternGenerator` | Animated text fill patterns | CSS `background: repeating-linear-gradient` | ✅ Correct; 11 patterns included |
| `PATTERNS` array | All built-in pattern generators | N/A (WibWob-specific) | ✅ Exported |

---

## Summary of Required Changes

### 🔴 Critical (Breaking Changes)

1. **Rename `createColumns()` → `createRow()`**
   - Eliminates naming collision with `layoutColumns()`
   - Aligns with CSS `flex-direction: row` semantics
   - **Migration:** Global find-replace in all modules

2. **Rename breakpoints S/M/L/XL → xs/sm/md/lg**
   - Matches Tailwind naming convention
   - Clearer ascending scale (smaller viewport = smaller index)
   - **Migration:** Update all breakpoint checks in code and tests

### 🟡 Major (Extractions & Promotions)

3. **Extract `createGrid()` to SDK**
   - Move from `modules/hello-world/index.ts` → `src/core/grid-layout.ts`
   - Export via `microapp-sdk.ts`
   - **Types to extract:** `TrackSize`, `GridOptions`, `GridCell`, `Grid`

4. **Extract compass system to SDK**
   - Move `Compass` type, `COMPASS_ALIGN`, `COMPASS_LABELS` → `src/core/ui-parts.ts`
   - Export via `microapp-sdk.ts`
   - **Use case:** Alignment helper for all microapps

5. **Extract `pickBreakpoint()` to SDK**
   - Move from `modules/hello-world/index.ts` → `src/core/responsive.ts` (new file)
   - Export via `microapp-sdk.ts`
   - **Use case:** Responsive logic in all modules

### 🟢 Minor (Documentation & Clarity)

6. **Document `StackChild.basis` and `fr` syntax**
   - Add JSDoc explaining that `basis: "2fr"` follows CSS Grid `fr` unit
   - Add examples: `basis: 100` (fixed px), `basis: "1fr"` (grow equally)

7. **Clarify the two "column" concepts**
   - Rename `createColumns()` eliminates confusion
   - Document that `layoutColumns()` is magazine-style (CSS `columns` property), not flexbox

8. **Add responsive alignment helper**
   - Extend compass system to include Tailwind-like responsive modifiers
   - Example: `compass: { base: "nw", md: "c", lg: "ne" }`

---

## Recommended Phased Migration

### Phase 1 (Week 1) — Naming Alignment
- [ ] Rename `createColumns()` → `createRow()` globally
- [ ] Rename breakpoints S/M/L/XL → xs/sm/md/lg globally
- [ ] Update tests, comments, and documentation
- [ ] Run full typecheck and smoke tests

### Phase 2 (Week 2) — SDK Extractions
- [ ] Extract `createGrid()` to `src/core/grid-layout.ts`
- [ ] Extract compass system to `src/core/ui-parts.ts`
- [ ] Extract `pickBreakpoint()` to `src/core/responsive.ts`
- [ ] Export all three via `microapp-sdk.ts`
- [ ] Remove inlined versions from `hello-world/index.ts`

### Phase 3 (Week 3) — Documentation
- [ ] Add comprehensive JSDoc to all layout functions
- [ ] Create `docs/layout-primitives.md` guide
- [ ] Add examples showing CSS ↔ WibWob mapping
- [ ] Update `AGENTS.md` with new canon names

---

## File-by-File Audit Detail

### `src/core/ui-parts.ts` (1898 lines)

**Primitives Exported:**
- ✅ `Rect` — positioning type (CSS-native concept)
- ✅ `UiPart<Props>` — component lifecycle interface
- ✅ `StackChild` — flex child type with `basis` property
- ✅ `createStack()` — vertical flexbox
- ❌ `createColumns()` — should be `createRow()`
- ✅ `createHeaderBar()`, `createStatusBar()` — fixed-height bars
- ✅ `createTextBlock()` — scrollable text container
- ✅ `createInputLine()`, `createMessageHistory()` — form inputs
- ✅ `createRule()` — separator/divider
- ✅ `createFigletDisplay()` — ASCII art display
- ✅ `createAnimatedPanel()` — animated content host
- ✅ `createButtonBar()` — toolbar with buttons
- ✅ `createBorderedPanel()` — bordered container with active state
- ✅ `createCollapsibleBlock()` — accordion/disclosure widget
- ✅ `ContentStackChild`, `ContentStackHandle` — custom vertical stack
- ✅ `createContentStack()` — scrollable variable-height container
- ✅ `SidebarPanel` — sidebar + main layout
- ✅ `createSidebarPanel()` — sidebar factory
- ✅ `SelectableListHandle` — list selection widget
- ✅ `createSelectableList()` — list factory
- ✅ `InlineSearchHandle` — search bar overlay
- ✅ `createInlineSearch()` — search factory
- ✅ `RestyleBundle` — theme application helper
- ✅ `createRestyleBundle()` — batch restyle
- ✅ `TabDef`, `TabbedContainerHandle` — tab container
- ✅ `createTabs()` — tab factory
- ✅ `PatternGenerator` — animated pattern type
- ✅ `PATTERNS` array — 11 built-in patterns
- ✅ Helper functions: `clamp()`, `hslToRgb()`, `ansiGradientLine()`, `sinWave()`, `randHistory()`, `xLabels()`

**Candidates for Extraction:**
- ⚠️ `applyRect()` — should stay (low-level blessed helper)

### `src/core/panel-layout.ts` (232 lines)

**Exports:**
- ✅ `PanelDef` — panel definition type
- ✅ `PanelNode` — positioned panel with node refs
- ✅ `LayoutResult` — layout result with placements
- ✅ `layoutColumns()` — magazine multi-column layout ✅ Correct name
- ✅ `layoutPanels()` — row-flow layout
- ✅ `measureViewport()` — safe viewport measurement
- ✅ `pointerToContent()` — screen-to-content coordinate transform
- ✅ `hitPanel()` — hit-testing against panels
- ✅ `COL_GAP` constant

**Assessment:** ✅ All names are correct. No changes needed in this file.

### `src/core/canvas-types.ts` (53 lines)

**Exports:**
- ✅ `ZineItemType` — item type enum ("panel" | "header" | "divider" | "spacer")
- ✅ `ZineSourceType` — editor hint type
- ✅ `ZineItem` — unified layout item type
- ✅ `ZineLayoutResult` — layout result with items
- ✅ `CanvasColumnDef`, `CanvasDocument` — canvas document types

**Assessment:** ✅ All names are correct. No changes needed.

### `modules/hello-world/index.ts` (500+ lines)

**Inlined Candidates for SDK Extraction:**
- ⚠️ `Rect` type — duplicate of `ui-parts.ts`, should import
- ❌ `createGrid()` — should be extracted to `src/core/grid-layout.ts`
- ❌ `Compass` type — should be extracted to `src/core/ui-parts.ts`
- ❌ `COMPASS_ALIGN` — should be extracted to `src/core/ui-parts.ts`
- ❌ `COMPASS_LABELS` — should be extracted to `src/core/ui-parts.ts`
- ❌ `pickBreakpoint()` — should be extracted to `src/core/responsive.ts`
- ⚠️ Breakpoint names S/M/L/XL → should be xs/sm/md/lg

**Assessment:** This module is currently a "proving ground" for candidate primitives. Phase 2 of migration should extract everything.

### `src/services/microapp-sdk.ts` (150+ export lines)

**Current Exports from Layout Modules:**
- ✅ From `ui-parts`: all major functions and types
- ✅ From `panel-layout`: `layoutPanels`, `layoutColumns`, `measureViewport`, `pointerToContent`, `hitPanel`, `COL_GAP`
- ✅ From `canvas-types`: `ZineItem`, `ZineLayoutResult`, `ZineItemType`, `ZineSourceType`, `CanvasDocument`, `CanvasColumnDef`

**Missing Exports (Phase 2):**
- ❌ `Compass`, `COMPASS_ALIGN` — currently in hello-world only
- ❌ `createGrid()` — currently in hello-world only
- ❌ `pickBreakpoint()` — currently in hello-world only
- ❌ `TrackSize`, `GridOptions`, `GridCell`, `Grid` types

**Assessment:** SDK is well-maintained but missing 4 key primitives that should be shared across all modules.

---

## Design Principles for Canon Naming

1. **Match CSS concepts where possible** — Name should reflect the underlying CSS property/value
   - `createRow` matches `flex-direction: row`
   - `layoutColumns` matches CSS `columns` property
   - `Rect` matches DOMRect

2. **Match Tailwind class naming for responsive patterns**
   - Breakpoints: xs/sm/md/lg match Tailwind tiers
   - Alignment: compass system could map to `justify-*`, `items-*`

3. **Be specific about layout mode**
   - Two different "column" concepts require different names
   - `createRow()` for flex containers
   - `layoutColumns()` for magazine layout

4. **Avoid internal-only names**
   - All proven primitives should graduate to SDK
   - No canonical primitives should be inlined in demo modules

---

## Notes for Implementation

### Backwards Compatibility
- Breaking changes to `createColumns()` and breakpoint names will require:
  - Update all module imports
  - Update all command definitions
  - Update test files
  - Run full smoke tests after each phase

### Testing Strategy
- Phase 1: Rename → typecheck + existing tests should pass
- Phase 2: Extract → typecheck + verify exports resolve correctly
- Phase 3: Document → verify examples work end-to-end

### Files to Update
- `src/core/ui-parts.ts` — rename `createColumns` to `createRow`
- `src/core/ui-parts.ts` — add Compass system
- `src/core/grid-layout.ts` — NEW, extract createGrid
- `src/core/responsive.ts` — NEW, extract pickBreakpoint
- `src/services/microapp-sdk.ts` — add new exports
- `modules/hello-world/index.ts` — remove inlined versions, import from SDK
- `modules/*/index.ts` — update breakpoint names S/M/L/XL → xs/sm/md/lg
- Tests: `src/**/*.test.ts`, `modules/**/*.test.ts`
- Docs: `.agents/architecture.md`, `.agents/specs/window-system.md`

