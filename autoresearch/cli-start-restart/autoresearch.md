# F8: `wibwob start` / `wibwob restart` — CLI Subcommands

## Objective

Replace `bash scripts/ensure-running.sh` and `bash scripts/restart.sh`
with proper `wibwob start` and `wibwob restart` CLI subcommands. These
are the last two script-only operations — everything else is already
a `wibwob` subcommand.

Key difference from other subcommands: these work **without** a running
instance (they start/restart the app). They're process management, not
API calls.

## Primary Metric

`start_score` — sum of pass/fail behaviour checks (0–100).

Higher is better. Each check is binary.

### Scoring Breakdown

| Feature | Points | Checks |
|---------|--------|--------|
| CLI table entries | 10 | `start` in CLI_COMMANDS (5), `restart` in CLI_COMMANDS (5) |
| Help shows them | 10 | `wibwob help` includes start (5), includes restart (5) |
| Start works | 25 | `wibwob start` launches app (10), health responds after (10), idempotent if already running (5) |
| Restart works | 25 | `wibwob restart` restarts (10), new PID after restart (10), health responds after (5) |
| Scripts still work | 10 | `ensure-running.sh` still works (5), `restart.sh` still works (5) |
| Process cleanup | 20 | PID file written (5), socket exists after start (5), clean shutdown on restart (10) |

## Design

`wibwob start` and `wibwob restart` are thin wrappers that shell out to
the existing scripts. The scripts are battle-tested (process-manager,
tmux modes, PID handling). The CLI just makes them discoverable.

```typescript
// In CLI_COMMANDS table:
{ name: "start", desc: "Start instance (idempotent)", fn: () => cmdStart() },
{ name: "restart", desc: "Stop and restart instance", fn: () => cmdRestart() },
```

The `cmdStart()` function:
1. Check if already running via health check
2. If running: print status, exit 0
3. If not: exec `scripts/ensure-running.sh` with stdio inherit

The `cmdRestart()` function:
1. Exec `scripts/restart.sh` with stdio inherit

Both pass through `--instance` flag as appropriate.

## Constraints

- `bun run typecheck` must pass
- Scripts remain the implementation — CLI is the surface
- Must work when no instance is running (can't call API)
- Must appear in `wibwob help` (via CLI_COMMANDS table)

## Files in Scope

- `src/cli/wibwob.ts` — add start/restart to CLI_COMMANDS + handler functions
