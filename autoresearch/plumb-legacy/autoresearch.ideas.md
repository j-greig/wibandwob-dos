# Autoresearch Ideas — E039 Instance Lifecycle

## ALL FEATURES COMPLETE ✅

- **F1** — Clean death (SIGHUP handler, socket/PID cleanup)
- **F2** — Microapp snapshots (figlet, contour, runtime-inspector)
- **F3** — Boot workspace (`--workspace` flag, orphan auto-detect)
- **F4** — `wibwob attach` (detect orphan, kill stale, relaunch with TTY)
- **F5** — `wibwob write/read` (figlet.write, terminal.write, fallback convention)
- **F6** — `wibwob plumb --from <id> --to <id>` (inter-window routing)
- **F7** — Self-maintaining CLI help (CLI_COMMANDS table)
- **F8** — `wibwob start/restart` (thin wrappers over scripts)

## Remaining Polish (minor, no autoresearch needed)

- **openFigletWindow in SnapshotRestoreActions** — still in interface, used by
  canvas-document.ts and agent-tools.ts. Bigger refactor to remove.
- **`wibwob workspace.save` / `workspace.load`** — replace curl in test harness

## Future Features (different epic)

- **Auto-save interval** — periodic background save (every 5 min?)
- **Workspace diff** — compare saved vs current desktop state
- **plumb.auto** — rule-based routing (content-type → appType matching)
- **Persistent wires** — event-driven source→sink connections for TouchLab
