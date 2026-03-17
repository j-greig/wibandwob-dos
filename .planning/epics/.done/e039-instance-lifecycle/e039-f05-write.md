# F5: `wibwob write` — Text Pipe Into Windows

**Epic:** E039 Instance Lifecycle
**Status:** done
**Depends on:** F1-F4 (shipped)
**GitHub:** #127 (Plan 9 analysis)

## Goal

Push text content into a live window from stdin. The Unix write side
to complement the existing read side (`wibwob screenshot <id>`).

Inspired by Plan 9's Rio (window-as-a-file).

## COAT Design — No New Endpoint, No New Seam

Write goes through the **existing command seam**. Each writable microapp
registers a `write` command (e.g. `microapp.wibwob.figlet.write`). The CLI
resolves window ID → appType from `/state`, then dispatches
`<appType>.write --text <stdin> --windowId <id>`.

```bash
echo "HELLO" | wibwob write 3
# resolves: window 3 → appType wibwob.figlet
# dispatches: microapp.wibwob.figlet.write --text HELLO --windowId 3
```

No `POST /windows/<id>/write`. No `registerWriteHandler`. Just a command
convention + CLI sugar. COAT: one dispatch path.

## Write Suitability

| App | Write? | Operation | Existing command? |
|-----|--------|-----------|-------------------|
| figlet-banner | ✅ | Set banner text | ❌ needs `figlet.write` |
| terminal | ✅ | Type into pty | ❌ needs `terminal.write` |
| text-editor | ✅ | Insert at cursor | ❌ needs `editor.write` |
| journal | ✅ | Create entry | `journal.create --body X` ✅ |
| chatroom | ✅ | Send message | `chatroom.send --message X` ✅ |
| workspace-beacon | ✅ | Set note | `beacon.set-note --note X` ✅ |
| wibwobworld | ✅ | Send chat | `world.chat --message X` ✅ |
| contour-studio | ❌ | Generative — read only | — |
| runtime-inspector | ❌ | Dashboard — read only | — |
| plasma | ❌ | Generative — read only | — |
| command-lab | ❌ | Command runner — read only | — |
| generative-art | ❌ | Generative — read only | — |
| tr808 | ⚠️ | Pattern data, not text | — |

4 apps already writable via existing commands. 3 need a new `write` command.
6 are read-only. Full audit: `scratch/write-seam-analysis.md`.

## Fallback Convention

The CLI tries commands in order for the resolved appType:
1. `<appType>.write` (canonical)
2. `<appType>.send` (chatroom, world)
3. `<appType>.create` (journal)

This means journal and chatroom work without adding a `write` command —
the CLI finds the existing equivalent.

## Stories

- [x] S1: `figlet.write` command — update live banner text by windowId
- [x] S2: `terminal.write` command — send text to pty stdin
- [x] S3: `wibwob write <id>` CLI — read stdin, resolve appType, dispatch
- [x] S4: Verify: `echo "HELLO" | wibwob write 3` updates figlet window
- [x] S5: Verify: `wibwob read 3 | wibwob write 7` pipes between windows

## What Write Is NOT

- Not a new API endpoint — uses existing `/commands/run`
- Not a new SDK method — uses existing `registerCommand`
- Not for output-only apps — they simply have no `write` command
- Not a replacement for per-app commands — those are richer (args, fields)

## Stretch

- `wibwob read <id>` alias for `wibwob screenshot <id>` (symmetry)
- `wibwob read 3 | wibwob write 7` as the canonical symbient pipe
- → **[e039-f06-plumb.md](e039-f06-plumb.md)** for inter-window routing (depends on F5)

## Key Files

| File | What changes |
|------|-------------|
| `src/cli/wibwob.ts` | `write` subcommand: read stdin, resolve appType, dispatch |
| `microapps/figlet-banner/index.ts` | `write` command: update text on existing window |
| `microapps/terminal/index.ts` | `write` command: send to pty stdin |
