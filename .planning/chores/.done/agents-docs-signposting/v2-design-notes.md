# V2 Proposed Docs Structure — Design Notes

Diagram: `v2-proposed-docs.png`
Source: `v2-proposed-docs.mmd`

## Design bias: 60/40 Claude-pi / Codex-GPT

Claude/pi agents read AGENTS.md as injected system context. They process
@ includes sequentially. They're breadth-first — they scan the whole
surface before going deep. They benefit from:
- Front-loaded summaries (read once, stop early)
- Clear stop-signals ("you don't need this directory")
- Progressive disclosure by tier (don't show everything at once)
- Deduplicated content (token budget matters in context windows)

Codex/GPT agents are depth-first forensic readers. They verify claims
against source. They follow every cross-reference. They benefit from:
- No dead links (every reference resolves)
- Source-of-truth markers ("verify here" pointers to implementation)
- Stable vs internal export labelling (prevents hallucinated API calls)

The 60/40 split means: the STRUCTURE is optimised for breadth-first
reading (Claude), while the CONTENT is accurate enough that depth-first
verification (Codex) terminates cleanly without chasing ghosts.

## What changed from v1

### New files (4)

quick-start.md — the 30-second fast path. Scaffold command, the 5
imports you always need, one copy-pasteable skeleton. This is what
Claude wanted and couldn't find. A breadth-first agent reads this
and has enough to start coding. ~50 lines max.

examples-by-tier.md — the "which example for which pattern" table
both agents wanted. Four tiers: static (hello-world), animated
(heartbeat), persistent (poetry-clock), complex (e026-demo). Each
gets 3 lines: what it shows, when to use it, what to copy from it.

persistence.md — registerSnapshot surfaced as a first-class doc.
Poetry-clock's serialize/restore pattern as canonical example.
Codex had to chase this through microapp-loader.ts; no agent should
have to do that again.

pitfalls.md — common mistakes extracted from the two overlapping
tables, plus the scaffold/onCleanup contract mismatch, plus the
scrollbar internal-import leak. One place, no duplication.

### Moved files

microapp-sdk.md → sdk-reference.md in module-dev/. Stripped of
skeleton, manifest, and common-mistakes (those live in
building-custom-modules.md exclusively now). What remains: host
API, window handle API, advanced primitives (trees, tabs, tweens,
patterns, gradients, animation). Pure reference, no onboarding.

architecture.md, invariants.md, control-api.md, specs/ → shell-dev/.
Unchanged content, new address. Module authors never see them.

### Fixed

docs/microapp-authoring.md — now exists. Either a redirect to
building-custom-modules.md or a thin alias. Kills the dead link
that both agents hit (Claude twice, Codex three times).

### Changed in existing files

AGENTS.md — "Building Modules" becomes §1 (was buried at line 53).
"Shell Development" becomes §2. Module author stops reading after §1.

building-custom-modules.md — becomes THE single source of truth for
basics: manifest, skeleton, lifecycle hooks, verification checklist.
No other doc duplicates this content.

microapp-sdk.ts — stable public exports get a @public JSDoc tag.
Internal/advanced exports get @internal. Agents reading source can
distinguish "this is fair game" from "this might change". Addresses
the SDK drift risk Codex flagged.

scaffold-microapp.sh — generated index.ts gets an onCleanup stub
(even if empty) to match the "4 required hooks" contract in the docs.
Scaffold-as-ground-truth means the scaffold must not violate the
contract.

## Reading paths in v2

### Module author (Claude/pi typical path)

```
AGENTS.md §1 "Building Modules"
  → .agents/microapp-dev/quick-start.md       (30 sec, start coding)
  → docs/building-custom-microapps.md         (full guide when needed)
  → .agents/microapp-dev/examples-by-tier.md  (pick example by pattern)
  → one example module                      (copy, modify, done)
```

4 files. Under 10 minutes. No detours into shell internals.

### Module author (Codex/GPT typical path)

```
AGENTS.md §1 "Building Modules"
  → .agents/microapp-dev/quick-start.md
  → docs/building-custom-microapps.md
  → .agents/microapp-dev/sdk-reference.md     (full API surface)
  → .agents/microapp-dev/persistence.md       (if persist:true)
  → src/services/microapp-sdk.ts            (verify exports)
  → src/services/microapp-loader.ts           (verify host API)
```

6 files. Deeper, but no dead links, no ghosts, no drift surprises.
The dashed "verify" arrows in the diagram mark where depth-first
agents cross from docs into source — and find what they expect.

### Core contributor (either agent type)

```
AGENTS.md §1 + §2 (full document)
  → .agents/shell-dev/*
  → .agents/shell-dev/specs/*
  → .agents/microapp-dev/* (they maintain the SDK surface)
```

Full read. Module section gives them consumer context for the SDK
they maintain.

## The stop signal

The diagram has one explicit stop node: "MODULE AUTHOR STOPS HERE —
never needs shell-dev/". This is the structural test. If a module
author opens anything in shell-dev/, the signposting failed.

For Claude/pi agents (breadth-first), this works because AGENTS.md §1
never links to shell-dev/. The @ includes point only into module-dev/
and docs/. shell-dev/ is below the fold in §2.

For Codex/GPT agents (depth-first), this works because the verify
arrows terminate at microapp-sdk.ts and microapp-loader.ts — source
files, not shell-dev/ docs. The depth-first path bottoms out in
code, not in the wrong documentation directory.
