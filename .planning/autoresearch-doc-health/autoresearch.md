# Autoresearch: Doc Health — Autopoietic Documentation Integrity

> Archived final state from `autoresearch/doc-health-2026-03-20` branch.
> 15 experiments, 15/15 structural, plateau reached. Next: tier 2+3 via subagent (see `doc-review-spec.md`).

## Objective

Maximise the doc-health score (0–8) by improving the autopoietic documentation system:
gen scripts with `@watches`/`@output`/`@run` headers, generated outputs with `AUTO-GENERATED`
back-link headers, CAPS files with `<progressive-disclosure>` forward-links, and `doc-sync.sh`
closing the loop.

The system should be self-describing, self-registering, and self-validating. Each improvement
must close a loop, tighten a link, or remove drift — not add noise.

## Metrics

- **Primary**: `doc_health` (integer 0–14, higher is better) — binary pass/fail on 14 axes
- **Secondary**: none yet

## How to Run

`./autoresearch.sh` — outputs `METRIC doc_health=N`

## Files in Scope

| File | Purpose |
|------|---------|
| `scripts/doc-health.sh` | The benchmark — 8-axis integrity checker |
| `scripts/doc-sync.sh` | Diff-aware regeneration via @watches headers |
| `scripts/gen-integration-surface.ts` | Generates COAT.md from control-api + command-catalog |
| `scripts/gen-skills.py` | Generates .pi/skills/skills.md from skill directories |
| `scripts/gen-sdk-surface.ts` | Generates src/sdk/README.md from microapp-sdk.ts |
| `scripts/gen-primitives.ts` | Generates src/core/primitives.ts barrel |
| `AGENTS.md` | CAPS file — conventions, gen script contract |
| `PHILOSOPHY.md` | CAPS file — autopoietic homoiconicity principle |
| `ARCHITECTURE.md` | CAPS file — COAT, subsystems |
| `SDK.md` | CAPS file — microapp SDK reference |
| `GOTCHAS.md` | CAPS file — non-obvious failure modes |
| `COAT.md` | Generated output — integration surface snapshot |
| `.pi/skills/skills.md` | Generated output — skill index |
| `src/sdk/README.md` | Generated output — SDK export surface |
| `src/core/primitives.ts` | Generated output — core exports barrel |

## Off Limits

- `src/services/control-api.ts` — source of truth, read-only
- `src/services/microapp-sdk.ts` — source of truth, read-only
- `src/core/command-catalog.ts` — source of truth, read-only
- `microapps/` — microapp code, out of scope
- `.pi/skills/*/SKILL.md` — individual skills, out of scope

## Constraints

- Generated files MUST NOT be edited directly — fix via generator script, then regenerate
- CAPS files are hand-written delta-compressed prose — no standard knowledge restated
- All gen scripts must have @watches/@output/@run comment headers
- Checks must pass (`autoresearch.checks.sh`)
- Do not add fake headers or dummy content to pass checks — that's cheating

## What's Been Tried

- **Baseline (8/8):** Original 8 axes all green — staleness, headers, back-links, forward-links, PD integrity, watches precision, circularity, orphans
- **Axes 9+10 (8→9→10):** Added parent section validation + @watches import match. SDK.md had stale §Microapp lifecycle ref → fixed to §Lifecycle. TS import matching works; Python Path() syntax skipped (vacuous pass)
- **Axes 11+12 (10→12):** CAPS word-count cap (800w) + cross-ref validation. Both passed immediately
- **Key insight:** Adding axes that all pass is diminishing returns. Real value is regression catching — the score should occasionally DROP when source changes break a loop

- **Axes 13+14 (12→14):** Gen discoverability (AGENTS.md mentions `gen-*` pattern + all @outputs exist) + PD focus (max 3 tags per CAPS file). GOTCHAS.md split rule added.
- **Missing-output-skip bug fix:** Axes 3/4/6/7/9 silently skipped when @output file was missing instead of failing. Now deleting a generated file drops score 14→9 (5 axes catch it).
- **Stress tested:** Deliberately broke 4 things — deleted output, removed header, added headerless gen script, bloated CAPS file. All caught correctly.
- **Key insight at 14/14:** Adding new axes that pass is diminishing returns. Tightening existing axes to catch subtler failures is more valuable.

## Dead Ends

- @watches derivation from Python Path() calls — too complex to parse reliably via grep, vacuous pass
- Scoring exit codes in bash — fragile with set -e; switched to subshell eval + set +e
- Adding axes that all pass immediately — score inflation, not system improvement
