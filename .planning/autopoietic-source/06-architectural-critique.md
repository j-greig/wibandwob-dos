# Architectural Critique — Autopoietic Source Plan

A constructive review of our own work, applying the 30 CODE-STYLE principles to the planning itself, with the mindset of a system architect who's seen self-documenting-codebase projects fail.

---

## The honest assessment

The vision is beautiful. The three-level model is elegant. But **the plan is too timid and doesn't use half of what we researched.**

Let me be specific.

---

## Critique 1: We researched tRPC and Zod but ignored their deepest lesson

The research found that tRPC makes APIs self-documenting by making `typeof appRouter` the entire API spec. Zod makes schemas self-documenting because `UserSchema.shape` is introspectable at runtime.

Our plan? A hand-written `MODULE_MANIFEST` constant that a human maintains.

**That's not autopoietic. That's a config file with a fancy type.**

The Martraire principle we cited says: "Most of the knowledge we need is already in the artifacts we produce. We just need to exploit it." The imports are already in the source files. The function lengths are already in the AST. The export surface is already in the module declarations. The boundary violations are already detectable from the import graph.

**What's actually autopoietic:** A script that reads the source and *derives* the manifest, then compares it to the *declared* intent. The declared intent (what the architecture SHOULD be) is the small typed constant. The actual state (what the architecture IS) is computed. The delta between them is the signal.

We got this half right. The scan script derives metrics. But we're asking humans to maintain the boundary definitions in `MODULE_MANIFEST` AND maintain `ARCHITECTURE.md` AND maintain the scan script. That's three things describing the same reality. **Principle 6: Say Things Once.**

### What we should do instead

`MODULE_MANIFEST` should be the *only* place boundaries are declared. ARCHITECTURE.md should be *generated from it* — or at minimum, ARCHITECTURE.md's module boundary section should just say "see `MODULE_MANIFEST`." The scan script reads the manifest AND the source, and the output is the full picture.

One source of intent (manifest). One source of reality (AST). One tool that compares them (scan). That's it.

---

## Critique 2: We recommended ts-arch but didn't think about what we already have

The research refined our recommendation to use ts-arch for boundary enforcement. But look at what's already in the codebase:

```
bun run check-coat
```

This already exists. It already validates COAT boundary violations. We're proposing to add ANOTHER boundary checker (ts-arch) alongside it. **That's two tools checking two different sets of boundaries with two different mechanisms.**

**Principle 22: Explicit Collaboration Interfaces** — when two systems collaborate, make the interface explicit. Our scan script and check-coat should be ONE tool, not two.

### What we should do instead

Extend `check-coat` to also read `MODULE_MANIFEST` and validate import boundaries. One command, one result, one COAT endpoint. Don't add ts-arch as a dependency when we can extend the tool we already have.

Or — if ts-arch is genuinely better at import analysis than a custom script — replace `check-coat` with ts-arch configured to read the manifest. Don't run both.

---

## Critique 3: The vision describes Level 3 but the plan only builds Level 2

The three-level model is the best idea in the entire plan:

```
Level 1: RUNTIME  → describeState()   → GET /state
Level 2: SOURCE   → MODULE_MANIFEST   → GET /code-health
Level 3: EVOLUTION → describeChange() → GET /changes
```

But we only plan to build Level 2. Level 3 is "future." That's a cop-out.

Level 3 is where the compound value lives. Without it:
- You see that `app-controller.ts` is 2525 LOC, but you don't know if it was 3000 last week (improving) or 2000 (getting worse)
- You see 0 boundary violations today, but you don't know if someone snuck one in and reverted it
- You know the current state, but not the trajectory

**And Level 3 is trivial to implement.** You just persist the code-health JSON output as a timestamped snapshot (one file per run) and diff current vs. previous. That's 20 lines of code. The compound value is enormous.

### What we should do instead

Build Level 3 from day one. `wibwob code-health --diff` compares current to last snapshot. Store snapshots in `.code-health/` (gitignored). The trajectory is visible immediately.

---

## Critique 4: We're not being creative enough with what TypeScript gives us

The research dug deep into discriminated unions, branded types, `as const satisfies`, template literal types. Our plan uses... `as const satisfies` for the manifest. That's it.

Here's what we're leaving on the table:

**Branded module paths.** Instead of checking import boundaries with a runtime script, what if the module paths themselves carried type information?

