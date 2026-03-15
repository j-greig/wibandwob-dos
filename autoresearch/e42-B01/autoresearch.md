> **E042 Solid Foundations** — Bucket 1 of 6
> → Next: [`e42-B02` SDK Composition Helpers](../e42-B02/autoresearch.md)
> All buckets: B01 → B02 → B03 (strict) · B04 ∥ B02–B03 · B05 last · B06 agent-directed

# Autoresearch: E042 Solid Foundations

## Objective

Structural refinement of WibWob-DOS core TypeScript codebase across five sequential
buckets: dead code cleanup, SDK composition helpers, hero app canonicalization,
infrastructure wrappers, and test harness. The goal is measurable codebase health
improvement without functional regressions.

The codebase is ~38K lines across 100 files in `src/`. Key problems: god files
(app-controller 2244 lines, ui-parts 2395 lines, browser-windows 2082 lines),
6 circular deps, 28 unused exports, 38 unused types, zero SDK composition helpers,
34/34 microapps importing blessed directly, 17 test files with no runner.

## Metrics

- **Primary**: `finding_count` (count, lower is better) — composite score across all buckets:
  - Unused exports (knip)
  - Circular dependencies (madge)
  - SDK gap count (microapps importing from src/core/ or src/services/ directly)
  - Raw platform calls outside wrappers (readFileSync/writeFileSync/execSync outside wrapper files)
  - Failing tests
- **Secondary**:
  - `typecheck_seconds` — `time bun run typecheck` wall clock
  - `boot_ms` — cold start to first render (when instrumented)
  - `max_file_lines` — largest .ts file in src/
  - `sdk_primitive_count` — composition helpers exported from microapp-sdk.ts
  - `hero_pass_count` — hero apps passing smoke (describeState + captureText, out of 7)
  - `test_pass_count` — tests passing under `bun test`
  - `any_count` — `as any` occurrences in src/core/

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines for all tracked metrics.

## Files in Scope

### Bucket 1 — Dead Code + Circular Deps
| File | Role |
|------|------|
| `src/services/microapp-sdk.ts` | SDK facade — circular dep via canvas-types → sy2 panel-types |
| `src/core/ui-parts.ts` | 2395-line god file with barrel re-export cycles to ui-parts-data/feedback/forms |
| `src/windows/skeleton-renderer.ts` | Cross-dep with webcam-renderer |
| `src/windows/webcam-renderer.ts` | Cross-dep with skeleton-renderer |
| `src/services/capability-service.ts` | Cross-dep with chrome-browser-service |
| `src/services/chrome-browser-service.ts` | Cross-dep with capability-service |
| `knip.json` | Needs creation — configure to ignore microapps/, .pi/, scripts/, .trash/, .disabled/ |
| `package.json` | Add `bun run health` script |

### Bucket 2 — SDK Composition Helpers
| File | Role |
|------|------|
| `src/sdk/` | SDK ownership directory (stubs: microapp-host.ts, runtime-helpers.ts, runtime-client.ts) |
| `src/services/microapp-sdk.ts` | Stable public import path — new helpers exported here |
| `docs/sdk-primitives.md` | New doc with inline examples |

Target helpers:
- `createStatusBar(parent, opts)` → themed bottom bar with left/right text
- `createSplitView(parent, opts)` → left/right or top/bottom panes
- `createListPanel(parent, opts)` → selectable list with theme + vi keys
- `createTextViewer(parent, opts)` → scrollable text box, wrap option
- `createButtonBar(parent, buttons)` → bottom toolbar with keybindings

Each: typed options interface, theme-aware, returns handle with update/destroy.

### Bucket 3 — Hero 7
| App | Target Lines | Shows | Current |
|-----|-------------|-------|---------|
| hello-world | ~30 | Minimum viable: createWindow, describeState | 494 lines — rewrite |
| notepad | ~130 | Read/write, captureText, onInput, plumb | Exists — cleanup, use SDK primitives |
| runtime-inspector | ~425 | Live state, command introspection, tree views | Exists — review |
| figlet-banner | ~400 | Multi-command, font picker, prompts, writeHandlers | Exists — cleanup |
| layout-stress-test | ~464 | Responsive layout, breakpoints, animation | Rename from demo-layout-stress-test-pi |
| data-dashboard | ~200 | Live-updating panels, timers, split layout, theming | New build |
| file-manager | ~1622 | Full app: search, preview, sort, modes | Migrate from src/windows/ |

Every hero: `describeState` + `captureText` + consistent keys (q=close, /=search).

