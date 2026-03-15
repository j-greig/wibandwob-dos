---
id: SPK-autoresearch-audit
title: Autoresearch Portfolio Audit — Stats, Patterns, Ideas Adoption
status: in-progress
type: spike
tags: [autoresearch, audit, tooling, ideas-adoption]
issue: ~
---

# SPK — Autoresearch Portfolio Audit

## Problem

We've been running autoresearch across ~24 subdirectories in the wibandwob-dos
repo (`autoresearch/`), each a self-contained experiment loop. No one has
looked across all of them to see what worked, what didn't, and whether the
ideas-file mechanism is actually being used. The extension code supports
`autoresearch.ideas.md` but adoption appears low.

## Tooling

**Analysis script:** `scripts/analyze-autoresearch.py`
```bash
python3 scripts/analyze-autoresearch.py /path/to/autoresearch         # markdown report
python3 scripts/analyze-autoresearch.py /path/to/autoresearch --json  # structured data
```

Parses every subdirectory: jsonl experiment logs, md objectives, ideas files,
file inventories. Produces per-task breakdowns, summary tables, and adoption
stats.

---

## Portfolio Overview

- **24** subdirectories total
- **9** with experiment data, **15** setup/planning only
- **108** total experiment runs (97 kept, 1 crashed)
- **4/24** have an ideas file ← **low adoption**

All 9 active experiments ran on the same day (2026-03-13) — a coordinated
batch session, likely a UI quality sweep.

## Active Experiments

| Task | Runs | Keep% | Metric | Baseline → Best | Δ% | Ideas? |
|------|------|-------|--------|-----------------|-----|--------|
| unix-control | 43 | 95% | parity_score | 4.3 → 10 | +132.6% | ❌ |
| asciicker | 24 | 75% | quality_score | 6 → 10 | +66.7% | ❌ |
| antopolis | 14 | 86% | ui_score | 5.4 → 9.8 | +81.5% | ❌ |
| llm-orch-studio | 7 | 100% | ui_score | 3.6 → 8 | +122.2% | ✅ |
| terrain-lab | 6 | 100% | ui_score | 4.8 → 8 | +66.7% | ❌ |
| music-player | 5 | 100% | ui_score | 4.2 → 7.4 | +76.2% | ❌ |
| plasma | 3 | 100% | ui_score | 5.4 → 8 | +48.1% | ❌ |
| primer-gallery | 3 | 100% | ui_score | 6.4 → 7.4 | +15.6% | ❌ |
| tr808 | 3 | 67% | ui_score | 5.4 → 6.4 | +18.5% | ❌ |

### Per-Task Assessments

**unix-control** — Most prolific loop (43 runs). Drove CLI parity score from
4.3 to a perfect 10. Tracked 7 secondary metrics (actionability, coherence,
density, etc.). Spawned 4 versioned iterations (v1–v4 subdirectories), each
with its own backlog. Despite being the highest-volume experiment, has no ideas
file — context resets likely lost deferred optimizations.

**asciicker** — Ambitious C++ → TypeScript port of a 3D ASCII game engine.
75% keep rate with 5 discards shows genuine experimentation and course
correction. 18 secondary metrics tracked (beauty, craft, world, render, etc.).
One checks_failed suggests the correctness gate caught a regression.

**antopolis** — Clean UI quality ramp from 5.4 to 9.8 with minimal waste
(2 discards). Colour-coded ants, resource bars, and district borders show
progressive visual enrichment.

**llm-orch-studio** — **The exemplar.** 100% keep rate, +122% improvement,
AND the only active task with a well-maintained ideas file. Ideas file tracks
DONE/STALE status on completed items. Proves the pattern works when adopted.

**terrain-lab / music-player / plasma** — Solid UI polish loops. All 100%
keep rate, all hit the 7-8 score range. Efficient but short — may benefit
from a second pass.

**primer-gallery** — Lowest improvement (+15.6%). Started higher (6.4) so
less headroom. Layout refinements (3-pane, dividers) rather than dramatic
visual changes.