```typescript
// Types that only exist at compile time
type CoreModule = string & { __layer: "core" };
type SdkModule = string & { __layer: "sdk" };

// Factory that brands a path at the type level
function coreImport<T>(path: CoreModule): T { ... }
```

This is probably too clever (Principle 3: Replace Comments with Clear Code applies to types too). But the point is: we researched branded types and template literal types and then didn't use them. Either cut the research or use the findings.

**More practically:** the `ModuleBoundary` type in the manifest should use template literal types to constrain the `mayImportFrom` field:

```typescript
type ModuleId = keyof typeof MODULE_MANIFEST;
type ModuleBoundary = {
  boundary: string;
  mayImportFrom: readonly ModuleId[];  // Can only reference modules that exist
  description: string;
};
```

This way, if someone adds a typo to `mayImportFrom` (e.g., "servics"), the compiler catches it. The manifest is self-validating at the type level.

---

## Critique 5: We dismissed Approach B too quickly

We rejected per-module `_meta.ts` files because "13 new files is bloat" and "handwritten exports will drift."

But the second criticism applies equally to `MODULE_MANIFEST` — handwritten boundaries can drift too. And the first criticism (file bloat) is context-dependent. 13 files across 150 is 8.7%. That's noise, not bloat.

The real insight from Approach B that we should steal: **co-location of metadata with the code it describes.** Not the whole approach, but the principle.

### What we should do instead

Steal the best of B: each directory gets a one-line comment at the top of its barrel file (or main file) that references its manifest entry. Not a separate file — just a single JSDoc tag:

```typescript
/** @module core — see MODULE_MANIFEST["core"] */
```

This costs nothing, drifts rarely (it's one word), and creates a breadcrumb for anyone reading the code.

Actually, even better — the scan script can CHECK that each directory has this tag and that it matches the manifest. Now even the breadcrumb is validated.

---

## Critique 6: The COAT endpoint is backwards

We proposed `GET /code-health` as a new endpoint in `control-api.ts`. But `control-api.ts` is already 1230 LOC and one of our refactor targets. Adding more to it violates the refactor plan.

Also — `code-health` is a build-time / static analysis concept. Putting it in the *runtime* API means you need a running TUI instance to check code health. That's wrong. You should be able to check code health in CI, in a cold repo, without starting the TUI.

### What we should do instead

`wibwob code-health` should be a standalone CLI command that works without a running instance — like `wibwob --help` or `wibwob health` does instance discovery. It reads the filesystem and runs analysis.

The COAT endpoint (`GET /code-health`) should exist too, but it calls the same underlying function. Not the other way around. **The CLI is primary, the API is the adapter.** This is COAT: Command Once, Adapt Thin. The command is the analysis. The API is one thin adapter.

---

## Critique 7: dependency-cruiser was dismissed too fast

We dismissed dependency-cruiser because "its rules live in config, not source." But we can fix that.

What if `dependency-cruiser`'s config is *generated from* `MODULE_MANIFEST`? A 15-line script reads the manifest and writes `.dependency-cruiser.js`. Now:
- The manifest is the single source of truth (Principle 6)
- dependency-cruiser does the actual import analysis (mature, production-proven, visual dependency graphs for free)
- We get SVG/DOT dependency visualisation with zero custom code
- The config can't drift because it's generated

This is the tRPC insight applied to tooling: **generate the config from the typed source of truth.** Don't maintain two things.

---

## The revised recommendation

After applying the critique:

| # | Change | Principle applied |
|---|--------|-------------------|
| 1 | `MODULE_MANIFEST` stays, but `mayImportFrom` uses `ModuleId` type constraint so invalid references are compile errors | P6 (DRY), P29 (Type Narrowing) |
| 2 | Generate `.dependency-cruiser.js` from manifest instead of writing custom import analysis | P14 (Compose), P6 (Say Once) |
| 3 | Extend existing `check-coat` to also validate module boundaries, don't add a separate tool | P5 (Single Responsibility... of the developer's workflow) |
| 4 | `wibwob code-health` is a standalone CLI command, not a runtime API first | COAT principle applied correctly |
| 5 | Build Level 3 (evolution tracking) from day one — persist snapshots, diff on demand | P26 but inverted: sometimes you should be aggressive, not incremental |
| 6 | ARCHITECTURE.md's boundary section becomes a pointer to `MODULE_MANIFEST`, not a parallel document | P6 (Say Once) |
| 7 | Scan script validates that each directory's main file references its manifest entry | Drift prevention via validation loop |

