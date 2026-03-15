# F5 Write Pipe — Autoresearch Brief

## Objective

Build `wibwob write <id>` — push text into a live window from stdin.
The Unix write side to complement `wibwob screenshot <id>` (read side).
COAT-aligned: no new endpoints, no new SDK methods, just a command
convention + CLI sugar.

## Primary Metric

`write_score` — sum of pass/fail behaviour checks (0–100).

Higher is better. Each check is binary.

### Scoring Breakdown

| Feature | Points | Checks |
|---------|--------|--------|
| CLI infrastructure | 10 | `wibwob write` subcommand exists (5), resolves appType + dispatches (5) |
| Figlet write | 25 | `figlet.write` command exists (5), updates live banner text (10), original window preserved not new (10) |
| Fallback convention | 20 | journal falls back to `create` (10), chatroom falls back to `send` (10) |
| Read alias | 10 | `wibwob read <id>` works as alias for screenshot (10) |
| Terminal write | 15 | `terminal.write` command exists (5), dispatches ok (5), text received in pty (5) |
| Pipe composition | 20 | `echo X \| wibwob write <id>` works (10), `wibwob read <id> \| wibwob write <id>` works (10) |

## Canon

`wibwob` is the command surface. `source ~/.wibwob` for the function.
No curl, no `ww-*` aliases. If a subcommand is missing, add it to
`src/cli/wibwob.ts` first.

## How to Run

```bash
bash autoresearch/write-pipe/autoresearch.sh
```

## Test Strategy

Behavioural tests like E039. Set up state, act, verify via CLI.

```
  start instance
       │
       ├── open figlet with text "BEFORE"
       ├── echo "AFTER" | wibwob write <figlet-id>
       ├── wibwob screenshot <figlet-id> → should contain "AFTER"
       │
       ├── open journal
       ├── echo "test entry" | wibwob write <journal-id>
       ├── wibwob cmd journal.list → should have new entry
       │
       ├── wibwob read <figlet-id> | wibwob write <journal-id>
       ├── journal should have figlet text as entry
       │
       └── score = passed / total × 100
```

## Files in Scope

- `src/cli/wibwob.ts` — `write` and `read` subcommands
- `microapps/figlet-banner/index.ts` — `write` command (update live window)
- `microapps/terminal/index.ts` — `write` command (future, stretch)

## Off Limits

- New API endpoints (use `/commands/run`)
- New SDK methods (use `registerCommand`)
- Plumb/wires (F6, separate feature)
- Output-only apps (contour, plasma, inspector)

## Constraints

- `bun run typecheck` must pass
- `wibwob health` must respond within 5s
- No new npm dependencies
- Write must go through existing command dispatch

## Iteration Order

1. `wibwob read <id>` alias (trivial, enables pipe testing)
2. `figlet.write` command in microapp (proof of concept)
3. `wibwob write <id>` CLI with stdin reading + appType resolution
4. Fallback convention (try write → send → create)
5. Pipe composition verification
