# E034 — Layout Primitives Naming Proposals

**Date:** 2026-03-12  
**Status:** Analysis / Proposal stage  
**Blocking:** E034 F00 (Layout vocabulary alignment)

---

## Overview

This document proposes canonical naming for layout primitive conflicts in
WibWob-DOS. The goal is CSS/Tailwind alignment so any developer with web
experience can read our API without a translation layer.

> **DECISION: Compass section removed.** "Compass" (NW/SE) is demo vocabulary
> from hello-world's toolbar, not an SDK concept. The SDK uses standard CSS
> alignment: `{ justify: "start" | "center" | "end", align: "start" | "center" | "end" }`.
> Hello-world maps its toolbar buttons to this internally. No compass type
> is exported from the SDK. See Codex review in 05-module-audit-summary.md.

---

## ~~Conflict 1: COMPASS vs JUSTIFY+ALIGN~~ — RESOLVED, removed

### Current API

```typescript
// hello-world/index.ts
type Compass = "nw" | "n" | "ne" | "w" | "c" | "e" | "sw" | "s" | "se";

const COMPASS_ALIGN: Record<Compass, { align: string; valign: string }> = {
  nw: { align: "left",   valign: "top"    },
  n:  { align: "center", valign: "top"    },
  ne: { align: "right",  valign: "top"    },
  w:  { align: "left",   valign: "middle" },
  c:  { align: "center", valign: "middle" },
  e:  { align: "right",  valign: "middle" },
  sw: { align: "left",   valign: "bottom" },
  s:  { align: "center", valign: "bottom" },
  se: { align: "right",  valign: "bottom" },
};

// Usage: position banner text in hello-world toolbar buttons
bannerText.left = cp.align === "right" ? hPad : ...;
bannerText.top = cp.valign === "bottom" ? vPad : ...;
```

### CSS Equivalent

```css
/* CSS flex positioning on two axes */
justify-content: flex-start | center | flex-end;   /* horizontal */
align-items: flex-start | center | flex-end;       /* vertical */

/* Or CSS Grid alignment */
justify-self: start | center | end;
align-self: start | center | end;

/* Shorthand: CSS place-items (align-items + justify-items) */
place-items: center center;
```

### Problem

- Compass names (NW/SE) are intuitive geographically but **not CSS-idiomatic**.
- An agent that knows CSS would expect `justify-content` / `align-items`, not compass directions.
- No clear indicator of which axis is which (horizontal vs vertical).
- Doesn't scale well — CSS also supports `space-between`, `space-around` which we ignore.

### Proposed Canon Names

**Option A: Direct CSS naming (RECOMMENDED)**

```typescript
type HorizontalAlignment = "start" | "center" | "end";
type VerticalAlignment = "start" | "center" | "end";

interface ContentAlignment {
  horizontal: HorizontalAlignment;
  vertical: VerticalAlignment;
}

// Or flat enum style for button labels:
type AlignmentShorthand = "start-start" | "start-center" | "start-end" |
                          "center-start" | "center-center" | "center-end" |
                          "end-start" | "end-center" | "end-end";

// Helper for hello-world toolbar buttons
const ALIGNMENT_LABELS: Record<AlignmentShorthand, string> = {
  "start-start": "↖",    // NW
  "start-center": "↑",   // N
  "start-end": "↗",      // NE
  "center-start": "←",   // W
  "center-center": "●",  // C
  "center-end": "→",     // E
  "end-start": "↙",      // SW
  "end-center": "↓",     // S
  "end-end": "↘",        // SE
};
```

**Option B: Compact enum (ALTERNATIVE)**

```typescript
enum Alignment {
  StartStart = "start-start",   // NW
  StartCenter = "start-center", // N
  StartEnd = "start-end",       // NE
  CenterStart = "center-start", // W
  CenterCenter = "center-center", // C
  CenterEnd = "center-end",     // E
  EndStart = "end-start",       // SW
  EndCenter = "end-center",     // S
  EndEnd = "end-end",           // SE
}
```

### Migration Cost

