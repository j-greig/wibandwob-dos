---
name: simplify-docs
description: >-
  Three-pass review of PRDs, specifications, architecture docs, and technical
  handover documents. Checks DRY definitions (repeated specs that should be
  single-sourced, stale code sketches), agent readability (can an agent build
  from this spec without ambiguity?), and human readability (can a prompt
  engineer understand and direct agents from this doc?). Fixes issues directly.
  Use when the user says "simplify docs", "tighten the specs", "review the
  docs", or before a planning milestone.
---
# Simplify Docs: Specification & Architecture Review

Review technical documents for DRYness, agent legibility, and human
readability. Fix issues directly.

Never simplify for brevity alone. Simplify because it makes documents more
useful to the two audiences: agents writing code from these specs, and humans
prompting those agents.

## Scope

The user may name specific files or a docs directory. If no target is given,
review recently changed `.md` files under the project's docs directories.
Read each target document fully before reviewing.

## Pass 1: DRY — Single-Source Definitions

1. **Cross-doc duplication.** Flag any concept, type, interface, or
   architectural rule defined in more than one document. The canonical
   definition should live in one place; other docs should cross-reference,
   not restate.

2. **Doc vs source drift.** Flag inline code sketches or interface
   definitions that duplicate what already exists in the actual codebase.
   If a real TypeScript file implements the spec, the doc should reference
   the source file rather than carry a stale copy.

3. **Restated constraints.** Flag story or feature docs that restate
   epic-level guardrails verbatim. Replace with a one-line cross-reference.

4. **Missing reference-implementation citations.** If a well-known
   dependency or adjacent codebase already solves a problem the doc is
   speccing from scratch, note it. Examples: TypeBox for runtime schema
   validation, chalk for terminal colour abstraction, blessed's existing
   API for widget patterns.

## Pass 2: Agent Readability

Review from the perspective of a coding agent receiving this doc as context.

1. **Module-header contract.** Does each specced module have a clear
   one-paragraph purpose statement extractable as a file-header doc
   comment? If the description is buried in prose, extract it into a
   standalone block.

2. **Decidability.** Can an agent determine what to build without further
   clarification? Flag specs that say "should" or "could" without
   resolving which option is intended.

3. **Naming consistency.** Are file paths, function names, and type names
   consistent between the doc and the actual source tree? Flag drift.

4. **Import graph clarity.** Does the doc make dependency direction clear?
   An agent needs to know what a module imports and what imports it.

5. **Code sketch freshness.** If the doc contains code sketches, do they
   match current codebase signatures? Stale sketches actively mislead
   agents. Update them or replace with a file reference.

## Pass 3: Human Readability

Review from the perspective of a human whose job is to prompt agents to
build or modify the system.

1. **Narrative flow.** Can someone read top-to-bottom and build a mental
   model? Flag docs requiring non-linear reading.

2. **Status clarity.** Is it immediately obvious whether this doc is
   active, landed, stale, or reference-only?

3. **Signal-to-noise.** Flag historical or exploratory sections mixed
   with actionable spec. Move these under a "Background" heading or
   into a separate reference doc.

4. **Scanability.** Flag wall-of-prose sections that need tables, lists,
   or headers for skimming.

5. **Comment-block seeding.** For specced modules, does the doc contain a
   concise purpose statement suitable as a top-of-file doc comment? If
   the spec has a good description but the source file lacks the
   corresponding comment block, note it as a follow-up.

## Fix Issues

Fix each issue directly in the document files.

- **Duplicate definitions:** Replace secondary copies with a
  cross-reference.
- **Stale code sketches:** Update to match source, or replace with a
  file-path reference.
- **Buried module descriptions:** Extract into a formatted block usable
  as a file header comment.
- **Ambiguous specs:** Resolve if the codebase already chose a direction.
  If genuinely unresolved, mark with `DECISION NEEDED:` rather than
  leaving soft language.
- **Mixed historical/active content:** Move historical material under a
  "Background" heading.
- **Missing source references:** Add file-path references to actual
  implementations.

Never delete information that has no other home. Move, restructure, or
cross-reference it.

When done, briefly summarise what was fixed per document, or confirm docs
were already clean.
