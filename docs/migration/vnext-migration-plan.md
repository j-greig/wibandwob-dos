# vNext Migration Plan (PR-1 to PR-2+)

## PR-1 (This Change)

1. Introduce C++ command registry skeleton.
2. Add IPC capability export and registry dispatch command.
3. Migrate API capability export and `/menu/command` dispatch to registry source.
4. Add contract/parity/snapshot-event tests at canonical paths.

## PR-2 (Next)

1. Expand registry coverage beyond migrated command subset.
2. Derive MCP tool declarations from capabilities export.
3. Add stronger parity checks for menu + IPC + API + MCP surfaces.
4. Add C++ `ctest` target coverage for registry behavior.

## PR-3 (Later)

1. Route remaining mutating operations through unified `exec_command(name,args,actor)`.
2. Add actor attribution and append-only event contract enforcement.
3. Strengthen snapshot import/export round-trip determinism tests.

## Rollback Strategy

- Revert registry integration files and restore previous hardcoded API dispatch/capabilities behavior.
- Keep existing non-migrated IPC commands available during rollout to reduce breakage risk.
