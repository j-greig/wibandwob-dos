# Planning — Quick Reference

## Where work lives

- **GitHub issues** — brainfart capture only. Open → graduate or close same session.
- **`.pi/todos`** — session whiteboard. Two sessions max → promote or close.
- **`.planning/` briefs** — source of truth. Permanent until done/dropped.

## Brainfart → brief pipeline

Got an idea? Open a GitHub issue. Then immediately:
- Epic-level → create `eNNN-brief.md`, close issue
- Story/task → add checkbox to existing epic brief, close issue
- Vague → add to AGENTS.md Parking Lot or `.planning/ideas/`, close issue
- Already done → close with a note

Never leave a non-epic issue open across sessions.

## `.planning/` structure

```
.planning/
  epics/          # active epic briefs
  epics/.done/    # completed epics
  spikes/         # time-boxed explorations
  spikes/.done/   # completed spikes
  ideas/          # future possibilities
  ideas/.done/    # actioned ideas
  chores/         # housekeeping
```

Story checkboxes: `[ ]` not-started · `[~]` in-progress · `[x]` done · `[-]` dropped
Epic status frontmatter: `not-started` · `in-progress` · `blocked` · `done` · `dropped`

## Commands

```bash
bun run planning:status   # see all epics
bun run planning:sync     # regenerate EPIC_STATUS.md
bun run planning:inbox    # sweep GH issues + stale todos
```

Full canon: `.planning/README.md`
Devlog: `.agents/shell-dev/agentic-devlog.md`
