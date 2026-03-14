# E034 Layout Primitives SDK — Handover

**Date:** 2026-03-12
**Branch:** `epic/e034-layout-primitives-sdk`
**Worktree:** `~/Repos/wibwob-e034-layout-sdk`
**Status:** Planning complete. No code changes yet. Ready for F00 (decision doc).

---

## What this epic is

Extract layout primitives from hello-world v2 into the microapp SDK with
CSS-aligned naming, then port grid-appropriate modules. Make all primitives
composable and nestable.

Read the brief first: `e034-brief.md`

---

## Key decisions already made

### Two primitives, not three

CSS has two layout primitives. So do we:

- **Flex** (1D) — createStack (column) + createRow (row)
- **Grid** (2D) — createGrid with templateRows/templateColumns

Everything else is a PATTERN built from these two:
  sidebar = flex-row with fixed + fluid children
  headerBodyFooter = flex-column with fixed header/footer
  columnFlow (Zine) = domain-specific pattern, NOT an SDK primitive

### Naming aligned to CSS/Tailwind

| Current | Canon | CSS equivalent |
|---------|-------|---------------|
| createStack | createStack (keep) | flex-direction: column |
| createColumns | createRow | flex-direction: row |
| rowSizes/colSizes | templateRows/templateColumns | grid-template-rows/columns |
| gap: [n, n] | gap: { row, column } | gap |
| XL/L/M/S (descending) | xs/sm/md/lg/xl (ascending) | Tailwind breakpoints |
| Compass (NW/SE) | { justify, align } | justify-content + align-items |

### Compass is NOT an SDK concept

"Compass" (NW/N/NE/W/C/E/SW/S/SE) is demo vocabulary from hello-world's
toolbar. The SDK exports:
```ts
{ justify: "start" | "center" | "end", align: "start" | "center" | "end" }
```
Hello-world maps its toolbar buttons to this internally. The SDK never
mentions compass.

### layoutColumns stays in zine

layoutColumns is a domain-specific placement algorithm that consumes
PanelDef[], bakes in zine semantics (col field, column headers), and
produces ZineItem placements. It is NOT a reusable composition surface.
It stays subsystem-local. It is NOT extracted to SDK.

### Composition contract: LayoutPart

Every layout primitive accepts LayoutPart children AND returns a LayoutPart:

```ts
type LayoutPart<Props = void> = {
  node: blessed.Widgets.BoxElement;
  layout(rect: Rect): void;
  update(props: Props): void;
  restyle(): void;
  destroy(): void;
};
```

Optional future hook (reserve but don't implement):
```ts
getMinSize?(): { width?: number; height?: number }
```

The current hello-world createGrid takes raw blessed nodes — this MUST
change to accept LayoutPart children before extracting to SDK.

### Module heuristic: don't mass-convert

| Module layout shape | Use |
|----|---|
| Named regions (header, sidebar, main) | Flex (createStack/createRow) |
| Matrix of cells | Grid (createGrid) |
| Content flowing into columns | Domain-specific pattern |
| Custom canvas/rendering | Leave alone |

Only dashboard and dashboard-xxl are genuine grid candidates.
Everything else stays on flex. Do NOT port flex modules to grid.

---

## Audit docs (read these)

All in `audit/` directory:

| File | What it covers |
|------|---------------|
| 01-css-mapping.md | Every primitive mapped to CSS/Tailwind (HAS CORRECTIONS HEADER — read that first) |
| 02-textual-mapping.md | Textual Python TUI comparison |
| 03-naming-proposals.md | Four remaining conflicts with migration costs (Conflict 1 compass RESOLVED, struck through) |
| 04a-grid-candidates.md | dashboard, dashboard-xxl, tr808, tidepool audit |
| 04b-flex-modules.md | poetry-clock, patchbay, wibwobworld, chatroom, touchlab audit |
| 04c-other-modules.md | zine, sy2, hello-world, editors, animations audit (layoutColumns section HAS CORRECTION) |
| 05-module-audit-summary.md | Consolidated classification of all 20 modules + Codex findings |

**05 is the source of truth.** It was written after all decisions were made.
01 and 03 have corrections headers because they were generated before final
decisions. Read the corrections first.

---

## What to do next

### F00 — Layout vocabulary decision doc

Write `layout-vocabulary.md` in this epic dir. This is the canon reference
that microapp authors and agents read. Contents:

1. Two-primitive model (flex + grid) with when-to-use heuristic
2. Full naming table (current → canon → CSS equivalent)
3. Composition contract (LayoutPart interface)
4. Responsive strategy (xs/sm/md/lg/xl, how breakpoints work)
5. What we deliberately defer (flex-wrap, min/max constraints, overflow,
   margin/padding, content sizing)
6. Reserve "auto" in TrackSize type now, implement later

### F01 — Composition foundation

Before extracting anything, make UiPart/LayoutPart composable:
1. Audit current UiPart interface
2. Make createGrid accept LayoutPart children (not raw blessed nodes)
3. Make createGrid return a LayoutPart
4. Test: createStack inside grid cell inside sidebar

### F02 — Extract to SDK

Move createGrid, pickBreakpoint, alignment helper from hello-world to SDK
using canon names. Add createRow as alias for createColumns with deprecation
wrapper.

### F03-F04 — Grid features and module ports

Responsive column collapse, auto-sized tracks. Port dashboard only.

---

## Files that matter

| File | Role |
|------|------|
| src/core/ui-parts.ts | Current SDK layout primitives (createStack, createColumns, UiPart) |
| src/services/microapp-sdk.ts | SDK re-exports |
| src/core/panel-layout.ts | layoutColumns (zine pattern, stays here) |
| microapps/hello-world/index.ts | Proving ground with inlined createGrid, pickBreakpoint, compass |
| microapps/dashboard/index.ts | Main grid port candidate |

---

## What NOT to do

- Do NOT extract compass types to SDK
- Do NOT promote layoutColumns to SDK primitive
- Do NOT rename existing primitives that work (createStack stays createStack)
- Do NOT mass-port flex modules to grid
- Do NOT implement flex-wrap, min/max constraints, or overflow yet
- Do NOT break createColumns — add createRow alongside it with deprecation wrapper
