# Enhanced Prompt

## What the original asks for

A vision of a future WibWob-DOS codebase where documentation is not a separate artifact that drifts from code, but an intrinsic property of the source itself — TypeScript-native, deeply integrated, and autopoietic (the system maintains itself by reading itself).

## Constraints from prior work this session

- PHILOSOPHY.md already names this: "autopoietic homoiconicity — a system whose documentation is its infrastructure"
- COAT already requires every window to expose `describeState()` — this is a partial implementation of the idea
- CODE-STYLE.md (30 principles) exists as a reference doc — but it's passive, not woven into the type system
- The codebase has ~150 TypeScript files, ~45k LOC, and significant structural debt

## What I'm sharpening

The original prompt asks to "paint a picture" — but a vision without mechanism is just wishful thinking. The enhanced version asks:

1. **What would it concretely mean** for the TypeScript source to be self-documenting at the module/function/type level? Not README generation — the code itself carries structural metadata through the type system and runtime introspection.

2. **What TypeScript mechanisms exist** (or could exist) to make this real? Decorators, branded types, module-level metadata exports, const assertions, satisfies constraints, template literal types for naming conventions?

3. **How does this compound with COAT?** COAT already says "every user-visible surface has a typed representation in state." What if every *developer-visible* surface (module, service, architectural boundary) also had a typed representation?

4. **What are the plausible approaches?** Rank them by: implementation cost, drift resistance (how much does it self-maintain?), developer friction (does it slow you down or speed you up?), and composability with existing patterns.

5. **Adversarial pass:** For each approach, ask — does this actually prevent the problems we saw (1800-LOC functions, god objects, duplication), or does it just describe them more elegantly? Self-documenting code that documents bad code is not the goal.

## Execution shape

- Phase 1: Research — what has been tried? (TypeScript metadata patterns, runtime introspection, architectural fitness functions, ArchUnit-style approaches, ts-morph, TypeDoc programmatic API)
- Phase 2: Vision — paint the picture of the future codebase with concrete examples
- Phase 3: Candidates — name 4-6 plausible implementation approaches
- Phase 4: Adversarial ranking — challenge each, rank, recommend one
- Phase 5: Output — write findings to `.planning/autopoietic-source/`
