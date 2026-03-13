# Devnote: The Parity Problem — Auto-Deriving CLI and HTTP API from a Single Command Registry

Keywords: parity, single source of truth, command registry, auto-generate, auto-derive,
CLI generation, HTTP API generation, Zod schema, typed args, command catalog, control API,
drift prevention, multi-transport, one definition multiple surfaces, boilerplate elimination,
commander.js, Hono, oclif, tRPC, TypeBox, citty, openapi, ww command, Unix CLI

## The Parity Problem

WibWob-DOS has THREE surfaces that need to stay in sync:

1. CommandRegistry (command-catalog.ts) — the source of truth
2. HTTP API (control-api.ts) — ~500 lines of hand-written route handlers
3. Future CLI (ww) — another projection of the same commands

The HTTP API is ALREADY drifting. control-api.ts has 60+ hand-written routes
that each do this.handlers.runCommand(id, args). Most of those routes are thin
shims that parse body fields and call the registry. That is boilerplate that
should not exist.

## Why The Research Answer Was Wrong (For Us)

The research said "no production project auto-generates CLI from API specs" —
true for Docker, kubectl, etc. But those projects do not have what we have:
a TYPED COMMAND CATALOGUE with machine-readable metadata. Our CommandRegistry
already knows:

- Every command ID
- Its description
- Which surfaces it appears on (menu, palette, api, agent)
- Its argument shape (loosely, via the args object)

The missing piece is TYPED ARGUMENT SCHEMAS. If each command declared its args
as a schema (what fields, what types, which are required), then BOTH the HTTP
routes AND the CLI commands could be auto-derived.

## The Concrete Fix

One definition, three transports:

```typescript
// In command-catalog.ts — the ONLY place you define a command
{
  id: "window.move",
  label: "Move Window",
  description: "Move a window to absolute coordinates",
  args: {
    id: { type: "number", required: true, description: "Window ID" },
    x:  { type: "number", required: true, description: "X position" },
    y:  { type: "number", required: true, description: "Y position" },
  },
  action: (args) => windows.moveWindow(args.id, args.x, args.y),
  surfaces: ["api", "agent", "cli"],
}
```

From that single definition, auto-generate:
- HTTP route: POST /commands/run {id: "window.move", args: {id, x, y}}
- CLI command: ww window move --id 3 --x 10 --y 5
- OpenAPI spec entry (already partially done)
- Help text, arg validation, error messages

The hand-written /windows/move route in control-api.ts becomes UNNECESSARY.
It is just a legacy alias for /commands/run {id: "window.move"}.

## Existing Tools That Help

Packages that solve "one definition, multiple transports":

- tRPC — define procedures once, get typed client + server. HTTP-only though.
- Zod — schema definitions that can validate HTTP bodies AND parse CLI args.
- oclif — has arg/flag schema definitions that generate help + validation.
- Hono + Zod OpenAPI (@hono/zod-openapi) — define routes with Zod schemas,
  get OpenAPI spec for free. Already noted in control-api.ts TODO.
- commander.js + Zod — Zod schema can generate both commander options and
  HTTP body validation.
- citty (UnJS) — lightweight CLI framework with schema definitions, used by Nuxt.
- TypeBox — fast JSON schema builder, generates CLI args AND HTTP validation.
- effect/Schema (Effect-TS) — powerful schema-first approach.

The pattern that fits best: Zod schemas in the command catalogue, projected to
HTTP via Hono and to CLI via commander.js (or citty).

## Key Insight: CommandRegistry IS the Single Source of Truth

The command registry already exists. The HTTP API is a hand-written projection
of it that has grown to 500+ lines of boilerplate. The CLI would be a second
projection. The fix is NOT to auto-generate CLI from the API, but to auto-generate
BOTH from the registry.

Steps:
1. Add Zod schemas to command definitions in command-catalog.ts
2. Auto-generate HTTP routes from registry (replace hand-written control-api.ts shims)
3. Auto-generate CLI commands from registry (the ww tool)
4. Auto-generate OpenAPI spec from Zod schemas (replace hand-built ENDPOINT_CATALOGUE)
5. Keep hand-written routes ONLY for endpoints with special behaviour

## What This Means for Multi-Agent / Multi-Worktree Development

When multiple agents work in parallel (different worktrees, different epics):
- New commands are added to command-catalog.ts (one file, mergeable)
- HTTP routes auto-generated — no merge conflicts in control-api.ts
- CLI commands auto-generated — no separate CLI maintenance
- OpenAPI spec auto-generated — always in sync
- Parity is structural, not procedural (you cannot add a command without
  it appearing on all surfaces)

## Research Still Needed

- Does a Zod-to-commander.js bridge package exist? (zod-to-cli, zod-cli, etc.)
- Can citty schemas serve double duty as HTTP body validators?
- What is the simplest Bun-native approach with no build step?
- Should we use openapi-typescript to generate a typed client from our own
  /openapi.json endpoint, then wrap that client as CLI commands?

## Related Files

- src/core/command-catalog.ts — command definitions (source of truth)
- src/core/command-registry.ts — runtime execution + list/run layer
- src/services/control-api.ts — HTTP API (the 500-line projection to replace)
- .planning/epics/e039-unix-cli-surface/e039-brief.md — epic brief
- autoresearch/unix-control/REFERENCE_CLI_TOOLS_RANKED.md — reference CLI tools
