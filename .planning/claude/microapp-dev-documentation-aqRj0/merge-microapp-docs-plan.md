# Plan — Three-way merge into SDK-FOR-MICROAPP-DEV.md

> Supersedes the earlier two-doc merge plan.
> Sources: MICROAPP-DEV.md (1931w) + MICROAPP-DEV-GUIDE.md (1635w) + SDK.md (780w)
> Output: one comprehensive doc + SDK.md as slim CAPS stub

---

## The key insight

SDK.md is a CAPS file (doc-health watches it, word budget enforced, back-links exist).
Deleting it breaks the autopoietic loop. Instead:

- **SDK.md** → stripped to ~200w CAPS stub: stability contract + pointer to new doc
- **MICROAPP-DEV.md** → deleted
- **MICROAPP-DEV-GUIDE.md** → deleted (replaced by the new doc)
- **SDK-FOR-MICROAPP-DEV.md** → the single comprehensive doc at repo root

SDK.md keeps its CAPS role (stability tiers are genuinely CAPS-worthy — not a tutorial
concern). Its progressive-disclosure block updates to point to SDK-FOR-MICROAPP-DEV.md.

---

## SDK-FOR-MICROAPP-DEV.md — target section order

Reading flow: get running → understand → write code → verify → survive in cloud

```
§01  Quick start              60-second path to a running app
§02  Mental model             What a microapp is, COAT test, lifecycle diagram
§03  The four required hooks  registerMicroappHooks — enforced, typed
§04  Host API                 Full table: createWindow, registerCommand, theme, flash…
§05  Building UI              CompositionHelpers (preferred) + LayoutParts (advanced)
§06  Timers & animation       createTimer + createAnimationClock + CPU cliff
§07  Persistence              registerSnapshot vs safeWriteFile vs never raw fs.*
§08  Verification             typecheck + validate-microapp.sh + manual debug fallback
§09  microapp.json            Full schema with dev block, field table
§10  Worked examples          10-app reference table
§11  Footguns                 Top 7 (guide's 5 + pkill + batch-loop from ops doc)
§12  Import rule              One path, what never to import
§13  Cloud / headless ops     LAST — env signals, bun install, --tmux, curl, API ref,
                              COAT.md discovery, gen-* scripts, file ref, triad
```

---

## Section-by-section: source + cut decisions

### §01 Quick start
**Source:** Guide's scaffold-first flow (cleanest narrative).
**Add:** `bun install --ignore-scripts` as step 0 (from ops doc — unique).
**Add:** `bun run typecheck` after scaffold (ops doc had this, guide didn't).
**Cut:** Ops doc's duplicate quick-start block.

### §02 Mental model
**Source:** Guide — keep exactly as-is.
**Add:** SDK.md's lifecycle diagram (unique, visual, valuable).
**Add:** SDK.md's dev loop (`reload-microapp.sh`, `wibwob read <id>`) — fits here as "the loop once built".
**Cut:** SDK.md's "minimal working microapp" bare example — guide's `registerMicroappHooks` version is better and covers it.

### §03 The four required hooks
**Source:** Guide's `registerMicroappHooks` full code + hook table.
**Cut:** Ops doc's bare stub version (`win.describeState(...)`) — fully subsumed.
**Cut:** SDK.md's hooks section — guide's version is more complete.

### §04 Host API
**Source:** Guide's full table — keep exactly.
**Cut:** SDK.md's host table — identical, guide's is slightly better formatted.

### §05 Building UI
**Source:** Guide's CompositionHelper code + composition patterns list + LayoutPart + createStack.
**Add:** "When in doubt: CompositionHelpers. They're `@public` and stable." (one-liner from ops).
**Cut:** Ops doc's prose description of both models — guide's code version is better.
**Cut:** SDK.md's condensed component models paragraph — guide has the full version.

### §06 Timers & animation
**Source:** Guide's `createTimer` + `createAnimationClock` code blocks.
**Add:** Ops doc's CPU cliff detail block (more precise: 87% CPU, ANSI in cells).
**Merge:** Guide's inline `> CPU cliff warning` + ops "Performance gotchas" → one tight block.

### §07 Persistence
**Source:** Guide's code (cleaner, has type cast).
**Cut:** Ops doc's persistence section — decision table identical, code ≈ same.
**Cut:** SDK.md's persistence one-liner — subsumed.

### §08 Verification
**Source:** Guide's `validate-microapp.sh` + `captureText` fallback code.
**Add:** Ops doc's manual curl pattern as `### Manual (debug fallback)` subsection.
**Cut:** Ops doc's "Automated blank-app check" callout — subsumed by guide's version.

### §09 microapp.json
**Source:** Guide's full version — has `dev.watch` + `dev.reopenCommand`, field table.
**Cut:** Ops doc's version — subset of guide's.
**Cut:** SDK.md's version — subset of guide's, missing `dev` block.

### §10 Worked examples
**Source:** Guide — keep exactly.

### §11 Footguns
**Source:** Guide's top-5 list.
**Add from ops (2 missing items):**
  - `pkill -f "curl.*8099"` kills your own command
  - Batch-verify loop overwhelms single-threaded bun — one at a time
**Result:** Top 7 footguns, all distinct, all precise.

### §12 Import rule
**Source:** Guide's version — includes `node:fs` prohibition.
**Cut:** Ops doc's version — subset.
**Cut:** SDK.md's one-line import rule — moves to SDK.md stub (it's the CAPS-level rule).