**Files affected:**
- `modules/hello-world/index.ts` — 50 lines (compass buttons, alignment logic)
- `src/core/ui-parts.ts` — ~5 lines if compass positioning becomes a reusable primitive

**Scope:** ~60 lines  
**Risk:** Low — only hello-world uses compass positioning currently  
**Breakage:** None — this is SDK extraction, not changes to existing code

### Hello-World Toolbar Buttons (New Appearance)

```typescript
// Old: Compass buttons
const COMPASS_ORDER = ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se", "auto"];
const COMPASS_BTN_LABELS = {
  nw: "NW", n: "N", ne: "NE", w: "W", c: "●", e: "E", sw: "SW", s: "S", se: "SE", auto: "◯"
};

// New: Arrow-based buttons with CSS-style naming
const ALIGNMENT_ORDER = [
  "start-start", "start-center", "start-end",
  "center-start", "center-center", "center-end",
  "end-start", "end-center", "end-end",
  "auto"
];
const ALIGNMENT_BTN_LABELS = {
  "start-start": "↖", "start-center": "↑", "start-end": "↗",
  "center-start": "←", "center-center": "●", "center-end": "→",
  "end-start": "↙", "end-center": "↓", "end-end": "↘",
  auto: "◯"
};

// Or even clearer with tooltip help:
const ALIGNMENT_BTN_LABELS = {
  "start-start": "↖ (TL)", "start-center": "↑ (T)", "start-end": "↗ (TR)",
  // ...
};
```

### Rationale

1. **CSS Alignment:** Direct mapping to `justify-content` (horizontal) and `align-items` (vertical) makes the API self-documenting for anyone who knows CSS.
2. **Semantic clarity:** "start/center/end" is clearer than compass directions for the purpose (positioning content).
3. **Future extensibility:** If we later add `space-between`, `space-around`, etc., the naming scheme accommodates them.
4. **Agent discoverability:** An LLM that understands CSS Grid/flexbox can immediately reason about what this API does.
5. **Visual distinctness:** Arrow symbols (↖↑↗) are more mnemonic than compass letters and still fit the toolbar aesthetic.

---

## Conflict 2: TWO COLUMN SYSTEMS

### Current API

```typescript
// ─── System 1: createColumns (ui-parts.ts) ───
export function createColumns(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void> {
  return createLinearLayout(parent, children, "horizontal");
}
// Maps to: flex-direction: row

// ─── System 2: layoutColumns (panel-layout.ts) ───
export function layoutColumns(panels: PanelDef[], maxWidth: number, opts?: ColumnLayoutOptions): ZineLayoutResult {
  // Group panels by column index, stack vertically, place columns horizontally
  // Magazine-style flow: wrap columns when maxWidth exceeded
}
// Maps to: CSS Column or CSS Grid multi-column layout
```

### CSS Equivalents

| System | WibWob | CSS | Semantics |
|--------|--------|-----|-----------|
| createColumns | Linear horizontal children | `display: flex; flex-direction: row` | Simple flex row |
| layoutColumns | Magazine-style grouped columns | `display: grid; grid-template-columns: repeat(N, 1fr)` OR `column-count: N` | Responsive multi-column with wrapping |

### Problem

- Both are named **`columns`** but do completely different things.
- An agent reading `layoutColumns()` expects a horizontal flex layout but gets column-first grouping.
- No clear distinction in the API names for their different purposes.
- `createColumns` is used for responsive bars and headers; `layoutColumns` is used for panels and dashboards.

### Proposed Canon Names

#### Option A: Functional naming (RECOMMENDED)

```typescript
// Horizontal flex layout (existing createColumns)
export function createRow(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>
// OR
export function createFlexRow(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>

// Magazine/grid column flow (existing layoutColumns)
export function layoutColumnFlow(panels: PanelDef[], maxWidth: number, opts?: ColumnLayoutOptions): ZineLayoutResult
// OR
export function layoutGrid(panels: PanelDef[], maxWidth: number, opts?: ColumnLayoutOptions): ZineLayoutResult
```

#### Option B: CSS-aligned naming (ALTERNATIVE)

