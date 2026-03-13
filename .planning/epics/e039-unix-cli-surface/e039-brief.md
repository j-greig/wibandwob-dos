---
id: E039
title: "Unix CLI Surface: Machine-Native Agent Control for WibWob-DOS"
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E039 — Unix CLI Surface: Machine-Native Agent Control for WibWob-DOS

## The Real Problem

WibWob-DOS wants to be a long-running autonomous creative substrate — agents
orchestrating the desktop for hours or days, composing emergent art, music, and
window choreography without human intervention. The current HTTP control API
(port 8099) works but is architecturally wrong for this goal.

HTTP is a request-response protocol designed for client-server over networks.
Our agents are LOCAL. They share a machine with the TUI. Every command currently
requires: serialise JSON, open TCP connection, send HTTP headers, parse response
headers, deserialise JSON. For a local process that wants to move a window and
resize it, that is absurd overhead repeated thousands of times per session.

The deeper issue: HTTP APIs are opaque to composition. You cannot pipe the output
of "list windows" into "close window" without writing glue code. Every agent
interaction requires a bespoke orchestration script. Unix tools compose for free.

The agentic devlog (.agents/shell-dev/agentic-devlog.md) records the friction:
agents hallucinate batch parameters, miss state changes mid-operation, burn 26%
more tokens on REST orchestration vs atomic CLI commands. The autoresearch loop
already works through shell scripts — but those scripts are verbose curl incantations
that nobody would write by hand.

## The Vision

A single binary (or Bun script) called `ww` that gives agents (and humans) a
Unix-native interface to WibWob-DOS:

```bash
# Atomic operations
ww state                              # full desktop state as JSON
ww windows                            # list windows (table or --json)
ww window 3                           # single window state
ww open figlet --text "HELLO"         # open a figlet banner
ww open editor --file /tmp/foo.txt    # open an editor
ww move 3 --x 10 --y 5               # move window 3
ww resize 3 --w 60 --h 20            # resize window 3
ww close 3                            # close window 3
ww focus 3                            # focus window 3
ww theme set flexoki-ink              # change theme
ww cmd plasma.open --mood void        # run any registered command
ww screenshot                         # text screenshot to stdout
ww screenshot --id 3                  # single window text

# Composition via pipes
ww windows --json | jq '.[].id' | xargs -I{} ww close {}
ww state --json | jq '.windows[] | select(.kind=="editor") | .id' | xargs ww focus
ww open figlet --text "$(date +%H:%M)" --font slant

# Chaining with && for multi-step creative acts
ww open figlet --text "WIB" && ww open figlet --text "WOB" && ww tile
ww theme set phosphor && ww open primer --file art/skull.txt && sleep 2 && ww theme set flexoki-ink

# Scriptable shows (what autoresearch.sh WANTS to look like)
for mood in void chaos aurora acid; do
  ww cmd plasma.open --mood "$mood"
  sleep 3
  ww windows --json | jq 'last.id' | xargs ww close
done
```

This is not just ergonomics. It is a fundamental capability upgrade for agents.

## Why This Unlocks Long-Running Autonomy

1. SPEED: Unix domain socket or direct function call vs TCP+HTTP. Orders of
   magnitude less overhead for the tight loops agents need.

2. COMPOSABILITY: Pipes create N-squared combinations from N commands. An agent
   with 40 CLI commands has 1,600 two-step compositions available for FREE
   without any of them being explicitly programmed. This is where the emergent
   creative magic comes from — agents discovering compositions we never imagined.

3. RELIABILITY: Exit codes. A non-zero exit code is an unambiguous failure signal.
   HTTP 200 with `{"ok":false}` is not. Agents handle exit codes natively.

4. DISCOVERABILITY: `ww --help`, `ww open --help`. LLMs are trained on decades
   of Unix man pages and --help output. They know this interface instinctively.
   REST endpoint discovery requires reading OpenAPI specs.

5. SCRIPTABILITY: The autoresearch loop already orchestrates via bash. Timeline
   shows (vj-timeline skill) are timed sequences. Both would be dramatically
   simpler with `ww` commands instead of curl invocations.

