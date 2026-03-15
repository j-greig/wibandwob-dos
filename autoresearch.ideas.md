# Autoresearch Ideas — E039 Instance Lifecycle

## COMPLETE — 100/100 ✅

F1 Clean Death, F2 Microapp Snapshots, F3 Boot Workspace, F4 wibwob attach.
COAT cleanup done: host-side figlet handler removed, legacy remaps added,
figlet-banner/contour-studio removed from built-in type unions.

## Remaining Polish (won't move the score — code quality)

- **wibwob start / wibwob restart subcommands** — replace `ensure-running.sh` and `restart.sh` script aliases. Aligns with "wibwob is the command surface" canon
- **wibwob workspace.save / workspace.load subcommands** — replace the 2 remaining curl calls in test harness
- **openFigletWindow in SnapshotRestoreActions** — still in interface, still used by `canvas-document.ts` and `agent-tools.ts`. Bigger refactor to remove
- **Multiple orphan workspaces** — what if main and zuk both orphan? Currently only detects `orphan-<label>.json` — works fine because label is per-instance

## Future Features (different epic)

- **Auto-save interval** — periodic background save (every 5 min?) so orphan workspace is always recent even without SIGHUP
- **Workspace diff** — compare saved vs current desktop state
- **Process supervision** — launchd plist for auto-restart (overkill for dev tool)
