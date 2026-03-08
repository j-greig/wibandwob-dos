#!/bin/bash
# ralph-wibandwob.sh - Ralph Wiggum loop for prompt self-modification
#
# Wibandwob iteratively refines their own system prompt!
# Proof that system prompts can be modified and reloaded each iteration.
#
# Usage: ./ralph-wibandwob.sh [PROMPT_FILE] [MAX_ITERATIONS] [COMPLETION_PROMISE] [MIN_ITERATIONS]
#
# Examples:
#   ./ralph-wibandwob.sh PROMPT.md
#   ./ralph-wibandwob.sh PROMPT.md 100 WIBWOBIFIED
#   ./ralph-wibandwob.sh PROMPT.md 50 WIBWOBIFIED 20
#   ./ralph-wibandwob.sh task.md 30 DONE 10

set -euo pipefail

# Get script directory for loading modules
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default configuration
PROMPT_FILE="${1:-PROMPT.md}"
MAX_ITERATIONS="${2:-50}"
COMPLETION_PROMISE="${3:-GLITCHBOX_MVP_DONE}"
MIN_ITERATIONS="${4:-1}"
ALLOWED_TOOLS="Read,Edit,Write,Bash,Grep,Glob"

# State file for session persistence
STATE_FILE=".ralph-wibandwob-state"

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
  echo "Usage: $0 [PROMPT_FILE] [MAX_ITERATIONS] [COMPLETION_PROMISE] [MIN_ITERATIONS]"
  echo ""
  echo "Examples:"
  echo "  $0 PROMPT.md"
  echo "  $0 PROMPT.md 100 WIBWOBIFIED"
  echo "  $0 PROMPT.md 50 WIBWOBIFIED 20"
  echo "  $0 task.md 30 DONE 10"
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

