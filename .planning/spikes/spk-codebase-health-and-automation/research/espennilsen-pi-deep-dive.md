# espennilsen/pi Deep Dive — Research Report
## For: spk-codebase-health-and-automation

_Compiled: 2026-03-20. Full audit of vendor/espennilsen-pi._
_Source: https://github.com/espennilsen/pi — personal pi agent home directory._

---

## TL;DR

Where gstack is a **software factory workflow** (specialist roles, PR lifecycle,
QA, ship ceremony), espennilsen/pi is a **personal agent OS** — always-on
infrastructure for a developer's full computing life. It treats the agent as a
persistent process with memory, economics, routing intelligence, and inter-agent
communication rather than a stateless tool invoked per-task.

The most interesting things for WibWob-DOS: the **subagent system** (mature
parallel/chain/pool patterns we already use), **pi-model-router** (automatic
model selection by task complexity), **pi-context** (visual token budget), and
the **handoff skill** (structured session transfer). The **event bus architecture**
for inter-extension communication is the cleanest pattern here and has direct
implications for how our microapp SDK could evolve.

---

## Part 1 — Agents

Four agents. Each is a role definition with tool restrictions, model, and a
tightly scoped job description. No overlap.

### `scout` (haiku-4-5)

```yaml
tools: read, grep, find, ls, bash
model: claude-haiku-4-5
```

Fast codebase recon. Outputs **compressed structured context** (file paths,
key functions, architecture notes, inline code snippets) for handoff to other
agents. Explicitly cannot implement anything — gather and compress only.
The rule "your output will be passed to an agent who has NOT seen the files
you explored" forces completeness without verbosity.

**Why it works:** Haiku on read-only tools costs almost nothing. The scout
runs first, compresses the expensive archaeology into a token-efficient summary,
then hands off to a more capable model that doesn't burn context on exploration.

**WibWob-DOS application:** This is exactly the `haiku` parallel sweep pattern
we attempted in this session. The key missing piece: we didn't give the haiku
agents an explicit "output format for handoff" requirement. Scout's format rule
should be baked into our discovery prompts.

---

### `planner` (sonnet-4-5)

```yaml
tools: read, grep, find, ls   # NO bash, NO write
model: claude-sonnet-4-5
```

Receives scout output, produces implementation plan. Five required output
sections: Summary / Files to change (with specific function names and line refs)
/ New files / Dependencies (order of changes) / Risks.

**What's notable:** No write tools. No bash. A planner that can't accidentally
implement anything is a different cognitive mode from a planner that can.
Forced read-only status eliminates the failure mode of "planned and started
implementing" in the same turn.

**WibWob-DOS application:** Our `microapp-product-owner` currently has write
tools. Worth considering a strict read-only plan mode with a separate implement
step.

---

### `reviewer` (sonnet-4-5)

```yaml
tools: read, grep, find, ls, bash   # bash: git diff/log/show ONLY
```

Code review checklist with four severity levels (🔴 Critical / 🟡 Important /
🔵 Minor / ✅ Good). Bash explicitly restricted to read-only git commands.
The restriction is stated in the system prompt, not enforced structurally.

Five review categories: Correctness / Security (input validation, injection,
path traversal) / Performance (N+1, blocking) / Maintainability / Conventions.

**WibWob-DOS application:** Our `code-reviewer` agent doesn't have the git
read-only bash pattern. Worth adding. The four-severity output format is
also cleaner than our current pattern.

---

### `worker` (sonnet-4-5)

```yaml
tools: (all)
model: claude-sonnet-4-5
```

General-purpose subagent with full capabilities. Operates in isolated context.
Three rules: read before writing / minimal focused changes / report what changed.

The simplest agent — no personality, no restrictions beyond those three rules.
Its value is isolation: handles delegated tasks without polluting the main
conversation's context window.

**WibWob-DOS application:** This is exactly what our `subagent` tool runs.
The explicit "read before writing" rule is worth adding to our worker equivalent.

---

### `models.json` — proxy-based multi-provider routing

All providers routed through a single proxy endpoint (`http://ai-proxy.e9n.dev/...`).
One auth surface, seven providers (Anthropic, OpenAI, Google, xAI, OpenRouter,
Groq, Mistral). This is a personal infrastructure decision, not directly applicable
— but the pattern of centralising provider config in one file mirrors our MODELS.md
intent.

---

## Part 2 — Extensions

