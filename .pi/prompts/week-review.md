---
description: Review a week's agentic dev reflections — theme, triage, close the loop
---

Review the agentic dev reflections for **${1:-the current week}**.

---

## Step 1 · Gather

- Read `.pi/reflections/2026-${1:-W??}.md` (find the right file if week number omitted)
- Run `git log --all --oneline --after=<monday> --before=<sunday>` for the same period
- Count entries in the reflection file

---

## Step 2 · Theme

Group every pain, idea, and observation into thematic buckets. Name each bucket in 2-4 words. Typical buckets: CLI, SDK, blessed, shaders, deploy, docs, process, multi-agent — but derive from the actual content, don't force categories.

For each bucket, list every idea/pain as a one-liner.

---

## Step 3 · Cross-reference

First, try the fast path:
```bash
scripts/devlog-triage.sh $1
```
If the file has `[id:WXX-NNN]` tags this auto-generates the triage table. Done — skip to Step 5.

If no tags (older files), do it manually: for each idea, check `git log --grep`, filename searches, and your codebase knowledge. Mark each:
- **✅ done:hash** — fully resolved, commit exists
- **🟠 partial** — some sub-ideas shipped, pain reduced not gone
- **🟡 in-progress** — actively being worked on
- **🔵 open** — understood, not started
- **🚫 wontfix** — explicitly not doing

Don't guess — if you can't find evidence, mark it open.

---

## Step 4 · Triage table

Output a summary table:

| Theme | Total | Shipped | Open | Highest-leverage open item |
|-------|-------|---------|------|----------------------------|

Then: **Top 3 open items to action or kill this week.** For each, state: do it, defer with reason, or kill with reason. Carrying items without a decision is how backlogs rot.

---

## Step 5 · Process check

Ask yourself:
- Were ideas tagged at write-time? If not, propose a lightweight tagging convention.
- Were commits linkable to devlog entries? If not, propose a convention.
- What made this review hard? Note it so the next one is easier.

---

## Output

Write the full review (Steps 2-5) to `scratch/plans/<YYYY-MM-DD>-<week>-review.md`.

Then give a 5-line summary to the human: how many entries, how many shipped, biggest gap, top 3 actions.
