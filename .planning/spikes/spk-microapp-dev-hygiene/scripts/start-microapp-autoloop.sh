#!/usr/bin/env bash
set -euo pipefail

# Safe v1 harness: baseline + optional iterative mutate/eval loop.
# Default target: demo-layout-stress-test-pi

SLUG="${1:-layout-stress-test-pi-v2}"
TARGET_DIR="${2:-microapps/demo-layout-stress-test-pi}"
COMMAND_ID="${3:-microapp.wibwob.layout-stress-test-pi.open}"
SIGNAL_REGEX="${4:-layout|stress|pi}"
TITLE_REGEX="${5:-Layout Stress Test \\(Pi\\)}"
MODE_FIELD="${6:-mode}"

RUN_ROOT=".planning/spikes/spk-microapp-dev-hygiene/runs/${SLUG}"
mkdir -p "$RUN_ROOT"

RESULTS_TSV="$RUN_ROOT/results.tsv"
RESULTS_JSON="$RUN_ROOT/results.json"
CHANGELOG_MD="$RUN_ROOT/changelog.md"
NOTES_MD="$RUN_ROOT/notes.md"

MAX_LOOPS="${MAX_LOOPS:-20}"
SLEEP_SECONDS="${SLEEP_SECONDS:-30}"
MUTATE_CMD="${MUTATE_CMD:-}"

cat > "$RESULTS_JSON" <<JSON
{
  "slug": "$SLUG",
  "status": "running",
  "current_experiment": 0,
  "best_score": 0,
  "max_score": 11,
  "experiments": []
}
JSON

if [[ ! -f "$RESULTS_TSV" ]]; then
  echo -e "experiment\tscore\tmax_score\tpass_rate\tstatus\tdescription" > "$RESULTS_TSV"
fi

if [[ ! -f "$CHANGELOG_MD" ]]; then
  cat > "$CHANGELOG_MD" <<'MD'
# Changelog

MD
fi

if [[ ! -f "$NOTES_MD" ]]; then
  cat > "$NOTES_MD" <<'MD'
# Notes

- Safe v1 harness: baseline + optional mutate/eval loop.
- If MUTATE_CMD is empty, only baseline run is performed.
MD
fi

run_gates() {
  if bash .pi/skills/autoresearch-microapp-migration/scripts/run-gates.sh \
      "$TARGET_DIR" "$COMMAND_ID" "$SIGNAL_REGEX" "$TITLE_REGEX" "$MODE_FIELD" >/tmp/microapp-autoloop-gates.log 2>&1; then
    echo 11
  else
    echo 0
  fi
}

append_result() {
  local exp="$1" score="$2" status="$3" desc="$4"
  local max=11
  local rate
  rate=$(python3 - <<PY
s=$score
m=$max
print(f"{(s/m)*100:.1f}%")
PY
)
  echo -e "${exp}\t${score}\t${max}\t${rate}\t${status}\t${desc}" >> "$RESULTS_TSV"
}

update_json() {
  python3 - <<PY
import csv, json
from pathlib import Path
r=Path("$RESULTS_TSV")
out=Path("$RESULTS_JSON")
rows=[]
with r.open() as f:
    rd=csv.DictReader(f, delimiter='\t')
    for row in rd:
        row['experiment']=int(row['experiment'])
        row['score']=int(row['score'])
        row['max_score']=int(row['max_score'])
        rows.append(row)
best=max((x['score'] for x in rows), default=0)
cur=max((x['experiment'] for x in rows), default=0)
obj={
  "slug":"$SLUG",
  "status":"running",
  "current_experiment":cur,
  "best_score":best,
  "max_score":11,
  "experiments":rows
}
out.write_text(json.dumps(obj, indent=2))
PY
}

# Baseline
baseline_score=$(run_gates)
append_result 0 "$baseline_score" baseline "baseline gates"
update_json

cat >> "$CHANGELOG_MD" <<MD
## Experiment 0 — baseline
- Score: ${baseline_score}/11
- Notes: baseline gates run
MD

if [[ -z "$MUTATE_CMD" ]]; then
  python3 - <<PY
import json
from pathlib import Path
p=Path("$RESULTS_JSON")
obj=json.loads(p.read_text())
obj["status"]="idle"
obj["stopReason"]="no-mutate-cmd"
p.write_text(json.dumps(obj, indent=2))
PY
  echo "Baseline complete. Set MUTATE_CMD to enable looping."
  echo "$RUN_ROOT"
  exit 0
fi

best="$baseline_score"
for ((i=1; i<=MAX_LOOPS; i++)); do
  echo "[loop $i] mutate"
  bash -lc "$MUTATE_CMD" || true

  score=$(run_gates)
  status="discard"
  desc="mutate+gates"
  if (( score > best )); then
    status="keep"
    best="$score"
  fi

  append_result "$i" "$score" "$status" "$desc"
  update_json

  cat >> "$CHANGELOG_MD" <<MD

## Experiment $i — $status
- Score: ${score}/11
- Mutation: ${MUTATE_CMD}
- Gates log: /tmp/microapp-autoloop-gates.log
MD

  sleep "$SLEEP_SECONDS"
done

python3 - <<PY
import json
from pathlib import Path
p=Path("$RESULTS_JSON")
obj=json.loads(p.read_text())
obj["status"]="complete"
obj["stopReason"]="max-loops"
p.write_text(json.dumps(obj, indent=2))
PY

echo "$RUN_ROOT"
