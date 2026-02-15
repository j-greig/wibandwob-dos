#!/bin/bash
# session-context.sh — SessionStart hook
# Injects orientation. Full epic context on epic branches, lightweight otherwise.

BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

cat <<'CTX'
[Session orientation — WibWob-DOS]
Canon rules enforced by hooks:
  - Commit format: type(scope): summary (feat|fix|refactor|docs|test|chore|ci|spike)
  - File names: snake_case for .cpp/.h/.py, kebab-case for .md
Key refs: .planning/README.md, CLAUDE.md
CTX

case "$BRANCH" in
  feat/*|fix/*|refactor/*|spike/*)
    cat <<'CTX'

Active epic: E001 — Command/Capability Parity Refactor
  Goal: single C++ CommandRegistry as source of truth; menu, IPC, API, MCP derived from it.
  Brief: .planning/epics/e001-command-parity-refactor/e001-epic-brief.md
  AC rule: every AC must have a test. Stop hook will remind you on this branch.
CTX
    ;;
esac

exit 0
