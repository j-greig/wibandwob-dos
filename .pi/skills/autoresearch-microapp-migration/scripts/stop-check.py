#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("usage: stop-check.py <results.tsv> <loop-control.json>")
    sys.exit(2)

results_path = Path(sys.argv[1])
control_path = Path(sys.argv[2])

if not results_path.exists() or not control_path.exists():
    print("stop=false reason=missing-files")
    sys.exit(0)

control = json.loads(control_path.read_text())
max_loops = int(control.get("maxLoops", 20))
full_pass_streak_target = int(control.get("consecutiveFullPassesToStop", 2))
no_improve_limit = int(control.get("noImprovementStreakStop", 6))

rows = []
with results_path.open() as f:
    reader = csv.DictReader(f, delimiter="\t")
    for r in reader:
        rows.append(r)

if not rows:
    print("stop=false reason=no-results")
    sys.exit(0)

# Ignore baseline row for loop counting where possible
exp_rows = [r for r in rows if str(r.get("experiment", "")).strip() not in ("", "0")]
loop_count = len(exp_rows)

scores = []
for r in rows:
    try:
        scores.append(int(str(r.get("score", "0")).strip()))
    except ValueError:
        scores.append(0)

max_score = 0
for r in rows:
    try:
        max_score = max(max_score, int(str(r.get("max_score", "0")).strip()))
    except ValueError:
        pass

# Condition 1: hard max loops
if loop_count >= max_loops:
    print("stop=true reason=maxLoops")
    sys.exit(0)

# Condition 2: consecutive full-pass runs
if max_score > 0:
    streak = 0
    for r in reversed(rows):
        try:
            s = int(str(r.get("score", "0")).strip())
        except ValueError:
            s = 0
        if s >= max_score:
            streak += 1
            if streak >= full_pass_streak_target:
                print("stop=true reason=consecutiveFullPasses")
                sys.exit(0)
        else:
            break

# Condition 3: no improvement streak
best = -1
since_improve = 0
for s in scores:
    if s > best:
        best = s
        since_improve = 0
    else:
        since_improve += 1

if since_improve >= no_improve_limit:
    print("stop=true reason=noImprovementStreak")
    sys.exit(0)

print("stop=false reason=continue")
