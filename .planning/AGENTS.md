# Planning — Quick Reference for Agents

Three systems, three roles. Do not mix them up.

## Where work lives

| System | Role | Lifetime |
|--------|------|---------|
| **GitHub issues** | Brainfart inbox + epic kanban board | Open an issue → graduate or close same session |
| **`.pi/todos`** | Session whiteboard | Two sessions max → promote or close |
| **`.planning/` briefs** | Source of truth — everything that lasts | Permanent until done/dropped |

## GitHub issues — two uses only

1. **Brainfart capture** — low friction, open from anywhere. Must graduate this session:
   - Has epic-level scope → create `eNNN-brief.md`, link in frontmatter, leave as epic tracker
   - Has story/task scope → add checkbox to existing epic brief, close the issue
   - Vague idea → add to `AGENTS.md` Parking Lot, close the issue
   - Done already → close with a note

2. **Epic kanban board** — one issue per epic, `epic` label, tracks status on the GitHub board.
   Features/stories/tasks do NOT get issues. The brief is enough.

Never leave a non-epic issue open across sessions.

## `.pi/todos` — session whiteboard only

Good for: subtask tracking mid-session, capturing something before it gets lost.
Not for: multi-session tracking, planning, anything that needs a spec.

After two sessions: promote to a `.planning/` story or close. Never the source of truth.

## `.planning/` briefs — the only source of truth

- `bun run planning:status` — see all epics
- `bun run planning:sync` — regenerate EPIC_STATUS.md after status changes
- `bun run planning:inbox` — sweep GH issues + stale todos, propose promotions/closures

Story checkboxes: `[ ]` not-started · `[~]` in-progress · `[x]` done · `[-]` dropped
Epic status: `not-started` · `in-progress` · `blocked` · `done` · `dropped`

Full canon: `.planning/README.md`

Running devlog (friction, fixes, lessons from live agent work):
`.agents/shell-dev/agentic-devlog.md`

## GitHub kanban board

https://github.com/users/j-greig/projects/2 — epic-level board, one card per epic.
Switch to Board view in the browser (Views tab → Board) for column layout.

To add a new epic issue to the board:
```bash
gh project item-add 2 --owner j-greig --url https://github.com/j-greig/wibandwob-dos/issues/NNN
```

## gh CLI auth — IMPORTANT for agents

`gh` needs the `project` scope to read/write the kanban board. Repo/issue commands work without it.

**Checking scope:**
```bash
gh auth status   # look for 'project' in Token scopes line
```

**If `project` scope is missing** — DO NOT run `gh auth refresh` in a subagent or script.
It requires an interactive TTY and will silently fail or update the wrong token.
Instead: tell the human to run this in their own terminal:
```bash
gh auth refresh -s project
```
That's it. One command. Browser opens automatically. Done in 30 seconds.
Do not suggest creating a new PAT. Do not run device flows via subagents. Just ask.
