# Devil's Advocate — Do We Need Any of This?

> Third adversarial pass. This time the attack is existential: what if the infrastructure plan is compensation for code that should just be better?

---

## The challenge

The autopoietic source plan proposes ~350-450 LOC of infrastructure to monitor code quality. But CODE-STYLE P3 says: "Replace Comments with Clear Code." The meta-version:

**Replace monitoring infrastructure with code that doesn't need monitoring.**

If `app-controller.ts` is 2525 LOC and needs a scan to tell you it's too big — the problem isn't the lack of a scan. The problem is that it's 2525 LOC. A scan that reports "15 functions over 100 LOC" is a thermometer, not a cure.

### Every planned artifact is a confession

| Planned artifact | What it compensates for |
|-----------------|------------------------|
| MODULE_MANIFEST boundary rules | Imports that aren't obviously correct from reading the code |
| check-coat boundary enforcement | Developers who don't know which module they're in |
| `wibwob code-health` metrics | Files that don't communicate their own size/complexity through structure |
| Level 3 trajectory tracking | Lack of discipline in keeping things small as you go |
| Pre-commit health warnings | Code review not catching structural decay |
| `@module` JSDoc tags | Directory names that don't speak for themselves |

---

## The pure-principles alternative

### Make violations structurally impossible, not detectable

**Barrel-file discipline:** Each `src/` subdirectory has an `index.ts` that re-exports its public surface. You import from `../services`, not `../services/control-api`. The barrel IS the boundary. No manifest needed.

```typescript
// src/services/index.ts — THE boundary definition
export { StateService } from "./state-service.ts";
export { MicroappSdk } from "./microapp-sdk.ts";
// control-api is NOT exported — it's internal to services
```

**Small-file discipline:** Every file has a one-sentence purpose statement on line 1. If you can't write the sentence, the file does too much. No scanner required.

**Typed-constant discipline:** Discriminated unions carry architectural intent through the type system. An agent reads the types to understand the module.

---

## Why pure principles alone isn't enough (counter-attack)

1. **"Write better code" is not a mechanism.** The 30 principles already exist. The codebase already has 6 files over 500 LOC and a 681-LOC function. Principles didn't prevent that. Saying "follow harder" is aspirational, not enforceable.

2. **Barrel files don't enforce, they suggest.** In TypeScript, every `.ts` file is importable by any other. There's no module-level access control. Barrel files are a convention, and conventions drift without enforcement — especially when agents write code at 3am.

3. **The thermometer IS the cure if it's in a feedback loop.** Observe → Signal → Act → Verify. Without step 1, you can't have step 3.

4. **Small files require knowing HOW to decompose.** The refactor plan's Tier 1 analysis took serious architectural thinking. Without a health check that says "this file is over budget," the decomposition impulse doesn't trigger.

5. **Agents need machine-readable structure.** A human reads barrel files and understands boundaries. An agent needs a typed constant to know where code belongs.

---

## Synthesis — what's actually true

### The devil's case is half right

1. **The refactor IS the primary work.** Building MODULE_MANIFEST and code-health without decomposing `app-controller.ts` is building a dashboard for a burning building.

2. **Barrel files should be the primary boundary mechanism.** MODULE_MANIFEST should DESCRIBE the barrel-file convention, not replace it.

3. **Type-level self-documentation is underused.** The plan should invest more in making types self-describing and less in building scanners.

4. **The plan over-indexes on detection vs prevention.** ~400 LOC of monitoring vs ~3000-4000 LOC of actual refactoring? The ratio should be inverted.

### The devil's case is half wrong

1. **You need SOME feedback loop.** Principles without enforcement decay. Even 50 lines in check-coat is worth more than 5000 words of guidelines.

2. **Trajectory requires measurement.** You cannot know if the codebase is improving without snapshots.

3. **Agents need MODULE_MANIFEST.** Machine-readable architectural metadata is not optional for agent-assisted development.

---

## Decision: revised priority order

| Priority | Action | LOC | Why first |
|----------|--------|-----|-----------|
| **1st** | **Refactor the code.** Decompose Tier 1 files. Establish barrel-file boundaries. Make the code follow the 30 principles. | ~3000-4000 | The thermometer is useless while the building is on fire |
| **2nd** | **Write MODULE_MANIFEST** — describe the barrel-file convention as a typed constant. | ~40 | Agent-readable architecture. Trivial to write post-refactor. |
| **3rd** | **Add one check-coat check** — validate that src/ imports go through barrel files. | ~50 | Enforce the convention the refactor established. |
| **4th** | **Add code-health snapshot** — file sizes, function sizes, boundary violations as JSON. | ~100 | Trajectory tracking. Now the thermometer measures a healthy patient. |
| **Defer** | COAT endpoint, pre-commit hook, `@module` tags, CLI command | 0 | Only build if the ~190 LOC above proves insufficient. |

**Infrastructure halved from ~400 LOC to ~190 LOC. Refactoring comes first.**
