#!/bin/bash
# devlog.sh — zero-friction weekly devlog entries
# @name    devlog
# @desc    Append pain→why→fix reflection to weekly .pi/reflections/ file
# Usage:
#   scripts/devlog.sh                     # open this week's devlog in $EDITOR
#   scripts/devlog.sh "one-liner note"    # append timestamped entry
#   scripts/devlog.sh --journal           # also write to journal-compatible format
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEVLOG_DIR="$REPO_ROOT/.pi/reflections"
JOURNAL_DIR="$REPO_ROOT/scratch/journal"

# ISO week number (Monday start)
WEEK=$(date +%V)
YEAR=$(date +%Y)
FILE="$DEVLOG_DIR/${YEAR}-W${WEEK}.md"

mkdir -p "$DEVLOG_DIR"

# Create file if missing
if [ ! -f "$FILE" ]; then
  cat > "$FILE" <<EOF
---
week: ${YEAR}-W${WEEK}
purpose: agent self-reflection — friction, pains, failures, and ideas for fixing them via skills, scripts, process changes, or new tooling
themes: 
---

# W${WEEK} — Week of $(date -v-monday +%Y-%m-%d 2>/dev/null || date -d "last monday" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)

EOF
  echo "Created $FILE"
fi

# No args → open in editor
if [ $# -eq 0 ]; then
  ${EDITOR:-vim} "$FILE"
  exit 0
fi

# Parse flags
JOURNAL=false
MSG=""
for arg in "$@"; do
  case "$arg" in
    --journal) JOURNAL=true ;;
    *) MSG="$arg" ;;
  esac
done

if [ -z "$MSG" ]; then
  echo "Usage: scripts/devlog.sh \"your note here\" [--journal]"
  exit 1
fi

# Append timestamped entry with breathing room
TIMESTAMP=$(date "+%H:%M")
echo "" >> "$FILE"
echo "- **${TIMESTAMP}** — ${MSG}" >> "$FILE"
echo "✏️  W${WEEK} devlog ← ${MSG}"

# Journal-compatible output (for microapps/journal ingestion)
if [ "$JOURNAL" = true ]; then
  mkdir -p "$JOURNAL_DIR"
  JFILE="$JOURNAL_DIR/$(date +%Y-%m-%d).jsonl"
  # Append as JSONL line
  printf '{"timestamp":"%s","peer":"system","kind":"devlog","body":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    "$(echo "$MSG" | sed 's/"/\\"/g')" >> "$JFILE"
  echo "📓 journal ← $JFILE"
fi
