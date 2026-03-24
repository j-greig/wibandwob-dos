---
name: devlog-briefing
description: >
  Surface open ideas and contribute friction back. Run scripts/devlog-open.sh
  to see unresolved pains and ideas from this week's reflection. Use at the
  start of any session, or when you notice something worth recording.
  Triggers on: "devlog", "briefing", "what's been happening", "catch me up",
  "open ideas", "what should I work on".
---

# Devlog Briefing

You have access to a living devlog. Read it. Contribute to it.

## See what's open right now

```bash
bash scripts/devlog-open.sh          # this week's unresolved pains + ideas
bash scripts/devlog-open.sh W12      # specific week
```

To find and read the raw reflection file:
```bash
ls -t .pi/reflections/$(date +%Y)-W*.md | head -1
```

## Go deeper

```bash
bash scripts/devlog-triage.sh W13    # cross-reference ideas with git commits
bash scripts/review-reflection.sh W13  # haiku review of a full reflection file
```

## What to look for

- **Ideas you could act on** — proposed fixes, "someone should..."
- **Friction patterns** — things that keep breaking, workarounds that should be codified
- **Process observations** — what's working, what's not, what scripts/skills need improving

## Write back

Append to this week's file during the session if you notice friction, a useful pattern, or something worth recording:

```bash
scripts/devlog.sh "one-liner note"   # auto-ID, lands under today's → Ideas
scripts/devlog.sh                    # open editor with scaffolded entry
```

Format for manual entries: `## YYYY-MM-DD — Title` then `### Pain` → `**Pain:**` / `**Why:**` / `**Fix:**` / `#### → Ideas`.

Don't wait to be asked. Don't save it for later. Write it when you think it.
