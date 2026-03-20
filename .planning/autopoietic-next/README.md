# Autopoietic Next Steps — Plan

> From session 2026-03-20. Chosen via quizme by Zilla.

## Context

The autopoietic documentation system is built and working:
- 6 CAPS files at root (hand-written, delta-compressed)
- 4 gen scripts with `@watches`/`@output`/`@run` self-registration
- `doc-sync.sh` (diff-aware regen) + `doc-health.sh` (15-axis gate, 2.8s)
- Pre-commit hook blocking broken loops
- Tier 1 (structural) is 15/15. Tiers 2+3 need subagent inference.

## Workstreams (priority order)

### 0. Real-world smoke test — prove the system works on actual code changes
**The honest gap:** We built and tested doc-health in isolation. We haven't made a real code change and watched the autopoietic loop catch it, regenerate, and stay honest.

Test scenarios:
- [x] Add a new API endpoint to `control-api.ts` → doc-sync detected it → gen-integration-surface.ts regenerated COAT.md → new endpoints appeared → doc-health 15/15. **PASSED** (Chrome browser enhancement, 2026-03-20)
- [x] Delete a skill → doc-sync detected `.pi/skills/` change → skills.md flagged stale. **PASSED** (after fixing glob expansion bug in doc-sync.sh — `for watch in $watches` was shell-expanding globs before regex conversion)
- [ ] Add a new microapp skill → does `gen-skills.py` pick it up? → does `skills.md` update?
- [ ] Add a new `@public` export to `microapp-sdk.ts` → does `gen-sdk-surface.ts` pick it up?

Two of four proven on real code. Remaining two are lower risk (same mechanism, different watched paths).

### 1. doc-review.sh — semantic + functional tiers
**Spec:** `.planning/autoresearch-doc-health/doc-review-spec.md`

- **Tier 2 (semantic):** subagent delta-judges each CAPS file via haiku, scores 0-10, lists redundancies. ~30s.
- **Tier 3 (functional):** subagent given ONLY CAPS files tries to build a microapp. Reports: success/fail, blockers, unclear bits. ~60s.
- Unified output: structural score + semantic avg + functional pass/fail.

### 2. MicroappHost gen — real JSDoc extraction
Repurpose `gen-sdk-surface.ts` to extract actual method signatures, param types, and JSDoc descriptions from `src/sdk/microapp-host.ts`. Output to `src/sdk/README.md`. This passes the 5 Whys test — bare export names don't help devs, real docs do.

### 3. Analytics JSONL
Upgrade `usage-pulse.ts`: append to `~/.pi/analytics/skill-usage.jsonl` alongside the current snapshot. Add `surface`, `session`, `repo` fields. Enables `pi-usage-audit` to answer trend questions (trending up/down? weekly frequency?) not just "is this stale?".

### 4. Blog post / pattern description
Write up autopoietic homoiconicity as a transferable pattern:
- What it is (system whose docs are its infrastructure)
- The compressed delta principle (state only divergences from LLM priors)
- The gen script contract (`@watches`/`@output`/`@run`)
- The bidirectional linking (outputs ↔ generators ↔ CAPS files)
- `doc-health.sh` as the self-measurement instrument
- Minimum viable seed for a new repo

Could live as a blog post, a standalone pi skill, or a section in the repo README.

### 5. add-command.sh scaffold script
Adding a command touches 4+ files (documented in GOTCHAS.md). A scaffold script would
reduce this to one invocation. **Placement decision deferred** — run the microapp triad
(product-owner → developer → doc-refiner) to decide whether it belongs under
microapp-creator, a new wibwob-scaffold skill, or repo root scripts/.

## Not now

- CI/GitHub Actions — pre-commit hook is enough for single-dev
- gen-gotchas.ts — GOTCHAS.md is too small and manual to justify automation
- Pre-commit hook auto-install — low priority convenience
