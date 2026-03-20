# Autoresearch: Doc Health — Autopoietic Documentation Integrity

## Objective

Maximise the doc-health score (0–8) by improving the autopoietic documentation system:
gen scripts with `@watches`/`@output`/`@run` headers, generated outputs with `AUTO-GENERATED`
back-link headers, CAPS files with `<progressive-disclosure>` forward-links, and `doc-sync.sh`
closing the loop.

The system should be self-describing, self-registering, and self-validating. Each improvement
must close a loop, tighten a link, or remove drift — not add noise.

## Metrics

- **Primary**: `doc_health` (integer 0–8, higher is better) — binary pass/fail on 8 axes
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

_Nothing yet — this is the first run._
