# E033 Module Audit — Story Seeds

## TL;DR

These are not committed implementation stories yet.
They are draft seeds extracted from the module audit so future sessions can pick
small, honest slices without re-reading the whole audit first.

Bias:
- module-local first
- no shell/runtime seam expansion unless clearly necessary
- one smell, one cleanup slice

## Seed 1 — Make Tide Pool instance ownership honest

Candidate target:
- `modules/wibwob-tidepool/index.ts`

Problem statement:
- the manifest says `multiInstance: true`
- mutable runtime state still lives at module scope

Proposed scope:
- move engine, timers, speed, highlight, and history into per-window scope
- preserve current UI and commands
- keep cleanup and state reporting explicit

Why it is a good seed:
- narrow
- easy to verify
- directly aligned with E033 lifecycle goals

## Seed 2 — Tighten Heartbeat into the canonical tiny animated module

Candidate target:
- `modules/heartbeat/index.ts`

Problem statement:
- tiny module, but still bypasses the public SDK and reports thin semantic state

Proposed scope:
- use only SDK-exported helpers
- enrich `describeState()` minimally
- keep the code tiny and starter-friendly

Why it is a good seed:
- very low risk
- improves the example surface that teaches author habits

## Seed 3 — Add local invalidation helper to TouchLab

Candidate target:
- `modules/touchlab-mvp/index.ts`

Problem statement:
- TouchLab is the composition reference surface, but redraw calls remain scattered

Proposed scope:
- introduce one local redraw helper
- route drag, resize, keyboard, and animation-control redraws through it
- do not invent new shared runtime machinery yet

Why it is a good seed:
- local and surgical
- good leverage because TouchLab is now a reference module

## Seed 4 — Split Poetry Clock transport from presentation

Candidate target:
- `modules/wibwob-poetry-clock/index.ts`

Problem statement:
- one file currently owns figlet shelling-out, auth reads, API calls, timers, players, and UI

Proposed scope:
- extract local helpers for poem transport and auth access
- centralise timer ownership
- keep visual behaviour unchanged

Why it is a good seed:
- strong readability win without shell/runtime collisions

## Seed 5 — Re-label or split Patchbay Lab as an integration harness

Candidate target:
- `modules/patchbay-lab/index.ts`

Problem statement:
- currently reads like a product microapp but behaves like a broad SDK/integration harness

Proposed scope:
- make internal bench roles explicit in code and docs
- optionally split local controllers by bench
- avoid shared abstraction work in the first pass

Why it is a good seed:
- reduces confusion for future agents and humans
- improves a useful but cognitively slippery surface

## Seed 6 — Clarify public examples versus internal harnesses

Candidate targets:
- `docs/module-authoring.md`
- `modules/README.md`
- possibly selected module manifests or comments

Problem statement:
- the repo contains both canonical examples and research/harness modules, but the distinction is not always obvious

Proposed scope:
- mark which modules are best copied by third-party authors
- mark which modules are internal or experimental references
- point authors toward the cleanest patterns first

Why it is a good seed:
- doc-only or mostly doc-only
- lowers future architecture drift

## Seed 7 — Raise state-reporting quality across modules

Candidate targets:
- whichever module is being touched anyway

Problem statement:
- `describeState()` exists widely, but the richness and machine-readability vary sharply

Proposed scope:
- add a tiny checklist to module work:
  - summary
  - machine-readable mode/state fields
  - counts where relevant
  - content preview only when useful

Why it is a good seed:
- easy piggyback improvement
- directly helps agent/API parity

## Seeds to postpone until lanes are calmer

These are valuable, but not the next “small honest slice”:

- decompose `modules/zine/index.ts`
- decompose `modules/sy2-chronicles/index.ts`
- terminal-module cleanup
- any shared redraw/runtime framework extraction

## Good first picks when a seam reopens

If only one module-local lane opens, best order is probably:

1. Tide Pool
2. Heartbeat
3. TouchLab
4. Poetry Clock
5. Patchbay Lab
