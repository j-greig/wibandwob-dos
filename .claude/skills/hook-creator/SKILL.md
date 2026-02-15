---
name: hook-creator
description: Create and configure Claude Code hooks — shell commands, LLM prompts, or agent subprocesses that execute automatically at lifecycle points (session start, tool use, stop, compaction, etc.). Use when the user wants to (1) automate workflows triggered by Claude Code events, (2) create pre/post tool-use guards or validators, (3) add desktop notifications, (4) auto-format code after edits, (5) block edits to protected files, (6) inject context after compaction, (7) enforce quality gates before stopping, (8) configure any hook in settings.json or skill/agent frontmatter, or (9) understand the hook lifecycle and event system.
---

# Hook Creator

Hooks are user-defined shell commands or LLM prompts that execute at specific points in Claude Code's lifecycle. They provide deterministic control over behavior, ensuring actions always happen rather than relying on the LLM to choose.

## Hook Lifecycle

Events fire in this order during a session. The agentic loop repeats for each tool call:

```
  SessionStart <─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
       |                                         resumed |
  UserPromptSubmit                               sessions|
       |                                                 |
  ┌────|── AGENTIC LOOP ──────────────────┐              |
  |    |                                  |              |
  |  PreToolUse <────────┐                |              |
  |    |                 |                |              |
  |  PermissionRequest   |                |              |
  |    |                 |                |              |
  |  [tool executes]     |                |              |
  |    |                 |                |              |
  |  PostToolUse /       |                |              |
  |  PostToolUseFailure  |                |              |
  |    |                 |                |              |
  |  SubagentStart /     |                |              |
  |  SubagentStop        |                |              |
  |    |                 |                |              |
  |  TaskCompleted ──────┘                |              |
  |    |                                  |              |
  └────|──────────────────────────────────┘              |
       |                                                 |
     Stop              Notification (async, any time)    |
       |                                                 |
  TeammateIdle                                           |
       |                                                 |
  PreCompact                                             |
       |                                                 |
  SessionEnd ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

## Hook Creation Process

1. Identify the hook event
2. Choose the handler type
3. Design the matcher
4. Write the handler
5. Configure the hook
6. Test and debug

### Step 1: Identify the Hook Event

Select the event that matches when the hook should fire:

| Event              | When it fires                        | Can block? |
|:-------------------|:-------------------------------------|:-----------|
| SessionStart       | Session begins or resumes            | No         |
| UserPromptSubmit   | User submits prompt                  | Yes        |
| PreToolUse         | Before tool executes                 | Yes        |
| PermissionRequest  | Permission dialog shown              | Yes        |
| PostToolUse        | After tool succeeds                  | No*        |
| PostToolUseFailure | After tool fails                     | No*        |
| Notification       | Claude sends notification            | No         |
| SubagentStart      | Subagent spawned                     | No         |
| SubagentStop       | Subagent finishes                    | Yes        |
| Stop               | Claude finishes responding           | Yes        |
| TeammateIdle       | Teammate about to go idle            | Yes        |
| TaskCompleted      | Task marked complete                 | Yes        |
| PreCompact         | Before context compaction            | No         |
| SessionEnd         | Session terminates                   | No         |

*PostToolUse/PostToolUseFailure can provide feedback to Claude but cannot undo the action.

For full input schemas and decision control per event, see [references/hook-events.md](references/hook-events.md).

### Step 2: Choose the Handler Type

| Type      | Use when                                              | Default timeout |
|:----------|:------------------------------------------------------|:----------------|
| `command` | Deterministic rules, script execution, external tools | 600s            |
| `prompt`  | Judgment calls, single-turn LLM evaluation            | 30s             |
| `agent`   | Verification needing file/code inspection             | 60s             |

**Command** (`type: "command"`) — most common. Run a shell command. Receives JSON on stdin, communicates via exit codes + stdout.

**Prompt** (`type: "prompt"`) — send prompt + hook input to a Claude model (Haiku by default). Returns `{"ok": true/false, "reason": "..."}`.

**Agent** (`type: "agent"`) — spawn a subagent with tool access (Read, Grep, Glob). Same response format as prompt. Use when verification requires inspecting actual files.

### Step 3: Design the Matcher

Matchers are regex patterns filtering when hooks fire. Each event type matches on a different field:

| Events                                                    | Matches on    | Examples                           |
|:----------------------------------------------------------|:--------------|:-----------------------------------|
| PreToolUse, PostToolUse, PostToolUseFailure, PermissionReq | tool name     | `Bash`, `Edit\|Write`, `mcp__.*`  |
| SessionStart                                              | start reason  | `startup`, `resume`, `compact`     |
| SessionEnd                                                | end reason    | `clear`, `other`                   |
| Notification                                              | notif type    | `permission_prompt`, `idle_prompt` |
| SubagentStart/Stop                                        | agent type    | `Bash`, `Explore`, `Plan`          |
| PreCompact                                                | trigger       | `manual`, `auto`                   |
| UserPromptSubmit, Stop, TeammateIdle, TaskCompleted       | no matcher    | always fires                       |

Omit `matcher`, or set to `""` or `"*"`, to match all occurrences.

MCP tools follow the pattern `mcp__<server>__<tool>` (e.g., `mcp__github__search_repositories`).

### Step 4: Write the Handler

#### Command hooks

Basic pattern — read JSON from stdin, act, exit with appropriate code:

```bash
#!/bin/bash
INPUT=$(cat)
FIELD=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Your logic here

