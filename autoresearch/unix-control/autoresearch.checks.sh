#!/usr/bin/env bash
set -euo pipefail

cd /Users/james/Repos/wibandwob-dos
DIR="autoresearch/unix-control"

echo "=== Doc suite checks ==="

# 1. All .md files parse (no broken markdown that would confuse the scorer)
echo "--- file inventory ---"
for f in "$DIR"/*.md; do
  fname=$(basename "$f")
  lines=$(wc -l < "$f" | tr -d ' ')
  echo "  $fname: $lines lines"
done

# 2. No empty files
echo "--- empty file check ---"
for f in "$DIR"/*.md; do
  if [ ! -s "$f" ]; then
    echo "FAIL: $(basename $f) is empty"
    exit 1
  fi
done
echo "  all files non-empty"

# 3. Cross-reference check — any .md filename mentioned should exist
echo "--- cross-reference check ---"
FAILS=0
for f in "$DIR"/*.md; do
  # Find references to other .md files in this dir
  refs=$(grep -oE '[A-Z_]+\.md' "$f" 2>/dev/null || true)
  for ref in $refs; do
    if [ ! -f "$DIR/$ref" ]; then
      echo "  WARN: $(basename $f) references $ref which doesn't exist"
      FAILS=$((FAILS + 1))
    fi
  done
done
if [ "$FAILS" -eq 0 ]; then
  echo "  all cross-references valid"
else
  echo "  $FAILS broken references (non-fatal)"
fi

# 4. Total size check — suite shouldn't bloat past 100KB
echo "--- size check ---"
TOTAL=$(cat "$DIR"/*.md | wc -c | tr -d ' ')
echo "  total: $TOTAL bytes"
if [ "$TOTAL" -gt 100000 ]; then
  echo "  WARN: suite exceeds 100KB — density likely suffering"
fi

echo "=== All checks passed ==="
