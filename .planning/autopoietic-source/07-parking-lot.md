# Parking Lot — Relegated Ideas

Ideas evaluated during the autopoietic source planning that were cut from the current plan but may be valuable later. Each entry records why it was cut and under what conditions it should be reconsidered.

---

## 1. dependency-cruiser with generated config

**The idea:** Generate `.dependency-cruiser.js` from MODULE_MANIFEST so boundary rules live in one place. Gets visual dependency graphs and orphan detection "for free."

**Why cut:** `madge` is already in the toolchain (`bun run health`). dependency-cruiser (~5MB) overlaps with madge on circular deps and graph generation. check-coat already does boundary enforcement with string matching. Adding dep-cruiser is redundant.

**Reconsider when:** madge proves insufficient for a specific analysis need (e.g., orphan module detection, fine-grained path restrictions) that check-coat's string matching can't handle cheaply.

---

## 2. Per-module `_meta.ts` files (Approach B)

**The idea:** Each `src/` subdirectory gets a `_meta.ts` file exporting typed metadata — description, exports, stability tier, dependencies.

**Why cut:** 13 new files for a 150-file codebase. Handwritten export lists drift from actual exports. Co-location is valuable but achievable more cheaply with `@module` JSDoc tags validated by check-coat.

**Reconsider when:** The codebase grows to 300+ files and directory-level context becomes genuinely hard to discover. Or if microapp authors need machine-readable metadata about host modules.

---

## 3. Branded module paths

**The idea:** TypeScript branded types on import paths so boundary violations are compile errors:
```typescript
type CoreModule = string & { __layer: "core" };
function coreImport<T>(path: CoreModule): T { ... }
```

**Why cut:** Too clever (P3 — Replace Comments with Clear Code applies to types too). Adds indirection to every import. The developer cost of understanding branded import wrappers exceeds the value over check-coat's simple string matching.

**Reconsider when:** TypeScript adds native module restriction syntax (unlikely) or the boundary violation rate is consistently high despite check-coat warnings.

---

## 4. ts-arch for boundary enforcement

**The idea:** Use ts-arch (ArchUnit for TypeScript) to write boundary rules as test assertions:
```typescript
filesOfProject().inFolder('sdk').shouldNot().dependOnFiles().inFolder('windows')
```

**Why cut:** New dependency for something check-coat already does idiomatically. ts-arch parses imports statically which is more rigorous than regex, but regex catches 95%+ of real-world violations in this codebase's import style.

**Reconsider when:** The regex-based boundary check in check-coat produces false positives/negatives that can't be fixed with pattern refinement. Or if the test-assertion API proves more readable for complex boundary rules.

---

## 5. ts-morph for deep AST metrics

**The idea:** Use ts-morph (~30MB) for precise function length counting, complexity analysis, dead code detection.

**Why cut:** Heavy dependency. `readFileSync` + regex gives good-enough function/file size signals. Exact counts don't matter — trends do.

**Reconsider when:** The regex-based metrics consistently miscount (nested functions, multi-line signatures) to a degree that makes trends unreliable. Or when adding complexity metrics (cyclomatic complexity) becomes a priority.

---

## 6. Decorator-based module metadata (Approach D)

**The idea:** Stage 3 decorators carry metadata: `@module("services")`, `@stability("public")`.

**Why cut:** Decorators can't decorate plain function declarations or closures — only classes and class members. This codebase is mostly plain functions. Would require rewriting the entire codebase to a class-based style.

**Reconsider when:** Never, unless the codebase migrates to a class-heavy style (unlikely given PHILOSOPHY.md).

---

## 7. TypeScript compiler plugin (Approach C)

**The idea:** Custom TS transformer plugin reads MODULE_MANIFEST and emits compile errors on boundary violations.

**Why cut:** Bun uses its own transpiler, not `tsc`. Compiler plugins are fragile across TS versions and poorly supported in non-tsc environments.

**Reconsider when:** Bun adds stable compiler plugin support AND TypeScript stabilises the transformer API.

---

## 8. Pre-commit hook that blocks (not warns)

**The idea:** Make `code-health --changed` a blocking pre-commit check that fails the commit if quality regresses.

**Why cut:** Warns-not-blocks is better for rapid iteration. Blocking on metrics during active development creates friction that leads to `--no-verify` muscle memory, which is worse than no hook at all.

**Reconsider when:** The project has a CI gate that catches regressions anyway, and the team wants to shift enforcement left. Or if the warns-not-blocks approach proves ineffective (warnings ignored).

---

## 9. Full AST-based code-health (upgrade path)

**The idea:** Replace regex-based function/file counting with proper TypeScript AST parsing for precision.

**Why cut:** Regex is good enough for signals. The cost of AST parsing (either via Bun's transpiler API or ts-morph) doesn't justify the precision gain for trend analysis.

**Reconsider when:** Adding cyclomatic complexity, nesting depth analysis, or other metrics that genuinely require AST structure. This is the natural Phase 4 upgrade path.

---

## 10. ESLint boundary plugin (Approach F)

**The idea:** Use `eslint-plugin-boundaries` with tags matching src/ subdirectories.

**Why cut:** ESLint is not the primary toolchain (Bun-first). Rules live in config, not source — the self-documentation value is lost. Adds a dependency graph the project has avoided.

**Reconsider when:** The project adopts ESLint broadly for other reasons, making the marginal cost of adding boundary rules near zero.
