#!/bin/bash
# SessionEnd hook: Create clickable notification + session file + ralph loop logging
# Project: ralph-wibandwob

# Parse JSON input
JSON=$(cat)
SESSION_ID=$(echo "$JSON" | jq -r '.session_id')
REASON=$(echo "$JSON" | jq -r '.reason')
CWD=$(echo "$JSON" | jq -r '.cwd')
TRANSCRIPT=$(echo "$JSON" | jq -r '.transcript_path')

# Read Ralph loop environment variables (set by ralph-wibandwob.sh)
RALPH_ITER="${RALPH_ITERATION:-unknown}"
RALPH_MAX="${RALPH_MAX_ITERATIONS:-unknown}"
RALPH_MIN="${RALPH_MIN_ITERATIONS:-unknown}"
RALPH_PROMISE="${RALPH_COMPLETION_PROMISE:-WIBWOBIFIED}"
RALPH_ROOT="${RALPH_PROJECT_ROOT:-$CLAUDE_PROJECT_DIR}"

# Determine actual end reason by parsing transcript
ACTUAL_REASON="$REASON"
if [ -f "$TRANSCRIPT" ] && [ "$RALPH_ITER" != "unknown" ]; then
  # Check if completion promise was detected in last 50 lines of transcript
  if tail -50 "$TRANSCRIPT" 2>/dev/null | grep -q "<promise>$RALPH_PROMISE</promise>"; then
    ACTUAL_REASON="completion_promise_detected"
  elif [ "$RALPH_ITER" -ge "$RALPH_MAX" ] 2>/dev/null; then
    ACTUAL_REASON="max_iterations_reached"
  elif [ "$RALPH_ITER" -lt "$RALPH_MIN" ] 2>/dev/null; then
    ACTUAL_REASON="early_exit_before_minimum"
  fi
fi

# Create sessions directory
SESSIONS_DIR="${CLAUDE_PROJECT_DIR}/.claude/sessions"
mkdir -p "$SESSIONS_DIR"

# Write session file (telegraphic format)
SESSION_FILE="$SESSIONS_DIR/${SESSION_ID}.txt"
cat > "$SESSION_FILE" <<EOF
Session: $SESSION_ID
Ended: $(date +'%Y-%m-%d %H:%M:%S')
Reason: $ACTUAL_REASON (claude: $REASON)
Iteration: $RALPH_ITER / $RALPH_MAX (min: $RALPH_MIN)
Directory: $CWD
Transcript: $TRANSCRIPT

Click to open transcript:
file://$TRANSCRIPT
EOF

# Clickable notification (terminal-notifier) or fallback (osascript)
if command -v terminal-notifier &> /dev/null; then
  terminal-notifier \
    -title "Ralph Session Ended" \
    -subtitle "$ACTUAL_REASON" \
    -message "Iteration $RALPH_ITER/$RALPH_MAX" \
    -execute "open '$SESSION_FILE'"
else
  osascript -e "display notification \"Iteration $RALPH_ITER/$RALPH_MAX\" with title \"Ralph-WibAndWob Session Ended\" subtitle \"$ACTUAL_REASON\""
fi

# Log to session history file
LOG_FILE="${CLAUDE_PROJECT_DIR}/.claude/session-history.log"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Session ended - ID: $SESSION_ID - Reason: $ACTUAL_REASON - Iteration: $RALPH_ITER/$RALPH_MAX - CWD: $CWD - File: $SESSION_FILE" >> "$LOG_FILE"

# Log to ralph-execution.log (if in ralph project root)
if [ -d "$RALPH_ROOT/logs" ]; then
  RALPH_LOG="$RALPH_ROOT/logs/ralph-execution.log"
  echo "session_end: iter=$RALPH_ITER reason=$ACTUAL_REASON session=$SESSION_ID" >> "$RALPH_LOG"
fi

exit 0
