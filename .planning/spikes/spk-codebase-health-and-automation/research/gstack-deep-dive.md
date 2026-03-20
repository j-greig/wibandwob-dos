# gstack Deep Dive — Research Report
## For: spk-codebase-health-and-automation

_Compiled: 2026-03-20. Full audit of vendor/gstack. Goal: understand the self-enforcing
ecosystem and extract what applies directly to WibWob-DOS._

---

## TL;DR

gstack is not a tool collection. It is a **closed-loop quality system** where every
component enforces every other component. Six interlocking mechanisms make it
self-enforcing:

1. **Generated docs** — SKILL.md.tmpl → gen-skill-docs.ts → committed SKILL.md
2. **CI freshness gate** — `gen:skill-docs --dry-run` fails PR if docs are stale
3. **Pre-session preamble** — update check + session tracking runs before every skill
4. **PreToolUse hooks** — safety skills intercept Bash/Edit/Write before execution
5. **Analytics** — every skill invocation writes to `~/.gstack/analytics/skill-usage.jsonl`
6. **Versioned binary** — `git rev-parse HEAD` baked into binary; stale server auto-killed

Each of these is individually useful. Together they create a system that:
- cannot have stale docs (gen + CI gate)
- cannot have unknown agent behavior (analytics)
- cannot have destructive accidents (hooks)
- cannot have stale runtime (version auto-restart)

---

## The 5 Whys gstack's patterns work — and why they're right for WibWob-DOS

### Why 1 — Generated docs eliminate the drift problem permanently

**gstack:** `gen-skill-docs.ts` reads `COMMAND_DESCRIPTIONS` from `commands.ts` and
`SNAPSHOT_FLAGS` from `snapshot.ts`. These are the source of truth. If a command
exists, it appears in docs. If it doesn't exist, it can't appear. CI runs
`--dry-run` and fails if committed SKILL.md doesn't match what generation produces.

**Why it works:** The invariant is structural, not social. You don't need someone
to remember to update the docs. The system won't let docs and code diverge.

**WibWob-DOS application:**
- `sdk-export-index.sh`: reads `src/services/microapp-sdk.ts`, groups by `@public/@beta/@internal`,
  writes `docs/sdk-export-index.md`. Add `--dry-run` flag. Wire into `health-full.sh`.
- `doc-drift-check.sh`: parses `.agents/guides/microapp/*.md` for microapp/ path refs,
  verifies each path exists. Exit 1 on broken refs.
- The key insight: our pitfalls.md, sdk-reference.md, and examples-by-tier.md all
  reference real paths and symbols. Those can be machine-verified. We should.

---

### Why 2 — The preamble pattern makes every skill self-aware

**gstack:** Every SKILL.md starts with `{{PREAMBLE}}` — a bash block that:
1. Runs `gstack-update-check` — checks remote VERSION, outputs `UPGRADE_AVAILABLE` or nothing
2. Touches `~/.gstack/sessions/$PPID` — tracks concurrent sessions
3. If 3+ sessions: enters "ELI16 mode" — every question re-grounds context
4. Reads config for `proactive` flag — agent won't suggest skills if user opted out
5. Appends to `~/.gstack/analytics/skill-usage.jsonl` — usage tracking
6. Checks `~/.gstack/.completeness-intro-seen` — one-time "Boil the Lake" essay prompt

This runs before the skill's own logic. The agent always knows: what version it is,
whether an upgrade exists, how many sessions are running, and whether the user wants
proactive suggestions.

**Why it works:** Self-awareness is pre-loaded. The agent doesn't have to figure out
"what state am I in?" — the preamble answers it in one bash block.

**WibWob-DOS application:**
- Our microapp triad skills could run a mini-preamble: check `wibwob instances`,
  verify the canonical instance (manifest exists), log skill usage to
  `.pi/metrics/usage-last-seen.json`. One block, pre-wired.
- `wibwob status` gives us the equivalent of gstack's health signal. Skills should
  call it first to confirm instance is alive before doing anything else.

---

### Why 3 — PreToolUse hooks make safety modes structural, not advisory

