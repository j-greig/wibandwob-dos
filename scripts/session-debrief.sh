#!/usr/bin/env bash
# session-debrief.sh — extract pain points from agent session logs
#
# The recursive self-improvement loop:
#   agent session → session-debrief.sh → proposed GOTCHAS/guide updates →
#   human/agent reviews → docs improve → next session is smoother
#
# Session logs: ~/.pi/agent/sessions/<repo-path-encoded>/<timestamp>_<id>.jsonl
#
# Usage:
#   bash scripts/session-debrief.sh                    # most recent session for this repo
#   bash scripts/session-debrief.sh <path-to.jsonl>    # specific session file

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SESSION_FILE="${1:-}"

if [[ -z "$SESSION_FILE" ]]; then
  # Encode repo path the way pi does: /Users/james/Repos/x → --Users-james-Repos-x--
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

python3 "$(dirname "$0")/lib/session-debrief-parser.py" "$SESSION_FILE"
