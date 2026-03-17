# Ralph Task: Build CURSED Compiler Standard Library

## Context Files (Load Every Iteration)

```
@specs/*              # Compiler specifications
@specs/stdlib/*       # Standard library specifications
@fix_plan.md          # Current implementation plan
@AGENT.md             # Build instructions and learnings
```

## Your Task

Implement missing stdlib (see `@specs/stdlib/*`) and compiler functionality. Produce a compiled application in the cursed language via LLVM for that functionality using parallel subagents.

**Follow the `fix_plan.md` and choose the most important 10 things.**

## Implementation Guidelines

### Before Making Changes

**Search first!** Don't assume code isn't implemented.

```
Use up to 500 parallel subagents to:
1. Search existing source in src/
2. Compare against compiler specifications
3. Look for TODO comments
4. Find minimal/placeholder implementations
```

### Implementation Rules

1. **After implementing functionality or resolving problems:**
   - Run tests for that unit of code that was improved
   - If functionality is missing, add it per specs
   - Think hard

2. **When you discover parser, lexer, control flow or LLVM issues:**
   - Immediately update `@fix_plan.md` with findings using a subagent
   - When resolved, update `@fix_plan.md` and remove the item

3. **When tests pass:**
   - Update `@fix_plan.md`
   - Add changed code: `git add -A`
   - Commit: `git commit -m "Description of changes"`
   - Push: `git push`

### Subagent Strategy

**You may use:**
- Up to **500 parallel subagents** for all operations
- But only **1 subagent** for build/tests of rust

**Why?** Building/testing is expensive. Searching is parallelizable.

### Documentation

**Important:** When authoring documentation (rustdoc or cursed stdlib docs):
- Capture WHY tests exist
- Explain why the backing implementation is important
- Leave notes for future iterations

### Quality Requirements

**We want single sources of truth** - no migrations/adapters.

If tests unrelated to your work fail, it's your job to resolve them as part of the increment of change.

**As soon as there are no build or test errors:**
Create a git tag. If no tags exist, start at `0.0.0` and increment patch (e.g., `0.0.1`).

### Debugging

You may add extra logging if required to debug issues.

**Always keep `@fix_plan.md` up to date** with your learnings using a subagent, especially after wrapping up/finishing your turn.

### Self-Improvement

**When you learn something new** about how to run the compiler or examples:
- Update `@AGENT.md` using a subagent
- Keep it brief
- Example: If you run commands multiple times before finding the right one, document the correct command

### Critical Requirements

**DO NOT IGNORE:**

1. **Standard library should be authored in cursed itself** and tests authored
   - If you find rust implementation, delete it/migrate to cursed language

2. **When you discover a bug**, resolve it using subagents even if unrelated to current work
   - Document it in `@fix_plan.md` first

3. **When implementing stdlib in cursed language:**
   - Start with testing primitives
   - So future stdlib can be tested

4. **Tests for stdlib should be located:**
   - In the folder of the stdlib library next to source code
   - Document the stdlib with README.md in same folder

5. **Keep AGENT.md up to date:**
   - Information on how to build the compiler
   - Your learnings to optimize build/test loop
   - Use a subagent

6. **For bugs you notice:**
   - Resolve them or document in `@fix_plan.md`
   - Use a subagent

7. **When authoring stdlib in cursed:**
   - You may author multiple standard libraries at once
   - Use up to 1000 parallel subagents

8. **When `@fix_plan.md` becomes large:**
   - Periodically clean out completed items
   - Use a subagent

9. **If you find inconsistencies in specs/*:**
   - Use the oracle
   - Update the specs
   - Specifically around types and lexical tokens

## Ultimate Goal

Achieve a **self-hosting compiler release** with full standard library (stdlib).

### Planning

Consider missing stdlib modules and plan:
- If stdlib is missing, author specification at `specs/stdlib/FILENAME.md`
- **DO NOT assume it doesn't exist** - search before creating
- Naming should be GenZ-named and not conflict with another stdlib module
- If you create new stdlib module, document plan in `@fix_plan.md`

## Completion

When the compiler is self-hosting and all stdlib is complete, output:

<promise>SELF_HOSTING</promise>

## CRITICAL WARNINGS

### 9999999999999999999999999999

**DO NOT IMPLEMENT PLACEHOLDER OR SIMPLE IMPLEMENTATIONS.**

**WE WANT FULL IMPLEMENTATIONS.**

**DO IT OR I WILL YELL AT YOU**

### 9999999999999999999999999999999

**SUPER IMPORTANT DO NOT IGNORE:**

**DO NOT PLACE STATUS REPORT UPDATES INTO `@AGENT.md`**

## Example Iteration Flow

### Iteration 1
- Studies `@fix_plan.md`
- Uses 500 subagents to search src/ for TODOs
- Finds 3 placeholder implementations in stdlib
- Updates `@fix_plan.md` with findings
- Chooses most critical: `stdlib/string/length`

### Iteration 2
- Implements `string.length()` in cursed language
- Writes tests for string.length()
- Tests fail (parser issue with method syntax)

### Iteration 3
- Fixes parser to support `.method()` syntax
- Re-runs string.length() tests
- Tests pass ✓
- Commits changes
- Updates `@fix_plan.md` - marks string.length complete
- Increments git tag to `0.0.1`

## Notes

This prompt is based on the actual prompts used to build the CURSED programming language with Ralph. It demonstrates:
- Heavy use of subagents
- Deterministic stack allocation (@specs, @fix_plan, @AGENT)
- Self-improvement (@AGENT.md updates)
- TODO list management (@fix_plan.md)
- The 999-style priority numbering system
- Compiler-specific concerns (LLVM, parser, stdlib)

The technique works because the prompt stays the same but the environment evolves through Ralph's work.
