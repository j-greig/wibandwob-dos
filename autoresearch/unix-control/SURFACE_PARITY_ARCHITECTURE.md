# Surface Parity Architecture: One Definition, Three Surfaces

## The Problem

WibWob-DOS has three control surfaces that must stay in sync:

1. **TypeScript app** — command-catalog.ts → menus, palette, keyboard shortcuts
2. **HTTP API** — control-api.ts → REST endpoints, OpenAPI spec
3. **Unix CLI** — `ww` command (planned, E039) → shell commands, pipes, jq

As the app grows — new modules, new features, parallel agents adding things
in different worktrees — these surfaces drift. A new command gets added to
the catalog but not the CLI. An API endpoint gets args that the CLI doesn't
expose. A module registers a microapp command that the API can see but the
CLI doesn't know about.

The question: how do we auto-derive surfaces from a single definition so
parity is structural, not maintained by discipline?

## What Already Exists (Current State)

WibWob-DOS is surprisingly close to solving this already:

### command-catalog.ts IS the single source of truth
```typescript
// src/core/command-catalog.ts
interface AppCommandDefinition {
  id: string;           // e.g. "window.tile", "primer.open"
  label: string;        // human-readable name
  description?: string; // what it does (used by agents + API docs)
  actionKey: string;    // maps to controller method
  api: boolean;         // exposed on HTTP API?
  agent: boolean;       // exposed to LLM agents?
  // menu, palette, context-menu placements...
}
```

Every command defined here automatically appears in:
- TUI menus (via menuPlacements)
- Command palette (via palettePlacement)
- HTTP API at `/commands/run` (if `api: true`)
- Agent tools via `tui_run_command` (if `agent: true`)
- OpenAPI spec at `/openapi.json`

### TypeBox schemas define agent tool parameters (migration candidate)
```typescript
// src/services/agent-tools.ts — currently uses @sinclair/typebox
// but Zod is the better long-term choice (MCP, pi, OpenAI all use Zod)
const runCommand = tuiTool({
  name: "tui_run_command",
  parameters: Type.Object({
    id: Type.String({ description: "Command id" }),
    args: Type.Optional(Type.Record(Type.String(), Type.Unknown()))
  }),
  execute: (params, ctx) => ctx.runCommand(params.id, params.args)
});
// → migrate to: z.object({ id: z.string(), args: z.record(z.unknown()).optional() })
```

### Microapp commands auto-register
Modules declare commands in `module.json` and they appear in the catalog
automatically with the `microapp.<moduleId>.<commandId>` prefix.

## What's MISSING for CLI Parity

The gap is narrow but real:

### 1. Per-command argument schemas
Commands accept `args?: Record<string, unknown>` — an untyped bag. The API
and CLI can't validate or document arguments without schema metadata.

**Fix:** Add optional Zod schema to `AppCommandDefinition`:
```typescript
import { z } from "zod";

interface AppCommandDefinition {
  // ...existing fields...
  params?: z.ZodType;  // Zod schema for command arguments
}
```

### 2. CLI projection layer
There's no code that reads the command catalog and generates CLI commands.

**Fix:** A thin CLI entry point that:
- Imports the catalog
- For each command with `api: true`, generates a CLI subcommand
- Maps `params` schema to CLI flags
- Calls the HTTP API or Unix socket

### 3. Return type schemas
Commands return untyped results. The CLI needs to know whether to print
JSON, a table, or a status message.

**Fix:** Add return type hint to definition:
```typescript
interface AppCommandDefinition {
  // ...existing fields...
  returns?: "json" | "text" | "void";
}
```

## Approach Comparison: Build vs Buy

### Option A: Code-generate CLI from catalog (RECOMMENDED)

**How:** At build time (or app startup), read the command catalog and
generate a CLI entry point. One TypeBox schema per command defines both
API validation and CLI flag parsing.

**Stack:**
- `zod` — already a transitive dep, defines schemas, validates at runtime
- `zod-to-json-schema` — already in dep tree, generates OpenAPI params
- `citty` or `cac` — lightweight CLI framework (~3KB)
- Zod-to-CLI flag mapping is trivial:
  `z.object({ x: z.number() })` → `--x <number>`

**What to write:**
```
src/cli/ww.ts              — entry point, ~50 lines
src/cli/catalog-to-cli.ts  — reads catalog, generates subcommands, ~100 lines
src/cli/transport.ts       — HTTP or Unix socket client, ~80 lines
```

