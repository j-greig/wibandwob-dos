---
name: devlog-briefing
description: >
  Read the current devlog and standing notes to get oriented on recent work,
  open ideas, process friction, and improvement opportunities. Use at the start
  of any session, or when you notice something about the dev process worth
  recording. Triggers on: "devlog", "briefing", "what's been happening",
  "catch me up", "standing notes", "open ideas".
---

# Devlog Briefing

You have access to a living devlog. Read it. Contribute to it.

## Read these now

1. **This week's devlog** — read the current `W{nn}.md`:
   ```
   /Users/james/Repos/wibandwob-dos/.agents/shell-dev/devlogs/W12.md
   ```
   (When W12 is stale, find the latest: `ls -t .agents/shell-dev/devlogs/W*.md | head -1`)

2. **Standing notes** — open ideas, unresolved friction, follow-on work:
   ```
   /Users/james/Repos/wibandwob-dos/.agents/shell-dev/devlogs/standing.md
   ```

## What to look for

- **Ideas you could act on** — dream features, proposed fixes, "someone should..."
- **Friction patterns** — things that keep breaking, workarounds that should be codified
- **Process observations** — what's working, what's not, what scripts/skills need improving

## Writing back

During this session, if you notice any of the following, **append to the current W{nn}.md**:

- Process friction (something was harder than it should be)
- A skill or script that could be better
- A pattern that caused confusion
- Something that worked surprisingly well
- An idea for improving the dev loop

Format: `## YYYY-MM-DD — Title` then bullet observations.

This is meta — observations about **how we work**, not just what we shipped.
Don't wait to be asked. Don't save it for later. Write it when you think it.
