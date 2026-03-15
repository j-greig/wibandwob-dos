# F7 Self-Maintaining CLI Help — Autoresearch Brief

## Objective

Replace the hardcoded `usage()` string + `switch` dispatch in
`src/cli/wibwob.ts` with a single `CLI_COMMANDS` table that drives
both dispatch and help output. One array, two projections.

## Primary Metric

`help_score` — sum of pass/fail behaviour checks (0–100).

Higher is better. Each check is binary.

### Scoring Breakdown

| Feature | Points | Checks |
|---------|--------|--------|
| Command table exists | 10 | CLI_COMMANDS array in wibwob.ts (5), CliCommand interface (5) |
| Dispatch works | 25 | state (5), health (5), write (5), read/screenshot (5), attach (5) |
| Help is generated | 20 | usage() loops CLI_COMMANDS (5), all table entries in help output (5), completions in help (5), no hardcoded subcommand lines (5) |
| Aliases work | 10 | `map` dispatches to minimap (5), `read` dispatches to screenshot (5) |
| Default fallthrough | 15 | dot-syntax `theme.set` works (5), noun-verb `window close` works (5), `cmd <id>` works (5) |
| Parity | 20 | help output has same subcommands as before (10), all existing subcommands still work (10) |

## Constraints

- `bun run typecheck` must pass
- Offline help (no running instance needed)
- All existing subcommands must still work identically
- Dot-syntax / noun-verb / window targeting stay in default block
- `wibwob help` output must include every registered subcommand

## Files in Scope

- `src/cli/wibwob.ts` — the only file that changes

## Off Limits

- New API endpoints
- Changes to command catalog or control API
- Auto-discovering API endpoints as CLI subcommands