**Parity guarantee:** If a command exists in the catalog with `api: true`,
it AUTOMATICALLY has a CLI subcommand. No manual wiring. New commands from
modules appear in the CLI without any CLI code changes.

**Pros:**
- Zero drift by construction
- Builds on existing catalog (no new source of truth)
- TypeBox already in repo
- ~250 lines of new code

**Cons:**
- Need to add `params` schema to every command (incremental)
- CLI help text derived from `description` field (may need tuning)

### Rejected Alternatives

- **OpenAPI → CLI generator:** `/openapi.json` describes REST endpoints, not per-command semantics. Would produce one useless `ww commands-run` command.
- **tRPC / Hono RPC:** Replacing a working 30+ endpoint API to get CLI generation is a sledgehammer.
- **Effect/Schema:** Heavy dependency (50KB+) for no benefit over Zod which is already transitive.

## Recommended Architecture

```
                    ┌─────────────────────┐
                    │  command-catalog.ts  │  ← SINGLE SOURCE OF TRUTH
                    │  + TypeBox params    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
              ▼                ▼                 ▼
     ┌────────────┐   ┌──────────────┐   ┌────────────┐
     │  TUI menus │   │  HTTP API    │   │  ww CLI    │
     │  palette   │   │  /commands/* │   │  ww <noun> │
     │  shortcuts │   │  OpenAPI     │   │  <verb>    │
     └────────────┘   └──────────────┘   └────────────┘
              │                │                 │
              └────────────────┼────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Unix socket or     │
                    │  HTTP transport     │
                    └─────────────────────┘
```

See "Implementation Phases" section below for the step-by-step plan.

## Multi-Agent Parity

The catalog is append-only in practice. Agents add commands, rarely modify
existing ones. Two agents adding commands in different worktrees produce no
merge conflicts. The CLI reads the catalog at runtime, so new commands appear
automatically. The CI parity check catches missing schemas.

## Packages

Use Zod (already transitive dep via MCP SDK, Anthropic, OpenAI, Mistral)
for schema definitions. Use `citty` or `cac` (~3-4KB) for CLI framework.
Avoid: oclif (heavyweight), commander/yargs (no schema integration),
openapi-generator (Java, wrong direction).

## The 50-Line CLI

Here's roughly what the CLI entry point looks like:

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

// Parse flags from rest args into args object using TypeBox schema
const args = cmd.params ? parseFlags(rest, cmd.params) : {};

// Execute via HTTP
const res = await fetch("http://127.0.0.1:8099/commands/run", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: cmdId, args })
});
const result = await res.json();
console.log(JSON.stringify(result, null, 2));
```

That's it. Every command in the catalog is now a CLI command. Zero drift.

---

## Implementation Phases

### Phase 1: Schema Enrichment (no new surfaces)
Add `params?: z.ZodType` to command definitions in command-catalog.ts.
Enables runtime validation, auto-generated OpenAPI docs, and CLI flag derivation.
Effort: 2-3 hours. Zero risk.

### Phase 2: CLI Projection (the `ww` tool)
Auto-derive CLI from catalog. Every `api: true` command with a params schema
becomes a subcommand. Transport: HTTP initially, Unix socket later.
Effort: ~250 lines across 3 new files.

### Phase 3: Parity Testing
CI script verifies every `api: true` command has matching HTTP route, CLI
subcommand, and parameter names. Build fails if surfaces drift.

### Phase 4: Formal Benchmark (optional)
Run the benchmark from RESEARCH Section 10 to validate the CLI advantage.

## Integration Points

No changes: command-registry.ts, state-service.ts, window-facade.ts.

Changes: command-catalog.ts (add params field), control-api.ts (validate
args against schema). New: src/cli/ww.ts, catalog-to-cli.ts, transport.ts.

## Success Criteria

- Every `api: true` command reachable via `ww <noun> <verb>`
- Output parses as JSON (pipeable to jq)
- New catalog commands auto-appear in CLI (zero manual wiring)
- Agent can complete multi-step tasks via `ww` pipes

## Related Files

| File | Role |
|------|------|
| RESEARCH_UNIX_AGENT_CONTROL.md | Evidence and analysis |
| REFERENCE_CLI_TOOLS_RANKED.md | CLI design references and proposed grammar |
