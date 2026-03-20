# Remit constraints for migration loop

Derived from:
- `.agents/guides/microapp/*`
- `.agents/guides/shell/architecture.md`

## Must hold

1. Microapps use SDK surface (`src/services/microapp-sdk.ts`) instead of reaching into core/window internals.
2. Every migrated microapp remains command-visible and API-visible (COAT).
3. Window semantics are exposed (`describeState`, `captureText`, cleanup/restyle hooks).
4. Reusable primitives discovered during migration move toward `src/sdk/` with docs updated.
5. No parallel semantic owners: extend canonical owner files (registry/catalog/sdk/docs), do not fork behavior.

## Programmatic gates in this skill

- `scripts/check-microapp-imports.sh`
- `scripts/check-sdk-doc-sync.sh`
- `scripts/run-gates.sh`
- `scripts/stop-check.py`
