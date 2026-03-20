# E053 Part 2 — Execution Checklist (Next Agent)

Status: in-progress
Owner: NEXT_AGENT

## 0) Baseline + reconciliation
- [x] Read latest e053 commits (`f4c1cf7a`, `7ecd6147`, `5cf72b87`)
- [x] Reconcile claims vs code in `MIGRATION.md` / `NEXT_AGENT.md`
- [x] Mark stale claims explicitly (do not leave ambiguous status)

## 1) Runtime path canon (single owner)
- [x] Add canonical runtime paths for control socket artifacts (instance-scoped)
- [-] Stop leaf services from path guessing (`world-chat-service.ts`) — deferred to parking lot (pre-beta, non-critical)
- [~] Ensure all path consumers read from runtime/application state only (legacy compatibility aliases still present)

## 2) High-priority consumer migrations
- [x] `src/cli/wibwob.ts`
  - [x] Instance discovery supports instance-scoped layout
  - [x] `--instance/-i` resolves by id/label/display-id deterministically
  - [x] Keep temporary legacy fallback (explicitly marked)
  - [x] Finish migration of `attach`/`clean` internals to canonical instance paths
- [x] `src/services/control-api.ts`
  - [x] Register socket/pid sidecars in instance-scoped paths
  - [x] Emit discovery metadata for CLI targeting
  - [x] Preserve temporary legacy compatibility path (time-boxed)
- [x] `src/core/app-controller.ts`
  - [x] stale socket cleanup supports instance-scoped artifacts first
  - [x] legacy scratch cleanup retained as compatibility path only

## 3) Test hardening (required)
- [x] `resolveDataRoot()` precedence matrix (env / project mode / existing .wibwob / global fallback)
- [x] `resolveInstancePaths()` exact layout assertions
- [x] `ensureDirectoryExists()` error mapping (`EACCES`, `EROFS`)
- [ ] `createRuntimeNode()` directory creation + exported path correctness
- [ ] invalid instance-id handling test coverage (runtime entrypoint validation)

## 4) Planning/doc sync
- [x] Update `MIGRATION.md` with exact per-file status + compatibility notes
- [x] Update epic brief progress section in `e053-external-config-packaging.md`
- [ ] Move superseded docs to sibling `done/` folder only when replaced by newer source-of-truth docs

## 5) Verification gates
- [x] `bun run typecheck`
- [x] targeted unit tests for e053 paths + runtime node
- [~] CLI smoke: `wibwob health`, `wibwob instances`, `wibwob -i <target> health`
  - verified in Docker/SSH smoke harness (`scripts/devops/docker-vps-smoke.sh`)
  - remaining issue: compatibility alias can still surface duplicate instance rows in `wibwob instances` during migration window
- [ ] Manual multi-instance sanity (two instances, no path collisions)

## 6) Closeout criteria
- [ ] No new code reads/writes mutable runtime state via hardcoded `scratch/*` unless explicitly marked legacy
- [ ] `MIGRATION.md` reflects reality (no optimistic "done" language)
- [ ] Remaining legacy items listed as bounded follow-ups (owner + next action)
