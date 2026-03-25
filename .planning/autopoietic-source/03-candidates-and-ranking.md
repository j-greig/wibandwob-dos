# Candidate Approaches — Autopoietic Source

## The candidates

Six approaches to making this codebase self-documenting at the TypeScript level. Ordered from lightest to heaviest.

---

### A. Typed Manifest + Scan Script

**What:** A single `MODULE_MANIFEST` constant in `src/core/module-manifest.ts` defining every `src/` subdirectory's role, boundary rules, and description. A `scripts/code-health.ts` script (ts-morph or raw AST) scans the codebase, validates imports against the manifest, reports metrics. A COAT endpoint at `GET /code-health` exposes results.

**Mechanism:**
- `MODULE_MANIFEST` is `as const satisfies Record<string, ModuleBoundary>` — type-checked, machine-readable
- The scan script uses the TypeScript compiler API or `ts-morph` to walk imports and measure functions
- Results are JSON — consumed by CLI (`wibwob code-health`), API, and agents
- No decorators, no base classes, no framework. Just a constant and a script.

**What it produces:** Live architectural map, boundary violation detection, file/function size metrics, orphan export detection.

**New files:** 2 (manifest + scan script). **Modified:** 1 (control-api.ts adds endpoint).

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

---

### C. TypeScript Compiler Plugin for Boundary Enforcement

**What:** A custom TypeScript transformer plugin that reads `MODULE_MANIFEST` and emits compile errors when imports cross boundaries. Violations are caught at `tsc` time, not at script-scan time.

**Mechanism:** Uses `ts.TransformerFactory` to intercept import declarations and check them against the manifest. Runs as part of `bun run typecheck`.

**What it produces:** Compile-time architectural boundary enforcement.

**New files:** 1 (plugin). **Modified:** 1 (tsconfig.json). **Risk:** Compiler plugins are fragile, version-coupled, and poorly supported by Bun.

---

### D. Decorator-Based Module Metadata

**What:** Stage 3 decorators on exported classes/functions carry metadata: `@module("services")`, `@stability("public")`, `@boundary("sdk-surface")`. A reflection API reads this at runtime.

**Mechanism:** TypeScript 5.0+ stage 3 decorators. Metadata stored in decorator return value or `Symbol.metadata`.

**What it produces:** Runtime-queryable metadata on every export.

**New files:** 1 (decorator definitions). **Modified:** many (add decorators to every export). **Risk:** Enormous code churn. Decorators only work on classes and class members (not plain functions, not types). Violates the codebase's functional-first style.

---

### E. ts-morph AST Analysis as CI Step

**What:** A comprehensive ts-morph script runs in CI, producing a full codebase analysis: dependency graph, complexity metrics, architectural boundary validation, dead code detection, CODE-STYLE.md principle violations. Results stored as a JSON artifact.

**Mechanism:** ts-morph wraps the TypeScript compiler API with a friendlier interface. The script walks every source file, analyzing AST structure.

**What it produces:** Deep analysis, but only in CI (not live).

**New files:** 1 (analysis script). **Modified:** 1 (CI config). **Risk:** ts-morph is a 30MB dependency. Analysis is batch, not live.

---

### F. ESLint Plugin + Import Boundaries

**What:** Use `eslint-plugin-boundaries` or custom ESLint rules to enforce import restrictions. Each `src/` subdirectory gets a tag. Rules define which tags can import from which.

**Mechanism:** ESLint config with boundary rules:
```json
{
  "boundaries/element-types": [
    { "type": "core", "pattern": "src/core/*" },
    { "type": "sdk", "pattern": "src/sdk/*" },
  ],
  "boundaries/entry-point": [...],
  "boundaries/external": [...]
}
```

**What it produces:** Lint-time boundary enforcement.

**New files:** 0. **Modified:** 1 (eslint config). **Risk:** ESLint is not in the current toolchain (Bun-first). Adding it adds complexity. Rules live in config, not source — they can drift.

---

## Adversarial questioning

### For each candidate:

**A — Typed Manifest + Scan Script:**
- *Does this prevent god objects?* The scan script can report "15 functions over 100 LOC" but it doesn't prevent them. It makes them visible. Visibility drives action only if someone looks.
- *Will the manifest drift?* Only if someone adds a new directory and forgets to add it to the manifest. The scan script can detect unlisted directories and warn.
- *Is this actually new?* `command-catalog.ts` already IS this pattern — a typed constant that describes the system. This extends it from commands to modules.
- *Why not just use ESLint?* Because the manifest IS the documentation. ESLint rules describe restrictions. The manifest describes architecture — what each module IS, not just what it can't import.

