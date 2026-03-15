# F6: `wibwob plumb` — Inter-Window Routing

**Epic:** E039 Instance Lifecycle
**Status:** done
**Depends on:** F5 (write)
**GitHub:** #127 (Plan 9 analysis)
**Reviewed by:** ops lens — original spec failed COAT test, rewritten.

## Goal

Route text from one window to another. Plan 9's plumber for the symbient
desktop. One window's output becomes another window's input.

```bash
wibwob plumb --from 3 --to 7         # contour ASCII → figlet text
echo "HELLO" | wibwob plumb --to 7   # stdin → window
wibwob read 3 | wibwob write 7       # same thing, longer
```

## COAT Design — No New Seam

**The ops review was right:** the original spec invented a fifth seam
(PlumbService, PlumbPort, PlumbMessage, 6 new endpoints, new SDK
namespace). F5 proved you can pipe text into windows through the existing
command seam. Plumb should be a **routing layer over write commands**,
not a parallel universe.

A plumb is: read window A (`captureText`) → write window B (`<appType>.write`).
Both primitives already exist after F5. Plumb is CLI sugar + optional rules.

**No new service.** No new endpoints. No new SDK method.
Two new catalog commands at most. One CLI subcommand.

## How It Works

```
wibwob plumb --from 3 --to 7

1. CLI calls GET /state → finds window 3 and window 7
2. CLI calls GET /screenshot/text?id=3 → gets window 3's text
3. CLI resolves window 7's appType (e.g. wibwob.figlet)
4. CLI calls POST /commands/run → dispatches wibwob.figlet.write
   with --text <captured> --windowId 7

That's it. Three existing endpoints. Zero new ones.
```

## Commands (catalog, not new endpoints)

| Command | What | Implementation |
|---------|------|---------------|
| `plumb.send` | Read from window A, write to window B | Thin orchestration over screenshot + write |
| `plumb.auto` | Read from window A, route by rules | Future — pattern match on content type |

Both dispatch through `/commands/run`. The command handler calls
existing read/write primitives internally.

## CLI

```bash
wibwob plumb --from 3 --to 7              # explicit routing
wibwob plumb --from 3                     # route by rules (future)
echo "text" | wibwob plumb --to 7         # stdin as source
```

`wibwob plumb --from 3 --to 7` is sugar for:
```bash
wibwob read 3 | wibwob write 7
```

The value of `plumb` over the pipe is: (a) one command instead of two,
(b) future rule-based routing without explicit `--to`.

## Rules (future, not MVP)

Rules are data, evaluated by the `plumb.auto` command handler:

```typescript
// Evaluated in order, first match wins
const rules = [
  { match: /^\/.*\.\w+:\d+$/, dst: "editor" },    // file:line → editor
  { match: /^https?:\/\//, dst: "web-reader" },      // URL → browser
];
```

Rules route by **appType**, not window ID. The command handler finds
the first open window of that appType, or opens one.

Rules are a separate slice. MVP doesn't need them.

## What About Wires (Persistent Connections)?

The original spec had `wibwob wire 3:gen 7:mix` for persistent
connections (e.g. TouchLab patching). This needs:
- A wire registry (which window feeds which)
- Event-driven updates (source changes → sink updates)
- Cleanup on window close

This is real infrastructure and **NOT part of F6 MVP**. Park it.
If wires are needed, they're a separate feature (F7) that builds
on plumb.send.

## Stories (MVP — 2 slices)

- [-] S1: ~~`plumb.send` catalog command~~ — killed per ops review. CLI-only.
- [x] S2: `wibwob plumb --from <id> --to <id>` CLI subcommand
- [x] S3: Verify: cross-app routing (contour → figlet), error handling, edge cases

## Non-Goals

- Persistent wires (future F7)
- PlumbService / PlumbPort / PlumbMessage types (killed — unnecessary)
- New API endpoints (use /commands/run)
- New SDK namespace (use registerCommand)
- TouchLab integration (future, after wires)
- TUI keystroke (future, after rules)
- Content-type routing (future, with rules)

## Key Files

| File | What changes |
|------|-------------|
| `src/core/command-catalog.ts` | `plumb.send` command definition |
| `src/core/app-controller.ts` | `plumb.send` handler (read + write orchestration) |
| `src/cli/wibwob.ts` | `plumb` subcommand |