```typescript
// Horizontal flex
export function createHorizontalStack(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>

// Column grid
export function layoutColumnGrid(panels: PanelDef[], maxWidth: number, opts?: ColumnLayoutOptions): ZineLayoutResult
```

#### Option C: Semantic naming (ALTERNATIVE)

```typescript
// Horizontal layout (buttons, bars, headers)
export function createButtonBar(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>

// Panel grid (dashboards, content areas)
export function layoutPanelGrid(panels: PanelDef[], maxWidth: number, opts?: ColumnLayoutOptions): ZineLayoutResult
```

### Migration Cost

**Files affected:**
- `src/core/ui-parts.ts` — 2 lines (function rename)
- `src/core/panel-layout.ts` — 2 lines (function rename)
- **All imports:** ~15 files use `createColumns` or `layoutColumns`
  - `modules/glitchbox/index.ts`
  - `modules/dashboard/index.ts`
  - `modules/sy2-chronicles/index.ts`
  - `modules/tr808/index.ts`
  - `modules/tidepool/index.ts`
  - etc.

**Scope:** ~40 lines of imports + 2 lines of definition  
**Risk:** Medium — high churn in module code, but mechanical  
**Breakage:** None if done as wrapper exports (old names deprecated but functional)

### Deprecation Path

```typescript
// ui-parts.ts — keep old exports as deprecated wrappers
/**
 * @deprecated Use createRow() instead. Maps to flex-direction:row.
 * Note: if you want magazine-style column layout, use layoutColumns() from panel-layout.ts
 */
export function createColumns(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void> {
  console.warn("⚠ createColumns is deprecated; use createRow() instead");
  return createRow(parent, children);
}

// panel-layout.ts — keep old export
/**
 * @deprecated Use layoutColumnFlow() instead. Provides magazine-style column grouping.
 */
export function layoutColumns(...): ZineLayoutResult {
  console.warn("⚠ layoutColumns is deprecated; use layoutColumnFlow() instead");
  return layoutColumnFlow(...);
}
```

### Rationale

**Option A (createRow + layoutColumnFlow):**
- **Clarity:** `createRow` immediately signals horizontal flex; `layoutColumnFlow` signals magazine-style wrapping.
- **Consistency:** Follows naming pattern of `createStack` (vertical) and `createRow` (horizontal).
- **CSS mapping:** `Row` ≈ `flex-direction: row`; `ColumnFlow` ≈ `column-count` or `grid-auto-flow: dense`.

**Option B (createHorizontalStack + layoutColumnGrid):**
- **Verbosity:** More explicit but wordy.
- **Consistency:** Mirrors the `createVerticalStack` naming pattern (even if not yet implemented).

**Option C (createButtonBar + layoutPanelGrid):**
- **Semantic:** Names match use cases, not mechanisms.
- **Risk:** Less flexible — what if someone uses createButtonBar for non-button layouts?

**Recommendation:** **Option A** (createRow + layoutColumnFlow) — provides clarity without being overly verbose.

---

## Conflict 3: BREAKPOINT NAMING

### Current API

```typescript
// hello-world/index.ts
type LayoutMode = "xl" | "l" | "m" | "s";

const LAYOUT_BREAKPOINTS: Breakpoint<LayoutMode>[] = [
  { minWidth: 95,  minHeight: 26, value: "xl" },
  { minWidth: 65,  minHeight: 18, value: "l"  },
  { minWidth: 40,  minHeight: 12, value: "m"  },
  { value: "s" },
];

// Usage
const mode = pickBreakpoint(LAYOUT_BREAKPOINTS, w, h) ?? "s";
```

### CSS Equivalent

```css
/* Tailwind: ascending size order */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }

/* Bootstrap: similar ascending order */
/* xs, sm, md, lg, xl, xxl */
```

### Problem

- WibWob uses **descending sizes**: XL → L → M → S
- Tailwind/Bootstrap use **ascending sizes**: sm → md → lg → xl → 2xl
- This is **counterintuitive** for anyone familiar with modern CSS frameworks
- An agent trained on Tailwind/Bootstrap will expect `sm/md/lg/xl`, not `xl/l/m/s`
- Terminal constraints (40×12 is "M" not "S") don't map to web vocabulary

