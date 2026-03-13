# Autoresearch Visual Scoring — Recreation Guide

How to reproduce the visual scoring experiment from scratch with zero
context of the original conversation.

## What This Is

An autonomous experiment loop where a Pi agent improves a TUI module's
visual quality by: editing code, restarting the app, screenshotting it,
scoring the screenshot against a rubric, and keeping or discarding the
change based on whether the score improved.

No modifications to the pi-autoresearch extension were needed. The trick:
log_experiment accepts any number the agent provides. The agent reads a
PNG via Pi's Read tool, scores it subjectively against the rubric in
autoresearch.md, and passes that number as the metric.

## Prerequisites

- WibWob-DOS repo checked out
- Bun installed, `bun install` done
- tmux session `wibwob` running with `bun run dev:world`
- The TUI visible on a macOS display (screencapture needs pixels)
- pi-autoresearch extension installed in Pi

## How We Modified the Standard Autoresearch System

Standard autoresearch optimises a numeric benchmark (e.g. runtime in ms).
We adapted it for visual/creative scoring with these changes:

### 1. autoresearch.sh — Screenshot Instead of Benchmark

Normal: runs a benchmark command, output includes METRIC lines.
Ours: restarts the app in tmux, waits for /health, opens the target
window via API, captures a PNG screenshot, archives it.

Key details:
- Fixed tmux geometry (211x56) so screenshots are comparable
- `--display 2` for the correct macOS screen (laptop built-in)
- 3-second sleep after opening window for render settle time
- Archive with incrementing number + timestamp for history

### 2. autoresearch.md — Rubric Instead of Benchmark Target

Normal: describes a benchmark command and numeric metric.
Ours: defines a 5-axis scoring rubric (layout, readability, aesthetic,
coherence, character) each 1-10, averaged to ui_score. Also includes:
- SDK component catalogue (so the agent knows what tools exist)
- Terminal design principles (adapted from web for character cells)
- Scoring discipline rules (calibration, no inflation, baseline compare)
- Files in scope (only the one module)

### 3. autoresearch.checks.sh — Module Load Verification

Normal: runs tests or typecheck.
Ours: typecheck AND verifies the module actually loaded by checking
the /state API endpoint for the window title. A module that typechecks
but crashes on import is caught.

### 4. The Agent Loop (No Code Change)

The Pi agent's loop is unchanged:
1. Read autoresearch.md for context
2. Edit the module source file
3. Call run_experiment (runs autoresearch.sh)
4. Read the screenshot PNG via Pi's Read tool
5. Score each axis against the rubric
6. Call log_experiment with the score
7. Keep if improved, discard if not
8. Repeat

## To Recreate This Experiment

### Step 1: Set Up tmux

```bash
cd /Users/james/Repos/wibandwob-dos
lsof -ti:8099 | xargs kill -9 2>/dev/null; true
tmux new-session -d -s wibwob -x 211 -y 56
tmux send-keys -t wibwob 'bun run dev:world' Enter
sleep 10 && curl -s http://127.0.0.1:8099/health
```

Attach to verify: `tmux attach -t wibwob` (Ctrl-b d to detach).
Confirm which display shows the TUI. Update DISPLAY_NUM in
autoresearch.sh if not display 2.

### Step 2: Copy Scripts to Repo Root

```bash
cp .planning/epics/e038-autoresearch-visual-scoring/scripts/autoresearch.md ./
cp .planning/epics/e038-autoresearch-visual-scoring/scripts/autoresearch.sh ./
cp .planning/epics/e038-autoresearch-visual-scoring/scripts/autoresearch.checks.sh ./
chmod +x autoresearch.sh autoresearch.checks.sh
```

### Step 3: Create Branch

```bash
git checkout -b autoresearch/my-target-YYYY-MM-DD
```

### Step 4: Edit autoresearch.md for Your Target

Change:
- "Files in Scope" to your module's index.ts
- The window open command in autoresearch.sh to your module's command ID
- The /state grep in autoresearch.checks.sh to your window title

Find the command ID:
```bash
curl -s http://127.0.0.1:8099/commands/list | python3 -c "
import json,sys
for c in json.loads(sys.stdin.read())['commands']:
  if 'your-module' in c['id']: print(c['id'])
"
```

### Step 5: Start Pi with Autoresearch

Tell Pi: "Start autoresearch. Read autoresearch.md and begin the loop."

The agent will:
- Call init_experiment (metric: ui_score, direction: higher)
- Capture a baseline screenshot and score it
- Start iterating

### Step 6: Monitor

- Ctrl+X in Pi toggles the experiment dashboard
- Screenshots accumulate in scratch/autoresearch-shots/
- autoresearch.jsonl has every result
- Git log shows kept experiments (auto-committed)

### Step 7: Stop

Send any message to the agent, or let context fill up.
The agent finishes its current run_experiment + log_experiment cycle
before stopping.

## Adapting for a Different Module

Only three things change:

1. **autoresearch.md** — "Files in Scope" section
2. **autoresearch.sh** — the `curl` command that opens the window
   (change the command ID)
3. **autoresearch.checks.sh** — the `grep` that verifies the window
   title in /state

Everything else (rubric, scoring axes, loop mechanics, archive) is
module-agnostic.

## Known Gap: Discard Runs Lost from JSONL

The autoresearch extension appends to autoresearch.jsonl on every
log_experiment call. But on discard/crash, the agent runs
`git checkout -- .` which reverts the JSONL too. So only keeps survive
in the JSONL. Discard descriptions are visible in `git reflog` but
not in the dashboard.

The screenshot archive (scratch/autoresearch-shots/) is in gitignored
scratch/ so it survives reverts. But the archive step was added in
run 4, so runs 1-3 only have the overwritten screenshot.png.

For future runs: if you want discard data preserved, either move the
JSONL to a gitignored location, or append discards to a separate log.

## Key Learnings from Run 001

- Seed logView content AFTER layout() — blessed needs dimensions first
- Unicode box-drawing in blessed labels renders as dashes — use ASCII
- gap:1 on createStack applies between ALL children, not just the last
- Animation (pulse/breathing) had outsized impact on aesthetic + character
- Dual figlet headers with different fonts/colours = instant coherence
- Removing redundant text (DRY) improved readability more than adding text
- Responsive window sizing (fill the desktop) was a free layout win
