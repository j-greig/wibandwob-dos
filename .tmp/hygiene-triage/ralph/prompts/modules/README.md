# Ralph Modules

Modular add-ons for Ralph that can be enabled/disabled via `.claude/ralph-modules.json`.

## Available Modules

### simple-logger
**Purpose:** Human-readable markdown logs of each iteration

**Output:** `.ralph-logs/happy-blue-volcano.md` (3-word session ID)

**Format:**
```markdown
## Iteration 3 - 19:31:42
**Status:** ✅ Complete
**Did:** Created quiz page
**Next:** Add images
```

**Best for:** Quick visual debugging, understanding what Ralph is doing

---

### iteration-logger
**Purpose:** Structured JSONL logs for programmatic analysis

**Output:** `.ralph-logs/clever-pink-dragon.jsonl` (3-word session ID)

**Format:**
```json
{"session":"clever-pink-dragon","iteration":3,"status":"complete",...}
```

**Best for:** Parsing with jq, analytics, automated monitoring

---

## Enabling Modules

Create `.claude/ralph-modules.json`:

```json
{
  "enabled_modules": ["simple-logger"]
}
```

Or enable both:

```json
{
  "enabled_modules": ["simple-logger", "iteration-logger"]
}
```

## Session IDs

Each Ralph run gets a unique 3-word ID like:
- `happy-blue-volcano`
- `clever-pink-dragon`
- `swift-cyan-robot`

Makes it easy to:
- Find logs for a specific run
- Compare different attempts
- Debug what went wrong

## Viewing Logs

```bash
# List all sessions
ls .ralph-logs/*.md

# View a session
cat .ralph-logs/happy-blue-volcano.md

# Get current session ID
cat .ralph-logs/CURRENT_SESSION

# Follow current session in real-time
tail -f .ralph-logs/$(cat .ralph-logs/CURRENT_SESSION).md
```

## Why Use Logging?

**Prevents infinite loops** - See if Ralph is repeating the same work
**Shows progress** - Track what's been completed
**Debugs blocks** - Identify when Ralph gets stuck
**Maintains context** - Each iteration knows what previous ones did
