#!/bin/bash
# list-docs.sh — generated index of all agent/dev-facing docs
# @name    list-docs
# @desc    Generated index of all agent/dev docs with staleness flags
# Usage: scripts/list-docs.sh [--stale N]  (flag files unmodified for N+ days, default 30)
set -euo pipefail

STALE_DAYS="${1:-30}"
[[ "${1:-}" == "--stale" ]] && STALE_DAYS="${2:-30}"
NOW=$(date +%s)

echo "=== Agent & Dev Docs ==="
echo ""

for section in \
  "Root:." \
  ".agents:.agents" \
  ".agents/shell-dev:.agents/shell-dev" \
  ".agents/shell-dev/specs:.agents/shell-dev/specs" \
  ".agents/shell-dev/devlogs:.agents/shell-dev/devlogs" \
  ".agents/microapp-dev:.agents/microapp-dev" \
  "docs:docs" \
  ".planning:.planning" \
  ".planning/epics:.planning/epics" \
  ".planning/spikes:.planning/spikes" \
  ".planning/ideas:.planning/ideas"; do

  LABEL="${section%%:*}"
  DIR="${section##*:}"

  [ -d "$DIR" ] || continue

  FILES=$(find "$DIR" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
  [ -z "$FILES" ] && continue

  echo "## $LABEL"
  echo "$FILES" | while read f; do
    lines=$(wc -l < "$f" | tr -d ' ')
    title=$(head -1 "$f" | sed 's/^#* *//')
    mod=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null || echo 0)
    age=$(( (NOW - mod) / 86400 ))
    stale=""
    [ "$age" -gt "$STALE_DAYS" ] && stale=" ⚠️ ${age}d old"
    echo "- **$(basename "$f")** (${lines}L)${stale} — $title"
  done
  echo ""
done
