# Module Layout Guide

Two layout primitives: flex and grid. Everything else is a pattern or
support helper built from them.

For API signatures and import paths: see `sdk-reference.md`.
For common mistakes: see `pitfalls.md`.

---

## Mental model

Use flex when layout reads as a sequence along one axis:
- header / body / footer (vertical — `createStack`)
- sidebar / main / inspector (horizontal — `createRow`)

Use grid when layout is about placement in a matrix:
- dashboards with spanning panels
- row/column coordinate layouts
- "top-left card spans two rows" patterns

Rule: if you are thinking along one axis, use flex.
If you are thinking in coordinates, use grid.

---

## Flex

### createStack (vertical)

```ts
import { createStack, createNodePart } from "../../src/services/microapp-sdk.js";

const root = createStack(win.body, [
  { key: "header", basis: 1,     part: headerPart },
  { key: "body",   basis: "1fr", part: bodyPart },
  { key: "footer", basis: 1,     part: footerPart },
]);
```

### createRow (horizontal)

```ts
import { createRow } from "../../src/services/microapp-sdk.js";

const body = createRow(win.body, [
  { key: "sidebar", basis: 20,    part: sidebarPart },
  { key: "main",    basis: "1fr", part: mainPart },
  { key: "aside",   basis: 24,    part: asidePart, visible: () => mode === "lg" },
]);
```

### FlexChild shape

```ts
type FlexChild = {
  key: string;
  basis: number | `${number}fr`;  // fixed rows/cols or fractional
  part: LayoutPart<any>;
  visible?: () => boolean;        // hide/show for responsive breakpoints
  align?: Alignment;              // RESERVED — not yet applied by layout
};
```

- Fixed `basis` (number) = exact rows or columns
- Fractional `basis` ("1fr", "2fr") = share of remaining space
- `visible: () => false` hides the child and removes it from layout

### Best practices

- Use fixed sizes for chrome (headers, toolbars, status bars)
- Use `fr` for elastic content areas
- Use `visible()` for responsive hide/show
- Nest freely — any flex child can itself be a flex or grid layout

---

## Grid

```ts
import { createGrid, createNodePart } from "../../src/services/microapp-sdk.js";

const grid = createGrid(win.body, {
  rows: 2,
  columns: 2,
  templateRows: ["1fr", "1fr"],
  templateColumns: ["2fr", "1fr"],
  gap: { row: 1, column: 1 },
});

grid.set({ key: "main",  row: 0, column: 0, rowSpan: 2, part: createNodePart(mainBox) });
grid.set({ key: "stats", row: 0, column: 1,             part: createNodePart(statsBox) });
grid.set({ key: "log",   row: 1, column: 1,             part: createNodePart(logBox) });
```

### GridChild shape (object-form only)

```ts
grid.set({
  key: string;           // unique identifier
  row: number;           // 0-indexed row
  column: number;        // 0-indexed column
  rowSpan?: number;      // default 1
  columnSpan?: number;   // default 1
  part: LayoutPart<any>;
  visible?: () => boolean;
  align?: Alignment;     // RESERVED — not yet applied by layout
});
```

### Track sizes

`templateRows` and `templateColumns` accept `TrackSize[]`:
- `number` = fixed rows/columns
- `` `${number}fr` `` = fractional share of remaining space
- Unspecified tracks default to `"1fr"`

### Gap

```ts
gap: 1                        // uniform 1-cell gap
gap: { row: 1, column: 2 }   // different row and column gaps
```

---

## Composition

Everything that participates in layout is a `LayoutPart`. Both flex and
grid accept LayoutPart children and return LayoutPart, so nesting is the
normal way to build complex screens.

### createNodePart — the bridge

Wrap any raw blessed box or contrib widget as a LayoutPart:

```ts
import { createNodePart } from "../../src/services/microapp-sdk.js";

const panel = createNodePart(blessed.box({ parent: win.body, style: host.theme().body }));
```

This is essential for placing plain blessed nodes inside flex or grid layouts.

### Nesting patterns

Grid inside flex (app chrome with a dashboard region):

```ts
const root = createStack(win.body, [
  { key: "header", basis: 1,     part: headerPart },
  { key: "body",   basis: "1fr", part: createRow(win.body, [
    { key: "nav",    basis: 20,    part: navPart },
    { key: "dash",   basis: "1fr", part: dashboardGrid },
  ]) },
  { key: "footer", basis: 1,     part: footerPart },
]);
```

Flex inside grid (a document cell within a dashboard):

