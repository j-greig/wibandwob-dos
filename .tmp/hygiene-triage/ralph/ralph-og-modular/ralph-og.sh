#!/bin/bash
# ralph-og.sh - Original Ralph Wiggum loop technique
#
# This implements the ORIGINAL technique from Geoffrey Huntley's blog:
# https://ghuntley.com/ralph/
#
# Usage: ./ralph-og.sh [PROMPT_FILE] [MAX_ITERATIONS] [COMPLETION_PROMISE]
#
# Examples:
#   ./ralph-og.sh PROMPT.md
#   ./ralph-og.sh PROMPT.md 100 COMPLETE
#   ./ralph-og.sh task.md 20 DONE

set -euo pipefail

# Default configuration
PROMPT_FILE="${1:-PROMPT.md}"
MAX_ITERATIONS="${2:-50}"
COMPLETION_PROMISE="${3:-DONE}"
ALLOWED_TOOLS="Bash,Read,Edit,Write,Grep,Glob"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed${NC}"
  echo "Install with: brew install jq"
  exit 1
fi

# Check if claude is available
if ! command -v claude &> /dev/null; then
  echo -e "${RED}Error: claude CLI is required but not found${NC}"
  echo "Install Claude Code from: https://claude.com/claude-code"
  exit 1
fi

# Read prompt once (same prompt every iteration - key to Ralph technique!)
PROMPT=$(cat "$PROMPT_FILE")

# Initialize
iteration=1
session_id=""
completed=false
start_time=$(date +%s)

# Trap Ctrl+C for graceful exit
trap 'echo -e "\n${YELLOW}⚠️  Ralph loop interrupted by user${NC}"; exit 130' INT

# Header
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🔄 Ralph-OG: Original Ralph Wiggum Loop Technique${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}📝 Prompt file:${NC} $PROMPT_FILE"
echo -e "${BLUE}🔢 Max iterations:${NC} $MAX_ITERATIONS"
echo -e "${BLUE}🎯 Completion promise:${NC} <promise>$COMPLETION_PROMISE</promise>"
echo -e "${BLUE}🛠️  Allowed tools:${NC} $ALLOWED_TOOLS"
echo ""
echo -e "${YELLOW}💡 Key principle: Same prompt, evolving environment!${NC}"
echo ""

# Main loop - the heart of Ralph!
while [ $iteration -le $MAX_ITERATIONS ]; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}🔄 Ralph Iteration $iteration/$MAX_ITERATIONS${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Build claude command
  if [ -z "$session_id" ]; then
    # First iteration - start new session
    echo -e "${BLUE}Starting new Claude session...${NC}"
    result=$(echo "$PROMPT" | claude -p \
      --allowedTools "$ALLOWED_TOOLS" \
      --output-format json \
      2>&1 || true)

    # Extract session ID for continuation
    session_id=$(echo "$result" | jq -r '.session_id // empty' 2>/dev/null || echo "")

    if [ -n "$session_id" ]; then
      echo -e "${GREEN}✓ Session started: $session_id${NC}"
    fi
  else
    # Continue existing session with same prompt (Ralph magic!)
    echo -e "${BLUE}Continuing session $session_id...${NC}"
    result=$(echo "$PROMPT" | claude -p \
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

  # Check for completion promise using proper XML tag extraction
  if echo "$result_text" | perl -0777 -ne 'exit(0) if /<promise>'"$COMPLETION_PROMISE"'<\/promise>/s; exit(1)'; then
    echo ""
    echo -e "${GREEN}✅ Completion detected: <promise>$COMPLETION_PROMISE</promise>${NC}"
    completed=true
    break
  fi

  # Display result preview
  echo ""
  echo -e "${BLUE}📄 Claude's response:${NC}"
  echo "────────────────────────────────────────────────────────────────"
  echo "$result_text" | head -30
  echo "────────────────────────────────────────────────────────────────"
  echo ""

  # Check if response indicates we should stop
  if echo "$result_text" | grep -qi "nothing more to do\|task complete\|all done"; then
    echo -e "${YELLOW}💡 Claude indicates task may be complete${NC}"
    echo -e "${YELLOW}   But no <promise> tag found. Continuing...${NC}"
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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Exit with appropriate code
if [ "$completed" = true ]; then
  exit 0
else
  exit 1
fi
