# Summary — The Autopoietic Source Proposal

> Revised after architectural critique (06) and second adversarial pass.

## One sentence

Add a typed `MODULE_MANIFEST` constant and extend `check-coat` so the codebase describes its own architecture through the same patterns it already uses — zero new dependencies, CLI-first, with quality trajectory from day one.

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

## Phased implementation

**Phase 1 — Foundation (smallest useful slice):**
- Write `MODULE_MANIFEST` with `ModuleId` type constraint
- Add boundary check to `check-coat`
- Verify with `bun run check-coat`

**Phase 2 — Visibility:**
- Write `wibwob code-health` CLI command (file/function metrics + boundary status)
- Add snapshot persistence to `.code-health/`
- Add `--diff` flag for trajectory

**Phase 3 — Loop closure:**
- Add `GET /code-health` COAT endpoint
- Add pre-commit warning (changed files only)
- Update ARCHITECTURE.md to point to MODULE_MANIFEST
- Add `@module` JSDoc tags to directory main files, validated by check-coat
