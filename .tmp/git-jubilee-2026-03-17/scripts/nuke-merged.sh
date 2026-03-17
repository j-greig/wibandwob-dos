#!/bin/bash
# Delete all merged branches (local + remote). Run backup-repo.sh first!
set -euo pipefail

echo "=== Deleting merged LOCAL branches ==="
git branch --merged main --format='%(refname:short)' \
  | grep -v '^main$' \
  | xargs git branch -d 2>&1

echo ""
echo "=== Deleting merged REMOTE branches ==="
git branch -r --merged main --format='%(refname:short)' \
  | sed 's|^origin/||' \
  | grep -vE '^(main|HEAD)$' \
  | xargs -I{} git push origin --delete {} 2>&1

git fetch --prune
echo ""
echo "✅ Done. Remaining:"
echo "  Local:  $(git branch | wc -l | tr -d ' ')"
echo "  Remote: $(git branch -r | wc -l | tr -d ' ')"
