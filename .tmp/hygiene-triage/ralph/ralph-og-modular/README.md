# Ralph-OG-Modular: Dynamic Module Loading for Ralph Loops

> "The breakthrough: Modules reload EVERY iteration!"

Ralph-OG-Modular implements the **ORIGINAL** Ralph Wiggum loop technique with a game-changing innovation: **dynamic module loading**. Ralph can modify his own personality mid-loop by editing `ralph-modules.json`, and changes take effect immediately on the next iteration.

## What Makes This Different?

| Feature | ralph-og | ralph-og-modular |
|---------|----------|------------------|
| **Module Support** | ❌ None | ✅ Dynamic modules |
| **Module Loading** | N/A | Every iteration |
| **Mid-Loop Changes** | N/A | ✅ Ralph can modify modules |
| **Personality** | Static | Composable & evolving |
| **Use Case** | Simple automation | Complex adaptive loops |

## Quick Start

```bash
cd ralph-og-modular/

# 1. Review available modules
cat ralph-modules.json

# 2. Create your prompt
cat > PROMPT.md <<'EOF'
# Ralph Task: Build Something Cool

## Your Task
Create a fun web experience.

## Rules
- One thing per iteration
- Use modules if helpful (add via ralph-modules.json)
- Commit when tests pass

## Completion
<promise>DONE</promise>
EOF

# 3. Run Ralph with modules!
./ralph-og-modular.sh PROMPT.md
```

## Smart Completion Detection

Ralph-OG-Modular uses **multi-signal detection + requirement validation** to prevent false positives:

### Three-Layer Protection

1. **Double confirmation**: `<promise>DONE</promise>` must appear in 2 consecutive iterations
2. **Requirement validation**: Task-specific requirements checked before accepting completion
3. **Auto-reset**: Counter resets if signal disappears or requirements fail

### Visual Feedback

```
⚠️  Completion signal detected (1/2)
   Checking requirements:
     Pages created: 4/10 ✗
     Custom modules: 0/3 ✗
❌ Requirements not met yet - continuing loop
```

### How It Works

**Problem**: Ralph might output `<promise>DONE</promise>` even when not genuinely complete (e.g., explaining requirements from PROMPT.md, or being overly optimistic).

**Solution**:
- Parse PROMPT.md for requirements (page counts, module counts, etc.)
- Check actual files created vs requirements
- Only exit when **both** double-confirmation AND requirements are met

**Inspired by**: [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code)

## Prompt Logging

Every iteration logs the **full prompt sent to Claude** for debugging and analysis:

```bash
logs/prompts/iteration-1-20260102-143045.md
logs/prompts/iteration-2-20260102-143127.md
logs/prompts/iteration-3-20260102-143209.md
```

Each log contains:
- Timestamp
- Active modules at that iteration
- Complete system prompt (base persona + modules)
- Original task

This lets you inspect exactly what prompt structure Ralph received and how modules evolved.

## How It Works

### 1. Base Persona + Dynamic Modules

```bash
# Each iteration rebuilds the prompt:
FULL_PROMPT = [ralph-base.md] + [enabled modules] + [your task]
```

### 2. Module Reloading

The breakthrough from commit `1ef1ce6`:

```bash
while [ $iteration -le $MAX_ITERATIONS ]; do
  # Reload modules FRESH every time
  system_prompt=$(./scripts/load-modules.sh)

  # Combine with original task
  full_prompt="${system_prompt}\n---\n${original_task}"

  # Send to Claude
  claude -p --resume "$session_id" <<< "$full_prompt"
done
```

Ralph can modify `ralph-modules.json` mid-loop and changes take effect next iteration.

### 3. Session Continuity

- **First iteration**: Creates new session with `claude -p`
- **Subsequent iterations**: Continues with `--resume $session_id`
- **Context accumulation**: Session maintains conversation history
- **Environment evolution**: Files, git state, tests change each iteration

## Available Modules

Located in `modules/*.md`:

- **crabs** 🦀 - Everything relates to crustaceans
- **pirate** ☠️ - Arr, code like a buccaneer
- **french** 🇫🇷 - Très élégant communication
- **architect** 🏛️ - Systems thinking and design patterns
- **bard** 📜 - Poetry and verse in code
- **hacker** 💻 - Deep technical analysis
- **synesthete** 🌈 - Multi-sensory code experience
- **time-traveller** ⏰ - Temporal code analysis

## Creating Custom Modules

```bash
# 1. Create module file
cat > modules/my-module.md <<'EOF'
# Module: My Module

You now think everything is related to [your theme].

## Behavior
- [Specific traits]
- [Communication style]
EOF

# 2. Register in config
jq '.available_modules += ["my-module"]' ralph-modules.json > tmp.json && mv tmp.json ralph-modules.json

# 3. Enable it (Ralph can do this too!)
jq '.enabled_modules += ["my-module"]' ralph-modules.json > tmp.json && mv tmp.json ralph-modules.json
```

## Testing

Run the verification suite:

```bash
cd tests/
./test-modules.sh
```

Tests cover:
- Module loader functionality
- JSON validation
- Missing module detection
- Module combination
- File structure validation

## Advanced Usage

### Custom completion promises

```bash
./ralph-og-modular.sh PROMPT.md 100 "MISSION_ACCOMPLISHED"
```

### Different max iterations

```bash
./ralph-og-modular.sh PROMPT.md 20  # Quick 20-iteration limit
```

### Monitor module evolution

```bash
# Watch modules change in real-time
watch -n 2 'jq .enabled_modules ralph-modules.json'
```

## Comparison: ralph-og vs ralph-og-modular

| Aspect | ralph-og | ralph-og-modular |
|--------|----------|------------------|
| **Loop mechanism** | External bash loop | External bash loop |
| **Prompt structure** | Static (read once) | Dynamic (rebuilt each iteration) |
| **Modules** | N/A | Reloaded every iteration |
| **Ralph personality** | Fixed in PROMPT.md | Composable via modules |
| **Mid-loop changes** | Environment only | Environment + personality |
| **Completion detection** | Single signal | Double confirmation |
| **Use case** | Simple tasks | Adaptive complex tasks |

## Troubleshooting

**Loop exits after 1 iteration**: Old version had single-signal detection. Update to latest with double-confirmation.

**Modules not loading**: Check `scripts/load-modules.sh` is executable and `ralph-modules.json` is valid JSON.

**Session not resuming**: Session IDs expire. If seeing "session not found", delete `.ralph-og-state` and restart.

## Credits

- **Original Ralph technique**: [Geoffrey Huntley](https://ghuntley.com/ralph/)
- **Multi-signal detection**: Inspired by [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code)
- **Dynamic modules**: Breakthrough from commit `1ef1ce6`