### Proposed Canon Names

#### Option A: Adopt Tailwind order (RECOMMENDED for web-literate agents)

```typescript
type ResponsiveSize = "xs" | "sm" | "md" | "lg" | "xl";

const LAYOUT_BREAKPOINTS: Breakpoint<ResponsiveSize>[] = [
  { value: "xs" },                          // < 40 wide, < 12 tall
  { minWidth: 40,  minHeight: 12, value: "sm" },
  { minWidth: 65,  minHeight: 18, value: "md" },
  { minWidth: 95,  minHeight: 26, value: "lg" },
  { minWidth: 120, minHeight: 40, value: "xl" },  // hypothetical "huge terminal"
];
```

#### Option B: Terminal-specific naming (ALTERNATIVE)

```typescript
type TerminalSize = "pocket" | "compact" | "standard" | "wide" | "cinematic";
// Or: "phone" | "tablet" | "laptop" | "desktop" | "theater"

const LAYOUT_BREAKPOINTS: Breakpoint<TerminalSize>[] = [
  { value: "pocket" },                      // < 40×12
  { minWidth: 40,  minHeight: 12, value: "compact" },
  { minWidth: 65,  minHeight: 18, value: "standard" },
  { minWidth: 95,  minHeight: 26, value: "wide" },
  { minWidth: 120, minHeight: 40, value: "cinematic" },
];
```

#### Option C: Keep ascending order with WibWob names

```typescript
type ResponsiveSize = "s" | "m" | "l" | "xl" | "xxl";
// Keep internal names ascending to match CSS frameworks

const LAYOUT_BREAKPOINTS: Breakpoint<ResponsiveSize>[] = [
  { value: "s" },
  { minWidth: 40,  minHeight: 12, value: "m" },
  { minWidth: 65,  minHeight: 18, value: "l" },
  { minWidth: 95,  minHeight: 26, value: "xl" },
  { minWidth: 120, minHeight: 40, value: "xxl" },
];
```

### Migration Cost

**Files affected:**
- `modules/hello-world/index.ts` — ~20 lines (breakpoint defs, mode-based rendering)
- Any future modules using responsive breaks

**Scope:** ~50 lines globally if we adopt new naming  
**Risk:** Low — only hello-world uses this currently; pattern not yet embedded  
**Breakage:** None — this is new extraction naming

### Rationale

**Option A (Tailwind order):**
- **Agent alignment:** LLMs and web developers expect `sm/md/lg/xl`; no mental translation needed.
- **CSS co-location:** If a module later needs web media queries *and* terminal breakpoints, same names work both places.
- **Market expectation:** Everyone learning web design learns Tailwind breakpoints first.
- **Downside:** Ascending order feels backward for a TUI (bigger screens are harder to reason about when you start at "small").

**Option B (Terminal-specific):**
- **Semantic clarity:** "pocket" and "cinematic" map intuitively to terminal size, not screen resolution.
- **TUI-first:** Puts terminal thinking first, not web thinking.
- **Agent challenge:** LLMs don't have a pre-trained pattern for "pocket/compact/standard"; requires learning.
- **Advantage:** More memorable and fun.

**Option C (Ascending with WibWob names):**
- **Compromise:** Keeps our short names (s/m/l) but in ascending order.
- **Partial alignment:** Better than descending, but still not "sm/md/lg/xl".
- **Weakness:** Agents still don't get the Tailwind mapping without docs.

### Recommendation

**Option A (Adopt Tailwind)** — The cost of training agents on custom terminology outweighs the semantic advantage of "pocket/compact". An agent that knows Tailwind can immediately apply that knowledge to WibWob terminal breakpoints. Terminal sizes are hard enough without a custom vocabulary.

---

## Conflict 4: STACK/COLUMNS RENAMING

### Current API

