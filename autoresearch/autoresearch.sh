#!/bin/bash
set -euo pipefail

# Auto-Journal summarisation benchmark
# Runs summariser on sample sessions, scores quality, outputs METRIC lines.

cd "$(dirname "$0")"

SESSIONS_DIR="$HOME/.pi/agent/sessions/--Users-james-Repos-wibandwob-dos--"

# Pick 5 sample sessions: 2 recent, 2 mid-range, 1 old — diverse lengths
mapfile -t ALL_SESSIONS < <(ls "$SESSIONS_DIR"/*.jsonl 2>/dev/null | sort)
TOTAL=${#ALL_SESSIONS[@]}

if [ "$TOTAL" -lt 5 ]; then
  echo "ERROR: Need at least 5 sessions, found $TOTAL" >&2
  exit 1
fi

# Spread: first, 25%, 50%, 75%, last
SAMPLES=(
  "${ALL_SESSIONS[0]}"
  "${ALL_SESSIONS[$((TOTAL / 4))]}"
  "${ALL_SESSIONS[$((TOTAL / 2))]}"
  "${ALL_SESSIONS[$((TOTAL * 3 / 4))]}"
  "${ALL_SESSIONS[$((TOTAL - 1))]}"
)

START_MS=$(python3 -c "import time; print(int(time.time()*1000))")

TOTAL_SCORE=0
TOTAL_TOKENS=0
COUNT=0
ERRORS=0

for SESSION in "${SAMPLES[@]}"; do
  RESULT=$(python3 summariser.py "$SESSION" 2>/dev/null) || { ERRORS=$((ERRORS + 1)); continue; }

  # Extract metrics from JSON output
  SCORE=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('quality_score', 0))")
  TOKENS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token_count', 0))")

  TOTAL_SCORE=$((TOTAL_SCORE + SCORE))
  TOTAL_TOKENS=$((TOTAL_TOKENS + TOKENS))
  COUNT=$((COUNT + 1))
done

END_MS=$(python3 -c "import time; print(int(time.time()*1000))")
ELAPSED=$((END_MS - START_MS))

if [ "$COUNT" -gt 0 ]; then
  AVG_SCORE=$((TOTAL_SCORE / COUNT))
  AVG_TOKENS=$((TOTAL_TOKENS / COUNT))
  AVG_LATENCY=$((ELAPSED / COUNT))
else
  AVG_SCORE=0
  AVG_TOKENS=0
  AVG_LATENCY=0
fi

echo "METRIC quality_score=$AVG_SCORE"
echo "METRIC latency_ms=$AVG_LATENCY"
echo "METRIC token_count=$AVG_TOKENS"
echo "METRIC sessions_scored=$COUNT"
echo "METRIC errors=$ERRORS"
