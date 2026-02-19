#!/bin/bash
# name-lint.sh — PreToolUse hook for Write|Edit
# Validates file naming conventions from .planning/README.md:
#   *.cpp, *.h, *.py → snake_case
#   adr-*.md → adr-NNNN-kebab.md
#   *.md → kebab-case or UPPER_CASE

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Skip vendored / generated / private paths (match both absolute and relative)
case "$FILE_PATH" in
  */vendor/*|vendor/*|*/node_modules/*|node_modules/*|*/build/*|build/*|*/.git/*|.git/*|*/modules-private/*|modules-private/*)
    exit 0
    ;;
esac

BASENAME=$(basename "$FILE_PATH")
NAME_NO_EXT="${BASENAME%.*}"
EXT="${BASENAME##*.}"

# Always-allow list (config files, dotfiles, special names)
case "$BASENAME" in
  CMakeLists.txt|Makefile|Dockerfile|.gitignore|.gitmodules|.clang-format)
    exit 0
    ;;
  CLAUDE.md|SKILL.md)
    exit 0
    ;;
esac

# Spike file location enforcement
# spkNN-*.md files must live inside .planning/epics/<epic>/ or .planning/spikes/<name>/
# (Cross-epic standalone spikes belong in .planning/spikes/spk-<name>/ directories.)
if echo "$BASENAME" | grep -qE '^spk[0-9]'; then
  if ! echo "$FILE_PATH" | grep -qE '\.planning/(epics|spikes)/'; then
    echo "Spike file '$BASENAME' must live under .planning/epics/<epic>/ or .planning/spikes/<spike-name>/ — not in '$FILE_PATH'" >&2
    exit 2
  fi
fi

# Planning epic directory structure enforcement
# Files under .planning/epics/ must follow prefix conventions:
#   epic dir:    eNNN-<kebab>/          files: eNNN-<kebab>.md
#   feature dir: fNN-<kebab>/           files: fNN-<kebab>.md or spkNN-<kebab>.md
#   story dir:   sNN-<kebab>/           files: sNN-<kebab>.md
#   spike dir:   spkNN-<kebab>/         files: spkNN-<kebab>.md
if echo "$FILE_PATH" | grep -q '\.planning/epics/'; then
  if [ "$EXT" = "md" ]; then
    PARENT_DIR=$(basename "$(dirname "$FILE_PATH")")

    if echo "$PARENT_DIR" | grep -qE '^e[0-9]+-'; then
      # Inside epic dir — file should start with eNNN- or spkNN-
      EPIC_PREFIX=$(echo "$PARENT_DIR" | grep -oE '^e[0-9]+')
      if ! echo "$NAME_NO_EXT" | grep -qE "^(${EPIC_PREFIX}-|spk[0-9]+-)"; then
        echo "Epic file '$BASENAME' should start with '${EPIC_PREFIX}-' or 'spkNN-' (e.g. ${EPIC_PREFIX}-epic-brief.md, spk01-feasibility.md)" >&2
        exit 2
      fi
    elif echo "$PARENT_DIR" | grep -qE '^f[0-9]+-'; then
      # Inside feature dir — file should start with fNN- or spkNN-
      FEAT_PREFIX=$(echo "$PARENT_DIR" | grep -oE '^f[0-9]+')
      if ! echo "$NAME_NO_EXT" | grep -qE "^(${FEAT_PREFIX}-|spk[0-9]+-)"; then
        echo "Feature file '$BASENAME' should start with '${FEAT_PREFIX}-' or 'spkNN-' (e.g. ${FEAT_PREFIX}-feature-brief.md, spk01-feasibility.md)" >&2
        exit 2
      fi
    elif echo "$PARENT_DIR" | grep -qE '^s[0-9]+-'; then
      # Inside story dir — file should start with sNN-
      STORY_PREFIX=$(echo "$PARENT_DIR" | grep -oE '^s[0-9]+')
      if ! echo "$NAME_NO_EXT" | grep -qE "^${STORY_PREFIX}-"; then
        echo "Story file '$BASENAME' should start with '${STORY_PREFIX}-' (e.g. ${STORY_PREFIX}-story-brief.md)" >&2
        exit 2
      fi
    elif echo "$PARENT_DIR" | grep -qE '^spk[0-9]+-'; then
      # Inside spike dir — file should start with spkNN-
      SPIKE_PREFIX=$(echo "$PARENT_DIR" | grep -oE '^spk[0-9]+')
      if ! echo "$NAME_NO_EXT" | grep -qE "^${SPIKE_PREFIX}-"; then
        echo "Spike file '$BASENAME' should start with '${SPIKE_PREFIX}-' (e.g. ${SPIKE_PREFIX}-spike-brief.md, ${SPIKE_PREFIX}-findings.md)" >&2
        exit 2
      fi
    fi

    # Content checks for planning files
    TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
    CONTENT=""
    if [ "$TOOL_NAME" = "Write" ]; then
      CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty')
    elif [ "$TOOL_NAME" = "Edit" ]; then
      CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty')
    fi

    if [ -n "$CONTENT" ]; then
      # Checkbox format: only [ ], [~], [x], [-] are canon
      BAD_CB=$(echo "$CONTENT" | grep -nE '^[[:space:]]*-[[:space:]]+\[.' | grep -vE '\[ \]|\[~\]|\[x\]|\[-\]' | head -3 || true)
      if [ -n "$BAD_CB" ]; then
        echo "Non-canon checkbox marker in '$BASENAME'. Valid markers:" >&2
        echo "  [ ] not started  [~] in progress  [x] done  [-] dropped" >&2
        echo "Found:" >&2
        echo "$BAD_CB" >&2
        exit 2
      fi

      # Brief files must have full status header (Write only — Edit can't see full file)
      if [ "$TOOL_NAME" = "Write" ] && echo "$BASENAME" | grep -q '\-brief\.md$'; then
        if ! echo "$CONTENT" | grep -q '^Status:'; then
          echo "Brief file '$BASENAME' is missing required status header. Add to Status section:" >&2
          echo "  Status: not-started | in-progress | blocked | done | dropped" >&2
          echo "  GitHub issue: #NNN" >&2
          echo "  PR: —" >&2
          exit 2
        fi
        if ! echo "$CONTENT" | grep -q '^GitHub issue:'; then
          echo "Brief file '$BASENAME' is missing 'GitHub issue:' line in Status section." >&2
          echo "  GitHub issue: #NNN" >&2
          exit 2
        fi
        if ! echo "$CONTENT" | grep -q '^PR:'; then
          echo "Brief file '$BASENAME' is missing 'PR:' line in Status section." >&2
          echo "  PR: —" >&2
          exit 2
        fi
      fi
    fi
  fi
fi

# Check by extension
case "$EXT" in
  cpp|h)
    # Must be snake_case (allow leading/embedded digits, allow stb_image.h style)
    if ! echo "$NAME_NO_EXT" | grep -qE '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'; then
      echo "C++ file '$BASENAME' must be snake_case (e.g. command_registry.cpp)" >&2
      exit 2
    fi
    ;;
  py)
    # Must be snake_case (allow test_ prefix)
    if ! echo "$NAME_NO_EXT" | grep -qE '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'; then
      echo "Python file '$BASENAME' must be snake_case (e.g. test_registry.py)" >&2
      exit 2
    fi
    ;;
  md)
    # ADR files: must match adr-NNNN-kebab.md
    if echo "$BASENAME" | grep -q '^adr-'; then
      if ! echo "$NAME_NO_EXT" | grep -qE '^adr-[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*$'; then
        echo "ADR file '$BASENAME' must match adr-NNNN-kebab-title.md (e.g. adr-0001-contracts.md)" >&2
        exit 2
      fi
    else
      # General markdown: allow kebab-case, UPPER_CASE, or mixed (README, CHANGELOG, etc.)
      if ! echo "$NAME_NO_EXT" | grep -qE '^([a-z0-9]+(-[a-z0-9]+)*|[A-Z][A-Z0-9]*(_[A-Z0-9]+)*|[A-Z][-A-Za-z0-9]*)$'; then
        echo "Markdown file '$BASENAME' must be kebab-case or UPPER_CASE (e.g. refactor-brief.md, README.md)" >&2
        exit 2
      fi
    fi
    ;;
  json)
    # Allow schema files: *.schema.json
    # Allow any other json naming
    exit 0
    ;;
  sh|js|ts)
    # Allow kebab-case or snake_case
    if ! echo "$NAME_NO_EXT" | grep -qE '^[a-z][a-z0-9]*([_-][a-z0-9]+)*$'; then
      echo "Script file '$BASENAME' must be kebab-case or snake_case (e.g. commit-lint.sh)" >&2
      exit 2
    fi
    ;;
  *)
    # Unknown extensions — allow
    exit 0
    ;;
esac

exit 0
