#!/bin/bash
# Branch census — quick overview of repo branch health
set -euo pipefail

echo "=== Branch Census ==="
echo "Local:     $(git branch | wc -l | tr -d ' ')"
echo "Remote:    $(git branch -r | wc -l | tr -d ' ')"
echo "Worktrees: $(git worktree list | wc -l | tr -d ' ')"
echo "Merged:    $(git branch --merged main --format='%(refname:short)' | grep -v '^main$' | wc -l | tr -d ' ')"
echo "Unmerged:  $(git branch --no-merged main --format='%(refname:short)' | wc -l | tr -d ' ')"