### §13 Cloud / headless ops (LAST)
Everything unique to ops doc that isn't SDK tutorial content:

| Content | From |
|---------|------|
| Environment signals table (TTY, TERM, uname, `script` syntax) | ops |
| `bun install --ignore-scripts` — why (canvas native failure) | ops |
| Always `--tmux`, never `--direct` — failure mode quote | ops |
| Hard restart / port stuck patterns | ops |
| `curl --max-time 5` — zombie process explanation | ops |
| API endpoint reference table | ops |
| Command ID format + state parsing snippet | ops |
| COAT.md command discovery (`bun scripts/gen-coat.ts`) | ops |
| gen-* scripts headless table | ops |
| File reference table (updated — ww-ops/SKILL.md removed) | ops |
| Microapp triad workflow | ops |

**Cut from ops (don't carry):**
- `--direct` mode explicit DON'T — covered by "Always --tmux" rule above
- Background command footgun DON'T — covered by `curl --max-time` in §13
- CLAUDE.md pointer section — stale, already done
- "What NOT to do" as a section header — inline each rule where it belongs

---

## What SDK.md becomes (slim CAPS stub, ~200w)

```markdown
# SDK.md — Microapp SDK contract

> Full guide: `SDK-FOR-MICROAPP-DEV.md`

## Stability tiers

Every export in `src/services/microapp-sdk.ts` carries a tier:

| Tier | Meaning |
|------|---------|
| `@public` | Stable API — microapps should import only these |
| `@beta` | Functional, may change |
| `@internal` | Host-only — microapps must not import |

Run `bun scripts/gen-sdk-surface.ts` → `src/sdk/README.md` for the full
export directory (77 @public, 44 @beta, 137 @internal).

## One import rule

```typescript
import { ... } from "../../src/services/microapp-sdk.js"
// Never: src/core/*, src/ui/*, src/services/* (except sdk), node:fs
```

<progressive-disclosure>
  <output>`src/sdk/README.md` — full export surface by tier</output>
  <generator>read the source — microapp-host.ts is ground truth</generator>
  <deeper>`SDK-FOR-MICROAPP-DEV.md` — full guide · `PHILOSOPHY.md` — why the boundary exists</deeper>
</progressive-disclosure>
```

~180 words. Well under 800 budget. Passes all doc-health axes.
The `<!-- Parent: SDK.md §... -->` back-link in `src/sdk/README.md` stays valid.

---

## Files affected

| File | Action |
|------|--------|
| `SDK-FOR-MICROAPP-DEV.md` | CREATE — ~2000w comprehensive doc |
| `SDK.md` | REWRITE — slim CAPS stub (~180w) |
| `MICROAPP-DEV.md` | DELETE |
| `MICROAPP-DEV-GUIDE.md` | DELETE |
| `AGENTS.md` | UPDATE table: SDK.md row stays, add SDK-FOR-MICROAPP-DEV.md row, remove MICROAPP-DEV and MICROAPP-DEV-GUIDE rows |
| `.pi/tasks/microapp-run-2.md` | UPDATE — read order: SDK-FOR-MICROAPP-DEV.md only |
| `COAT.md` | REGENERATE — gen-integration-surface.ts after changes |
| `src/sdk/README.md` | CHECK — Parent back-link still valid (SDK.md keeps its name) |

---

## doc-health impact

No changes needed to `scripts/doc-health.sh`. SDK.md stays in the CAPS array.
Word budget: SDK.md drops from 780w → ~180w (still passes — no minimum enforced).
Back-link in `src/sdk/README.md` (`<!-- Parent: SDK.md §Lifecycle -->`) — update to `§Stability tiers` after rewrite.

---

## DRY rules for the merge

| Pattern | Rule |
|---------|------|
| Same content in 2+ docs | Best version wins. Usually guide > ops > SDK for tutorial content. |
| Same example, different completeness | Keep the more complete one. |
| "Don't X" + "Do Y instead" appear separately | Merge into one block in §Footguns or §13. |
| One-liner rule vs full explanation | Full explanation in body; one-liner goes in §Import rule or the CAPS stub. |
| Unique ops-only content | All goes to §13 (cloud/headless ops). No ops content in §01–§12. |

---

## Estimated word count

| Section | Est. words |
|---------|-----------|
| §01–§02 Quick start + Mental model | 200 |
| §03–§04 Hooks + Host API | 300 |
| §05–§06 UI + Timers | 400 |
| §07–§09 Persistence + Verify + microapp.json | 350 |
| §10–§12 Examples + Footguns + Import | 250 |
| §13 Cloud / headless ops | 450 |
| **Total** | **~1950** |

Comparable to the current guide (1635w) but denser — ops content that was 1931w compressed into 450w by cutting the shared bloat.

---

## Checklist

- [ ] Write `SDK-FOR-MICROAPP-DEV.md` (13 sections, ~1950w)
- [ ] Rewrite `SDK.md` as slim CAPS stub (~180w)
- [ ] `git rm MICROAPP-DEV.md`
- [ ] `git rm MICROAPP-DEV-GUIDE.md`
- [ ] Update `AGENTS.md` table
- [ ] Update `src/sdk/README.md` back-link (§Lifecycle → §Stability tiers)
- [ ] Update `.pi/tasks/microapp-run-2.md` read order
- [ ] `bun run typecheck`
- [ ] `bash scripts/doc-health.sh` — must be 15/15
- [ ] Commit
