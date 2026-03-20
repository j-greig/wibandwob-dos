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

## Not now

- CI/GitHub Actions — pre-commit hook is enough for single-dev
- gen-gotchas.ts — GOTCHAS.md is too small and manual to justify automation
- Pre-commit hook auto-install — low priority convenience
