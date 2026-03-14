# Code Analysis: `src/app.ts`, `src/cli/`, `src/tests/`

## File-by-File Analysis

---

### `src/app.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Application entry point — parses CLI flags, sets env vars, writes PID file, imports and runs `TsTuiMvpApp`. |
| **Lines** | 51 |
| **Exports** | None (side-effect-only entry point). |

**Imports:**
- External: `node:os`, `node:fs`, `node:path`
- Same project: `./core/cli.js` (`parseAppFlags`, `printHelp`), `./core/app-controller.js` (`TsTuiMvpApp` — dynamic import)

**Responsibilities:**
1. TERM env normalization (Ghostty workaround)
2. CLI flag parsing + help
3. Session ID generation + process title
4. PID file lifecycle (write, cleanup on exit/signal)
5. App instantiation and run

⚠️ **5 responsibilities** — mild SRP concern. The PID file management (lines 35–44) could be extracted to a utility.

**Code Smells:**
- **Data clumps:** PID file logic (scratchBase, pidFile, removePid, signal handlers) is a cohesive block that could be a `writePidFile()` helper (lines 35–44).
- None severe; file is small and procedural.

**Type Safety:** Clean. No `as any` casts, no untyped parameters.

**Coupling:** Tightly coupled to `core/cli.js` and `core/app-controller.js`. Loosely coupled to env vars (`WIBWOB_INSTANCE_LABEL`, `SCRATCH_DIR`, `WIBWOB_SESSION_ID`). The dynamic `await import()` is a deliberate decoupling technique — good.

**Refactoring Opportunities:**
1. Extract PID file management into `src/core/pid-file.ts` — `writePidFile(scratchDir): () => void` returning a cleanup function. Removes 10 lines from entry point.
2. Extract `randomSessionId()` into `core/cli.ts` or a shared util — it's a pure function with no reason to live in the entry point.

---

### `src/cli/wibwob.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Unix CLI client (`wibwob` command) — thin HTTP wrapper around the WibWob-DOS control API, outputting JSON to stdout. |
| **Lines** | 278 |
| **Exports** | None (script entry point). |

**Imports:**
- None. Fully self-contained — uses only `fetch`, `process`, `console` (globals).

**Responsibilities:**
1. HTTP API client (`api()` helper)
2. CLI argument parsing (`parseFlags()`)
3. Command dispatch (switch-based router)
4. Shell completion generation (zsh + bash)
5. Output formatting (`out()`)
6. Help text rendering (`cmdHelp()`, `usage()`)

⚠️ **6 responsibilities** — classic CLI monolith pattern. Acceptable at 278 lines but approaching the point where extraction helps.

**Code Smells:**
- **Long method:** `main()` dispatch (lines 210–267) is a 57-line switch + fallthrough chain. The `default` case has nested conditionals for `noun verb`, `window <id> <verb>`, and `noun.verb` — hard to follow.
- **Feature envy:** `cmdCompletions()` (lines 132–180) reaches deep into API response shapes to generate shell scripts. This function alone is 48 lines and could be a separate file.
- **Primitive obsession:** `parseFlags()` does type coercion (number, JSON, boolean) inline. This is ad-hoc schema validation that could use a tiny typed parser.
- **Speculative generality:** The `window <id> <verb>` dispatch path (lines 253–260) is a convenience alias pattern — unclear if it's actually used.

**Type Safety:**
- `as any`: 0
- `as unknown`: 0
- Untyped: `api()` returns `Promise<unknown>` — callers cast with `as { windows: ... }` etc. 5 inline casts in command handlers (`cmdWindows`, `cmdCommands`, `cmdHelp`, `cmdCompletions`). These are pragmatic but fragile.

**Coupling:** Zero coupling to any internal modules — communicates only via HTTP. This is excellent architecture for a CLI tool.

**Refactoring Opportunities:**
1. **Extract `cmdCompletions()` into `src/cli/completions.ts`** — it's self-contained, 48 lines, and a different concern (shell integration vs. API interaction).
2. **Extract `parseFlags()` into `src/cli/parse-flags.ts`** — reusable, testable, currently untested.
3. **Define API response types** — create `src/cli/api-types.ts` with `StateResponse`, `CommandListResponse`, etc. Replace inline casts with typed returns from `api<T>()`.
4. **Simplify `main()` dispatch** — replace nested if/else in `default` with a command table or chain-of-responsibility pattern.

---

### `src/tests/animation-service.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Unit test for `createEmbeddedLivePlayer` — verifies mount, frame emission, and cleanup. |
| **Lines** | 38 |
| **Exports** | None (test file). |

**Imports:**
- External: `bun:test`
- Other src/: `../services/animation-service.js`

