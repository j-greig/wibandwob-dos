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
4. **E039 zone: do not restructure** — `command-catalog.ts`, `command-registry.ts`, `control-api.ts` are being rethought by E039. Trim dead weight only, no structural/interface changes
5. **CLI naming is E039-owned** — do not rename `cli/wibwob.ts` in E042 unless E039 explicitly requires it
6. **Blessed `as any` casts are permanent** — `.scrollTo()`, `.selected`, `.iwidth`, `.setValue()`, `'100%' as any` — these are @types gaps, not bugs
7. **No speculative abstractions** — extract plain modules first; only add registry/factory layers when there is concrete runtime need
8. **One logical change per iteration** — extract one file or fix one concern per step
9. **Re-exports from old paths** — any extracted file must have its exports re-exported from the original file
10. **Operability is mandatory** — no interactive interstitial flow without inspect/select/confirm/cancel control path

## How to score

Run `bash autoresearch.sh` — it outputs all metrics and the composite `architecture_score`.

## Analysis reports

Read these for deep understanding of each folder:
- `autoresearch/solid-foundations/core-report.md` — 37 files in src/core/
- `autoresearch/solid-foundations/services-report.md` — 44 files in src/services/
- `autoresearch/solid-foundations/windows-report.md` — 17 files in src/windows/
- `autoresearch/solid-foundations/cli-tests-app-report.md` — CLI, tests, app entry
- `autoresearch/solid-foundations/codex-architecture-review.md` — external critical review with 5-whys + E039 context

## Suggested iteration order

This order was revised using Codex review (`codex-architecture-review.md`) to prioritise real agent friction before large file churn.

### Wave 0: Correctness + operability first
1. Fix `canvas-types.ts` module import inversion (core must not import modules).
2. Add explicit overlay control contracts (`inspect/select/confirm/cancel`) for shared pickers.
3. Ensure query/control commands return structured data on direct paths (`direct: true` semantics).
4. Enforce menu command rule: required args must have no-arg fallback or picker flow.
5. Document restart-required vs reload-safe paths where agents actually trip.

### Wave 1: Small, high-signal dedup work
6. Extract shared `html-to-markdown.ts` and remove duplicate implementations.
7. Extract shared ANSI constants for windows.
8. Extract shared test HTTP helpers (`src/tests/helpers/api-client.ts`).
9. Extract shared draft-input helper used by agent/scramble flows.

### Wave 2: Focused god-object seams (lower risk)
10. Split `app-controller.ts` into `action-bridge.ts`, `window-openers.ts`, `fx-service.ts`, `clipboard-service.ts`.
11. Split `wibwob-agent-session.ts` into tool-focused files.
12. Extract `music-player-window.ts` visualiser/analyser internals.

### Wave 3: High-churn splits (after contracts are stable)
13. Split `browser-windows.ts` into dedicated window files.
14. Split `ui-parts.ts` into focused `ui-*` files while keeping `ui-parts.ts` as a compatibility barrel.
15. Split `overlay-manager.ts` into prompt modules, preserving operability contracts.
16. Split `generative-windows.ts` and deprecate companion patterns.

### Wave 4: File-manager stage 2
17. Move file-manager git/search/OS integration logic into services.
18. Keep `file-manager-window.ts` focused on rendering and input orchestration.
19. Extract reusable viewport helpers to core when shared.

### Wave 5: E039 execution (separate epic)
20. E039 owns CLI naming/packaging and transport evolution.
21. Add Unix socket transport to `control-api.ts` as additive behavior.
22. Keep command discovery and response contracts stable while E039 lands.

## What NOT to do

- Don't rename files just to match target names if the content hasn't changed
- Don't create empty stub files to boost `target_files_exist` score
- Don't move code between files without understanding what it does
- Don't touch command system files beyond trimming (E039 zone)
- Don't break existing imports — always add re-exports
