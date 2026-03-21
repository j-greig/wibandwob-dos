# Merge Plan — main → claude/microapp-dev-documentation-aqRj0

> Branch has 24 commits ahead of main. Main has 40+ commits (doc-health, CAPS system,
> autopoietic infrastructure, quizme, browser enhancements, SDK.md, GOTCHAS.md).
> Goal: bring main's work in without losing our fixes.

---

## Conflict inventory (8 items)

### 1. `.pi/skills/ww-ops/SKILL.md` — DELETED on main, modified on branch
**What we did:** added `--max-time 5` to all curl examples.
**What main did:** deleted the file entirely.
**Resolution:** Accept main's deletion. Our `--max-time` guidance now lives in
`MICROAPP-DEV.md` (better location). The skill was removed upstream deliberately.
- [x] After merge: confirm `MICROAPP-DEV.md` has `--max-time` docs ✓ (already there)

### 2. `scripts/start-alt-instance.sh` — DELETED on main, modified on branch
**What we did:** added uname guard for cross-platform `script(1)` syntax.
**What main did:** deleted the file.
**Resolution:** Accept main's deletion. Check if functionality was absorbed elsewhere.
If start-alt-instance is genuinely gone, our cross-platform fix lives in
`process-manager.sh` (the core library) which IS kept.
- [x] After merge: verify `scripts/ensure-running.sh` and `scripts/restart.sh` cover all use cases

### 3. `AGENTS.md` — content conflict
**What we did:** Changed "Four CAPS MD files" → "Six CAPS MD files", added MICROAPP-DEV.md + PATCHNOTES.md as list items.
**What main did:** Complete redesign — table format, 5 entries, autopoietic homoiconicity note, XML progressive-disclosure format. Entries: AGENTS, PHILOSOPHY, ARCHITECTURE, SDK.md, GOTCHAS.md.
**Resolution:** Take main's table format as base. Add MICROAPP-DEV.md and PATCHNOTES.md as two new rows. Do NOT revert main's structural changes.
```markdown
| `MICROAPP-DEV.md` | Agent dev workflow: install, start, scaffold, verify, gotchas |
| `PATCHNOTES.md`   | Script patches for cross-platform (cloud + local) compatibility |
```
- [x] After merge: add these two rows to the CAPS table in AGENTS.md

### 4. `COAT.md` — add/add conflict
**What we did:** Generated via `bun scripts/gen-coat.ts` (old generator).
**What main did:** Generated via `bun scripts/gen-integration-surface.ts` (new generator, different format, with `@watches/@output/@run` metadata).
**Resolution:** After merge, discard both conflicted versions, regenerate with main's script:
```bash
bun scripts/gen-integration-surface.ts
```
- [x] After merge: regenerate COAT.md with correct script

### 5. `microapps/dice-roller/` — add/add conflict
**What we did (CCC run 1):** Basic dice roller with createCanvas, createHeaderBar, createStatusBar.
**What main did:** Better version — cleaner 7×5 ASCII dice art, more compact.
**Resolution:** Take main's version (it's superior). Our dice-roller was CCC-generated; main's is human-refined.
- [x] After merge: run `validate-microapp.sh microapp.wibwob.dice-roller.open` to confirm main's version passes

### 6. `.pi/reflections/2026-W12.md` — content conflict
**What we did:** Added cloud agent devlog sections (10 entries on CCC run, detailed mapp notes).
**What main did:** Added doc-health + chrome browser enhancement entries.
**Resolution:** Keep all entries from both branches. Chronological order.
- [x] After merge: verify both sets of entries are present

### 7. `.pi/metrics/usage-last-seen.json` — content conflict
**What we did:** updated timestamps via normal usage.
**What main did:** same.
**Resolution:** Take main's version (most recent from main's last commit is fine).
- [x] After merge: accept theirs, no action needed

### 8. `microapps/dice-roller/microapp.json` — add/add conflict
Same as #5 — take main's version.

---

## Non-conflicting things to verify after merge

These didn't conflict but need a post-merge check:

- [x] `src/services/microapp-sdk.ts` — our safe-fs exports + registerMicroappHooks must survive (git auto-merged)
- [x] `src/sdk/runtime-helpers.ts` — our fps guard + registerMicroappHooks implementation must survive
- [x] `scripts/lib/process-manager.sh` — our A1+A2 patches must survive (git auto-merged)
- [x] `src/core/microapp-registry.ts` — our 10 new apps + any main additions must both be present
- [x] `bun run typecheck` — must pass after merge
- [x] `bash scripts/checks/check-cross-platform.sh` — must pass
- [x] `bash scripts/validate-microapp.sh microapp.wibwob.dice-roller.open` — main's version must pass

---

## Things main adds that we get for free (no conflicts)

- `SDK.md` — new CAPS doc: microapp SDK contract, hooks, host API, lifecycle
- `GOTCHAS.md` — new CAPS doc: non-obvious failure modes
- `scripts/doc-health.sh` — 15-axis doc integrity gate
- `scripts/doc-sync.sh` — diff-aware doc regeneration
- `scripts/hooks/pre-commit` — pre-commit hook running doc-health
- `scripts/install-hooks.sh` — install the hook
- `scripts/delta-judge.sh` — subagent delta judge
- `.pi/extensions/quizme.ts` — quizme extension
- `.pi/skills/command-scaffold/` — new skill
- `.pi/skills/doc-agent/` — new skill
- `autoresearch*.sh` — autoresearch infrastructure
- Various skill updates, planning docs

---

## Execution steps

```
[ ] 1. git merge main (expect 8 conflicts)
[ ] 2. Resolve #1: git rm .pi/skills/ww-ops/SKILL.md
[ ] 3. Resolve #2: git rm scripts/start-alt-instance.sh
[ ] 4. Resolve #3: AGENTS.md — take main's version, add 2 rows for MICROAPP-DEV + PATCHNOTES
[ ] 5. Resolve #4: COAT.md — git checkout --ours (or theirs), then regenerate
[ ] 6. Resolve #5+#8: dice-roller — git checkout main -- microapps/dice-roller/
[ ] 7. Resolve #6: 2026-W12.md — manual merge, keep all entries
[ ] 8. Resolve #7: usage-last-seen.json — git checkout main -- .pi/metrics/usage-last-seen.json
[ ] 9. bun run typecheck
[ ] 10. bash scripts/checks/check-cross-platform.sh
[ ] 11. bun scripts/gen-integration-surface.ts  (regenerate COAT.md)
[ ] 12. Verify 10 microapps in registry
[ ] 13. validate-microapp.sh spot check: dice-roller + sys-monitor
[ ] 14. git add -A && git commit (merge commit)
[ ] 15. Update this plan doc — tick all items
```

---

## Risk: start-alt-instance deletion

Our uname guard for `start-alt-instance.sh` fixed a real Linux bug. If main
deleted the script, the cross-platform fix is moot for that file. But:
- `process-manager.sh` still has our A1+A2 patches (the core library)
- `ensure-running.sh` and `restart.sh` both source `process-manager.sh`
- The headless auto-detect (A1) lives in `process-manager.sh` — preserved
- The Linux `script(1)` guard (A2) lives in `process-manager.sh` — preserved

The only loss is if any caller relied on `start-alt-instance.sh --direct` on Linux.
Given main deleted it, that path is gone anyway.