### Tier 1: Directly relevant to our system

---

#### `pi-subagent` — parallel task delegation

The most mature subagent implementation available. Five execution modes:
- **Single** — one agent, one task, isolated context
- **Parallel** — multiple tasks concurrent, results stream back as they complete
- **Chain** — sequential pipeline with `{previous}` template variable
- **Orchestrator** — hierarchical trees where agents spawn sub-agents autonomously
- **Pool** — long-lived agents with persistent context; send follow-up messages
  without losing state between calls

Key design decisions:
- Subagents run with `--no-extensions` by default; you whitelist only what's needed
- Full `RunnerResult` captures: response, messages, token usage, cost breakdown,
  tool call count, turn count, duration, model used, stop reason
- `onUpdate` streaming for parallel/chain progress — progress surfaces before completion
- Agent discovery reads from `~/.pi/agent/agents/*.md` AND `.pi/agents/*.md`

The **pool mode** is what we don't have. A pool is a set of long-lived agents
you can send messages to repeatedly without spawning a new subprocess each time.
This is the right model for things like "keep a QA agent running while I implement,
send it each change to verify." We do chain and parallel but not persistent pools.

**WibWob-DOS application:** Our subagent extension (via pi directly) covers
single/parallel/chain. Pool mode would be valuable for the microapp triad pattern
— keep a doc-refiner warm while a developer implements, push each slice to it.

---

#### `pi-model-router` — automatic model selection

Intercepts `before_agent_start`, classifies the prompt, switches model before the
first LLM call. Resolution chain: static override → cache hit → LLM classifier → default tier.

The classifier itself runs on a cheap model (haiku). Static overrides are regex
patterns matched against the prompt. The result is cached so identical prompts
don't re-classify.

**Why it works:** Health check pings don't need Opus. Code review doesn't need
Haiku. Every spawned subprocess uses the global model unless pi-model-router
changes it. This eliminates the "forgot to set the right model for this cron job"
problem.

**WibWob-DOS application:** We have MODELS.md and per-agent model fields.
But when a microapp-developer subagent spawns a doc-check sub-task, it always
uses the parent's model. A routing rule "docs-only tasks → haiku" would save
tokens. Not immediate priority — but the pattern is worth stealing for subagent
spawning.

---

#### `pi-context` — `/context` visual token budget

Registers a `/context` command that shows a hex-grid token bar + per-category
breakdown: system prompt / tools / agents / skills / messages / free space /
autocompact buffer.

Per-item detail: each tool, each agent profile, each skill file shown with its
individual token cost. The autocompact buffer is shown as reserved space so you
know how much room the compaction process needs.

This is inspectability of the thing that usually goes unexamined. Most agents
burn tokens on skills/tools they didn't need this session.

**WibWob-DOS application:** Direct candidate. A `/context` command that shows
our loaded skills + extensions + their token cost would help audit which skills
are worth the overhead. Especially relevant given our skill consolidation plan.

---

#### `pi-memory` — persistent cross-session context

Two storage layers:
- `MEMORY.md` — curated long-term facts, section-based (`## Section` headers),
  survives compaction, manually edited
- `memory/YYYY-MM-DD.md` — append-only daily logs, one file per day

Both are injected into every agent turn via the `before_agent_start` hook.
The skill provides tools for read / write / search / append across both layers.

**Why the two-layer design matters:** Long-term facts (architecture decisions,
naming conventions, known gotchas) go in `MEMORY.md`. Session ephemera (what
was tried today, what broke) go in daily logs. The daily log is cheap to append
to; `MEMORY.md` requires judgment to edit. You don't compact the long-term memory
when the context gets full — you compact the conversation, not the memory.

**WibWob-DOS application:** Our reflections (`2026-W12.md` etc.) are the manual
equivalent of daily logs. The `MEMORY.md` equivalent would be `.agents/guides/`
— except guides are written for agents, not by them. The missing piece is an
agent-writable memory layer that persists facts between sessions. The pattern
is: agent learns something → writes it to `MEMORY.md` → next session gets it
pre-loaded. Right now we rely on human promotion.

---

#### `pi-jobs` — run telemetry and cost tracking

Records every agent invocation: token usage, cost (per-model breakdown), tool
call stats (count / error rate / avg duration), duration, channel (tui/cron/
heartbeat/subagent). SQLite backend. Web dashboard at `/jobs`. `/jobs` command
in TUI for quick stats.

