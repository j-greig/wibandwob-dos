# Autoresearch Visual Scoring System

How we gave a Pi agent a numeric score for a creative output.

## The Problem

Autoresearch loops need a number. UI quality is not a number.

## The Bridge

An LLM scores its own work against a fixed rubric. Five axes, each 1-10, averaged.

## The Five Axes

| Axis | What it measures |
|------|-----------------|
| LAYOUT | Use of space, balance, no dead zones, SDK layout primitives |
| READABILITY | Text legibility, contrast, information hierarchy |
| AESTHETIC | Colour harmony via theme tokens, visual interest |
| COHERENCE | Feels like one designed thing, not random widgets |
| CHARACTER | Personality, charm, WibWob-ness, not generic scaffold |

Primary metric = average of all five = ui_score.
Each axis tracked as a secondary metric so you see what improved and what degraded.

## The Loop

1. Agent edits `microapps/llm-orch-studio/index.ts`
2. `autoresearch.sh` runs: typecheck, restart app in tmux, wait for /health, open the window, capture PNG screenshot
3. `autoresearch.checks.sh` runs: typecheck + verify window exists in /state
4. Agent reads the screenshot PNG via Pi's Read tool (image attachment)
5. Agent scores all five axes against the rubric
6. Agent calls log_experiment with ui_score = average, sub-scores as secondary metrics
7. Keep if score improved, discard if not. Auto-commit on keep, revert on discard.
8. Loop forever.

## Why It Works

- log_experiment accepts any number the agent provides (no stdout parsing needed)
- Pi's Read tool supports images natively (PNG sent as attachment)
- Self-scoring bias mitigated by: fixed rubric, per-axis granularity, baseline comparison
- No extension code changes required
- Architecture B (self-scoring) not Architecture A (external claude -p scorer)

## Key Insight

The autoresearch extension does not care WHERE the metric comes from.
The agent provides it manually. So the metric can be a creative judgement
as easily as a wall-clock time. That is the whole trick.
