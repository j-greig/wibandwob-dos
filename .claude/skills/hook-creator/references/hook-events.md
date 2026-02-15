# Hook Events Reference

Input schemas and decision control for all 14 hook events. Each event receives [common input fields](#common-input-fields) plus event-specific fields.

## Common Input Fields

All events receive these fields via stdin as JSON:

| Field             | Description                                          |
|:------------------|:-----------------------------------------------------|
| `session_id`      | Current session identifier                           |
| `transcript_path` | Path to conversation JSONL                           |
| `cwd`             | Working directory when hook was invoked              |
| `permission_mode` | `default`, `plan`, `acceptEdits`, `dontAsk`, `bypassPermissions` |
| `hook_event_name` | Name of the event that fired                         |

---

## SessionStart

Fires when a session begins or resumes. Stdout added as context for Claude.

**Matcher values:** `startup`, `resume`, `clear`, `compact`

**Additional input fields:**

| Field        | Description                                          |
|:-------------|:-----------------------------------------------------|
| `source`     | How session started: `startup`, `resume`, `clear`, `compact` |
| `model`      | Model identifier                                     |
| `agent_type` | Agent name if started with `claude --agent <name>`   |

**Decision control:** Cannot block. Stdout added as context. Return `additionalContext` in JSON for structured injection. Has access to `CLAUDE_ENV_FILE` for persisting environment variables.

**Environment variables via `CLAUDE_ENV_FILE`:**
```bash
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
fi
```

---

## UserPromptSubmit

Fires when user submits a prompt, before Claude processes it. No matcher support — always fires.

**Additional input fields:**

| Field    | Description              |
|:---------|:-------------------------|
| `prompt` | The user's prompt text   |

**Decision control:** Can block prompts. Stdout added as context.

| Field               | Description                                          |
|:--------------------|:-----------------------------------------------------|
| `decision`          | `"block"` prevents prompt processing and erases it   |
| `reason`            | Shown to user when blocking (not added to context)   |
| `additionalContext` | String added to Claude's context                     |

---

## PreToolUse

Fires before a tool call executes. Matches on tool name: `Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `Task`, `WebFetch`, `WebSearch`, MCP tools.

**Additional input fields:**

| Field         | Description                   |
|:--------------|:------------------------------|
| `tool_name`   | Name of the tool              |
| `tool_input`  | Tool arguments (tool-specific)|
| `tool_use_id` | Unique ID for this tool call  |

**Tool input fields by tool:**

- **Bash:** `command`, `description`, `timeout`, `run_in_background`
- **Write:** `file_path`, `content`
- **Edit:** `file_path`, `old_string`, `new_string`, `replace_all`
- **Read:** `file_path`, `offset`, `limit`
- **Glob:** `pattern`, `path`
- **Grep:** `pattern`, `path`, `glob`, `output_mode`, `-i`, `multiline`
- **WebFetch:** `url`, `prompt`
- **WebSearch:** `query`, `allowed_domains`, `blocked_domains`
- **Task:** `prompt`, `description`, `subagent_type`, `model`

**Decision control** (uses `hookSpecificOutput`, not top-level `decision`):

| Field                      | Description                                             |
|:---------------------------|:--------------------------------------------------------|
| `permissionDecision`       | `"allow"` (bypass perms), `"deny"` (block), `"ask"` (prompt user) |
| `permissionDecisionReason` | For allow/ask: shown to user. For deny: shown to Claude |
| `updatedInput`             | Modify tool input before execution                      |
| `additionalContext`        | String added to Claude's context                        |

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Database writes not allowed"
  }
}
```

---

## PermissionRequest

Fires when a permission dialog is about to be shown. Matches on tool name.

**Additional input fields:**

| Field                    | Description                           |
|:-------------------------|:--------------------------------------|
| `tool_name`              | Name of the tool                      |
| `tool_input`             | Tool arguments                        |
| `permission_suggestions` | Array of "always allow" options       |

**Decision control** (uses `hookSpecificOutput`):

| Field                | Description                                      |
|:---------------------|:-------------------------------------------------|
| `behavior`           | `"allow"` grants permission, `"deny"` denies it  |
| `updatedInput`       | For allow: modify tool input                      |
| `updatedPermissions` | For allow: apply permission rule updates          |
| `message`            | For deny: tells Claude why                        |
| `interrupt`          | For deny: if `true`, stops Claude entirely        |

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedInput": { "command": "npm run lint" }
    }
  }
}
```

Note: PermissionRequest does not fire in non-interactive mode (`-p`). Use PreToolUse instead.

---

## PostToolUse

Fires after a tool completes successfully. Matches on tool name.

**Additional input fields:**

| Field           | Description                |
|:----------------|:---------------------------|
| `tool_name`     | Name of the tool           |
| `tool_input`    | Tool arguments             |
| `tool_response` | Result returned by the tool|
| `tool_use_id`   | Unique ID for this call    |

**Decision control:**

| Field                  | Description                                    |
|:-----------------------|:-----------------------------------------------|
| `decision`             | `"block"` prompts Claude with reason           |
| `reason`               | Shown to Claude when blocking                  |
| `additionalContext`    | Additional context for Claude                  |
| `updatedMCPToolOutput` | For MCP tools: replaces tool output            |

---

## PostToolUseFailure

Fires when a tool execution fails. Matches on tool name.

**Additional input fields:**

| Field          | Description                                |
|:---------------|:-------------------------------------------|
| `tool_name`    | Name of the tool                           |
| `tool_input`   | Tool arguments                             |
| `tool_use_id`  | Unique ID for this call                    |
| `error`        | Error description string                   |
| `is_interrupt` | Whether failure was from user interruption |

**Decision control:** Return `additionalContext` to add context alongside the error.

---

## Notification

Fires when Claude Code sends a notification. Matches on notification type.

**Matcher values:** `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`

**Additional input fields:**

| Field               | Description              |
|:--------------------|:-------------------------|
| `message`           | Notification text        |
| `title`             | Optional title           |
| `notification_type` | Which type fired         |

**Decision control:** Cannot block. Return `additionalContext` to add context.

---

## SubagentStart

Fires when a subagent is spawned via the Task tool. Matches on agent type.

**Matcher values:** `Bash`, `Explore`, `Plan`, or custom agent names from `.claude/agents/`

**Additional input fields:**

| Field        | Description                    |
|:-------------|:-------------------------------|
| `agent_id`   | Unique identifier for subagent |
| `agent_type` | Agent type name                |

**Decision control:** Cannot block. Return `additionalContext` to inject context into the subagent.

---

## SubagentStop

Fires when a subagent finishes. Matches on agent type.

**Additional input fields:**

| Field                    | Description                                  |
|:-------------------------|:---------------------------------------------|
| `stop_hook_active`       | `true` if already continuing from stop hook  |
| `agent_id`               | Unique identifier for subagent               |
| `agent_type`             | Agent type name                              |
| `agent_transcript_path`  | Path to subagent's transcript JSONL          |

**Decision control:** Same as Stop — `decision: "block"` with `reason` prevents subagent from stopping.

---

## Stop

Fires when Claude finishes responding. Does not fire on user interrupts. No matcher support.

**Additional input fields:**

| Field              | Description                                     |
|:-------------------|:------------------------------------------------|
| `stop_hook_active` | `true` if continuing as result of a stop hook   |

**Decision control:**

| Field      | Description                                          |
|:-----------|:-----------------------------------------------------|
| `decision` | `"block"` prevents Claude from stopping              |
| `reason`   | Required with block — tells Claude why to continue   |

**Loop prevention:** Always check `stop_hook_active` and exit early if `true`:
```bash
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi
```

---

## TeammateIdle

Fires when an agent team teammate is about to go idle. No matcher support.

**Additional input fields:**

| Field           | Description                   |
|:----------------|:------------------------------|
| `teammate_name` | Name of the idle teammate     |
| `team_name`     | Name of the team              |

**Decision control:** Exit code only (no JSON). Exit 2 with stderr message to prevent idle.

---

## TaskCompleted

Fires when a task is marked complete (via TaskUpdate or teammate finishing). No matcher support.

**Additional input fields:**

| Field              | Description                              |
|:-------------------|:-----------------------------------------|
| `task_id`          | Task identifier                          |
| `task_subject`     | Task title                               |
| `task_description` | Detailed description (may be absent)     |
| `teammate_name`    | Teammate completing (may be absent)      |
| `team_name`        | Team name (may be absent)                |

**Decision control:** Exit code only (no JSON). Exit 2 with stderr to block completion.

---

## PreCompact

Fires before context compaction. Matches on trigger.

**Matcher values:** `manual` (from `/compact`), `auto` (context window full)

**Additional input fields:**

| Field                  | Description                                   |
|:-----------------------|:----------------------------------------------|
| `trigger`              | `manual` or `auto`                            |
| `custom_instructions`  | User text from `/compact` (empty for auto)    |

**Decision control:** Cannot block compaction.

---

## SessionEnd

Fires when a session terminates. Matches on exit reason.

**Matcher values:** `clear`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other`

**Additional input fields:**

| Field    | Description           |
|:---------|:----------------------|
| `reason` | Why the session ended |

**Decision control:** Cannot block termination. Use for cleanup tasks.
