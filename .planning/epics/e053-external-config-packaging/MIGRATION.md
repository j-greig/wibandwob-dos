# e053 Runtime Path Migration Table

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
| `SCRATCH_BASE` | `<APP_ROOT>/scratch/` | ⚠️ Deprecated, backward compat only |
| `WORKSPACES_DIR` | `<SCRATCH_BASE>/workspaces/` | ⚠️ Deprecated, still used |
| `LOGS_DIR` | `<SCRATCH_BASE>/logs/` | ⚠️ Deprecated, still used |
| `CAPTURES_DIR` | `<SCRATCH_BASE>/captures/` | ⚠️ Deprecated, still used |
| `STATE_PATH` | `<SCRATCH_BASE>/app-state.json` | ⚠️ Deprecated, still used |

## Consumer Migration Status

| File | Old Path | New Path | Status |
|------|----------|----------|--------|
| `runtime-node.ts` | SCRATCH_BASE dirs | instanceRoot dirs | ✅ Migrated |
| `world-chat-service.ts` | LOGS_DIR | instanceLogsDir | 🔄 Migrated (lazy) |
| `state-service.ts` | STATE_PATH | instanceStatePath | ⏳ Pending |
| `app-controller.ts` | SCRATCH_BASE | instanceRoot | ⏳ Pending |
| `cli/wibwob.ts` | SCRATCH_BASE | instanceRoot | ⏳ Pending |
| `control-api.ts` | Various | instanceRoot | ⏳ Pending |

## Priority Migration Order

1. **High**: state-service.ts (state persistence)
2. **Medium**: cli/wibwob.ts (process discovery)
3. **Low**: control-api.ts (monitoring)

## Notes

- Legacy paths are still exported for backward compatibility
- New code should prefer instance-scoped paths
- Migration should happen incrementally to avoid breaking changes
- After full migration, legacy constants can be removed
