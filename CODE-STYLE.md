# Code Quality Best Practices — TypeScript Edition

30 principles for TypeScript codebases. The first 26 are adapted from Kent Beck's *Smalltalk Best Practice Patterns*, rewritten for TypeScript's type system, structural typing, and ecosystem conventions. The last 4 are TS-native principles that Beck's Smalltalk couldn't anticipate.

**Prerequisite:** `strict: true` in `tsconfig.json`. These principles assume the compiler is already catching `null`, uninitialized fields, implicit `any`, and unsafe operations. If strict mode is off, enable it before applying anything here.

---

## 1. Composed Method

Divide every function into sub-functions that each perform one identifiable task. Keep all operations at the same level of abstraction. This naturally produces many small functions, each a few lines long.

## 2. Intention-Revealing Names

Name functions after what they accomplish, never how they accomplish it. A reader should understand the purpose of a call without reading its body.

## 3. Replace Comments with Clear Code

If a comment restates what the code does, delete it. If you can't delete a comment, refactor the code (extract a well-named function, rename a variable) until the comment is redundant. Reserve comments for *why*, not *what*. TypeScript's type annotations already document *what* — let them.

## 4. Constructor Clarity

Provide factory functions or typed constructors that produce fully-formed values. Leverage `strictPropertyInitialization` in classes. In functional code, return complete typed objects from factories — never expose `Partial<T>` as a creation API. Callers should never receive half-initialized values.

## 5. Single Responsibility for Methods

Each function should have exactly one reason to change. If a function requires a paragraph to explain, it is doing too much.

## 6. Say Things Once and Only Once

Every piece of knowledge should exist in exactly one place — at both the value level and the type level. Use utility types (`Pick`, `Omit`, `Partial`, `Required`) and type inference (`typeof`, `ReturnType`, `Parameters`) to derive types from a single source rather than duplicating definitions. Duplicate code is a multiple-update liability — extract it.

## 7. Behavior Over State

Get the behavior (public interface) right first. Internal representation can always change later if it's hidden behind a clean API. TypeScript's structural typing reinforces this — consumers depend on shape, not identity.

## 8. Intention-Revealing Function Names

Name functions after the concept they represent, not the algorithm they use. `includes(item)` is better than `linearSearchFor(item)`. Imagine a second, very different implementation — would you give it the same name? If not, generalize.

## 9. Guard Clauses Over Deep Nesting

Handle edge cases and error conditions at the top of a function and return early. The main logic path should read without indentation. TypeScript's type narrowing makes guard clauses especially powerful — an early `if (!x) return` narrows the type of `x` in the rest of the function automatically.

## 10. Query Methods Return; Commands Mutate

Separate functions that answer questions (return a value, no side effects) from functions that change state. Name query methods with `is`, `has`, `can` prefixes for booleans. Enforce the boundary with `readonly` return types for queries and `void` returns for commands.

## 11. Explaining Variables

When a complex expression is hard to read, assign its result to a well-named local variable. The variable name becomes the explanation — and in TypeScript, it also carries an inferred type.

## 12. Role-Suggesting Names

Name variables after the role they play, not their type. `employees` not `employeeList`; `query` not `queryString`. TypeScript's type annotations and hover tooltips make encoding the type in the name doubly redundant.

## 13. Discriminated Unions Over Repeated Conditionals

When the same if/switch structure appears in multiple places, eliminate it. In TypeScript, prefer discriminated unions with exhaustive `switch` (enforced via `never` or `satisfies never`) when operations evolve faster than data types. Use class polymorphism when data types evolve faster than operations. The goal is the same — adding a new case shouldn't require editing existing code.

## 14. Compose, Don't Inherit

Share implementation by composing functions, passing work to collaborator values, or injecting dependencies — not by subclassing. In functional TypeScript, higher-order functions and closures replace object delegation. Structural typing means collaborators need the right shape, not the right class.

## 15. Extract Complex Logic into Dedicated Units

When a function has grown huge and shares many temporaries, extract the computation into its own module-level function. Pass shared context as a typed options object. Use closures to capture intermediate state. Reserve a dedicated class only when the computation has genuine lifecycle needs (setup, compute, teardown).

## 16. Resource Bracketing

When two actions must always happen together (acquire/release, open/close, lock/unlock), use TypeScript 5.2+ `using` declarations with `Disposable`/`AsyncDisposable` for resource lifecycle. For non-resource bracketing (transactions, timing), use the callback wrapper pattern. The caller should never be responsible for the second action.

