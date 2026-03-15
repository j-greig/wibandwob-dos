# Comparison: Claude vs Codex Module Discovery Devlogs

## Discovery path

Both agents followed essentially the same breadcrumb trail:

  AGENTS.md → docs/building-custom-microapps.md → .agents/microapp-sdk.md
  → scaffold script → example modules → SDK source → microapp-loader.ts

Claude opened 11 files. Codex opened 26 (went deeper into persistence,
snapshot patterns, and cross-references). Codex was more thorough in
following secondary references; Claude stopped earlier and assessed sooner.

## Friction points identified

| Friction | Claude | Codex |
|----------|--------|-------|
| Dead link: docs/microapp-authoring.md | YES | YES |
| Content overlap between two main docs | YES | YES |
| No fast path / 30-second pattern | YES | no |
| Architecture detour (wrong docs first) | YES | YES (called it "defensive over-reading") |
| No "which example for which pattern" | YES | YES |
| SDK exports overwhelming, no "top 5" | YES | no |
| Persistence under-documented | no | YES (went deep, found registerSnapshot) |
| Scaffold missing onCleanup | no | YES (contract mismatch with docs) |
| hello-world no longer minimal | no | YES |
| dream-forecast reference stale | no | YES |
| Scrollbar import leaks internal path | no | YES |
| wibwobworld-iso-fix.md orphan at top level | no | YES |

Claude caught 6 friction points. Codex caught 10 (superset minus 2).
The two Claude-only findings (no fast path, SDK top-5) are UX/ergonomic.
The Codex-only findings are accuracy/staleness issues found by deeper reading.

## Proposed .agents/ restructure

### Claude's proposal

```
.agents/
├── module-dev/                 you are making an addon
│   └── microapp-sdk.md
├── shell-dev/                  you are working on the shell itself
│   ├── architecture.md
│   ├── control-api.md
│   ├── invariants.md
│   └── specs/
│       └── (5 subsystem specs)
└── skills/                     runtime operational skills
```

3 top-level dirs. Minimal reshuffling. Names encode activity (dev).
Argument: "if a module agent opens anything in shell-dev/, the
signposting failed."

### Codex's proposal

```
.agents/
├── README.md                   audience map and fastest paths
├── start-here/                 cold-start entrypoints by role
│   ├── module-author.md
│   ├── shell-contributor.md
│   └── operator-agent.md
├── module-authors/             full microapp authoring lane
│   ├── overview.md
│   ├── sdk-reference.md
│   ├── persistence.md
│   ├── examples.md
│   └── pitfalls.md
├── shell-internals/            core shell architecture
│   ├── architecture.md
│   ├── invariants.md
│   └── subsystems/
│       └── (5 specs)
├── operations/                 running/operating the desktop
│   ├── control-api.md
│   ├── launch-and-restart.md
│   └── visual-verification.md
├── reference/                  cross-cutting conventions
│   ├── command-rules.md
│   ├── docs-index.md
│   └── agent-notes-protocol.md
└── archive/                    historical one-offs
    └── wibwobworld-iso-fix.md
```

7 top-level dirs. Splits current docs into many new files.
Adds a start-here/ router, an operations/ lane, and an archive/.
More thorough but heavier restructure.

## Key differences in approach

NAMING:
  Claude: module-dev / shell-dev — verb-noun, terse, parallel pair
  Codex: module-authors / shell-internals — audience-noun, descriptive

  Claude's names encode what you DO (dev). Codex's names encode who
  you ARE (author) or what's INSIDE (internals). Both pass cold-read.
  Claude's are shorter and more parallel.

SCOPE:
  Claude: reshuffles existing files into 2 audience dirs, no new files
  Codex: proposes 15+ new files (persistence.md, examples.md, pitfalls.md,
  operator-agent.md, visual-verification.md, etc.)

  Claude's is implementable in 10 minutes. Codex's is a multi-session
  documentation project.

PHILOSOPHY:
  Claude: "the directory structure should do the signposting, the existing
  docs are good enough once you find them"
  Codex: "the docs themselves need splitting and new content, not just
  rearrangement"

  Both are right at different time horizons. Claude's is the right
  first move. Codex's is the right eventual state.

THREE AUDIENCES:
  Claude identified 2 audiences: microapp authors and core contributors.
  Codex identified 3: microapp authors, shell contributors, and operators.
  Codex is more precise — control-api.md and launch patterns really do
  serve a third audience (someone running the desktop, not building it).

## Verdict

Claude's structure is the pragmatic first step — move files, rename dirs,
done in one commit, immediately improves signposting.

Codex's structure is the aspirational target — proper content splits,
dedicated persistence docs, start-here router, operator lane. Worth
doing but requires writing new content, not just moving files.

Recommended path:
1. Do Claude's restructure now (module-dev/ + shell-dev/)
2. Fix the dead link and stale references Codex found
3. Grow toward Codex's shape over time as new docs get written
