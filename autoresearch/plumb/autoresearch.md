# F6 Plumb — Autoresearch Brief

## Objective

Build `wibwob plumb --from <id> --to <id>` — route text from one window
to another in a single command. CLI-only orchestration over existing
read + write primitives. No new endpoints, no catalog command, no service.

## Primary Metric

`plumb_score` — sum of pass/fail behaviour checks (0–100).

Higher is better. Each check is binary.

### Scoring Breakdown

| Feature | Points | Checks |
|---------|--------|--------|
| CLI entry | 15 | plumb in CLI_COMMANDS (5), shows in help (5), no new API endpoints (5) |
| Cross-app routing | 30 | figlet→figlet text transfers (15), contour→figlet cross-appType (15) |
| Error handling | 25 | missing flags shows usage (5), invalid --from errors (5), invalid --to errors (5), non-writable dest errors cleanly (10) |
| Edge cases | 15 | empty source passes through (5), same window --from and --to works (5), source is read-only app (5) |
| Typecheck | 15 | bun run typecheck passes (15) |

## Design (from ops review)

**CLI-only subcommand.** No catalog command. The handler:
1. GET /state → find both windows
2. GET /screenshot/text?id=from → capture source text
3. Resolve dest appType → dispatch write command via /commands/run

Reuses existing `cmdScreenshot` and `cmdWrite` patterns.

**Killed from MVP:** `echo | wibwob plumb --to` (just use `wibwob write`),
rule-based routing (`plumb.auto`), catalog command (`plumb.send`).

## Files in Scope

- `src/cli/wibwob.ts` — plumb subcommand + CLI_COMMANDS entry
