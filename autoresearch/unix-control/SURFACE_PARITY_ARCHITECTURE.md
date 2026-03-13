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

### Option B: OpenAPI → CLI generator

**How:** The app already serves `/openapi.json`. Use an existing tool to
generate a CLI client from the OpenAPI spec.

**Candidates:**
- `openapi-generator` — Java-based, heavyweight, generates full clients
- `oazapfts` — TS-native, generates typed API client from OpenAPI
- `hey-api` — modern OpenAPI → TS client
- Custom: read `/openapi.json` at CLI startup, build commands dynamically

**Problem:** The OpenAPI spec currently describes REST endpoints, not
command semantics. `/commands/run` is a single POST endpoint that takes
`{id, args}` — the OpenAPI spec doesn't decompose this into per-command
endpoints with typed args. You'd get a CLI with one command:
`ww commands-run --id window.tile` — useless.

**To make this work:** The OpenAPI spec would need to be generated FROM
the catalog with per-command endpoints. At that point you've built Option A
with an extra hop through OpenAPI.

**Verdict:** Option B adds complexity without benefit. The catalog is
already richer than OpenAPI (it has menu placements, agent flags, etc).
Generate the CLI from the catalog directly.

### Option C: tRPC / Hono RPC

**How:** Replace the hand-rolled API with tRPC or Hono's RPC mode. Both
generate typed clients from server definitions.

**Problem:** WibWob already has a working API with 30+ endpoints, an
OpenAPI spec, and multiple consumers (agents, scripts, tests). Replacing
the transport layer to get CLI generation is a sledgehammer.

**Verdict:** Only if you're rewriting the API anyway. Not justified for
CLI parity alone.

### Option D: Effect/Schema or Zod → all surfaces

**How:** Define every command with Effect/Schema or Zod. Auto-derive
OpenAPI (via `zod-to-openapi`), CLI flags, and runtime validation.

**Problem:** Adds a heavy dependency (Effect is 50KB+). Zod is lighter
but doesn't add much over TypeBox which is already in the repo.

**Verdict:** Use TypeBox. It's already there.

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

### Step-by-step implementation

**Phase 1: Schema enrichment (no new surfaces)**
- Add `params?: z.ZodType` to `AppCommandDefinition` interface
- Add Zod schemas to 10 most-used commands (window.move, theme.set, etc)
- Validate args against schema in `/commands/run` handler
- OpenAPI spec auto-generates per-command parameter docs via `zod-to-json-schema`
- Effort: 2-3 hours, zero risk, immediate API quality improvement

**Phase 2: CLI projection (new surface, auto-derived)**
- `src/cli/ww.ts` reads catalog, generates subcommands
- Each command with `api: true` + `params` → CLI subcommand with flags
- Transport: HTTP to start (works immediately), Unix socket later
- `ww windows list`, `ww window 3 move --x 10 --y 5` etc
- Effort: 4-6 hours, builds on Phase 1

**Phase 3: Parity testing (structural guarantee)**
- CI script: load catalog, check every `api: true` command has:
  - An HTTP route (already true by construction)
  - A CLI subcommand (true after Phase 2 by construction)
  - Matching parameter names between all surfaces
- Fail the build if surfaces drift
- Effort: 1-2 hours

**Phase 4: Module parity (auto-derived for microapps)**
- Microapp commands from `module.json` already enter the catalog
- CLI projection picks them up automatically (no module code changes)
- Verify: install a new module, `ww commands list` shows it without
  any CLI code change
- Effort: 0 (falls out of Phase 2 for free)

## Multi-Agent Parity Considerations

The scenario: Agent A adds a module with new commands on branch X.
Agent B adds API endpoints on branch Y. They merge. Does the CLI break?

**With this architecture: no.** Because:

1. Agent A's module registers commands in `module.json` → auto-enters catalog
2. Agent B's new commands go in `command-catalog.ts` → auto-projected to CLI
3. The CLI reads the catalog at runtime, not at build time
4. Merge conflicts only happen if two agents edit the same catalog entry
5. The CI parity check (Phase 3) catches any command that has `api: true`
   but missing params schema

**The key insight:** The catalog is append-only in practice. Agents add
commands, they rarely modify existing ones. Append-only sources of truth
have minimal merge conflicts.

## Existing Packages Worth Using

| Package | What for | Already in repo? |
|---------|----------|-----------------|
| `zod` | Schema definition + validation + CLI flag derivation | YES (transitive via MCP, Anthropic SDK, OpenAI, Mistral) |
| `zod-to-json-schema` | Zod → JSON Schema (for OpenAPI spec generation) | YES (transitive via pi-ai) |
| `citty` (unjs) | CLI framework — 3KB, subcommands, typed args | No |
| `cac` | CLI framework — 4KB, lightweight alternative | No |

**Why Zod over TypeBox for this:**
- Zod is already a transitive dep via multiple paths (MCP SDK, Anthropic, OpenAI, Mistral)
- pi itself uses Zod for tool schemas — the MCP tool definition pattern IS Zod
- LLMs have massive Zod training data — agents write Zod schemas confidently
- `zod-to-json-schema` already in the dep tree for OpenAPI generation
- TypeBox is used in agent-tools.ts but that's a smaller surface; migrating
  those ~10 tool definitions to Zod is trivial and unifies the schema story

**NOT recommended:**
- `oclif` — heavyweight (Salesforce), overkill for our needs
- `commander` / `yargs` — larger than needed, no schema integration
- `openapi-generator` — Java dependency, wrong direction (API → CLI)
- `@sinclair/typebox` — already in repo but Zod has better ecosystem
  alignment (MCP, pi, OpenAI all use Zod)

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

## Files in This Analysis

| File | What it covers |
|------|---------------|
| This file | Architecture for surface parity |
| REFERENCE_CLI_TOOLS_RANKED.md | What the CLI should look like (command grammar) |
| UNIX_AGENT_CONTROL_RECOMMENDATIONS.md | Why CLI matters for agents |
| RESEARCH_UNIX_AGENT_CONTROL.md | Evidence base for Unix-first approach |
