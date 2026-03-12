# WibWob-DOS Layout Guide — Final

This is the final recommended layout approach after:
- the E034 handover
- Pi and Codex guide comparison
- cross-review feedback
- independent demo implementations
- human side-by-side review of Pi/Codex demos

The goal is a small, DRY, CSS-legible system that works well for both
humans and agents writing module code.

## Canon

### Two layout primitives only

WibWob-DOS has two layout primitives:

- flex for one-dimensional layout
- grid for two-dimensional layout

Everything else is a pattern built from them.

Do not add a third layout primitive for:
- CSS columns / column-flow
- scrollable viewports
- dashboard chrome
- sidebar patterns

Those are support helpers or composition patterns, not peer primitives.

### Public names

| SDK name | Meaning | CSS equivalent |
|---|---|---|
| `createStack` | vertical flex | `flex-direction: column` |
| `createRow` | horizontal flex | `flex-direction: row` |
| `createGrid` | explicit rows/columns | CSS Grid |
| `templateRows` | row tracks | `grid-template-rows` |
| `templateColumns` | column tracks | `grid-template-columns` |
| `gap` | spacing between tracks/items | `gap` |
| `justify` | horizontal alignment | CSS-inspired |
| `align` | vertical alignment | CSS-inspired |

## Mental Model

Use flex when layout reads as a sequence:
- header / body / footer
- sidebar / main
- toolbar buttons
- inspector stacks

Use grid when layout is about placement:
- dashboards
- mosaics
- row/column spanning panels
- “top-left card spans two rows” type layouts

Rule:
- if you are thinking in regions along one axis, use flex
- if you are thinking in coordinates, spans, or panels in a matrix, use grid

## Core Types

```ts
type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type LayoutPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};

type FlexBasis = number | `${number}fr`;
type TrackSize = number | `${number}fr`;

type AxisAlign = "start" | "center" | "end";

type Alignment = {
  justify?: AxisAlign; // horizontal
  align?: AxisAlign;   // vertical
};

type Gap = number | {
  row?: number;
  column?: number;
};

type FlexChild = {
  key: string;
  basis: FlexBasis;
  part: LayoutPart<any>;
  visible?: () => boolean;
  align?: Alignment;
};

type GridChild = {
  key: string;
  row: number;
  column: number;
  rowSpan?: number;
  columnSpan?: number;
  part: LayoutPart<any>;
  visible?: () => boolean;
  align?: Alignment;
};
```

Important:
- `justify` and `align` use fixed screen axes, not CSS logical axes
- `justify` always means horizontal
- `align` always means vertical

That is intentionally simpler than the web.

## Flex

### `createStack`

Use for vertical composition.

Typical cases:
- header / body / footer
- document header / body / footer
- inspector header / content / tags

```ts
const root = createStack(win.body, [
  { key: "header", basis: 1, part: header },
  { key: "body", basis: "1fr", part: body },
  { key: "status", basis: 1, part: status },
]);
```

### `createRow`

Use for horizontal composition.

Typical cases:
- sidebar / main
- panel row
- toolbar with spacer

```ts
const body = createRow(win.body, [
  { key: "sidebar", basis: 20, part: sidebar },
  { key: "main", basis: "1fr", part: main },
  { key: "inspector", basis: 24, part: inspector, visible: () => mode === "lg" },
]);
```

### Flex best practices

- prefer nesting over manual `top`/`left` math
- use `visible()` for breakpoint hide/show
- use fixed sizes for rails/chrome, `fr` for elastic content
- if a narrow mode would make a panel illegible, do not keep squeezing it

That last point matters. Human review made this explicit:

- narrow responsive layouts should stack
- once stacked content exceeds height, it should scroll

Responsive correctness in WibWob-DOS is:
- reflow first
- scroll second
- squeeze only while still legible

## Grid

Use grid for explicit panel placement.

```ts
type GridOptions = {
  rows: number;
  columns: number;
  templateRows?: TrackSize[];
  templateColumns?: TrackSize[];
  gap?: Gap;
  align?: Alignment;
};
```

### Object-form placement only

The guide should only document object-form placement:

```ts
grid.set({
  key: "stats",
  row: 0,
  column: 1,
  rowSpan: 1,
  columnSpan: 2,
  part: statsPanel,
});
```

Do not teach positional `grid.set(...)` in the final guide.

Reason:
- lower ambiguity
- better agent reliability
- easier migration and review

## Composition Contract

Everything that participates in layout should be a `LayoutPart`.

That means:
- flex accepts `LayoutPart` children
- grid accepts `LayoutPart` children
- both return `LayoutPart`
- nesting is normal, not exceptional

Important bridge:

```ts
createNodePart(node)
```

Use it to wrap:
- plain blessed boxes
- contrib widgets
- one-off custom nodes

This is the bridge that lets plain blessed and contrib nodes participate
in the layout model.

blessed-contrib interop is part of the intended system:
- contrib widgets can live inside flex or grid regions
- flex layouts can live inside a contrib-owned cell/container

The later stress-test demos proved both directions of interop.

