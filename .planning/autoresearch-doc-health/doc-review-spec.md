# Doc Review — Semantic + Functional Health via Subagent

## The gap

`doc-health.sh` is a 15-axis structural gate. It answers: are the links, headers, and loops intact? It cannot answer: are the docs accurate, helpful, or sufficient?

## Three tiers of doc health

| Tier | Tool | What it catches | Speed |
|------|------|----------------|-------|
| **Structural** | `doc-health.sh` | Missing links, broken loops, stale outputs, word bloat | ~2s, deterministic |
| **Semantic** | Subagent (LLM judge) | Redundancy, inaccuracy, delta violations, stale gotchas | ~30s, probabilistic |
| **Functional** | Subagent (task test) | Can an agent actually build a microapp from CAPS files alone? | ~60s, probabilistic |

Tier 1 is done (15/15). Tiers 2 and 3 need an agent.

## `scripts/doc-review.sh`

Spawns a subagent for each tier, collects results, outputs a unified report.

```bash
bash scripts/doc-review.sh              # all three tiers
bash scripts/doc-review.sh --semantic   # tier 2 only
bash scripts/doc-review.sh --functional # tier 3 only
```

### Tier 2: Semantic review (subagent)

Prompt:

```
You are a delta compression judge reviewing WibWob-DOS documentation.

Read each CAPS file. For each one score 0-10:
- 10: every sentence is delta — specific to this repo, not standard knowledge
- 5: mixed — some standard patterns restated
- 0: could be any project

Also check:
- GOTCHAS.md entries older than 2 weeks → suggest promotion to parent CAPS file or deletion
- Any CAPS file reference to a file/path/command that no longer exists
- Any section that contradicts another CAPS file

Output JSON: {"files": [{"name": "X.md", "delta_score": N, "issues": ["..."]}], "gotchas_review": ["..."]}
```

### Tier 3: Functional test (subagent)

Prompt:

```
You have access ONLY to the files listed below. Using only this information,
create a working WibWob-DOS microapp that opens a window and displays "Hello".

Files you may read: AGENTS.md, SDK.md, GOTCHAS.md, ARCHITECTURE.md

Do NOT read any source code, existing microapps, or other files.
Report: did you succeed? What was unclear? What was missing?

Output JSON: {"success": true/false, "blockers": ["..."], "unclear": ["..."], "missing": ["..."]}
```

This is the real test — if a fresh agent can't build a microapp from the CAPS files, the delta compression went too far.

## Output format

```
doc-review — 2026-03-20

Tier 1 (structural):  15/15 ✓
Tier 2 (semantic):    8.2/10 avg delta score
  AGENTS.md:        8/10 — 3 redundancies
  PHILOSOPHY.md:    9/10 — 1 redundancy
  ARCHITECTURE.md:  8/10 — 2 redundancies
  SDK.md:           8/10 — 2 redundancies
  GOTCHAS.md:       9/10 — 0 redundancies
  Promotion candidates: 1 gotcha ready to promote
Tier 3 (functional):  PASS
  Agent built microapp successfully from CAPS files alone
  Unclear: "where does microapp.json go — microapps/ or microapps-private/?"
  Missing: nothing critical
```

## When to run

- **Tier 1:** every commit (pre-commit hook, ~2s)
- **Tier 2:** weekly or after major doc changes (~30s, needs API)
- **Tier 3:** after any CAPS file rewrite (~60s, needs subagent)

## Implementation order

1. `scripts/doc-review.sh --semantic` — subagent delta judge, parse JSON response
2. `scripts/doc-review.sh --functional` — subagent task test, parse JSON response
3. `scripts/doc-review.sh` — runs all three tiers, unified report
4. Wire tier 2 into autoresearch loop as secondary metric (informational, doesn't gate keep/discard)

## Dependencies

- `~/.pi/agent/agents/worker.md` — exists ✓
- Subagent tool — available ✓
- haiku model for tier 2 (cheap, fast) — available ✓
- sonnet model for tier 3 (needs reasoning) — available ✓