### What this gains over the original plan

- **dependency-cruiser** gives us visual dependency graphs, circular dependency detection, and orphan detection FOR FREE. We researched it but then proposed writing a custom scanner. That's rebuilding what exists.
- **Level 3 from day one** means the system shows trajectory, not just state. An agent can see "this file is getting worse" not just "this file is big."
- **One boundary tool, not two** — `check-coat` plus manifest, not `check-coat` plus ts-arch plus manifest.
- **The manifest self-validates** at the type level. A typo in boundary rules is a compile error, not a runtime surprise.
- **CLI-first, API-second** correctly applies the COAT principle that the plan originally stated but then violated.

### What this costs

- dependency-cruiser is a real dependency (~5MB, well-maintained, MIT). This codebase avoids deps. But it's a tool dependency (dev), not a runtime one. And it replaces writing ~200 lines of custom import analysis code that would be worse.
- The config generation script is ~15 lines. The manifest type constraint is ~5 lines. Level 3 snapshot persistence is ~20 lines. Net code is less than the original plan.

---

## The real question we haven't asked

All of this is infrastructure. It makes the codebase describable. But does it make the codebase *better*?

The autopoietic loop only closes if something ACTS on the information. The scan reports violations. Who fixes them? The plan says the `/refactor` prompt consumes the report. But that prompt doesn't exist yet. And an agent won't invoke it unless something tells it to.

**The truly aggressive version:** `wibwob code-health` runs as a pre-commit hook. If the commit makes things worse (new violations, bigger functions, broken boundaries), it warns. Not blocks — warns. The warning includes the specific principle violated and the specific file/function. The agent (or human) sees it at the moment they can act.

That closes the loop. The system doesn't just describe itself. It nudges itself toward health.

---

## Summary: what changes

| Original plan | Revised after critique |
|---------------|----------------------|
| Custom import analysis script | dependency-cruiser with generated config |
| ts-arch for boundary tests | Extend `check-coat` instead |
| `GET /code-health` as primary | CLI-first, API adapts |
| Level 3 "future" | Level 3 from day one |
| `MODULE_MANIFEST` with string arrays | `MODULE_MANIFEST` with `ModuleId` type constraints |
| ARCHITECTURE.md parallel to manifest | ARCHITECTURE.md points to manifest |
| Passive reporting | Pre-commit health warning |

---

## Second adversarial pass — resolving tensions in this critique

This critique was itself reviewed for internal tensions. Four were found and resolved:

### Tension 1: dependency-cruiser recommendation vs zero-dep philosophy
**This critique said:** Use dependency-cruiser with generated config.
**Second pass found:** `madge` is already in the toolchain (`bun run health` uses `npx madge --circular`). dep-cruiser overlaps with madge on circular deps and graph generation. check-coat already does boundary enforcement.
**Resolution:** Don't add dependency-cruiser. Extend check-coat (~50-80 LOC) + keep madge. Zero new deps.

### Tension 2: "Extend check-coat" vs "use ts-arch" (contradictory recommendations)
**This critique said:** Both "extend check-coat" (Critique 2) and implicitly endorsed ts-arch (from research doc).
**Second pass found:** check-coat's string-matching approach already works for microapp boundaries. Same pattern handles src/ subdirectory boundaries. ts-arch would be a new dep for the same capability.
**Resolution:** Extend check-coat. One tool, one command, already Bun-native.

### Tension 3: Level 3 "trivial — 20 lines" estimate
**This critique said:** Level 3 is 20 lines of code.
**Second pass found:** Persist JSON (5 LOC) + read previous (5 LOC) + semantic diff, not JSON diff (50-80 LOC) + format output (20 LOC) = ~80-100 LOC.
**Resolution:** Still worth building day one. Corrected estimate in vision and summary docs.

### Tension 4: Pre-commit hook warns-not-blocks + performance concern
**This critique said:** Warns-not-blocks.
**Second pass found:** Running analysis on 150 files in a pre-commit hook could be slow (>2s). Blocking would lead to `--no-verify` muscle memory.
**Resolution:** Scope to changed files only (`git diff --name-only`). Keep warns-not-blocks. If still slow, relegate to parking lot.

All resolved decisions have been propagated to 02-vision.md, 03-candidates-and-ranking.md, 04-summary.md. Relegated ideas collected in 07-parking-lot.md.