**Responsibilities:** Single — test the embedded live player lifecycle. ✅

**Code Smells:** None. Clean, focused test.

**Type Safety:** Clean. The `target` stub is structurally typed.

**Coupling:** Depends on `animation-service.js` API shape. Test is resilient — only uses public API.

**Refactoring Opportunities:** None needed.

---

### `src/tests/ascii-composition.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Unit test for ASCII layer composition (`composeAsciiLayers`, `renderAsciiTextBlock`). |
| **Lines** | 26 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- Other src/: `../services/ascii-composition.js`

**Responsibilities:** Single — test composition logic. ✅

**Code Smells:** None.

**Type Safety:** Clean.

**Refactoring Opportunities:** None.

---

### `src/tests/command-registry.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Integration tests against the live control API — health, command listing, execution, state service, screenshot. |
| **Lines** | 189 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- No internal imports — pure HTTP-based integration test.

**Responsibilities:**
1. Control API health verification
2. Contract doc endpoint testing (`/help`, `/openapi.json`, legacy alias 404s)
3. Command registry list/run/alias tests
4. State service shape validation
5. Screenshot text endpoint testing

⚠️ **5 distinct test suites in one file** — consider splitting by describe block if the file grows further.

**Code Smells:**
- **Data clumps:** The `api()` helper (lines 13–20) is duplicated across `command-registry.test.ts`, `editor-open.test.ts`, `window-parity.test.ts`, `workspace-roundtrip.test.ts`, and `workspace-apptype-roundtrip.test.ts`. 5 copies of essentially the same function.
- **Primitive obsession:** Response types are all `any` (line 18 `as any`).

**Type Safety:** `as any` on API responses (line 18). All response bodies untyped.

**Coupling:** Depends on running app at port 8099. No internal imports.

**Refactoring Opportunities:**
1. **Extract shared test helpers** into `src/tests/helpers/api-client.ts` — the `api()`, `post()`, `get()`, `sleep()` helpers are copy-pasted across 5+ test files.
2. Split into separate files if more tests are added per describe block.

---

### `src/tests/editor-open.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Integration tests for editor open failure paths — nonexistent file, unsaved buffer, readable file, no-args. |
| **Lines** | 113 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`, `node:fs`, `node:path`, `node:os`
- No internal imports.

**Responsibilities:** Single — test editor open edge cases. ✅

**Code Smells:**
- **Duplicated `post()`/`get()` helpers** — same pattern as command-registry.test.ts.
- **Magic numbers:** `300ms` sleep (lines 58, 73, 92, 103) — test timing sensitivity.

**Type Safety:** `as Promise<any>` on lines 19, 24. `(w: any)` throughout.

**Refactoring Opportunities:**
1. Use shared test API client (see command-registry recommendation).
2. Replace `setTimeout` sleeps with `waitFor()` polling pattern (already used in workspace-apptype-roundtrip.test.ts).

---

### `src/tests/microapp-workspace-roundtrip.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Unit test for dynamic snapshot registration — serialize/restore/isPersistable round-trip without a running app. |
| **Lines** | 139 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- Other src/: `../../src/core/snapshot-registry.js`, `../../src/core/types.js`

**Responsibilities:** Single — test microapp snapshot registry. ✅

**Code Smells:**
- **Stale `SnapshotRestoreActions` stub** (lines 31–44): The mock has action names (`openPrimerViewer`, `openTextEditor`, etc.) that may drift from the real interface. Uses `as unknown as` to force-fit the type.
- **Path inconsistency:** Uses `../../src/core/...` instead of `../core/...` — suggests this file may have been at a different depth originally.

**Type Safety:** `as unknown as WindowRecord` on line 28, `as unknown as SnapshotRestoreActions` on line 44. 2 force-casts to satisfy stub types.

**Refactoring Opportunities:**
1. Fix import paths — should be `../core/...` if file is at `src/tests/`.
2. Create a shared `makeWindowRecordStub()` factory for tests.

---

### `src/tests/monster-cam-model.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Unit test for the MonsterCam state model — phase transitions, toggle messages, frame processing, bbox persistence. |
| **Lines** | 92 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- Other src/: `../../src/windows/monster-cam-model.js`, `../../src/services/monster-cam-service.js` (type only)

**Responsibilities:** Single — test MonsterCam model. ✅

**Code Smells:** None. Well-structured elm-style model tests.

**Type Safety:** Clean. `Partial<MonsterCamFrame>` is properly typed.

**Refactoring Opportunities:** 
1. Fix import path depth (`../../src/` → `../`).

---

### `src/tests/render-monitor.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Unit test for `createRenderMonitor` — render counting, FPS calculation, format output. |
| **Lines** | 30 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- Other src/: `../core/render-monitor.js`

