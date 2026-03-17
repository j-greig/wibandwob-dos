#!/bin/bash

# Load Modules for Ralph-OG-Modular
# Combines base persona + enabled modules into a full system prompt
# Called on each iteration for dynamic module loading
#
# Usage: ./scripts/load-modules.sh
# Output: System prompt to stdout
# Errors: To stderr with exit code 1

set -euo pipefail

# Paths relative to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Load base Ralph persona
SYSTEM_PROMPT=""
BASE_PROMPT_FILE="ralph-base.md"

if [[ -f "$BASE_PROMPT_FILE" ]]; then
  SYSTEM_PROMPT=$(cat "$BASE_PROMPT_FILE")
else
  # No base prompt is acceptable - modules can work standalone
  SYSTEM_PROMPT=""
fi

# Check for module configuration
MODULES_CONFIG="ralph-modules.json"
if [[ -f "$MODULES_CONFIG" ]]; then
  # Validate JSON before parsing
  if ! jq empty "$MODULES_CONFIG" 2>/dev/null; then
    echo "❌ Error: Invalid JSON in $MODULES_CONFIG" >&2
    echo "" >&2
    echo "   JSON parse error:" >&2
    jq . "$MODULES_CONFIG" 2>&1 | head -5 | sed 's/^/   /' >&2
    exit 1
  fi

  # Read enabled modules from JSON
  ENABLED_MODULES=$(cat "$MODULES_CONFIG" | jq -r '.enabled_modules[]' 2>/dev/null || echo "")

  if [[ -n "$ENABLED_MODULES" ]]; then
    # Load each enabled module
    while IFS= read -r module; do
      [[ -z "$module" ]] && continue  # Skip empty lines

      MODULE_FILE="modules/${module}.md"
      if [[ -f "$MODULE_FILE" ]]; then
        MODULE_CONTENT=$(cat "$MODULE_FILE")
        SYSTEM_PROMPT="${SYSTEM_PROMPT}

---

${MODULE_CONTENT}"
      else
        echo "❌ Error: Module '$module' enabled but file not found: $MODULE_FILE" >&2
        echo "" >&2
        echo "   Available modules:" >&2
        ls modules/*.md 2>/dev/null | sed 's|modules/||; s|\.md$||' | sed 's/^/     - /' >&2 || echo "     (none found)" >&2
        echo "" >&2
        echo "   Fix: Edit ralph-modules.json and remove '$module' from enabled_modules" >&2
        exit 1
      fi
    done <<< "$ENABLED_MODULES"
  fi
fi

# Output the combined system prompt to stdout
echo "$SYSTEM_PROMPT"
