# Code Quality Best Practices — TypeScript Edition

> These principles operate within the constraints of [`PHILOSOPHY.md`](PHILOSOPHY.md) (decision filters, SDK contract) and [`ARCHITECTURE.md`](ARCHITECTURE.md) (COAT, shell invariants).

30 principles for TypeScript codebases. The first 26 are adapted from Kent Beck's *Smalltalk Best Practice Patterns*, rewritten for TypeScript's type system, structural typing, runtime boundaries, and modern toolchain realities. The last 4 are TypeScript-native principles.

This version is tuned for **WibWob-DOS**: a small, legible, terminal-native host with thin adapters, explicit seams, agent-readable state, and composition over framework sprawl.

**Prerequisite:** `strict: true` in `tsconfig.json`. Also treat type-checking as a distinct correctness gate in CI. Modern runtimes and bundlers can execute or transpile TypeScript without actually checking it.

---

## 1. Composed Method

In WibWob-DOS terms: **services own logic, windows own wiring**.

Divide every function into sub-functions that each perform one identifiable task. Keep all operations at the same level of abstraction. The body should read as a sequence of named intentions, not a pile of mixed detail.

If one function is discovering files, mutating state, styling widgets, and binding keys, it is already at the wrong abstraction level.

This also tends to produce more testable code. Small functions with clear inputs and outputs are easier to verify than large closures full of hidden setup and mixed concerns.

## 2. Intention-Revealing Names

Name functions after what they accomplish, never how they accomplish it. A reader should understand the purpose of a call without reading its body.

Prefer names that expose the domain role clearly: `restoreWorkspace`, `describeState`, `applyThemeToChrome`, `runCommandById`.

## 3. Replace Comments with Clear Code

If a comment restates what the code does, delete it. If you can't delete a comment, refactor the code until the comment becomes redundant.

Reserve comments for one of four things only:

* why a decision exists
* an external constraint
* a non-obvious invariant
* a deliberate trade-off

Type annotations, discriminants, and function names should carry most of the "what".

## 4. Constructor Clarity

Provide factory functions or typed constructors that produce fully-formed values. Never expose half-built values as a public creation style.

Avoid returning `Partial<T>` from creation APIs. Internally, `Partial<T>` may be useful during assembly. Externally, it weakens the contract and leaks construction order.

For host systems, prefer factories that encode invariants once: `createWindowHandle`, `createThemeTokens`, `createCommandRegistry`.

## 5. Single Responsibility for Methods

Each function should have one reason to change. If a function needs a paragraph to explain, split it.

A good test: when a bug appears, can you name one concept that owns the fix? If not, the function is mixing responsibilities.

## 6. Say Things Once and Only Once

Every piece of knowledge should exist in exactly one place: at the value level, type level, or behavior level.

Use TypeScript to derive types from real values instead of duplicating shape definitions by hand. Prefer `typeof`, `ReturnType`, `Parameters`, indexed access types, and utility types over manually mirrored declarations.

This rule also applies at the architectural level.

In WibWob-DOS, **the command catalog is the source of truth**, not a second copy in API glue, menus, docs, or agent tooling.

## 7. Behavior Over State

Get the behavior right first. Internal representation can change later if it stays hidden behind a stable interface.

Structural typing amplifies this principle. Consumers depend on shape and capability, not lineage. Design the public seam first; optimize storage later.

## 8. Intention-Revealing Function Names

Name functions after the concept they represent, not the algorithm they use. `focusWindow`, `captureText`, and `persistWorkspace` are better than `walkWindowList`, `stringifyBox`, or `saveJsonToDisk` when the higher-level concept is what matters.

If a different implementation would require a different name, the current name is too coupled to mechanism.

## 9. Guard Clauses Over Deep Nesting

Handle edge cases and invalid states at the top and return early. The main path should read left-to-right without excessive indentation.

This is especially strong in TypeScript because guard clauses improve narrowing. An early return removes uncertainty from the rest of the function and reduces assertion pressure.

## 10. Query Methods Return; Commands Mutate

Separate functions that answer questions from functions that change state.

Queries should be safe to call repeatedly and should not surprise the caller with side effects. Commands should mutate deliberately and be named as actions.

In a shared human/agent runtime, this boundary matters even more. If a method both inspects and mutates, automation becomes harder to trust.

## 11. Explaining Variables

When an expression is hard to read, assign it to a well-named local. The local name becomes the explanation.

This is not about adding temporary clutter. It is about naming an intermediate concept once so the reader does not need to re-parse the expression mentally.

## 12. Role-Suggesting Names