**Responsibilities:** Single. ✅

**Code Smells:** None.

**Type Safety:** Clean.

**Refactoring Opportunities:** None.

---

### `src/tests/render-scheduler.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Unit test for `createRenderScheduler` — batching, sync/render ordering, persist subsumption, flushNow. |
| **Lines** | 87 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- Other src/: `../../src/core/render-scheduler.js`

**Responsibilities:** Single. ✅

**Code Smells:** None. Excellent test design — tests observable behavior through call recording.

**Type Safety:** Clean.

**Refactoring Opportunities:**
1. Fix import path (`../../src/core/` → `../core/`).

---

### `src/tests/runtime-stats.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Unit test for `RuntimeStatsController.snapshot()` — render, memory, and agent stats. |
| **Lines** | 41 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- Other src/: `../../src/core/runtime-stats.js`

**Responsibilities:** Single. ✅

**Code Smells:**
- `as any` casts on `screen` and `menuBar` stubs (lines 9, 12).

**Type Safety:** 2× `as any`.

**Refactoring Opportunities:**
1. Fix import path (`../../src/core/` → `../core/`).

---

### `src/tests/sidebar-panel.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Unit test for `resolveSidebarWidth` — fixed/percent/overflow-guard/WibWobWorld pattern width calculations. |
| **Lines** | 81 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- Other src/: `../../src/core/ui-parts.js`

**Responsibilities:** Single. ✅

**Code Smells:** None. Excellent parameterized-style tests with clear expected values.

**Type Safety:** Clean.

**Refactoring Opportunities:**
1. Fix import path (`../../src/core/` → `../core/`).

---

### `src/tests/theme-cycle.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Integration test — cycles all themes via API, verifies distinct ANSI output per theme and return to original. |
| **Lines** | 64 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- Other src/: `../core/theme/resolver.js` (for `allVariants()` count)

**Responsibilities:** Single. ✅

**Code Smells:** None.

**Type Safety:** Clean.

**Refactoring Opportunities:** None.

---

### `src/tests/window-parity.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Integration test — verifies every openable window type reports correct `appType` and `summary` through the state API. |
| **Lines** | 184 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- No internal imports.

**Responsibilities:** Single — window state parity audit. ✅

**Code Smells:**
- **Duplicated helpers:** `post()`, `get()`, `sleep()` — same as other integration tests.
- **Inconsistent delays:** Some windows get 500ms (default), chrome-browser gets 1000ms, agent gets 1000ms. Magic numbers for timing.

**Type Safety:** `as Promise<any>` on responses. `(w: any)` throughout.

**Refactoring Opportunities:**
1. Use shared test helpers.
2. Replace magic sleep values with `waitFor()` polling.

---

