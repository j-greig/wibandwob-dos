#!/usr/bin/env bash
set -euo pipefail

LOG=".pi/skills/autoresearch-microapp-migration/feedback.log"
ENTRY="${*:-}"
if [[ -z "$ENTRY" ]]; then
  echo "usage: $0 <feedback text>" >&2
  exit 2
fi

printf '%s\n- %s\n' "$(date +%Y-%m-%d)" "$ENTRY" >> "$LOG"
echo "appended -> $LOG"
