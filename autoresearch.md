# E042 Solid Foundations — Autoresearch Brief

## What are we optimising?

The structural architecture of WibWob-DOS's `src/` TypeScript codebase, measured by
how closely the actual file structure matches a defined target architecture.

**Primary metric:** `architecture_score` (0-100, higher is better)
**Baseline:** 14.2

## Scoring dimensions

| Dimension | Weight | Baseline | What it measures |
|-----------|--------|----------|-----------------|
| God object decomposition | 30% | 0 | How much the 4 god objects have been split toward targets |
| Layer discipline | 25% | 20 | Cross-layer import violations (core→services, core→windows) |
| File health | 20% | 18 | Files over 1000/500 line thresholds |
| Target file existence | 10% | 0 | Whether planned extraction files exist |
| Deduplication | 10% | 50 | Known code duplications resolved |
| Type safety | 5% | 12.5 | `as any` casts beyond blessed framework gaps |

## Target architecture

Full target: `autoresearch/solid-foundations/target-architecture.md`

The 4 god objects and their targets:
- `app-controller.ts` (2244 → ~600 lines): Extract `action-bridge.ts`, `window-openers.ts`
- `ui-parts.ts` (2395 → ~200 lines): Extract to 9 focused ui-*.ts files
- `browser-windows.ts` (2082 → split into 4): `file-manager-window.ts`, `document-reader-window.ts`, etc.
- `wibwob-agent-session.ts` (1063 → ~400 lines): Extract tool files to `services/agent/`

## Rules

1. **typecheck must pass** — `bun run typecheck` is the gate
2. **Backward compatible imports** — original files must still exist as re-export barrels
3. **No functional regressions** — the app must boot and work
4. **E039 zone: do not restructure** — `command-catalog.ts`, `command-registry.ts`, `control-api.ts` are being rethought by E039. Trim dead weight only, no structural changes
5. **Blessed `as any` casts are permanent** — `.scrollTo()`, `.selected`, `.iwidth`, `.setValue()`, `'100%' as any` — these are @types gaps, not bugs
6. **One logical change per iteration** — extract one file or fix one concern per step
7. **Re-exports from old paths** — any extracted file must have its exports re-exported from the original file

## How to score

Run `bash autoresearch.sh` — it outputs all metrics and the composite `architecture_score`.

## Analysis reports

Read these for deep understanding of each folder:
- `autoresearch/solid-foundations/core-report.md` — 37 files in src/core/
- `autoresearch/solid-foundations/services-report.md` — 44 files in src/services/
- `autoresearch/solid-foundations/windows-report.md` — 17 files in src/windows/
- `autoresearch/solid-foundations/cli-tests-app-report.md` — CLI, tests, app entry

## Suggested iteration order

The scoring dimensions are weighted. Work on the highest-weighted dimensions first:

### Wave 1: God object decomposition (30% weight, currently 0)
1. Extract `ui-layout.ts` from `ui-parts.ts` (stack, row, grid, flex functions)
2. Extract `ui-chrome.ts` from `ui-parts.ts` (header, status bar, rule)
3. Extract `ui-tabs.ts` from `ui-parts.ts` (tabbed container)
4. Extract `ui-scroll-viewport.ts`, `ui-sidebar.ts`, `ui-selectable-list.ts`
5. Extract `file-manager-window.ts` from `browser-windows.ts`
6. Extract `document-reader-window.ts` from `browser-windows.ts`
7. Extract `window-openers.ts` from `app-controller.ts`
8. Extract `action-bridge.ts` from `app-controller.ts`
9. Extract agent tool files from `wibwob-agent-session.ts`

### Wave 2: Layer discipline (25% weight, currently 20)
10. Fix `canvas-types.ts` module import (define shape in core)
11. Move `skeleton-renderer.ts` service import to constructor injection
12. Fix `types.ts` importing `content-measurement.ts` from services
13. Fix `ui-parts.ts` importing `animation-service.ts`

### Wave 3: Deduplication + type safety (15% combined weight)
14. Extract shared `html-to-markdown.ts` service
15. Create `ansi-palette.ts` shared constants
16. Extract shared `ui-draft-input.ts`
17. Fix non-blessed `as any` casts (control-api, markdown-service, etc.)

## What NOT to do

- Don't rename files just to match target names if the content hasn't changed
- Don't create empty stub files to boost `target_files_exist` score
- Don't move code between files without understanding what it does
- Don't touch command system files beyond trimming (E039 zone)
- Don't break existing imports — always add re-exports
