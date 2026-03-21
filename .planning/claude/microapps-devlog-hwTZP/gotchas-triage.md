# GOTCHAS.md Triage — 1710w → ≤800w

> Current: 35 entries, 1710 words. Budget: 800 words.
> Must cut ~900 words. Strategy: promote, absorb, or delete.

---

## Decision framework

| Action | When |
|--------|------|
| **KEEP** | Actively burns agents, not coverable by code/JSDoc, not standard knowledge |
| **PROMOTE → SDK-MICROAPP-DEV.md** | Tutorial content disguised as a gotcha — belongs in the guide |
| **ABSORB → code** | Can be fixed with JSDoc, runtime warning, or SDK change — then delete the entry |
| **DELETE** | Standard knowledge an LLM already has, or absorbed by existing code/docs |

---

## Entry-by-entry triage

### Documentation section (4 entries, ~80w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| Never edit generated files | ~15 | **KEEP** | Not obvious — `<!-- AUTO-GENERATED -->` header convention is repo-specific |
| Never list watched mappings outside gen scripts | ~20 | **DELETE** | Implementation detail of the gen system. Agents don't create gen scripts. |
| Never restate standard patterns (delta principle) | ~25 | **KEEP** | Core philosophy — meta-gotcha that governs the file itself |
| Never two doc changes in one autoresearch run | ~15 | **DELETE** | Autoresearch-specific. Only relevant during doc-health optimization loops. Niche. |

### Microapps section (11 entries, ~350w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| Never import from src/core/ | ~25 | **ABSORB → done** | Already in JSDoc on microapp-sdk.ts header + composition-helpers.ts. Already in SDK-MICROAPP-DEV.md §Import rule. Delete from GOTCHAS. |
| Never change microapp id | ~25 | **KEEP** | Silent breakage, not coverable by code |
| Never mix CompositionHelpers + LayoutParts | ~50 | **ABSORB → done** | Already in JSDoc on composition-helpers.ts ("Do NOT pass these handles to createStack"), in SDK-MICROAPP-DEV.md §Building UI, AND TypeScript catches it. Triple-covered. Delete from GOTCHAS. |
| captureText must return non-empty | ~35 | **PROMOTE → guide** | Tutorial content. SDK-MICROAPP-DEV.md §Verification already covers this with the fallback pattern. Delete from GOTCHAS. |
| createAnimationClock starts immediately | ~40 | **ABSORB → done** | JSDoc on runtime-helpers.ts already warns. SDK-MICROAPP-DEV.md §Timers covers it. Delete. |
| Never use raw fs.* | ~25 | **ABSORB → done** | JSDoc on safe-fs.ts. SDK-MICROAPP-DEV.md §Persistence. §Import rule. Delete. |
| registerSnapshot is the right primitive | ~25 | **PROMOTE → guide** | Tutorial guidance, not a gotcha. Already in SDK-MICROAPP-DEV.md §Persistence. Delete. |
| Scaffolded apps don't appear until registered | ~30 | **KEEP** | Silent failure, not coverable by code without auto-registration |
| reload-microapp.sh doesn't cover host changes | ~20 | **KEEP** | Silent mixed-state failure |
| createInputLine modal focus | ~15 | **KEEP** (merge with blessed.textarea below) | Platform constraint worth knowing |
| host.ui.* mixes both models | — | **Not present** | Was in our GOTCHAS but CCC's additions overwrote. Already in JSDoc + guide. Not needed. |

### Adding a command (1 entry, ~60w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| 4+ files to add a command | ~60 | **KEEP** | COAT architecture tax, genuinely non-obvious, planned scaffold |

### Bash scripting (1 entry, ~25w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| grep -c multiline | ~25 | **KEEP** | Bitten 3 times, bash-specific, not standard knowledge |

### Cloud / Linux agents (3 entries, ~60w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| bun install fails in cloud | ~20 | **PROMOTE → guide** | Already in SDK-MICROAPP-DEV.md §Quick start AND §Cloud ops. Delete. |
| --direct fails on Linux | ~25 | **PROMOTE → guide** | Already in SDK-MICROAPP-DEV.md §Cloud ops. Scripts auto-detect now. Delete. |
| curl without --max-time | ~20 | **PROMOTE → guide** | Already in SDK-MICROAPP-DEV.md §Cloud ops. All examples use --max-time. Delete. |

