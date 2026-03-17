#!/bin/bash
# Rank unmerged branches by staleness with ahead/behind counts
set -euo pipefail

for b in $(git branch --no-merged main --format='%(refname:short)'); do
  date=$(git log -1 --format='%ad' --date=short "$b" 2>/dev/null)
  ahead=$(git rev-list --count main.."$b" 2>/dev/null)
  behind=$(git rev-list --count "$b"..main 2>/dev/null)
  subject=$(git log -1 --format='%s' "$b" 2>/dev/null | head -c 80)
  wt=""
  if git worktree list 2>/dev/null | grep -q "\[$b\]"; then wt=" 📂"; fi
  echo "$date | +$ahead -$behind | $b$wt | $subject"
done | sort
