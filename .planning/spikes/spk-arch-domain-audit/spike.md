---
id: spk-arch-domain-audit
title: Holistic Architecture Domain Audit — codebase-wide modularisation review
status: not-started
branch: spike/arch-domain-audit
created: 2026-03-08
---

# Holistic Architecture Domain Audit

## What this is called in engineering

The thing you are describing has several overlapping names depending on context.
Use these when talking to engineers or writing tickets:

### The overall process
**Domain decomposition audit** — mapping a codebase into its natural areas of
responsibility, then reviewing each one for internal quality and inter-domain
coupling. Rooted in Domain-Driven Design (DDD).

**Architecture health review** — a structured pass across all subsystems asking:
cohesion, coupling, DRY, seams, and fitness for future change.

**Modularisation review** — specifically focused on making existing code more
independently composable (the Lego brick goal).

### The units being reviewed
**Domain** — a coherent area of the application with its own responsibilities and
language. "Window management" is a domain. "Theme system" is a domain.

**Bounded context** — the explicit boundary around a domain: what it owns, what it
exposes, what it must never reach into from outside.

**Subsystem** — interchangeable with domain in a TypeScript monolith. Roughly
maps to a directory or a cluster of related files.

### What we just did to the window system
**Centralised registration refactor** — replacing scattered string literals and
parallel switch statements with a single manifest (WindowDefinition registry).

**Seam hardening** — making the boundary between "what a window is" and "how the
system uses it" explicit and machine-checked rather than by convention.

**DRY extraction** — reducing 11–14 touch-points to 1 co-located definition.

### The property we are improving
**Cohesion** — things that belong together (window identity + command + scene matcher)
are together in one definition, not spread across seven files.

**Coupling** — reducing the number of files that must change when one domain changes.
Lower coupling = safer change.

**Composability** — the Lego brick property. Each primitive does one thing, can be
independently tested, and combines cleanly with others.

### Fitness functions
**Architecture fitness functions** — automated checks that enforce architecture rules.
Example: "every AppType must have a corresponding WindowDefinition entry" as a
build-time assertion. We should add these as we harden each domain.

---

## The WibWob-DOS domain map

The app is a modular monolith. These are its natural domains:

```
┌─────────────────────────────────────────────────────────┐
│                     Control layer                       │
│  app-controller  command-registry  control-api (REST)   │
├──────────────┬──────────────┬──────────────┬────────────┤
│   Window     │  Animation   │   Timeline   │  Module    │
│  management  │  / rendering │  / scene     │  loader    │
│  window-mgr  │  contour-eng │  planner     │  microapps │
│  ui-parts    │  plasma-eng  │  timeline-svc│            │
│  snapshots   │  pattern-eng │  scene-ops   │            │
├──────────────┴──────────────┴──────────────┴────────────┤
│                   Surface layer                         │
│  primer  editor  browser  figlet  plasma  contour  ...  │
├─────────────────────────────────────────────────────────┤
│                   Support layer                         │
│  theme-resolver  workspace-snapshots  geometry-service  │
│  menu-overlay    context-menu-items   command-catalog   │
└─────────────────────────────────────────────────────────┘
```

### Domain inventory

| # | Domain | Core files | Status |
|---|--------|-----------|--------|
| 1 | Window management system | window-manager, ui-parts, types, workspace-snapshots | Audit in progress (spk-window-manifest) |
| 2 | Command / action wiring | command-catalog, command-registry, app-controller actions | Identified: 3-hop split, actionKey scatter |
| 3 | Animation / rendering engines | contour-engine, plasma-engine, contour-window, plasma-window | Partly reviewed — fullscreen fix exposed re-entrancy |
| 4 | Timeline / scene planning | timeline-service, scene-planner, timeline-types, scene-ops | Bug fixed; matcher scatter identified |
| 5 | Module / microapp loader | module-loader, microapp registry | Unreviewed |
| 6 | Theme system | theme-resolver, theme types, check-themes | Unreviewed |
| 7 | Workspace / snapshot persistence | workspace-snapshots, snapshot-registry, app-controller restore | Unreviewed |
| 8 | Control API (REST) | control-api, openapi schema, state serialisation | Unreviewed |
| 9 | Menu / context menu system | menu-overlay-manager, context-menu-items, menu-ui | Unreviewed |
| 10 | Agent / chat session | wibwob-agent-session, agent-tool-handler, chat window | Unreviewed |
| 11 | Terminal / PTY integration | terminal-window, terminal-service | Unreviewed |

---

## Review methodology

For each domain, the same four questions:

1. **Scatter** — how many files must change for a typical change in this domain?
   Count the touch-points. More than 3 is a signal.

2. **String literals as contracts** — are domain concepts passed as unvalidated
   strings across boundaries? These are future `pattern-field` bugs waiting to happen.

3. **Boilerplate repetition** — is the same structural pattern written N times
   without a shared abstraction? Count lines of identical-shaped code.

