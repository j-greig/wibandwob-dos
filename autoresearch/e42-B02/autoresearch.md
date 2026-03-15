> **E042 Solid Foundations** — Bucket 2 of 6
> ← Previous: [`e42-B01` Dead Code + Circular Deps](../e42-B01/autoresearch.md)
> → Next: [`e42-B03` Hero 7](../e42-B03/autoresearch.md)
> All buckets: B01 → B02 → B03 (strict) · B04 ∥ B02–B03 · B05 last · B06 agent-directed

# Autoresearch: E042-B02 — SDK Composition Helpers

## Objective

Build 5+ composition helpers in `src/sdk/`, export via `microapp-sdk.ts`, so microapp
authors never touch raw blessed for standard UI patterns. Currently 34/34 non-disabled
microapps `import blessed from "blessed"` directly. The SDK provides 48 re-exports but
zero composition helpers.

Stubs already exist: `src/sdk/microapp-host.ts`, `runtime-helpers.ts`, `runtime-client.ts`.
`src/sdk/README.md` says: "keep `src/services/microapp-sdk.ts` as the stable public
import path, move real SDK ownership here gradually."

## Metrics

- **Primary**: `sdk_primitive_count` (count, higher is better) — composition helpers
  exported from microapp-sdk.ts
- **Secondary**:
  - `notepad_sdk_usage` — count of SDK helper calls in notepad microapp
  - `sdk_gap_count` — microapps importing directly from src/core/ or src/services/
  - `doc_exists` — 1 if docs/sdk-primitives.md exists with examples, 0 otherwise
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

| File | Role |
|------|------|
| `src/sdk/*.ts` | New helper implementations live here |
| `src/services/microapp-sdk.ts` | Stable public export surface — add re-exports |
| `docs/sdk-primitives.md` | New — inline docs with examples for each helper |
| `microapps/notepad/` | Verification target — refactor to use ≥2 helpers |

## Target Helpers

1. **`createStatusBar(parent, opts)`** → themed bottom bar with left/right text slots
2. **`createSplitView(parent, opts)`** → left/right or top/bottom panes with ratio
3. **`createListPanel(parent, opts)`** → selectable list with theme tokens + vi keys
4. **`createTextViewer(parent, opts)`** → scrollable text box with wrap option
5. **`createButtonBar(parent, buttons)`** → bottom toolbar with keybinding labels

Each helper: typed options interface, theme-aware via current theme tokens,
returns handle `{ element, update(opts), destroy() }`.

## Off Limits

- Changing blessed internals
- Modifying microapps other than notepad (for verification)
- Breaking existing microapp-sdk.ts exports

## Constraints

- `bun run typecheck` must pass after every change
- Backward compatible — existing SDK imports unchanged
- Helpers must work with any blessed parent element
- Theme-aware — use theme tokens, not hardcoded colours
- B1 (dead code/cycles) should be complete first

## Execution Steps

1. Create `src/sdk/composition-helpers.ts` with typed interfaces
2. Implement createStatusBar — simplest, proves the pattern
3. Implement createTextViewer — notepad needs this
4. Implement createListPanel — common pattern across apps
5. Implement createSplitView — layout primitive
6. Implement createButtonBar — toolbar primitive
7. Export all from `microapp-sdk.ts`
8. Refactor notepad to use createStatusBar + createTextViewer
9. Write `docs/sdk-primitives.md` with usage examples
10. Verify typecheck + app boots

## What's Been Tried

_Nothing yet — fresh start._
