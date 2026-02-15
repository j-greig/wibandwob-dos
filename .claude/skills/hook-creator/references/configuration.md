# Hook Configuration Reference

JSON output format, handler fields, async hooks, environment variables, and hooks in skills/agents.

## JSON Output Format

Exit codes give two options (allow or block). For finer control, exit 0 and print a JSON object to stdout.

**Universal fields** (work across all events):

| Field            | Default | Description                                                  |
|:-----------------|:--------|:-------------------------------------------------------------|
| `continue`       | `true`  | `false` stops Claude entirely. Takes precedence over all else|
| `stopReason`     | none    | Message shown to user when `continue` is `false`             |
| `suppressOutput` | `false` | `true` hides stdout from verbose mode                        |
| `systemMessage`  | none    | Warning message shown to the user                            |

To halt Claude regardless of event:
```json
{ "continue": false, "stopReason": "Build failed, fix errors before continuing" }
```

## Decision Control Summary

| Events                                                          | Pattern              | Key fields                                                    |
|:----------------------------------------------------------------|:---------------------|:--------------------------------------------------------------|
| UserPromptSubmit, PostToolUse, PostToolUseFailure, Stop, SubagentStop | Top-level `decision` | `decision: "block"`, `reason`                                 |
| TeammateIdle, TaskCompleted                                     | Exit code only       | Exit 2 blocks, stderr as feedback                             |
| PreToolUse                                                      | `hookSpecificOutput` | `permissionDecision` (allow/deny/ask), `permissionDecisionReason` |
| PermissionRequest                                               | `hookSpecificOutput` | `decision.behavior` (allow/deny)                              |

## Handler Fields

### Common fields (all handler types)

| Field           | Required | Description                                         |
|:----------------|:---------|:----------------------------------------------------|
| `type`          | yes      | `"command"`, `"prompt"`, or `"agent"`                |
| `timeout`       | no       | Seconds before canceling (defaults: 600/30/60)       |
| `statusMessage` | no       | Custom spinner message while hook runs               |
| `once`          | no       | If `true`, runs only once per session (skills only)  |

### Command hook fields

| Field     | Required | Description                                    |
|:----------|:---------|:-----------------------------------------------|
| `command` | yes      | Shell command to execute                       |
| `async`   | no       | `true` to run in background without blocking   |

### Prompt and agent hook fields

| Field    | Required | Description                                              |
|:---------|:---------|:---------------------------------------------------------|
| `prompt` | yes      | Prompt text. `$ARGUMENTS` placeholder for hook input JSON|
| `model`  | no       | Model to use (defaults to fast model)                    |

Agent hooks spawn a subagent with tool access (Read, Grep, Glob) for up to 50 turns.

Supported events for prompt/agent hooks: PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, UserPromptSubmit, Stop, SubagentStop, TaskCompleted. Not supported: TeammateIdle.

## Async Hooks

Add `"async": true` to command hooks to run in background without blocking Claude.

```json
{
  "type": "command",
  "command": "/path/to/long-running-task.sh",
  "async": true,
  "timeout": 300
}
```

**Behavior:**
- Claude continues immediately without waiting
- When background process exits, `systemMessage` or `additionalContext` delivered on next turn
- Cannot block or return decisions (action already proceeded)
- Only `type: "command"` supports async
- Each execution creates a separate background process (no dedup)

## Environment Variables

| Variable              | Available in     | Description                                   |
|:----------------------|:-----------------|:----------------------------------------------|
| `$CLAUDE_PROJECT_DIR` | All hooks        | Project root directory                        |
| `$CLAUDE_PLUGIN_ROOT` | Plugin hooks     | Plugin root directory                         |
| `$CLAUDE_ENV_FILE`    | SessionStart only| File path for persisting env vars for session |
| `$CLAUDE_CODE_REMOTE` | All hooks        | `"true"` in remote web environments           |

## Hooks in Skills and Agents

Define hooks in YAML frontmatter. Scoped to component lifecycle — only run while active, cleaned up when finished.

```yaml
---
name: secure-operations
description: Perform operations with security checks
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh"
  Stop:
    - hooks:
        - type: prompt
          prompt: "Verify all tasks complete. $ARGUMENTS"
---
```

For subagents, `Stop` hooks are automatically converted to `SubagentStop`.

## Hook Locations and Precedence

| Location                        | Scope           | Shareable?        |
|:--------------------------------|:----------------|:------------------|
| `~/.claude/settings.json`       | All projects    | No                |
| `.claude/settings.json`         | Single project  | Yes (commit)      |
| `.claude/settings.local.json`   | Single project  | No (gitignored)   |
| Managed policy settings         | Organization    | Yes (admin)       |
| Plugin `hooks/hooks.json`       | When enabled    | Yes (bundled)     |
| Skill/agent YAML frontmatter   | While active    | Yes               |

All matching hooks run in parallel. Identical hook commands are deduplicated.

Enterprise admins can use `allowManagedHooksOnly` to block user, project, and plugin hooks.

## Disabling Hooks

- Remove entry from settings JSON, or delete via `/hooks` menu
- `"disableAllHooks": true` in settings to disable all at once
- Toggle in `/hooks` menu bottom option
- No way to disable individual hooks while keeping them configured

Direct file edits require `/hooks` review or session restart to take effect.