## 17. Explicit Initialization

Initialize all state at construction time. Enable `strictPropertyInitialization` so the compiler catches uninitialized fields. In functional code, define complete required types and let the compiler reject incomplete objects. Never rely on callers to set fields in the right order after creation.

## 18. Lazy Initialization

When computing or fetching a value is expensive and may not be needed, defer it to first access. The `??=` operator makes the pattern concise: `return this._cache ??= expensiveComputation()`.

## 19. Named Constants Over Magic Literals

Replace magic literals with named constants. Use `as const` objects with derived union types (`typeof X[keyof typeof X]`) rather than enums. Use `satisfies` to validate constants against a type without widening. Avoid `const enum` in shared libraries — it breaks `isolatedModules`.

## 20. Start with Plain Fields

Don't preemptively wrap fields in getters/setters. TypeScript's native `get`/`set` accessors let you add validation, computation, or side effects later without changing the API. Start with plain public properties. In functional code, prefer `readonly` properties over getters/setters.

## 21. Immutable Collections by Default

Never return a mutable collection from a function. Use `ReadonlyArray<T>`, `Readonly<T>`, and `as const` to prevent mutation at compile time. Mutate only in controlled scope (inside a function, before returning a readonly type). Reserve defensive copies for boundaries where TypeScript's type system doesn't reach (external JS consumers).

## 22. Explicit Collaboration Interfaces

When two modules collaborate heavily, define an explicit interface or type alias for the messages between them. TypeScript's structural typing ensures any value with the right shape satisfies the contract. In functional code, the protocol is the callback/function type. Name collaborating interfaces coherently so a third party can implement the same shape.

## 23. Pluggable Behavior Over Subclass Explosion

When many variants differ in only one or two behaviors, accept strategy functions (callbacks/lambdas) instead of creating subclasses. Use a typed options object when multiple behaviors are pluggable. Constrain strategy types with generics. Reserve class hierarchies for genuinely different families of behavior.

## 24. Collecting Parameter

When multiple sub-functions need to contribute to a single result collection, pass the collection as a parameter rather than concatenating return values or stashing state in a field.

## 25. Intentional Return Values

A function should return a value only when the caller needs it. TypeScript's `void` return type makes this explicit — if a function returns `void`, the caller knows not to use the return value. Don't return internal state by default — return something meaningful or nothing at all.

## 26. Adopt Patterns Incrementally

Don't try to apply all rules at once. Write code, notice friction, then apply the pattern that resolves it. Patterns are refactoring targets, not upfront mandates. Clean up as you go. This applies to TypeScript's own strict mode flags too — enable them one at a time when migrating.

---

## TypeScript-Native Principles

These address concepts that have no equivalent in Beck's Smalltalk — they arise from TypeScript's static type system, structural typing, and the JS runtime.

## 27. Discriminated Unions for State Modeling

Model mutually exclusive states as discriminated unions with a literal tag property (`type`, `kind`, `status`). Use exhaustive `switch` with `never` or `satisfies never` to catch unhandled cases at compile time. Prefer `type` aliases for unions; use `interface` when declaration merging or extension is needed.

```typescript
type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

## 28. Branded Types for Semantic Safety

When primitive types carry semantic meaning (UserId vs PostId, Pixels vs Rem), use branded types to get nominal typing within TypeScript's structural system. Zero runtime cost, catches category errors at compile time.

```typescript
type UserId = string & { readonly __brand: unique symbol };
```

## 29. Type Narrowing as Control Flow

Use TypeScript's narrowing (`typeof`, `instanceof`, `in`, discriminant checks, custom type predicates) as the primary mechanism for safe branching. Favor narrowing over type assertions (`as`). Write assertion functions (`asserts value is T`) for validation boundaries. Every `as` cast is a place where the compiler stopped helping you.

## 30. Make Error States Visible in Types

Make error paths visible in the type system. Use discriminated union Result types to force callers to handle errors. Reserve `try/catch` for boundaries with external code and truly exceptional conditions. Use `unknown` (never `any`) in catch blocks.

---

## How to Use This File

Reference a principle by number (e.g., "Principle 13: discriminated unions over repeated conditionals") during code review, pair programming, and AI-assisted development. Principles 1–26 are Beck-derived and universal in spirit. Principles 27–30 are TypeScript-specific and have no equivalent in other paradigms.
