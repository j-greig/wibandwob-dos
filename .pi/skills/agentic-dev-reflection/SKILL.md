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

### What happened

**Pain:** The problem.

**Why:** Root cause (5 whys).

**Fix:** Skill, script, or doc change to prevent recurrence.
```

Example (real entry):

```markdown
## 2026-03-18 — Adding theattyr microapp

### Couldn't launch theattyr via CLI

**Pain:** `wibwob cmd microapp.wibwob.theattyr.open` returned "unknown command" after adding microapp to registry.

**Why:** The microapp-registry.ts needs an entry for new microapps. Without it, commands don't register. But AGENTS.md listed the file path without explaining WHAT it does or WHEN to touch it.

**Fix:** Added theattyr to REGISTRY. Better: AGENTS.md should explain the registry+tier system, or auto-register unknown microapps at beta tier with a log hint.
```

## Tips

- One entry per session
- Fixes must be actionable (skill, script, doc)
- The value is pain → why (5 whys, more if complex) → fix analysis, not chronological log
