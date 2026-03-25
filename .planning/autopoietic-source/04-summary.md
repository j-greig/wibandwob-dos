# Summary — The Autopoietic Source Proposal

## One sentence

Add a typed `MODULE_MANIFEST` constant and a `code-health` scan script so the codebase describes its own architecture through the same COAT channel it uses for everything else.

## What gets built

| Artifact | Location | Purpose |
|----------|----------|---------|
| `MODULE_MANIFEST` | `src/core/module-manifest.ts` | Typed constant defining every `src/` subdirectory's role, boundary rules, description, and stability tier |
| `code-health` script | `scripts/code-health.ts` | Scans source using Bun/TS compiler API. Validates imports against manifest. Reports file/function metrics. |
| COAT endpoint | `GET /code-health` in control-api.ts | Exposes code health as JSON — same channel as `GET /state` |
| CLI command | `wibwob code-health` | Human-readable structural report |

## Why this is the right shape

1. **Extends existing patterns** — `command-catalog.ts` is already a typed constant that describes commands. `describeState()` is already a runtime self-description hook. This adds the source-level equivalent.

2. **No new dependencies** — uses `as const satisfies` for the manifest and Bun-native APIs for the scan. No ts-morph, no ESLint, no decorators.

3. **COAT-compliant by design** — `GET /code-health` means agents get architectural awareness through the same API they use for everything else. The COAT test passes: "Would this work without the TUI, using only the API?" Yes.

4. **Autopoietic loop** — the manifest defines boundaries → the scan enforces them → violations are caught → the codebase maintains itself. The documentation IS the enforcement mechanism.

## What it replaces

- ARCHITECTURE.md prose about module boundaries → replaced by the typed manifest (ARCHITECTURE.md stays as the human narrative; the manifest is the machine-readable truth)
- Manual codebase exploration (4 agents, 5 minutes each, this session) → replaced by `wibwob code-health`
- `bun run check-coat` → extended to include boundary checking

## The three-level self-knowledge model

```
Level 1: RUNTIME (exists)     → describeState()    → GET /state
Level 2: SOURCE  (this)       → MODULE_MANIFEST    → GET /code-health
Level 3: EVOLUTION (future)   → describeChange()   → GET /changes
```

Each level uses the same pattern: a typed constant or function → a service that aggregates → a COAT endpoint that exposes.

## Adversarial verdict

**Won over 5 alternatives** (per-module _meta.ts, compiler plugin, decorators, ts-morph CI, ESLint boundaries) on self-documentation capability, drift resistance, developer friction, implementation cost, and composability with existing patterns.

**Primary risk:** The scan script's AST analysis may be slow on 150 files. Mitigation: cache results, invalidate on file change timestamp.

**Secondary risk:** The manifest could become a bottleneck if it needs to list every file (not just directories). Mitigation: keep it at the directory level; file-level metadata is derived from the scan.

## Research note

A background research agent is investigating prior art (ArchUnit, ts-morph, fitness functions, Nx module boundaries, living documentation). Findings will be appended to `05-research.md` when complete. The ranking and recommendation stand independent of the research — they're grounded in the specific patterns and constraints of this codebase.
