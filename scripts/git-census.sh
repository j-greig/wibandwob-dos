#!/bin/bash
# git-census.sh — unified branch/worktree/orphan audit
# @name    git-census
# @desc    Branch counts, worktree map, orphan check, staleness ranking
# Usage: scripts/git-census.sh [--full]
set -euo pipefail

FULL=false
[ "${1:-}" = "--full" ] && FULL=true

echo "=== Branch Census ==="
echo "Local:     $(git branch | wc -l | tr -d ' ')"
echo "Remote:    $(git branch -r | wc -l | tr -d ' ')"
echo "Worktrees: $(git worktree list | wc -l | tr -d ' ')"
echo "Merged:    $(git branch --merged main --format='%(refname:short)' | grep -v '^main$' | wc -l | tr -d ' ')"
echo "Unmerged:  $(git branch --no-merged main --format='%(refname:short)' | wc -l | tr -d ' ')"

echo ""
echo "=== Safety ==="
LOCAL=$(git rev-parse main 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✅ main == origin/main"
else
  echo "⚠️  main DIVERGED from origin/main — push first"
fi

echo ""
echo "=== Unpushed commits ==="
FOUND=false
for b in $(git branch --format='%(refname:short)'); do
  orphans=$(git log "$b" --oneline --not --remotes 2>/dev/null | wc -l | tr -d ' ')
  if [ "$orphans" -gt "0" ]; then
    echo "⚠️  $b: $orphans unpushed"
    FOUND=true
  fi
done
$FOUND || echo "✅ all branches pushed"

echo ""
echo "=== Worktrees ==="
git worktree list --porcelain | grep "^worktree " | sed 's/^worktree //' | while read wt; do
  dir=$(basename "$wt")
  branch=$(git -C "$wt" branch --show-current 2>/dev/null || echo "DETACHED")
  disk=$(du -sh "$wt" 2>/dev/null | cut -f1)
  echo "- $dir ($branch) $disk"
done

if $FULL; then
  echo ""
  echo "=== Unmerged branches (by staleness) ==="
  for b in $(git branch --no-merged main --format='%(refname:short)'); do
    date=$(git log -1 --format='%ad' --date=short "$b" 2>/dev/null)
    ahead=$(git rev-list --count main.."$b" 2>/dev/null)
    behind=$(git rev-list --count "$b"..main 2>/dev/null)
    subject=$(git log -1 --format='%s' "$b" 2>/dev/null | head -c 80)
    echo "$date | +$ahead -$behind | $b | $subject"
  done | sort

  echo ""
  echo "=== Truly unique commits (would be lost on delete) ==="
  for b in $(git branch --no-merged main --format='%(refname:short)'); do
    unique=$(git log "$b" --oneline --not --exclude="$b" --branches --remotes 2>/dev/null | wc -l | tr -d ' ')
    [ "$unique" -gt "0" ] && echo "🔴 $b: $unique truly unique commits"
  done
fi
