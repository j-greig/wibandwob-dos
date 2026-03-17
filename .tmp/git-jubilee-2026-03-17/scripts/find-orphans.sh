#!/bin/bash
# Find branches with commits not on any remote (would be lost if disk dies)
set -euo pipefail

echo "=== Branches with unpushed commits ==="
for b in $(git branch --format='%(refname:short)'); do
  orphans=$(git log "$b" --oneline --not --remotes 2>/dev/null | wc -l | tr -d ' ')
  [ "$orphans" -gt "0" ] && echo "⚠️  $b has $orphans commits NOT on any remote"
done

echo ""
echo "=== Branches with truly unique commits (only reachable from that branch) ==="
for b in $(git branch --no-merged main --format='%(refname:short)'); do
  unique=$(git log "$b" --oneline --not --exclude="$b" --branches --remotes 2>/dev/null | wc -l | tr -d ' ')
  [ "$unique" -gt "0" ] && echo "🔴 $b has $unique truly unique commits (would be lost on delete)"
done