```ts
grid.set({ key: "doc", row: 0, column: 0, rowSpan: 2,
  part: createStack(win.body, [
    { key: "docHeader", basis: 1,     part: docHeaderPart },
    { key: "docBody",   basis: "1fr", part: docBodyPart },
    { key: "docFooter", basis: 1,     part: docFooterPart },
  ]),
});
```

Four levels of nesting is normal for real modules. Keep each part
responsible for one local layout problem. Do not flatten everything
into one oversized grid.

---

## Responsive

Use width-based breakpoints. The SDK provides `pickBreakpoint`:

```ts
import { pickBreakpoint } from "../../src/services/microapp-sdk.js";

function render() {
  const w = Math.max(1, Number(win.body.width) || 0);
  const mode = pickBreakpoint(w);  // "xs" | "sm" | "md" | "lg" | "xl"

  // Default breakpoints: xs=0, sm=40, md=60, lg=80, xl=120
}
```

Custom breakpoints:

```ts
const mode = pickBreakpoint(w, [
  { name: "compact", minWidth: 0 },
  { name: "normal",  minWidth: 50 },
  { name: "wide",    minWidth: 80 },
]);
```

### The responsive rule: stack and scroll before you crush

When a narrow layout would produce illegible panels or useless slivers:

1. Hide less important chrome (use `visible: () => mode !== "sm"`)
2. Switch from row to stack (change composition, not just sizes)
3. Keep meaningful minimum widths
4. Let the surface become taller than the viewport
5. Provide a visible, functional scrollbar

Do not treat "everything fits on one screen" as a goal if legibility
is lost. Narrow responsive layouts should reflow first, scroll second,
squeeze only while still legible.

---

## Scroll viewport

For surfaces where content may exceed the visible height:

```ts
import { createScrollViewport } from "../../src/services/microapp-sdk.js";

const sv = createScrollViewport(win.body, {
  headerHeight: 1,  // fixed header (0 = none)
  footerHeight: 1,  // fixed footer (0 = none)
});

// sv.header  — fixed header box (null if headerHeight is 0)
// sv.viewport — scrollable middle region
// sv.footer  — fixed footer box (null if footerHeight is 0)
// sv.scrollToBottom(), sv.scrollToTop(), sv.scrollPercent()
```

This is a support helper, not a third layout primitive.

For simpler cases, use `createScrollbar()` and `scrollableStyle()` directly
on any blessed box with `scrollable: true`.

---

## Lifecycle

Standard module pattern:

```ts
function render() {
  const w = Math.max(1, Number(win.body.width) || 0);
  const h = Math.max(1, Number(win.body.height) || 0);

  root.layout({ top: 0, left: 0, width: w, height: h });

  // Repaint leaf content that depends on size
  updateContent();

  host.screen.render();
}

render();
win.onResize(render);
win.onRestyle(() => { root.restyle(); host.screen.render(); });
win.onCleanup(() => root.destroy());
```

Key points:
- `win.onResize(() => root.layout(...))` is the canonical resize pattern
- Call `root.restyle()` in onRestyle so theme changes propagate
- Call `root.destroy()` in onCleanup to tear down all blessed nodes

---

## Types reference

All importable from `../../src/services/microapp-sdk.js`:

| Type | Purpose |
|------|---------|
| `LayoutPart<Props>` | The composition contract — node + layout + update + restyle + destroy |
| `FlexChild` | Child in createStack/createRow |
| `GridChild` | Child in createGrid (object-form set) |
| `FlexBasis` | `number \| \`${number}fr\`` |
| `TrackSize` | `number \| \`${number}fr\`` |
| `AxisAlign` | `"start" \| "center" \| "end"` |
| `Alignment` | `{ justify?: AxisAlign; align?: AxisAlign }` |
| `Gap` | `number \| { row?: number; column?: number }` |
| `GridOptions` | Options for createGrid |
| `GridHandle` | LayoutPart + set() + remove() |
| `BreakpointName` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` |
| `BreakpointEntry<T>` | `{ name: T; minWidth: number }` |
| `ScrollViewportOptions` | Options for createScrollViewport |
| `ScrollViewportHandle` | LayoutPart + header/viewport/footer + scroll methods |
| `Rect` | `{ top, left, width, height }` |

---

## Not in the layout SDK

These are explicitly not part of the layout system:

- CSS multi-column layout primitive
- min/max sizing system
- auto tracks
- margin/padding DSL
- flex-wrap (planned as follow-on, not in this pass)

Alignment (`justify`/`align` on FlexChild and GridChild) is declared in
the types but not yet implemented. Grid cells fill their track area.
Flex children fill their cross-axis. This is a future enhancement.
