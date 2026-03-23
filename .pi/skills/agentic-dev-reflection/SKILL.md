---
name: agentic-dev-reflection
description: Reflect on implementation friction after sessions. Write for yourself and future agents. Focus on pain → why → fix. Skip git-log style entries.
---

## When to use

- Stuck figuring something out (solved or abandoned)
- Finished a project/feature
- Discovered a root cause worth remembering

## Workflow

```bash
./scripts/week-num.sh          # which week? (e.g. 2026-W12)
./scripts/new-week.sh --check  # need a new file?
./scripts/new-week.sh          # create if needed
# Edit: .agents/reflections/YYYY-WXX.md
```

## Entry format

```markdown
## YYYY-MM-DD — Session name

### Friction name — one line summary

**Pain:** What went wrong. Specific. One sentence preferred.

**Why:** Root cause. Scale the whys to the problem — 1 for obvious causes, 5+ for knotty ones where each layer reveals a deeper cause. Ask 'but why did that happen?' until you hit bedrock. Unknown? Write "unknown — symptoms: X". Blank is fine.

**Fix:** What was done or what would prevent recurrence. Blank / "TBD" / "to be explored" all valid — especially for unknowns or mid-session discoveries.

#### → Ideas
- One atomic actionable idea per line `[id:WNN-001][status:open]`
- Another `[id:WNN-002][status:open]`
```

Example:

```markdown
## 2026-03-18 — Adding theattyr microapp

### `wibwob cmd microapp.wibwob.theattyr.open` returned "unknown command"

**Pain:** Microapp scaffolded, typecheck passed, app started — command not found.

**Why:** `microapp-registry.ts` gates loading. Without an entry, the microapp silently skips. AGENTS.md listed the file path but not what it does or when to touch it.

**Fix:** Added `"wibwob.theattyr": "beta"` to REGISTRY.

#### → Ideas
- Log hint on skip: `[microapp-loader] Skipped unregistered: wibwob.theattyr — add to REGISTRY` `[id:W13-005][status:open]`
- Or: auto-register unknown microapps at beta tier on first load `[id:W13-006][status:open]`
```

## Tips

- `**Why**` and `**Fix**` can be blank, "TBD", or "to be explored" — don't invent a root cause you don't have
- `#### → Ideas` is the ONLY place tags live — haiku and `devlog-triage.sh` scan only these sections
- One idea per bullet, one tag per idea — no tagging continuation lines or narrative prose
- If a Fix is itself buildable, copy it to `→ Ideas`
- One-liners (`devlog.sh "note"`) auto-get IDs — they land under a `#### → Quick notes` section
- When a commit ships an idea: update `[status:open]` → `[status:shipped:abc1234]` and add `Addresses WNN-NNN` to the commit body
