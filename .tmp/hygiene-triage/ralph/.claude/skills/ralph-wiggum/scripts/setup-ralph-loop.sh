#!/bin/bash

# Ralph Loop Setup Script
# Creates state file for in-session Ralph loop

set -euo pipefail

# Parse arguments
PROMPT_PARTS=()
MAX_ITERATIONS=0
COMPLETION_PROMISE="null"

# Parse options and positional arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      cat << 'HELP_EOF'
Ralph Loop - Interactive self-referential development loop

USAGE:
  /ralph-loop [PROMPT...] [OPTIONS]

ARGUMENTS:
  PROMPT...    Initial prompt to start the loop (can be multiple words without quotes)

OPTIONS:
  --max-iterations <n>           Maximum iterations before auto-stop (default: unlimited)
  --completion-promise '<text>'  Promise phrase (USE QUOTES for multi-word)
  -h, --help                     Show this help message

DESCRIPTION:
  Starts a Ralph Wiggum loop in your CURRENT session. The stop hook prevents
  exit and feeds your output back as input until completion or iteration limit.

  To signal completion, you must output: <promise>YOUR_PHRASE</promise>

  Use this for:
  - Interactive iteration where you want to see progress
  - Tasks requiring self-correction and refinement
  - Learning how Ralph works

EXAMPLES:
  /ralph-loop Build a todo API --completion-promise 'DONE' --max-iterations 20
  /ralph-loop --max-iterations 10 Fix the auth bug
  /ralph-loop Refactor cache layer  (runs forever)
  /ralph-loop --completion-promise 'TASK COMPLETE' Create a REST API

STOPPING:
  Only by reaching --max-iterations or detecting --completion-promise
  No manual stop - Ralph runs infinitely by default!

MONITORING:
  # View current iteration:
  grep '^iteration:' .claude/ralph-loop.local.md

  # View full state:
  head -10 .claude/ralph-loop.local.md
HELP_EOF
      exit 0
      ;;
    --max-iterations)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --max-iterations requires a number argument" >&2
        echo "" >&2
        echo "   Valid examples:" >&2
        echo "     --max-iterations 10" >&2
        echo "     --max-iterations 50" >&2
        echo "     --max-iterations 0  (unlimited)" >&2
        echo "" >&2
        echo "   You provided: --max-iterations (with no number)" >&2
        exit 1
      fi
      if ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "❌ Error: --max-iterations must be a positive integer or 0, got: $2" >&2
        echo "" >&2
        echo "   Valid examples:" >&2
        echo "     --max-iterations 10" >&2
        echo "     --max-iterations 50" >&2
        echo "     --max-iterations 0  (unlimited)" >&2
        echo "" >&2
        echo "   Invalid: decimals (10.5), negative numbers (-5), text" >&2
        exit 1
      fi
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --completion-promise)
      if [[ -z "${2:-}" ]]; then
        echo "❌ Error: --completion-promise requires a text argument" >&2
        echo "" >&2
        echo "   Valid examples:" >&2
        echo "     --completion-promise 'DONE'" >&2
        echo "     --completion-promise 'TASK COMPLETE'" >&2
        echo "     --completion-promise 'All tests passing'" >&2
        echo "" >&2
        echo "   You provided: --completion-promise (with no text)" >&2
        echo "" >&2
        echo "   Note: Multi-word promises must be quoted!" >&2
        exit 1
      fi
      COMPLETION_PROMISE="$2"
      shift 2
      ;;
    *)
      # Non-option argument - collect all as prompt parts
      PROMPT_PARTS+=("$1")
      shift
      ;;
  esac
done

