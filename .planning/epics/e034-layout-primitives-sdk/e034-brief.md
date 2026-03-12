---
id: E034
title: Layout Primitives SDK
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E034 — Layout Primitives SDK

Establish a coherent layout model for WibWob-DOS microapps, align naming
to CSS/Tailwind vocabulary, make primitives composable and nestable, then
extract to the SDK. NOT a mass rewrite of existing modules.

---

## Problem

1. No layout MODEL. We have scattered primitives (createStack, createColumns,
   layoutColumns, createGrid-inline) but no documented model that tells a
   module author WHICH to use WHEN, or how they compose together.

2. Naming diverges from CSS vocabulary. "Compass positioning", "createColumns"
   (which is actually a flex-row), breakpoints in descending order. An agent
   or developer with CSS knowledge has to learn a translation layer.

3. Primitives don't compose. createGrid takes raw blessed nodes, not UiParts.
   You can't put a createStack inside a grid cell, or a grid inside a sidebar.
   This forces modules into ad-hoc wiring whenever layouts get non-trivial.

4. No responsive strategy for grid or component layouts. pickBreakpoint exists
   in hello-world but isn't generalised. A grid can't say "collapse from 3
   columns to 1 at sm breakpoint". A sidebar can't say "hide below md".

---

## Layout model: three modes

Every microapp layout is one of three modes, or a composition of them.
The heuristic for choosing:

### Component layout (most apps)

Named structural regions: header, body, footer, sidebar, main. Fixed
relationships between regions. Content fills regions.

USE WHEN: your UI has named areas with structural roles.
PRIMITIVES: createStack (vertical), createRow (horizontal), sidebar.
EXAMPLES: poetry-clock, tr808, patchbay-lab, world-chatroom, wibwobworld.

Most modules are this. The existing createStack/createColumns pattern
is correct for component layout. It needs solidifying, not replacing.

### Grid layout (dashboards, matrices)

N cells tiled in rows and columns. Cells may span. Content is
semi-homogeneous (dashboard widgets, step buttons, monitoring panels).

USE WHEN: you have a matrix of similar-shaped cells, not named regions.
PRIMITIVES: createGrid with templateRows/templateColumns, cell spanning.
EXAMPLES: dashboard, dashboard-xxl, tr808 step grid.

Fewer modules need this. Don't force component-layout apps into grid.

### Document layout (content flow)

Content flows into columns, wraps responsively. Column count adapts to
available width. Content-driven, not structure-driven.

USE WHEN: variable-length content needs magazine-style arrangement.
PRIMITIVES: layoutColumnFlow (currently layoutColumns).
EXAMPLES: zine, sy2-chronicles.

### Composition rule

All three modes MUST nest inside each other:

- A sidebar (component) containing a grid, where one grid cell contains
  a createStack with a figlet header and primer body
- A grid cell containing a document-flow layout
- A document column containing a component layout with header/body/footer

This means every layout primitive must accept UiPart children AND be
expressible as a UiPart itself. The interface contract is:
  { layout(rect: Rect): void; destroy(): void }

If createGrid returns a UiPart AND accepts UiPart children (not raw
blessed nodes), composition works. Same for createStack, createRow,
layoutColumnFlow.

---

## What exists today and what changes

### Keep and solidify (DON'T rewrite)

| Primitive | What it is | Status |
|-----------|-----------|--------|
| createStack | Vertical flex (flex-direction: column) | Solid. Keep name. |
| createColumns | Horizontal flex (flex-direction: row) | Solid. Rename to createRow. Add deprecation wrapper. |
| StackChild with basis | Flex items with fr/fixed sizing | Solid. Keep. |
| createHeaderBar | Fixed-height top bar | Solid. Keep. |
| createStatusBar | Fixed-height bottom bar | Solid. Keep. |
| createSidebarPanel | Sidebar + main with toggle | Solid. Keep. |
| layoutColumns | Magazine column flow for zine/sy2 | Solid. Rename to layoutColumnFlow. |

These are component-layout and document-layout primitives. They work.
Modules using them should NOT be rewritten to use grid.

### Extract from hello-world to SDK (NEW)

| Primitive | What it is | Naming change |
|-----------|-----------|---------------|
| createGrid | CSS Grid with fr/fixed tracks, spans, gap | templateRows/templateColumns, gap: {row, column} |
| pickBreakpoint | Responsive size matching | Adopt xs/sm/md/lg/xl ascending order |
| Container positioning | Position inner box within outer | Replace compass (NW/SE) with justify/align two-axis |

### Build new (FUTURE — F02/F03)

| Primitive | What it does |
|-----------|-------------|
| Responsive wrapper | Any layout can declare breakpoint variants |
| Grid column collapse | Grid reflows N-col to M-col at breakpoint |
| UiPart composition | Grid cells accept UiPart children, grid is a UiPart |

---

## Build order

### F00 — Layout model and naming decisions

