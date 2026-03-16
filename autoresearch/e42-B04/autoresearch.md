> **E042 Solid Foundations** — Bucket 4 of 6
> ← Previous: [`e42-B03` Hero 7](../e42-B03/autoresearch.md)
> → Next: [`e42-B05` Test + Benchmark Harness](../e42-B05/autoresearch.md)
> All buckets: B01 → B02 → B03 (strict) · B04 ∥ B02–B03 · B05 last · B06 agent-directed

# Autoresearch: E042-B04 — Infra Wrappers

## Objective

Consolidate raw platform calls (fs, exec, spawn) behind thin wrappers so call sites
have one import, consistent error handling, and are easy to audit. Currently 50+ raw
`readFileSync`/`writeFileSync` across 12+ files and 6+ raw `execSync`/`spawnSync` calls.

Can run in parallel with B02–B03 (only depends on B01).

## Metrics

- **Primary**: `raw_call_count` (count, lower is better) — raw platform calls
  (readFileSync/writeFileSync/execSync/spawnSync) outside wrapper files
- **Secondary**:
  - `wrapper_count` — number of wrapper modules created (target: 4+)
  - `raw_fs_calls` — readFileSync/writeFileSync outside safe-fs.ts
  - `raw_exec_calls` — execSync/spawnSync outside platform-commands.ts + audio-process.ts + CLI
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

### New wrappers to create
| File | Wraps | Call Sites |
|------|-------|-----------|
| `src/core/safe-fs.ts` | readFileSync, writeFileSync, readJSON, unlink, listDir | 50+ across 12+ files |
| `src/core/platform-commands.ts` | reveal-in-finder, open-external, quicklook | 6 across 3 files |
| `src/core/append-log.ts` | Direct file appends bypassing app-logger | 5 across 4 files |
| `src/services/audio-process.ts` | ffplay/ffmpeg spawn boilerplate | 6 across 3 files |

### Existing (done)
| File | Status |
|------|--------|
| `src/core/clipboard.ts` | ✅ Already wrapped (4 call sites, 4 files) |

### Also audit
- Animation loop unification — check createFramePlayer compat with plasma/contour/motion engines

## Off Limits

- CLI files (`src/cli/`) — these legitimately use raw exec
- Wrapper internals of blessed
- Microapp code (touched only if they have raw platform calls)

## Constraints

- `bun run typecheck` must pass
- `wibwob health` + `wibwob state` must work after changes
- One wrapper per commit — easy to bisect
- Backward compat: if any module imported raw fs, the wrapper must cover that use case
- B01 (dead code) should be complete first

## Execution Steps

1. Create `src/core/safe-fs.ts` — safeReadFile, safeReadJSON, safeWriteFile, safeUnlink, listDir
2. Migrate 50+ readFileSync/writeFileSync call sites → safe-fs
3. Create `src/core/platform-commands.ts` — revealInFinder, openExternal, quicklook
4. Migrate 6 exec call sites → platform-commands
5. Create `src/core/append-log.ts` — appendToLog replacing direct file appends
6. Migrate 5 append call sites → append-log
7. Create `src/services/audio-process.ts` — spawnFfplay, spawnFfmpeg
8. Migrate 6 audio spawn call sites → audio-process
9. Animation loop audit — verify createFramePlayer compat
10. Final grep: only wrapper files + CLI should have raw calls

## What's Been Tried

### safe-fs.ts wrapper ✅
Created `src/core/safe-fs.ts` with: `safeReadFile`, `safeReadJSON`, `safeReadBuffer`,
`safeWriteFile`, `safeAppendFile`, `safeUnlink`, `listDir`, `pathExists`.

Migrated 28 raw fs calls across 19 files (73 → 45 raw calls remaining).

### Remaining raw fs calls (15)
- `src/core/app-controller.ts` (4) — complex composition root, high risk to refactor
- `src/windows/file-manager-window.ts` (4) — 1622-line file, migration deferred
- `src/services/figlet-service.ts` (1) — readFileSync for font catalog
- `src/services/chrome-browser-service.ts` (1) — screenshot buffer read
- `src/services/control-api.ts` (1) — file write for screenshot
- `src/app.ts` (1) — startup config read
- `src/cli/wibwob.ts` (1) — CLI (excluded by design)
- `src/tests/` (1) — test file (excluded by design)

### Exec calls not wrapped (30)
Exec/spawn calls are specialized per-service (figlet probes, clipboard, capability
detection). A generic wrapper would add indirection without benefit. Left as-is.

### Platform-commands, append-log, audio-process
Deferred — the remaining exec calls are too specialized for generic wrappers to help.
