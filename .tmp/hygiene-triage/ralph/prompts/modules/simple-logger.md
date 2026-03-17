# Ralph Module: Simple Logger

## Purpose
Create a dead-simple, human-readable log of each iteration's work with unique session IDs.

## Behavior

At the **START** of iteration 1:
1. Generate unique 3-word session ID (e.g., `happy-blue-volcano`)
2. Create `.ralph-logs/SESSION_ID.md`
3. Store session ID in `.ralph-logs/CURRENT_SESSION`

At the **START** of each iteration:
1. Read current session file to see what's been done
2. Decide what to do next based on history

At the **END** of each iteration:
1. Append progress to current session's log file

## Session ID Generation

```bash
# Generate 3-word session ID
ADJECTIVES=(happy clever bright swift bold calm cool quick wise warm)
COLORS=(red blue green purple orange pink yellow cyan violet lime)
NOUNS=(volcano rocket tiger dragon phoenix robot comet galaxy wizard turtle)

WORD1=${ADJECTIVES[$RANDOM % ${#ADJECTIVES[@]}]}
WORD2=${COLORS[$RANDOM % ${#COLORS[@]}]}
WORD3=${NOUNS[$RANDOM % ${#NOUNS[@]}]}

SESSION_ID="${WORD1}-${WORD2}-${WORD3}"
```

## Log Format

Each session gets its own file: `.ralph-logs/happy-blue-volcano.md`

```markdown
# Ralph Session: happy-blue-volcano
**Started:** 2026-01-01 19:30:15
**Task:** Create school science website about volcanoes

---

## Iteration 1 - 19:30:15
**Status:** ✅ Complete
**Did:**
- Created schoolscience/index.html with homepage
- Added basic CSS styling
- Created volcano diagram in ASCII art

**Files:** schoolscience/index.html, schoolscience/style.css
**Next:** Add about page, create quiz

---

## Iteration 2 - 19:31:42
**Status:** ✅ Complete
**Did:**
- Created about.html with volcano facts
- Added navigation menu to all pages

**Files:** schoolscience/about.html
**Next:** Build interactive quiz page
```

## Implementation

**First iteration only:**
```bash
mkdir -p .ralph-logs

# Generate session ID if not exists
if [[ ! -f .ralph-logs/CURRENT_SESSION ]]; then
  ADJECTIVES=(happy clever bright swift bold calm cool quick wise warm)
  COLORS=(red blue green purple orange pink yellow cyan violet lime)
  NOUNS=(volcano rocket tiger dragon phoenix robot comet galaxy wizard turtle)

  SESSION_ID="${ADJECTIVES[$RANDOM % 10]}-${COLORS[$RANDOM % 10]}-${NOUNS[$RANDOM % 10]}"
  echo "$SESSION_ID" > .ralph-logs/CURRENT_SESSION

  cat > ".ralph-logs/${SESSION_ID}.md" <<EOF
# Ralph Session: ${SESSION_ID}
**Started:** $(date '+%Y-%m-%d %H:%M:%S')
**Task:** [Your task here]

---

EOF
fi
```

**Every iteration:**
```bash
# Read session ID and check progress
SESSION_ID=$(cat .ralph-logs/CURRENT_SESSION)
echo "📋 Session: $SESSION_ID"
cat ".ralph-logs/${SESSION_ID}.md" | tail -30
```

**End of iteration:**
```bash
SESSION_ID=$(cat .ralph-logs/CURRENT_SESSION)
ITERATION_NUM=$(grep -c "^## Iteration" ".ralph-logs/${SESSION_ID}.md")
ITERATION_NUM=$((ITERATION_NUM + 1))

cat >> ".ralph-logs/${SESSION_ID}.md" <<EOF
## Iteration ${ITERATION_NUM} - $(date '+%H:%M:%S')
**Status:** ✅ Complete
**Did:**
- [List what you did]

**Files:** [Files created/modified]
**Next:** [What's next]

---

EOF
```

## Benefits

- Each Ralph run gets unique readable session ID
- Easy to find logs: `.ralph-logs/happy-blue-volcano.md`
- No mixing of different tasks in same log
- Can compare different sessions side-by-side
- Human-friendly filenames

## Enable

Add to `.claude/ralph-modules.json`:
```json
{
  "enabled_modules": ["simple-logger"]
}
```

Ralph will automatically log to `.ralph-logs/[3-word-id].md`
