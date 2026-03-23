#!/usr/bin/env bash
# check-devlog-headings.sh — flag ### pain headings missing [id:WXX-NNN][status:...] tags
# Used by doc-sync.sh as a lint gate on reflection files.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REFLECTIONS_DIR="$REPO_ROOT/.pi/reflections"

FAIL=0
while IFS= read -r file; do
    week=$(basename "$file" .md)
    [[ "$week" =~ ^[0-9]{4}-W[0-9]+ ]] || continue  # skip TEMPLATE.md etc
    # Only enforce on W13 onwards — W12 and earlier are legacy unstructured
    wnum=$(echo "$week" | grep -oE 'W[0-9]+' | tr -d 'W')
    [[ "$wnum" -ge 13 ]] 2>/dev/null || continue
    while IFS= read -r line; do
        if echo "$line" | grep -qE '^### ' && ! echo "$line" | grep -q '\[id:'; then
            echo "⚠️  $week: untagged heading: $line"
            FAIL=$(( FAIL + 1 ))
        fi
    done < "$file"
done < <(find "$REFLECTIONS_DIR" -name "*.md" | sort)

if [[ $FAIL -gt 0 ]]; then
    echo ""
    echo "$FAIL untagged heading(s) — run: bash scripts/devlog-tag-headings.sh WXX"
    exit 1
fi
echo "✅ All reflection headings tagged"
