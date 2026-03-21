#!/usr/bin/env bash
# delta-judge.sh — LLM delta compression scorer
#
# Scores only CHANGED lines in CAPS files (not whole files) — cheap and targeted.
# Falls back to full file if no diff found (e.g. first run).
# Requires: ANTHROPIC_API_KEY
# Returns:  integer 0-20

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

[[ -z "${ANTHROPIC_API_KEY:-}" ]] && echo "0" && exit 0

CAPS=(AGENTS.md PHILOSOPHY.md ARCHITECTURE.md SDK.md GOTCHAS.md)
TOTAL=0
COUNT=0

SYSTEM_PROMPT='You are a delta compression judge for agent-readable documentation.

THE READER'"'"'S PRIOR: A senior dev who knows TypeScript, Bun, git, REST APIs, blessed terminal library, standard tooling.

SCORING (0-10):
- 10: Every line states only what diverges from the reader'"'"'s prior. Zero restated standard knowledge.
- 7-9: Mostly delta, minor redundancies.
- 4-6: Mixed — some obvious patterns restated.
- 1-3: Mostly noise the reader already knows.
- 0: Could be any project. No specificity.

Return ONLY valid JSON: {"score": N, "redundancies": ["one-line each"]}'

for doc in "${CAPS[@]}"; do
  [[ -f "$doc" ]] || continue

  # Score only changed lines — fall back to full file if no diff
  changed=$(git diff HEAD -- "$doc" 2>/dev/null | grep '^+' | grep -v '^+++' | sed 's/^+//' || true)
  [[ -z "$changed" ]] && changed=$(cat "$doc")
  [[ -z "$changed" ]] && continue

  response=$(curl -sf https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "$(jq -n \
      --arg sys "$SYSTEM_PROMPT" \
      --arg content "Score these lines:\n\n$changed" \
      '{model:"claude-haiku-4-5",max_tokens:256,system:$sys,messages:[{role:"user",content:$content}]}'
    )" 2>/dev/null || echo "")

  score=$(echo "$response" | python3 -c "
import json,sys
try:
    r=json.load(sys.stdin); print(json.loads(r['content'][0]['text'])['score'])
except: print(5)
" 2>/dev/null || echo "5")

  TOTAL=$((TOTAL + score))
  COUNT=$((COUNT + 1))
done

[[ $COUNT -eq 0 ]] && echo "0" && exit 0
python3 -c "print(round(($TOTAL / $COUNT) * 2))"
