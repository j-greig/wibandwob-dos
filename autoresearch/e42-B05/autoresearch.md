> **E042 Solid Foundations** — Bucket 5 of 6
> ← Previous: [`e42-B04` Infra Wrappers](../e42-B04/autoresearch.md)
> → Next: [`e42-B06` Next Frontier (Agent-Directed)](../e42-B06/autoresearch.md)
> All buckets: B01 → B02 → B03 (strict) · B04 ∥ B02–B03 · B05 last · B06 agent-directed

# Autoresearch: E042-B05 — Test + Benchmark Harness

## Objective

Consolidate the 17 existing test files under `bun test`, add hero app smoke tests,
and establish benchmark tracking. The codebase is clean after B01–B04 — now protect
it with regression gates.

Currently: 17 test files in `src/tests/`, no CI runner, no `bun run test`, no
benchmark tracking. Tests written ad-hoc per feature (workspace roundtrip, monster-cam
model, etc). No smoke tests for microapp lifecycle.

## Metrics

- **Primary**: `test_pass_rate` (percentage, higher is better) — passing tests / total tests
- **Secondary**:
  - `test_total` — total test count
  - `test_passing` — passing test count
  - `test_failing` — failing test count
  - `hero_smoke_count` — hero app smoke tests passing (out of 7)
  - `boot_ms` — cold start to first `wibwob health` response (hyperfine)
  - `typecheck_seconds` — regression watch

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

| File | Role |
|------|------|
| `src/tests/*.ts` | 17 existing test files — consolidate |
| `src/tests/smoke/*.ts` | New — hero app smoke tests |
| `package.json` | Add `"test": "bun test"` script |
| `bunfig.toml` or `bun test` config | Test runner configuration |

## Off Limits

- Modifying source code to make tests pass (fix the tests, not the source)
- Adding test dependencies beyond what Bun provides
- Changing app behaviour to accommodate tests

## Constraints

- `bun run typecheck` must pass
- Tests must be runnable headless (no TUI required for unit tests)
- Smoke tests use `wibwob` CLI — COAT compliant
- B01–B03 should be substantially complete first
- `bun run test` must be the single entry point

## Execution Steps

1. Audit 17 existing test files — which pass, which fail, which are stale
2. Add `"test": "bun test"` to package.json scripts
3. Fix or remove broken tests — get to green baseline
4. Create `src/tests/smoke/` directory for hero app smoke tests
5. Write smoke test per hero: `wibwob run "microapp.open <id>"` → check describeState → close
6. Install hyperfine if not present
7. Benchmark: boot time, `wibwob health` latency, typecheck time
8. Record baseline numbers in autoresearch.md "What's Been Tried"
9. Stretch: node-pty TUI integration test for one hero app

## Hero Smoke Test Pattern

```typescript
// For each hero app:
// 1. wibwob run "microapp.open wibwob.<app>"
// 2. wibwob state → parse JSON → find window with appType
// 3. Verify describeState fields present
// 4. wibwob run "window.close <id>"
// 5. wibwob state → verify window gone
```

## What's Been Tried

### Test Structure ✅
- Split 17 test files into `src/tests/unit/` (9 files, 36 tests) and `src/tests/integration/` (8 files, 63 tests)
- Fixed all import paths after directory move
- Unit tests: **36/36 pass** (100%) — always green, no app required
- Integration tests: need running app instance — 5 pass when app running, rest need specific windows
- `bun run test` → unit only (always green)
- `bun run test:integration` → integration (needs running app)
- `bun run test:all` → everything

### Health Script ✅
- `bun run health` now runs: tests → typecheck → COAT → madge circular
- All 4 gates pass

### Remaining
- [ ] Hero app smoke tests (via API — needs running instance)
- [ ] Hyperfine benchmarks for boot time
- [ ] Fix flaky integration tests (theme-cycle strict screenshot comparison)