## Nesting Patterns

Real modules do not stay flat. The later demos proved that the system only
becomes convincing when layout parts can be nested several levels deep
without falling back to manual coordinate math.

The important rule is simple:

- any flex child can itself be a flex layout
- any flex child can itself be a grid layout
- any grid cell can contain a flex layout
- any grid cell can contain another grid layout if the design genuinely
  needs it

Nesting is not a special escape hatch. It is the normal way to build
complex screens.

### Grid inside flex

Use this when the outer layout is app chrome, but one region needs exact
panel placement.

Typical case:
- root stack: header / body / status
- body row: sidebar / dashboard
- dashboard region: grid

```ts
const dashboard = createGrid(win.body, {
  rows: 2,
  columns: 2,
  templateRows: ["1fr", "1fr"],
  templateColumns: ["2fr", "1fr"],
  gap: { row: 1, column: 1 },
});

dashboard.set({
  key: "main",
  row: 0,
  column: 0,
  rowSpan: 2,
  part: mainChart,
});

dashboard.set({
  key: "stats",
  row: 0,
  column: 1,
  part: statsPanel,
});

dashboard.set({
  key: "alerts",
  row: 1,
  column: 1,
  part: alertsPanel,
});

const root = createStack(win.body, [
  { key: "header", basis: 1, part: header },
  { key: "body", basis: "1fr", part: createRow(win.body, [
    { key: "sidebar", basis: 20, part: sidebar },
    { key: "main", basis: "1fr", part: dashboard },
  ]) },
  { key: "status", basis: 1, part: status },
]);
```

### Flex inside grid

Use this when the outer structure is a matrix, but one cell needs ordinary
document or app-like composition.

Typical case:
- overall dashboard is grid
- one cell contains header / body / footer
- one cell contains sidebar / main

```ts
const docCell = createStack(win.body, [
  { key: "docHeader", basis: 1, part: docHeader },
  { key: "docBody", basis: "1fr", part: docBody },
  { key: "docFooter", basis: 1, part: docFooter },
]);

const grid = createGrid(win.body, {
  rows: 2,
  columns: 2,
  templateRows: ["1fr", "1fr"],
  templateColumns: ["1fr", "1fr"],
  gap: 1,
});

grid.set({
  key: "doc",
  row: 0,
  column: 0,
  rowSpan: 2,
  part: docCell,
});
```

### Deep mixed-direction nesting

The stress-test demos proved that four levels of nesting is not exotic.
It is a realistic shape for:
- toolbar + body + status
- body row with nav + document + inspector
- inspector stack with header + body + wrapped tags
- document stack with header + scrollable content + footer

When nesting gets deep:
- keep each part responsible for one local layout problem
- name regions semantically
- only switch to grid where placement actually matters
- do not flatten everything into one giant grid

Bad pattern:
- one oversized root grid trying to express toolbar, nav, document,
  inspector, footer, and internal document subregions all at once

Good pattern:
- outer flex for app chrome
- inner grid only where exact placement matters
- local scroll viewport where content can exceed height

## Responsive Strategy

Use width-based breakpoints unless height is genuinely part of the design.

Canon ordering:
- `xs`
- `sm`
- `md`
- `lg`
- `xl`

Pattern:
1. choose mode from width
2. switch composition, visibility, or spans
3. preserve legibility
4. allow vertical growth and scrolling where needed

### Responsive rule from the demo review

The biggest practical finding from the Pi/Codex demos was not naming.
It was responsive behavior:

- Pi's narrow layouts were often structurally cleaner
- Codex's narrow layouts were better when they actually stacked and scrolled
- the human consistently preferred stack-and-scroll over “thin sliver”
  side panels or crushed widths

So the final rule is:

For narrow widths, prefer:
- hide less important chrome
- switch from row to stack
- keep meaningful minimum widths
- let the page become taller
- provide a visible, functional scrollbar

Do not treat “everything still fits without scrolling” as a goal in itself.

## Scrollable Viewports

This is a repeated support pattern, not a third layout primitive.

Shape:
- optional fixed header
- optional fixed footer
- middle viewport is scrollable
- content box inside viewport owns the overflow height

This pattern showed up repeatedly in:
- responsive panels
- flex bands narrow mode
- flex workbench document pane
- layout stress test
- zine-like surfaces

### Recommendation

E034 should keep the two-primitives model, but the refactor plan should add:

- `createScrollbar()`
- `scrollableStyle()`
- `createScrollViewport(...)`

`createScrollViewport(...)` should own:
- viewport wiring
- scroll input wiring
- conditional scrollbar visibility
- theme-consistent styling
- fixed-chrome + scrolling-body composition

This should be treated as a support helper, not a competing layout system.

## Lifecycle

The layout guide must show usage, not just types.

Standard module pattern:

1. create parts
2. compose parts into root
3. call `root.layout(...)` in render
4. repaint leaf content after layout if size-dependent
5. wire `onResize(render)`
6. wire `onRestyle(root.restyle)`
7. wire `onCleanup(root.destroy)`

