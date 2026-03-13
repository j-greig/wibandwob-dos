# wibwob — Unix CLI for WibWob-DOS

A thin, zero-dependency command-line interface to the WibWob-DOS desktop.
JSON to stdout, errors to stderr. Designed for `jq`, `xargs`, and shell scripts.

---

## How it works (technical note)

### Architecture: pure HTTP client, zero catalog import

`wibwob.ts` is ~150 lines of TypeScript. It does NOT import the command catalog,
the command registry, or any `src/core/` module. It is a pure HTTP client
that talks to the control API on port 8099.

```
command-catalog.ts        Static command definitions (id, label, group, flags)
       │
command-registry.ts       Runtime projection (adds dynamic/module commands)
       │
  ┌────┼────────┬──────────────┐
  │    │        │              │
 TUI  API    MCP tools      ww CLI
menus  (Hono)  (agent-tools)  (this file)
       │                       │
       └───── HTTP ────────────┘
```

### How parity is maintained

The CLI discovers commands at runtime by calling `GET /commands/list`.
It never hardcodes command IDs, never parses TypeScript, never reads
the catalog directly. When a new command is added to `command-catalog.ts`
(or a module registers one dynamically), the CLI picks it up automatically.

The only hardcoded surface in the CLI is the five built-in subcommands:
`state`, `windows`, `commands`, `health`, `screenshot`. Everything else
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

## Usage

```bash
# Builtins
ww health                          # API health check
ww state                           # full desktop state (JSON)
wibwob windows                         # list open windows
wibwob commands                        # list all available commands
ww screenshot                      # text screenshot of the desktop

# Run commands — three equivalent syntaxes
ww cmd editor.new                  # explicit: cmd <id>
ww editor.new                      # dot syntax: <domain>.<verb>
ww editor new                      # noun verb: <domain> <verb>

# Flags
ww window.move --id 3 --x 10 --y 5
ww theme.set --name flexoki-ink
ww figlet.open --text "HELLO" --font banner

# Positional window targeting
ww window 3 close                  # → window.close --id 3
ww window 3 move --x 10 --y 5     # → window.move --id 3 --x 10 --y 5

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
wibwob windows -q | xargs -I{} ww window {} close

# Close all windows of a specific kind
wibwob windows | jq -r '.[] | select(.kind=="art") | .id' | \
  xargs -I{} ww window {} close

# List commands matching a pattern
wibwob commands -q | grep '^theme\.'

# Open 5 editors in a row
for i in $(seq 5); do ww editor.new; done

# Tile then screenshot
ww cmd window.tile && ww screenshot
```

## Agent workflows

Agents (Claude, Codex, etc.) use `wibwob` instead of raw `curl` calls.
The three syntax styles cover different agent preferences:

```bash
# Structured (Claude tends toward this)
ww cmd window.move --id 3 --x 10 --y 5

# Terse (faster for scripts)
ww window 3 move --x 10 --y 5

# Discovery
wibwob commands -q | grep window       # what can I do with windows?
ww state | jq '.focus'             # what's focused?
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `WW_API` | `http://127.0.0.1:8099` | Base URL of the control API |

```bash
# Talk to alt instance on port 8098
WW_API=http://127.0.0.1:8098 ww health
```

## Running

```bash
# Via bun directly
bun run src/cli/wibwob.ts health

# Via package.json script
bun run wibwob health

# Make it a shell alias (add to .zshrc)
alias wibwob='bun run /path/to/wibandwob-dos/src/cli/wibwob.ts'
```

### Name conflicts

`wibwob` has no PATH conflicts — no Homebrew formula, no common Unix tool,
no man page. Package registries have squatted names (npm: abandoned
promise lib, PyPI: Python builtins wrapper, crates.io: minimal) but
none install a `wibwob` binary. Safe for local alias use.

If publishing to npm, use a scoped name: `@wibwob/cli` or `wibwob-cli`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (API unreachable, command not found, server error) |

Errors are JSON on stderr: `{"error": 404, "detail": {...}}`

## Generating documentation

The CLI is auto-built from the command catalog — it has no hardcoded
command list. So its docs must also be generated from the live API.

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

# Just the IDs, for a quick cheatsheet
wibwob commands -q | sort

# Write a full reference to a file
wibwob commands | jq -r '
  "# ww command reference\n\nGenerated: \(now | todate)\n\n" +
  "| Command | Description | Surfaces |\n| --- | --- | --- |\n" +
  ([.[] | "| `\(.id)` | \(.description // "-") | \(.surfaces | join(", ")) |"] | join("\n"))
  ' > src/cli/COMMANDS.md
```

The key insight: because `wibwob commands` returns everything the API knows
(including dynamically registered module commands), the generated docs
are always complete and current. No manual sync required.

Future improvement: if commands gain Zod schemas for their args, the
generated docs could include per-command flag tables with types and
defaults. Until then, the `description` field is the only contract.

## Test suite

53 automated tests in `autoresearch/unix-control/autoresearch.sh` covering:
connectivity, full command ID parity, state parity, all syntax styles,
flag parsing, jq pipe ergonomics, quiet mode, window operations,
theme changes, error handling, exit codes, rapid-fire workflows,
multi-window agent patterns, and a choreography proof-of-concept.

```bash
bash autoresearch/unix-control/autoresearch.sh
```
