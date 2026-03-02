---
name: simplify
description: >-
  Three-pass code review and cleanup after a batch of changes. Runs reuse
  analysis (find existing utilities that replace new code), quality review
  (redundant state, copy-paste, leaky abstractions, stringly-typed code),
  and efficiency review (unnecessary work, missed concurrency, hot-path bloat,
  memory leaks). Fixes issues directly. Use after landing a feature slice,
  before a PR, or when the user says "simplify", "clean up", or "review".
---
# Simplify: Code Review and Cleanup

Review all changed files for reuse, quality, and efficiency. Fix any issues found.

## Phase 1: Identify Changes

Run `git diff` (or `git diff HEAD` if there are staged changes) to see what changed. If there are no git changes, review the most recently modified files that the user mentioned or that you edited earlier in this conversation.

## Phase 2: Three Review Passes

Run all three reviews against the full diff.

### Pass 1: Code Reuse

For each change:

1. Search for existing utilities and helpers that could replace newly written code. Use grep/find to locate similar patterns elsewhere in the codebase — common locations are utility directories, shared modules, and files adjacent to the changed ones.
2. Flag any new function that duplicates existing functionality. Suggest the existing function instead.
3. Flag any inline logic that could use an existing utility — hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards.

### Pass 2: Code Quality

Review the same changes for hacky patterns:

1. Redundant state: state that duplicates existing state, cached values that could be derived, observers that could be direct calls.
2. Parameter sprawl: adding new parameters instead of generalising or restructuring.
3. Copy-paste with slight variation: near-duplicate blocks that should be unified.
4. Leaky abstractions: exposing internals that should be encapsulated, or breaking existing abstraction boundaries.
5. Stringly-typed code: raw strings where constants, enums, or branded types already exist.

### Pass 3: Efficiency

Review the same changes for performance:

1. Unnecessary work: redundant computations, repeated file reads, duplicate API calls, N+1 patterns.
2. Missed concurrency: independent operations run sequentially when they could be parallel.
3. Hot-path bloat: blocking work added to startup or per-request/per-render paths.
4. Unnecessary existence checks: pre-checking before operating (TOCTOU) — operate and handle the error instead.
5. Memory: unbounded data structures, missing cleanup, event listener leaks.
6. Overly broad operations: reading entire files when only a portion is needed, loading all items when filtering for one.

## Phase 3: Fix Issues

Aggregate findings from all three passes. Fix each issue directly. If a finding is a false positive or not worth addressing, note it and move on.

When done, briefly summarise what was fixed (or confirm the code was already clean).
