---
week: YYYY-WNN
purpose: agent self-reflection — friction, pains, failures, and ideas for fixing them via skills, scripts, process changes, or new tooling
themes: 
---

# WNN — Week of YYYY-MM-DD

---

## YYYY-MM-DD — Session name

### Friction name — one line summary

**Pain:** What went wrong or was harder than it should be. Be specific. One sentence preferred.

**Why:** Root cause. Use as many whys as the problem demands — 1 for obvious causes, 5+ for knotty ones. Each why asks 'but why did that happen?' until you hit bedrock. Unknown? Write "unknown — symptoms: X". Can be left blank or "to be explored".

**Fix:** What was done, or what would prevent recurrence. Can be blank, "TBD", or "to be explored" — especially for bugs with unknowns or things discovered mid-session.

#### → Ideas
- One atomic actionable idea per line — something buildable (script, skill, command, API fix, doc change) `[id:WNN-001][status:open]`
- Another idea `[id:WNN-002][status:open]`

---

## Format rules

- `**Pain**` / `**Why**` / `**Fix**` can be one word, one sentence, or a paragraph — whatever the complexity demands
- `**Why**` and `**Fix**` can be blank or `TBD` — don't force a root cause you don't have yet
- `#### → Ideas` is the ONLY place tags go — keeps triage clean, haiku only needs to scan these sections
- One idea per bullet = one tag. Don't tag continuation lines or narrative prose
- If a Fix is itself buildable, copy it to `→ Ideas` too
- One-liner notes (from `devlog.sh "note"`) go under a `#### → Ideas` or `#### → Quick notes` section

## Tagging convention

- `[id:WNN-001][status:open]` — unactioned
- `[id:WNN-001][status:shipped:abc1234]` — commit hash that addressed it
- `[id:WNN-001][status:killed]` — explicitly decided not to do

IDs are week-scoped and sequential. `scripts/devlog.sh "note"` auto-assigns IDs.
Reference in commits: `Addresses W13-001` in the commit body.