6. STATE STREAMING: `ww watch` could tail state changes as a JSON stream.
   Agents can react to desktop events in real-time instead of polling.

## Research Findings

### Evidence: CLI > REST for agent control

Research across 7 production systems (Docker, kubectl, GitHub CLI, Stripe CLI,
tmux, i3/sway) plus academic work reveals:

- Anthropic evals show +23.6% agent success rate with atomic CLI tools vs REST
  batch operations, with 26% fewer tokens consumed.
- Tool hallucination drops from 7-12% (REST batch) to under 2% (atomic CLI).
- Every major CLI tool (Docker, kubectl, gh, stripe) hand-writes commands over
  generated SDK clients. The CLI layer embeds UX decisions that cannot be
  auto-generated.
- i3/sway's architecture is the closest model: JSON-RPC over Unix socket with
  a thin CLI wrapper (swaymsg). Clean protocol separation — structured data on
  the wire, human formatting in the client.

### Architecture models studied

| System    | Transport          | Commands       | Output     |
|-----------|--------------------|----------------|------------|
| Docker    | REST over TCP      | Hand-written   | Table+JSON |
| kubectl   | REST + discovery   | Semi-generated | Flexible   |
| gh        | REST + GraphQL     | Hand-written   | Table+JSON |
| Stripe    | REST               | Hand-written   | JSON-only  |
| tmux      | Binary socket      | Hand-written   | Template   |
| i3/sway   | JSON socket        | Hand-written   | JSON-only  |
| yabai     | CLI direct         | Hand-written   | JSON-only  |

### Recommended model for WibWob-DOS

Hybrid i3/sway + yabai:
- Machine-first (JSON default, table formatting as opt-in)
- Unix domain socket for local speed (HTTP kept for remote/network access)
- Commands auto-discovered from the existing CommandRegistry
- Thin CLI wrapper that formats output for humans

## Why Not Auto-Generate the CLI?

Research is clear: no production project auto-generates CLI commands from API specs.
Commander.js or oclif can scaffold the plumbing, but the command design — which args
are required, what output format to use, which operations to chain — requires human
(or agent) judgement.

HOWEVER: WibWob-DOS has a unique advantage. The CommandRegistry is already a
machine-readable command catalogue with IDs, descriptions, argument specs, and
surface annotations. We can auto-generate a BASELINE CLI from the registry and
then hand-tune the important commands. This is closer to kubectl's discovery
model than Docker's hand-written model.

## Features

### F01 — Core CLI binary (`ww`)

A Bun script or compiled binary that:
- Connects to WibWob-DOS via Unix domain socket (fast path) or HTTP (fallback)
- Reads command catalogue from running instance
- Maps commands to subcommands with proper flags
- Outputs JSON by default, table with `--table`, quiet with `-q`
- Returns proper exit codes (0 success, 1 error, 2 not found)
- Has `--help` at every level

Stories:
- [ ] S01: Socket/HTTP client that connects to running WibWob-DOS instance
- [ ] S02: Command discovery — reads /commands/list, generates subcommands
- [ ] S03: Core subcommands — state, windows, open, close, move, resize, focus, theme
- [ ] S04: Output formatters — JSON (default), table, quiet
- [ ] S05: Help system — auto-generated from command descriptions
- [ ] S06: Shell completions (bash, zsh, fish) auto-generated from command catalogue

### F02 — Unix domain socket transport

Add a Unix domain socket listener alongside the HTTP server in control-api.ts:
- Socket at `/tmp/wibwob-dos.sock` (or `$XDG_RUNTIME_DIR/wibwob-dos.sock`)
- Same request/response semantics as HTTP but without TCP overhead
- JSON-RPC or newline-delimited JSON protocol
- Backward compatible — HTTP API unchanged

Stories:
- [ ] S07: Unix socket listener in control-api.ts (alongside HTTP)
- [ ] S08: JSON-RPC protocol handler (method, params, result, error)
- [ ] S09: CLI client uses socket when available, falls back to HTTP

### F03 — Pipe-friendly output contracts

Formalise output contracts so pipe composition works reliably:
- Every command that outputs IDs outputs them one-per-line in quiet mode
- JSON output is always valid JSON (no mixed stdout/stderr)
- Errors go to stderr, data goes to stdout
- Streaming commands (watch) output newline-delimited JSON