Skeleton:

```ts
function render() {
  const w = Math.max(1, Number(win.body.width) || 0);
  const h = Math.max(1, Number(win.body.height) || 0);

  root.layout({ top: 0, left: 0, width: w, height: h });

  header.render();
  main.render();
  status.render();

  host.screen.render();
}

render();
win.onResize(render);
win.onRestyle(() => {
  root.restyle();
  host.screen.render();
});
win.onCleanup(() => {
  root.destroy();
});
```

Implementation note:
- current layout internals may already listen to resize events
- calling `root.layout(...)` from `win.onResize(...)` is still the correct
  module pattern
- extra relayouts during resize are a known implementation issue to clean up
  in the SDK extraction, not a reason to avoid explicit layout calls

## What The Demo Review Changed

### Adopt from Codex

- object-form `grid.set`
- stronger distinction between `FlexChild` and `GridChild`
- explicit `createNodePart` bridge pattern
- responsive narrow layouts should stack and scroll

### Adopt from Pi

- lifecycle-first teaching
- responsive examples as first-class documentation
- better app-shaped demo content
- stronger stress-test composition

### Hybrid decisions

- Flex Wrap Demo:
  keep as proving-ground evidence for wrap, not as core E034 API
- Flex Bands:
  use the stack-when-narrow lesson, not the sliver-aside behavior
- Responsive Panels:
  keep Codex's stack-and-scroll result, but document it with cleaner
  composed structure rather than raw manual layout as the ideal
- Flex Workbench:
  use Pi's app structure plus a real scrollable document pane
- Layout Stress Test:
  Pi's version is the stronger reference for “does the system hold up?”

## What Is Not In E034

Not part of the core SDK in this pass:

- general CSS multi-column layout primitive
- min/max sizing system
- `auto` tracks as implemented behavior
- margin/padding DSL
- content-measured track sizing

Important nuance:
- some of these are real future needs
- they are deferred because the codebase does not yet justify them as
  stable shared primitives

That is different from saying they are never needed.

Flex-wrap is the exception. The demos proved it is a real layout need, and
your review did not reject it. So the right final stance is:

- flex-wrap belongs in the canon SDK direction
- but its implementation and exact API shape should be documented as a
  dedicated follow-on within the layout system, not muddled into the base
  flex examples

In other words:
- flex-wrap is part of the intended layout model
- it is not a discarded or merely speculative idea

## Refactor Plan

### Phase 1: Lock the core vocabulary

- `createStack`
- `createRow`
- `createGrid`
- `templateRows`
- `templateColumns`
- `gap?: number | { row?: number; column?: number }`
- object-form `grid.set`
- fixed-axis `justify` / `align`

### Phase 2: Make composition real

- ensure flex and grid both accept `LayoutPart`
- ensure both return `LayoutPart`
- document `createNodePart` as the bridge for raw blessed/contrib nodes

### Phase 3: Extract responsive helpers

- `pickBreakpoint`
- breakpoint examples in docs
- width-first responsive patterns

### Phase 4: Extract scroll support

- export scrollbar helpers from the SDK surface
- add `createScrollViewport(...)`
- migrate demo modules off bespoke viewport boilerplate

### Phase 5: Port modules selectively

Port only modules that genuinely benefit:
- dashboard-style grid modules to `createGrid`
- flex-first modules stay flex-first
- zine column flow remains domain-specific unless a second real consumer
  proves a shared primitive is warranted

## Best-Practice Rules

1. Stack and scroll before you crush.
2. One concept, one public name.
3. Prefer composition over coordinate math.
4. Prefer object-form APIs where parameter order is easy to confuse.
5. Treat narrow-mode legibility as more important than single-screen fit.
6. Use scrollable viewports as support helpers, not ad hoc per-module hacks.
7. Keep the public layout model small even if support helpers grow around it.

## Implementation Notes

These are implementation-critical findings from the demo work. They do not
change the canon API, but they do affect how modules should be written until
the SDK is cleaned up.

### Avoid `createTextBlock` for layout regions that may collapse to zero width

Current behavior:
- `createTextBlock` creates scrollable blessed boxes
- blessed can crash when a scrollable box reaches zero width during a narrow
  resize

Practical rule:
- do not use `createTextBlock` as a generic layout region shell
- use `createNodePart(blessed.box(...))` for structural regions that may be
  squeezed, hidden, or rapidly relaid out

SDK cleanup target:
- clamp minimum width safely, or make scrollability opt-in rather than a
  default structural assumption

## Final Recommendation

The final system should be:
- Pi-shaped in pedagogy
- Codex-shaped in API discipline
- corrected by the human's repeated responsive requirement

In practice that means:
- teach two primitives cleanly
- keep naming stable and CSS-legible
- document lifecycle and responsive usage explicitly
- add one DRY scroll-viewport helper as immediate follow-on work
- do not let proving-ground demos quietly become canon SDK surface

That is the smallest layout system I can defend as:
- holistically coherent
- nomenclature-smart
- DRY enough for agent authorship
- practical for real terminal modules
