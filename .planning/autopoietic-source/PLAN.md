# Self-Regulating TypeScript — Execution Plan

> One document. Replaces the 9-file planning cycle in `.planning/autopoietic-source/`.
> Read `CODE-STYLE.md` (30 principles) and this file. Then execute.

---

## The thesis

A codebase that follows its own principles doesn't need monitoring infrastructure. A 681-LOC function doesn't need a scanner to tell you it's too big — you can see it. A well-named direct import doesn't need a manifest to explain the dependency — the path IS the intent. A discriminated union doesn't need a comment to explain the states — the types ARE the documentation.

**The goal is not to build tools that detect bad code. The goal is to write code so clear, so small, so well-typed that the tools have nothing to report.**

The infrastructure we do build (~190 LOC) is a safety net for entropy, not a substitute for discipline.

---

## How we got here (decision trail)

This plan went through 4 adversarial passes. Each one cut scope.

```
Pass 1 — Vision: "Make the codebase self-documenting"
  → Proposed MODULE_MANIFEST + scan script + COAT endpoint + CLI
  → 6 alternatives evaluated (decorators, compiler plugins, _meta.ts, ts-morph, ESLint, dep-cruiser)
  → All rejected: zero new deps, extend existing patterns

Pass 2 — Self-critique: "Apply the 30 principles to the plan itself"
  → Found 7 weaknesses. Fixed: ModuleId type constraint, CLI-first not API-first,
    Level 3 trajectory from day one, ARCHITECTURE.md points to manifest not parallel
  → Infrastructure: ~400 LOC

Pass 3 — Critique the critique: "Are the fixes internally consistent?"
  → Found 4 tensions. Resolved: madge already handles circular deps (don't add
    dep-cruiser), extend check-coat (don't add ts-arch), Level 3 is ~100 LOC
    not 20, pre-commit scoped to changed files
  → Infrastructure: ~350 LOC

Pass 4 — Devil's advocate: "Do we need any of this?"
  → Every monitoring artifact is a confession that the code isn't clear enough
  → BUT: principles alone didn't prevent the current state, TS has no module
    access control, agents need machine-readable structure, trajectory needs measurement
  → Synthesis: REFACTOR FIRST. Infrastructure halved to ~190 LOC. Deferred the rest.

Pass 5 — Kill the barrels: "The codebase already uses direct imports everywhere"
  → Research found: only 2 barrel files exist (sdk/index.ts, ui/index.ts) — special purpose
  → The entire codebase uses direct imports: `from "../core/theme/resolver.js"`
  → Barrel files would be a new pattern imposed on a codebase that doesn't use them
  → Direct imports are more honest — you see the real dependency, not a re-export
  → check-coat already validates import paths with string matching (microapp boundaries)
  → Extending check-coat to validate src/ directory boundaries against MODULE_MANIFEST
    is ~50 LOC and works with direct imports — no barrels needed
```

**The final position:** 95% of the value is writing better code. 5% is a thin safety net to keep it that way.

---

## What makes code self-regulating

These are the structural properties that eliminate the need for external monitoring. Each maps to CODE-STYLE principles. The refactor should produce code with ALL of these properties.

### 1. Every file fits in your head

**Target:** No file over 400 LOC. No function over 80 LOC. If you need a scanner to tell you something is too big, it's already too big.

**How:** P1 Composed Method — divide into sub-functions at the same abstraction level. P5 Single Responsibility — each function has one reason to change. P15 Extract Complex Logic — when a function shares many temporaries, it becomes its own module.

**Self-regulating test:** Can you write a one-sentence purpose statement for this file? If not, it does too much.

### 2. Types carry the intent, not comments

**Target:** A new reader understands module boundaries, state machines, error paths, and data flow by reading the types alone.

**How:** P27 Discriminated Unions for state — `type Result<T,E> = {ok:true,data:T} | {ok:false,error:E}`. P28 Branded Types for semantic safety — `type UserId = string & {readonly __brand: unique symbol}`. P30 Error States in Types — force callers to handle errors through the type system. P29 Type Narrowing as control flow — `if (!result.ok)` narrows without assertion.

**Self-regulating test:** Delete all comments from the file. Is the code still understandable? If not, the types aren't carrying enough weight.

### 3. Direct imports show the real dependency graph

**Target:** Every import names the exact file it depends on. `import { theme } from "../core/theme/resolver.js"` is honest — you see the real dependency, not a re-export barrel that hides it. MODULE_MANIFEST + check-coat validate that the directory-level boundary is respected.

