> **E042 Solid Foundations** — Bucket 1 of 6
> → Next: [`e42-B02` SDK Composition Helpers](../e42-B02/autoresearch.md)
> All buckets: B01 → B02 → B03 (strict) · B04 ∥ B02–B03 · B05 last · B06 agent-directed

# Autoresearch: E042-B01 — Dead Code + Circular Dep Cleanup

## Objective

Remove dead exports/types and fix all 6 circular dependencies in the WibWob-DOS
codebase. This is the foundation bucket — B02–B06 build on a clean dep graph.

**Baseline (2026-03-15):**
- 123 unused exports (knip `--include exports`)
- 191 unused exported types (knip `--include types`)
- 6 circular dependencies (madge)
- No knip.json config exists

## Metrics

- **Primary**: `finding_count` (count, lower is better) — unused exports + unused types + circular deps
- **Secondary**:
  - `unused_exports` — knip unused exports count
  - `unused_types` — knip unused exported types count
  - `circular_deps` — madge circular dependency count
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

| File | Role |
|------|------|
| `src/services/microapp-sdk.ts` | SDK facade — cycle: canvas-types → sy2-chronicles/panel-types → microapp-sdk |
| `src/core/canvas-types.ts` | Imports `CEPanelDef` from microapp — must be moved here |
| `microapps/sy2-chronicles/panel-types.ts` | Defines CEPanelDef, imports from microapp-sdk |
| `src/core/ui-parts.ts` | Barrel re-exports from ui-parts-{data,feedback,forms} which import Rect/LayoutPart back |
| `src/core/ui-parts-data.ts` | Imports `Rect, LayoutPart` from ui-parts.ts (cycle) |
| `src/core/ui-parts-feedback.ts` | Imports `Rect, LayoutPart` from ui-parts.ts (cycle) |
| `src/core/ui-parts-forms.ts` | Imports `Rect, LayoutPart` from ui-parts.ts (cycle) |
| `src/core/skeleton-renderer.ts` | Imports `WebcamCell` type from webcam-renderer |
| `src/services/webcam-renderer.ts` | Imports `renderSkeletonAt` from skeleton-renderer |
| `src/services/capability-service.ts` | Imports `findChromeExecutablePath` from chrome-browser-service |
| `src/services/chrome-browser-service.ts` | Imports `capabilityService` from capability-service |
| `knip.json` | New — configure to scope knip to src/ only |
| `package.json` | Add `bun run health` script |
| All files with unused exports | ~50+ files across src/ |

## Circular Dep Fix Plan

1. **CRITICAL: microapp-sdk → canvas-types → sy2-chronicles/panel-types → microapp-sdk**
   Move `CEPanelDef` interface from `microapps/sy2-chronicles/panel-types.ts` into `src/core/canvas-types.ts`.
   Update sy2-chronicles to import it from canvas-types (via SDK).

2. **ui-parts.ts ↔ ui-parts-{data,feedback,forms}.ts** (3 cycles)
   Extract `Rect`, `LayoutPart`, `FlexBasis`, `TrackSize`, `AxisAlign` into `src/core/ui-parts-types.ts`.
   All sub-modules import from ui-parts-types instead of ui-parts.

3. **skeleton-renderer ↔ webcam-renderer**
   Move `WebcamCell` interface to a shared types file or into skeleton-renderer.

4. **capability-service ↔ chrome-browser-service**
   Extract `findChromeExecutablePath` to a standalone utility or pass it as a parameter.

## Off Limits

- New features
- Rendering changes
- Module API contract changes
- microapps/ content (except fixing the sy2-chronicles cycle)

## Constraints

- `bun run typecheck` must pass after every change
- No functional regressions — `wibwob health` + `wibwob state` must work
- Backward compatible imports — old paths work via re-exports
- One logical change per commit

## Execution Steps

1. Create `knip.json` scoped to src/
2. Fix cycle 1: move CEPanelDef to canvas-types.ts
3. Fix cycles 2–4: extract ui-parts-types.ts with Rect/LayoutPart
4. Fix cycle 5: move WebcamCell to shared location
5. Fix cycle 6: decouple capability-service ↔ chrome-browser-service
6. Remove unused exports batch by batch (typecheck after each)
7. Remove unused types batch by batch
8. Add `bun run health` script
9. Gate: restart app, `wibwob health`, `wibwob state`

## What's Been Tried

_Nothing yet — fresh start._
