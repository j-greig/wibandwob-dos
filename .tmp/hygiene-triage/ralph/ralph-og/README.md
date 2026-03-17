# Ralph-OG: Original Ralph Wiggum Loop Technique

> "While :; do cat PROMPT.md | npx --yes @sourcegraph/amp ; done"
> — Geoffrey Huntley

This directory contains the **ORIGINAL** Ralph Wiggum loop technique as described in [Geoffrey Huntley's blog post](https://ghuntley.com/ralph/), implemented using Claude Code CLI.

## What is Ralph-OG?

Ralph-OG is a simple bash loop that:
1. Reads a prompt file ONCE
2. Pipes it into `claude -p` repeatedly
3. Maintains session continuity across iterations
4. Stops when completion is detected or max iterations reached

**Key Insight**: The prompt stays the same, but the environment evolves (files change, git commits appear, test output differs). Ralph sees different context each loop!

## Quick Start

```bash
# 1. Create your prompt file
cp PROMPT.md.example PROMPT.md
# Edit PROMPT.md with your task

# 2. Run Ralph
./ralph-og.sh PROMPT.md

# 3. Watch Ralph iterate until complete or max iterations
```

## Installation

### Requirements

- **Claude Code CLI** - [Install from claude.com/claude-code](https://claude.com/claude-code)
- **jq** - JSON processor (`brew install jq`)
- **bash** - Should be available on macOS/Linux

### Setup

```bash
# Clone or copy this directory
cd ralph-og/

# Make script executable (if not already)
chmod +x ralph-og.sh

# Verify dependencies
./ralph-og.sh --help  # Will show error if dependencies missing
```

## Usage

### Basic Usage

```bash
./ralph-og.sh [PROMPT_FILE] [MAX_ITERATIONS] [COMPLETION_PROMISE]
```

### Examples

```bash
# Use defaults (PROMPT.md, 50 iterations, "DONE" promise)
./ralph-og.sh

# Custom prompt file
./ralph-og.sh my-task.md

# Custom max iterations
./ralph-og.sh PROMPT.md 100

# Custom completion promise
./ralph-og.sh PROMPT.md 50 COMPLETE

# All custom
./ralph-og.sh build-compiler.md 200 COMPILER_READY
```

### Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `PROMPT_FILE` | `PROMPT.md` | Path to your task prompt |
| `MAX_ITERATIONS` | `50` | Safety limit for loops |
| `COMPLETION_PROMISE` | `DONE` | Promise text to detect completion |

## How It Works

### The Loop Mechanism

```bash
while [ iteration <= MAX_ITERATIONS ]; do
  # Send same prompt to Claude
  claude -p < PROMPT_FILE --resume $session_id

  # Check for completion promise: <promise>DONE</promise>
  if promise_found; then
    break  # Success!
  fi

  # Increment iteration
  # Environment has changed from Claude's work!
done
```

### Environment Evolution

Each iteration, the prompt is THE SAME, but:

| Iteration 1 | Iteration 2 | Iteration 3 |
|-------------|-------------|-------------|
| No files exist | `server.js` created | Tests added |
| No git history | Initial commit | Fix commit |
| No test output | 3 tests failing | 1 test failing |

**Ralph sees the same question in different contexts!**

### Completion Detection

Ralph stops when it finds:

```xml
<promise>YOUR_PROMISE_TEXT</promise>
```

In Claude's output. The promise text must match EXACTLY.

Example:
```bash
./ralph-og.sh PROMPT.md 50 TESTS_PASSING

# Ralph will stop when Claude outputs:
# <promise>TESTS_PASSING</promise>
```

## Creating Effective Prompts

### Template Structure

Use `PROMPT.md.example` as a starting point:

```markdown
# Ralph Task: [Your Goal]

## Context
@specs/*        # Load specs every iteration
@fix_plan.md    # Load plan every iteration

## Your Task
Build a REST API for user management.
Choose the most important thing to implement.

## After Implementation
1. Run tests
2. Update @fix_plan.md
3. Commit if tests pass

## Completion
<promise>DONE</promise>

## Rules
- One thing per iteration
- Search before implementing
- Use subagents for expensive ops
```

### Key Principles (from Geoffrey's Blog)

#### 1. One Thing Per Loop
```
❌ "Implement users, auth, and database"
✅ "Implement user model. Choose most important next step."
```

#### 2. Deterministic Stack Allocation
Always load the same context files:
- `@specs/*` - Your specifications
- `@fix_plan.md` - Current plan/TODO
- `@AGENT.md` - Build instructions

#### 3. Trust Ralph to Decide
```
✅ "Choose the most important thing to implement"
❌ "First do X, then Y, then Z"
```

#### 4. Use Subagents
```
✅ "Use up to 500 parallel subagents for searching"
❌ Direct grep/find commands in main context
```

#### 5. No Placeholders
```
✅ "DO NOT IMPLEMENT PLACEHOLDER IMPLEMENTATIONS"
❌ Allowing stub implementations
```

### Example Prompts

See `examples/` directory for complete examples:
- `simple-task-example.md` - Basic REST API
- `compiler-example.md` - CURSED compiler-style
- `test-driven-example.md` - TDD approach

## Ralph-OG vs Ralph-Wiggum Skill

This repository contains TWO implementations of the Ralph technique:

| Aspect | ralph-og (This) | ralph-wiggum skill |
|--------|-----------------|-------------------|
| **Mechanism** | External bash loop | Stop hook interception |
| **Location** | `ralph-og/` | `.claude/skills/ralph-wiggum/` |
| **Session** | Single persistent session | Multiple sessions |
| **Prompt** | Read once, reused | Rebuilt each iteration |
| **Modules** | Static (in PROMPT.md) | Dynamic (loaded per iteration) |
| **State** | Environment only | Explicit state file |
| **Complexity** | Simple ~200 lines bash | Complex hooks + scripts |
| **Use case** | Greenfield automation | Interactive development |
| **Portability** | Any Claude CLI | Claude Code only |
| **Commands** | `./ralph-og.sh PROMPT.md` | `/ralph-loop "task"` |

### When to Use Which?

**Use ralph-og.sh when:**
- ✅ You want the ORIGINAL technique from the blog
- ✅ You're automating greenfield projects
- ✅ You want simple, transparent bash loops
- ✅ You want to run overnight/unattended
- ✅ You prefer explicit control

**Use ralph-wiggum skill when:**
- ✅ You're working interactively in Claude Code
- ✅ You want dynamic module loading
- ✅ You prefer integrated experience
- ✅ You want hook-based automation

## Best Practices

### From Geoffrey's CURSED Project

These practices come from building an entire programming language with Ralph:

#### Loop Structure
```bash
# Good: Read prompt once, reuse
PROMPT=$(cat PROMPT.md)
while loop; do
  echo "$PROMPT" | claude -p --resume $session
done

# Bad: Re-read every time (changes if file modified)
while loop; do
  cat PROMPT.md | claude -p
done
```

#### Backpressure (Testing)
```markdown
## After Implementation
1. Run tests for the code you changed
2. If tests fail, fix them before next iteration
3. Update @fix_plan.md with progress
```

#### Self-Improvement
```markdown
## Learning
When you learn something new about the build process,
update @AGENT.md so future iterations benefit.
```

#### TODO List Management
```markdown
## Planning
Periodically regenerate @fix_plan.md by:
1. Studying existing code
2. Comparing against specs
3. Searching for TODOs and placeholders
4. Prioritizing remaining work
```

## Troubleshooting

### Ralph Never Completes

**Problem**: Loops hit max iterations without `<promise>` tag

**Solutions**:
1. Check your PROMPT.md explains completion clearly
2. Verify promise tag format: `<promise>EXACT_TEXT</promise>`
3. Increase max iterations if task is genuinely large
4. Check Claude's last responses for clues

### Invalid JSON Errors

**Problem**: `jq` fails to parse Claude output

**Solutions**:
1. Check `claude -p` works: `echo "test" | claude -p`
2. Verify `--output-format json` is supported in your Claude version
3. Update Claude Code to latest version

### Session Not Resuming

**Problem**: Each iteration seems to forget previous work

**Solutions**:
1. Check session ID is being extracted: `jq -r '.session_id'`
2. Verify `--resume` flag is supported
3. Check Claude Code logs for session errors

### Rate Limiting

**Problem**: Claude API errors after many iterations

**Solutions**:
1. Increase `sleep 1` to `sleep 5` in script
2. Reduce parallel subagents in prompt
3. Check your Claude API tier limits

## Advanced Usage

### Custom Allowed Tools

Edit the script to change allowed tools:

```bash
# Default
ALLOWED_TOOLS="Bash,Read,Edit,Write,Grep,Glob"

# Add more
ALLOWED_TOOLS="Bash,Read,Edit,Write,Grep,Glob,NotebookEdit,WebFetch"

# Minimal
ALLOWED_TOOLS="Read,Bash"
```

### Logging Iterations

Capture full output of each iteration:

```bash
# Create logs directory
mkdir -p logs

# Modify loop to log
echo "$result_text" > "logs/iteration-${iteration}.txt"
```

### Resume Capability

Save session ID to resume later:

```bash
# Save after first iteration
echo "$session_id" > .ralph-session

# Resume in new run
if [ -f .ralph-session ]; then
  session_id=$(cat .ralph-session)
fi
```

## Examples

### Example 1: Simple REST API

```bash
# 1. Create prompt
cat > PROMPT.md <<'EOF'
# Ralph Task: Build User API

## Task
Build a REST API for user management.
Endpoints: GET /users, POST /users, GET /users/:id

## Implementation
1. Create Express app
2. Add routes
3. Write tests
4. Ensure tests pass

## Completion
<promise>API_COMPLETE</promise>
EOF

# 2. Run Ralph
./ralph-og.sh PROMPT.md 30 API_COMPLETE
```

### Example 2: Test-Driven Development

```bash
# Use the TDD example
./ralph-og.sh examples/test-driven-example.md 50 TESTS_GREEN
```

### Example 3: Compiler Building

```bash
# CURSED-style compiler loop
./ralph-og.sh examples/compiler-example.md 200 SELF_HOSTING
```

## FAQ

### Q: How is this different from just running Claude multiple times?

A: Ralph maintains session continuity and uses the SAME prompt each time. The environment evolves (files, git, tests) but the task description stays constant. This creates a self-referential feedback loop.

### Q: Why not use the ralph-wiggum skill instead?

A: Both are valid! This implements the ORIGINAL bash loop technique. The skill uses hooks for integration. Choose based on your workflow preference.

### Q: Can I use this with other AI tools besides Claude?

A: Yes! The technique works with any CLI tool that:
- Accepts prompts via stdin or `-p` flag
- Can maintain session continuity
- Returns parseable output

Just modify the script to call your tool instead of `claude`.

### Q: What if my task needs more than 50 iterations?

A: Increase the limit: `./ralph-og.sh PROMPT.md 200 DONE`

Geoffrey's CURSED compiler used ~3 months of iterations!

### Q: Should I commit Ralph's changes?

A: YES! In your PROMPT.md, instruct Ralph to commit when tests pass. This creates a git trail of progress.

## Learn More

- **Original Blog Post**: https://ghuntley.com/ralph/
- **Full Article Summary**: `../ralph-wiggum-software-engineer.md`
- **Y Combinator Field Report**: https://github.com/repomirrorhq/repomirror/blob/main/repomirror.md
- **Ralph Wiggum Skill**: `../.claude/skills/ralph-wiggum/`

## Philosophy

> "That's the beauty of Ralph - the technique is deterministically bad in an undeterministic world."

Ralph will test you. You need to:
- Believe in eventual consistency
- Have faith the loop will converge
- Tune prompts based on observed behavior
- Not blame the tools when Ralph misbehaves

**Any problem created by AI can be resolved through a different series of prompts.**

## Contributing

Have improvements to ralph-og.sh? Ideas for better examples? Found bugs?

This is part of the wibandwob-ralph repository. See `../CONTRIBUTING.md`.

## License

MIT License - See `../LICENSE`

Based on the Ralph Wiggum technique by [Geoffrey Huntley](https://ghuntley.com/).

---

**"I'm helping!"** - Ralph Wiggum
