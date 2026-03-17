#!/bin/bash
# Simplified module loader for ralph-wibandwob
# Loads optional modifier modules if enabled

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

MODULES_CONFIG="ralph-modules.json"

# Check if config exists
if [[ ! -f "$MODULES_CONFIG" ]]; then
  # No modules, return empty
  exit 0
fi

# Read enabled modules
ENABLED_MODULES=$(jq -r '.enabled_modules[]' "$MODULES_CONFIG" 2>/dev/null || echo "")

if [[ -z "$ENABLED_MODULES" ]]; then
  # No modules enabled
  exit 0
fi

# Load each enabled module
MODULES_PROMPT=""
while IFS= read -r module; do
  MODULE_FILE="modules/${module}.md"

  if [[ -f "$MODULE_FILE" ]]; then
    if [[ -n "$MODULES_PROMPT" ]]; then
      MODULES_PROMPT="${MODULES_PROMPT}

---

"
    fi
    MODULES_PROMPT="${MODULES_PROMPT}$(cat "$MODULE_FILE")"
  else
    echo "Warning: Module file not found: $MODULE_FILE" >&2
  fi
done <<< "$ENABLED_MODULES"

# Output combined modules
echo "$MODULES_PROMPT"