Name variables after the role they play, not their type. `theme`, `layout`, `command`, `summary`, `selection`, `snapshot` are better than `themeObject`, `layoutData`, `commandArray`, or `summaryString`.

TypeScript already carries type information. Repeating it in names adds noise.

## 13. Discriminated Unions Over Repeated Conditionals

When the same `if` or `switch` pattern appears in many places, eliminate it.

In TypeScript app code, prefer discriminated unions with exhaustive switches when modeling evolving states and message shapes.

In this codebase, class polymorphism is rare and should stay that way. Reach for it only when object lifecycle and encapsulated behavior genuinely justify it.

For WibWob-DOS, state machines, command results, load states, theme modes, and window kinds should usually be modeled as explicit unions rather than boolean soup.

## 14. Compose, Don't Inherit

Share behavior by composing functions, strategies, small helpers, and collaborator values. Avoid subclass trees.

Composition fits TypeScript's structural system, keeps seams thin, and aligns with the host philosophy: **small stable surfaces, mutable implementation**.

If a new variant only swaps one or two behaviors, it does not need a subclass.

## 15. Extract Complex Logic into Dedicated Units

When a function grows large because it juggles too many temporaries or stages, extract the computation into a dedicated unit.

In WibWob-DOS, that usually means a module-level function or a focused service. Services are the normal home for extracted logic that needs a named owner or a stable seam. Introduce a new class only when there is real lifecycle, identity, or evolving internal state to manage.

Parsing, measuring, discovering, transforming, persisting, and aggregating belong in services or dedicated functions, not inside windows.

## 16. Resource Bracketing

When two actions must always happen together, make that pairing explicit in code.

Use `using` / `await using` when your runtime and target support explicit resource management cleanly. Otherwise, use `try/finally` or a callback wrapper that guarantees cleanup.

The caller should never have to remember the second half manually.

## 17. Explicit Initialization

Initialize required state at construction time. Make illegal states impossible to create.

Avoid post-construction setup phases for public values. If something is required, require it now.

This applies equally to class fields, factory outputs, and semantic state returned from adapters. A window description that might or might not have a `summary` is not explicit enough.

## 18. Lazy Initialization

When a value is expensive and may not be needed, defer it to first access. Use lazy initialization deliberately, not as a substitute for uncertain ownership.

`??=` is the normal form when caching a stable derived value.

Do not use laziness to hide an ownership problem. If a value is lazy only because nobody knows which module or service should create it, fix the ownership first. Lazy values still need a clear owner and reset story.

## 19. Named Constants Over Magic Literals

Replace unexplained literals with named constants.

Prefer `as const` objects with derived union types over enums for most application code. Use `satisfies` to validate shape without widening.

Good constants explain domain meaning: command IDs, theme names, layout bounds, animation ceilings, file roots, default retry counts.

## 20. Start with Plain Fields

Do not preemptively hide every field behind getters and setters. Start with the simplest representation that preserves invariants.

In TypeScript, plain `readonly` fields and plain object properties are often enough. Add accessors later only when they add real behavior or validation.

## 21. Immutable Collections by Default

Do not expose mutable collections casually. Use `readonly` arrays, readonly object shapes, and immutable return values by default.

Mutation is allowed inside a controlled scope with a clear owner. Once data crosses a module boundary, prefer a readonly surface.

This is especially important in shared-state runtimes: hidden mutation multiplies debugging cost for both humans and agents.

## 22. Explicit Collaboration Interfaces

When modules collaborate heavily, define an explicit protocol between them.

That protocol can be an interface, a type alias, a discriminated union, or a function signature. The key is that both sides agree on a named seam.

In WibWob-DOS this is central: `WindowFacade`, command definitions, microapp host handles, state descriptions, snapshot payloads, and API responses should all be deliberate contracts.

## 23. Pluggable Behavior Over Subclass Explosion

When variants differ in only one or two behaviors, accept strategy functions or typed options instead of building a family tree.

Use callbacks, function-valued fields, or small strategy objects. Keep the host stable and let behavior swap at the edge.

## 24. Collecting Parameter

When several sub-functions contribute to one result, pass the accumulating structure explicitly instead of hiding it in outer state or concatenating partial fragments blindly.

Use this carefully. It clarifies ownership when building command lists, diagnostics, registries, manifests, or layout plans.

If the collecting parameter starts acquiring unrelated responsibilities, extract a dedicated builder.

## 25. Intentional Return Values

A function should return a value only when the caller needs one. Do not return internal state just because it is available.

Use `void` when mutation or signaling is the entire point. Use a meaningful return type when the caller truly needs the result.

