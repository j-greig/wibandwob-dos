#!/usr/bin/env bash
# delta-judge.sh — LLM delta compression scorer
#
# Scores CAPS files for delta efficiency: does the doc state only what diverges
# from a senior dev's prior knowledge, or does it restate standard patterns?
#
# Requires: ANTHROPIC_API_KEY in env
# Returns:  integer 0-20 (average per-doc score scaled to 20pt budget)
# Usage:    bash scripts/delta-judge.sh [file1.md file2.md ...]
#           (defaults to all CAPS files)

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

[[ -z "${ANTHROPIC_API_KEY:-}" ]] && { echo "0"; exit 0; }

CAPS=("${@:-AGENTS.md PHILOSOPHY.md ARCHITECTURE.md SDK.md}")
TOTAL=0
COUNT=0

SYSTEM_PROMPT='You are a delta compression judge for agent-readable documentation.

THE READER'\''S PRIOR: A senior developer who knows TypeScript, Bun, git, REST APIs,
the blessed terminal library, standard tooling, and common architectural patterns.

SCORING (0-10):
- 10: States ONLY divergences. Zero restated priors. Every sentence is specific.
- 7-9: Mostly delta, minor redundancies.
- 4-6: Mixed — restates some obvious patterns alongside specific content.
- 1-3: Mostly noise the reader already knows.
- 0: Could be any project. No specificity.

Return ONLY valid JSON — no prose, no markdown:
{"score": N, "redundancies": ["one-line description of each restated prior"]}'

for doc in "${CAPS[@]}"; do
  [[ -f "$doc" ]] || continue
  content=$(cat "$doc")

  response=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "$(jq -n \
      --arg system "$SYSTEM_PROMPT" \
      --arg content "Score this documentation:\n\n$content" \
      '{model:"claude-haiku-4-5",max_tokens:256,system:$system,messages:[{role:"user",content:$content}]}'
    )" 2>/dev/null)

  score=$(echo "$response" | python3 -c "
import json,sys
try:
    r = json.load(sys.stdin)
    text = r['content'][0]['text']
    j = json.loads(text)
    print(j['score'])
except:
    print(5)
" 2>/dev/null || echo "5")

  TOTAL=$((TOTAL + score))
  COUNT=$((COUNT + 1))
done

[[ $COUNT -eq 0 ]] && echo "0" && exit 0

# Average score (0-10) scaled to 20pt budget
AVG=$(python3 -c "print(round(($TOTAL / $COUNT) * 2))" 2>/dev/null || echo "0")
echo "$AVG"