4. **Seam clarity** — is the boundary of this domain explicit (an interface, a
   registry, a directory) or implicit (by convention, by team memory)?

Output for each: ranked pain points + concrete improvement sketch + effort estimate.

---

## Codex prompts — ready to send

### Phase 1 — Domain coverage map (run once, across whole codebase)

```
Produce a domain map of the WibWob-DOS TypeScript codebase.

For each domain:
- Name and one-line description
- Core files (up to 5)
- Key outward-facing types/functions other domains import
- Incoming dependencies: which other domains call into this one
- Outgoing dependencies: which domains this one reaches into
- Scatter score: for a typical change in this domain, how many files outside the domain must change?
- Smell signals: string literals as contracts, parallel switch statements, >3 touch-points for simple changes

Domains to map (start with these, add any you find):
  window-management, command-wiring, animation-engines, timeline-scene,
  module-loader, theme-system, workspace-snapshots, control-api,
  menu-context, agent-chat, terminal-pty

Output as a markdown table per domain with: files, outward API, scatter score, top smell.
Then a dependency graph (ascii, domains as nodes, arrows as import direction).
Then a ranked list: which domains have the worst scatter/coupling and should be reviewed next.
```

### Phase 2 — Per-domain deep audit (run per domain, one at a time)

```
Deep modularisation audit of the [DOMAIN NAME] domain in WibWob-DOS.

Core files: [LIST FROM PHASE 1]
Also read any file that imports from these.

Apply the same lens used for the window management domain audit:

1. SCATTER — list every file outside this domain that must be edited for a typical
   change inside it. Count touch-points. Show concrete examples.

2. STRING LITERALS AS CONTRACTS — find every place a domain concept is passed as
   an unvalidated string across a module boundary. Show file + line.
   (Prior example: appType "pattern-field" vs "pattern-animation" — a mismatch
   that caused a silent bug for months.)

3. BOILERPLATE REPETITION — find code patterns written 3+ times without abstraction.
   Estimate lines saved by extraction.

4. SEAM CLARITY — is the domain boundary explicit? Is there a single entry point
   (registry, factory, index.ts barrel)? Or do consumers reach into internals?

5. PROPOSED IMPROVEMENTS — for each finding:
   - Name (short, memorable)
   - Problem it solves
   - Concrete implementation sketch (types, function signatures, file)
   - Lines saved / complexity reduction estimate
   - Effort: low / medium / high
   - Risk: low / medium / high

6. PRIORITY ORDER — which to do first. Pragmatic — this is a fast-moving codebase.
   Bias toward: high-leverage/low-risk first, correctness bugs before DRY, fitness
   functions (automated checks) wherever possible.

Pattern to follow: the window manifest registry (WindowDefinition in
src/core/window-registry.ts) reduced new-window touch-points from 11-14 to 1.
Aim for similar reduction in each domain.
```

### Phase 3 — Fitness function audit (run after each domain improvement)

```
After the [DOMAIN NAME] refactor, write architecture fitness functions for this domain.

Fitness functions are automated checks that prevent the class of bugs the refactor fixed.
They run as part of bun run typecheck or a separate bun run arch-check script.

For each fitness function:
- What invariant it enforces
- Where to put it (build-time type check, runtime assertion on startup, test file)
- Concrete TypeScript code to implement it

Prior example: "every AppType must have a WindowDefinition in WINDOW_REGISTRY"
could be enforced with a satisfies check at compile time.
```

---

## Execution order (proposed)

Based on domain map analysis and work already done:

1. **Command / action wiring** (Domain 2)
   Why: directly adjacent to window management work. The 3-hop actionKey pattern
   (catalog → registry → controller) is the next biggest scatter surface.
   Likely improvement: command definitions co-located with window factories.

2. **Timeline / scene planning** (Domain 4)
   Why: bug already found and fixed; planner matchers are the next scatter surface.
   Improvement: matcher table driven by WindowDefinition registry (links to spk-window-manifest S03).

3. **Workspace / snapshot persistence** (Domain 7)
   Why: highest touch-point count for a new persistable window (11–14 total).
   Improvement: persist field in WindowDefinition drives snapshot handlers automatically.

4. **Module / microapp loader** (Domain 5)
   Why: already has a registration pattern — audit it for completeness/consistency.

5. **Control API** (Domain 8)
   Why: state serialisation and openapi schema may have same appType string scatter.

6. **Animation engines** (Domain 3)
   Why: re-entrancy bug exposed in plasma fullscreen; centralised render scheduler
   is the systemic fix. Low urgency now fullscreen works.

---

## Notes

- Run Phase 1 once to validate the domain map above before doing Phase 2 on each.
- Each Phase 2 audit produces a sub-spike or story in the relevant epic.
- The window manifest spike (spk-window-manifest) is the template for all others.
- Add a fitness function after each domain improvement — not after all of them.
