---
id: spk-agentic-tui-runtime-roadmap
title: Agentic TUI Runtime, Hot Reload & Creative Composition Audit
status: in-progress
branch: codex/spike-agentic-tui-roadmap
created: 2026-03-08
depends_on: [E015, E016, E020, E021, E023]
---

# Agentic TUI Runtime, Hot Reload & Creative Composition Audit

## TL;DR

WibWob-DOS already has the right bones for an agent-native terminal desktop:
command registry, window manager, state service, control API, dynamic module
loading, microapp primitives, and an in-app coding agent.

The main blocker is not "lack of a better TUI engine". The blocker is that the
extension/runtime seam is still first-generation:

- modules still reach into `src/` internals
- `MicroappHost` types are duplicated inside modules
- module loading is startup-only, not unload/reload/watch aware
- inter-window cooperation is ad hoc command chaining, not a first-class graph
- agent tooling can operate the desktop, but cannot yet author + reload new
  apps/windows as a normal development loop

Recommendation:

1. Do **not** rewrite Blessed or port to a native TS renderer first.
2. Build a **microapp SDK + runtime** first.
3. Add **safe module reload** and **typed window connections** next.
4. Use Textual / Rich / Bubble Tea as a feature wishlist, not as a migration
   target.
5. Treat skills, planning, examples, and generated catalogs as part of the
   runtime architecture so agents can reliably self-mod the app.

If this goes well, the first real milestone is:

> An in-app coding agent can scaffold a new microapp, load or reload it into a
> running WibWob-DOS instance, inspect it through `/state`, connect it to other
> windows, and persist it if declared.

WibWob-DOS is a terminal-native desktop shell built in TypeScript on Bun and
Blessed: a windowed TUI OS where humans and agents share the same workspace,
commands, and control surface. It already supports overlapping draggable
windows, a command registry projected into menus/palette/API, live desktop
state via `/state`, an embedded Wib&Wob coding agent, dynamic microapps loaded
from `modules/`, workspace save/restore, theme switching, creative windows such
as figlet/plasma/terrain/backrooms, and world-chat primitives for multi-window
and multi-instance interaction. The core proposition is not "a terminal app
with chat bolted on" but "an agent-native creative operating environment" where
new tools, art pieces, and workflows can be composed as first-class desktop
surfaces.

## Status

Status: in-progress  
GitHub issue: —  
PR: —  
Branch: `codex/spike-agentic-tui-roadmap`

## Prompt Capture

This spike captures and structures the following program of work:

1. Make it easier and faster for coding agents to create new TUI windows/apps
   on the fly and ideally hot-reload them into a running instance.
2. Review codebase changes that would support that, including reusable
   components, internal TS abstractions, and a wishlist inspired by Textual,
   Rich, Bubble Tea, and underused Blessed capabilities.
3. Support connected windows and multi-window compositions: one window driving
   another, graph-like creative systems, visible links/arrows, multi-window art
   pieces, and multi-instance OS swarms.
4. Make `modules/` and `modules-private/` more robust and compatible with the
   above.
5. Keep all of this compatible with the in-app `pi-coding-agent` integration.
6. Follow Anthropic-style progressive disclosure for memory, skills, examples,
   and agent-facing docs.
7. Surface anything missing from the above, especially from a designer-first
   product perspective.
8. Keep `.planning`, `.agents`, and `.pi/skills` aligned so agents know how to
   extend the app without creating architectural drift.
9. Keep code and docs DRY; eliminate stale sidecar catalogs and duplicate docs.

Upcoming example tasks to keep in view:

- Vim-like text editor capabilities with strong affordances for agentic control
- AI-reactive screensaver / gallery mode / VJ runtime
- responsive desktop layouts that resize and reflow complex window arrangements
  for narrow and mobile viewports, ideally via terminal-native breakpoint/layout
  tokens inspired by Tailwind semantics
- private data-driven module windows such as Plantoid health views
- future command/window ideas captured in
  `wibwob-command-ideas-2026-03-04.md`

## Review Scope Completed

- [x] Read `E016` microapp primitives brief
- [x] Read `spk-arch-domain-audit`
- [x] Review `AGENTS.md`
- [x] Review `.agents/architecture.md`
- [x] Review `.agents/invariants.md`
- [x] Review `.agents/control-api.md`
- [x] Review current planning structure and status
- [x] Review module loader and current microapp host seam
- [x] Review `modules/wibwob-poetry-clock`
- [x] Review `modules/world-chatroom`
- [x] Review `modules/wibwobworld`
- [x] Review `wibwob-agent-session` and agent tools
- [x] Review current skill surfaces relevant to window creation and planning
- [x] Review external TUI references: Textual, Rich, Bubble Tea, Blessed
- [x] Capture symbient/autonomy feedback in
  [`symbient-feedback.md`](./symbient-feedback.md)
- [x] Capture proving-app shortlist in
  [`sdk-proving-app-shortlist.md`](./sdk-proving-app-shortlist.md)