**The key metric:** cost per session, per model, per channel. This answers
"is haiku actually cheaper for these tasks or does it make more tool calls?"
and "is our daily cron costing more than I think?"

**WibWob-DOS application:** Our `pi-jobs` equivalent would track: subagent
invocations, which agent, which model, token cost, duration. Right now we have
no visibility into what our agent fleet costs. The JSONL pattern from gstack
plus pi-jobs' channel concept would give us: `{ agent, model, tokens, cost, duration, session }`.

---

#### `pi-telemetry` — privacy-safe local analytics

JSONL per day, hashed fields only (no prompts, no content). Tracks: session
start/end, model calls (provider/model/turn), tool calls (name/duration/error),
config changes. `/telemetry` command to toggle at runtime.

**The design principle:** "only numeric/enum/hashed fields; no user content."
This is the right mental model for analytics that you'd be comfortable committing
to a repo or shipping. Nothing sensitive, just behavioral signals.

**WibWob-DOS application:** This is the evolved version of our `usage-pulse.ts`.
The key upgrade: separate `session`, `model_call`, `tool_call`, and `config_change`
event types vs our current single blob. The hashed `cwdHash` gives cross-session
correlation without exposing paths. Worth copying the event schema directly.

---

#### `pi-logger` — event bus JSONL logger

Subscribes to pi's event bus, writes structured JSONL. One file per day.
Global scope writes to `~/.pi/agent/logs/`; project scope to `.pi/logs/`.
Configurable: min level, event whitelist/ignore, channel whitelist/ignore.
`/logger` command for runtime config changes without restart.

**The key insight:** every extension emits events. `pi-logger` subscribes to
all of them centrally. You get a full trace of every session — what extensions
fired, in what order, with what data — without each extension needing its own
logging. This is structured logging via pub/sub, not inline console.log.

**WibWob-DOS application:** Our `src/services/app-logger.ts` is the equivalent
but TUI-specific. The event bus pattern is more decoupled — extensions emit,
the logger subscribes, neither knows about the other. Worth considering for
our skill/extension usage analytics pipeline.

---

#### `pi-td` — task management with workflow enforcement

Two tools: `td` (full task lifecycle) and the system prompt injection that makes
every session start with the mandatory workflow. The injection adds to `systemPrompt`
via `before_agent_start`:

```
Every code change requires a task.
1. td status → 2. td create → 3. td start → 4. work → 5. td handoff
```

The workflow is enforced via system prompt, not tool restrictions. The assumption
is that an agent that reads the rules will follow them. The Pi session in `AGENTS.md`
adds the worktree mandate on top.

**WibWob-DOS application:** This is structurally similar to our `.pi/todos/`
extension plus the `AGENTS.md` conventions. The key gap: our todo system is a
whiteboard, not a task lifecycle tracker. `pi-td` has: created → in_progress →
review → approved/rejected → closed, with `td log` for progress notes at each
step. That's the arc our planning briefs cover but our todos don't.

---

#### `pi-workon` — project context switching

Two tools:
- `workon` — switch project: loads `AGENTS.md`, git status, open td issues
- `project_init` — detect stack (package.json, Cargo.toml, pyproject.toml etc.),
  scaffold `AGENTS.md`, `.pi/`, and td task tracking

Auto-discovers projects by scanning `~/Dev`. The `switch` action is what happens
at session open for anyone working across multiple repos.

**WibWob-DOS application:** Our `wibwob-session-briefing.sh` sketch does this for
one repo. The `project_init` stack detection is worth borrowing for `agents-md-manager`
— auto-detect and scaffold rather than requiring manual creation.

---

### Tier 2: Interesting but not immediate

---

#### `pi-a2a` — Agent-to-Agent protocol v0.3.0

Full A2A protocol implementation. Serves an Agent Card at
`/.well-known/agent-card.json`. Handles JSON-RPC 2.0. SSE streaming for
real-time task status. Webhook push notifications. Optional hub registration
for centralized discovery.

This is the Google/Anthropic agent interoperability standard. Makes your pi
agent discoverable and callable by any A2A-compliant system.

**One sentence:** Turns pi into a standards-compliant agent that other agents
(from any vendor) can discover and call.

**Skip for now:** No immediate WibWob-DOS use case. Revisit if we want to expose
the WibWob-DOS control API as an A2A endpoint.

---

#### `pi-cmux` — cmux terminal integration

