# Surface Parity Architecture: One Definition, Three Surfaces

## Problem

WibWob-DOS has three control surfaces that drift apart:
1. TypeScript app — command-catalog.ts → menus, palette, shortcuts
2. HTTP API — control-api.ts → REST endpoints, OpenAPI spec
3. Unix CLI — `ww` command (planned) → shell commands, pipes, jq

## Current State

command-catalog.ts IS already the single source of truth. Every command
defined there auto-appears in TUI menus, palette, HTTP API (`/commands/run`),
agent tools (`tui_run_command`), and OpenAPI spec. Microapp modules auto-
register via `module.json`.

## What's Missing

1. **Per-command argument schemas.** Commands accept `args?: Record<string, unknown>` —
   an untyped bag. Fix: add `params?: z.ZodType` to `AppCommandDefinition`.

2. **CLI projection layer.** No code reads the catalog and generates CLI commands.
   Fix: thin entry point that maps `api: true` commands to subcommands.

3. **Return type hints.** Commands return untyped results. Fix: add
   `returns?: "json" | "text" | "void"` to the definition.

## Architecture

```
              command-catalog.ts  ← SINGLE SOURCE OF TRUTH
              + Zod params schemas
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    TUI menus    HTTP API      ww CLI
    palette      /commands/*   ww <noun> <verb>
    shortcuts    OpenAPI
```

Auto-derive CLI from catalog. If a command has `api: true` + `params` schema,
it automatically gets a CLI subcommand. Zero manual wiring. Parity by construction.

Stack: Zod (already transitive dep), `citty` or `cac` (~3KB CLI framework).

## The CLI (~50 lines)

```typescript
// src/cli/ww.ts
import { catalog } from "../core/command-catalog.js";

const [noun, verb, ...rest] = process.argv.slice(2);

// Special: ww commands list
if (noun === "commands" && verb === "list") {
  const cmds = catalog.filter(c => c.api);
  console.log(JSON.stringify(cmds.map(c => ({
    id: c.id, label: c.label, description: c.description
  })), null, 2));
  process.exit(0);
}

// Map noun.verb to command id
const cmdId = verb ? `${noun}.${verb}` : noun;
const cmd = catalog.find(c => c.id === cmdId);
if (!cmd) { console.error(`Unknown command: ${cmdId}`); process.exit(1); }

// Parse flags into args using Zod schema
const args = cmd.params ? parseFlags(rest, cmd.params) : {};

// Execute via HTTP (Unix socket later)
const res = await fetch("http://127.0.0.1:8099/commands/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: cmdId, args })
});
console.log(JSON.stringify(await res.json(), null, 2));
```

Three files total: `ww.ts` (~50 lines), `catalog-to-cli.ts` (~100),
`transport.ts` (~80). ~250 lines for a zero-drift CLI surface.

## Implementation Phases

**Phase 1: Schema enrichment** — Add `params?: z.ZodType` to catalog.
Enables validation, OpenAPI docs, CLI flag derivation. 2-3 hours, zero risk.

**Phase 2: CLI projection** — Build `ww` tool. Every `api: true` command
with params becomes a subcommand. HTTP transport initially. ~250 new lines.

**Phase 3: Parity testing** — CI script verifies every `api: true` command
has HTTP route + CLI subcommand + matching params. Build fails on drift.

**Phase 4: Benchmark** (optional) — Test CLI vs REST agent performance.

## Integration

No changes: command-registry.ts, state-service.ts, window-facade.ts.
Changes: command-catalog.ts (add params), control-api.ts (validate args).
New: src/cli/ww.ts, catalog-to-cli.ts, transport.ts.

Multi-agent safe: catalog is append-only in practice. CLI reads it at
runtime. Two agents adding commands in different worktrees = no conflicts.

## Success Criteria

- Every `api: true` command reachable via `ww <noun> <verb>`
- Output parses as JSON (pipeable to jq)
- New catalog commands auto-appear in CLI (zero manual wiring)
- Agent can complete multi-step tasks via `ww` pipes

## Test It (against live API on port 8099)

```bash
# Parity check: CLI command count matches API
ww commands list | jq length
curl -s http://127.0.0.1:8099/commands/list | jq '.commands | length'
# Must match

# Functional: move a window via CLI, verify via API
WID=$(ww windows list | jq -r '.[0].id')
ww window $WID move --x 10 --y 5
curl -s http://127.0.0.1:8099/state | jq ".windows[] | select(.id==$WID) | .left"
# Must return 10

# Pipe composition: close all editors
ww windows list | jq -r '.[] | select(.kind=="editor") | .id' | \
  xargs -I{} ww window {} close
```

## Related

- RESEARCH_UNIX_AGENT_CONTROL.md — evidence and analysis
- REFERENCE_CLI_TOOLS_RANKED.md — CLI design references and proposed grammar