**tr808** — Fragile. 1 crash from macOS screenshot capture failure
(`screencapture display error — macOS display unavailable`). Only 2 successful
iterations before hitting infrastructure issues.

## Ideas File Adoption — The Gap

### What the extension does

The autoresearch extension tells the agent:
> "Write promising but deferred optimizations as bullet points to
> autoresearch.ideas.md — don't let good ideas get lost."

On auto-resume after context limit, it checks for the file and tells the
resuming agent to consult it.

### What actually happened

| Has Ideas? | Tasks | Pattern |
|------------|-------|---------|
| ✅ Active ideas | llm-orch-studio | 12 bullets, DONE/STALE tracking — gold standard |
| ✅ Ideas but no experiments | shader-music, unix-control-v2, v3 | Ideas exist from planning phase, not from loop |
| ❌ Should have ideas | unix-control (43 runs), asciicker (24), antopolis (14) | **Paradox: highest-volume loops have no ideas file** |

**Root cause hypothesis:** The agent hits context limits and auto-resumes,
but by that point it's already deep in an iteration and doesn't pause to
offload ideas. The instruction to write ideas is in the system prompt but
competes with the "NEVER STOP" loop imperative.

### Recommendations

1. **Make ideas-file creation part of `init_experiment` or the setup phase** —
   create an empty `autoresearch.ideas.md` with a header so the file exists
   from the start.
2. **Periodic ideas offload** — after every N experiments (e.g. 5), the
   extension could inject a reminder: "Pause and update autoresearch.ideas.md
   with any deferred optimizations before continuing."
3. **Backfill** — retroactively create ideas files for unix-control, asciicker,
   antopolis based on git log analysis of what was tried and abandoned.

## Setup-Only Tasks (15)

These have autoresearch.md and .sh files but never ran experiments:

| Category | Tasks |
|----------|-------|
| **CLI tooling** | cli-help, cli-start-restart, write-pipe, plumb |
| **UI quality** | contour-studio, file-manager |
| **Architecture** | instance-lifecycle, solid-foundations |
| **Creative** | shader-music, journal, journal-v2, wiretext |
| **Unix control iterations** | unix-control-v2, v3, v4 |

**shader-music** is notable — has 25 lines of ideas, 20+ extra files
(GLSL shaders, WAV outputs, Python scripts), but no jsonl. This was clearly
an active creative workbench that predates or bypasses the autoresearch loop.

The unix-control series (v1→v4) shows iterative scope expansion:
v1 ran 43 experiments, v2–v4 have progressively richer backlogs/ideas
but no experiment runs. The work may have continued in the main codebase
without looping back through autoresearch.

## Cross-Cutting Patterns

1. **UI quality sweep was effective.** 7/9 active tasks optimize microapp UI
   against a 5-axis rubric (layout, readability, aesthetic, coherence,
   character). Consistent methodology across tasks.

2. **Self-scoring is generous.** Most tasks achieved 8-10 scores. The rubric
   may need recalibration or external validation (human scoring, A/B
   comparison).

3. **Secondary metrics are collected but not analyzed.** 144+ data points
   across tasks. No cross-task comparison, no regression analysis. The data
   exists in jsonl but has no consumer.

4. **Versioned subdirectories (unix-control v1-v4) are informal.** No
   mechanism links them. The extension treats each as independent. Could
   benefit from a "series" concept or at least cross-references in the md
   files.

5. **All experiments on one day.** Either a massive batch run or the
   timestamps are from a single coordinated session. No longitudinal data
   to assess whether improvements hold over time.

## Actionable Next Steps

- [ ] **Ideas adoption fix** — patch extension or skill to create ideas file
      at init and inject periodic reminders
- [ ] **Backfill ideas** for high-volume tasks from git log
- [ ] **Archive or promote** the 15 setup-only tasks — decide which are still
      relevant vs stale
- [ ] **tr808 crash** — fix screenshot infrastructure (macOS display capture)
- [ ] **Secondary metrics narrative** — build a cross-task dashboard or
      summary from the jsonl data
- [ ] **Rubric calibration** — human-score a sample of screenshots to validate
      self-assessed 8-10 scores