```typescript
// ui-parts.ts
export function createStack(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void> {
  return createLinearLayout(parent, children, "vertical");
}

export function createColumns(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void> {
  return createLinearLayout(parent, children, "horizontal");
}
```

### CSS Equivalent

```css
/* Flexbox */
display: flex;
flex-direction: column;  /* stack */
flex-direction: row;     /* createColumns should be "createRow" */

/* Grid */
grid-template-columns: 1fr 1fr 1fr;  /* multiple columns */
grid-template-rows: 1fr;             /* single row (stack has many rows) */
```

### Problem

- **`createStack`** is intuitive (items stacked vertically).
- **`createColumns`** is confusing — it doesn't create multiple columns; it creates items laid out *horizontally* in a single row.
  - Agent reads "createColumns" → expects multi-column layout → gets single-row flex layout.
  - The "columns" naming is a semantic mistake from the CSS Grid perspective.

### Proposed Canon Names

#### Option A: Flex-aligned naming (RECOMMENDED)

```typescript
// Keep createStack (already intuitive)
export function createStack(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>

// Rename createColumns to createRow
export function createRow(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>
```

#### Option B: Directional naming (ALTERNATIVE)

```typescript
export function createVerticalStack(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>
export function createHorizontalStack(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>
```

#### Option C: Flex-direction naming (ALTERNATIVE)

```typescript
export function createFlex(parent: blessed.Widgets.Node, direction: "row" | "column", children: StackChild[]): UiPart<void>
// Or separate:
export function createFlexColumn(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>
export function createFlexRow(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void>
```

### Migration Cost

**Files affected:**
- `src/core/ui-parts.ts` — 2 lines (function rename)
- **All imports:** ~25 files use `createColumns`
  - Every module that has a horizontal bar/header/footer
  - `src/core/app-controller.ts` (window setup)
  - `src/services/state-service.ts` (if layout code there)
  - Multiple microapps

**Scope:** ~60 lines total (imports + definition)  
**Risk:** Medium — widespread use, but mechanical rename  
**Breakage:** None if old name kept as deprecated export

### Deprecation Path

```typescript
// src/core/ui-parts.ts
export function createRow(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void> {
  return createLinearLayout(parent, children, "horizontal");
}

/**
 * @deprecated Use createRow() instead. createColumns misleadingly suggests
 * multi-column layout; it actually creates a horizontal flex row.
 */
export function createColumns(parent: blessed.Widgets.Node, children: StackChild[]): UiPart<void> {
  console.warn("⚠ createColumns is deprecated; use createRow() instead");
  return createRow(parent, children);
}
```

### Rationale

**Option A (createStack + createRow):**
- **Symmetry:** `createStack` (vertical) and `createRow` (horizontal) are mirror concepts.
- **CSS mapping:** Direct mapping to `flex-direction: column/row`.
- **Agent clarity:** An agent reading `createRow` knows items are laid out left-to-right.
- **Low friction:** Rename is mechanical; nearly every use of `createColumns` will continue working via deprecation wrapper.

**Option B (createVerticalStack + createHorizontalStack):**
- **Explicitness:** Fully unambiguous, but wordy.
- **Consistency:** Matches the kind of verbose naming some devs prefer.
- **Downside:** Takes more space on screen; less snappy.

**Option C (createFlex with mode parameter):**
- **Flexibility:** Single function parameterized by direction.
- **Risk:** Changes the API surface more radically; less similar to createStack call sites.

### Recommendation

**Option A (createStack + createRow)** — Minimal renaming, maximum clarity, symmetric pair that mirrors flex semantics.

---

## Conflict 5: GRID API SURFACE

### Current API

```typescript
// hello-world/index.ts
interface GridOptions {
  rows: number;
  cols: number;
  rowSizes?: TrackSize[];
  colSizes?: TrackSize[];
  gap?: number | [number, number];
}

type TrackSize = number | `${number}fr`;

// Usage
const grid = createGrid(root, {
  rows: 2,
  cols: 2,
  colSizes: ["2fr", "1fr"],
  rowSizes: ["1fr", "1fr"],
  gap: [1, 1],
});

grid.set(0, 0, 2, 1, contourBox);  // row, col, rowSpan, colSpan, node
```

