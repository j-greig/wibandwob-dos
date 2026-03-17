# E036 Gap Analysis → Brief Coverage Tracker

Maps every gap from `gap-analysis.md` §2 to its E036 feature or deferral status.

## Coverage matrix

| Gap (from analysis §2) | Level | E036 Feature | Status |
|-------------------------|-------|-------------|--------|
| Form controls | High | F01 (button, checkbox), F02 (radio, select), F03 (textarea) | ALL DONE (F01+F02+F03) |
| Form model / validation | High | F03 (createFormField with label/help/error) | DONE (createFormField with label/help/error) |
| Data table primitive | High | F04 (createDataTable) | DONE |
| Progress + status widgets | Med-High | F06 (createProgressBar, createSpinner) | DONE |
| Notification patterns | Medium | F07 (createToast) | DONE (toast; confirm dialog deferred) |
| Command/quick action UI | Medium | — | Deferred — app-level palette exists, module-local deferred |
| List/select patterns | Medium | F08 (createFilterableList) | DONE |
| Rich text rendering primitives | Medium | F05 (createKeyValuePanel, createLogView) | DONE (KV panel + log view; tree deferred) |
| Layout container variants | Medium | — | Deferred — centering/flow wrappers not in scope |
| Component state variants | Medium | F00 (component behaviour contract, variant model) | DONE |
| Design tokens / scale | Medium | F00 (spacing scale, control heights, density) | DONE |
| Data-viz wrappers | Medium | — | Deferred — blessed-contrib adapters are Phase 3 |
| Widget modularisation contracts | Medium | F00 (SDK category map in docs) | DONE |
| Accessibility/focus ergonomics | Medium | F00 (focus ring, disabled semantics) | Partially covered — contract only, not full audit |
| Testing harness for components | Medium | — | Deferred — no component test framework in scope |

## Roadmap phase mapping

| Phase (from analysis §5) | E036 coverage |
|---------------------------|---------------|
| Phase 1: Foundation contracts | F00 — component contract, tokens, category map |
| Phase 2: Core missing components | F01–F03 (forms), F04–F05 (data), F06–F07 (feedback) |
| Phase 3: Data-display and dashboard bridge | Deferred — future epic (contrib adapters, chart wrappers) |
| Phase 4: Feedback/overlay polish | F07 partial (toast only) — confirm dialog, action sheet deferred |

## Deferred items (candidate future epics)

- blessed-contrib adapter layer (line/bar/sparkline/gauge wrappers)
- Confirm dialog / action sheet pattern
- Module-local command palette helper
- Centering/flow container variants
- Component contract test harness
- Full validation/field-state layer
- Rich renderable helpers (panel/columns/tree a la Rich)