# Join all prompt parts with spaces (handle empty array safely)
if [[ ${#PROMPT_PARTS[@]} -gt 0 ]]; then
  PROMPT="${PROMPT_PARTS[*]}"
else
  PROMPT=""
fi

# Validate prompt is non-empty
if [[ -z "$PROMPT" ]]; then
  echo "❌ Error: No prompt provided" >&2
  echo "" >&2
  echo "   Ralph needs a task description to work on." >&2
  echo "" >&2
  echo "   Examples:" >&2
  echo "     /ralph-loop Build a REST API for todos" >&2
  echo "     /ralph-loop Fix the auth bug --max-iterations 20" >&2
  echo "     /ralph-loop --completion-promise 'DONE' Refactor code" >&2
  echo "" >&2
  echo "   For all options: /ralph-loop --help" >&2
  exit 1
fi

# Load Ralph system prompt and modules
# Load Ralph persona + modules using shared script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOAD_PROMPT_SCRIPT="$SCRIPT_DIR/load-ralph-prompt.sh"

echo "📋 Loading Ralph persona and modules..."

# Call the load script to get system prompt
# Capture stdout (the prompt) while letting stderr through for errors
SYSTEM_PROMPT=$("$LOAD_PROMPT_SCRIPT")
LOAD_EXIT_CODE=$?

if [[ $LOAD_EXIT_CODE -ne 0 ]]; then
  # Load script failed - error already printed to stderr
  exit 1
fi

# Show what was loaded
if [[ -f "prompts/ralph.md" ]]; then
  echo "   ✓ Base Ralph persona"
fi

MODULES_CONFIG=".claude/ralph-modules.json"
if [[ -f "$MODULES_CONFIG" ]]; then
  ENABLED_MODULES=$(cat "$MODULES_CONFIG" | jq -r '.enabled_modules[]' 2>/dev/null || echo "")
  if [[ -n "$ENABLED_MODULES" ]]; then
    echo "   ✓ Modules enabled:"
    while IFS= read -r module; do
      [[ -z "$module" ]] && continue
      echo "     - $module"
    done <<< "$ENABLED_MODULES"
  else
    echo "ℹ️  No modules enabled in $MODULES_CONFIG"
  fi
else
  echo "ℹ️  No module config found. Create $MODULES_CONFIG to enable modules."
fi

# Combine system prompt with user task
if [[ -n "$SYSTEM_PROMPT" ]]; then
  FULL_PROMPT="${SYSTEM_PROMPT}

---

# Task

$PROMPT"
else
  FULL_PROMPT="$PROMPT"
fi

# Create state file for stop hook (markdown with YAML frontmatter)
mkdir -p .claude

# Quote completion promise for YAML if it contains special chars or is not null
if [[ -n "$COMPLETION_PROMISE" ]] && [[ "$COMPLETION_PROMISE" != "null" ]]; then
  # YAML escaping: Use printf to safely escape quotes (double each ")
  # In YAML, " inside "..." is escaped as ""
  ESCAPED_PROMISE=$(printf '%s' "$COMPLETION_PROMISE" | sed 's/"/""/g')
  COMPLETION_PROMISE_YAML="\"$ESCAPED_PROMISE\""
else
  COMPLETION_PROMISE_YAML="null"
fi

# Store original task in frontmatter for dynamic module reloading
# This prevents the prompt from growing on each iteration
TASK_BASE64=$(printf '%s' "$PROMPT" | base64)

cat > .claude/ralph-loop.local.md <<EOF
---
active: true
iteration: 1
max_iterations: $MAX_ITERATIONS
completion_promise: $COMPLETION_PROMISE_YAML
started_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
task_prompt: "$TASK_BASE64"
---

$FULL_PROMPT
EOF

# Output setup message
cat <<EOF
🔄 Ralph loop activated in this session!

Iteration: 1
Max iterations: $(if [[ $MAX_ITERATIONS -gt 0 ]]; then echo $MAX_ITERATIONS; else echo "unlimited"; fi)
Completion promise: $(if [[ "$COMPLETION_PROMISE" != "null" ]]; then echo "${COMPLETION_PROMISE//\"/} (ONLY output when TRUE - do not lie!)"; else echo "none (runs forever)"; fi)

The stop hook is now active. When you try to exit, the SAME PROMPT will be
fed back to you. You'll see your previous work in files, creating a
self-referential loop where you iteratively improve on the same task.

To monitor: head -10 .claude/ralph-loop.local.md

⚠️  WARNING: This loop cannot be stopped manually! It will run infinitely
    unless you set --max-iterations or --completion-promise.

🔄
EOF

# Show active modules summary
if [[ -f "$MODULES_CONFIG" ]]; then
  ACTIVE_MODULES=$(cat "$MODULES_CONFIG" | jq -r '.enabled_modules | join(", ")' 2>/dev/null || echo "none")
  if [[ -n "$ACTIVE_MODULES" ]] && [[ "$ACTIVE_MODULES" != "none" ]]; then
    echo ""
    echo "🎭 Active modules: $ACTIVE_MODULES"
  fi
fi

# Output the initial prompt if provided
if [[ -n "$PROMPT" ]]; then
  echo ""
  echo "📝 Task: $PROMPT"
fi
