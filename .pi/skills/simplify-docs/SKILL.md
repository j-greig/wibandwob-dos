---
name: simplify-docs
description: >-
  Three-pass review of PRDs, specifications, architecture docs, and technical
  handovers. Use when you need DRY definitions, agent-readable build instructions,
  and high-scanability docs. Triggers on: "simplify docs", "tighten specs",
  "agent-friendly docs", "progressive disclosure", "dedupe docs".
---

# Simplify Docs

Review technical documents for DRYness, agent legibility, and human scanability.
Fix issues directly.

Design target: **minimal words, maximal semantic precision**.

## Quick run

1. Build target set (user paths or recently changed `.md` files).
2. Run pass 1 (DRY ownership).
3. Run pass 2 (agent decidability).
4. Run pass 3 (human scanability).
5. Apply fixes.
6. Run a **fresh-eyes pass** before finalising.

## Scope

If user gives files/dirs, use those.
If no target, review recently changed docs first.
Read each target doc fully before editing.

## Pass 1 — DRY / single-source ownership

1. Cross-doc duplication
   - One concept/type/rule = one canonical owner file.
   - Secondary docs should link, not restate.

2. Doc-vs-code drift
   - If source code already defines a contract, link the source path.
   - Remove stale duplicated sketches unless needed for explanation.

3. Restated guardrails
   - Replace repeated epic-level constraints with cross-references.

4. Missing source-of-truth references
   - Add concrete file references where behaviour is implemented.

## Pass 2 — Agent readability / build decidability

1. Decidability
   - Remove soft ambiguity (`should/could`) where direction is known.
   - If unresolved, mark explicitly: `DECISION NEEDED:`

2. Naming/path consistency
   - File paths, command IDs, type names must match repo reality.

3. Dependency direction clarity
   - Make import/ownership direction explicit when architecture is described.

4. Procedure over declarations
   - Prefer stepwise build/verify instructions over abstract statements.

5. Defaults over menus
   - Pick one default approach; list alternatives only as fallbacks.

## Pass 3 — Human scanability / operator usability

1. Status clarity
   - Active/in-progress/done/stale must be obvious.

2. Structure
   - Convert wall prose into headers, lists, tables, checklists.

3. Signal-to-noise
   - Move historical/exploratory context under `Background`.

4. Comment-block seeding
   - Preserve concise module purpose text usable as top-of-file comments.

## Fresh-eyes pass (mandatory)

Run this prompt against the updated docs:

`Review this with fresh eyes. Assume current output is serviceable but suboptimal. Find the top 3 clarity gaps, top 3 reliability risks, and top 3 simplifications. Then propose smallest safe edits.`

Apply worthwhile changes.

## Fix policy

- Keep information; do not orphan it.
- Prefer move/restructure/link over delete.
- Preserve canon terms and command IDs exactly.

## Output summary format

For each edited doc, report:
- what was deduplicated
- what became canonical owner
- what ambiguity was resolved
- what remains `DECISION NEEDED`
