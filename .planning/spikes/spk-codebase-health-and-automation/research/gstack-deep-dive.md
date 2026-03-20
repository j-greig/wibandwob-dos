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
