# Autoresearch Ideas — Unix Control CLI Parity

## Done / Stale
- DONE: positional window ID (`wibwob window 3 close`)
- DONE: `-q/--quiet` mode
- DONE: screenshot subcommand
- DONE: renamed `ww` → `wibwob` (zsh alias conflict)
- DONE: 53/53 test suite, full parity
- DONE: README rewrite
- DONE: v2 backlog created (Zod, CI, tab completion)
- DONE: LEXICON.md (was LINGO.md)
- STALE: fabricated benchmark citations — removed in rigour pass

## Live Ideas
- Zod schemas for all commands (v2 backlog item, drives validation + help + tab completion)
- Per-command `--help` generated from schema metadata
- Tab/zsh/fish completion from command catalog
- `wibwob batch` — read commands from stdin, execute sequentially, return array
- `wibwob diff` — snapshot state, run commands, diff state (side-effect testing)
- `wibwob doctor` — diagnose common issues (API down, port conflict, stale PID)
- `wibwob watch` with streaming ndjson output
- Dogfood `wibwob` in the test suite itself (replace raw curl, keep one curl for HTTP parity proof)
- Multi-instance targeting (`--instance alt` or `--port 8098`)
- OpenAPI spec generation from Zod schemas
- Auto-generated COMMANDS.md from catalog + schemas