Connects pi to the cmux terminal (https://cmux.dev). Detects via env vars
and Unix socket. Provides tools: split panes, read other terminals, send
commands, browser control.

**One sentence:** If you run pi inside cmux, this gives it eyes on other panes
and the ability to split the terminal — like gstack's browse but for terminals.

**Skip for now:** We use tmux, not cmux. But the pane orchestration pattern
(read other terminal output, send keys to another pane) is exactly what a
`tmux-aware` extension for WibWob-DOS would look like.

---

#### `pi-brave-search` — Brave Search API tool

Registers a `brave_search` tool. Queries Brave Search API, returns structured
results (title, URL, description, published date). Configurable max results
and safe search.

**One sentence:** Web search tool using Brave's API, for agents that need
to look things up without a browser.

---

#### `pi-openrouter` — OpenRouter provider

Registers OpenRouter as a model provider. Supports OAuth device flow for
no-API-key setup. Model list fetched and cached from OpenRouter's API.

**One sentence:** Adds OpenRouter as a provider so you can access 100+ models
through one extension, useful if you want model diversity without managing
separate API keys.

---

#### `pi-webserver` / `pi-web-dashboard` / `pi-webnav`

`pi-webserver` — shared HTTP server that other extensions mount onto. Extensions
emit `web:mount` events to register routes. `pi-web-dashboard` provides a landing
page. `pi-webnav` provides a top-nav shell with iframe routing.

**One sentence:** Shared web server + dashboard hub for extensions that want
a browser UI — the extensions emit route mounts, the server handles auth and
routing.

---

#### `pi-penpot` — Penpot design tool integration

Reads Penpot pages and components, reads/writes comments, tools for page and
component inspection.

**One sentence:** Design system integration — lets an agent read design files
and comment on pages, useful if you use Penpot for UI design.

---

### Tier 3: Skip entirely (personal/peripheral)

| Extension | One-sentence description |
|-----------|--------------------------|
| `pi-channels` | Bidirectional agent messaging via Telegram and webhooks, with persistent RPC sessions per sender |
| `pi-calendar` | Calendar tool with advanced recurrence, month/year/agenda views, and event reminders |
| `pi-cron` | Cron scheduler — runs agent prompts on a schedule with web UI |
| `pi-heartbeat` | Periodic health checks via isolated subprocesses with alerting and web dashboard |
| `pi-gmail` | Gmail read/search/send tool with thread-aware formatting |
| `pi-kysely` | Shared SQLite database registry with Kysely query builder and table-level RBAC |
| `pi-memory` | _(Tier 1 — covered above)_ |
| `pi-myfinance` | Personal finance tracker — accounts, transactions, budgets, bank import |
| `pi-npm` | npm workflow tool (install, publish, version, audit, 15 actions) |
| `pi-personal-crm` | Contacts, companies, interactions, reminders — personal CRM on SQLite |
| `pi-projects` | Auto-discovers git repos, tracks branch/dirty/ahead-behind, web dashboard |
| `pi-supabase` | Read-only Supabase queries with realtime subscriptions via Kysely |
| `pi-vault` | Obsidian vault integration — 16 actions, health dashboard, REST API or filesystem fallback |
| `pi-dotenv` | Deprecated no-op — config now via settings.json |
| `pi-todoist` | Todoist task sync — projects, sections, tasks, comments, labels |
| `pi-untappd` | Beer check-in tracker (Untappd RSS) with decay scoring and web UI |

---

## Part 3 — Skills

### `handoff` — session context transfer ⭐ highest priority

Generates a self-contained prompt for a fresh agent session. Philosophy:
"self-contained, actionable, honest, minimal." The workflow:

1. Gather state from filesystem (not conversation memory)
2. Identify current goal and progress
3. List what's done vs in-flight vs blocked
4. Include exact commands to run first in the new session
5. State what the new agent must NOT do (common pitfalls)

The filesystem verification step is the critical insight: don't trust the
conversation about what was done — verify against the actual files. A handoff
prompt that references a function that was never actually written is worse than
no handoff prompt.

**WibWob-DOS application:** This is the missing companion to our session-archaeology
and devlog-briefing skills. When a session ends, `handoff` runs and produces
a `scratch/handoff-YYYY-MM-DD.md` that the next session loads. Combined with
`wibwob-session-briefing.sh`, this becomes: session open = briefing + handoff
from last session + wibwob status.

---

### `td` — task and session management

Full task lifecycle skill with session workflow:
`td usage --new-session` → `td status` → `td next` → `td start` → `td log` →
`td handoff` → `td review`

The `td log` entries have explicit types: progress / blocker / decision /
tried / result. This is richer than our todos (which have title + body).
The `decision` log type in particular captures the reasoning that our planning
briefs try to record but often miss mid-implementation.

**WibWob-DOS application:** The `decision` and `tried` log types should be
in our todos extension. Currently we have open/closed status and a body.
Adding a `type: "decision" | "tried" | "blocker"` field to log entries would
make todos much more useful as a session history artifact.

---

### `code-review` — systematic review checklist

Five categories, TypeScript/Node.js focused. The security section is the
strongest: input validation, parameterized SQL, path traversal, auth checks.
The conventions check ("consistent with codebase patterns") is what makes it
project-aware vs generic.

**WibWob-DOS application:** Our `code-reviewer` agent should adopt this checklist
format explicitly. Especially the path traversal and auth sections — relevant
for anything touching the control API.

---

### `changelog-generator` — git history → Keep a Changelog

Filters signal from noise (typo fixes, CI tweaks, merge commits). Categorizes
by Conventional Commit prefix or freeform. Handles both initial generation and
incremental updates.

**WibWob-DOS application:** We have a commit skill but not a changelog skill.
This pattern — git log → categorize → generate human-readable entry — is
exactly what our `scripts/devlog.sh` does manually. Could replace it.

---

### `agents-md-manager` — cross-project AGENTS.md audit

Scans all projects, checks AGENTS.md / .pi/ / td status, flags missing or
stale files, scaffolds new ones. Runs `project_init` in batch mode.

**WibWob-DOS application:** Direct equivalent: a skill that scans all our
`microapps/*/` directories, checks each has `microapp.json` + working
`describeState()`, flags missing lifecycle hooks. Our `microapp-smoke.sh`
does a runtime version of this; this would be a static audit.

---

### `weekly-review` — structured weekly retrospective

Pulls git logs across all projects, reads Obsidian daily notes, queries the
jobs database for cost/token stats. Produces: Wins / Active Projects / Goals /
Blockers / Next Week priorities.

**One sentence:** Personal weekly retrospective that reads git, Obsidian vault,
and agent job stats to produce a structured review — skip for now (Obsidian/
Hannah-specific), but the multi-source aggregation pattern is directly applicable
to our `retro` equivalent.

---

### `project-manager` — code + knowledge base sync

Maps projects across two systems (Dev folder + Obsidian vault). Knows all project
locations, stacks, and relationships.

**One sentence:** Keeps code repos and Obsidian notes in sync — skip for now
(Obsidian-specific), but the bi-directional project registry concept is worth
noting.

---

### Skip entirely (out of scope)

| Skill | One-sentence description |
|-------|--------------------------|
| `blog-post` | Drafts blog posts from notes or requirements, Espen's personal style |
| `npm` | npm workflow wrapper — covered by pi-npm extension |
| `npmjs` | Publishing to npmjs.com |
| `obsidian-vault` | Obsidian-specific vault operations |
| `pdf-reader` | Extracts text from PDFs via a Python script |
| `readme-reviewer` | Generates and reviews README files |
| `sales-playbook` | Sales conversation guidance — personal/business use |
| `sample-skill` | Template for creating new skills |
| `workon` | Thin wrapper over the workon tool — covered above |

---

## Part 4 — How They Work Together

### The cohesion mechanism: the event bus

Every extension communicates through a shared event bus
(`pi.events.emit` / `pi.events.on`). No extension imports another directly.
This is the architectural difference between espennilsen/pi and a bag of tools.

```
pi-td injects system prompt via before_agent_start
    ↓
pi-model-router classifies the prompt via before_agent_start
    ↓
pi-memory injects MEMORY.md via before_agent_start
    ↓
(LLM receives: system prompt + td workflow + memory + model routing)

During session:
    any extension → pi.events.emit("log", { level, message, data })
    pi-logger subscribes → writes to YYYY-MM-DD.jsonl

    any extension → pi.events.emit("web:mount", { prefix, handler })
    pi-webserver subscribes → mounts route

After session:
    pi-jobs subscribes to session_end → records cost/tokens/duration
    pi-telemetry subscribes to all events → records behavioral signals
```

**The key insight:** adding a new extension doesn't require modifying any
existing extension. They compose via events. This is structurally analogous
to our COAT principle (one owner per concept, no cross-contamination) but
implemented at the runtime layer, not the architectural layer.

### The session lifecycle

A typical session:

```
session_start
  ↓ pi-logger: begin JSONL
  ↓ pi-telemetry: record session_start with cwdHash
  ↓ pi-td: inject task workflow into system prompt
  ↓ pi-memory: inject MEMORY.md + recent daily log
  ↓ pi-workon: load project AGENTS.md + git status

before_agent_start
  ↓ pi-model-router: classify → switch model if needed

[agent runs, tool calls, user interaction]

  ↓ pi-logger: records all events
  ↓ pi-telemetry: records model_call and tool_call events
  ↓ pi-jobs: tracks token usage and cost incrementally

session_end
  ↓ pi-jobs: write final record (tokens, cost, duration, tool stats)
  ↓ pi-telemetry: record session_end with reason + durationMs
  ↓ pi-memory: (if memory tool was used) persist new entries
```

The agent never knows this is happening. It just gets a richer system prompt
and its tool calls are observed and recorded.

### The `handoff` → `session_start` continuity chain

This is the closest thing to gstack's retro → `/ship` handoff loop:

```
Session N ends:
  → agent runs `handoff` skill
  → reads git state, file state, todo state from filesystem
  → writes scratch/handoff-YYYY-MM-DD.md

Session N+1 opens:
  → pi-workon.switch() loads AGENTS.md + git status
  → pi-memory injects MEMORY.md + recent daily log
  → agent manually reads handoff file (not auto-injected — gap)
  → td usage --new-session shows open tasks
```

The gap: the handoff file is not auto-injected. It requires the agent to
remember to read it, or the user to explicitly ask. gstack's retro → projects/
file → `/ship` chain is more automated. The handoff skill produces the artifact;
the session startup doesn't yet consume it.

---

## What This Means for WibWob-DOS

### The six most directly applicable things

**1. Handoff skill** — build it. One skill that reads git/files/todos and produces
`scratch/handoff-YYYYMMDD.md`. Auto-inject via `wibwob-session-briefing.sh`.
Closes the session continuity gap that costs 15–20 minutes of archaeology per session.

**2. pi-context `/context` command** — implement it. Shows token cost per loaded
skill/extension/agent. Makes the "which skills cost what?" question answerable
in seconds. Critical for skill consolidation decisions.

**3. pi-telemetry event schema** — upgrade `usage-pulse.ts`. Separate `session`,
`model_call`, `tool_call` event types. Hash the cwd. Per-day JSONL at
`~/.pi/analytics/`. The behavioral signals are the same; the schema is just cleaner.

**4. pi-model-router pattern** — for subagent spawning. When a microapp-developer
spawns a "just check the docs" sub-task, route it to haiku automatically.
The `before_agent_start` hook + regex rules is 30 lines of TypeScript.

**5. `td` log types** — add `type: "decision" | "tried" | "blocker"` to our todo
body entries (or a structured log append). The decision type in particular closes
the gap between "we implemented X" and "we implemented X because Y was tried
and failed for Z reason."

**6. Event bus pattern for extensions** — consider for microapp SDK.
Right now microapps talk to the host via `MicroappHost`. An event bus
(`host.events.emit` / `host.events.on`) would let microapps communicate
without the host being a bottleneck. Longer-term; not immediate.

### What gstack does that espennilsen/pi doesn't

- **Generated docs** — SKILL.md.tmpl → gen-skill-docs.ts → committed SKILL.md
- **CI freshness gate** — `--dry-run` fails PR if docs are stale
- **Safety hooks** — PreToolUse intercepts (careful/freeze/guard)
- **Ship ceremony** — test bootstrap, coverage audit, PR flow, doc-release

### What espennilsen/pi does that gstack doesn't

- **Persistent memory** — cross-session facts, daily logs, auto-injected
- **Cost tracking** — per-session, per-model, per-channel economics
- **Model routing** — automatic model selection by task complexity
- **Context visibility** — `/context` shows token cost breakdown
- **Pool agents** — long-lived agents with persistent context
- **Handoff** — structured session transfer artifacts
- **Event bus architecture** — extensions compose via events, not imports

Together they cover: workflow ceremonies (gstack) + persistent intelligence
(espennilsen). Both are worth stealing from. Neither is a complete system for
WibWob-DOS — our terminal desktop + microapp SDK is a third thing entirely.
