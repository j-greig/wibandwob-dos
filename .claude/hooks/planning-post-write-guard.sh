#!/bin/bash
# planning-post-write-guard.sh — PostToolUse hook for Write|Edit
# Checks planning brief files after write/edit and nudges/blocks if status header is invalid.

set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only apply to planning brief markdown files.
if ! echo "$FILE_PATH" | grep -qE '^(.*/)?\.planning/epics/.+\-brief\.md$'; then
  exit 0
fi

# Use full on-disk file content after the tool action.
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi
CONTENT=$(cat "$FILE_PATH")

# Check for status metadata — accept either YAML frontmatter or body-level fields.
HAS_FRONTMATTER=false
if echo "$CONTENT" | head -1 | grep -q '^---$'; then
  HAS_FRONTMATTER=true
fi

MISSING=()
if $HAS_FRONTMATTER; then
  # Frontmatter mode: check for status/issue/pr in YAML block
  FM=$(echo "$CONTENT" | awk '/^---$/{n++; next} n==1{print} n>=2{exit}')
  if ! echo "$FM" | grep -q '^status:'; then
    MISSING+=("frontmatter status:")
  fi
  if ! echo "$FM" | grep -q '^issue:'; then
    MISSING+=("frontmatter issue:")
  fi
  if ! echo "$FM" | grep -q '^pr:'; then
    MISSING+=("frontmatter pr:")
  fi
else
  # Legacy body mode: check for Status:/GitHub issue:/PR: lines
  if ! echo "$CONTENT" | grep -q '^Status:'; then
    MISSING+=("Status:")
  fi
  if ! echo "$CONTENT" | grep -q '^GitHub issue:'; then
    MISSING+=("GitHub issue:")
  fi
  if ! echo "$CONTENT" | grep -q '^PR:'; then
    MISSING+=("PR:")
  fi
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  MISSING_JOINED=$(IFS=', '; echo "${MISSING[*]}")
  cat <<JSON
{
  "decision": "block",
  "reason": "Planning brief is missing required status header lines after ${TOOL_NAME}: ${MISSING_JOINED}. Add:\nStatus: not-started | in-progress | blocked | done | dropped\nGitHub issue: #NNN\nPR: —"
}
JSON
  exit 0
fi

# Enforce AC/Test traceability in brief files.
# Rule: every AC line must be followed by a Test: line (next non-empty bullet).
# Also reject placeholder Test lines.
AC_VIOLATIONS=$(printf "%s\n" "$CONTENT" | awk '
  BEGIN { pending=0; ac="" }
  {
    line=$0

    if (pending==1) {
      if (line ~ /^[[:space:]]*$/) {
        next
      }
      if (line ~ /^[[:space:]]*-[[:space:]]+Test:[[:space:]]+/) {
        low=tolower(line)
        if (low ~ /(tbd|todo|later)/) {
          print "placeholder Test line after " ac
        }
        pending=0
        ac=""
        next
      }
      print "missing Test line after " ac
      pending=0
      ac=""
    }

    if (line ~ /^[[:space:]]*-[[:space:]]+\[[ x~\\-]\][[:space:]]+\*\*AC-[0-9]+:\*\*/) {
      ac=line
      pending=1
    }
  }
  END {
    if (pending==1) {
      print "missing Test line after " ac
    }
  }
')

if [ -n "$AC_VIOLATIONS" ]; then
  cat <<JSON
{
  "decision": "block",
  "reason": "Planning brief AC/Test validation failed after ${TOOL_NAME}. Every AC must be followed by a concrete Test: line; placeholders (TBD/TODO/later) are not allowed.\n${AC_VIOLATIONS}"
}
JSON
  exit 0
fi

# Auto-sync EPIC_STATUS.md from frontmatter when any epic brief is written.
PLANNING_SCRIPT="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/planning.sh"
if [ -x "$PLANNING_SCRIPT" ]; then
  "$PLANNING_SCRIPT" sync >/dev/null 2>&1 || true
fi

# Enforce non-placeholder issue only after work has started.
if $HAS_FRONTMATTER; then
  STATUS_VALUE=$(echo "$FM" | awk '/^status:/{sub(/^status:[[:space:]]*/, ""); print; exit}')
  ISSUE_PLACEHOLDER=false
  ISSUE_VAL=$(echo "$FM" | awk '/^issue:/{sub(/^issue:[[:space:]]*/, ""); print; exit}')
  if [ -z "$ISSUE_VAL" ] || [ "$ISSUE_VAL" = "~" ] || [ "$ISSUE_VAL" = "null" ]; then
    ISSUE_PLACEHOLDER=true
  fi
else
  STATUS_VALUE=$(printf "%s\n" "$CONTENT" | awk '
    /^Status:/ {
      sub(/^Status:[[:space:]]*/, "", $0)
      gsub(/`/, "", $0)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0)
      print $0
      exit
    }
  ')
  ISSUE_PLACEHOLDER=false
  if echo "$CONTENT" | grep -qE '^GitHub issue:[[:space:]]*(\(not yet created\)|#NNN|—|N/A)$'; then
    ISSUE_PLACEHOLDER=true
  fi
fi

if [ "${STATUS_VALUE}" != "not-started" ] && $ISSUE_PLACEHOLDER; then
  cat <<JSON
{
  "decision": "block",
  "reason": "Planning brief has non-not-started status but still uses placeholder issue metadata. Replace with a real issue number."
}
JSON
  exit 0
fi

exit 0
