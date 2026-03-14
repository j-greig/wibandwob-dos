---
id: e038
title: Autoresearch Visual Scoring System
status: in-progress
priority: high
depends: [e037]
---

# E038 — Autoresearch Visual Scoring System

## Context

We adapted pi-autoresearch (an autonomous experiment loop for quantitative
optimisation) to work with creative/visual outputs. The core insight: the
autoresearch extension's log_experiment tool accepts any number the agent
provides manually. The metric can be a creative judgement as easily as a
wall-clock time. No extension code changes needed.

First application: improving the LLM Orch Studio UI (E037) by having a Pi
agent self-score screenshots against a fixed rubric. Five axes (layout,
readability, aesthetic, coherence, character) each scored 1-10, averaged
to a primary ui_score. Run 001 completed: baseline 3.6 to 8.0 in 14
iterations (+122%), all five axes at 8/10.

This epic tracks the system itself, not the LLM Orch Studio UI. The goal
is to refine, document, and generalise the visual scoring pipeline so it
can be applied to any module or visual surface.

## What We Built

### Architecture: Self-Scoring (Architecture B)

Agent makes code changes, restarts app, captures PNG screenshot, reads the
screenshot via Pi's Read tool, scores against rubric, logs via autoresearch.
No external scorer (Architecture A rejected: slower, costlier, extra billing
context). Self-scoring bias mitigated by fixed rubric, per-axis granularity,
baseline comparison.

### Files Created

| File | Purpose |
|------|---------|
| `autoresearch.md` | Session rules: objective, rubric, SDK catalogue, design principles, constraints |
| `autoresearch.sh` | Benchmark script: restart app, wait /health, open window, capture PNG, archive |
| `autoresearch.checks.sh` | Backpressure: typecheck + verify module loaded in /state |
| `autoresearch.jsonl` | Experiment log (machine-readable, appended per run) |
| `scratch/autoresearch-screenshot.png` | Current screenshot (overwritten each run) |
| `scratch/autoresearch-baseline.png` | Baseline screenshot for comparison |
| `scratch/autoresearch-shots/` | Numbered archive of all screenshots |
| `scratch/autoresearch-visual-scoring-feasibility.md` | Feasibility study (Architecture A vs B, extension code analysis, cost estimates) |
| `scratch/autoresearch-scoring-system.md` | Pithy summary of the scoring system |

### Module metadata

`microapps/llm-orch-studio/microapp.json` — added `externalDependencies` field
documenting the llm-orchestrator repo and claude-code binary. Convention
defined in `.agents/microapp-dev/sdk-reference.md`.

### The Five-Axis Rubric

| Axis | What it measures |
|------|-----------------|
| LAYOUT | Use of space, balance, no dead zones, SDK layout primitives |
| READABILITY | Text legibility, contrast, information hierarchy |
| AESTHETIC | Colour harmony via theme tokens, visual interest |
| COHERENCE | Feels like one designed thing, not random widgets |
| CHARACTER | Personality, charm, WibWob-ness, not generic scaffold |

Primary metric = average of all five = ui_score (1-10, higher is better).
Each axis tracked as secondary metric in autoresearch dashboard.

### The Loop

1. Agent edits index.ts
2. autoresearch.sh: restart app in tmux (fixed geometry), wait /health, open window, capture PNG
3. autoresearch.checks.sh: typecheck + module-load verification
4. Agent reads PNG via Pi Read tool
5. Agent scores five axes against rubric
6. log_experiment: keep if improved, discard if not. Auto-commit on keep.
7. Loop forever.

### Results So Far (first session)

| Run | ui_score | What changed |
|-----|----------|-------------|
| 1 | 3.6 | Baseline scaffold |
| 4 | 5.6 | Subtitle, idle placeholder messages |
| 5 | 5.8 | Compact topic, turns table right column |
| 8 | 6.6 | Responsive sizing, wider gap, tighter turns |
| 12 | 7.4 | Animated pulse in status banner |
| 13 | 7.8 | Dual figlet headers with typographic hierarchy |

Baseline to best: +122% overall (3.6 → 8.0). CHARACTER axis: 2 → 8 (+300%).
All five axes reached 8/10 in the final iteration (run 14).

## Feature Checklist

- [x] F01 Feasibility study (Architecture A vs B analysis)
- [x] F02 autoresearch.md rubric and session rules
- [x] F03 autoresearch.sh benchmark script (restart, screenshot, archive)
- [x] F04 autoresearch.checks.sh (typecheck + module-load verification)
- [x] F05 externalDependencies convention in microapp.json and SDK docs
- [x] F06 First scoring session on LLM Orch Studio (baseline 3.6 to 8.0)
- [~] F07 Refine rubric based on first session learnings
- [ ] F08 Generalise: make scoring pipeline reusable for any module
- [ ] F09 Calibration anchors: reference screenshots of known-good modules
- [ ] F10 Optional external audit mode (periodic Architecture A cross-validation)
- [ ] F11 Document the full system as a Pi skill or .agents guide

## Acceptance Criteria

AC-1: A Pi agent can run /autoresearch on any microapp module and get
meaningful, consistent ui_score improvements over a session.
Test: Run on a second module, observe scores track real improvement.

AC-2: Scoring rubric produces consistent results (same screenshot scores
within +/-1 across separate scoring calls).
Test: Score a fixed screenshot 3 times, check variance.

AC-3: The system is documented well enough that a fresh agent can set up
and run visual autoresearch from the docs alone.
Test: New session with no prior context can start the loop from autoresearch.md.

AC-4: autoresearch.checks.sh catches broken modules (typecheck fail,
import crash, window not in /state).
Test: Introduce deliberate breakage, confirm checks reject.

## Open Questions

1. SCORING DRIFT: Do scores inflate over a long session as the agent
   anchors to its own previous scores? Needs measurement.

2. RUBRIC TUNING: Are five axes the right five? Is "character" too
   subjective? Should there be a "functionality" axis?

3. GENERALISATION: When targeting a different module, what needs to
   change? Just the autoresearch.md file scope and the open command
   in autoresearch.sh? Or more?

4. TEXT VS PNG: tmux capture-pane (text) works headless and is cheaper
   on context. PNG gives colour/visual fidelity. Is dual-mode
   (text + PNG) worth the complexity?

5. COST AT SCALE: Each iteration adds a PNG to context. Over 50+
   iterations the context fills. Strategy for long sessions?

## Reference Links

- pi-autoresearch skill: `~/.pi/agent/git/github.com/davebcn87/pi-autoresearch/skills/autoresearch-create/SKILL.md`
- pi-autoresearch extension: `~/.pi/agent/git/github.com/davebcn87/pi-autoresearch/extensions/pi-autoresearch/index.ts`
- Anthropic frontend-design skill: https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md
- SDK component reference: `.agents/microapp-dev/sdk-reference.md`
- Module examples by tier: `.agents/microapp-dev/examples-by-tier.md`
- Feasibility study: `scratch/autoresearch-visual-scoring-feasibility.md`
- Scoring system summary: `scratch/autoresearch-scoring-system.md`
- Screenshot scripts: `scripts/screenshot-window.sh`, `scripts/capture-tui-png.sh`
- Restart script: `scripts/restart.sh`