- [x] Capture TouchLab stretch goal in
  [`touchlab-stretch-goal.md`](./touchlab-stretch-goal.md)
  [`module-runtime-reload-build.md`](./module-runtime-reload-build.md)
- [ ] Split this umbrella spike into implementation epics/stories

## Why This Is A Spike Right Now

This should stay a spike for now, not an epic. The primary output is:

- architecture findings
- strategic sequencing
- decomposition into future implementation epics
- risk reduction around runtime, module, and agent seams

An epic should own mergeable code with bounded acceptance criteria. This
document is still deciding how that work should be grouped. The likely next
step is to split this spike into 2-4 implementation epics once Phase 1 scope is
tight enough.

Likely epic shapes:

- `Microapp SDK + Module Runtime`
- `Window Connection Graph + Responsive Layout`
- `Agentic Developer Experience + Module Tooling`
- later, `Creative Runtime` and/or `Editor Surface` once the foundations are
  proven

## Current Architecture Readout

### 1. Core desktop shell

The app is a Bun + TypeScript + Blessed modular monolith. The composition root
is [`src/core/app-controller.ts`](../../../src/core/app-controller.ts). The
desktop already has strong canonical seams:

- command source of truth:
  [`src/core/command-catalog.ts`](../../../src/core/command-catalog.ts)
- execution/listing layer:
  [`src/core/command-registry.ts`](../../../src/core/command-registry.ts)
- window system:
  [`src/core/window-manager.ts`](../../../src/core/window-manager.ts)
- window abstraction for cross-cutting consumers:
  [`src/core/window-facade.ts`](../../../src/core/window-facade.ts)
- live state:
  [`src/services/state-service.ts`](../../../src/services/state-service.ts)
- control plane:
  [`src/services/control-api.ts`](../../../src/services/control-api.ts)

This is already a strong foundation for agent parity.

### 2. Microapp/module system

The module loader in
[`src/services/module-loader.ts`](../../../src/services/module-loader.ts)
already discovers modules from `modules/` and `modules-private/`, loads theme
modules, loads microapps, and exposes a `MicroappHost` with:

- `createWindow`
- `registerCommand`
- `registerSnapshot`
- `registerTheme`
- `runCommand`
- `screen`, `geometry`, `theme`, `windows`
- shared UI/layout primitives

This is the correct seam, but it is not yet strong enough to be a true SDK.

### 3. Microapp primitives

E016 added the first honest content composition path:

- `UiPart<Props>`
- `createStack`
- `createColumns`
- named parts such as header/status/text/rule/figlet/animated panel

This is the best current direction in the codebase. It turns layout from ad hoc
coordinate mutation into an explicit engine.

### 4. Agent integration

The in-app Wib&Wob agent in
[`src/services/wibwob-agent-session.ts`](../../../src/services/wibwob-agent-session.ts)
already has:

- jailed coding tools
- registry-aware TUI tools
- state injection
- prompt fragment loading from `modules-private/wibwob-prompts`
- session bridge integration

This is architecturally important. The app already treats the agent as a native
desktop actor rather than a bolted-on chatbot.

### 5. World / multi-instance substrate

The world chat system already has a good shape:

- stateful domain service:
  [`src/services/world-chat-service.ts`](../../../src/services/world-chat-service.ts)
- transport seam:
  [`src/services/world-chat-transport.ts`](../../../src/services/world-chat-transport.ts)
- world UI:
  [`modules/wibwobworld/index.ts`](../../../modules/wibwobworld/index.ts)
- chatroom UI:
  [`modules/world-chatroom/index.ts`](../../../modules/world-chatroom/index.ts)

This is the seed of multi-instance and eventually multi-host swarm behavior.

### 6. Planning and skills

The repo already has a planning canon, architecture canon, and a skills
ecosystem. The problem is not lack of structure; the problem is keeping
generated vs human-authored docs clean and preventing drift between:

- `.planning/`
- `.agents/`
- `.pi/skills/`
- ad hoc sidecar catalogs in `.pi/`

## Key Findings

### F1. The microapp seam is promising but still leaky

`module-loader.ts` is the intended extension seam, but modules still import
from `../../src/...` directly. Current examples:

- `modules/wibwob-poetry-clock/index.ts`
- `modules/world-chatroom/index.ts`
- `modules/wibwobworld/index.ts`
- `modules/wibwobworld/render-iso.ts`

This breaks the core goal of "agent writes app/window fast and reloads it
reliably" because the module boundary is not actually self-contained.

### F2. The SDK contract is duplicated instead of imported

Several modules locally redefine `MicroappHost`, `MicroappWindowHandle`,
`Rect`, `UiPart`, and related types. That means every change to the host
surface becomes a manual migration across modules.

This is the opposite of the canon rule: one concept, one owner.

### F3. Module loading is startup-only

The current module loader discovers manifests and imports entries at startup,
then stops. There is no first-class concept of:

- module registry introspection
- module unload
- module reload
- module watch mode
- module version/error state in `/state`
- safe teardown of all windows owned by a module before reload

The app has dev-mode process reload, but not microapp-runtime reload.

### F4. Inter-window composition exists, but only implicitly

Windows already affect each other by commands and services. Example:
`wibwobworld` joins a nearby chatspot and then triggers
`microapp.world-chatroom.set-channel`.

That proves the need, but the mechanism is implicit. There is no first-class:

- window port model
- typed input/output channels
- connection graph
- connection metadata in `describeState()`
- control API for linking/unlinking windows
- visual overlay for graph edges/arrows

For your "MaxMSP but split over micro-windows" goal, this needs to become a
real subsystem.

### F5. Dynamic snapshot/runtime parity is incomplete

Dynamic microapps can register snapshot handlers, but the restore path in the
dynamic snapshot wrapper currently returns `undefined` rather than the restored
window handle. That may be acceptable today, but it is a sign the dynamic
module path is not yet as first-class as the built-in window path.

### F6. The in-app agent can operate the desktop, but cannot yet develop it as a first-class workflow

Current agent tools are good for:

- listing commands
- running commands
- opening/focusing/moving windows
- file/code edits inside the repo

Missing high-value agent-native dev tools:

- scaffold microapp from template
- validate manifest
- reload one module
- tail module/runtime errors
- list linkable ports on windows
- connect / disconnect windows
- generate `describeState()` stubs and snapshot handlers

### F7. Progressive disclosure exists in spirit, but not yet as a canon

`wibwob-agent-session.ts` already loads prompt fragments from a directory rather
than one giant prompt file. That is the right direction. The same discipline
should apply to:

- agent skills
- examples
- memory files
- planning docs
- generated catalogs

Right now some skills are excellent, but there is still drift and accretion.

### F8. Documentation/catalog drift is a real architecture problem

The files under `.pi/` such as:

- `.pi/WINDOW_TYPES.json`
- `.pi/WINDOW_TYPES_CATALOGUE.md`

are exactly the class of sidecar artifact likely to drift away from the real
command/window/module registry.

These should either be:

- generated from canonical state, or
- deleted in favor of canonical live views

### F9. A Blessed rewrite is premature

The codebase is not yet bottlenecked by "Blessed vs not Blessed". It is
bottlenecked by:

- seam clarity
- runtime reloadability
- graph composition
- editor/runtime primitives
- skill/doc discipline

Rewriting the renderer before fixing those would risk a large reset with little
gain.

## Strategic Decisions

### D1. Stay Blessed-first for now

This matches the project direction and the current architecture. The right
short-term move is not "escape Blessed", it is "encapsulate Blessed better".

### D2. Build a real microapp SDK before considering a renderer rewrite

Target shape:

- single import path for module authors
- stable types exported by the host
- runtime services projected through capabilities, not deep imports
- safe load/unload/reload semantics
- local templates and agent scaffolds

Only once this seam is solid does it make sense to ask whether Blessed itself
should eventually be swapped under the hood.

### D3. Make connections first-class

Do not leave window-to-window interaction as informal command chaining. Add a
typed graph:

- windows expose ports
- links connect ports
- services route signals/data
- state + control API expose the graph
- desktop overlay can draw relationship hints/arrows

### D4. Treat docs/skills/planning as runtime-adjacent architecture

For an agent-native app, the docs that tell agents how to modify the app are
not secondary. They are part of the operating system.

### D5. Use other TUI systems as idea mines, not migration targets

Steal the best ideas; keep the current product identity.

### D6. Treat responsive layout as a first-class desktop capability

If WibWob-DOS is ever going to work well on smaller terminals, mobile SSH
clients, or embedded remote views, window arrangements cannot remain purely
absolute. The desktop needs a declarative reflow layer:

- desktop-level layout presets that adapt by screen class
- window arrangements that can both resize and reorder
- terminal-native breakpoint tokens inspired by Tailwind-style semantics,
  without pretending CSS itself is the runtime
- content/layout separation so microapps do not re-implement viewport logic

## Dream Wishlist From Other TUI Systems

### Textual

Useful ideas from current Textual docs:

- `textual run --dev` plus live CSS editing and a separate debug console
- `textual serve` for browser-based remote preview
- reactive attributes with smart refresh and optional layout invalidation
- message pump as the base interaction model
- worker manager and `@work` lifecycle-bound background jobs
- snapshot testing plugin support

What WibWob-DOS should steal:

- per-module dev console and hot-reload loop
- explicit invalidation model for windows/microapps
- worker lifetime bound to window/module lifetime
- optional remote mirror/dev preview for non-local agents
- stronger visual regression tooling for windows and layouts

Official references:

