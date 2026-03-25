# The Autopoietic Codebase — Vision

## What already exists

WibWob-DOS has the seed of this idea. It just hasn't grown it to its logical conclusion.

**Today:**
- Every window exposes `describeState()` → agents can read live semantic state
- `state-service.ts` aggregates all window states → `GET /state` exposes the full desktop
- `@public`/`@beta`/`@internal` stability tiers exist in the SDK
- `command-catalog.ts` is the single source of truth for all commands
- `PHILOSOPHY.md` names the goal: "autopoietic homoiconicity"

**The gap:** These mechanisms describe the *runtime* (what windows are open, what state they hold). Nothing describes the *source* (what modules exist, what they export, how they depend on each other, what architectural boundaries they respect). The runtime knows itself. The codebase doesn't.

---

## The future codebase

Imagine opening a terminal and typing:

```
wibwob architecture
```

And getting back — not a stale markdown file — but a live, type-checked architectural map generated *from the source itself*:

```
src/core/         shell — composition root, 4 seams
  ├─ app-controller.ts    ■■■■■■■■░░ 2525 LOC  [over budget: 15 fns > 100 LOC]
  ├─ command-catalog.ts   ■■■■■░░░░░ 1417 LOC  [healthy]
  ├─ window-manager.ts    ■■■░░░░░░░  863 LOC  [healthy]
  └─ ... 48 more files

src/services/     capabilities — shared by shell + microapps
  ├─ control-api.ts       ■■■■■░░░░░ 1230 LOC  [1 fn over budget: handleRequest 680 LOC]
  └─ ... 40 more files

Boundary violations: 0
SDK surface: 23 @public, 4 @beta, 7 @internal
Orphan exports: 3 (unused outside their module)
```

This isn't documentation. It's the codebase *describing itself*, computed from the AST on every invocation.

### Principle: The map IS the territory

The key insight is that TypeScript's type system is already expressive enough to carry architectural intent. We just don't use it that way. Consider:

**Today** — architectural boundaries are conventions documented in ARCHITECTURE.md:
> "Microapps import only from `microapp-sdk.ts`"

**Tomorrow** — architectural boundaries are types that the compiler enforces:

```typescript
// src/core/module-manifest.ts
export const MODULE_MANIFEST = {
  "core": {
    boundary: "shell",
    mayImportFrom: ["core"],
    description: "Runtime composition root. Owns the four seams.",
  },
  "services": {
    boundary: "shared",
    mayImportFrom: ["core", "services", "domain"],
    description: "Capabilities shared by shell and microapps.",
  },
  "sdk": {
    boundary: "sdk-surface",
    mayImportFrom: ["sdk", "ui"],
    description: "The only import path for microapp authors.",
  },
  "windows": {
    boundary: "consumer",
    mayImportFrom: ["core", "services", "sdk", "ui"],
    description: "Window implementations. Each is a COAT consumer.",
  },
  "ui": {
    boundary: "design-system",
    mayImportFrom: ["ui"],
    description: "Terminal component library. Not for microapp authors directly.",
  },
} as const satisfies Record<string, ModuleBoundary>;
```

This manifest is:
1. **Source code** — it lives in `src/`, versioned, reviewed, type-checked
2. **The single source of truth** for what the architecture IS
3. **Machine-readable** — a boundary-checking script reads it, not a human
4. **Self-documenting** — the descriptions ARE the architecture docs
5. **Enforceable** — `bun run check-boundaries` validates every import against it

### What changes in daily work

**An agent starting a session** reads `MODULE_MANIFEST` (a typed constant) instead of parsing ARCHITECTURE.md prose. It knows instantly what it can import and where its code belongs.

**A developer adding a file** to `src/services/` gets a type error if they import from `src/windows/` — the boundary check catches it at typecheck time, not code review time.

**A code health check** runs on every commit:
```
$ wibwob code-health
  Files over budget (>500 LOC):    6  (was 8 last week)
  Functions over budget (>100 LOC): 4  (was 7 last week)
  Boundary violations:             0
  Orphan exports:                  2
  Missing describeState:           0
  Missing onCleanup:               1  ← terrain-lab-window.ts
```

This is not a linter. It's the codebase reporting on itself through the same COAT channel that everything else uses — a JSON API response at `GET /code-health`.

### The three levels of self-knowledge

```
Level 1: RUNTIME (exists today)
  describeState() → what windows are open, what they show
  GET /state → live desktop snapshot
  wibwob health → instance health

Level 2: SOURCE (this vision)
  MODULE_MANIFEST → what modules exist, their boundaries
  code-health scan → file/function metrics, boundary violations
  GET /code-health → live codebase snapshot
  wibwob architecture → structural map

Level 3: EVOLUTION (future)
  describeChange() → what changed since last commit, which principles affected
  drift detection → MODULE_MANIFEST vs actual imports
  quality trend → is the codebase getting better or worse over time?
```

### Why this is autopoietic

The system maintains itself by reading itself:

1. `MODULE_MANIFEST` defines boundaries → `check-boundaries` reads it → violations are caught → boundaries are maintained
2. `describeState()` exposes window state → `state-service` reads it → agents consume it → agents fix missing hooks → the contract is maintained
3. `code-health` scans source → reports violations → `/refactor` prompt consumes the report → violations are fixed → the codebase maintains itself

The documentation doesn't describe the system from outside. It IS the system, looking at itself.

---

## What this is NOT

- Not TypeDoc / JSDoc generation (those produce separate artifacts that drift)
- Not a dashboard microapp (though one could consume this data)
- Not a linter (linters say "this line is wrong"; this says "this module's role in the architecture is X")
- Not a framework (no decorators to learn, no base classes to extend)

It's a **typed constant** (`MODULE_MANIFEST`) + a **scan script** (`code-health`) + a **COAT endpoint** (`GET /code-health`). Three artifacts. The codebase already has the patterns — `command-catalog.ts` is a typed constant that describes all commands. `describeState()` is a runtime self-description hook. This extends both patterns from runtime to source.
