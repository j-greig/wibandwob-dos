# Surface Parity Architecture: One Definition, Three Surfaces

## Problem

WibWob-DOS has three control surfaces that drift apart:
1. TypeScript app — command-catalog.ts → menus, palette, shortcuts
2. HTTP API — control-api.ts → REST endpoints, OpenAPI spec
3. Unix CLI — `wibwob` command → shell commands, pipes, jq

## Current State (Post-E039)

command-catalog.ts IS the single source of truth. Every command defined
there auto-appears in TUI menus, palette, HTTP API (`/commands/run`),
agent tools (`tui_run_command`), and OpenAPI spec. Microapp modules
auto-register via `microapp.json`.

The `wibwob` CLI exists and works — a thin HTTP client (~150 lines)
that talks to the control API. Pure HTTP, no catalog import. Parity
by construction: the CLI can only do what the API exposes.

53 parity tests pass. The CLI is production-ready.

## Architecture (As Built)

```
              command-catalog.ts  ← SINGLE SOURCE OF TRUTH
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    TUI menus    HTTP API      wibwob CLI
    palette      /commands/*   wibwob <noun>.<verb>
    shortcuts    OpenAPI        (thin HTTP client)
```

The CLI does NOT import the catalog. It discovers commands at runtime
via `GET /commands/list` and dispatches via `POST /commands/run`.
This means dynamically registered module commands work automatically.

Single file: `src/cli/wibwob.ts` (~150 lines). No framework needed —
raw argv parsing works fine at this scale.

## What Was Built (E039)

- `wibwob state` — full desktop state as JSON
- `wibwob windows` — window list from state
- `wibwob commands` — command list from API
- `wibwob <noun>.<verb> [--key val]` — execute any API command
- `wibwob health` — API health check
- `wibwob help` — usage info
- JSON to stdout, errors to stderr, exit codes for scripting

## What's Next (V2 Backlog)

1. **Per-command argument schemas** — Add `params?: z.ZodType` to
   `AppCommandDefinition`. Zod is already a transitive dep. Enables
   validation (400 on bad args), generated --help, OpenAPI accuracy.

2. **Return type hints** — Add `returns?: "json" | "text" | "void"`
   to definitions. CLI uses this for output formatting.

3. **Per-command --help** — `wibwob window.move --help` prints flags,
   types, defaults. Generated from Zod schemas. Blocked on #1.

4. **CI parity script** — Run the 53-test suite as a CI gate.

5. **Tab completion** — Generate zsh/bash completions from command list.

6. **Event streaming** — `wibwob watch` streams state changes as ndjson.

See `autoresearch/unix-control-v2/BACKLOG.md` for full details.

## Design Decisions (Proven in V1)

**Pure HTTP, not catalog import.** The thin HTTP client approach gives
parity by construction. Importing the catalog would create a build
dependency and miss dynamically registered module commands.

**No CLI framework.** Raw argv parsing works at this scale. Adding
citty or cac would be more code than the CLI itself.

**Single file.** The original plan called for three files (wibwob.ts,
catalog-to-cli.ts, transport.ts). One file suffices.

## Integration

No changes needed to: command-registry.ts, state-service.ts, window-facade.ts.
The CLI is a pure consumer of the HTTP API surface.

## Success Criteria (Achieved)

- Every `api: true` command reachable via `wibwob <id> [--flags]`
- Output parses as JSON (pipeable to jq)
- New catalog commands auto-appear in CLI (zero manual wiring)
- Agent can complete multi-step tasks via `wibwob` pipes
- 53 parity tests green

## Related

- `autoresearch/unix-control/` — V1 research, tests, devlog
- `autoresearch/unix-control-v2/` — V2 backlog and autoresearch
- `src/cli/README.md` — CLI usage guide
