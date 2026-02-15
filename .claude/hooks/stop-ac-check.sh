#!/bin/bash
# stop-ac-check.sh — Stop hook
# Reminds Claude to verify ACs have tests — but only on epic-related branches.
# On main or unrelated branches, stays out of the way.

set -euo pipefail

INPUT=$(cat)

# If the stop hook already fired once, allow Claude to stop
ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // "false"')
if [ "$ACTIVE" = "true" ]; then
  exit 0
fi

# Only block on epic-related branches (feat/, fix/, refactor/, spike/)
BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
case "$BRANCH" in
  feat/*|fix/*|refactor/*|spike/*)
    ;;
  *)
    # Not on an epic branch — don't interfere
    exit 0
    ;;
esac

# Validate changed planning brief files have full status header.
cd "$CLAUDE_PROJECT_DIR"
CHANGED_TRACKED=$(git diff --name-only -- .planning/epics 2>/dev/null || true)
CHANGED_UNTRACKED=$(git ls-files --others --exclude-standard -- .planning/epics 2>/dev/null || true)
CHANGED_FILES=$(printf "%s\n%s\n" "$CHANGED_TRACKED" "$CHANGED_UNTRACKED" | sed '/^$/d' | sort -u)

BRIEF_VIOLATIONS=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if ! echo "$f" | grep -qE '\-brief\.md$'; then
    continue
  fi
  if [ ! -f "$f" ]; then
    continue
  fi
  CONTENT=$(cat "$f")
  if ! echo "$CONTENT" | grep -q '^Status:'; then
    BRIEF_VIOLATIONS+=("$f missing Status:")
  fi
  if ! echo "$CONTENT" | grep -q '^GitHub issue:'; then
    BRIEF_VIOLATIONS+=("$f missing GitHub issue:")
  fi
  if ! echo "$CONTENT" | grep -q '^PR:'; then
    BRIEF_VIOLATIONS+=("$f missing PR:")
  fi
done <<< "$CHANGED_FILES"

if [ ${#BRIEF_VIOLATIONS[@]} -gt 0 ]; then
  DETAILS=$(printf '%s; ' "${BRIEF_VIOLATIONS[@]}" | sed 's/[[:space:]]*$//')
  cat <<REASON
{
  "decision": "block",
  "reason": "Planning brief status header validation failed: ${DETAILS} Fix status headers before finishing."
}
REASON
  exit 0
fi

cat <<'REASON'
{
  "decision": "block",
  "reason": "Before finishing, verify: (1) Every acceptance criterion has at least one test. (2) No untested ACs remain. (3) Commit messages follow type(scope): format. See .planning/README.md AC rules."
}
REASON

exit 0
