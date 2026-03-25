# The Autopoietic Codebase — Vision

> Revised after architectural critique (06) and second adversarial pass.

## What already exists

WibWob-DOS has the seed of this idea. It just hasn't grown it to its logical conclusion.

**Today:**
- Every window exposes `describeState()` → agents can read live semantic state
- `state-service.ts` aggregates all window states → `GET /state` exposes the full desktop
- `@public`/`@beta`/`@internal` stability tiers exist in the SDK
- `command-catalog.ts` is the single source of truth for all commands
- `PHILOSOPHY.md` names the goal: "autopoietic homoiconicity"
- `check-coat` already enforces microapp → SDK import boundaries (7 checks, 400 LOC)
- `madge --circular` already detects circular dependencies in `bun run health`

**The gap:** These mechanisms describe the *runtime* (what windows are open, what state they hold). Nothing describes the *source* (what modules exist, what they export, how they depend on each other, what architectural boundaries they respect). The runtime knows itself. The codebase doesn't.

---

## The future codebase

### Principle: One source of intent, one source of reality, one tool that compares them

The Martraire insight: "Most of the knowledge we need is already in the artifacts we produce." The imports are already in the source files. The function lengths are already in the AST. The boundaries are already implicit in the directory structure. We just need to:

1. **Declare intent** — a typed `MODULE_MANIFEST` constant says what the architecture SHOULD be
2. **Derive reality** — a scan reads what the architecture IS (from source)
3. **Report the delta** — the difference between 1 and 2 is the signal

This is not a config file with a fancy type. It's the tRPC/Zod pattern applied to architecture: the typed constant IS the spec, and everything else is derived.

### MODULE_MANIFEST — the single source of architectural truth

```typescript
// src/core/module-manifest.ts

type ModuleId = keyof typeof MODULE_MANIFEST;

type ModuleBoundary = {
  boundary: string;
  mayImportFrom: readonly ModuleId[];  // compile-time validated — typos are errors
  description: string;
};

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

The `ModuleId` type constraint means `mayImportFrom: ["servics"]` is a compile error. The manifest self-validates at the type level. (Critique 4 — use what TS gives us.)

### What changes in daily work

**An agent starting a session** reads `MODULE_MANIFEST` (a typed constant) instead of parsing ARCHITECTURE.md prose. It knows instantly what it can import and where its code belongs.

**A developer adding a file** to `src/services/` gets a boundary violation warning if they import from `src/windows/` — caught by `check-coat`, not at code review time.

**A code health check** runs as a CLI command that works without a running instance:

```
$ wibwob code-health
  Files over budget (>500 LOC):    6  (was 8 last week ↓)
  Functions over budget (>100 LOC): 4  (was 7 last week ↓)
  Boundary violations:             0
  Orphan exports:                  2
  Missing describeState:           0
  Missing onCleanup:               1  ← terrain-lab-window.ts
  Trajectory:                      improving (3 of 5 metrics better)
```

Note: **CLI-first, API adapts.** The command is the analysis function. `GET /code-health` calls the same function. You can check code health in CI, in a cold repo, without starting the TUI. This is COAT applied correctly: Command Once, Adapt Thin. (Critique 6.)

### The three levels of self-knowledge

```
Level 1: RUNTIME (exists today)
  describeState() → what windows are open, what they show
  GET /state → live desktop snapshot
  wibwob health → instance health

Level 2: SOURCE (this vision)
  MODULE_MANIFEST → what modules exist, their boundaries
  check-coat + code-health → file/function metrics, boundary violations
  wibwob code-health → structural report (CLI-first)
  GET /code-health → same data, COAT adapter

Level 3: EVOLUTION (built from day one)
  Snapshot persistence → .code-health/ (gitignored) stores timestamped JSON
  wibwob code-health --diff → current vs last snapshot
  Trajectory → "this file is getting worse" not just "this file is big"
```

Level 3 is not "future." It's ~80-100 lines: persist snapshot JSON, read previous, compute semantic diff, format output. The compound value is enormous — an agent sees trajectory, not just state. (Critique 3, with corrected estimate.)

### ARCHITECTURE.md becomes a pointer

The boundary section of ARCHITECTURE.md becomes:

> Module boundaries are defined in `MODULE_MANIFEST` (`src/core/module-manifest.ts`) and enforced by `check-coat`. See the manifest for the current boundary rules.

One source of truth. Not two parallel documents. (Critique 1 — Say Things Once.)

### Why this is autopoietic

The system maintains itself by reading itself:

1. `MODULE_MANIFEST` defines boundaries → `check-coat` reads it → violations are caught → boundaries are maintained
2. `describeState()` exposes window state → `state-service` reads it → agents consume it → agents fix missing hooks → the contract is maintained
3. `code-health` scans source → reports metrics + trajectory → `/refactor` prompt consumes the report → violations are fixed → the codebase maintains itself
4. Pre-commit hook runs `code-health --changed` → warns (not blocks) if commit makes things worse → developer sees the principle violated at the moment they can act

The documentation doesn't describe the system from outside. It IS the system, looking at itself.

---

## What this is NOT

- Not TypeDoc / JSDoc generation (those produce separate artifacts that drift)
- Not a dashboard microapp (though one could consume this data)
- Not a linter (linters say "this line is wrong"; this says "this module's role in the architecture is X")
- Not a framework (no decorators to learn, no base classes to extend)
- Not a new dependency (extends check-coat + madge already in toolchain)

It's a **typed constant** (`MODULE_MANIFEST`) + an **extended check-coat** + a **CLI command** (`wibwob code-health`) + a **COAT endpoint** (`GET /code-health`). The codebase already has every pattern needed — `command-catalog.ts` is a typed constant, `describeState()` is runtime self-description, `check-coat` is boundary enforcement. This extends them from runtime to source.
