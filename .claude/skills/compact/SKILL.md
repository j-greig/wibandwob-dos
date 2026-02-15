---
name: compact
description: Context preservation before compaction. Use when context window is getting full, before /compact, or when user says "compact", "save context". Captures working state so nothing lost during context compression.
---

# /compact — Context Preservation

Preserve working state before context window compaction.

## Procedure

1. **Capture current state** — summarize in a structured block:
   - What task is in progress
   - What files have been modified (list with brief description of changes)
   - What's left to do
   - Any decisions made during this session
   - Current git branch and status

2. **Write to memory** — save the summary to the project memory directory:
   ```
   /Users/james/.claude/projects/-Users-james-Repos-wibandwob-dos/logs/memory/
   ```
   Use filename `compact-{date}.md`.

3. **Output the summary** so it survives compaction in the conversation.

## Format

```markdown
# Context Snapshot — {date} {time}

## Active Task
{what we're working on}

## Modified Files
- `path/to/file` — {what changed}

## Decisions Made
- {decision and rationale}

## Remaining Work
- [ ] {next step}

## Git State
Branch: {branch}
Status: {clean/dirty, uncommitted files}
```