exit 0  # allow (exit 2 = block)
```

**Exit codes:**
- **0** — proceed. Stdout parsed for JSON. For SessionStart/UserPromptSubmit, stdout added as context.
- **2** — block. Stderr fed back to Claude as error message.
- **Other** — non-blocking error. Stderr logged in verbose mode only.

For structured JSON output beyond simple allow/block, see [references/configuration.md](references/configuration.md).

#### Prompt and agent hooks

Provide a `prompt` field. Use `$ARGUMENTS` placeholder for hook input JSON:

```json
{
  "type": "prompt",
  "prompt": "Check if all tasks are complete. Context: $ARGUMENTS",
  "model": "haiku"
}
```

The model responds with `{"ok": true}` to allow or `{"ok": false, "reason": "..."}` to block.

### Step 5: Configure the Hook

Hooks live in JSON settings files. Three nesting levels: event -> matcher group -> handler(s):

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<regex>",
        "hooks": [
          {
            "type": "command",
            "command": "your-command-here"
          }
        ]
      }
    ]
  }
}
```

**Where to save:**

| Location                        | Scope           | Shareable?        |
|:--------------------------------|:----------------|:------------------|
| `~/.claude/settings.json`       | All projects    | No                |
| `.claude/settings.json`         | Single project  | Yes (commit)      |
| `.claude/settings.local.json`   | Single project  | No (gitignored)   |
| Managed policy settings         | Organization    | Yes (admin)       |
| Plugin `hooks/hooks.json`       | When enabled    | Yes (bundled)     |
| Skill/agent YAML frontmatter   | While active    | Yes               |

**Skill/agent frontmatter format:**

```yaml
---
name: my-skill
description: ...
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/check.sh"
---
```

Use `$CLAUDE_PROJECT_DIR` to reference scripts relative to project root. For async execution, add `"async": true` to command hooks.

For full handler fields, JSON output schemas, and async hook details, see [references/configuration.md](references/configuration.md).

### Step 6: Test and Debug

1. **`/hooks` menu** — view, add, delete hooks interactively. Changes take effect immediately.
2. **`Ctrl+O`** — toggle verbose mode to see hook output in transcript.
3. **`claude --debug`** — full execution details: matched hooks, exit codes, output.
4. **Manual test** — pipe sample JSON to your script:
   ```bash
   echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./my-hook.sh
   echo $?
   ```

**Common issues:**
- Hook not firing: matcher is case-sensitive — must match tool name exactly
- JSON parse error: shell profile has unconditional `echo` — wrap in `[[ $- == *i* ]]`
- Stop hook loops: check `stop_hook_active` field and exit early if `true`
- "command not found": use absolute paths or `$CLAUDE_PROJECT_DIR`

## Reference Files

- **[references/hook-events.md](references/hook-events.md)** — Input schemas and decision control for all 14 hook events
- **[references/configuration.md](references/configuration.md)** — JSON output format, handler fields, async hooks, environment variables, hooks in skills/agents
- **[references/patterns.md](references/patterns.md)** — Ready-to-use hook configurations for common automation patterns
