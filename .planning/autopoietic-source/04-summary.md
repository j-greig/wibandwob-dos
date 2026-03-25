# Summary — The Autopoietic Source Proposal

> Revised after architectural critique (06), second adversarial pass, and devil's advocate challenge (08).

## One sentence

Refactor the code first (decompose god objects, establish barrel-file boundaries), THEN add a typed `MODULE_MANIFEST` + minimal check-coat extension (~190 LOC of infrastructure, not ~400) to keep it that way.

## What gets built

| Artifact | Location | Purpose | Effort |
|----------|----------|---------|--------|
| `MODULE_MANIFEST` | `src/core/module-manifest.ts` | Typed constant defining every `src/` subdirectory's role, boundary rules, description. `ModuleId` type constraint makes typos compile errors. | ~40 LOC |
| Boundary check | `scripts/checks/check-coat.ts` (extended) | New check reading MODULE_MANIFEST, validating all src/ imports against boundary rules. Same string-matching pattern as existing microapp check. | ~50-80 LOC |
| `code-health` CLI | `src/cli/commands/code-health.ts` | Standalone CLI command: file/function metrics, boundary status, orphan exports, trajectory. Works without running TUI. | ~150-200 LOC |
| Snapshot persistence | `.code-health/` (gitignored) | Timestamped JSON snapshots. `--diff` compares current to previous. Enables Level 3 trajectory. | ~80-100 LOC |
| COAT endpoint | `GET /code-health` in control-api.ts | Thin adapter calling the same analysis function as the CLI. | ~15 LOC |
| Pre-commit warning | `.githooks/pre-commit` (extended) | Runs `code-health --changed` on modified files. Warns (not blocks) if commit makes things worse. Scoped to changed files for speed. | ~20 LOC |

**Total new code:** ~350-450 LOC across 2 new files + 3 modified files.
**New dependencies:** 0. Uses `check-coat` (exists), `madge` (exists), `readFileSync` + regex (stdlib).

## Why this is the right shape

1. **Extends existing patterns** — `command-catalog.ts` is already a typed constant that describes commands. `describeState()` is already a runtime self-description hook. `check-coat` already enforces microapp boundaries. This adds the source-level equivalent of each.

2. **No new dependencies** — uses `as const satisfies` for the manifest, string-matching for boundary validation (same as check-coat), `readFileSync` + regex for metrics, `madge` (already present) for circular deps. No ts-morph, no ts-arch, no dependency-cruiser, no ESLint.

3. **CLI-first, API adapts** — `wibwob code-health` works in CI, in a cold repo, without starting the TUI. `GET /code-health` is a thin adapter that calls the same function. This is COAT applied correctly.

4. **Self-validating at compile time** — `ModuleId = keyof typeof MODULE_MANIFEST` means `mayImportFrom: ["servics"]` is a type error. The manifest doesn't just describe boundaries, it enforces its own internal consistency.

5. **Trajectory from day one** — Level 3 is not "future." Snapshot persistence + diff is ~80-100 LOC. An agent sees "this file is getting worse" not just "this file is big."

## What it replaces

| Before | After |
|--------|-------|
| ARCHITECTURE.md prose about module boundaries | MODULE_MANIFEST typed constant (ARCHITECTURE.md points to it) |
| Manual codebase exploration by agents | `wibwob code-health` JSON output |
| No boundary enforcement for src/ subdirectories | check-coat reads MODULE_MANIFEST, validates imports |
| No quality trajectory | `.code-health/` snapshots, `--diff` flag |
| Code health unknown until deep investigation | Pre-commit warning on regression |

## The three-level self-knowledge model

```
Level 1: RUNTIME (exists)     → describeState()    → GET /state
Level 2: SOURCE  (this)       → MODULE_MANIFEST    → wibwob code-health → GET /code-health
Level 3: EVOLUTION (this)     → snapshot + diff     → wibwob code-health --diff
```

Each level uses the same pattern: a typed constant or function → a tool that reads it → output that agents and humans consume through the same channel.

## Adversarial verdict

**Won over 6 alternatives** (per-module _meta.ts, compiler plugin, decorators, ts-morph CI, ESLint boundaries, dependency-cruiser with generated config) on self-documentation capability, drift resistance, developer friction, implementation cost, and composability with existing patterns.

**Key decision: zero new deps.** The critique proposed dependency-cruiser. The second adversarial pass found that `madge` is already in the toolchain handling circular deps, and `check-coat` already handles boundary enforcement with string matching. Adding dependency-cruiser would be redundant overlap with existing tools. Extending what exists is cheaper, simpler, and more consistent.

**Primary risk:** The regex-based metrics in `code-health` won't catch every edge case (nested functions, multi-line signatures). Mitigation: good enough for signals — exact counts don't matter, trends do. Can upgrade to AST parsing later if needed (parking lot item).

**Secondary risk:** Pre-commit hook could be slow on large changesets. Mitigation: scoped to changed files only (`git diff --name-only`). If still slow (>2s), make it opt-in.

## Phased implementation (revised after devil's advocate)

> Key insight from 08-devils-advocate.md: building monitoring for a codebase that's on fire is backwards. Fix the code first, then add the thermometer.

**Phase 0 — Refactor (the actual work):**
- Decompose Tier 1 god objects (app-controller, control-api, file-manager-window) per `code-quality-refactor-plan.md`
- Establish barrel-file boundaries: each `src/` subdirectory gets an `index.ts` re-exporting its public surface
- Apply the 30 CODE-STYLE principles to the refactored code
- ~3000-4000 LOC changed, ~14 files modified, ~5 new files
- **This is 90% of the value.** Everything after this is insurance.

**Phase 1 — Foundation (~90 LOC of infrastructure):**
- Write `MODULE_MANIFEST` with `ModuleId` type constraint (~40 LOC) — describes the barrel-file convention as a typed constant
- Add one check-coat check: validate src/ imports go through barrel files (~50 LOC)
- Verify with `bun run check-coat`

**Phase 2 — Trajectory (~100 LOC):**
- Add code-health snapshot: file/function sizes + boundary violations as JSON
- Persist to `.code-health/` (gitignored), diff on demand
- `wibwob code-health` CLI or script — standalone, works without TUI

**Phase 3 — Deferred (only if Phases 0-2 prove insufficient):**
- COAT endpoint (`GET /code-health`)
- Pre-commit warning (changed files only, warns not blocks)
- `@module` JSDoc tags validated by check-coat
- Full CLI command with `--diff` flag

**Total infrastructure: ~190 LOC (halved from original ~400 after devil's advocate)**
