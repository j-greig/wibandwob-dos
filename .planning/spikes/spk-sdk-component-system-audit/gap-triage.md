# Gap Triage (Phase 3)

Decision legend: keep / merge / deprecate / delete / defer

## Decision table

| Item | Category | Decision | Why | Migration path |
|---|---|---|---|---|
| `createStack/createRow/createGrid/createScrollViewport` | Layout | keep | Core strength and high leverage for microapps | n/a |
| `createTimer/clearTimers/safeDestroy/safeDestroyAll/toEvenCellWidth` | Lifecycle | keep | Reliability-critical for agent-built apps | n/a |
| `createLayout*` names + composition-helper names | Naming strata | merge | Two naming mental models cause SDK fuzziness | publish naming policy + keep backward aliases |
| `createHeaderBar/createStatusBar/createButtonBar` (composition layer) | Chrome | keep | Friendly API for app authors | treat as preferred authoring surface |
| host.ui subset (`createLayoutStatusBar`, etc.) | Host bridge | keep | Needed for host wiring/back-compat | keep but docs: secondary/host-centric |
| SDK advanced internals exports (monster/skeleton/contour internals) | Advanced | deprecate (for external author path) | bloats default SDK mental surface | keep runtime exports, mark as advanced and move to dedicated section |
| Duplicate demo microapps with overlapping teaching value | Demos | delete/defer case-by-case | demo sprawl hurts signal | keep one canonical showcase, archive duplicates |
| Layout Stress Test naming with `-pi` suffix | Demos | delete suffix (done) | unnecessary naming noise | complete command/path updates (done for active surfaces) |
| Overlay/modal microapp patterns | Workflow | defer | capability exists; docs pattern weak | document canonical pattern before adding new primitives |
| Alert/banner primitive | Feedback | defer | not urgent if status/toast coverage is enough | revisit after showcase audit |
| Motion preset helpers (timeline/easing recipes, loop scaffolds) | Animation/motion | keep + prioritise | explicit user priority and product value for WibWob | implement reusable helper layer + showcase demos |

---

## Sprint-priority calls

## P0 (now)
1. Naming merge policy in SDK/docs (preferred surface + aliases).
2. Motion helper uplift (reusable animation patterns, not ad-hoc per microapp).
3. Showcase reliability + crash-proofing around contrib/canvas sizing.

## P1 (next)
1. Narrow “advanced internals” discoverability in docs.
2. Overlay/modal canonical recipe for microapp authors.

## P2 (later)
1. Alert/banner primitive decision after showcase evidence.

---

## Explicit non-goals for this sprint

- ARIA/web accessibility parity work.
- Web marketing UI component expansion.
- Large new component count without deleting overlap.
