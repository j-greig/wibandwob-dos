# Plan — Four-way merge into SDK-FOR-MICROAPP-DEV.md

> Making microapps with the SDK is a singular task → singular guide.
> Sources: MICROAPP-DEV.md + MICROAPP-DEV-GUIDE.md + SDK.md + PATCHNOTES.md
> All four retire. GOTCHAS.md stays (different concern — intake buffer for burns).

---

## What gets deleted

| File | Why it's safe to delete |
|------|------------------------|
| `MICROAPP-DEV.md` | Cloud ops content → §13 of guide |
| `MICROAPP-DEV-GUIDE.md` | Replaced by `SDK-FOR-MICROAPP-DEV.md` |
| `SDK.md` | Stability tiers → §02 of guide. PD back-link → updated in src/sdk/README.md |
| `PATCHNOTES.md` | Patches already applied to code. User-facing rules (--tmux, --ignore-scripts, --max-time) → §13 of guide. Five-whys analysis is forensic history — served its purpose |

## What stays

| File | Role |
|------|------|
| `AGENTS.md` | Session entry point, doc index, conventions |
| `PHILOSOPHY.md` | Design filters, SDK boundary rationale |
| `ARCHITECTURE.md` | COAT, subsystems, invariants |
| `GOTCHAS.md` | Burns intake buffer — scanned on session load |
| `SDK-FOR-MICROAPP-DEV.md` | **The one guide** — build, verify, ship, survive |

---

## SDK-FOR-MICROAPP-DEV.md — section order

```
§01  Quick start              bun install --ignore-scripts → scaffold → run → verify
§02  Mental model             What a microapp is, COAT test, lifecycle, stability tiers
§03  Four required hooks      registerMicroappHooks — typed, enforced
§04  Host API                 Full table
§05  Building UI              CompositionHelpers (preferred) + LayoutParts (advanced)
§06  Timers & animation       createTimer + createAnimationClock + CPU cliff
§07  Persistence              registerSnapshot vs safeWriteFile vs never raw fs.*
§08  Verification             typecheck + validate-microapp.sh + manual debug
§09  microapp.json            Full schema with dev block
§10  Worked examples          10-app reference table
§11  Footguns                 Top 7 — defers to GOTCHAS.md for full list
§12  Import rule              One path only
§13  Cloud / headless ops     Env signals, --tmux, --max-time, API ref, COAT.md, gen-*, file ref
```

### What changes vs previous plan

- §02 now includes stability tiers (@public/@beta/@internal) — was in SDK.md
- §13 absorbs the user-facing PATCHNOTES.md rules (--tmux auto-detect, --ignore-scripts, curl --max-time)
- No SDK.md stub — it's gone entirely
- No PATCHNOTES.md — its patches are in the codebase, its rules are in §13

---

## doc-health impact

`scripts/doc-health.sh` has a CAPS array:
```bash
CAPS=(AGENTS.md PHILOSOPHY.md ARCHITECTURE.md SDK.md GOTCHAS.md)
```

**Change to:**
```bash
CAPS=(AGENTS.md PHILOSOPHY.md ARCHITECTURE.md GOTCHAS.md)
```

SDK.md is removed from the array. `SDK-FOR-MICROAPP-DEV.md` is NOT a CAPS file —
it's a guide with no word budget. CAPS files are for policies; the guide is for procedures.

The `src/sdk/README.md` back-link (`<!-- Parent: SDK.md §Lifecycle -->`) updates to:
```
<!-- Parent: ARCHITECTURE.md §The microapp contract -->
```

This is correct — ARCHITECTURE.md owns the microapp contract, the generated export
surface points back to it. The guide is a tutorial, not a parent for generated output.

---

## AGENTS.md table after merge

```markdown
| `AGENTS.md` | Conventions, workflow, posture (this file) |
| `PHILOSOPHY.md` | Why this exists, design filters, SDK boundary |
| `ARCHITECTURE.md` | COAT, subsystems, invariants |
| `GOTCHAS.md` | Non-obvious failure modes — add when something burns you |
| `SDK-FOR-MICROAPP-DEV.md` | Building microapps: quick-start → host API → UI → persistence → cloud ops |
```

Five rows. Clean.

---

## Checklist

- [ ] Write `SDK-FOR-MICROAPP-DEV.md` (13 sections)
- [ ] `git rm MICROAPP-DEV.md`
- [ ] `git rm MICROAPP-DEV-GUIDE.md`
- [ ] `git rm SDK.md`
- [ ] `git rm PATCHNOTES.md`
- [ ] Update `AGENTS.md` table — 5 rows
- [ ] Update `scripts/doc-health.sh` — remove SDK.md from CAPS array
- [ ] Update `src/sdk/README.md` — back-link → ARCHITECTURE.md §The microapp contract
- [ ] Update `.pi/tasks/microapp-run-2.md` — read SDK-FOR-MICROAPP-DEV.md + GOTCHAS.md
- [ ] `bun run typecheck`
- [ ] `bash scripts/doc-health.sh` — must pass (new CAPS array)
- [ ] Commit
