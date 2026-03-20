# Autoresearch: Doc Health — Autopoietic Documentation Integrity

## Objective

Maximise the doc-health score by improving the autopoietic documentation system.
The system is self-describing, self-registering, and self-validating.

## Metrics

- **Primary**: `doc_health` (integer 0–15, higher is better) — binary pass/fail on 15 axes across 5 categories

## How to Run

`./autoresearch.sh` — outputs `METRIC doc_health=N`

## Files in Scope

| File | Purpose |
|------|---------|
| `scripts/doc-health.sh` | 15-axis integrity checker (the benchmark) |
| `scripts/doc-sync.sh` | Diff-aware regeneration via @watches headers |
| `scripts/gen-integration-surface.ts` | Generates COAT.md |
| `scripts/gen-skills.py` | Generates .pi/skills/skills.md |
| `scripts/gen-sdk-surface.ts` | Generates src/sdk/README.md |
| `scripts/gen-primitives.ts` | Generates src/core/primitives.ts |
| `AGENTS.md` `PHILOSOPHY.md` `ARCHITECTURE.md` `SDK.md` `GOTCHAS.md` | CAPS files |
| `COAT.md` `.pi/skills/skills.md` `src/sdk/README.md` `src/core/primitives.ts` | Generated outputs |

## Off Limits

Source files read by gen scripts (control-api.ts, microapp-sdk.ts, command-catalog.ts), microapps/, individual skill SKILL.md files.

## Constraints

- Generated files NEVER edited directly — fix via generator, regenerate
- CAPS files: delta-compressed, no standard knowledge
- Gen scripts: must have @watches/@output/@run headers
- No fake headers or dummy content to pass checks

## What's Been Tried

- **Baseline (8/8):** Original 8 axes — staleness, headers, back-links, forward-links, PD integrity, watches precision, circularity, orphans
- **9+10 (→10):** Parent section validation + @watches import match. Found SDK.md stale §ref.
- **11+12 (→12):** CAPS word-count cap + cross-ref validation
- **13+14 (→14):** Gen discoverability + PD focus (max 3 tags/file). GOTCHAS split rule.
- **Bug fix:** Missing-output-skip — axes silently skipped missing files instead of failing. Deleting COAT.md now drops 14→9.
- **15 (→15):** Content freshness — md5 before/after regen catches drift
- **Rewrite:** 5 categories, helper fn, clearer names, fixed counts_match/refs_valid bugs
- **Stress tested:** 4 sabotage scenarios all caught
- **Delta judge:** Subagent scored CAPS files 8-9/10, identified redundancies, acted on them

## Plateau

15/15 structural. Adding axes that pass is score inflation. Real value is regression catching as codebase evolves. Next tier (semantic/functional) requires subagent inference — see `.planning/autoresearch-doc-health/doc-review-spec.md`.

## Dead Ends

- Python Path() @watches derivation — too complex for grep
- `set -e` in measurement scripts — causes silent crashes
- `grep -c` multiline output — always pipe through `tail -1 | tr -d "\n"` or use `|| echo 0`
- Exact endpoint count matching — gen script regex is a subset of source patterns