**B — Per-Module `_meta.ts`:**
- *13 new files?* That's file bloat for a 150-file codebase. Each `_meta.ts` must be maintained.
- *Will they drift?* Yes — the listed exports will diverge from actual exports. Self-describing only works if the description is computed, not handwritten.
- *What does this give over A?* Co-location (metadata lives next to code). But A's single manifest is easier to review and enforce atomically.
- *Verdict:* Over-engineered. The distributed approach doesn't pay for its complexity.

**C — Compiler Plugin:**
- *Does Bun support TS compiler plugins?* Not reliably. Bun uses its own transpiler, not `tsc`.
- *Maintenance burden?* Compiler plugins break across TypeScript versions. They're the least stable integration point.
- *Verdict:* Fragile. Wrong tool for a Bun-first codebase.

**D — Decorators:**
- *Can you decorate plain functions?* No. Stage 3 decorators only work on classes and class members. This codebase is mostly plain functions and closures.
- *Code churn?* You'd need to add decorators to hundreds of exports. That's not a refactor — it's a rewrite.
- *Verdict:* Wrong paradigm for this codebase. Decorators are for Angular/NestJS class-heavy codebases.

**E — ts-morph CI:**
- *30MB dependency for a scan script?* That's heavy for what `bun` already provides (Bun has built-in transpiler APIs).
- *Batch-only?* If it only runs in CI, developers don't see violations until push. That's too late.
- *Could the scan script in A use Bun's APIs instead?* Yes — `Bun.Transpiler` and the TS compiler API give you AST access without ts-morph.
- *Verdict:* The analysis capability is valuable, but the packaging (CI-only, heavy dependency) is wrong.

**F — ESLint Boundaries:**
- *Is ESLint in the toolchain?* No. Adding it means `npm install eslint @typescript-eslint/parser eslint-plugin-boundaries` + config. That's a new dependency graph.
- *Rules live in config, not source.* A new developer reads `.eslintrc` not `MODULE_MANIFEST`. The documentation value is lost.
- *Verdict:* Solves boundary enforcement but not self-documentation. And adds a dependency the project has avoided.

---

## Ranking

| Rank | Candidate | Self-documenting? | Drift-resistant? | Developer friction | Implementation cost | Compounds with existing patterns? |
|------|-----------|-------------------|------------------|-------------------|--------------------|---------------------------------|
| **1** | **A — Typed Manifest + Scan Script** | YES — manifest IS the docs | HIGH — scan detects unlisted dirs, orphan exports | LOW — no new syntax, no decorators | LOW — 2 new files + 1 endpoint | YES — extends command-catalog pattern |
| 2 | E — ts-morph CI (adapted) | Partial — produces report | MEDIUM — runs on demand | LOW — CI only | MEDIUM — heavy dep | Partial |
| 3 | F — ESLint Boundaries | No — rules are config | MEDIUM — config can drift | LOW | LOW | No — new toolchain |
| 4 | B — Per-Module _meta.ts | Yes | LOW — handwritten, drifts | MEDIUM — 13 new files | MEDIUM | Partial |
| 5 | C — Compiler Plugin | No — invisible enforcement | HIGH | LOW | HIGH — fragile | No |
| 6 | D — Decorators | Yes | MEDIUM | HIGH — rewrite needed | HIGH | No — wrong paradigm |

---

## Recommendation

**Approach A — Typed Manifest + Scan Script** — wins on every axis.

It is:
- The natural extension of patterns this codebase already uses (`command-catalog.ts`, `describeState()`)
- TypeScript-native (`as const satisfies`) — no external dependencies
- Self-documenting (the manifest IS the architecture documentation)
- COAT-compliant (exposed via `GET /code-health` like everything else)
- Incrementally adoptable (start with boundaries only, add metrics later)
- Lightweight (2 new files, 1 modified)

The scan script should use Bun-native APIs (not ts-morph) to walk the AST. It reports to the same COAT channel as everything else. The manifest replaces the prose in ARCHITECTURE.md with a typed constant that the compiler checks.

### The compound effect

Once `MODULE_MANIFEST` exists:
- The `/refactor` prompt reads it to know where extracted code should land
- `wibwob code-health` replaces manual codebase exploration
- `GET /code-health` gives agents the same structural awareness humans get from reading ARCHITECTURE.md
- Boundary violations are caught before commit, not during review
- New modules self-document by adding to the manifest (you can't forget — the scan warns about unlisted directories)

The codebase doesn't just describe its runtime anymore. It describes its own structure, and the structure describes back.
