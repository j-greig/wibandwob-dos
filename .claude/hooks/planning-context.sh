#!/bin/bash
# planning-context.sh — UserPromptSubmit hook
# Injects planning context scoped to the current branch.
# On epic branches: full context. On main/other: lightweight reminder only.

BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

case "$BRANCH" in
  feat/*|fix/*|refactor/*|spike/*)
    cat <<'CTX'
[Planning context — active epic branch]
Active track: command/capability parity refactor (E001)
Goals: registry single source of truth, parity enforcement, authoritative engine state
Non-goals: no RAG, no cloud sync, no broad rewrite
Commit format: type(scope): summary — see .planning/README.md
Epic dir: .planning/epics/e001-command-parity-refactor/
Ref: .planning/README.md
CTX
    ;;
  *)
    cat <<'CTX'
[Planning context]
Commit format: type(scope): summary — see .planning/README.md
CTX
    ;;
esac

exit 0