**How:** P22 Explicit Collaboration Interfaces — the import path IS the collaboration interface. P3 Replace Comments with Clear Code — a direct import is clearer than a barrel that obscures which file you actually depend on. The codebase already uses this pattern consistently.

**Self-regulating test:** Read the imports at the top of a file. Can you tell exactly which modules it depends on and why? If so, the boundaries are self-evident. check-coat validates the rest.

### 4. Named constants replace magic values

**Target:** Zero magic numbers, zero unexplained string literals. Every threshold, timing value, and configuration constant has a name that explains its purpose.

**How:** P19 Named Constants — `as const` objects with derived union types. P11 Explaining Variables — assign complex expressions to well-named locals.

**Self-regulating test:** Search the file for bare numbers. Every one should either be obviously self-explanatory (0, 1, -1) or named.

### 5. Duplication is extracted, not tolerated

**Target:** Every piece of knowledge exists in exactly one place. Utility types derive from source types. Shared patterns are composed, not copied.

**How:** P6 Say Things Once — `typeof`, `ReturnType`, `Parameters` to derive types. P14 Compose, Don't Inherit — share via higher-order functions, not subclasses. P16 Resource Bracketing — `using`/`Disposable` for paired operations.

**Self-regulating test:** Search for any pattern that appears 3+ times. If it exists, it should be a function.

### 6. Guard clauses flatten the code

**Target:** No function exceeds 2 levels of indentation in its main path. Edge cases and errors are handled at the top, then the happy path reads flat.

**How:** P9 Guard Clauses — `if (!x) return` narrows the type AND flattens the code. P29 Type Narrowing — the compiler rewards early returns with tighter types.

**Self-regulating test:** Look at the indentation. If you see a staircase, the function needs guard clauses or decomposition.

---

## The refactor (Phase 0 — this is 90% of the value)

Execute `code-quality-refactor-plan.md` at repo root. The concrete steps below are the priority order.

### Phase A — Helpers (no existing code changes)

| # | Action | Principles |
|---|--------|-----------|
| A1 | Create `src/core/arg-helpers.ts` with `typedArg<T>(args, key, type)` helper | P6 — eliminates 45+ typeof guards |
| A2 | Add `getSelectedIndex(list): number` to `src/ui/index.ts` | P6, P20 — replaces 10+ unsafe casts |
| | `bun run typecheck` — must pass | |

### Phase B — Tier 1 god objects (one file at a time)

| # | Action | Principles |
|---|--------|-----------|
| B1 | Extract `app-controller.ts:getAppMenuActions()` → `src/core/menu-actions.ts`. Split by domain. Pass explicit context object. Apply `typedArg`. | P1, P5, P15 |
| | `bun run typecheck` + integration tests | |
| B2 | Replace `control-api.ts:handleRequest()` (680 LOC) with route-handler map. Each route = named function with guard clauses. | P1, P5, P9 |
| | `bun run typecheck` + integration tests | |
| B3 | Decompose `file-manager-window.ts` (1,859 LOC single function) into composed functions. Extract preview phases, data helpers, keymap, ext→color constant. | P1, P15, P6 |
| | `bun run typecheck` + integration tests + visual verification | |

### Phase C — Tier 2 deduplication

| # | Action | Principles |
|---|--------|-----------|
| C1 | Extract `createFormBase()` in `forms.ts` — 8 factories compose on top | P6, P14 |
| C2 | Extract `createPromptModal()` in `overlay-manager.ts` — shared modal pattern | P6, P16 |
| C3 | Decompose `chrome-browser-service.ts:navigate()` into extraction strategies | P1, P13 |
| C4 | Decompose `terrain-render.ts:renderFirstPerson()` into `castRays()`, `renderSky()`, `renderObjects()`. Named constants for magic numbers. | P1, P19 |
| C5 | Extract `typedPayload()` in `snapshot-registry.ts` | P6, P11 |
| C6 | Replace all `(list as List & {selected}).selected` casts with `getSelectedIndex()` | P6, P20 |
| | `bun run typecheck` + `bun run check-coat` + full integration suite + visual verification | |

### Evidence gates (run after each phase)

```
bun run typecheck          # zero errors
bun run check-coat         # zero violations
bun run test               # unit tests green
bun test src/tests/integration/  # integration tests green
wibwob health              # instance running, screen renders
```

---

## The safety net (Phase 1 — ~190 LOC of insurance)