- [Textual Devtools](https://textual.textualize.io/guide/devtools/)
- [Textual Reactivity](https://textual.textualize.io/guide/reactivity/)
- [Textual Workers](https://textual.textualize.io/guide/workers/)
- [Textual App API](https://textual.textualize.io/api/app/)
- [Textual MessagePump](https://textual.textualize.io/api/message_pump/)

### Bubble Tea + Bubbles

Useful ideas from Bubble Tea:

- model/update/view architecture
- explicit messages and commands
- framerate-based renderer
- focus reporting and mouse support
- reusable component ecosystem via Bubbles
- newer declarative `View` configuration work to reduce race conditions

What WibWob-DOS should steal:

- explicit microapp-local update loop pattern
- command/message semantics for app/window state changes
- reusable components library with better examples
- declarative per-window view/runtime properties

Official references:

- [Bubble Tea README](https://github.com/charmbracelet/bubbletea)
- [Bubble Tea v2 declarative View notes](https://github.com/charmbracelet/bubbletea/releases)
- [Bubbles components](https://github.com/charmbracelet/bubbles)

### Rich

Useful ideas from Rich:

- `Layout` as a renderable composition tree
- `Live` for auto-updating regions
- `Tree` for hierarchy inspection
- `RichHandler` and `Console.log()` for debugging
- console protocol for object-specific render output

What WibWob-DOS should steal:

- a debug inspector that renders desktop/window/module/link trees
- richer structured logs for the dev console
- renderable/protocol patterns for debug views
- better composition helpers for non-window visual artifacts

Official references:

- [Rich Layout](https://rich.readthedocs.io/en/stable/reference/layout.html)
- [Rich Live](https://rich.readthedocs.io/en/stable/reference/live.html)
- [Rich Tree](https://rich.readthedocs.io/en/stable/tree.html)
- [Rich Logging](https://rich.readthedocs.io/en/stable/reference/logging.html)

## Are We Underusing Blessed?

Yes, but selectively.

Blessed features worth evaluating for use or adaptation:

- `Layout` can auto-position children, though it is marked experimental
- `Textarea` / `Textbox` expose more built-in input/editor hooks than the app
  currently uses
- `List`, `Listbar`, `Table`, `FileManager`, `ProgressBar`, `Log` may reduce
  bespoke code in some windows
- `Terminal` exists for embedded PTY surfaces
- multiple screens and alternate IO targets hint at future remote session
  possibilities
- screen-level focus/blur, mouse events, and CSR optimizations are already
  useful and partly used

Current caution:

The canon is correct not to over-trust "magic Blessed widgets". Use Blessed
primitives where they reduce boilerplate, but keep ownership in WibWob-DOS
services/windows and prefer explicit modular composition over opaque widget
behavior.

Official reference:

- [Blessed README](https://github.com/chjj/blessed)

## Revised Roadmap

With fresh eyes, the cleanest grouping is not "feature buckets" but
"foundation -> runtime -> composition -> product surfaces". The major change
from the first draft is to move responsive layout into the same foundational
band as the connection graph, and to treat pi compatibility plus doc/skill
discipline as cross-cutting constraints rather than their own isolated phase.

## Roadmap Canon

For this program, these phase headers are the canonical grouping. Future epics,
stories, and checklists should map back to one of these phases rather than
inventing parallel buckets.

Each phase below has:

- a clear goal
- an actionable checklist using canon checkbox format
- a completion signal that tells us when the phase is done enough to move on

Parsing notes for agents:

- stable IDs: `CC`, `P0`-`P8`, `W1`-`W6`
- progress source of truth: checkbox state in this file
- if a later status line and checkboxes diverge, trust the checkboxes

```json
{
  "roadmap_version": 1,
  "progress_source_of_truth": "checkboxes",
  "constraints": { "id": "CC", "status": "ongoing" },
  "phases": [
    { "id": "P0", "title": "Split into implementation epics", "status": "not-started" },
    { "id": "P1", "title": "SDK foundation", "status": "not-started" },
    { "id": "P2", "title": "Runtime foundation", "status": "in-progress" },
    { "id": "P3", "title": "Composition foundation", "status": "not-started" },
    { "id": "P4", "title": "Agentic developer experience", "status": "not-started" },
    { "id": "P5", "title": "Product surfaces", "status": "not-started" },
    { "id": "P6", "title": "Multi-instance and swarm runtime", "status": "not-started" },
    { "id": "P7", "title": "Renderer revisit", "status": "not-started" },
    { "id": "P8", "title": "SDK nomenclature and surface cleanup", "status": "not-started" }
  ],
  "workstreams": [
    { "id": "W1", "phase": "P1", "title": "SDK foundation", "status": "not-started" },
    { "id": "W2", "phase": "P2", "title": "Runtime foundation", "status": "in-progress" },
    { "id": "W3", "phase": "P3", "title": "Composition foundation", "status": "not-started" },
    { "id": "W4", "phase": "P4", "title": "Agentic DX and canon hygiene", "status": "not-started" },
    { "id": "W5", "phase": "P5", "title": "Product surfaces", "status": "not-started" },
    { "id": "W6", "phase": "P6", "title": "Multi-instance runtime", "status": "not-started" }
  ]
}
```

### CC — Cross-Cutting Constraints

Status: ongoing

Decision notes:

- symbients remain a later product-layer concern for now, primarily expressed
  through `modules/` and `modules-private/`, not as a core runtime primitive
- agent memory should be scaffolded now toward a future live shared runtime
  substrate, with a simple file-backed project-memory pattern as the likely v1
  bridge
- hot reload should default to safe teardown + reopen first; live state
  preservation is a later stretch goal once unload/reload semantics are proven
- explicit roster UI is deferred; MVP identity presence can ride on lightweight
  window metadata such as title prefixes or authored-by fields

- [ ] Keep pi integration behind `wibwob-agent-session.ts`; do not leak
      vendor-specific behavior into unrelated app code
- [ ] Keep every user-visible capability state-visible and API-visible
- [ ] Keep agent memory, event subscriptions, and identity presence first-class
      runtime concerns rather than sidecar conventions
- [ ] Keep docs, skills, and examples progressive-disclosure-first and owned by
      one canonical location per concept
- [ ] Keep responsive layout, agent affordances, and module/runtime visibility
      visible in `/state` rather than implicit in UI text
- [ ] Reserve a v2 cleanup pass for naming, clustering, and dev-facing surface
      consistency across SDK exports, commands, window types, and module terms

### P0 — Split the spike into real implementation epics

Status: not-started

Goal:
keep this document as the umbrella findings artifact, then carve out bounded,
code-bearing epics.

Action checklist:

- [ ] Define epic boundary for `Microapp SDK + Module Runtime`
- [ ] Define epic boundary for `Window Connection Graph + Responsive Layout`
- [ ] Define epic boundary for `Agentic Developer Experience + Tooling`
- [ ] Decide whether `Creative Runtime` should be one epic or a set of feature
      stories under a later umbrella epic
- [ ] Decide whether `Editor Surface` should stand alone or wait until the
      runtime foundations are proven
- [ ] Create the follow-on epic briefs once scope and acceptance criteria are
      tight enough

Completion signal:

this spike remains the research umbrella, while the next code-bearing work is
owned by concrete epic briefs with bounded scope.

### P1 — SDK foundation

Status: in-progress

Goal:
make module authorship sane before touching reload, graphing, or mobile reflow.

Action checklist:

- [x] Export a single canonical microapp SDK surface for module authors
- [x] Remove supported direct `../../src/...` imports from current modules
- [x] Replace duplicated `MicroappHost` / `MicroappWindowHandle` / layout type
      definitions with imported SDK types
- [x] Upgrade `modules/hello-world` into the canonical scaffold template
- [~] Rewrite `new-window-type` and related skills around the SDK path
- [ ] Rebuild `modules/wibwob-poetry-clock` against the SDK as the brownfield
      proof case
- [ ] Record which required Poetry Clock capabilities still cannot be expressed
      cleanly through the SDK

Current Poetry Clock SDK gap notes:
- there was no named `AnimatedPanelPlayer` type in the SDK, so the module had to
  reconstruct the animated-panel contract locally; this should now be projected
  by the SDK and treated as a pattern to watch in other microapps
- Poetry Clock still depends on raw `win.body` / Blessed composition for custom
  layout, which is acceptable for now but marks the current edge of the
  primitive set

Completion signal:

a new module can be scaffolded from one template and built entirely against the
SDK contract, and Poetry Clock no longer needs direct core imports for
supported behaviors.

### P2 — Runtime foundation

Status: in-progress

Goal:
reload one module in a running instance without restarting the whole app.

Working doc:
[`module-runtime-reload-build.md`](./module-runtime-reload-build.md)

Action checklist:

- [ ] Introduce `ModuleRuntimeService`
- [ ] Track loaded modules, errors, versions, owned windows, commands, and
      cleanup hooks
- [ ] Implement module unload semantics
- [ ] Implement module reload semantics
- [ ] Design reactive runtime event subscription for agents and tools
- [ ] Scaffold a simple project-memory pattern modeled after Claude-style
      project memory files, with room to project it into runtime-backed memory
      later
- [ ] Design v2 agent-memory partitions or equivalent writable runtime memory
      surfaces for a live shared substrate
- [ ] Define persistence semantics for agent-authored modules
- [ ] Make teardown + reopen the default reload path for v1
- [ ] Define explicit stretch-path semantics for preserved-state reload in v2/v3
- [ ] Add `/modules/list`, `/modules/reload`, `/modules/unload` API endpoints
- [ ] Add dev watch mode for module directories
- [ ] Surface module runtime status in `/state`
- [ ] Add agent tools for scaffold, reload, and runtime inspection
- [ ] Use Poetry Clock as the brownfield reload proof
- [ ] Use one fresh test microapp as the greenfield reload proof

Completion signal:

an agent edits `modules/wibwob-poetry-clock/index.ts` or a fresh test microapp,
calls reload, and sees the new surface without restarting WibWob-DOS.

### P3 — Composition foundation

Status: not-started

Goal:
make layout and cross-window interaction first-class instead of ad hoc.

Action checklist:

- [ ] Define a `WindowPort` model
- [ ] Add `ConnectionService`
- [ ] Add `describeState()` support for ports and live links
- [ ] Add control API link/unlink routes
- [ ] Add optional ASCII arrow/link overlay
- [ ] Add responsive layout/reflow primitives for desktop arrangements
- [ ] Define terminal-native breakpoint/layout tokens inspired by Tailwind-style
      semantics
- [ ] Prove one explicit window-to-window link flow, ideally
      `wibwobworld` ↔ `world-chatroom`
- [ ] Prove one arrangement that resizes and reflows across desktop and
      narrow/mobile-style viewports

Completion signal:

one arrangement can adapt across desktop and narrow viewports, and one pair of
windows can be linked through an explicit runtime graph rather than bespoke
command chaining.

### P4 — Agentic developer experience

Status: not-started

Goal:
make the in-app coding agent the best developer of WibWob-DOS.

Action checklist:

- [ ] Add agent tools for scaffold, reload, inspect, and connect
- [ ] Define a skill structure canon: quickstart, constraints, examples, deep refs
- [ ] Keep heavyweight examples in `examples/`, not bloated `SKILL.md`
- [ ] Move sidecar catalogs to generated output or delete them
- [ ] Add one canonical "agent creates a microapp" example path
- [ ] Run an agent-authored microapp exercise using only the SDK, docs, skills,
      and templates
- [ ] Record a friction log: what the agent tried, what was unclear, and which
      affordances or API gaps blocked creative flow
- [ ] Add a writable pattern for agent memory, notes, and incident traces that
      survives across authoring sessions
- [ ] Expose module/runtime/connection visibility in the desktop summary

Completion signal:

the in-app agent can create or modify a microapp using the documented path, and
the resulting friction log is small, concrete, and mostly ergonomic rather than
architectural.

### P5 — Product surfaces built on the foundation

Status: not-started

Goal:
use the new runtime to unlock richer product surfaces rather than hand-building
special cases in the controller.

Action checklist:

- [ ] Evolve the editor toward Vim-like or nano-class capabilities with
      explicit agent-control hooks
- [ ] Build VJ / screensaver / gallery runtime features on the composition
      foundation
- [ ] Add on-chain / API-fed private data modules through the module runtime
- [ ] Add scene/layout graph behaviors for creative desktop pieces
- [ ] Defer explicit roster UI to a later SDK/product phase
- [ ] Add lightweight identity metadata affordances first, such as owner-prefixed
      window titles or authored-by fields in window state
- [ ] Add an explicit single-instance multi-agent milestone:
      `Sy2 + Wib&Wob + Scramble` can cohabit one DOS instance and address each
      other's windows directly without human relay

Completion signal:

at least one ambitious surface is delivered on the new runtime without needing
to bypass the SDK, module runtime, or connection model.

### P6 — Multi-instance and swarm runtime

Status: not-started

Goal:
extend the single-instance composition model across multiple WibWob-DOS
instances.

Action checklist:

- [ ] Add world-chat-backed inter-instance routing primitives
- [ ] Add shared scenes/compositions across instances
- [ ] Add VPS / multi-host orchestration primitives
- [ ] Explore remote mirrors or lightweight alternate/mobile views

Completion signal:

two or more instances can participate in a shared composition or workflow using
the same conceptual model as the single-instance desktop.

### P7 — Revisit the renderer question

Status: not-started

Goal:
decide whether Blessed remains sufficient once the higher-order runtime exists.

Action checklist:

- [ ] Re-evaluate Blessed against editor requirements
- [ ] Re-evaluate Blessed against cell-accurate rendering requirements
- [ ] Re-evaluate Blessed against runtime abstraction stability
- [ ] Decide whether a native TS renderer is still necessary or now avoidable

Completion signal:

the renderer decision is informed by proven runtime needs rather than by early
frustration with current seams.

### P8 — SDK nomenclature and surface cleanup

Status: not-started

Goal:
review and rationalize the naming and grouping of the microapp SDK and adjacent
authoring surfaces once the first proving apps have exposed the real API shape.

Action checklist:

- [ ] Audit current SDK export names for consistency, overlap, and internal
      history leakage
- [ ] Propose clearer clustering for layout primitives, animation helpers,
      terrain/world helpers, host capabilities, and module-author types
- [ ] Review command ids, command labels, window titles, manifest keys, and
      module terminology for consistency and ergonomics
- [ ] Define v2 naming conventions for exported helpers and host capability
      namespaces
- [ ] Identify rename candidates that should wait for a compatibility window
      instead of churning phase-1 work
- [ ] Document migration guidance so agents and humans can move from v1 naming
      to v2 naming without guesswork

Completion signal:

the SDK has a documented v2 naming map and clustering model that feels
intentional, teachable, and stable enough for wider module authorship.

## Current Architecture Decisions

- Symbient model:
  later product layer, primarily via `modules/` and `modules-private/`, rather
  than a runtime primitive in the current foundation work
- Agent memory:
  scaffold now with a simple file-backed project-memory pattern; target a live
  shared runtime substrate in a later SDK/runtime version
- Hot reload:
  v1 default is safe teardown + reopen; preserved live-state reload is a v2/v3
  stretch path once runtime ownership and cleanup semantics are stable
- Multi-agent identity UI:
  explicit roster UI deferred; MVP identity presence should ride on lightweight
  metadata such as title prefixes, authored-by fields, or other existing window
  state affordances

## Proposed Workstreams

### W1 — SDK foundation

Status: in-progress

- [x] Export canonical module-author types from one path
- [x] Replace local `MicroappHost` redefinitions in current modules
- [x] Remove current supported direct module imports except the SDK path itself
- [~] Project more internals through host capabilities instead of `../../src`
- [x] Turn `modules/hello-world` into the canonical scaffold template
- [x] Add scaffolding script for new modules/microapps
- [ ] Rebuild `modules/wibwob-poetry-clock` against the SDK as the brownfield
      proof case

### W2 — Runtime foundation

Status: not-started

- [ ] Introduce `ModuleRuntimeService`
- [ ] Track loaded modules, errors, versions, owned windows, commands, and
      cleanup hooks
- [ ] Add unload/reload hooks
- [ ] Add `/modules/list`, `/modules/reload`, `/modules/unload` API endpoints
- [ ] Add file-watch dev loop for module dirs
- [ ] Surface module runtime state in `/state`
- [ ] Use Poetry Clock and one fresh test microapp as reload proofs

### W3 — Composition foundation

Status: not-started

- [ ] Define a `WindowPort` model
- [ ] Add `describeState()` support for ports and links
- [ ] Add `ConnectionService`
- [ ] Add control API link/unlink routes
- [ ] Render optional ASCII arrow/link overlay
- [ ] Add responsive layout/reflow primitives for desktop arrangements
- [ ] Define terminal-native breakpoint/layout tokens inspired by Tailwind-style
      semantics
- [ ] Convert one existing flow as proof: `wibwobworld` ↔ `world-chatroom`

### W4 — Agentic DX and canon hygiene

Status: not-started

- [ ] Add agent tools for scaffold, reload, runtime inspection, and linking
- [ ] Define a skill structure canon: quickstart, constraints, examples, deep refs
- [ ] Keep heavyweight examples in `examples/`, not bloated `SKILL.md`
- [ ] Move sidecar catalogs to generated output or delete them
- [ ] Add one canonical "agent creates a microapp" example path
- [ ] Keep pi integration behind `wibwob-agent-session.ts`
- [ ] Run an agent-authored microapp exercise and record a friction log:
      what the agent tried, where docs were unclear, and which affordances or
      API gaps blocked creative flow

### W5 — Product surfaces

Status: not-started

- [ ] Editor evolution
- [ ] Creative runtime: VJ, screensaver, gallery, scene playback
- [ ] Data-source modules: APIs, chain data, transforms
- [ ] Mobile/narrow-view arrangement presets

### W6 — Multi-instance runtime

Status: not-started

- [ ] World-chat-backed inter-instance routing
- [ ] Shared scenes/compositions across instances
- [ ] VPS swarm orchestration
- [ ] Remote mirrors or lightweight alternate views

## Mapping The User's Example Ideas

### Editor like nano/vim

This should be treated as its own major product surface, but it depends on the
same runtime discipline:

- stronger input/cursor/selection model
- better cell-aware rendering
- more formal editor service/window split

Do not start by bloating the current editor in place. First make the extension
and runtime seams strong enough that editor work has a clean home.

### Art gallery / screensaver / VJ runtime

This maps directly to:

- connection graph
- timeline service
- scene/save/load ergonomics
- data-driven runtime changes
- module hot reload

This is a high-value proving ground for the architecture because it exercises
windows, automation, dataflow, and multi-instance coordination.

### Private data-driven modules

Plantoid / on-chain / API-fed windows are a perfect reason to harden module
capabilities and worker lifecycles. These should become modules with declared
capabilities and data-source workers, not bespoke app-controller branches.

### `wibwob-command-ideas-2026-03-04.md`

Top-level categories in that ideas doc:

- creative window types: `SEQUENCE`, `DIFF`, `SCORE RUNNER`, `ZOOM`, `MIRROR`
- discovery/curation commands: `/query`, `primer.tag`
- live-performance infrastructure: `scene.save`, `scene.load`, `vj.record`,
  `vj.replay`, adaptive layouts

This is useful directionally. The clean architectural takeaway is:

> the app wants to become a composable runtime for creative desktop scenes, not
> merely a collection of isolated windows.

## Parallelizable Audit Packets

These are good future subagent packets once implementation starts:

### P1 — SDK boundary audit

Task:
find every module import into `src/`, every duplicated host type, and propose
the minimal exported SDK surface needed to eliminate them.

### P2 — Hot reload runtime design

Task:
design load/unload/reload semantics for modules, including command cleanup,
window ownership, snapshot safety, and dev watch mode.

### P3 — Window connection graph design

Task:
define ports, links, signal routing, state exposure, and API surfaces for
connected windows.

### P4 — Skill/doc pruning audit

Task:
scan `.pi/skills`, `.agents`, and `.pi/` sidecars for duplicated ownership,
stale catalogs, and opportunities for progressive disclosure.

### P5 — Creative runtime roadmap

Task:
map VJ/screensaver/art-gallery ideas to concrete stories built on top of the
runtime and connection graph.

## Working Log TL;DRs

### 2026-03-08 — Chunk 1: architecture baseline

The app already has strong system seams for commands, state, control API,
windowing, and agent integration. The project identity is coherent: terminal
desktop shell, overlapping windows, equal human/agent control.

### 2026-03-08 — Chunk 2: module and world audit

The module system is real, but not yet strong enough to be a reliable SDK.
World chat and WibWobWorld already prove multi-window and multi-instance ideas,
but they currently rely on ad hoc coupling instead of a first-class graph.

### 2026-03-08 — Chunk 3: external TUI feature sweep

Textual is strongest on devtools/reactivity/workers; Bubble Tea is strongest on
explicit update/view runtime discipline and reusable components; Rich is strong
for live debug/introspection surfaces; Blessed still has useful capacity left
that WibWob-DOS has not fully exploited.

### 2026-03-08 — Chunk 4: execution call

The highest leverage move is not a renderer rewrite. It is a microapp SDK +
module runtime + connection graph program.

## Exit Criteria For This Spike

- [x] User goals captured in one canonical planning doc
- [x] Current architecture summarized against those goals
- [x] Main risks and seams identified
- [x] External TUI ecosystem review converted into a concrete wishlist
- [x] Clear recommendation on sequencing
- [ ] Split into implementation epics/stories
- [ ] Start Phase 0 implementation

## Local Files Reviewed

- [`AGENTS.md`](../../../AGENTS.md)
- [`.agents/architecture.md`](../../../.agents/architecture.md)
- [`.agents/invariants.md`](../../../.agents/invariants.md)
- [`.agents/control-api.md`](../../../.agents/control-api.md)
- [`.planning/epics/e016-microapp-primitives/e016-brief.md`](../../epics/e016-microapp-primitives/e016-brief.md)
- [`.planning/spikes/spk-arch-domain-audit/spike.md`](../spk-arch-domain-audit/spike.md)
- [`src/services/module-loader.ts`](../../../src/services/module-loader.ts)
- [`src/services/wibwob-agent-session.ts`](../../../src/services/wibwob-agent-session.ts)
- [`src/services/agent-tools.ts`](../../../src/services/agent-tools.ts)
- [`src/services/world-chat-service.ts`](../../../src/services/world-chat-service.ts)
- [`src/services/world-chat-transport.ts`](../../../src/services/world-chat-transport.ts)
- [`src/core/ui-parts.ts`](../../../src/core/ui-parts.ts)
- [`modules/wibwob-poetry-clock/index.ts`](../../../modules/wibwob-poetry-clock/index.ts)
- [`modules/world-chatroom/index.ts`](../../../modules/world-chatroom/index.ts)
- [`modules/wibwobworld/index.ts`](../../../modules/wibwobworld/index.ts)
- [`wibwob-command-ideas-2026-03-04.md`](../../../wibwob-command-ideas-2026-03-04.md)
- [`symbient-feedback.md`](./symbient-feedback.md)

## External References

- [Textual Devtools](https://textual.textualize.io/guide/devtools/)
- [Textual Reactivity](https://textual.textualize.io/guide/reactivity/)
- [Textual Workers](https://textual.textualize.io/guide/workers/)
- [Textual App API](https://textual.textualize.io/api/app/)
- [Textual MessagePump](https://textual.textualize.io/api/message_pump/)
- [Bubble Tea README](https://github.com/charmbracelet/bubbletea)
- [Bubble Tea Releases](https://github.com/charmbracelet/bubbletea/releases)
- [Bubbles](https://github.com/charmbracelet/bubbles)
- [Rich Layout](https://rich.readthedocs.io/en/stable/reference/layout.html)
- [Rich Live](https://rich.readthedocs.io/en/stable/reference/live.html)
- [Rich Tree](https://rich.readthedocs.io/en/stable/tree.html)
- [Rich Logging](https://rich.readthedocs.io/en/stable/reference/logging.html)
- [Blessed README](https://github.com/chjj/blessed)
