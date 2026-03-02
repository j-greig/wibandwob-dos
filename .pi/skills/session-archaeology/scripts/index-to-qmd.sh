#!/bin/bash
# Index extracted session markdown files into a qmd collection for search.
#
# Usage:
#   ./index-to-qmd.sh [collection-name] [extract-dir]
#
# Defaults:
#   collection-name: project-sessions
#   extract-dir: /tmp/session-extracts

set -euo pipefail

COLLECTION="${1:-project-sessions}"
EXTRACT_DIR="${2:-/tmp/session-extracts}"

if [ ! -d "$EXTRACT_DIR" ]; then
    echo "Error: $EXTRACT_DIR does not exist. Run extract-sessions.py first."
    exit 1
fi

FILE_COUNT=$(ls "$EXTRACT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$FILE_COUNT" -eq 0 ]; then
    echo "Error: no .md files in $EXTRACT_DIR"
    exit 1
fi

echo "Indexing $FILE_COUNT sessions into qmd collection '$COLLECTION'..."

# Remove existing collection if it exists (re-index)
qmd collection remove "$COLLECTION" 2>/dev/null || true

# Add collection
qmd collection add "$EXTRACT_DIR" --name "$COLLECTION" --mask "**/*.md"

echo ""
echo "Collection '$COLLECTION' ready for search:"
echo "  qmd search 'your query' -c $COLLECTION"
echo "  qmd search 'your query' -c $COLLECTION --files   # file list mode"
echo "  qmd search 'your query' -c $COLLECTION -n 10     # more results"
echo ""
echo "For vector search, run: qmd embed"
