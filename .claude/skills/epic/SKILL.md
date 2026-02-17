---
name: epic
description: 'Manage planning epics — status, detail, transitions. Usage: /epic [E006 | start E006 | done E006 | sync]. Use when user says "epic", "epic status", "what epics", "start epic", "close epic", or wants to check/change epic lifecycle state. Wraps .claude/scripts/planning.sh and .planning/epics/ frontmatter.'
---

# /epic — Epic Lifecycle Management

View and transition planning epics. Wraps `.claude/scripts/planning.sh`.

## Dispatch

Parse `$ARGUMENTS` to determine action:

### No arguments → Status table
```bash
.claude/scripts/planning.sh status
```

### Argument matches `E\d+` pattern → Detail
```bash
.claude/scripts/planning.sh detail <id>
```

### First word is `start` → Set in-progress
1. Find epic brief: `.planning/epics/<dir>/<prefix>-epic-brief.md`
2. Edit frontmatter `status:` to `in-progress`
3. Run `.claude/scripts/planning.sh sync` to update EPIC_STATUS.md
4. Confirm with status table output

### First word is `done` → Mark complete
1. Find epic brief, edit frontmatter `status:` to `done`
2. Run `.claude/scripts/planning.sh sync`
3. If GitHub issue number in frontmatter, remind user to close it
4. Confirm with status table output

### First word is `sync` → Regenerate register
```bash
.claude/scripts/planning.sh sync
```

### First word is `block` → Mark blocked
1. Edit frontmatter `status:` to `blocked`
2. Run `.claude/scripts/planning.sh sync`
3. Ask what's blocking via AskUserQuestion

## Valid Statuses

`not-started`, `in-progress`, `blocked`, `done`, `dropped`

## Breaking Epics into Tasks

Epics contain features and stories. To track individual tasks within an epic, use `/backlog` to create GitHub Issues tagged to the epic. `/epic` owns the strategic view; `/backlog` owns the task-level work.
