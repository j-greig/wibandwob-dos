#!/usr/bin/env bash
# devlog-tag-headings.sh — retroactively add [id:WXX-NNN][status:open] to untagged ### headings
# Usage:
#   scripts/devlog-tag-headings.sh W13          # tag untagged headings in 2026-W13.md
#   scripts/devlog-tag-headings.sh W13 --dry    # preview only, no changes
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REFLECTIONS_DIR="$REPO_ROOT/.pi/reflections"

WEEK="${1:-}"
DRY=false
[[ "${2:-}" == "--dry" ]] && DRY=true

[[ -z "$WEEK" ]] && { echo "Usage: $0 WXX [--dry]"; exit 1; }

YEAR=$(date +%Y)
FILE="$REFLECTIONS_DIR/${YEAR}-${WEEK}.md"
[[ -f "$FILE" ]] || { echo "❌ Not found: $FILE"; exit 1; }

# Find highest existing ID number in the file (both NNN and NNNa forms)
MAX=$(grep -oE '\[id:W[0-9]+-([0-9]+)[A-Za-z]?\]' "$FILE" 2>/dev/null \
      | grep -oE '[0-9]+[A-Za-z]?' | grep -oE '^[0-9]+' | sort -n | tail -1 || echo "0")
NEXT=$(( MAX + 1 ))

TAGGED=0
TMPFILE=$(mktemp)
while IFS= read -r line; do
    if echo "$line" | grep -qE '^### ' && ! echo "$line" | grep -q '\[id:'; then
        ID=$(printf "W${WEEK#W}-%03d" "$NEXT")
        # Normalise: week input may be W13 or 13
        ID="W$(echo "$WEEK" | tr -d 'W')-$(printf '%03d' $NEXT)"
        line="${line%$'\n'} \`[id:${ID}][status:open]\`"
        NEXT=$(( NEXT + 1 ))
        TAGGED=$(( TAGGED + 1 ))
        if $DRY; then echo "  would tag: $line"; fi
    fi
    echo "$line"
done < "$FILE" > "$TMPFILE"

if $DRY; then
    echo "🔍 Dry run — $TAGGED heading(s) would be tagged"
    rm -f "$TMPFILE"
    exit 0
fi

if diff -q "$FILE" "$TMPFILE" > /dev/null 2>&1; then
    rm -f "$TMPFILE"
    echo "ℹ️  No untagged headings found — file unchanged"
    exit 0
fi
echo "── diff preview ──────────────────────────────"
diff "$FILE" "$TMPFILE" | grep '^[<>]' | head -10
echo "──────────────────────────────────────────────"
read -r -p "Apply changes? [y/N] " confirm
if [[ "${confirm:-N}" =~ ^[Yy]$ ]]; then
    mv "$TMPFILE" "$FILE"
    echo "✅ Tagged $TAGGED heading(s) in $FILE"
else
    rm -f "$TMPFILE"
    echo "⏭  Skipped — no changes made"
fi