Only build this AFTER Phase 0. The code should already be self-regulating. This catches entropy.

### MODULE_MANIFEST (~40 LOC)

```typescript
// src/core/module-manifest.ts
type ModuleId = keyof typeof MODULE_MANIFEST;
type ModuleBoundary = {
  boundary: string;
  mayImportFrom: readonly ModuleId[];  // typos are compile errors
  description: string;
};

export const MODULE_MANIFEST = {
  "core":     { boundary: "shell",          mayImportFrom: ["core"],                          description: "Composition root. Owns the four seams." },
  "services": { boundary: "shared",         mayImportFrom: ["core", "services", "domain"],    description: "Capabilities shared by shell and microapps." },
  "sdk":      { boundary: "sdk-surface",    mayImportFrom: ["sdk", "ui"],                     description: "The only import path for microapp authors." },
  "windows":  { boundary: "consumer",       mayImportFrom: ["core", "services", "sdk", "ui"], description: "Window implementations. COAT consumers." },
  "ui":       { boundary: "design-system",  mayImportFrom: ["ui"],                            description: "Terminal component library." },
} as const satisfies Record<string, ModuleBoundary>;
```

This is the tRPC/Zod insight: the typed constant IS the spec. Agents read it instead of parsing ARCHITECTURE.md prose. The `ModuleId` constraint means `mayImportFrom: ["servics"]` is a compile error.

ARCHITECTURE.md's boundary section becomes a pointer: "See `MODULE_MANIFEST` in `src/core/module-manifest.ts`."

### check-coat extension (~50 LOC)

One new check in `scripts/checks/check-coat.ts`: read MODULE_MANIFEST, walk all `src/` import paths, extract the target directory (e.g., `../services/control-api` → `services`), verify it's in the source module's `mayImportFrom` list. Same string-matching approach as the existing microapp boundary check — direct imports validated at the directory level.

### code-health snapshot (~100 LOC)

A script that writes JSON to `.code-health/` (gitignored): file sizes, function counts, boundary violations. Run on demand. Diff against previous snapshot for trajectory. No CLI command, no COAT endpoint — just a script and a JSON file.

---

## Deferred (Phase 3 — only if the above proves insufficient)

These are in the parking lot. Each has a "reconsider when" condition.

| Idea | Reconsider when |
|------|-----------------|
| `GET /code-health` COAT endpoint | Agents need live code health data during a running session |
| `wibwob code-health` CLI command | The script-and-JSON approach proves too manual |
| `wibwob code-health --diff` | Trajectory tracking is used frequently enough to justify a CLI flag |
| Pre-commit health warning | The codebase regresses despite check-coat enforcement |
| `@module` JSDoc tags in each directory | Directory names alone aren't communicating module purpose |
| dependency-cruiser | madge + check-coat proves insufficient for import analysis |
| ts-arch boundary tests | check-coat's regex produces false positives that can't be fixed |
| Per-module `_meta.ts` files | Codebase grows past 300 files |
| Branded module paths | Too clever — but reconsider if boundary violations remain high |
| Full AST-based code-health | Regex metrics prove unreliable for trends |

---

## The three levels of self-knowledge

This is the larger vision. Phase 0 + Phase 1 achieves Levels 1 and 2. Level 3 is the code-health snapshot.

```
Level 1: RUNTIME (exists)      describeState() → GET /state
  The system knows what it's showing right now.

Level 2: SOURCE (Phase 0 + 1)  MODULE_MANIFEST + direct imports → check-coat
  The system knows what it's made of and where the boundaries are.

Level 3: EVOLUTION (Phase 1)   .code-health/ snapshots → diff on demand
  The system knows whether it's getting better or worse.
```

The autopoietic loop: the code describes itself (direct imports, types, manifest) → tools verify the description matches reality (check-coat, typecheck) → violations surface at development time → the code is fixed → the description stays true.

But the deepest form of autopoiesis isn't the loop. It's code that's so well-structured the loop has nothing to catch.

---

## Constraints

- **Zero new dependencies.** `madge` and `check-coat` already exist. Extend, don't add.
- **`bun run health` must pass** before and after every phase.
- **Direct imports are honest.** The import path shows the real dependency. MODULE_MANIFEST + check-coat validate directory-level boundaries without barrel indirection.
- **CLI-first, API adapts.** Any tool must work without a running TUI instance.
- **Never commit to `main`.** Feature branch per tier.
- **Visual verification mandatory.** API responses are not proof.
