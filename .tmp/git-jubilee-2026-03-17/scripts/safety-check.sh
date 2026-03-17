#!/bin/bash
# Verify main is in sync with origin before destructive operations
set -euo pipefail

LOCAL=$(git rev-parse main)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✅ main == origin/main ($LOCAL)"
else
  echo "⚠️  DIVERGED — push main first"
  echo "  local:  $LOCAL"
  echo "  remote: $REMOTE"
  exit 1
fi
