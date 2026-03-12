# Process Note: Planning Directory Hygiene

## What happened

During work on this chore, the working directory accumulated 11 files
at a single level — devlogs, comparison docs, mermaid sources, rendered
PNGs, design notes — with no index and no obvious entry point. A human
returning to this directory after a break could not tell what to read
first or what was evidence vs proposal vs diagram source.

This is the exact problem the chore itself is trying to solve (flat
directory, no audience signposting), reproduced inside our own planning
artifacts.

## What we did

Reorganised into:

```
agents-docs-signposting/
  README.md                         what this is, status, file map
  v2-design-notes.md                the proposal (the answer)
  process-note-planning-hygiene.md  this note
  diagrams/                         rendered PNGs + mermaid sources
  evidence/                         devlogs, comparison, exploration trees
```

Principles applied:
- README at root of every planning directory that has more than 3 files
- Proposal/answer files at top level, evidence/supporting material in subdirs
- Files renamed with numeric prefixes for reading order (01-, 02-, 03-, 04-)
- Subdirs named by role (diagrams/, evidence/) not by format or tool

## Pattern to follow going forward

When a planning directory (chore, epic, spike, or scratch) accumulates
enough files that a cold reader can't tell what to read first:

1. Add a README.md that says what this directory IS, what its STATUS is,
   and what to READ FIRST
2. Keep the answer/proposal at the top level — max 2-3 files
3. Move supporting evidence, diagrams, logs, and sources into named subdirs
4. Name subdirs by what they CONTAIN (evidence, diagrams, scratch) not by
   when they were created or which tool made them
5. Use numeric prefixes (01-, 02-) inside subdirs when reading order matters

This is progressive disclosure applied to planning artifacts: the top level
tells you the answer, the subdirs hold the proof.
