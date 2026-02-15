#!/usr/bin/env bash
# SessionStart hook: check agent mailbox for unread messages.
# Silent no-op if mailbox dir or CLI doesn't exist yet.
set -euo pipefail

MAILBOX_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}/logs/agent-mailbox"
MAIL_CLI="${CLAUDE_PROJECT_DIR:-$(pwd)}/tools/agent_mailbox/agent_mail.py"

# Bail silently if mailbox infra not yet built
[[ -d "$MAILBOX_ROOT" ]] || exit 0
[[ -f "$MAIL_CLI" ]] || exit 0

# Check for unread messages addressed to claude, with timeout to avoid blocking startup.
if command -v timeout >/dev/null 2>&1; then
    UNREAD=$(timeout 3s uv run --with pydantic python "$MAIL_CLI" inbox --agent claude --root "$MAILBOX_ROOT" 2>/dev/null || true)
else
    UNREAD=$(uv run --with pydantic python "$MAIL_CLI" inbox --agent claude --root "$MAILBOX_ROOT" 2>/dev/null || true)
fi

if [[ -n "$UNREAD" ]]; then
    COUNT=$(echo "$UNREAD" | wc -l | tr -d ' ')
    SAFE_UNREAD=$(printf '%s' "$UNREAD" | LC_ALL=C tr -cd '\11\12\40-\176')
    echo "[Agent Mailbox] You have $COUNT unread message(s):"
    echo "$SAFE_UNREAD"
fi
