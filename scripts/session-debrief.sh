#!/usr/bin/env bash
# session-debrief.sh — LLM-powered pain extraction from agent session logs
#
# The recursive self-improvement loop:
#   agent session → session-debrief.sh → haiku analyses pain →
#   proposed GOTCHAS/guide updates → human reviews → next session smoother
#
# Uses pi -p (headless) with haiku — no keyword matching, no API keys.
#
# Usage:
#   bash scripts/session-debrief.sh                    # most recent session
#   bash scripts/session-debrief.sh <path-to.jsonl>    # specific session
#   bash scripts/session-debrief.sh --stats-only       # quick stats, no LLM

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SESSION_FILE="${1:-}"
STATS_ONLY=false

if [[ "$SESSION_FILE" == "--stats-only" ]]; then
  STATS_ONLY=true
  SESSION_FILE=""
fi

if [[ -z "$SESSION_FILE" ]]; then
  ENCODED="--$(echo "$(pwd)" | sed 's|^/||; s|/|-|g')--"
  SESSIONS_DIR="$HOME/.pi/agent/sessions/$ENCODED"

  if [[ ! -d "$SESSIONS_DIR" ]]; then
    echo "✗ No sessions found at $SESSIONS_DIR"
    exit 1
  fi
  SESSION_FILE=$(ls -t "$SESSIONS_DIR"/*.jsonl 2>/dev/null | head -1)
  if [[ -z "$SESSION_FILE" ]]; then
    echo "✗ No session files found"
    exit 1
  fi
fi

echo "session-debrief: $(basename "$SESSION_FILE")"
echo ""

if [[ "$STATS_ONLY" == "true" ]]; then
  python3 "$(dirname "$0")/lib/session-debrief-parser.py" "$SESSION_FILE" stats
  exit 0
fi

# Extract session summary
SUMMARY=$(python3 "$(dirname "$0")/lib/session-debrief-parser.py" "$SESSION_FILE" summary)

# Write prompt to temp file
TMPFILE=$(mktemp /tmp/session-debrief-XXXXXX.md)
trap "rm -f $TMPFILE" EXIT

PROMPT="Analyse this WibWob-DOS agent session for pain points and confusion.

Output: ## Pain points (what went wrong, severity high/med/low)
## Confusion signals (files read 3+ times, retried tools)
## Proposed GOTCHAS.md additions (**bold rule.** explanation)
## Proposed guide additions (SDK-MICROAPP-DEV.md changes)

Be evidence-based. If session was clean, say so."

printf '%s\n\n%s\n' "$PROMPT" "$SUMMARY" > "$TMPFILE"

pi -p \
  --model anthropic/claude-haiku-4-5 \
  --no-tools -ns -ne --no-session \
  "@$TMPFILE"

echo ""
echo "session-debrief complete."
