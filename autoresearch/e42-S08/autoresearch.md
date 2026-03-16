> **E042 Solid Foundations** — Slice 8 of 10
> ← Previous: [`e42-S07` SDK Naming](../e42-S07/autoresearch.md)
> → Next: [`e42-S09` Stability Annotations](../e42-S09/autoresearch.md)
> Planning: `.planning/epics/e042-solid-foundations/e042-slices-7-10.md`

# Autoresearch: E042-S08 — Handle API for Key LayoutPart Components

## Objective

Build Handle versions of the 5 most-needed LayoutPart components so microapp authors
never need raw blessed for common UI patterns. After S07, the SDK has 5 Handle
components. This adds 5 more for a total of 10.

## Metrics

- **Primary**: `handle_component_count` (count, higher is better) — Handle components
  exported from microapp-sdk.ts. Target: 10.
- **Secondary**:
  - `doc_examples` — number of Handle components documented in sdk-primitives.md
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

| File | Change |
|------|--------|
| `src/sdk/composition-helpers.ts` | Add 5 new Handle components |
| `src/services/microapp-sdk.ts` | Export new components + types |
| `docs/sdk-primitives.md` | Add examples for each new component |
| `docs/design-system.md` | Update Handle API inventory |

## Target Components

| Component | What | ~Lines |
|-----------|------|--------|
| `createHeaderBar(parent, opts)` | Themed top bar with left/right text | ~40 |
| `createScrollView(parent, opts)` | Scrollable content with scrollbar | ~50 |
| `createTabs(parent, opts)` | Tabbed container with keyboard switching | ~60 |
| `createRule(parent, opts)` | Horizontal divider line | ~20 |
| `createInputLine(parent, opts)` | Text input with submit/cancel | ~50 |

Each: typed options, Handle return `{ element, update(partial), destroy() }`,
theme-aware, follows nomenclature from `docs/design-system.md`.

## Off Limits

- Changing existing Handle components from S07
- Modifying LayoutPart internals
- Touching microapps (except for optional verification)

## Constraints

- `bun run health` must pass
- Each component must be theme-aware (use `theme()` tokens)
- Consistent API shape with existing Handle components
- One component per experiment iteration

## What's Been Tried

_Nothing yet — depends on S07._
