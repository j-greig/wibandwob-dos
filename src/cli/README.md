# wibwob — Unix CLI for WibWob-DOS

A thin, zero-dependency command-line interface to the WibWob-DOS desktop.
JSON to stdout, errors to stderr. Designed for `jq`, `xargs`, and shell scripts.

---

## How it works (technical note)

### Architecture: pure HTTP client, zero catalog import

`wibwob.ts` is ~150 lines of TypeScript. It does NOT import the command
catalog, the command registry, or any `src/core/` module. It is a pure
HTTP client that talks to the control API on port 8099.

```
command-catalog.ts        Static command definitions (id, label, group, flags)
       │
command-registry.ts       Runtime projection (adds dynamic/module commands)
       │
  ┌────┼────────┬──────────────┐
  │    │        │              │
 TUI  API    MCP tools     wibwob CLI
menus  (Hono)  (agent-tools)  (this file)
       │                       │
       └───── HTTP ────────────┘
```

### How parity is maintained

The CLI discovers commands at runtime by calling `GET /commands/list`.
It never hardcodes command IDs, never parses TypeScript, never reads
the catalog directly. When a new command is added to `command-catalog.ts`
(or a module registers one dynamically), the CLI picks it up automatically.

The only hardcoded surface in the CLI is the built-in subcommands:
`state`, `inspection`, `windows`, `commands`, `health`, `screenshot`. Everything else
dispatches through `POST /commands/run { id, args }`.

This means:
- Adding a command to the catalog → CLI gets it for free
- Removing a command → CLI stops seeing it
- Module commands registered at runtime → visible via `wibwob commands`
- No sync step, no code generation, no build process

### Flag parsing

Flags are `--key value` pairs. Values are auto-typed:
- Numbers: `--x 10` → `{ x: 10 }`
- Strings: `--name dark` → `{ name: "dark" }`
- Booleans: `--verbose` (no value) → `{ verbose: true }`
- JSON: `--config '{"a":1}'` → `{ config: { a: 1 } }`

No schema validation exists yet. The API validates server-side.
Future: Zod schemas on command definitions would enable client-side
validation and generated `--help` per command.

---

## Setup

The file has a `#!/usr/bin/env bun` shebang so it runs directly.
Add this to your `~/.zshrc`:

```bash
alias wibwob='/Users/james/Repos/wibandwob-dos/src/cli/wibwob.ts'
```

Then `source ~/.zshrc`. Now `wibwob` is a command.

## Usage

```bash
# Builtins
wibwob health                          # is the app running?
wibwob state                           # full desktop state (JSON)
wibwob inspection                      # runtime inspection snapshot (JSON)
wibwob windows                         # list open windows
wibwob commands                        # all available commands
wibwob commands --surface agent        # filter by control surface
wibwob screenshot                      # text screenshot of the desktop

# Run commands — three equivalent syntaxes
wibwob cmd editor.new                  # explicit: cmd <id>
wibwob editor.new                      # dot syntax: <domain>.<verb>
wibwob editor new                      # noun verb: <domain> <verb>

# Flags
wibwob window.move --id 3 --left 10 --top 5
wibwob theme.set --name flexoki-ink
wibwob figlet.open --text "HELLO" --font banner

# Positional window targeting
wibwob window 3 close                  # → window.close --id 3
wibwob window 3 move --left 10 --top 5 # → window.move --id 3 --left 10 --top 5

# Quiet mode: IDs only, one per line (for piping)
wibwob windows -q                      # window IDs
wibwob commands -q                     # command IDs
```

## Piping

The whole point is composability with standard Unix tools.

```bash
# Count open windows
wibwob windows | jq length

# Get all editor window IDs
wibwob windows | jq -r '.[] | select(.kind=="editor") | .id'

# Close all editors
wibwob windows -q | xargs -I{} wibwob window {} close

# Close windows of a specific kind
wibwob windows | jq -r '.[] | select(.kind=="art") | .id' | \
  xargs -I{} wibwob window {} close

# Find theme commands
wibwob commands -q | grep '^theme\.'

# Open 5 editors in a row
for i in $(seq 5); do wibwob editor.new; done

# Tile then screenshot
wibwob cmd window.tile && wibwob screenshot
```

Saved recipes also live in `scripts/`:

- `bash scripts/cli-runtime-triage.sh` — capture health, inspection, state, and text screenshot into one evidence folder
- `bash scripts/cli-batch-relayout.sh` — open a stable three-window scene and lay it out with one canonical batch op
- `bash scripts/cli-text-loop.sh mask` — capture the desktop as text, transform it, and feed it back in as a primer

These helper scripts are local-runtime-first. Override the target with
`WIBWOB_SCRIPT_API=http://127.0.0.1:8098` when you intentionally want a
different instance.

## Agent workflows

Agents (Claude, Codex, etc.) use `wibwob` instead of raw `curl` calls.

```bash
# Structured
wibwob cmd window.move --id 3 --left 10 --top 5

# Terse
wibwob window 3 move --left 10 --top 5

# Discovery
wibwob commands -q | grep window       # what can I do with windows?
wibwob inspection | jq '.snapshot.ui'  # is the desktop blocked?
wibwob state | jq '.focus'             # what's focused?
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `WW_API` | configured local control API | Base URL of the control API |
| `WIBWOB_API` | unset | Alias for `WW_API` |

```bash
# Talk to alt instance on port 8098
WW_API=http://127.0.0.1:8098 wibwob health
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (API unreachable, command not found, server error) |

Errors are JSON on stderr: `{"error": 404, "detail": {...}}`

## Generating documentation

The CLI auto-discovers commands, so its docs must be generated from
the live API too:

```bash
# Full command reference (markdown table)
wibwob commands | jq -r '
  ["| Command | Description |", "| --- | --- |"] +
  [.[] | "| `\(.id)` | \(.description // "-") |"]
  | .[]'

# Grouped by domain
wibwob commands | jq -r '
  group_by(.id | split(".")[0])[] |
  "\n## \(.[0].id | split(".")[0])\n" +
  ([.[] | "- `\(.id)` — \(.description // "-")"] | join("\n"))'

# Just the IDs
wibwob commands -q | sort

# Write a full reference file
wibwob commands | jq -r '
  "# wibwob command reference\n\nGenerated: \(now | todate)\n\n" +
  "| Command | Description | Surfaces |\n| --- | --- | --- |\n" +
  ([.[] | "| `\(.id)` | \(.description // "-") | \(.surfaces | join(", ")) |"] | join("\n"))
  ' > src/cli/COMMANDS.md
```

Because `wibwob commands` returns everything the API knows (including
dynamically registered module commands), generated docs are always
complete and current. No manual sync required.

## Name conflicts

`wibwob` has no PATH conflicts — no Homebrew formula, no common Unix
tool, no man page. Safe for alias use. If publishing to npm, use a
scoped name: `@wibwob/cli`.

## Test suite

Canonical live CLI parity gate:

```bash
bash scripts/ci-cli-test.sh
```