### Bucket 4 — Infra Wrappers
| File | Role |
|------|------|
| `src/core/safe-fs.ts` | New — safeReadFile, safeReadJSON, safeWriteFile, safeUnlink, listDir |
| `src/core/platform-commands.ts` | New — reveal-in-finder, open-external, quicklook |
| `src/core/append-log.ts` | New — services bypassing app-logger |
| `src/services/audio-process.ts` | New — ffplay/ffmpeg spawn boilerplate |
| 50+ call sites across 12+ files | Repoint to wrappers |

### Bucket 5 — Test + Benchmark Harness
| File | Role |
|------|------|
| `src/tests/*.ts` | 17 existing test files — consolidate, ensure pass |
| `package.json` | Add `bun run test` script |
| Hero app smoke tests | New — open via API → describeState → captureText → close |

## Off Limits

- `blessed` internals — we work with what it gives us
- New features — this is pure structural improvement
- Module API contract changes — backward compat required
- Rendering performance — separate concern
- microapps/ content (except fixing imports to point at SDK)

## Constraints

- `bun run typecheck` must pass after every change
- No functional regressions — app must boot, all features work
- Backward compatible imports — old paths work via re-exports
- One logical change per commit
- Bucket ordering: B1 → B2 → B3 (strict). B4 can parallel B2–B3. B5 last.

## Execution Order

```
B1 Dead Code + Cycles ──→ B2 SDK Primitives ──→ B3 Hero 7 ──→ B5 Tests
                     └──→ B4 Infra Wrappers ─────────────────┘
```

### B1 — Dead Code + Circular Deps (Session 1)
1. Configure `knip.json` (ignore microapps/, .pi/, scripts/, .trash/, .disabled/)
2. Kill 28 unused exports + 38 unused types
3. Fix 6 circular deps:
   - **CRITICAL**: sever sy2-chronicles panel-types leak from SDK chain
   - Break ui-parts.ts barrel cycle → direct imports from sub-modules
   - Fix skeleton-renderer ↔ webcam-renderer cross-dep
   - Fix capability-service ↔ chrome-browser-service cross-dep
4. Add `bun run health` script (typecheck + coat + lint + knip + madge --circular)
5. Fix scaffold-microapp.sh manifest format
6. Nuke `.disabled/` (or move to `.trash/disabled-microapps/`)
7. **Gate**: restart app, ops smoke check (health, state, open/close one microapp)

### B2 — SDK Composition Helpers (Sessions 1–2)
1. Build 5 composition helpers in `src/sdk/`
2. Export all via `microapp-sdk.ts`
3. Document in `docs/sdk-primitives.md` with inline examples
4. Verify: refactor notepad to use SDK primitives (statusBar + textViewer)
5. **Gate**: 5+ helpers exported, notepad uses ≥2, typecheck clean

### B3 — Hero 7 (Sessions 1–2)
1. Rewrite hello-world (494 → ~30 lines)
2. Cleanup notepad (use SDK primitives)
3. Review runtime-inspector (minor polish)
4. Cleanup figlet-banner (standardise keyboard shortcuts)
5. Rename layout-stress-test from demo-layout-stress-test-pi, promote
6. New build: data-dashboard (~200 lines)
7. Migrate file-manager from src/windows/ to microapp
8. All 7: describeState + captureText + consistent keys
9. Document in `docs/microapp-examples.md`
10. **Gate**: 7/7 open via API with valid describeState, hello-world ≤40 lines

### B4 — Infra Wrappers (Session 1, parallel with B2–B3)
1. `src/core/safe-fs.ts` — replace 50+ raw readFileSync/writeFileSync calls
2. `src/core/platform-commands.ts` — replace 6 raw exec calls
3. `src/core/append-log.ts` — replace 5 bypassed logging calls
4. `src/services/audio-process.ts` — replace 6 ffplay/ffmpeg spawns
5. Animation loop audit — check createFramePlayer compat
6. **Gate**: grep for raw calls only hits wrapper files + CLI

### B5 — Test + Benchmark Harness (Session 1, after B1–B3)
1. Consolidate 17 existing tests, ensure all pass under `bun test`
2. Add 7 hero app smoke tests (open → describeState → captureText → close)
3. Install hyperfine, benchmark boot time + health latency + typecheck time
4. Add `bun run test` to package.json
5. **Gate**: `bun test` runs and passes (17+ tests + 7 smoke tests)

## What's Been Tried

_Nothing yet — fresh start._
