# e053 Next Steps — Context for Agent

## Completed (commit 7ecd6147)

- **DATA_ROOT** with env/project/global precedence
- **Two-level identity**: `instanceId` (8-char) + `instanceDisplayId` (3-char)
- Instance-scoped paths under `DATA_ROOT/instances/{instanceId}/`
- Migrated `world-chat-service.ts` to new paths
- 11 unit tests passing

## Critical Guidance

> **Do not declare this area complete.** The following corrections must be applied:

1. **world-chat-service.ts is a temporary stopgap** - Do not let leaf services guess between legacy and new paths. Centralize resolved instance-scoped paths in runtime/application state.

2. **Keep migrating high-value consumers** - Priority:
   - `state-service.ts` → use `instanceStatePath`
   - `cli/wibwob.ts` → use `instanceRoot` for socket/pid discovery

3. **Reclassify packaging as improved but not complete** - Architecture is more compatible now, but deploy/runtime flows still need follow-through.

4. **Strengthen tests** - Add real tests for:
   - `resolveDataRoot()` with different env scenarios
   - `resolveInstancePaths()` 
   - `createRuntimeNode()` dir creation
   - Invalid instance ID handling
   - Unwritable directory errors

5. **Legacy constants are temporary** - Do not expand use. Prefer new instance-scoped paths everywhere.

6. **instanceDisplayId is UI-only** - Should be derived from instanceId, not independently authored.

## Immediate Next Priority

1. **Migrate state-service.ts** to use `instanceStatePath` instead of legacy `STATE_PATH`
2. **Migrate cli/wibwob.ts** to use instance-scoped paths for socket/pid discovery

## Deferred (Lower Priority)

- Deploy script updates (Docker, docker-compose)
- Integration tests for multi-instance isolation
- Full legacy path removal

## Quick Start for Agent

```bash
# Run tests
bun test src/tests/unit/config-runtime.test.ts

# Check current state
wibwob health

# Verify paths in API
curl http://127.0.0.1:8099/config | jq .
```

## Key Files Changed

- `src/core/config.ts` — DATA_ROOT resolution, ensureDirectoryExists
- `src/runtime/runtime-node.ts` — instance-scoped paths
- `src/app.ts` — identity resolution
- `.planning/epics/e053-external-config-packaging/MIGRATION.md` — migration table
