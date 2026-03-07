#!/bin/bash
# planning-context.sh — UserPromptSubmit hook
# Injects planning context scoped to the current branch.
# On epic branches: full context. On main/other: lightweight reminder only.

BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
EPIC_STATUS="$CLAUDE_PROJECT_DIR/.planning/epics/EPIC_STATUS.md"

case "$BRANCH" in
  feat/*|fix/*|refactor/*|spike/*)
    # Build active epics block from EPIC_STATUS.md
    if [[ -f "$EPIC_STATUS" ]]; then
      ACTIVE=$(grep '— in-progress$' "$EPIC_STATUS" | sed 's/ — in-progress$//')
      if [[ -n "$ACTIVE" ]]; then
        ACTIVE_BLOCK="Active epics:"$'\n'"$(echo "$ACTIVE" | sed 's/^/  /')"
      else
        ACTIVE_BLOCK="Active epics: (none currently in-progress)"
      fi
    else
      ACTIVE_BLOCK="Active epics: (EPIC_STATUS.md not found)"
    fi

    cat <<CTX
[Planning context — active epic branch]
$ACTIVE_BLOCK
Commit format: type(scope): summary — see .planning/README.md
Epic index: .planning/epics/EPIC_STATUS.md
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
