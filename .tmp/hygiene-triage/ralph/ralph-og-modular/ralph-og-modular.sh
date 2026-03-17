#!/bin/bash
# ralph-og-modular.sh - Ralph Wiggum loop with DYNAMIC module loading
#
# This implements the Ralph technique with the breakthrough innovation:
# Modules can be added/removed MID-LOOP and take effect next iteration!
#
# Usage: ./ralph-og-modular.sh [PROMPT_FILE] [MAX_ITERATIONS] [COMPLETION_PROMISE]
#
# Examples:
#   ./ralph-og-modular.sh PROMPT.md
#   ./ralph-og-modular.sh PROMPT.md 100 COMPLETE
#   ./ralph-og-modular.sh task.md 20 DONE

set -euo pipefail

# Get script directory for loading modules
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default configuration
PROMPT_FILE="${1:-PROMPT.md}"
MAX_ITERATIONS="${2:-50}"
COMPLETION_PROMISE="${3:-DONE}"
ALLOWED_TOOLS="Bash,Read,Edit,Write,Grep,Glob"

# State file for session persistence
STATE_FILE=".ralph-og-state"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Validate prompt file exists
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo -e "${RED}Error: Prompt file '$PROMPT_FILE' not found${NC}"
  echo ""
  echo "Usage: $0 [PROMPT_FILE] [MAX_ITERATIONS] [COMPLETION_PROMISE]"
  echo ""
  echo "Examples:"
  echo "  $0 PROMPT.md"
  echo "  $0 PROMPT.md 100 COMPLETE"
  echo "  $0 task.md 20 DONE"
  exit 1
fi

# Check dependencies
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed${NC}"
  echo "Install with: brew install jq"
  exit 1
fi

if ! command -v claude &> /dev/null; then
  echo -e "${RED}Error: claude CLI is required but not found${NC}"
  echo "Install Claude Code from: https://claude.com/claude-code"
  exit 1
fi

# Check if module loader exists
if [[ ! -f "scripts/load-modules.sh" ]]; then
  echo -e "${RED}Error: scripts/load-modules.sh not found${NC}"
  echo "This script is required for dynamic module loading."
  exit 1
fi

# Function: Load modules and combine with task
load_full_prompt() {
  local task_text="$1"

  # Load system prompt from modules
  local system_prompt
  if ! system_prompt=$(./scripts/load-modules.sh 2>&1); then
    echo -e "${RED}Error loading modules:${NC}" >&2
    echo "$system_prompt" >&2
    return 1
  fi

  # Combine system prompt + task
  if [[ -n "$system_prompt" ]]; then
    echo "${system_prompt}

---

${task_text}"
  else
    echo "$task_text"
  fi
}

# Read original task ONCE (this stays constant)
ORIGINAL_TASK=$(cat "$PROMPT_FILE")

# Store original task as base64 (for state persistence)
TASK_BASE64=$(printf '%s' "$ORIGINAL_TASK" | base64)

# Initialize
iteration=1
session_id=""
completed=false
completion_count=0  # Track consecutive completion signals (frankbria pattern)
start_time=$(date +%s)

# Load initial module configuration
if [[ -f "ralph-modules.json" ]]; then
  ENABLED_MODULES=$(jq -r '.enabled_modules[]' ralph-modules.json 2>/dev/null | tr '\n' ',' | sed 's/,$//')
else
  ENABLED_MODULES="(none)"
fi

# Trap Ctrl+C for graceful exit
trap 'echo -e "\n${YELLOW}⚠️  Ralph loop interrupted by user${NC}"; rm -f "$STATE_FILE"; exit 130' INT

# Header
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${MAGENTA}🎭 Ralph-OG-Modular: Dynamic Module Loading${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}📝 Prompt file:${NC} $PROMPT_FILE"
echo -e "${BLUE}🔢 Max iterations:${NC} $MAX_ITERATIONS"
echo -e "${BLUE}🎯 Completion promise:${NC} <promise>$COMPLETION_PROMISE</promise>"
echo -e "${BLUE}🛠️  Allowed tools:${NC} $ALLOWED_TOOLS"
echo -e "${MAGENTA}🎭 Initial modules:${NC} $ENABLED_MODULES"
echo ""
echo -e "${CYAN}💡 Innovation: Modules reload EVERY iteration!${NC}"
echo -e "${CYAN}   Ralph can modify ralph-modules.json mid-loop${NC}"
echo ""

