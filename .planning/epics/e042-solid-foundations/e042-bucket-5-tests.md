---
id: E042-B5
title: "Test + Benchmark Harness"
status: not-started
depends_on: [E042-B1, E042-B2, E042-B3]
---

# E042-B5 — Test + Benchmark Harness

**Sessions**: 1

## Why Last

Codebase is clean after B1–B4, worth protecting with regression gates.

## Context

17 test files exist in `src/tests/` but no CI runner, no `bun run test`, no benchmark tracking. Tests were written ad-hoc per feature (workspace roundtrip, monster-cam model, etc). No smoke tests for microapp lifecycle.

## Tasks

- [ ] Consolidate 17 existing test files, ensure all pass under `bun test`
- [ ] Add hero app smoke tests: open via API → describeState → captureText → close
- [ ] Install hyperfine, benchmark: boot time, `wibwob health` latency, typecheck time
- [ ] `bun run test` as CI-ready gate
- [ ] Stretch: node-pty TUI integration test for one hero app

## Acceptance

- `bun test` runs and passes (17+ tests)
- At least 7 hero app smoke tests
- Boot time benchmarked and recorded
- `bun run test` added to package.json scripts

## Autoresearch

Harness at `autoresearch/test-harness/`. Primary metric: test pass rate (higher is better).
