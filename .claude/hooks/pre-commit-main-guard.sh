#!/usr/bin/env bash
# pre-commit-main-guard.sh — block feature commits directly to main
#
# Rejects commits to `main` that touch code under:
#   app/  tools/api_server/  modules/  modules-private/
#
# Docs, planning, and scripts are always allowed on main.
# Install as .git/hooks/pre-commit (or call from your existing pre-commit).

set -euo pipefail

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")

if [ "$BRANCH" != "main" ]; then
  exit 0   # not on main — nothing to check
fi

# Check if any staged files touch protected paths
PROTECTED_PATTERN="^(app/|tools/api_server/|modules/|modules-private/)"
STAGED=$(git diff --cached --name-only)

if echo "$STAGED" | grep -qE "$PROTECTED_PATTERN"; then
  echo ""
  echo "🚫 BLOCKED: direct commit to main with code changes."
  echo ""
  echo "   Protected paths touched:"
  echo "$STAGED" | grep -E "$PROTECTED_PATTERN" | sed 's/^/     /'
  echo ""
  echo "   Create a branch first:"
  echo "     gh issue create --title '...' --body '...'"
  echo "     git checkout -b feat/your-slug"
  echo ""
  exit 1
fi

exit 0