# Save state for resumption
cat > "$STATE_FILE" <<EOF
{
  "task_base64": "$TASK_BASE64",
  "max_iterations": $MAX_ITERATIONS,
  "completion_promise": "$COMPLETION_PROMISE",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Main loop - the heart of modular Ralph!
while [ $iteration -le $MAX_ITERATIONS ]; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}🔄 Ralph Iteration $iteration/$MAX_ITERATIONS${NC}"

  # Show currently enabled modules
  if [[ -f "ralph-modules.json" ]]; then
    CURRENT_MODULES=$(jq -r '.enabled_modules[]' ralph-modules.json 2>/dev/null | tr '\n' ',' | sed 's/,$//' || echo "(error reading)")
    echo -e "${MAGENTA}🎭 Active modules:${NC} $CURRENT_MODULES"
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # BUILD FRESH PROMPT - This is the magic!
  # Modules are loaded EVERY iteration from current ralph-modules.json
  echo -e "${CYAN}🔄 Reloading modules...${NC}"

  if ! FULL_PROMPT=$(load_full_prompt "$ORIGINAL_TASK"); then
    echo -e "${RED}Failed to load modules. Continuing with task only.${NC}"
    FULL_PROMPT="$ORIGINAL_TASK"
  fi

  # LOG FULL PROMPT (timestamped for debugging)
  timestamp=$(date +"%Y%m%d-%H%M%S")
  prompt_log_dir="logs/prompts"
  mkdir -p "$prompt_log_dir"
  prompt_log_file="$prompt_log_dir/iteration-${iteration}-${timestamp}.md"
  echo "# Iteration $iteration - Full Prompt