**gstack:** The `careful`, `freeze`, and `guard` skills use Claude Code's
`PreToolUse` hooks (SKILL.md frontmatter `hooks:` field). The hook fires a
shell script before every Bash/Edit/Write tool call. If the script exits non-zero,
the tool call is blocked.

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-careful.sh"
```

`check-careful.sh` greps the command for dangerous patterns (`rm -rf`, `DROP TABLE`,
`git push --force`, etc.). Build artifact cleanups are whitelisted. The agent can
override — but it must acknowledge the warning first.

`freeze` uses the same mechanism for Edit/Write: checks if the target path is
inside the freeze boundary. If not, exit 1.

`investigate` combines both: auto-freezes to the module being debugged. The freeze
is structural — not a note in the prompt, not a convention, but an actual tool
interceptor.

**Why it works:** "Please be careful" in a prompt is ignored under pressure.
A pre-tool hook that exits 1 cannot be ignored. The safety mode is enforced at
the execution layer, not the reasoning layer.

**WibWob-DOS application:**
- A `careful-wibwob` skill with PreToolUse hooks for:
  - Bash: warn on `kill -9`, `bun run dev` (starts new instance), `git push --force`
  - Edit: warn on edits to `src/core/app-controller.ts` (god file, high blast radius)
  - Write: warn on writes to `microapps/*/microapp.json` that change `id:` field (breaks command surface)
- Not immediate priority — but this is the right model for production safety in a
  shared terminal environment.

---

### Why 4 — The version-aware restart prevents the "stale binary" class of bugs

**gstack:** `build` script writes `git rev-parse HEAD` to `browse/dist/.version`.
At CLI invocation time, if the running server's `binaryVersion` doesn't match the
binary's `.version`, the CLI kills the old server and starts fresh.

This is the gstack equivalent of our reload invalidator — but at the binary level,
not the file-mtime level.

```
build → bakes HEAD sha into binary
CLI start → read .version from binary
CLI → GET /health from running server → get binaryVersion
mismatch → kill server → restart with new binary
```

**Why it works:** The stale-runtime problem is entirely structural. You don't need
to remember to restart. The version check happens on every invocation. Rebuild =
automatic restart on next use.

**WibWob-DOS application:**
- We already have the reload invalidator (S2). The next step would be to embed the
  git sha into the runtime control manifest and expose it via `/health`.
- `wibwob health` could then show `gitSha: abc1234 (same as running)` or
  `gitSha: HEAD changed since boot — restart recommended`.
- The `scripts/restart.sh` already exists. Make it automatic: if git sha changed,
  prompt restart before next wibwob command.

---

### Why 5 — Analytics make invisible usage visible

**gstack:** Every skill invocation appends to `~/.gstack/analytics/skill-usage.jsonl`:
```json
{"skill":"ship","ts":"2026-03-20T09:00:00Z","repo":"wibandwob-dos"}
```

`scripts/analytics.ts` reads this file. `bun run analytics` shows usage frequency
per skill, per repo, over time. The `retro` skill can read it for trend analysis.
The preamble tracks concurrent sessions (3+ = ELI16 mode).

**Why it works:** You can't improve what you can't measure. Usage data answers
"which skills are actually valuable?" with receipts, not vibes. It also enables
adaptive behavior (ELI16 mode when juggling windows).

**WibWob-DOS application:**
- We already have `.pi/metrics/usage-last-seen.json` (last-seen per skill).
- The upgrade: append to a rolling `~/.pi/analytics/skill-usage.jsonl` instead.
- Then `pi-usage-audit` skill reads it, ranks by frequency, flags 30-day inactivity.
- This replaces the current "hope someone runs the audit manually" model.

---

## The Harmony Architecture — how gstack's parts reinforce each other

```
Source code (commands.ts, snapshot.ts)
    │
    │ gen-skill-docs.ts reads
    ↓
SKILL.md.tmpl (human prose + {{PLACEHOLDERS}})
    │
    │ gen-skill-docs.ts resolves placeholders
    ↓
SKILL.md (committed, auto-generated sections)
    │
    │ CI: --dry-run gate on every PR
    ↓
Claude loads SKILL.md at invocation
    │
    │ {{PREAMBLE}} runs first
    ↓
    ├── gstack-update-check → UPGRADE_AVAILABLE or nothing
    ├── session tracking → ELI16 mode if 3+ sessions
    ├── analytics write → usage.jsonl
    └── config read → proactive mode, contributor mode
    │
    │ Skill logic runs
    ↓
    ├── PreToolUse hooks intercept tool calls
    │   ├── /careful: Bash → check-careful.sh
    │   ├── /freeze: Edit/Write → check-freeze.sh
    │   └── /investigate: both (auto-freeze to module)
    │
    ├── Review log: gstack-review-log (per-branch JSONL)
    ├── Eval persistence: _partial-e2e.json (atomic overwrite)
    └── Retro reads: git log + analytics + review logs → trend report
    │
    │ /retro synthesises everything
    ↓
Persistent state: ~/.gstack/
    ├── analytics/skill-usage.jsonl
    ├── projects/<slug>/<branch>-reviews.jsonl
    ├── sessions/<PPID>  (touch file, 2h TTL)
    ├── last-update-check
    └── just-upgraded-from
```

Every loop is closed:
- Docs drift: gen + CI gate
- Stale runtime: version check + auto-restart
- Destructive accidents: PreToolUse hooks
- Usage blindness: analytics jsonl
- Session chaos: PPID touch files + ELI16 mode
- Upgrade lag: preamble update check on every invocation

---

## The skill taxonomy (docs/skills.md)

| Role | Skill(s) | Phase |
|------|---------|-------|
| YC Partner | `/office-hours` | Before any code |
| CEO/Founder | `/plan-ceo-review` | Product vision |
| Eng Manager | `/plan-eng-review` | Technical plan |
| Senior Designer | `/plan-design-review`, `/design-consultation`, `/design-review` | Design |
| Staff Engineer | `/review` | Code review |
| Debugger | `/investigate` | Bug fixing |
| QA Lead | `/qa`, `/qa-only` | Testing |
| Release Engineer | `/ship` | Deployment |
| Technical Writer | `/document-release` | Post-ship docs |
| Eng Manager | `/retro` | Reflection |
| QA Engineer | `/browse` | Browser testing |
| Session Manager | `/setup-browser-cookies` | Auth setup |
| Safety | `/careful`, `/freeze`, `/guard`, `/unfreeze` | Guardrails |
| Updater | `/gstack-upgrade` | Maintenance |
| Multi-AI | `/codex` | Second opinion |

The full lifecycle: `office-hours → plan-ceo → plan-eng → implement → review → qa → ship → document-release → retro`

Each skill is a specialist. Each has a clear "does NOT" boundary. The `/review`
skill doesn't plan. The `/plan-ceo-review` skill doesn't review code. They
hand off via artifacts in `~/.gstack/projects/`.

---

## What gstack has that we don't (honest gap list for WibWob-DOS)

| Gap | gstack has | We have | Delta |
|-----|-----------|---------|-------|
| Generated docs | `gen-skill-docs.ts` + CI gate | `sdk-export-index.sh` (planned) | Build the script |
| Doc drift detection | `skill-check.ts` validates all SKILL.md refs | `doc-drift-check.sh` (planned) | Build the script |
| Pre-session preamble | `{{PREAMBLE}}` in every skill | Manual instance check | Add to skill templates |
| PreToolUse safety hooks | `careful`/`freeze`/`guard` | None | Low priority but powerful |
| Version-aware restart | Git sha in binary, auto-kill stale server | Reload invalidator (file mtime) | Extend to git sha |
| Usage analytics | `skill-usage.jsonl` per session | `usage-last-seen.json` (last-seen only) | Rolling append log |
| Review persistence | `<branch>-reviews.jsonl` per project | None | Add to `wibwob` workflow |
| Eval framework | 3-tier: static / E2E / LLM-judge | `bun run test` (unit only) | Long-term: LLM eval tier |
| Multi-session awareness | PPID touch files + ELI16 mode | `wibwob instances` | Already solved differently |
| Self-upgrade | `gstack-update-check` + inline flow | `bun add` manually | Low priority |

---

## `.pi/extensions/usage-pulse.ts` — Constructive Review

_This is our existing starter for the analytics pattern. Read it against gstack's
`skill-usage.jsonl` model to understand what it does well, what's missing, and
what to fix._

### What it does well

- **Atomic writes** via tmp + rename — no partial JSON on crash. Correct.
- **Write cooldown (5min per key)** — prevents hammering disk on busy sessions. Correct.
- **Tool result + message_end hooks** — catches skill reads AND command invocations AND agent mentions. Broad signal coverage.
- **Extension index auto-refresh** — scans `.pi/extensions/*.ts` for `registerCommand` and tool names. Self-discovering.
- **Sources list (last 8)** — per-entry context showing how a skill was invoked. Useful for audit.
- **`findRepoRoot` walk** — finds `.pi/` root correctly even from subdirectory CWDs.

### The core structural problem

usage-pulse writes to a **single overwritten JSON file** (`usage-last-seen.json`).
gstack writes to an **append-only JSONL** (`skill-usage.jsonl`).

This is not a minor difference. It is the difference between a **snapshot** and a
**history**. Current state:

```json
{
  "commit": { "lastSeen": "2026-03-19", "count": 2, "sources": ["read:SKILL.md"] }
}
```

What we'd know from a JSONL:
```jsonl
{"skill":"commit","ts":"2026-03-15T10:00Z","source":"read:SKILL.md","repo":"wibandwob-dos"}
{"skill":"commit","ts":"2026-03-19T14:00Z","source":"read:SKILL.md","repo":"wibandwob-dos"}
```

From the snapshot: "commit was seen 2 times, most recently 2026-03-19."
From the JSONL: "commit was used on March 15 and March 19, both from reading SKILL.md.
Between those dates: 4-day gap. No usage since March 19 (5 days). Trend: sporadic."

The `pi-usage-audit` skill currently can only answer "is this stale?" (last-seen > 30 days).
With JSONL it could answer: "trending up or down?", "weekly frequency?",
"used every sprint or only once?", "what's the half-life of this skill?"

### The 5 Whys: why the snapshot model limits us

**Why 1 — Because "count" without timestamps is noise.**
`commit: count=2` tells us nothing about cadence. Was that 2 times in one session
or 2 times over 3 months? The number is meaningless without time distribution.
JSONL preserves when, not just how many.

**Why 2 — Because the audit skill makes the wrong cut.**
`pi-usage-audit` flags skills unused for 30+ days. But a skill used twice in one day
last month looks identical to a skill used once each month for 3 months. Both read
"count=2, lastSeen=30d ago". One is healthy steady usage. One is a one-off. The
snapshot can't distinguish them.

**Why 3 — Because we can't track improvement.**
If we consolidate `chiptune` + `chiptune-cover` + `chiptune-studio` into one skill,
we can't verify from the snapshot whether the merged skill gets used more than its
predecessors. JSONL lets us draw a before/after line at the merge date and compare.

**Why 4 — Because the cooldown hides real usage patterns.**
The 5-minute per-key cooldown was designed to reduce write pressure. But it also
means rapid repeated use in a session is collapsed to a single entry. In a JSONL
model with session-scoped dedup (one entry per session per skill), we get accurate
"sessions touched" count without the false inflation of per-message counting.
The cooldown is a blunt fix for a problem the JSONL model solves structurally.

**Why 5 — Because audit rules need to be data-driven, not hard-coded.**
The current "30 days = stale" threshold is a guess. With JSONL and enough history,
we could compute the natural inter-use interval per skill and flag outliers statistically:
"this skill's median gap is 7 days but it hasn't been used in 45 — that's a 6-sigma
gap, likely dead." The snapshot never lets us get there.

### Constructive improvement checklist

#### Tier 1 — High ROI, low effort (do first)

- [ ] **Add a JSONL append path alongside the snapshot**
  - Keep `usage-last-seen.json` for backwards compat with `pi-usage-audit`
  - Also append to `~/.pi/analytics/skill-usage.jsonl` (global, not per-repo)
  - Entry schema: `{ skill, ts, source, repo, session }` — session = `$PPID` or random UUID per run
  - The append should be fire-and-forget (catch all errors, never block)

- [ ] **Track agents and skills separately in JSONL**
  - Current snapshot merges surfaces (skills/extensions/agents) in one JSON
  - JSONL entry should have a `surface` field: `"skill" | "extension" | "agent"`
  - Enables: `jq 'select(.surface=="agent")' skill-usage.jsonl` for agent-only trends

- [ ] **Add session dedup** — one JSONL entry per skill per session, not per message
  - `Set<string>` of `${surface}:${name}` keyed per session lifetime
  - Prevents one high-activity session from inflating counts vs many low-activity ones
  - The 5-minute cooldown can then be removed (it's solving the same problem badly)

- [ ] **Add `repo` field from `cachedRoot`** — enables cross-repo aggregation later
  - `path.basename(repoRoot)` or `git remote get-url origin` (best-effort)
  - Makes usage data portable if multiple repos share the same `~/.pi/`

#### Tier 2 — Medium ROI, moderate effort

- [ ] **Detect skill invocation via content scan, not just SKILL.md read**
  - Currently a skill is "used" when its SKILL.md is read by the agent
  - Better: also detect when a skill's documented trigger phrases appear in user messages
  - Pattern: `SKILL_PATH_RE` detects file read; add `SKILL_TRIGGER_RE` detects
    phrases like "git oneliners", "simplify this", "devlog" from skill descriptions

- [ ] **Add `skill:check` equivalent — validate all SKILL.md files are well-formed**
  - Script: `scripts/skill-check.sh` (bash port of gstack's `skill-check.ts`)
  - For each `.pi/skills/*/SKILL.md`: check it has a description, has triggers, is < 500 lines
  - Flag skills with no trigger phrase (they can't be auto-selected by the router)
  - Wire into `health-full.sh`

- [ ] **Emit usage metrics to `describeState()` or a diagnostic command**
  - `wibwob cmd pi.usage.summary` → top 5 skills, last-used date, 30-day count
  - COAT-aligned: usage data is a visible capability, not just a hidden file
  - Currently the only way to see it is to read `.pi/metrics/usage-last-seen.json` manually

- [ ] **Write cooldown: per-session, not per-key + time**
  - The current `lastWriteByKey` Map grows unbounded in a long session
  - Replace with a `sessionSeen: Set<string>` that's created fresh per session
  - Simpler, bounded, semantically correct

#### Tier 3 — Long-term

- [ ] **`bun run pi:audit` script** — reads JSONL, computes per-skill stats
  - Metrics: sessions_count, last_session, avg_gap_days, sessions_last_30d
  - Flags: `stale` (gap > 2× median), `trending_down`, `never_used`
  - Replace the current audit skill's grep-based approach with this

- [ ] **LLM eval tier for skills** (gstack: `skill-llm-eval.test.ts`)
  - Grade each skill's description on: trigger-phrase clarity, action specificity, boundary clarity
  - Score 0–10, flag < 7 as "needs description revision"
  - Run: `bun run pi:eval-skills` before any fleet consolidation decision

- [ ] **Cross-skill dependency map**
  - Some skills call other skills (e.g. `vj-timeline` depends on `chiptune-studio`)
  - Map those dependencies so consolidation doesn't silently break call chains
  - Source: grep each SKILL.md for references to other skill names

---

### `.pi/extensions/todos.ts` — Companion review

_todos.ts is the session whiteboard system. Reviewing it here because it works
alongside usage-pulse as part of the "how are we using things" picture, and
because its design choices reveal what the current agent workflow actually
looks like in practice._

**Note on data maturity:** usage-pulse.ts is 1 day old. The current
`usage-last-seen.json` shows only: 4 skills seen, 4 extensions seen, 2 agents
seen — all from a single sprint. This is not a representative signal yet.
**Wait ~1 week before drawing conclusions from usage-pulse data.** By then
you'll have at least 3–5 sessions across different task types and can start
seeing which skills are genuinely load-bearing vs which are one-offs.

#### What todos.ts does well

- **File-per-todo** — each todo is a standalone `.md` file with JSON frontmatter.
  Diff-able, git-trackable, readable by any tool. Not a database.
- **Lock files with TTL** — `<id>.lock` prevents concurrent session conflicts.
  30-minute TTL + interactive steal prompt. Correct concurrency model for
  multi-agent use.
- **Session assignment** — `assigned_to_session` field lets agents claim tasks
  before working, preventing two agents from colliding on the same todo.
- **GC on startup** — closed todos older than `gcDays` (default 7) auto-delete.
  No unbounded accumulation.
- **Atomic writes** — `writeTodoFile` uses direct write (not tmp+rename), but
  the lock file provides the same isolation guarantee for the todo content.
- **Rich TUI** — fuzzy search, keyboard nav, action menu, scrollable detail view.
  Human-first UX that also works for agents via the tool API. COAT-aligned.
- **`claim`/`release` semantics** — explicit ownership handoff between sessions.
  This is the right pattern for agent teams. gstack has nothing equivalent.

#### Gaps and improvements

**Gap 1 — Todos are a whiteboard, not a backlog tracker.**
Current design: short-lived session notes (7-day GC, no planning phases, no
priority field, no sprint/epic linkage). This is correct for its stated purpose
("session whiteboard — two sessions max") but means there's no bridge between
`.pi/todos/` and `.planning/` briefs. Agents create todos for in-session work
but have no structured way to graduate them to `.planning/spikes/` or close out
a story. The link is purely social.

Improvement: add optional `planning_ref` frontmatter field — a path to a
`.planning/` file this todo was created from. Not required. When present,
`todo list` shows the backlink. Agents can follow it to get full context.

**Gap 2 — No usage signal fed back to usage-pulse.**
When an agent calls the `todo` tool, usage-pulse doesn't record it as
"todos extension used" because `todos.ts` registers as a tool (`pi.registerTool`)
not a command (`pi.registerCommand`), and usage-pulse's tool tracking maps
tool names to extensions via `toolToExtension`. This should work — but
`todos.ts` registers its tool as `"todo"` and usage-pulse greps for
`name: "([a-zA-Z0-9_-]+)"` in the source. Check that the mapping is
actually being built for `todos` → `todos.ts`.

Quick verify:
```bash
grep -n 'registerTool\|registerCommand' .pi/extensions/todos.ts | head -5
# should show: pi.registerTool({ name: "todo", ...
# usage-pulse should map "todo" → "todos"
```

**Gap 3 — GC is fire-and-forget with no visibility.**
`garbageCollectTodos` runs on `session_start`, deletes silently, returns void.
No log, no count, no notification. If it deletes something it shouldn't
(e.g. a closed-but-still-relevant todo), there's no trace.
Improvement: log deleted count to stderr or to usage-pulse analytics:
`{"event":"todo_gc","deleted":3,"ts":"..."}`.

**Gap 4 — `claim` has no expiry.**
A claimed todo stays assigned forever until explicitly released. If an agent
session crashes mid-task, the todo stays claimed by the dead session indefinitely.
The lock file has a 30-minute TTL; the `assigned_to_session` field does not.
Improvement: add `claimed_at` timestamp to frontmatter. Surface a warning in
`todo list` when a claimed todo's `claimed_at` is > 2 hours old and the
claiming session is no longer alive (check via PID or session file existence).

**Gap 5 — No bridge to `health-full.sh`.**
The todo system is invisible to the health gate. A session could end with 6
open claimed todos and no health check would surface it.
Improvement: add to `health-full.sh` or `doc-drift-check.sh`:
```bash
OPEN=$(find .pi/todos -name '*.md' | xargs grep -l '"status": "open"' 2>/dev/null | wc -l | tr -d ' ')
ASSIGNED=$(find .pi/todos -name '*.md' | xargs grep -l '"assigned_to_session"' 2>/dev/null | wc -l | tr -d ' ')
echo "  todos: ${OPEN} open, ${ASSIGNED} assigned"
```
Not a gate — just visibility. Lets agents know outstanding work exists before
starting a new session.

#### The relationship to usage-pulse

Todos and usage-pulse answer different questions:
- **usage-pulse**: "which skills/agents/extensions are being used, how often?"
- **todos**: "what work is in flight right now, who owns it?"

Together they form a partial picture of agent workflow state. The missing
third piece is **planning briefs** (`.planning/spikes/*/README.md`) — structured
longer-horizon work that todos graduate into or reference.

When all three are machine-readable and cross-linked, any agent opening a session
can answer: "what's being built (planning), what's in flight (todos), and what
tools are working (usage-pulse)." Right now each is siloed.

A `wibwob-session-briefing.sh` script that summarises all three in one pass
would be high-value — run it at session start instead of doing archaeology:
```
Session briefing:
  Branch: spike/spk-codebase-health-and-automation
  Open todos: 2 (1 assigned to this session)
  Active spike: spk-codebase-health-and-automation (ready)
  Usage pulse: data too fresh (1 day) — check again 2026-03-27
  Instance: 4af (canonical, 159×54)
```

---

### The upgrade in one sentence

> Change `usage-last-seen.json` from a point-in-time snapshot to a session-grain
> JSONL log, add `repo` + `surface` + `session` fields, and keep the snapshot
> as a derived view for backward compat.

That single change makes `pi-usage-audit` go from "which skills might be dead?"
to "which skills are demonstrably dying, and at what rate?"

---

## Direct adaptations — ordered by ROI for WibWob-DOS

### Tier 1: This sprint (spk-codebase-health-and-automation)

**A. sdk-export-index.sh + doc-drift-check.sh** (gstack: gen-skill-docs + skill-check)
```bash
# sdk-export-index.sh — reads src/services/microapp-sdk.ts, writes docs/sdk-export-index.md
# Groups by @public/@beta/@internal JSDoc tags
# Add --dry-run flag → exit 1 if committed file doesn't match generation
# Wire into health-full.sh

# doc-drift-check.sh — parses .agents/guides/microapp/*.md for microapp/ path refs
# Verifies each referenced path exists
# Greps for SDK symbols and warns if not in sdk-export-index.md
# Exit 1 on broken refs
```

**B. Usage analytics append** (gstack: skill-usage.jsonl)
```bash
# In each .pi/skills/*/SKILL.md preamble, append:
# echo '{"skill":"<name>","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"wibandwob-dos"}' \
#   >> ~/.pi/analytics/skill-usage.jsonl 2>/dev/null || true
```

### Tier 2: Near-term

**C. Git sha in health output + restart nudge** (gstack: version-aware restart)
```bash
# Add to control-manifest.json: "gitSha": "<git rev-parse HEAD>"
# Add to wibwob health output: warn if gitSha changed since manifest was written
# wibwob status shows: "git sha: abc1234 (same as boot)" or "⚠ source changed since boot"
```

**D. Skill preamble template** (gstack: {{PREAMBLE}})
- Add a `wibwob-preamble.sh` snippet for microapp triad skills
- Runs: `wibwob status` (verify instance alive), `wibwob instances` (find canonical),
  append to usage analytics
- Paste into SKILL.md of microapp-developer, microapp-doc-refiner, microapp-product-owner

### Tier 3: Long-term

**E. PreToolUse safety hooks** (gstack: careful/freeze/guard)
- `careful-wibwob` skill with hooks for:
  - kill -9 on wibwob processes
  - edits to app-controller.ts, command-catalog.ts (high blast radius)
  - microapp.json id: field changes (breaks command surface)

**F. LLM eval tier** (gstack: skill-llm-eval.test.ts)
- Grade microapp SDK docs on clarity/completeness/actionability
- Run: `bun run sdk:eval` → LLM-as-judge on sdk-reference.md + examples-by-tier.md
- Track grade over time, alert on regression

---

## The "Boil the Lake" principle — applied to WibWob-DOS

gstack's philosophy (from the CLAUDE.md completeness table):

> Always do the complete thing when AI makes the marginal cost near-zero.
> Don't recommend shortcuts when the complete implementation is a "lake" (achievable)
> not an "ocean" (multi-quarter migration).

For us, the lakes are:
- Writing `health-full.sh` properly (lake: 1h, ocean: none)
- Building `sdk-export-index.sh` (lake: 1h, ocean: none)
- Adding `--dry-run` to generation scripts (lake: 30m)
- Appending analytics in skill preambles (lake: 15m per skill)
- Embedding git sha in health manifest (lake: 30m)

We've been treating these as optional polish. gstack's model says: these are the
floor. Ship the floor. AI makes it cheap. Do it.

---

## The one meta-pattern to internalize

gstack's ARCHITECTURE.md says:

> "The key insight: an AI agent interacting with a browser needs sub-second latency
> and persistent state."

Their insight about the browser applies equally to our codebase:

> "An AI agent working in a codebase needs instant truth signal and persistent state."

The truth signal is `bun run health-full`. The persistent state is:
- `~/.wibwob/runtime/control-manifest.json` (runtime identity)
- `docs/sdk-export-index.md` (SDK surface, generated)
- `.agents/guides/microapp/*.md` (docs, drift-checked)
- `.pi/analytics/skill-usage.jsonl` (skill usage, rolling)

When those four things are reliably accurate and machine-verified, any agent can
open this codebase and know where they stand in seconds. That's the end state.
That's what this spike builds toward.
