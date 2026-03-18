# e053 Runtime Path Migration Table

Last reconciled: 2026-03-18

## Canonical Paths (New)

| Constant | Path | Status |
|---------|------|--------|
| `DATA_ROOT` | `<resolved>/.wibwob/` | ✅ Implemented |
| `instanceRoot` | `<DATA_ROOT>/instances/{instanceId}/` | ✅ Implemented |
| `instanceWorkspacesDir` | `<instanceRoot>/workspaces/` | ✅ Implemented |
| `instanceExportsDir` | `<instanceRoot>/exports/` | ✅ Implemented |
| `instanceLogsDir` | `<instanceRoot>/logs/` | ✅ Implemented |
| `instanceStatePath` | `<instanceRoot>/state.json` | ✅ Implemented |
| `instancePidPath` | `<instanceRoot>/wibwob.pid` | ✅ Implemented |

## Legacy Compatibility Paths (Still Present)

| Constant | Path | Migration Status |
|----------|------|------------------|
| `SCRATCH_BASE` | `<APP_ROOT>/scratch/` | ⚠️ Deprecated, compatibility only |
| `WORKSPACES_DIR` | `<SCRATCH_BASE>/workspaces/` | ⚠️ Deprecated export remains |
| `LOGS_DIR` | `<SCRATCH_BASE>/logs/` | ⚠️ Deprecated export remains |
| `CAPTURES_DIR` | `<SCRATCH_BASE>/captures/` | ⚠️ Deprecated export remains |
| `STATE_PATH` | `<SCRATCH_BASE>/app-state.json` | ⚠️ Deprecated export remains |

## Consumer Migration Status (code-reconciled)

| File | Status | Notes |
|------|--------|-------|
| `src/runtime/runtime-node.ts` | ✅ Migrated | Emits instance-scoped dirs + file paths from `resolveInstancePaths()` |
| `src/app.ts` | ✅ Migrated | Creates `RuntimeNode` using canonical id/display-id model |
| `src/services/state-service.ts` | ✅ Migrated | Persists state via `runtimeNode.statePath` (instance-scoped) |
| `src/services/world-chat-service.ts` | 💤 Parked | Uses path-guessing heuristic; deferred to parking lot (pre-beta, non-critical for e053 core) |
| `src/services/control-api.ts` | ✅ Migrated (compat retained) | Canonical socket/pid/discovery in instance root; temporary legacy alias under scratch |
| `src/cli/wibwob.ts` | ✅ Migrated (compat retained) | Discovery + attach + clean handle canonical layout first, legacy fallback second |
| `src/core/app-controller.ts` | ✅ Migrated (compat retained) | stale-socket cleanup scans instance-scoped first, then legacy fallback |

## Tickoff Sequence (Part 2)

- [x] Reconcile migration table with current code reality
- [x] Mark `state-service.ts` as migrated (previous table was stale)
- [x] Migrate `cli/wibwob.ts` to instance-scoped discovery (with temporary legacy fallback)
- [x] Migrate `control-api.ts` socket/pid sidecars to instance-scoped artifacts
- [x] Migrate `app-controller.ts` stale-socket cleanup to instance-scoped artifacts (legacy fallback retained)
- [-] Remove `world-chat-service.ts` path guessing; inject canonical log path from runtime/app state (parked)
- [ ] Harden tests for config/runtime-path resolution and error cases

## Notes

- `ensureDirectoryExists()` now handles `EEXIST` with explicit "path exists but is not directory" error messaging. This prevented startup confusion when `~/.wibwob` is a file.

## Current source of truth

- Execution checklist: `PART2_EXECUTION_CHECKLIST.md`
- Guardrails/context: `NEXT_AGENT.md`
- Epic spec: `e053-external-config-packaging.md`
