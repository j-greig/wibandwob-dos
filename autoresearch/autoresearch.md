# Autoresearch: Journal Auto-Capture Pipeline

## Objective

Optimise the **session → journal entry** summarisation pipeline for WibWob-DOS.
Given a pi agent session JSONL log, produce a high-quality structured journal entry
(title, body, kind, tags, peer) that a human or agent would find useful when browsing
the journal later.

The workload: parse session JSONL → extract signal → generate summary → score quality.
We iterate on the extraction + prompting logic to maximise a composite quality score.

## Metrics

- **Primary**: `quality_score` (0–100, higher is better) — composite heuristic:
  - Title quality (10 pts): specific, concise, not generic ("Untitled"/"Session summary")
  - Body completeness (30 pts): mentions files changed, decisions made, outcomes
  - Body structure (15 pts): has markdown sections, reasonable length (50–500 words)
  - Tag relevance (15 pts): tags match file paths / topics actually discussed
  - Kind accuracy (10 pts): kind matches session content (discovery/decision/note)
  - Brevity efficiency (10 pts): information density — signal per word
  - Backlink integrity (10 pts): sessionId, filename preserved correctly
- **Secondary**: `latency_ms` (time to process one session), `token_count` (prompt + completion size)

## How to Run

```bash
cd autoresearch && ./autoresearch.sh
```

Outputs `METRIC name=number` lines parsed by the autoresearch tooling.

## Files in Scope

| File | Purpose |
|------|---------|
| `autoresearch/summariser.py` | Core pipeline: parse JSONL → extract context → build prompt → call LLM → score output |
| `autoresearch/scorer.py` | Heuristic scoring functions for quality_score breakdown |
| `autoresearch/prompt.txt` | System/user prompt template for the summarisation LLM call |
| `autoresearch/autoresearch.sh` | Benchmark runner — runs summariser on sample sessions, aggregates scores |
| `autoresearch/autoresearch.checks.sh` | Typecheck + structural validation |

## Off Limits

- `microapps/journal/index.ts` — UI changes come after pipeline is proven
- `src/` — no shell internals changes
- Session JSONL files themselves — read-only
- Don't add npm/bun dependencies to the main project

## Constraints

- Python 3 only for the pipeline scripts (available via system python3)
- LLM calls via `anthropic` Python SDK (pip install if needed) or shell `curl` to Anthropic API
- Must handle sessions of 5–200 messages without crashing
- Output must be valid JSON matching the JournalEntry shape
- `bun run typecheck` must still pass (autoresearch.checks.sh validates this)
- Each benchmark run should complete in < 60s for a batch of 5 sessions

## Sample Sessions

The benchmark uses 5 diverse sessions from `~/.pi/agent/sessions/--Users-james-Repos-wibandwob-dos--/`:
- Pick sessions with varying lengths (short 5-msg, medium 20-msg, long 50+ msg)
- Pick sessions with different activities (coding, debugging, planning, creative)

## What's Been Tried

_Nothing yet — baseline run pending._
