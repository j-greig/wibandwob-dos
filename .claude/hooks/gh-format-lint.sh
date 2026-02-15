#!/bin/bash
# gh-format-lint.sh — PreToolUse hook for Bash
# Enforce --body-file for GitHub markdown operations to preserve line breaks.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only inspect gh issue/pr comment/body edit operations.
if ! echo "$COMMAND" | grep -qE '(^|[[:space:]])gh[[:space:]]+(issue[[:space:]]+comment|pr[[:space:]]+comment|pr[[:space:]]+edit)([[:space:]]|$)'; then
  exit 0
fi

# Safe path: explicit body-file usage.
if echo "$COMMAND" | grep -qE '([[:space:]]--body-file[[:space:]]|--body-file=)'; then
  exit 0
fi

# For these commands, reject inline --body to avoid markdown formatting loss.
if echo "$COMMAND" | grep -qE '([[:space:]]--body[[:space:]]|--body=)'; then
  echo "GitHub markdown command must use --body-file, not --body." >&2
  echo "Use one of:" >&2
  echo "  gh issue comment <n> --body-file <file>" >&2
  echo "  gh pr comment <n> --body-file <file>" >&2
  echo "  gh pr edit <n> --body-file <file>" >&2
  echo "For inline authoring, use heredoc to stdin with --body-file -" >&2
  exit 2
fi

# If neither --body-file nor --body was provided, allow (could be interactive/manual flow).
exit 0