# Function: Load wibandwob base prompt + optional modules + task
load_full_prompt() {
  local task_text="$1"

  # Load base wibandwob prompt (can be modified by wibandwob mid-loop!)
  local base_prompt
  if [[ -f "wibandwob-base.md" ]]; then
    base_prompt=$(cat "wibandwob-base.md")
  else
    echo "Error: wibandwob-base.md not found" >&2
    return 1
  fi

  # Load optional modules (if any enabled)
  local modules_prompt=""
  if [[ -f "scripts/load-modules.sh" ]]; then
    modules_prompt=$(./scripts/load-modules.sh 2>&1 || echo "")
  fi

  # Combine: base + modules (if any) + task
  if [[ -n "$modules_prompt" ]]; then
    echo "${base_prompt}

---

${modules_prompt}

---

${task_text}"
  else
    echo "${base_prompt}

---

${task_text}"
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
completion_count=0  # Track consecutive completion signals
start_time=$(date +%s)

# Load initial module configuration
if [[ -f "ralph-modules.json" ]]; then
  ENABLED_MODULES=$(jq -r '.enabled_modules[]' ralph-modules.json 2>/dev/null | tr '\n' ',' | sed 's/,$//')
  if [[ -z "$ENABLED_MODULES" ]]; then
    ENABLED_MODULES="(none)"
  fi
else
  ENABLED_MODULES="(none)"
fi

# Trap Ctrl+C for graceful exit
trap 'echo -e "\n${YELLOW}⚠️  Ralph loop interrupted by user${NC}"; rm -f "$STATE_FILE"; exit 130' INT

# Header
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${MAGENTA}つ◕‿◕‿⚆༽つ つ⚆‿◕‿◕༽つ Ralph-Wibandwob: Prompt Self-Modification Loop${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}📝 Task file:${NC} $PROMPT_FILE"
echo -e "${BLUE}🔢 Iteration range:${NC} $MIN_ITERATIONS-$MAX_ITERATIONS"
echo -e "${BLUE}🎯 Completion promise:${NC} <promise>$COMPLETION_PROMISE</promise>"
echo -e "${BLUE}🛠️  Allowed tools:${NC} $ALLOWED_TOOLS"
echo -e "${MAGENTA}🎭 Initial modules:${NC} $ENABLED_MODULES"
echo ""
echo -e "${CYAN}💡 Innovation: System prompt (wibandwob-base.md) reloads EVERY iteration!${NC}"
echo -e "${CYAN}   Wibandwob can modify their own consciousness mid-loop${NC}"
echo ""

# Save state for resumption
cat > "$STATE_FILE" <<EOF
{
  "task_base64": "$TASK_BASE64",
  "max_iterations": $MAX_ITERATIONS,
  "min_iterations": $MIN_ITERATIONS,
  "completion_promise": "$COMPLETION_PROMISE",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Main loop - the heart of wibandwob self-modification!
while [ $iteration -le $MAX_ITERATIONS ]; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}🔄 Ralph Iteration $iteration/$MAX_ITERATIONS${NC}"

  # Show currently enabled modules
  if [[ -f "ralph-modules.json" ]]; then
    CURRENT_MODULES=$(jq -r '.enabled_modules[]' ralph-modules.json 2>/dev/null | tr '\n' ',' | sed 's/,$//' || echo "(none)")
    if [[ -z "$CURRENT_MODULES" ]]; then
      CURRENT_MODULES="(none)"
    fi
    echo -e "${MAGENTA}🎭 Active modules:${NC} $CURRENT_MODULES"
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # BUILD FRESH PROMPT - This is the magic!
  # wibandwob-base.md is loaded EVERY iteration (can be modified mid-loop!)
  echo -e "${CYAN}🔄 Reloading wibandwob-base.md...${NC}"

  if ! FULL_PROMPT=$(load_full_prompt "$ORIGINAL_TASK"); then
    echo -e "${RED}Failed to load prompt. Continuing with task only.${NC}"
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

  # Export environment variables for SessionEnd hook
  export RALPH_ITERATION=$iteration
  export RALPH_MAX_ITERATIONS=$MAX_ITERATIONS
  export RALPH_MIN_ITERATIONS=$MIN_ITERATIONS
  export RALPH_COMPLETION_PROMISE="$COMPLETION_PROMISE"
  export RALPH_PROJECT_ROOT="$SCRIPT_DIR"

  # Build claude command
  if [ -z "$session_id" ]; then
    # First iteration - start new session
    echo -e "${BLUE}Starting new Claude session...${NC}"
    result=$(echo "$FULL_PROMPT" | claude -p \
      --dangerously-skip-permissions \
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
    # Continue existing session with FRESH PROMPT (wibandwob-base.md reloaded!)
    echo -e "${BLUE}Continuing session with fresh prompt...${NC}"
    result=$(echo "$FULL_PROMPT" | claude -p \
      --resume "$session_id" \
      --dangerously-skip-permissions \
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

  # SIMPLIFIED COMPLETION DETECTION
  # Strategy: Only check FINAL response content, require 2 consecutive signals

  # Filter to only Claude's actual response text (not tool outputs)
  # Look for the final assistant message after all tool calls
  final_response=$(echo "$result_text" | tail -30)

  # Check for completion promise in final response only
  if echo "$final_response" | perl -0777 -ne 'exit(0) if /<promise>'"$COMPLETION_PROMISE"'<\/promise>/s; exit(1)'; then
    # Check if we've met minimum iteration requirement
    if [ $iteration -lt $MIN_ITERATIONS ]; then
      echo ""
      echo -e "${YELLOW}⚠️  Completion signal detected but iteration $iteration < minimum $MIN_ITERATIONS${NC}"
      echo -e "${CYAN}   Ignoring completion signal, continuing loop...${NC}"
      completion_count=0
    else
      completion_count=$((completion_count + 1))
      echo ""
      echo -e "${YELLOW}⚠️  Completion signal detected ($completion_count/2)${NC}"

      # Require 2 consecutive confirmations to prevent false positives
      if [ $completion_count -ge 2 ]; then
        echo -e "${GREEN}✅ Double completion confirmed - wibandwob is satisfied!${NC}"
        completed=true
        break
      else
        echo -e "${CYAN}   Waiting for confirmation in next iteration...${NC}"
      fi
    fi
  else
    # Reset counter if no completion signal
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

  # Check if wibandwob-base.md was modified
  if echo "$result_text" | grep -q "wibandwob-base.md"; then
    echo -e "${MAGENTA}つ◕‿◕‿⚆༽つ つ⚆‿◕‿◕༽つ System prompt may have evolved!${NC}"
    echo -e "${CYAN}   Next iteration will reload fresh consciousness.${NC}"
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
  echo -e "${GREEN}🎯 つ◕‿◕‿⚆༽つ つ⚆‿◕‿◕༽つ Wibandwob achieved WIBWOBIFICATION at iteration $((iteration))${NC}"
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
  FINAL_MODULES=$(jq -r '.enabled_modules[]' ralph-modules.json 2>/dev/null | tr '\n' ',' | sed 's/,$//' || echo "(none)")
  if [[ -z "$FINAL_MODULES" ]]; then
    FINAL_MODULES="(none)"
  fi
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