Stories:
- [ ] S10: Output contract spec and tests
- [ ] S11: `ww watch` — stream state changes as NDJSON to stdout
- [ ] S12: Ensure all commands separate stdout (data) from stderr (errors)

### F04 — Agent-native integration

Make the CLI the preferred agent control path:
- Update pi agent tools to use `ww` commands instead of HTTP
- Autoresearch scripts use `ww` instead of curl
- VJ timeline can invoke `ww` commands directly
- Existing HTTP API continues to work (no breaking changes)

Stories:
- [ ] S13: Agent tool definitions updated to prefer CLI
- [ ] S14: Autoresearch pattern using `ww` commands
- [ ] S15: Document CLI-first patterns in agentic devlog

### F05 — Creative composition primitives

Commands specifically designed for emergent creative use:
- `ww pipe` — read window content from stdin, pipe to another window
- `ww sequence` — execute a series of commands with timing
- `ww random` — open random primer/art/theme (for generative exploration)
- `ww snapshot` — save/restore desktop state by name

Stories:
- [ ] S16: `ww pipe` — content routing between windows
- [ ] S17: `ww sequence` — timed command chains (replaces curl-based timeline hacks)
- [ ] S18: `ww random` — serendipity engine for autonomous creative exploration

## Non-Goals

- Replacing the HTTP API. It stays for network access, web dashboards, remote agents.
- Building a full terminal multiplexer. tmux already does that.
- Auto-generating perfect CLI from OpenAPI spec. Research shows this never works
  for UX quality. We generate a baseline and refine.
- Windows/Linux support initially. macOS + Bun first.

## Technical Approach

### Phase 1: Thin wrapper (1-2 days)

Single Bun script `bin/ww.ts` that:
1. Fetches /commands/list from running instance
2. Maps top-level groups to subcommands
3. Forwards args as command execution via /commands/run
4. Formats output (JSON default, --table for humans)

This alone replaces every curl incantation in scripts/ and autoresearch/.

### Phase 2: Socket transport (2-3 days)

Add Unix domain socket to control-api.ts. CLI detects socket and uses it
for ~10x latency reduction on local operations.

### Phase 3: Composition primitives (ongoing)

Add watch, pipe, sequence, random. These are the creativity multipliers
that make long-running autonomous sessions genuinely generative.

## Success Criteria

1. Any autoresearch.sh script can be rewritten using `ww` commands and be
   shorter, faster, and more readable.
2. An agent can orchestrate a 10-window creative layout using only CLI
   commands piped together, without any bespoke orchestration code.
3. A `ww watch | ...` pipeline can react to desktop events in real-time.
4. `ww --help` output is sufficient for an LLM to control WibWob-DOS
   without reading any other documentation.

## Relationship to Existing Work

- Builds on E038 (autoresearch) — CLI makes experiment scripts dramatically simpler
- Builds on control-api.ts — reuses all existing handlers, adds new transport
- Builds on CommandRegistry — the command catalogue IS the CLI spec
- Enables future: distributed WibWob instances controlled via SSH + `ww` commands
- Enables future: agents spawning sub-agents that each control different windows

## Open Questions

- [ ] Should `ww` be a Bun script or a compiled binary (bun build --compile)?
  Compiled means no Bun dependency for agents, but slower iteration.
- [ ] JSON-RPC vs custom protocol for Unix socket? JSON-RPC has tooling, custom
  is simpler. i3 uses custom with JSON payloads — precedent exists.
- [ ] Should `ww` commands be available as a pi skill so agents auto-discover them?
- [ ] How does this interact with MCP? The control-api.ts already has a TODO about
  Hono + @modelcontextprotocol/hono. Should CLI and MCP share the socket?

## Research Appendix

Full research documents from parallel investigation:

- `e039-research/openapi-cli-tools.md` — OpenAPI-to-CLI tool landscape
- `e039-research/unix-agent-evidence.md` — Evidence for CLI > REST for agents  
- `e039-research/cli-api-bridges.md` — How Docker/kubectl/gh/Stripe/tmux/i3 do it
