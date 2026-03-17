# Ralph Module: Iteration Logger

## Purpose
Track progress across Ralph loop iterations to prevent getting stuck and provide visibility into what's happening.

## Behavior

At the START of iteration 1:

1. Generate unique 3-word session ID (e.g., `clever-pink-dragon`)
2. Store in `.ralph-logs/CURRENT_SESSION`
3. Create `.ralph-logs/[session-id].jsonl`

At the START of each response:

1. Read current session ID from `.ralph-logs/CURRENT_SESSION`
2. Check iteration log: `.ralph-logs/[session-id].jsonl`
3. Read the last few entries to understand what you've already done
4. Append a new entry with this iteration's plan

At the END of each response (before attempting exit), you MUST:

1. Update the current iteration entry with completion status
2. List what files were created/modified
3. Note any blockers or decisions made

## Log Format

Each session gets its own JSONL file: `.ralph-logs/[session-id].jsonl`

Each iteration appends a JSON line:

```json
{"session":"clever-pink-dragon","iteration":3,"timestamp":"2026-01-01T19:30:00Z","status":"complete","plan":"Add quiz page","completed":["Created quiz.html","Added JavaScript quiz logic"],"created_files":["schoolscience/quiz.html","schoolscience/quiz.js"],"modified_files":["schoolscience/index.html"],"blockers":[],"next_steps":["Add images","Test on mobile"]}
```

## Implementation

### Start of Response
```bash
# Ensure log directory exists
mkdir -p .ralph-logs

# Generate or load session ID
if [[ ! -f .ralph-logs/CURRENT_SESSION ]]; then
  ADJECTIVES=(happy clever bright swift bold calm cool quick wise warm)
  COLORS=(red blue green purple orange pink yellow cyan violet lime)
  NOUNS=(volcano rocket tiger dragon phoenix robot comet galaxy wizard turtle)
  SESSION_ID="${ADJECTIVES[$RANDOM % 10]}-${COLORS[$RANDOM % 10]}-${NOUNS[$RANDOM % 10]}"
  echo "$SESSION_ID" > .ralph-logs/CURRENT_SESSION
else
  SESSION_ID=$(cat .ralph-logs/CURRENT_SESSION)
fi

# Read recent history (last 3 iterations)
tail -3 ".ralph-logs/${SESSION_ID}.jsonl" 2>/dev/null | jq -r '.iteration, .status, .completed[]' || echo "Starting fresh"

# Append new entry marking as in_progress
ITERATION_NUM=$(wc -l < ".ralph-logs/${SESSION_ID}.jsonl" 2>/dev/null || echo 0)
ITERATION_NUM=$((ITERATION_NUM + 1))
```

### End of Response
```bash
# Update the log entry with completion status
```

## Benefits

- **Prevents loops**: See if you're repeating the same work
- **Shows progress**: User can track what's been done
- **Debugs blocks**: Identify when Ralph gets stuck on same issue
- **Maintains context**: Each iteration knows what previous ones did

## Usage

Enable this module by adding to `.claude/ralph-modules.json`:

```json
{
  "enabled_modules": ["iteration-logger"]
}
```

Then Ralph will automatically log each iteration's work to `.ralph-logs/[session-id].jsonl`.

Each Ralph run gets a unique 3-word session ID for easy identification.
