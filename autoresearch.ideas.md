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

## F5: wibwob write (next up)

- `registerWriteHandler(fn)` SDK hook — one new method on MicroappHost
- `POST /windows/<id>/write` API endpoint — new route in control-api.ts
- `wibwob write <id>` CLI — reads stdin, POSTs to endpoint
- Figlet handler first (proof of concept), then journal/chatroom/terminal
- See scratch/write-seam-analysis.md for full audit
- See GH #127 for Plan 9 context

## Stretch: Plan 9 Direction

- `wibwob read <id>` alias for screenshot (symmetry with write)
- `wibwob plumb --from <id> --to <id>` — inter-window content routing (needs spec)
- Per-app content-type declarations for smart plumb routing
- `wibwob read 3 | wibwob write 7` as the canonical symbient pipe

## Future Features (different epic)

- **Auto-save interval** — periodic background save (every 5 min?) so orphan workspace is always recent even without SIGHUP
- **Workspace diff** — compare saved vs current desktop state
- **Process supervision** — launchd plist for auto-restart (overkill for dev tool)