Avoid vague mixed patterns like mutating internal state and also returning a maybe-useful object unless that contract is explicit and justified.

## 26. Adopt Patterns Incrementally

Do not cargo-cult all 30 rules into every file at once. Use them as refactoring targets and review language.

The right pattern appears when the wrong shape starts hurting. Clean code is often the residue of many small corrections, not one grand rewrite.

For planned refactors, apply the rules systematically to the files in scope. For everyday work, raise standards in layers: strictness, seams, runtime validation, import hygiene, then deeper shape improvements.

---

## TypeScript-Native Principles

These address concerns that arise from TypeScript's static type system, JavaScript runtime boundaries, and modern tooling.

## 27. Model State and Messages as Discriminated Unions

Represent mutually exclusive states, events, and results as discriminated unions with a literal tag such as `kind`, `type`, or `status`.

Use exhaustive `switch` and force the impossible case to `never`.

This is the default modeling tool for app-level workflows. It keeps control flow honest, makes state transitions legible, and works well for agent-readable state surfaces.

```typescript
type LoadState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; value: T }
  | { kind: "error"; error: Error };
```

## 28. Brand Types Only Where Semantic Confusion Is Expensive

Use branded types when two values share the same runtime representation but mean different things and confusion would be costly.

Typical cases: IDs from different domains, file-system roots vs arbitrary paths, terminal cells vs pixels, window IDs vs command IDs.

Do not brand everything. Branding is a precision tool, not a lifestyle. Use it where structural typing is too permissive for the domain.

## 29. Narrow First; Assert Last

Use narrowing as the primary way to make code safe: `typeof`, `instanceof`, `in`, discriminants, custom predicates, and assertion functions.

Treat `as` as a last resort at boundaries where the compiler cannot follow reality. Every assertion should answer a hard question: why is this safe here?

Prefer `unknown` over `any` at uncertain boundaries. Force proof before use.

## 30. Validate at Runtime Boundaries; Make Failures Visible in Types

TypeScript does not validate runtime data. Any value from JSON, env vars, user input, IPC, file contents, HTTP, plugin boundaries, or external libraries is untrusted until checked.

Validate boundary data explicitly, then convert it into trusted domain values. After that, model fallible outcomes in the type system so callers must handle them.

Use discriminated `Result`-style unions, explicit error states, or typed failure variants. Reserve thrown exceptions for truly exceptional situations or outer boundaries.

As a general direction in this codebase, services should return typed results where failure is expected. Windows, CLI adapters, HTTP adapters, and other boundary layers may catch and translate errors at the edge.

For WibWob-DOS this rule is foundational: **user-visible surfaces must also be machine-readable surfaces**, and that only stays reliable when boundary data is validated and failure modes are made explicit.

---

## WibWob-DOS Addendum

These are not extra rules. They are the project-specific reading of the 30 rules above.

### A. Code style serves architecture

A style rule is good only if it reinforces the runtime's real shape:

* command once, adapt thin
* one concept, one owner
* services own logic, windows own wiring
* user-visible means API-visible
* SDK surface stable, implementation mutable

### B. Thin adapters beat clever abstractions

TUI glue, CLI glue, HTTP glue, agent glue, and microapp glue should stay thin. Do not bury core behavior in adapters.

### C. Agent-readable state is a first-class code quality concern

Anything important to a human should be representable semantically to an agent. `describeState()`, explicit summaries, typed command surfaces, and readable errors are part of clean code here, not afterthoughts.

### D. Prefer boring TypeScript

Use the type system aggressively for safety, but not theatrically. Avoid elaborate type-level puzzles in application code when a clearer runtime model or simpler union would do.

Fast understanding beats clever compression.

### E. Modules and imports are part of code style

Use the import style that matches the real runtime.

In this codebase, prefer relative imports with `.js` extensions where the runtime expects them. Use `import type` for type-only imports. Avoid path aliases unless there is a clear, project-wide reason to introduce them. The import path should show the real dependency, not hide it behind convenience.

### F. Type-checking is mandatory, transpilation is not enough

A passing bundle is not evidence of a safe program. `tsc --noEmit` or project-build type-checking belongs in the normal workflow.

---

## How to Use This File

Reference a principle by number during code review, refactoring, and AI-assisted development.

Use the early rules to improve readability and ownership. Use the later TypeScript rules to harden contracts, boundary safety, and state modeling. When two rules seem to compete, prefer the version that produces a smaller, clearer, more explicit seam.

The target is a codebase that stays legible under pressure: agent-operated, API-driven, self-documenting and self-improving when possible.