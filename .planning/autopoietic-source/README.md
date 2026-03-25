# Autopoietic Source — Plan & Decision Journal

## For the executing agent

You are picking up a completed planning cycle. Read the documents below in order, then execute Phase 0 first. The key references are `CODE-STYLE.md` (30 principles) and `code-quality-refactor-plan.md` (both at repo root).

### Execution order

```
Phase 0  REFACTOR THE CODE             ← 90% of the value lives here
         code-quality-refactor-plan.md   Tier 1 god objects first
         CODE-STYLE.md                   The 30 principles to apply
         Barrel files for every src/ subdir  (index.ts re-exporting public surface)

Phase 1  MODULE_MANIFEST + check-coat   ← ~90 LOC of infrastructure
         src/core/module-manifest.ts     Typed constant, ModuleId constraint
         scripts/checks/check-coat.ts    One new check: barrel-file import validation

Phase 2  CODE-HEALTH SNAPSHOT           ← ~100 LOC
         scripts/code-health.ts          File/function sizes + boundary status as JSON
         .code-health/                   Gitignored snapshot directory for trajectory

Phase 3  DEFERRED                       ← only if 0-2 prove insufficient
         GET /code-health               COAT endpoint
         Pre-commit warning             Changed files only, warns not blocks
         @module JSDoc tags             Validated by check-coat
         wibwob code-health --diff      CLI trajectory command
```

### Critical constraints

- **Zero new dependencies.** `madge` (circular deps) and `check-coat` (boundary enforcement) already exist. Extend, don't add.
- **CLI-first, API adapts.** Any analysis must work without a running TUI instance. The CLI command is primary; the COAT endpoint is a thin adapter.
- **Barrel files are the primary boundary mechanism.** MODULE_MANIFEST describes the convention. check-coat enforces it. The barrels themselves are the actual boundaries.
- **`bun run check-coat` must pass** before and after every phase.
- **`bun run health` must pass** before and after every phase.

---

## Decision journal — how we got here

This plan went through 4 adversarial passes over one session. Here's the decision tree.

### Pass 1: Vision + Candidate Ranking

Started from user prompt: make the codebase autopoietic — self-documenting at the TypeScript level, not through external docs.

Evaluated 6 approaches:

```
A. Typed Manifest + Scan Script     ← SELECTED
B. Per-module _meta.ts files        ← rejected: 13 new files, handwritten exports drift
C. Compiler plugin                  ← rejected: Bun doesn't support TS plugins reliably
D. Decorator metadata               ← rejected: can't decorate plain functions
E. ts-morph CI analysis             ← rejected: 30MB dep, CI-only is too late
F. ESLint boundaries                ← rejected: not in toolchain, rules are config not source
```

**Decision:** Approach A wins — extends existing patterns (command-catalog, describeState, check-coat), zero deps, TypeScript-native.

Documents: `02-vision.md`, `03-candidates-and-ranking.md`, `05-research.md`

### Pass 2: Architectural Critique (channelling the 30 principles)

Applied the CODE-STYLE principles to the plan itself. Found 7 weaknesses:

1. Hand-maintained manifest isn't truly autopoietic (P6 Say Things Once)
2. Proposed ts-arch alongside existing check-coat — two boundary tools (P22)
3. Level 3 deferred as "future" when it's the compound value (addressed)
4. TypeScript type features underused — added ModuleId constraint (P29)
5. Dismissed co-location too fast — stole @module JSDoc idea from Approach B
6. COAT endpoint was primary, should be CLI-first (COAT principle)
7. dependency-cruiser dismissed too fast — proposed generating config from manifest

**Decision:** 7 specific revisions to the plan. Level 3 from day one. CLI-first. ModuleId type constraints.

Document: `06-architectural-critique.md`

### Pass 3: Second Adversarial Pass (critique the critique)

Found 4 internal tensions in the critique itself:

```
Tension                              Resolution
─────────────────────────────────────────────────────────────────
dep-cruiser vs zero-dep philosophy   madge already in toolchain — don't add dep-cruiser
check-coat vs ts-arch (contradictory) Extend check-coat, one tool
Level 3 "20 lines" estimate          Actually ~80-100 LOC, still worth it
Pre-commit hook performance           Scope to changed files only
```

**Key discovery:** `madge` is already in `package.json` health script. dep-cruiser is redundant.

**Decision:** Zero new deps confirmed. check-coat extended. Infrastructure stays at ~350-450 LOC.

Documents: `06-architectural-critique.md` (appended), `07-parking-lot.md`

### Pass 4: Devil's Advocate (do we need any of this?)

The existential challenge: every line of monitoring code is a confession that the source code isn't clear enough. What if we just wrote better code?

```
Devil's case (half right):
  - The refactor is 90% of the value — infrastructure without refactoring is a dashboard for a burning building
  - Barrel files should be primary boundaries, not MODULE_MANIFEST
  - Plan over-indexes on detection vs prevention
  - ~400 LOC of monitoring vs ~3000-4000 of actual refactoring — ratio is wrong

Counter-attack (half right):
  - "Write better code" is not a mechanism — principles alone didn't prevent the current state
  - TypeScript has no module-level access control — barrels are bypassable without tooling
  - Feedback loops require measurement — trajectory needs snapshots
  - Agents need machine-readable structure — MODULE_MANIFEST is not optional for AI-assisted dev
```

**Decision:** Refactor first (Phase 0). Infrastructure halved to ~190 LOC. COAT endpoint, pre-commit hook, and CLI extras deferred to Phase 3.

Document: `08-devils-advocate.md`, `04-summary.md` (revised)

---

## Document index

| # | File | Purpose |
|---|------|---------|
| 00 | `00-original-prompt.md` | User's verbatim request |
| 01 | `01-enhanced-prompt.md` | Sharpened prompt with 5-phase execution plan |
| 02 | `02-vision.md` | The autopoietic codebase vision — three-level self-knowledge model, MODULE_MANIFEST design, CLI-first principle |
| 03 | `03-candidates-and-ranking.md` | 7 approaches evaluated (A-G), adversarial assessment of each, ranking table, "what we steal" from rejected approaches |
| 04 | `04-summary.md` | **The final plan.** Phased implementation (0-3), effort estimates, what gets built, what gets deferred |
| 05 | `05-research.md` | Prior art: ts-arch, dependency-cruiser, Nx boundaries, Living Documentation, Zod/tRPC patterns, decorator limitations |
| 06 | `06-architectural-critique.md` | 7 critiques of the original plan + second adversarial pass resolving 4 internal tensions |
| 07 | `07-parking-lot.md` | 10 relegated ideas with "reconsider when" conditions |
| 08 | `08-devils-advocate.md` | Existential challenge — refactor-first argument, synthesis, revised priority order |

## Related repo-root files

| File | Role |
|------|------|
| `CODE-STYLE.md` | The 30 TypeScript-centric code quality principles (Beck-derived + TS-native) |
| `code-quality-refactor-plan.md` | Concrete refactor plan for src/ — Tier 1/2/3 files, decomposition steps, blast radius |