## Timestamp
$(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Active Modules
$CURRENT_MODULES

## Prompt Content
$FULL_PROMPT" > "$prompt_log_file"
  echo -e "${BLUE}📝 Logged prompt to: $prompt_log_file${NC}"

  # Build claude command
  if [ -z "$session_id" ]; then
    # First iteration - start new session
    echo -e "${BLUE}Starting new Claude session...${NC}"
    result=$(echo "$FULL_PROMPT" | claude -p \
      --allowedTools "$ALLOWED_TOOLS" \
      --output-format json \
      2>&1 || true)

    # Extract session ID for continuation
    session_id=$(echo "$result" | jq -r '.session_id // empty' 2>/dev/null || echo "")

    if [ -n "$session_id" ]; then
      echo -e "${GREEN}✓ Session started: $session_id${NC}"

      # Save session ID to state
      jq --arg sid "$session_id" '. + {session_id: $sid}' "$STATE_FILE" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
    fi
  else
    # Continue existing session with FRESH PROMPT (modules reloaded!)
    echo -e "${BLUE}Continuing session with fresh modules...${NC}"
    result=$(echo "$FULL_PROMPT" | claude -p \
      --resume "$session_id" \
      --allowedTools "$ALLOWED_TOOLS" \
      --output-format json \
      2>&1 || true)
  fi

  # Check if we got valid JSON
  if ! echo "$result" | jq empty 2>/dev/null; then
    echo -e "${RED}⚠️  Invalid JSON response from Claude${NC}"
    echo "$result"
    echo ""
    iteration=$((iteration + 1))
    sleep 2
    continue
  fi

  # Extract the result text
  result_text=$(echo "$result" | jq -r '.result // empty' 2>/dev/null || echo "")

  # SMART COMPLETION DETECTION (inspired by frankbria/ralph-claude-code)
  # Strategy: Only check FINAL response content (after tool outputs), require 2 consecutive signals

  # Filter to only Claude's actual response text (not tool outputs like Read showing PROMPT.md)
  # Look for the final assistant message after all tool calls
  final_response=$(echo "$result_text" | tail -30)

  # Check for completion promise in final response only
  if echo "$final_response" | perl -0777 -ne 'exit(0) if /<promise>'"$COMPLETION_PROMISE"'<\/promise>/s; exit(1)'; then
    completion_count=$((completion_count + 1))
    echo ""
    echo -e "${YELLOW}⚠️  Completion signal detected ($completion_count/2)${NC}"

    # VALIDATE REQUIREMENTS BEFORE ACCEPTING COMPLETION
    # Count created pages
    page_count=$(find module-showcase/pages -name "*.html" 2>/dev/null | wc -l | tr -d ' ')

    # Count custom modules (files created during this run, not pre-existing)
    available_modules=$(jq -r '.available_modules[]' ralph-modules.json 2>/dev/null | wc -l | tr -d ' ')
    original_module_count=8  # crabs, pirate, french, architect, bard, hacker, synesthete, time-traveller
    custom_module_count=$((available_modules - original_module_count))

    # Requirements check
    pages_ok=false
    modules_ok=false

    [ "$page_count" -ge 10 ] && pages_ok=true
    [ "$custom_module_count" -ge 3 ] && modules_ok=true

    echo -e "${CYAN}   Checking requirements:${NC}"
    echo -e "     Pages created: $page_count/10 $([ "$pages_ok" = true ] && echo "✓" || echo "✗")"
    echo -e "     Custom modules: $custom_module_count/3 $([ "$modules_ok" = true ] && echo "✓" || echo "✗")"

    # Only proceed if requirements met AND double-confirmation
    if [ "$pages_ok" = true ] && [ "$modules_ok" = true ] && [ $completion_count -ge 2 ]; then
      echo -e "${GREEN}✅ Requirements met + double confirmation - task complete!${NC}"
      completed=true
      break
    elif [ "$pages_ok" = false ] || [ "$modules_ok" = false ]; then
      echo -e "${RED}❌ Requirements not met yet - continuing loop${NC}"
      completion_count=0  # Reset since requirements not satisfied
    else
      echo -e "${CYAN}   Requirements met, waiting for confirmation in next iteration...${NC}"
    fi
  else
    # Reset counter if no completion signal (prevents stale counts)
    if [ $completion_count -gt 0 ]; then
      echo -e "${BLUE}ℹ️  Completion counter reset (was at $completion_count)${NC}"
    fi
    completion_count=0
  fi

  # Display result preview
  echo ""
  echo -e "${BLUE}📄 Claude's response:${NC}"
  echo "────────────────────────────────────────────────────────────────"
  echo "$result_text" | head -30
  echo "────────────────────────────────────────────────────────────────"
  echo ""

  # Check if modules were modified
  if echo "$result_text" | grep -q "ralph-modules.json"; then
    echo -e "${MAGENTA}🎭 Module configuration may have changed!${NC}"
    echo -e "${CYAN}   Next iteration will reload fresh modules.${NC}"
    echo ""
  fi

  # Increment
  iteration=$((iteration + 1))

  # Brief pause to avoid rate limits
  sleep 1
done

# Calculate duration
end_time=$(date +%s)
duration=$((end_time - start_time))
minutes=$((duration / 60))
seconds=$((duration % 60))

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$completed" = true ]; then
  echo -e "${GREEN}✅ Ralph loop completed successfully!${NC}"
  echo -e "${GREEN}🎯 Promise detected at iteration $((iteration))${NC}"
else
  echo -e "${YELLOW}⚠️  Ralph loop stopped at max iterations ($MAX_ITERATIONS)${NC}"
  echo -e "${YELLOW}💡 Consider:${NC}"
  echo "   - Increasing max iterations"
  echo "   - Refining your prompt"
  echo "   - Checking if completion promise is correct"
fi
echo ""
echo -e "${BLUE}📊 Statistics:${NC}"
echo "   Total iterations: $iteration"
echo "   Duration: ${minutes}m ${seconds}s"
if [ -n "$session_id" ]; then
  echo "   Session ID: $session_id"
fi

# Show final module state
if [[ -f "ralph-modules.json" ]]; then
  FINAL_MODULES=$(jq -r '.enabled_modules[]' ralph-modules.json 2>/dev/null | tr '\n' ',' | sed 's/,$//' || echo "(error)")
  echo -e "${MAGENTA}🎭 Final modules:${NC} $FINAL_MODULES"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup state file
rm -f "$STATE_FILE"

# Exit with appropriate code
if [ "$completed" = true ]; then
  exit 0
else
  exit 1
fi
