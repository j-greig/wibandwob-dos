# Unix Control v2 — Ideas

Ideas not yet backlog items, or elaborations on existing items.

- Streaming JSON output mode for wibwob (ndjson) — useful beyond just `watch`
- `wibwob batch` subcommand: read commands from stdin, execute sequentially, return array
- `wibwob diff` — snapshot state, run commands, diff state (useful for testing side effects)
- Auto-generated COMMANDS.md from catalog + Zod schemas (markdown reference doc)
- `wibwob --format=table` for human-readable tabular output (windows list, commands list)
- Schema-driven fuzzing: generate random valid args from Zod schemas, check nothing crashes
- `wibwob alias` — user-defined command shortcuts stored in ~/.wibwobrc
- OpenAPI spec generation from Zod schemas (replace hand-maintained openapi.json)
- Fish shell completion support alongside zsh/bash
- `wibwob doctor` — diagnose common issues (API down, port conflict, stale PID)
