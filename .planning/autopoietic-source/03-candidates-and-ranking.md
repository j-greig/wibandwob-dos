# Candidate Approaches — Autopoietic Source

> Revised after architectural critique (06) and second adversarial pass.

## The candidates

Six approaches to making this codebase self-documenting at the TypeScript level. Ordered from lightest to heaviest.

---

### A. Typed Manifest + Extended check-coat (WINNER)

**What:** A single `MODULE_MANIFEST` constant in `src/core/module-manifest.ts` defining every `src/` subdirectory's role, boundary rules, and description. Extend existing `check-coat` to read the manifest and validate src/ subdirectory boundaries (it already does this for microapp → SDK boundaries). A `wibwob code-health` CLI command reports metrics. A COAT endpoint at `GET /code-health` exposes results.

**Mechanism:**
- `MODULE_MANIFEST` is `as const satisfies Record<string, ModuleBoundary>` — type-checked, machine-readable
- `mayImportFrom` uses `ModuleId` type (= `keyof typeof MODULE_MANIFEST`) — typos are compile errors
- check-coat gains one new check (~50-80 lines) that reads the manifest and validates all src/ imports against boundary rules, using the same string-matching approach it already uses for microapps
- Metrics (file/function size, orphan exports) collected by a lightweight scan using `readFileSync` + regex — no AST library needed
- `madge --circular` (already in toolchain) continues to handle circular dependency detection
- Results are JSON — consumed by CLI, API, and agents
- Snapshot persistence in `.code-health/` (gitignored) enables trajectory tracking (Level 3)

**What it produces:** Live architectural map, boundary violation detection, file/function size metrics, orphan export detection, quality trajectory over time.

**New files:** 2 (manifest + code-health CLI). **Modified:** 2 (check-coat adds boundary check, control-api adds endpoint). **New dependencies:** 0.

---

### B. Per-Module `_meta.ts` Files

**What:** Each `src/` subdirectory gets a `_meta.ts` file that exports typed metadata: description, public exports, internal exports, stability tier, dependencies. A central registry imports all `_meta.ts` files.

**Mechanism:**
```typescript
// src/services/_meta.ts
export const META = {
  name: "services",
  description: "Capabilities shared by shell and microapps",
  boundary: "shared",
  exports: {
    public: ["microapp-sdk", "state-service"],
    internal: ["control-api", "agent-tools"],
  },
} as const satisfies ModuleMeta;
```

**What it produces:** Distributed metadata that lives next to the code it describes. Central aggregation via import.

**New files:** ~13 (`_meta.ts` per directory). **Modified:** 1 (aggregator).

**Adversarial assessment:**
- 13 new files across 150 is 8.7% — not catastrophic, but the handwritten export lists WILL drift from actual exports
- Self-describing only works if the description is computed, not handwritten
- The co-location principle is valuable — stolen for Approach A as a `@module` JSDoc tag validated by check-coat
- **Verdict:** Over-engineered. The central manifest in A is easier to review and enforce atomically.

---

### C. TypeScript Compiler Plugin for Boundary Enforcement

**What:** A custom TypeScript transformer plugin that reads `MODULE_MANIFEST` and emits compile errors when imports cross boundaries.

**Adversarial assessment:**
- Does Bun support TS compiler plugins? Not reliably — Bun uses its own transpiler
- Compiler plugins break across TypeScript versions — least stable integration point
- **Verdict:** Fragile. Wrong tool for a Bun-first codebase.

---

### D. Decorator-Based Module Metadata

**What:** Stage 3 decorators on exported classes/functions carry metadata.

**Adversarial assessment:**
- Stage 3 decorators **cannot** decorate plain function declarations or closures
- This codebase is mostly plain functions and closures
- Adding decorators to hundreds of exports is a rewrite, not a refactor
- **Verdict:** Wrong paradigm for this codebase.

---

### E. ts-morph AST Analysis as CI Step

**What:** A comprehensive ts-morph script runs in CI, producing full codebase analysis.

**Adversarial assessment:**
- ts-morph is ~30MB. Bun already provides transpiler APIs
- CI-only means developers don't see violations until push — too late
- The analysis capability is valuable, but the packaging is wrong
- **Verdict:** Right idea, wrong tool. The lightweight scan in Approach A achieves 80% of the value at 0% of the dependency cost.

---

### F. ESLint Plugin + Import Boundaries

**What:** Use `eslint-plugin-boundaries` or custom ESLint rules to enforce import restrictions.

**Adversarial assessment:**
- ESLint is not the primary toolchain (Bun-first)
- Rules live in config, not source — the documentation value is lost
- **Verdict:** Solves enforcement but not self-documentation. Adds a dependency the project has avoided.

---

### G. dependency-cruiser with Generated Config (NEW — evaluated then rejected)

**What:** Generate `.dependency-cruiser.js` config from `MODULE_MANIFEST`. Gets visual dependency graphs, circular dep detection, orphan detection "for free."

**Adversarial assessment (second pass):**
- `madge` is **already in the toolchain** (`bun run health` uses `npx madge --circular`). Circular dep detection is already solved.
- dependency-cruiser (~5MB) would overlap significantly with madge
- The "generated config" idea is clever (single source of truth) but adds a dependency to generate config for a tool that duplicates what we already have
- check-coat already does boundary checking with string matching — extending it is 50-80 lines, not a new tool
- **Verdict:** Redundant. madge + extended check-coat covers the use cases with zero new deps.

---

## Revised Ranking

| Rank | Candidate | Self-documenting? | Drift-resistant? | New deps | Compounds with existing? |
|------|-----------|-------------------|------------------|----------|--------------------------|
| **1** | **A — Manifest + Extended check-coat** | YES — manifest IS the docs | HIGH — scan + type constraints | **0** | YES — extends command-catalog, check-coat, madge |
| 2 | G — dep-cruiser generated config | Partial — config is generated | HIGH | 1 (~5MB) | Partial — overlaps madge |
| 3 | E — ts-morph CI (adapted) | Partial — produces report | MEDIUM | 1 (~30MB) | No |
| 4 | F — ESLint Boundaries | No — rules are config | MEDIUM | 2+ | No — new toolchain |
| 5 | B — Per-Module _meta.ts | Yes but drifts | LOW | 0 | Partial |
| 6 | C — Compiler Plugin | No | HIGH | 0 | No — Bun incompatible |
| 7 | D — Decorators | Yes | MEDIUM | 0 | No — wrong paradigm |

---

## Recommendation

**Approach A — Typed Manifest + Extended check-coat** — wins on every axis, and critically: **zero new dependencies.**

It is:
- The natural extension of patterns this codebase already uses (`command-catalog.ts`, `describeState()`, `check-coat`)
- TypeScript-native (`as const satisfies`, `ModuleId` type constraint) — self-validating at compile time
- Self-documenting (the manifest IS the architecture documentation)
- COAT-compliant (CLI-first, API adapts)
- Incrementally adoptable (start with manifest + boundary check, add metrics + trajectory later)
- Zero new dependencies (extends check-coat, uses madge already present)

### What we steal from other approaches

| Approach | Idea stolen | How it's used in A |
|----------|------------|-------------------|
| B (_meta.ts) | Co-location of metadata | `@module core` JSDoc tag in each directory's main file, validated by check-coat |
| E (ts-morph) | Deep AST metrics | Lightweight version using `readFileSync` + regex for function/file size |
| G (dep-cruiser) | Visual dependency graphs | madge already does this: `npx madge --image graph.svg src/` |
| tRPC/Zod | Schema IS the documentation | MODULE_MANIFEST IS the architecture spec — everything else is derived |