### `src/tests/workspace-apptype-roundtrip.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Comprehensive workspace snapshot round-trip test — unit tests for registry edge cases + live tests for save/close/load/verify per app type. |
| **Lines** | 294 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`, `node:path`
- Other src/: `../core/snapshot-registry.js`, `../core/types.js`

**Responsibilities:**
1. Unit tests for snapshot registry coverage and edge cases
2. Live round-trip tests for every persistable app type

Two related responsibilities — acceptable since they test the same feature at different levels.

**Code Smells:**
- **Long file:** 294 lines. The `makeRestoreActions()` stub (lines 62–83) has 16 action properties — fragile if the interface changes.
- **Duplicated helpers:** `post()`, `get()`, `waitFor()`, `closeAllWindows()` are re-implemented here.
- **Stale interface stub:** `makeRestoreActions()` uses property names that may drift from the real `SnapshotRestoreActions` type — but it's typed, so compiler will catch drift.

**Type Safety:** `as any` in `windows: {} as any` (line 82). `(w: any)` in predicates.

**Refactoring Opportunities:**
1. Extract `makeRestoreActions()` to a shared test fixture.
2. Extract `post()`, `get()`, `waitFor()`, `closeAllWindows()` to shared helpers.
3. Consider splitting unit and live tests into separate files.

---

### `src/tests/workspace-roundtrip.test.ts`

| Attribute | Detail |
|-----------|--------|
| **Purpose** | Integration test — save/load workspace round-trip, theme persistence, move/resize API field names. |
| **Lines** | 122 |
| **Exports** | None. |

**Imports:**
- External: `bun:test`
- No internal imports.

**Responsibilities:** Single — workspace persistence contract. ✅

**Code Smells:**
- **Duplicated helpers:** `post()`, `get()` — same pattern again.
- **Magic sleeps:** 300ms, 500ms, 1000ms scattered throughout.

**Type Safety:** `as Promise<any>` on responses.

**Refactoring Opportunities:**
1. Use shared test helpers.
2. Replace sleeps with `waitFor()`.

---

## Folder Summary

### Overall Responsibility and Cohesion

| Folder | Responsibility | Cohesion |
|--------|---------------|----------|
| `src/app.ts` | Single entry point — bootstrap and run | High (single file, single purpose) |
| `src/cli/` | External CLI tool for the control API | High (single file, self-contained) |
| `src/tests/` | Unit + integration test suite | Medium — mixes unit tests (no app needed) and integration tests (require running app) |

### Files That Don't Belong

All files are appropriately placed. No misplacements detected.

### Internal Dependency Patterns (within `src/tests/`)

The test files are independent of each other — no test imports another test. This is correct.

However, **6 of 14 test files duplicate the same HTTP helper pattern** (`post()`, `get()`, `api()`):
- `command-registry.test.ts`
- `editor-open.test.ts`
- `window-parity.test.ts`
- `workspace-roundtrip.test.ts`
- `workspace-apptype-roundtrip.test.ts`
- `theme-cycle.test.ts` (uses inline fetch, slightly different)

### Cross-Folder Dependency Patterns

| Test File | Imports From |
|-----------|-------------|
| `animation-service.test.ts` | `src/services/animation-service.js` |
| `ascii-composition.test.ts` | `src/services/ascii-composition.js` |
| `render-monitor.test.ts` | `src/core/render-monitor.js` |
| `render-scheduler.test.ts` | `src/core/render-scheduler.js` |
| `runtime-stats.test.ts` | `src/core/runtime-stats.js` |
| `sidebar-panel.test.ts` | `src/core/ui-parts.js` |
| `theme-cycle.test.ts` | `src/core/theme/resolver.js` |
| `monster-cam-model.test.ts` | `src/windows/monster-cam-model.js`, `src/services/monster-cam-service.js` |
| `microapp-workspace-roundtrip.test.ts` | `src/core/snapshot-registry.js`, `src/core/types.js` |
| `workspace-apptype-roundtrip.test.ts` | `src/core/snapshot-registry.js`, `src/core/types.js` |
| Integration tests (4 files) | No internal imports — HTTP only |

`src/app.ts` imports from `src/core/cli.js` and `src/core/app-controller.js`.  
`src/cli/wibwob.ts` has **zero** internal imports — fully decoupled HTTP client.

### Import Path Inconsistency

5 test files use `../../src/core/...` or `../../src/windows/...` instead of `../core/...`:
- `microapp-workspace-roundtrip.test.ts`
- `monster-cam-model.test.ts`
- `render-scheduler.test.ts`
- `runtime-stats.test.ts`
- `sidebar-panel.test.ts`

This suggests they were originally at a deeper nesting level (e.g., `src/tests/unit/`) and were moved up without fixing imports. The imports still resolve but are misleading.

### Top 5 Priority Refactoring Actions

| # | Action | Impact | Files Affected |
|---|--------|--------|----------------|
| 1 | **Extract shared test API helpers** into `src/tests/helpers/api-client.ts` — consolidate duplicated `post()`, `get()`, `api()`, `waitFor()`, `closeAllWindows()`, `sleep()` | Eliminates ~120 lines of duplication across 6 files, single point of maintenance for API URL config | `command-registry.test.ts`, `editor-open.test.ts`, `window-parity.test.ts`, `workspace-roundtrip.test.ts`, `workspace-apptype-roundtrip.test.ts`, `theme-cycle.test.ts` |
| 2 | **Fix import path inconsistency** — change `../../src/core/...` to `../core/...` in 5 test files | Reduces confusion, makes the actual module resolution path obvious | `microapp-workspace-roundtrip.test.ts`, `monster-cam-model.test.ts`, `render-scheduler.test.ts`, `runtime-stats.test.ts`, `sidebar-panel.test.ts` |
| 3 | **Replace magic sleep()s with `waitFor()` polling** in integration tests | Reduces flaky test failures, speeds up tests (no oversleeping), makes timing intentions explicit | `editor-open.test.ts`, `workspace-roundtrip.test.ts`, `window-parity.test.ts` |
| 4 | **Add API response types to `src/cli/wibwob.ts`** — define `StateResponse`, `CommandListResponse`, etc. and make `api<T>()` generic | Removes 5 inline `as` casts, catches API shape drift at compile time | `wibwob.ts` |
| 5 | **Extract PID file + session ID from `src/app.ts`** into `src/core/pid-file.ts` and `src/core/cli.ts` | Reduces entry point to ~15 lines of pure orchestration, makes PID management testable and reusable | `app.ts` |
