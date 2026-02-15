#!/bin/bash
# commit-lint.sh — PreToolUse hook for Bash
# Validates commit messages against .planning/README.md conventions:
#   type(scope): imperative summary
# Types: feat, fix, refactor, docs, test, chore, ci, spike

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only care about git commit commands
if ! echo "$COMMAND" | grep -q 'git commit'; then
  exit 0
fi

# Allow amend without -m/--message (reusing existing message)
if echo "$COMMAND" | grep -q '\-\-amend' && ! echo "$COMMAND" | grep -qE '([[:space:]]-m[[:space:]]|--message)'; then
  exit 0
fi

# Must have -m or --message to validate
if ! echo "$COMMAND" | grep -qE '([[:space:]]-m[[:space:]]|--message)'; then
  exit 0
fi

# Extract the commit message subject line.
# Handle heredoc pattern: -m "$(cat <<'EOF'\nsubject\n...\nEOF\n)"
# Handle simple pattern: -m "subject" or -m 'subject' or --message "subject"
MSG=""

if echo "$COMMAND" | grep -q "<<'EOF'"; then
  # Heredoc: grab the first non-empty content line after <<'EOF'
  MSG=$(echo "$COMMAND" | sed -n "/<<'EOF'/,/^EOF/{/<<'EOF'/d;/^EOF/d;/^[[:space:]]*$/d;p;}" | head -1 | sed 's/^[[:space:]]*//')
elif echo "$COMMAND" | grep -q '<<EOF'; then
  MSG=$(echo "$COMMAND" | sed -n "/<<EOF/,/^EOF/{/<<EOF/d;/^EOF/d;/^[[:space:]]*$/d;p;}" | head -1 | sed 's/^[[:space:]]*//')
else
  # Simple: -m "..." / -m '...' / --message "..." / --message '...' / --message="..."
  MSG=$(echo "$COMMAND" | sed -En "s/.*(--message[= ]|-m )[[:space:]]*[\"']([^\"']*)[\"'].*/\2/p" | head -1)
fi

if [ -z "$MSG" ]; then
  # Could not extract message — don't block
  exit 0
fi

# Trim leading whitespace
MSG=$(echo "$MSG" | sed 's/^[[:space:]]*//')

# Validate against canon format
if echo "$MSG" | grep -qE '^(feat|fix|refactor|docs|test|chore|ci|spike)\([a-z0-9_-]+\): .+'; then
  exit 0
fi

echo "Commit message does not match canon format." >&2
echo "Expected: type(scope): imperative summary" >&2
echo "  type:  feat | fix | refactor | docs | test | chore | ci | spike" >&2
echo "  scope: engine | registry | ipc | api | mcp | ui | contracts | vault | events | paint | llm | build | planning" >&2
echo "  Example: feat(registry): add CommandRegistry skeleton with exec_command dispatch" >&2
echo "Got: $MSG" >&2
exit 2
