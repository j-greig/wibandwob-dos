---
description: Generate a complete handover prompt for the next session — /handover <focus>
---
Write a complete, self-contained handover prompt that a fresh agent can use to continue this work with zero prior context.

Focus for the next session: $@

Structure the handover prompt exactly as shown below — output only the prompt block, no preamble:

---

## Session Handover

**Project:** (repo name and path)
**Branch:** (current git branch)
**Focus:** $@

### What we were doing
(2–4 sentences — the goal, the approach, where we got to)

### Key decisions made
(bullet list — non-obvious choices, tradeoffs, things tried and rejected)

### Files involved
(bullet list — path + one-line description for each key file)

### State right now
(what's done, what's in-progress, what's broken or incomplete)

### What to do next
(numbered steps — concrete, actionable, in order)

### Gotchas / watch out for
(anything that would burn a fresh agent — edge cases, known flops, fragile areas)

---
