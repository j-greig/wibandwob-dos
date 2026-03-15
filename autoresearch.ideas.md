# Autoresearch Ideas — E039 Instance Lifecycle + Write Pipe

## COMPLETE — F1-F4 ✅, F5 Core ✅

F1 Clean Death, F2 Microapp Snapshots, F3 Boot Workspace, F4 wibwob attach.
F5 wibwob write/read: figlet.write command, CLI with fallback convention
(write→send→create), pipe composition. All at 100/100.

Shipped COAT-aligned: no new endpoints, no new SDK methods. Write dispatches
through existing `/commands/run`. `wibwob read` aliases `screenshot`.

## F5 Remaining Stories

- **terminal.write** — send text to pty stdin. Needs microapp command +
  test in harness. The terminal microapp is in `microapps/terminal/`.
  Challenge: accessing the pty write stream from a command handler.

## Remaining Polish (won't move score — code quality)

- **wibwob start / wibwob restart** — replace scripts with CLI subcommands
- **wibwob workspace.save / workspace.load** — replace curl in test harness
- **openFigletWindow in SnapshotRestoreActions** — still in interface, used by
  canvas-document.ts and agent-tools.ts. Bigger refactor to remove.

## F6: Plumb (future, needs own harness)

Thin routing over write commands. `wibwob plumb --from 3 --to 7` = 
`wibwob read 3 | wibwob write 7`. Spec: e039-f06-plumb.md.

## Future Features (different epic)

- **Auto-save interval** — periodic background save (every 5 min?)
- **Workspace diff** — compare saved vs current desktop state