#### S00 — Layout vocabulary decision doc
- Document the three-mode model (component, grid, document)
- Heuristic table: when to use which
- Naming decisions for all five conflicts (see evidence/03-naming-proposals.md)
- Composition contract: UiPart interface that all primitives share
- Responsive strategy: how breakpoints work across all three modes
- Deliverable: layout-vocabulary.md in this epic dir
- AC: decision doc committed and reviewed

### F01 — Composition foundation

Before extracting anything, ensure the UiPart interface supports nesting.

#### S01 — UiPart composition audit
- Can createStack children be UiParts? (yes, via createNodePart)
- Can createGrid cells be UiParts? (no, takes raw blessed nodes)
- Can a UiPart be placed inside a grid cell? (not without wrapping)
- Propose minimal interface changes to enable composition
- AC: audit doc with specific interface changes needed

#### S02 — createGrid accepts UiPart children
- Grid cells specified as UiPart, not raw blessed.Widgets.BoxElement
- Grid itself returns a UiPart (has layout(rect) and destroy())
- createStack can be placed in a grid cell
- A grid can be placed inside a createStack child
- AC: hello-world grid works with UiPart composition
- AC: test case: createStack inside grid cell inside sidebar

### F02 — Extract primitives to SDK (using canon names)

#### S03 — Grid primitive to SDK
- Extract from hello-world with canon names (templateRows/templateColumns)
- UiPart-composable from day one
- AC: hello-world imports from SDK, no inlined grid code
- AC: bun run typecheck clean

#### S04 — Responsive breakpoints to SDK
- pickBreakpoint with xs/sm/md/lg/xl naming
- Generic: works with any layout mode, not grid-specific
- AC: hello-world responsive switching works from SDK import

#### S05 — Content alignment to SDK (replaces compass)
- Two-axis system: horizontal start/center/end, vertical start/center/end
- Positions inner container within outer (the proven pattern)
- AC: hello-world toolbar alignment works from SDK import

#### S06 — Rename createColumns to createRow
- Add createRow export to ui-parts.ts
- Deprecation wrapper on createColumns (console.warn, keeps working)
- Update hello-world to use createRow
- DO NOT mass-rename all modules — deprecation wrapper handles existing code
- AC: both names work, new code uses createRow

### F03 — Responsive grid

#### S07 — Grid breakpoint config
- Grid can declare: at breakpoint sm, collapse to 1 column
- Shape: responsive option on GridOptions or a wrapper
- AC: a 3-col grid collapses to 2-col then 1-col on resize

#### S08 — Auto-sized tracks
- Track size "auto" measures content
- AC: grid with auto-width column sizes to its content

### F04 — Port selected modules (ONLY where grid is the right fit)

Apply the heuristic. Only port modules that are genuinely grid-shaped.

#### S09 — Port dashboard to createGrid
- Dashboard IS a grid (tiled widgets). Good fit.
- AC: renders identically, code reduction documented

#### S10 — Port dashboard-xxl to createGrid
- Dashboard-xxl IS a grid (virtual canvas cells). Good fit.
- AC: renders identically

DO NOT port: poetry-clock (component layout), tr808 (component + custom
grid — evaluate), patchbay (component + sidebar), world-chatroom (component).
These work fine with createStack/createRow/sidebar.

---

## Acceptance criteria

### Model and naming
- [ ] AC-0: Layout model doc committed (three modes, heuristic, composition contract)

### Composition
- [ ] AC-1: UiPart interface supports nesting (grid accepts UiPart, grid is UiPart)
- [ ] AC-2: Demonstrated: createStack inside grid cell inside sidebar

### SDK extraction
- [ ] AC-3: createGrid in SDK with canon names, UiPart-composable
- [ ] AC-4: pickBreakpoint in SDK with xs/sm/md/lg/xl
- [ ] AC-5: Content alignment in SDK (two-axis, replaces compass)
- [ ] AC-6: createRow exported, createColumns deprecated
- [ ] AC-7: All primitives have JSDoc with CSS equivalence notes
- [ ] AC-8: bun run typecheck clean

### Responsive
- [ ] AC-9: Grid breakpoint collapse works on at least one layout

### Module ports (grid-appropriate modules only)
- [ ] AC-10: At least 1 dashboard-style module ported to SDK grid
- [ ] AC-11: No visual regressions

---

## Non-goals

- Full CSS Grid spec (subgrid, named lines, auto-placement)
- Mass rewriting component-layout modules to use grid
- Dock primitive (fixed-basis stack children work fine)
- Breaking existing createStack/createColumns API (deprecate, don't remove)
- Responsive features on component layout (sidebar already has toggle;
  createStack doesn't need breakpoints yet)

---

## Evidence

- Layout audit: `.planning/chores/menu-nav-figlet-audit/chore-audit-layout-primitives.txt`
- CSS/Tailwind naming mapping: `scratch/e034-audit/01-css-mapping.md`
- Textual comparison: `scratch/e034-audit/02-textual-mapping.md`
- Naming proposals (five conflicts): `scratch/e034-audit/03-naming-proposals.md`
- Hello-world v2 proving ground: `modules/hello-world/index.ts`
