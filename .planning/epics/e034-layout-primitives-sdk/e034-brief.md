---
id: E034
title: Layout Primitives SDK
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E034 — Layout Primitives SDK

Align our layout primitive naming to CSS/Tailwind vocabulary, then extract
the primitives proven in hello-world v2 into the microapp SDK, then port
existing modules to use them.

---

## Problem

1. Every module that needs a grid, responsive breakpoints, or positioned
   elements reinvents the same patterns (dashboard, tr808, tidepool, etc).

2. Our layout primitive naming has diverged from standard CSS vocabulary.
   We invented "compass positioning" when CSS has justify/align on two axes.
   We have two different "column" systems. Our responsive breakpoints don't
   use the sm/md/lg/xl naming every web dev and LLM already knows. An agent
   that knows CSS would struggle with our API surface.

3. Textual (Python TUI framework) solved this well: three layout modes
   (vertical, horizontal, grid) plus dock, all using CSS-derived names.
   We should learn from their approach without copying it wholesale.

---

## What was proven in hello-world v2

Three primitives built inline and validated. Names below are CURRENT
(pre-alignment) — F00 will establish canon names:

1. **createGrid** — CSS Grid-like layout with fr/fixed track sizes, row/col
   spans, and gap.

2. **pickBreakpoint** — Responsive breakpoint picker. Returns matching
   layout mode from an ordered list given width/height.

3. **Container positioning** — Position a tight-fit inner box within an
   outer transparent container. Currently uses compass names (NW/SE/etc)
   but this maps to CSS justify-content + align-items on two axes.

---

## Build order

### F00 — Layout vocabulary alignment (prerequisite)

Before any code extraction, establish canon names that align with CSS/Tailwind
so that any agent or developer with web knowledge can read our layout API
without a translation layer.

#### S00 — Naming convention audit and decision doc

Deliverable: `.planning/epics/e034-layout-primitives-sdk/layout-vocabulary.md`

1. Audit every existing layout primitive name in the codebase against its
   CSS/Tailwind equivalent
2. Audit Textual's layout vocabulary for relevant patterns
3. Propose canon WibWob names — either adopt CSS names directly or document
   the deliberate divergence with a mapping
4. Key decisions:
   - Compass (NW/SE) vs justify/align two-axis system
   - Breakpoint naming: our XL/L/M/S vs Tailwind sm/md/lg/xl/2xl
   - Two column systems: createColumns (flex-row) vs layoutColumns (magazine flow)
   - Stack vs flex-col, Columns vs flex-row — keep or rename?
   - Grid API surface: how close to CSS grid-template-rows/columns?
   - Basis vs flex-basis naming
5. Decision format: table of {current name, CSS equivalent, proposed canon name, rationale}

AC: decision doc committed, reviewed, naming locked before any extraction begins

### F01 — Extract primitives to SDK (using F00 canon names)

#### S01 — Grid primitive
- Extract grid from hello-world to SDK using canon names from F00
- Export from microapp-sdk
- Hello-world imports from SDK
- AC: hello-world works identically, no inlined grid code
- AC: bun run typecheck clean

#### S02 — Responsive breakpoints
- Extract breakpoint system using canon names from F00
- AC: responsive switching works identically

#### S03 — Content alignment (formerly "compass positioning")
- Extract positioning primitive using canon names from F00
- AC: toolbar alignment works identically in hello-world

### F02 — Port modules to SDK grid

#### S04 — Port dashboard to grid
- Replace hand-positioned absolute boxes
- AC: renders identically, net line reduction documented

#### S05 — Port dashboard-xxl to grid
- Replace manual pixel math
- AC: virtual canvas grid renders identically

#### S06 — Port tr808 to grid
- Replace manual step-button grid
- AC: step sequencer renders and clicks correctly

#### S07 — Port tidepool to grid
- Replace manual sidebar + grid
- AC: tidepool layout renders identically

### F03 — Responsive grid features

#### S08 — Breakpoint-driven column collapse
- Grid gains responsive config: at breakpoint X, reflow N-col to M-col
- AC: a 3-col grid collapses to 2-col then 1-col on resize

#### S09 — Auto-sized rows/columns
- Track size "auto" measures content and allocates
- AC: grid with auto-width column sizes to content

---

## Acceptance criteria

### Naming alignment
- [ ] AC-0: Layout vocabulary decision doc committed and locked

### SDK extraction
- [ ] AC-1: Grid exported from microapp-sdk using canon names
- [ ] AC-2: Responsive breakpoints exported using canon names
- [ ] AC-3: Content alignment exported using canon names
- [ ] AC-4: All primitives have JSDoc with usage examples
- [ ] AC-5: bun run typecheck clean after extraction

### Module ports
- [ ] AC-6: At least 2 modules ported to SDK grid
- [ ] AC-7: Net code reduction measured and documented
- [ ] AC-8: No visual regressions in ported modules

### Responsive
- [ ] AC-9: Column collapse works on at least one grid
- [ ] AC-10: Auto-sized tracks work for at least one use case

---

## Non-goals

- Full CSS Grid spec compliance (subgrid, named lines, etc)
- Dock primitive (current pattern of fixed-basis stack children works)
- Breaking changes to existing createStack/createColumns API
- Renaming existing stable primitives that already work (createStack,
  createColumns) — only new extractions must use canon names

---

## Evidence

- Layout audit: `.planning/chores/menu-nav-figlet-audit/chore-audit-layout-primitives.txt`
- Hello-world v2 proving ground: `modules/hello-world/index.ts`
- Vendor comparison (blessed-contrib Grid, Textual Grid): audit sections 3-4
- Textual layout docs: `vendor/textual` (if available) or textual.textualize.io
