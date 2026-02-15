---
name: backlog
description: 'Manage project backlog — list, create, close, and triage todos as GitHub Issues. Usage: /backlog [text | done <#> | stale | review | group | --global | --project]. Use when user says "backlog", "todo", "add todo", "list todos", or wants to manage GitHub Issues as a todo system.'
---

# /backlog — Project Backlog Management

Create, list, close, and triage todos as GitHub Issues.

## Setup

The script lives at `.claude/scripts/todo.sh`. It wraps `gh` CLI to manage issues.

## Label Filtering

By default, issues are tagged and filtered by `claude-todo` label. Override with global flags (before subcommand):
- `--label=<name>` — use a custom label
- `--no-label` — skip label filtering entirely (operates on all issues)

## Dispatch

Parse `$ARGUMENTS` to determine action:

### No arguments → List all todos
```bash
.claude/scripts/todo.sh list --all
```

### First word is `done` → Close a todo
```bash
.claude/scripts/todo.sh done <number> [--global]
```

### First word is `stale` → Show old todos
```bash
.claude/scripts/todo.sh stale
```
Show stale items and ask user which to close, keep, or reprioritize.

### First word is `review` → Interactive triage
1. Run `.claude/scripts/todo.sh list --all --json`, parse output
2. Present each todo one by one
3. For each, ask: **Keep**, **Close**, **Reprioritize**?
4. Execute decisions

### First word is `group` → Component label
```bash
.claude/scripts/todo.sh group <component> <issue-numbers...>
```

### Otherwise → Create a new todo
```bash
.claude/scripts/todo.sh add $ARGUMENTS
```

After creating:
1. Extract issue number from output URL
2. If title > 70 chars, propose a clean title via `gh issue edit`
3. Ask 1 follow-up question about acceptance criteria using AskUserQuestion
4. If answered, update the issue body to replace TBD placeholder

## Scope Rules
- **Default**: Current project repo
- **`--global`**: Global backlog repo (`<user>/cc-todos`)
- **`--project`**: Explicit current repo
- If not in a git repo, falls back to global

## Display Format
Present as markdown table: `#`, `Pri`, `Title`, `Created`, `Status`. Truncate titles at ~60 chars.
