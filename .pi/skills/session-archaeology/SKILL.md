---
name: session-archaeology
description: >
  Mine Claude Code session logs to find which subsystems cause the most
  agent confusion, regressions, and repeated human re-explanation. Three-step
  pipeline: extract JSONL to searchable markdown, regex-scan for quantitative
  trouble ranking, then LLM deep-analysis of worst sessions for semantic
  patterns regex can't catch. Use when: auditing agent experience, planning
  which subsystems need specs first, building trigger tables, investigating
  why agents keep getting something wrong, or feeding a codified context
  infrastructure (E001 pattern).
---

# Session Archaeology

Mine Claude Code session logs to find where agents struggle most.

## When to use this

- Planning which subsystems need machine-readable specs
- Investigating repeated agent failures in a domain
- Building trigger tables for specialist routing
- Auditing agent experience quality across a project
- Feeding evidence into a codified context infrastructure

## Pipeline overview

Three steps, each building on the previous:

### Step 1: Extract sessions to searchable markdown

```bash
python3 scripts/extract-sessions.py -p=<project-slug> \
    --out-dir /tmp/session-extracts \
    --clean
```

Reads `~/.claude/projects/<slug>/*.jsonl` and writes one `.md` per session
containing human prompts, agent text, and tool call summaries. Skips
sessions under 5KB (single-turn or empty).

Find your project slug: `ls ~/.claude/projects/`

Options:
  -p, --project SLUG   Project dir name under ~/.claude/projects/ (required)
  --branch BRANCH      Filter to sessions on this git branch
  --min-size N         Skip files under N bytes (default: 5120)
  --max-msg-len N      Truncate messages over N chars (0 = no limit)
  --clean              Delete output dir before extracting

### Step 2: Scan for confusion signals (regex, fast, quantitative)

```bash
python3 scripts/confusion-scan.py -p=<project-slug> \
    --subsystems examples/subsystems-wibwobdos.json \
    --top 7
```

Scans raw JSONL for two signal types:

AGENT CONFUSION: self-corrections ("let me try again", "actually I think",
"I missed"), error messages (TypeError, segfault, crash), regression
language ("stale", "broke", "mismatch").

HUMAN CORRECTIONS: pushback ("no that's wrong", "I already told you",
"NEVER", "WRONG", "STOP"). Weighted 3x in scoring because they mean
the agent failed to self-correct AND a human had to intervene.

Output: ranked table of subsystems by trouble score, plus session hotspots.

The --subsystems file maps subsystem names to regex patterns. This is
PROJECT-SPECIFIC and needs authoring per repo. See
`examples/subsystems-wibwobdos.json` for the WibWob-DOS definitions.

For a new project, start with the built-in defaults (generic: api, types,
config, auth, testing, etc.) and refine after seeing initial results.

Options:
  --branch BRANCH       Filter to git branch
  --subsystems FILE     JSON mapping subsystem names to regex patterns
  --top N               Show only top N subsystems
  --json                Output as JSON (for piping to step 3)
  --min-size N          Skip files under N bytes

### Step 3: Deep analysis via LLM subagent

```bash
python3 scripts/confusion-scan.py -p=<slug> --json | \
    python3 scripts/deep-analyse.py \
        --project <slug> \
        --top 5 \
        --output /tmp/deep-analysis.md
```

Note: project slugs start with a dash (e.g. `-Users-james-Repos-myapp`).
Use `=` syntax (`-p=<slug>`) so argparse doesn't treat it as a flag.
Find your slug with `ls ~/.claude/projects/`.

Takes the confusion scan JSON and sends the worst N session transcripts to
`claude -p` for semantic analysis. Catches things regex misses:

- CIRCULAR ATTEMPTS: same fix tried 2+ times without stepping back
- SILENT ABANDONMENT: approach dropped without explanation
- SELF-CONTRADICTION: agent says X then does not-X
- SYMPTOM FIXATION: fixing surface symptoms, missing root cause
- KNOWLEDGE RE-DERIVATION: spending turns figuring out what a spec should contain
- WRONG MENTAL MODEL: incorrect assumptions about how a subsystem works
- HUMAN CORRECTION IGNORED: agent continues wrong approach after correction

Then runs a SYNTHESIS pass across all analysed sessions to identify:
- Recurring patterns across sessions
- Missing specs ranked by how many sessions needed them
- Recommended trigger table entries
- Overall knowledge health assessment

Options:
  --input FILE           JSON from confusion-scan (or stdin)
  --project SLUG         Project slug for reading raw JSONL
  --top N                Analyse top N sessions (default: 5)
  --max-transcript N     Max chars per transcript (default: 30000)
  --output FILE          Write report to file
  --skip-synthesis       Skip the cross-session synthesis step

### Optional: Index into qmd for follow-up search

```bash
./scripts/index-to-qmd.sh wwdos-sessions /tmp/session-extracts
```

Creates a qmd collection from the extracted sessions so you can do
targeted follow-up searches:

```bash
qmd search "stale state api_get_state" -c wwdos-sessions
qmd search "workspace restore race condition" -c wwdos-sessions
```

BM25 search is better for FINDING SPECIFIC INCIDENTS than for quantitative
ranking. Use confusion-scan for ranking, qmd for investigation.

## Writing subsystem definitions

The subsystems JSON file maps names to regex patterns. Guidelines:

- Include class names, file names, function names, and concept words
- Use alternation: `WindowManager|window-manager|windowManager`
- Include both camelCase and kebab-case variants
- Include error-specific terms: `SIGBUS|segfault|crash`
- Keep patterns broad enough to catch mentions, not just exact identifiers
- Start with 10-15 subsystems, refine after seeing first results

Example entry:
```json
{
  "window-system": "window-manager|WindowManager|WindowFacade|WindowRecord|findWindow|close.*window"
}
```

## Interpreting results

SCORE = confusion_signals + 3x human_corrections

High confusion, low corrections: agent knows it's confused and tries to
self-correct. High volume but often self-resolving.

Low confusion, high corrections: MOST DANGEROUS. Agent doesn't realise
it's wrong — human has to intervene. These subsystems need specs first.

High confusion, high corrections: worst overall. Both agent and human
are struggling. Likely needs a specialist agent, not just a spec.

Session hotspots with score > 20: worth reading manually or sending to
deep-analyse for LLM review.

## Limitations

- Regex confusion signals are noisy. "Let me check" is not always
  confusion. Scores are RELATIVE rankings, not absolute measures
- Tool-only sessions (Wib&Wob with heavy tool_use, minimal text) produce
  thin extracts. The real content is in tool inputs/results
- Subsystem patterns need per-project tuning. First pass often catches
  too little or too much
- deep-analyse.py calls `claude -p` which costs tokens. Budget ~5K
  tokens per session analysis, ~10K for synthesis
- BM25 search works poorly for scattered signals ("confusion about X")
  but well for specific terms ("api_get_state stale")

## Files

```
scripts/
  extract-sessions.py    # Step 1: JSONL -> markdown
  confusion-scan.py      # Step 2: regex trouble ranking
  deep-analyse.py        # Step 3: LLM semantic analysis
  index-to-qmd.sh        # Optional: qmd collection from extracts
examples/
  subsystems-wibwobdos.json   # WibWob-DOS subsystem definitions
  example-output.md           # Real output from a 645-session audit
```
