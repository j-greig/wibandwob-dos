# Unix Control v2 — Backlog

Deferred work from E039 (unix-control v1). The CLI exists and works.
This is about making it rigorous, self-documenting, and production-grade.

Depends on: E039 complete, `wibwob` CLI stable at 53/53 tests.

---

## 1. Zod param schemas on AppCommandDefinition

**Status:** Not started
**Impact:** High — unlocks client-side validation, generated --help, OpenAPI accuracy
**Effort:** 2-3 hours for first pass, ongoing for full catalog coverage

Add `params?: z.ZodType` to `AppCommandDefinition` in `command-catalog.ts`.
Start with high-traffic commands (window.move, window.resize, theme.set,
editor.new, figlet.open). Validate in `/commands/run` handler:
`cmd.params?.parse(args)` — bad args return 400 + Zod error message.

Zod is already a transitive dep (via MCP SDK, Anthropic, OpenAI).
No new dependency needed.

Success metric: `POST /commands/run` with `{ id: "window.move", args: { id: "not-a-number" } }`
returns 400 with a schema error instead of silently failing or crashing.

### CLI benefits once schemas exist
- `wibwob window.move --help` could print flag names, types, defaults
- `wibwob commands` could include param info in JSON output
- Generated COMMANDS.md could have per-command flag tables
- Client-side validation before HTTP round-trip

### Incremental path
1. Add `params` field to `AppCommandDefinition` interface
2. Schema 5-10 high-traffic commands
3. Add validation in control-api.ts `/commands/run` handler
4. Expose schemas via `GET /commands/list` (include params JSON Schema)
5. CLI reads schemas at runtime for --help generation

---

## 2. Return type hints

**Status:** Not started
**Impact:** Medium — improves CLI output formatting, agent expectations
**Effort:** 1 hour

Add `returns?: "json" | "text" | "void"` to `AppCommandDefinition`.
Commands that create windows return the window state (json). Commands
that change settings return void. Screenshot returns text.

CLI uses this to decide output formatting:
- json → pretty-print with indentation
- text → raw stdout (no JSON wrapping)
- void → silent on success, or print "ok"

---

## 3. CI parity script

**Status:** Not started (test suite exists but not in CI)
**Impact:** Medium — prevents regression
**Effort:** 1 hour

The 53-test suite in `autoresearch/unix-control/autoresearch.sh` runs
against a live API. For CI, need:
- A way to start the app in headless/test mode
- The test script to run as a CI step
- Failure = PR blocked

Could also be a simpler static check: parse command-catalog.ts,
verify every `api: true` command is reachable via the CLI dispatch.
But the HTTP tests are more valuable since they test actual behaviour.

---

## 4. Benchmark: CLI vs raw curl vs MCP tools

**Status:** Not started
**Impact:** Low (informational) — proves or disproves the speed hypothesis
**Effort:** 2 hours

The research docs hypothesise that CLI dispatch is faster for agents
than raw curl (less token overhead) and faster than MCP tools (no
tool-call round-trip). Test this:

Benchmark script:
1. Open 10 windows via `wibwob` CLI — measure wall clock
2. Open 10 windows via `curl` to API — measure wall clock
3. Open 10 windows via MCP tool calls (if measurable) — measure wall clock

Also measure token cost: how many tokens does an agent spend to
express "open 10 editors and tile them" via each surface?

---

## 5. Per-command --help

**Status:** Blocked on #1 (Zod schemas)
**Impact:** High for human users, medium for agents
**Effort:** 1-2 hours once schemas exist

`wibwob window.move --help` should print:

```
window.move — Move a window to absolute coordinates

Flags:
  --id    number (required)  Window ID from GET /state
  --x     number (required)  Absolute X coordinate
  --y     number (required)  Absolute Y coordinate
```

Generated from Zod schema `.describe()` strings. Zero manual docs.

---

## 6. Tab completion

**Status:** Not started
**Impact:** High for human shell users, zero for agents
**Effort:** 2-3 hours

Generate zsh/bash completion scripts from command list:
- First word: command domains (window, editor, theme, art, figlet, ...)
- Second word: verbs for that domain (new, close, move, resize, ...)
- Flags: from Zod schemas once they exist

`wibwob completions --zsh > _wibwob` or auto-generate on install.

---

## 7. wibwob watch (event streaming)

**Status:** Not started
**Impact:** Medium — enables reactive agent patterns
**Effort:** 3-4 hours (needs SSE or polling endpoint in control-api.ts)

`wibwob watch` streams desktop state changes as newline-delimited JSON.
Agent can react to window opens, closes, focus changes, theme changes
without polling.

Needs server-side SSE endpoint first (`GET /events` or similar).

---

## NOT DOING (decided against in v1)

These were in the original architecture doc but the v1 implementation
proved they're unnecessary:

- **catalog-to-cli.ts / transport.ts split** — The thin HTTP client
  approach (one file, ~150 lines) is simpler and sufficient. No need
  for a multi-file abstraction layer.

- **citty or cac CLI framework** — Raw argv parsing works fine at
  this scale. Adding a framework would be more code than the CLI itself.

- **Direct catalog import in CLI** — The HTTP-only approach gives us
  parity by construction. Importing the catalog would create a build
  dependency and miss dynamically registered module commands.

---

## 8. Naming hygiene: wibwob not ww

**Status:** Mostly done, needs audit
**Impact:** Low but embarrassing if missed
**Effort:** 30 mins

The CLI was originally called `ww`, renamed to `wibwob` mid-session
because `ww` clashed with an existing zsh alias (Claude with wibwob
system prompt). The rename touched: wibwob.ts, README, test suite,
package.json, autoresearch scripts, ideas file.

Audit checklist:
- [ ] `grep -r '\bww\b' src/cli/` — should return nothing
- [ ] `grep -r '\bww\b' autoresearch/unix-control/` — test descriptions OK, no functional refs
- [ ] `wibwob help` output says wibwob everywhere
- [ ] `src/cli/README.md` says wibwob everywhere
- [ ] `AGENTS.md` mentions wibwob if CLI is referenced
- [ ] `.planning/epics/e039-*/` docs say wibwob
- [ ] `.planning/epics/e040-*/` docs say wibwob (music video brief)
- [ ] `SURFACE_PARITY_ARCHITECTURE.md` updated to say wibwob (currently says ww)
- [ ] Any future doc generation (COMMANDS.md) uses wibwob in headers
- [ ] Shell alias in README matches: `alias wibwob=...` not `alias ww=...`

Run `grep -rn '\bww\b' src/ autoresearch/ .planning/ .agents/` to catch strays.
Exclude `WW_API` env var — that stays as-is (it's the API config, not the CLI name).

---

## Priority order

1. Zod schemas (#1) — unlocks #5, improves #6, makes the whole system typed
2. CI parity (#3) — prevents regression as commands grow
3. Per-command --help (#5) — blocked on #1 but high value
4. Return type hints (#2) — quick win
5. Tab completion (#6) — nice for humans
6. Event streaming (#7) — enables new patterns
7. Benchmark (#4) — informational only
