# Autoresearch Ideas — E039

## COMPLETE ✅

- **F1-F4** — Instance lifecycle (clean death, snapshots, boot workspace, attach)
- **F5** — `wibwob write/read` (figlet.write, terminal.write, fallback convention, pipe composition)
- **F7** — Self-maintaining CLI help (CLI_COMMANDS table, auto-generated usage)
- **F8** — `wibwob start/restart` (thin wrappers over scripts, idempotent start)

## NEXT: F6 Plumb

Thin routing over write commands. `wibwob plumb --from 3 --to 7` =
read captureText from source, dispatch appType.write on destination.
No new service, no new endpoints, no new SDK — just a catalog command
+ CLI sugar. Spec: e039-f06-plumb.md.

## Remaining Polish

- **openFigletWindow in SnapshotRestoreActions** — still in interface, used by
  canvas-document.ts and agent-tools.ts. Bigger refactor to remove.

## Future Features (different epic)

- **Auto-save interval** — periodic background save (every 5 min?)
- **Workspace diff** — compare saved vs current desktop state