### CSS Grid Equivalent

```css
/* CSS Grid: grid-template-rows/columns + gap */
grid-template-columns: 2fr 1fr;
grid-template-rows: 1fr 1fr;
gap: 1ch 1ch;  /* row-gap, col-gap */

/* Shorthand: grid */
grid: [1fr 1fr] / [2fr 1fr];

/* Placement */
grid-column: 1 / 3;   /* column start / end */
grid-row: 1 / 2;
```

### Problem

- **Naming is close to CSS but not identical:**
  - CSS uses `grid-template-rows`, WibWob uses `rowSizes`
  - CSS uses `grid-template-columns`, WibWob uses `colSizes`
  - CSS uses `gap` (singular, with two optional values), WibWob uses `gap: number | [number, number]`
- **API is mostly CSS-aligned**, but inconsistent naming prevents copy-paste reasoning.
- **TrackSize syntax (`"2fr"`)** matches CSS exactly, which is good.
- **Cell placement (`row, col, rowSpan, colSpan`)** is intuitive but not CSS naming (`grid-column: 1 / 3`).

### Proposed Canon Names

#### Option A: Direct CSS property naming (RECOMMENDED)

```typescript
interface GridOptions {
  rows: number;
  cols: number;
  templateRows?: TrackSize[];      // matches CSS grid-template-rows
  templateColumns?: TrackSize[];   // matches CSS grid-template-columns
  gap?: number | { row?: number; column?: number };  // explicit row/column gaps
}

type TrackSize = number | `${number}fr`;

// Usage (clearer alignment with CSS)
const grid = createGrid(root, {
  rows: 2,
  cols: 2,
  templateColumns: ["2fr", "1fr"],
  templateRows: ["1fr", "1fr"],
  gap: { row: 1, column: 1 },
});
```

#### Option B: Shorthand CSS naming (ALTERNATIVE)

```typescript
interface GridOptions {
  rows: number;
  cols: number;
  gridRows?: TrackSize[];      // `grid-` prefix to match CSS property names
  gridCols?: TrackSize[];
  gap?: number | [rowGap: number, colGap: number];
}

// Usage
const grid = createGrid(root, {
  rows: 2,
  cols: 2,
  gridCols: ["2fr", "1fr"],
  gridRows: ["1fr", "1fr"],
  gap: [1, 1],  // [rowGap, colGap] to match CSS shorthand
});
```

#### Option C: Keep current naming (CONSERVATIVE)

```typescript
// No change — rowSizes/colSizes are intuitive enough
// Just document the CSS mappings in JSDoc

/**
 * Layout a CSS Grid-like structure with sized rows and columns.
 * 
 * @param rows Number of rows
 * @param cols Number of columns
 * @param rowSizes Track sizes for rows (CSS grid-template-rows equivalent)
 * @param colSizes Track sizes for columns (CSS grid-template-columns equivalent)
 * @param gap Vertical and horizontal gap (CSS gap equivalent)
 */
```

### Migration Cost

**Files affected:**
- `modules/hello-world/index.ts` — ~10 lines (grid setup)
- `src/core/ui-parts.ts` — ~5 lines (if extracted)
- Any future modules using grid

**Scope:** ~20 lines globally  
**Risk:** Low — grid is still new; not yet in SDK or widely used  
**Breakage:** None if done before SDK release

### Rationale

**Option A (templateRows/templateColumns + gap object):**
- **CSS alignment:** Direct property naming (`grid-template-rows` → `templateRows`).
- **Clarity:** `gap: { row: 1, column: 1 }` is more explicit than `gap: [1, 1]`.
- **Copy-paste:** A developer with CSS Grid knowledge can read this and immediately understand the mapping.
- **Downside:** Slightly more verbose; CSS shorthand `gap: 1 1;` is shorter.

