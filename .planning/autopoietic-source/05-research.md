# Research Findings — Self-Documenting TypeScript Patterns

Research completed by background agent surveying prior art across 6 domains.

---

## Key findings that affect our recommendation

### 1. ts-arch exists and does exactly what we described

**ts-arch** (https://github.com/ts-arch/ts-arch) provides ArchUnit-style architectural tests for TypeScript:

```typescript
filesOfProject()
  .inFolder('domain')
  .shouldNot()
  .dependOnFiles()
  .inFolder('infrastructure')
```

This is **test-time** boundary enforcement — architectural rules written as assertions in the test suite. It parses imports statically, no compilation needed.

**Impact on our recommendation:** ts-arch could be the enforcement layer for `MODULE_MANIFEST` boundaries, turning the manifest into executable tests rather than requiring a custom scan script. This simplifies Approach A.

### 2. dependency-cruiser is the production-proven tool

**dependency-cruiser** (https://github.com/sverweij/dependency-cruiser) is the most mature option for import graph analysis. It:
- Validates imports against configurable rules
- Generates visual dependency graphs (SVG/DOT)
- Detects circular dependencies
- Integrates into CI

However, its rules live in `.dependency-cruiser.js` config — not in source. This weakens the self-documentation property. The config describes restrictions but not architecture.

### 3. Nx module boundaries are the gold standard

Nx's `@nx/enforce-module-boundaries` is the most sophisticated approach in the JS ecosystem:
- Libraries get **tags** (`scope:billing`, `type:domain`, `stability:stable`)
- ESLint rules enforce which tags can depend on which
- `nx graph` generates a live visual dependency map

**The key insight from Nx:** tags are metadata ON the code (in `project.json`), not external config. This is closer to our `MODULE_MANIFEST` idea — but requires the Nx ecosystem.

### 4. Decorators can't reach plain functions

Stage 3 decorators (TS 5.0+) work on: classes, methods, getters, setters, fields, auto-accessors. They **cannot** decorate function declarations or plain exports. Since WibWob-DOS is mostly plain functions and closures, decorators are confirmed as the wrong tool.

`Symbol.metadata` is the new standard for decorator metadata (replaces `reflect-metadata`), but it inherits the class-only limitation.

### 5. Living Documentation (Martraire) validates the approach

Cyrille Martraire's *Living Documentation* (2019) distinguishes:
- **Stable knowledge** (architecture decisions) → document it (ADRs, ARCHITECTURE.md)
- **Volatile knowledge** (API surface, module structure) → generate it from code

His key principle: "Most of the knowledge we need is already in the artifacts we produce. We just need to exploit it."

This directly supports our approach: the `MODULE_MANIFEST` is stable knowledge (the architecture intent), and the scan script extracts volatile knowledge (actual metrics, actual imports) from the source.

### 6. TypeScript's type system alone cannot enforce import boundaries

Confirmed: you cannot write a TypeScript type that says "this module may not import from that folder." Branded types and conditional types can enforce value-level constraints, but import-graph constraints require tooling.

This means our scan script (or ts-arch tests) is not optional — it's the enforcement mechanism.

### 7. Zod/tRPC pattern: schema IS the documentation

Zod schemas are self-documenting because `UserSchema.shape` is inspectable at runtime. tRPC achieves end-to-end type safety because `typeof appRouter` captures the entire API surface as a type.

This reinforces our COAT pattern: `GET /code-health` returning typed JSON is the equivalent of tRPC's self-describing router — the API surface documents itself through its types.

---

## Revised recommendation

The research **strengthens** Approach A and adds a refinement:

**Original A:** Typed Manifest + Custom Scan Script + COAT Endpoint

**Refined A:** Typed Manifest + ts-arch Tests + Lightweight Metrics Script + COAT Endpoint

The refinement:
1. **`MODULE_MANIFEST`** stays as designed — `as const satisfies` typed constant
2. **Boundary enforcement** uses ts-arch (mature, test-suite integration) instead of a custom import walker
3. **Metrics** (file size, function length, orphan exports) use a lightweight script that reads the TS compiler API — simpler than ts-morph, Bun-native
4. **COAT endpoint** aggregates both boundary and metrics results

This splits "scan script" into two concerns: boundaries (ts-arch, well-solved) and metrics (custom, lightweight).

---

## Sources

- ts-arch: https://github.com/ts-arch/ts-arch
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser
- ts-morph: https://ts-morph.com / https://github.com/dsherret/ts-morph
- Nx module boundaries: https://nx.dev/features/enforce-module-boundaries
- eslint-plugin-boundaries: https://github.com/javierbrea/eslint-plugin-boundaries
- typia: https://github.com/samchon/typia (runtime types from TS types, no schema)
- Zod: https://zod.dev
- tRPC: https://trpc.io
- Living Documentation: Cyrille Martraire, Addison-Wesley, 2019
- Building Evolutionary Architectures: Neal Ford et al., O'Reilly, 2017
- TypeScript 5.0 decorators: Stage 3 proposal, Symbol.metadata
- reflect-metadata: https://github.com/rbuckton/reflect-metadata
