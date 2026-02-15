#!/usr/bin/env bash
# SessionStart hook: check agent mailbox for unread messages.
# Silent no-op if mailbox dir or CLI doesn't exist yet.
set -euo pipefail

MAILBOX_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}/logs/agent-mailbox"
MAIL_CLI="${CLAUDE_PROJECT_DIR:-$(pwd)}/tools/agent_mailbox/agent_mail.py"

# Bail silently if mailbox infra not yet built
[[ -d "$MAILBOX_ROOT" ]] || exit 0
[[ -f "$MAIL_CLI" ]] || exit 0

# Check for unread messages addressed to claude
UNREAD=$(uv run --with pydantic python "$MAIL_CLI" inbox --agent claude --root "$MAILBOX_ROOT" 2>/dev/null || true)

if [[ -n "$UNREAD" ]]; then
    COUNT=$(echo "$UNREAD" | wc -l | tr -d ' ')
    echo "[Agent Mailbox] You have $COUNT unread message(s):"
    echo "$UNREAD"
fi