**Option B (gridRows/gridCols + array gap):**
- **Compromise:** `grid-` prefix hints at CSS Grid; still shorter than Option A.
- **Tuple semantics:** `gap: [rowGap, colGap]` matches CSS shorthand order.
- **Risk:** `gridRows` vs `templateRows` — which is better? This hybrid approach lacks conviction.

**Option C (Keep current naming):**
- **Stability:** No migration cost; already intuitive.
- **Documentation:** Good JSDoc with CSS mappings can bridge the gap.
- **Agent clarity:** An agent reading the code might not immediately map to CSS, but comments help.
- **Weakness:** Misses the opportunity for zero-translation CSS alignment.

### Recommendation

**Option A (templateRows/templateColumns)** — It takes only ~20 lines to update the grid setup in hello-world, and the payoff is CSS-literate agents being able to reason about the API without translation. The slight verbosity is worth the semantic precision.

---

## Summary Table

| Conflict | Current | Proposed | Rationale | Files | Risk |
|----------|---------|----------|-----------|-------|------|
| ~~1. Compass → Justify/Align~~ | RESOLVED — compass is demo-only, SDK uses `{ justify, align }` | — | — | — | — |
| 2. Two Columns | `createColumns` + `layoutColumns` | `createRow` + `layoutColumnFlow` | Distinct names for different purposes | 15+ | Medium |
| 3. Breakpoints | `xl \| l \| m \| s` (desc) | `xs \| sm \| md \| lg \| xl` (asc) | Tailwind alignment, agent training | 1 | Low |
| 4. Stack/Columns | `createStack`, `createColumns` | `createStack`, `createRow` | Flex symmetry; "createColumns" is misleading | 25+ | Medium |
| 5. Grid API | `rowSizes`, `colSizes`, `gap: [n, n]` | `templateRows`, `templateColumns`, `gap: {row, col}` | CSS property name alignment | ~5 | Low |

---

## Sequencing Recommendation

### F00 (This document sealed)

1. **Adopt all five proposals** in this order (dependency ordering):
   - **First:** Breakpoint naming (isolated, low churn) → Tailwind ascending order
   - ~~**Second:** Compass → Justify/Align~~ — RESOLVED, not an SDK concern
   - **Third:** Stack/Columns renaming (medium churn, many imports)
   - **Fourth:** Grid API surface (captured in hello-world grid setup)
   - **Last:** Two column systems (high churn, impacts all panel-based modules)

### F01 (Extract primitives to SDK)

Once naming is locked, extract with new names:
- `createStack` (vertical)
- `createRow` (horizontal, was `createColumns`)
- `createGrid` with `templateRows/templateColumns` API
- `pickResponsiveSize` with `xs/sm/md/lg/xl` breakpoints
- `layoutColumnFlow` (magazine layout, was `layoutColumns`)
- `createAlignment` helper (was compass positioning)

### F02 (Port modules)

After SDK stabilizes, gradually port modules to new names. Use deprecation wrappers to allow gradual migration.

---

## Notes for Agent Implementation

When implementing these changes:

1. **Avoid big-bang rewrites.** Each conflict should be a separate, small commit:
   ```bash
   git commit -m "refactor(layout): rename createColumns → createRow for clarity"
   git commit -m "refactor(layout): adopt Tailwind breakpoint naming (xs/sm/md/lg/xl)"
   git commit -m "refactor(grid): align API with CSS Grid naming (templateRows/templateColumns)"
   ```

2. **Use deprecation wrappers.** Old names remain functional with console warnings.

3. **Update JSDoc** with CSS equivalence mappings so agents can trace the reasoning.

4. **Smoke test after each change:**
   ```bash
   bun run typecheck
   ./scripts/screenshot-window.sh "Hello World"
   ```

5. **Update E034 brief.md** as decisions are made and sealed.

---

## References

- **CSS Grid Spec:** MDN [CSS Grid Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout)
- **Tailwind Breakpoints:** [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- **Textual Layout:** [Textual Layout](https://textual.textualize.io/guide/layout/) (Python TUI framework, CSS-inspired)
- **Blessed Documentation:** [Blessed GitHub](https://github.com/chjj/blessed) (blessed is our underlying rendering layer)