### Ops (1 entry, ~20w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| Never kill -9 first | ~20 | **KEEP** | blessed-specific, not standard |

### Gen scripts (1 entry, ~25w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| Gen scripts don't auto-run | ~25 | **DELETE** | Feature request, not a gotcha. Belongs in planning. |

### CAPS files (1 entry, ~15w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| >3 PD tags = split | ~15 | **KEEP** | Repo-specific convention |

### Agent behaviour (2 entries, ~25w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| Never expand terse descriptions | ~15 | **KEEP** | Meta-gotcha, delta principle enforcement |
| Never trust API alone | ~15 | **KEEP** | Repo-specific — most APIs ARE trustworthy. Here they're not. |

### CCC run-2 additions — HIGH (6 entries, ~270w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| Bun TDZ crashes | ~40 | **KEEP** | Bun-specific, silent, no compile error. Critical. |
| List style crash on theme switch | ~50 | **KEEP** | blessed-specific runtime crash, non-obvious fix |
| desktop.clear-all race | ~30 | **KEEP** | Silent no-op, timing-dependent |
| Figlet .kind is "microapp" | ~35 | **KEEP** | Every choreography script hits this |
| Workspace restore boot loop | ~30 | **KEEP** | Recovery procedure needed |
| 1×1 screen in background | ~30 | **KEEP** | Silent, no error, captures nothing |

### CCC run-2 additions — MEDIUM (7 entries, ~250w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| blessed.list as any cast | ~35 | **KEEP** (trim) | Recurring pattern, agents need to know the cast is correct |
| setItems fires select event → recursion | ~35 | **KEEP** | Non-obvious infinite loop |
| registerSnapshot restore = re-run open | ~35 | **PROMOTE → guide** | Tutorial clarification. Already in SDK-MICROAPP-DEV.md §Persistence. Delete. |
| blessed.textarea fully modal | ~30 | **MERGE** with existing createInputLine entry | Duplicate content |
| multiInstance: true for re-openable | ~30 | **PROMOTE → guide** | Tutorial content. Add to SDK-MICROAPP-DEV.md §microapp.json. Delete. |
| setImmediate after textarea keypress | ~25 | **KEEP** | blessed-specific timing, non-obvious |
| Worktree alt-instance port | ~30 | **KEEP** (trim) | Silent wrong-instance targeting |

### CCC run-2 additions — LOW (5 entries, ~120w)

| Entry | Words | Verdict | Reason |
|-------|-------|---------|--------|
| safeReadJSON returns undefined | ~20 | **DELETE** | Standard TypeScript pattern. `T | undefined` is expected. Fails delta test. |
| host.promptValue focus not restored | ~20 | **DELETE** | Platform constraint already noted. Low signal. |
| Emoji as ? in text screenshot | ~25 | **DELETE** | Not a real bug, stated in the entry itself. |
| canvas.element is key-binding surface | ~25 | **PROMOTE → guide** | Tutorial content. Add to SDK-MICROAPP-DEV.md §Building UI. Delete. |
| createTextViewer % strings TypeScript | ~25 | **DELETE** | TypeScript type widening fix belongs in code, not gotchas |

---

## Summary

| Action | Count | Words saved |
|--------|-------|-------------|
| KEEP (some trimmed) | 18 | — |
| KEEP + MERGE | 1 | ~15w |
| PROMOTE → SDK-MICROAPP-DEV.md | 5 | ~145w |
| ABSORB → already in code/JSDoc | 5 | ~175w |
| DELETE | 8 | ~195w |

**Estimated result: ~18 entries, ~700–750 words ≤ 800 budget ✓**

---

## Items to promote to SDK-MICROAPP-DEV.md before deleting from GOTCHAS

1. `multiInstance: true` for re-openable apps → §microapp.json (add to field table)
2. `registerSnapshot` restore = re-run open → §Persistence (clarify the pattern)
3. `canvas.element` is the key-binding surface → §Building UI (add note)

These are already partially covered but need one-line additions to be fully absorbed.

---

## Checklist

- [ ] Delete 8 entries from GOTCHAS.md
- [ ] Merge blessed.textarea + createInputLine into one entry
- [ ] Trim verbose entries (list cast, worktree port)
- [ ] Add 3 one-liners to SDK-MICROAPP-DEV.md (multiInstance, snapshot restore, key bindings)
- [ ] Verify word count ≤ 800
- [ ] `bash scripts/doc-health.sh` → 15/15
- [ ] Commit
