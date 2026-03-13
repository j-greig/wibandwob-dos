# Recommendations for WibWob-DOS Unix CLI Surface

## Executive Summary

CLI-first, pipe-composable interfaces are expected to improve agent control
compared to the current REST-only API. This document identifies the gaps
and recommends a phased approach. Implementation architecture is in
SURFACE_PARITY_ARCHITECTURE.md.

---

## Current State

What works well:
- Command-based semantics (command-catalog.ts is the single source of truth)
- HTTP API on port 8099 serves humans and agents
- StateService enables query-before-act loops
- Agent tools (tui_run_command) are registry-aware and stateless

Gaps:
- No CLI projection — agents use curl + JSON, not pipes + jq
- No typed argument schemas — commands accept untyped args bags
- POST /windows/batch collapses ops (agents can't query state mid-operation)
- All control is HTTP — no Unix socket for lower-latency local agents

---

## Phased Approach

### Phase 1: Schema Enrichment (no new surfaces)

Add Zod schemas to command definitions in command-catalog.ts. This enables:
- Runtime argument validation in /commands/run
- Auto-generated OpenAPI parameter docs via zod-to-json-schema
- Foundation for CLI flag auto-derivation in Phase 2

Effort: 2-3 hours. Zero risk. Immediate API quality improvement.

### Phase 2: CLI Projection (the `ww` tool)

Auto-derive CLI commands from the catalog. Every command with `api: true`
and a `params` schema becomes a CLI subcommand with flags.

```bash
ww windows list              # list all windows as JSON
ww window 3 move --x 10 --y 5  # move window 3
ww commands list             # list available commands
ww state                     # full desktop state (pipe to jq)
```

Transport: HTTP to start (works immediately), Unix socket later.

Architecture detail: SURFACE_PARITY_ARCHITECTURE.md
CLI grammar design: REFERENCE_CLI_TOOLS_RANKED.md (proposed `ww` grammar)
Naming decisions: devnote-cli-naming-strategy

### Phase 3: Parity Testing (structural guarantee)

CI script verifies every `api: true` command has:
- An HTTP route (already true by construction)
- A CLI subcommand (true after Phase 2 by construction)
- Matching parameter names across all surfaces

Build fails if surfaces drift. Parity is structural, not maintained by discipline.

### Phase 4: Formal Benchmark (optional)

Run the proposed benchmark from RESEARCH Section 7:
- 20 multi-step desktop control tasks
- Compare CLI vs REST agent performance
- Measure success rate, token usage, error recovery

---

## Risk Analysis

| Phase | Risk | Mitigation |
|-------|------|------------|
| 1 (schemas) | Minimal | Additive change, no breaking API |
| 2 (CLI) | Low | CLI is just a client; HTTP API unchanged |
| 3 (parity tests) | None | Informational only |
| 4 (benchmark) | None | No code impact |

---

## Integration Points

No changes required:
- command-registry.ts — already stateless
- state-service.ts — already canonical
- window-facade.ts — already the abstraction layer

Changes required:
- command-catalog.ts — add `params?: z.ZodType` field
- control-api.ts — validate args against schema (optional, improves error messages)
- New: src/cli/ww.ts — CLI entry point (~50 lines, auto-derives from catalog)
- New: src/cli/catalog-to-cli.ts — reads catalog, generates subcommands (~100 lines)
- New: src/cli/transport.ts — HTTP or Unix socket client (~80 lines)

Total new code: ~250 lines for a zero-drift CLI surface.

---

## Success Criteria

- Every `api: true` command is reachable via `ww <noun> <verb>`
- `ww` output parses as valid JSON (pipeable to jq)
- Adding a new command to the catalog automatically creates a CLI subcommand
- No manual wiring between catalog and CLI (parity by construction)
- Agent can complete multi-step window management tasks via `ww` pipes

---

See also:
- RESEARCH_UNIX_AGENT_CONTROL.md — evidence and analysis
- UNIX_AGENT_CONTROL_EVIDENCE.md — verified citations
- SURFACE_PARITY_ARCHITECTURE.md — implementation architecture
