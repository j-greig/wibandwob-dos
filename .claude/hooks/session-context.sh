#!/bin/bash
# session-context.sh — SessionStart hook
# Injects orientation + live epic/backlog status.

BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

cat <<'CTX'
[Session orientation — WibWob-DOS]
Canon rules enforced by hooks:
  - Commit format: type(scope): summary (feat|fix|refactor|docs|test|chore|ci|spike)
  - File names: snake_case for .cpp/.h/.py, kebab-case for .md
Key refs: .planning/README.md, CLAUDE.md
CTX

# Live epic status from frontmatter
EPIC_STATUS=$("$CLAUDE_PROJECT_DIR"/.claude/scripts/planning.sh status 2>/dev/null)
if [ -n "$EPIC_STATUS" ]; then
  printf '\n%s\n' "$EPIC_STATUS"
fi

# Backlog summary (open issues count)
if command -v gh &>/dev/null; then
  BACKLOG=$("$CLAUDE_PROJECT_DIR"/.claude/scripts/todo.sh list --all 2>/dev/null | head -20)
  if [ -n "$BACKLOG" ]; then
    printf '\nBacklog:\n%s\n' "$BACKLOG"
  fi
fi

# Epic branch context
case "$BRANCH" in
  feat/*|fix/*|refactor/*|spike/*)
    printf '\nActive branch: %s\n' "$BRANCH"
    printf '  AC rule: every AC must have a test. Stop hook will remind you.\n'
    ;;
esac

exit 0
