#!/bin/bash
# Find remote branches with no local tracking branch
set -euo pipefail

echo "=== Remote-only branches (no local) ==="
comm -23 \
  <(git branch -r --format='%(refname:short)' | sed 's|^origin/||' | sort) \
  <(git branch --format='%(refname:short)' | sort) \
  | grep -v '^HEAD$'
