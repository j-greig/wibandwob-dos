---
id: E033
title: Blessed Architecture Calm
status: not-started
issue: ~
pr: ~
depends_on: []
branch: epic/e033-blessed-architecture-calm
spike: spk-unblessed-upgrade
---

# E033 — Blessed Architecture Calm

## TL;DR

Do not migrate WibWob-DOS away from Blessed.

Instead, use the unblessed spike as a forcing function to make the current
Blessed app calmer, more typed, more modular, more testable, more performant,
and more legible to both humans and agents. The target shape is explicit
state, clearer event flow, render as a consequence of state change, stronger
module/runtime seams, and a cleaner first-run module authoring experience —
without losing the desktop feel.

This epic turns the `spk-unblessed-upgrade` findings into implementation work.
The headline outcome is not “new runtime”. It is “Blessed shell, cleaner
internal grammar”.

## Read First

- `/Users/james/Repos/wibandwob-dos/AGENTS.md`
- `/Users/james/Repos/wibandwob-dos/.agents/architecture.md`
- `/Users/james/Repos/wibandwob-dos/.agents/invariants.md`
- `/Users/james/Repos/wibandwob-dos/.planning/spikes/spk-unblessed-upgrade/gpt54-agent-prompt.md`
- `/Users/james/Repos/wibandwob-dos/.planning/spikes/spk-unblessed-upgrade/gpt54-agent-devlog.md`
- `/Users/james/Repos/wibandwob-dos/.planning/spikes/spk-unblessed-upgrade/unblessed-compat-assessment.md`
- `/Users/james/Repos/wibandwob-dos/src/core/app-controller.ts`
- `/Users/james/Repos/wibandwob-dos/src/core/window-manager.ts`
- `/Users/james/Repos/wibandwob-dos/src/core/editor-coordinator.ts`
- `/Users/james/Repos/wibandwob-dos/src/services/module-loader.ts`
- `/Users/james/Repos/wibandwob-dos/src/services/microapp-sdk.ts`

## Decision from the spike

### What we are NOT doing

- Not switching the app to unblessed as canonical runtime
- Not rewriting the shell around React
- Not doing a global TEA reducer rewrite for the entire desktop
- Not doing a flexbox/layout-system rewrite across the whole app
- Not treating the architecture problem as a library problem

### What we ARE doing

- Keep Blessed as the runtime
- Borrow the best ideas from unblessed: stricter typing, clearer runtime seams,
  more explicit render ownership, better text/cell handling, stronger test posture
- Spread the best local patterns already present in the repo, especially the
  `EditorCoordinator` style of extraction and the mode-aware editor work in E032
- Make performance and memory use explicit architectural concerns, especially
  for dense multi-window, animation-heavy, high-resolution future scenes
- Improve module authoring ergonomics because `modules/` and `modules-private/`
  are first-run demo surfaces and extension surfaces

## Problem

WibWob-DOS already has strong nouns — command catalog, registry, window
manager, state service, workspace service, module loader, microapp SDK — but
its verbs are still too distributed.

Current architectural pressure points:

1. `src/core/app-controller.ts` is still too central.
2. `screen.render()` is called from too many layers with no single policy.
3. Local window state often lives in widget mutation paths instead of clear
   state/update/render ownership.
4. Microapp redraw and registration policy are too implicit.
5. `describeState()` is structurally valuable but still depends on windows
   remembering to sync state at the right times.
6. Testing is not yet strong enough for layout regressions, Unicode width bugs,
   animation-heavy windows, or future dense scenes.
7. Module quality matters disproportionately because `modules/` and
   `modules-private/` are hero/demo surfaces for first-time users and agents.
8. Third-party developers do not yet have a clean “build your first custom
   app” path for creating modules under `/modules`.

## Outcome

After E033:

- render ownership is explicit and injectable rather than ambient
- at least two complex live windows use a local model/update/render pattern
- microapps have clearer registration, cleanup, invalidation, and state semantics
- `app-controller.ts` is thinner and more obviously a composition root
- visual regression and render telemetry are stronger
- text/cell correctness becomes an explicit engineering track, not an incidental fix
- module authoring surfaces become cleaner and more trustworthy as first-run demos
- third-party developers have a canonical documentation path for building custom apps

## User stories

- As a maintainer, I can change a window’s behaviour without having to reason
  about random render calls across multiple files.
- As a module author, I get a clear host contract for redraw, lifecycle,
  cleanup, state reporting, and SDK imports.
- As an agent, I can trust that `/state`, `describeState()`, commands, and the
  visible desktop stay in sync.
- As a human operator, dense animated scenes remain responsive and do not drift
  into memory leaks or render storms.
- As a first-time tester, the shipped modules demonstrate a coherent system,
  not a patchwork of one-off patterns.
- As a third-party developer, I can read one obvious doc path and build a custom
  app under `/modules` without copying random internals from `src/`.

## Non-goals

- Replatforming to unblessed, Bubble Tea, Ink, OpenTUI, or webview UI
- Full virtual-DOM abstraction for Blessed
- Whole-app global reducer conversion
- Browser portability work
- React surface area expansion
- Flexbox-first shell rewrite

## Story register

| Story | Status | Depends on | Risk | Summary |
|------|--------|------------|------|---------|
| S01 | not-started | none | medium | Render scheduler and explicit invalidation policy |
| S02 | not-started | S01 | medium | Local model/update/render pilot for live windows |
| S03 | not-started | S01 | medium | Microapp host lifecycle, redraw, and state contract |
| S04 | not-started | S01 | medium | Thin the composition root |
| S05 | not-started | none | medium | Cell-aware text correctness and Unicode discipline |
| S06 | not-started | S01 | medium | Visual regression, render telemetry, and dense-scene performance checks |
| S07 | not-started | S03 | low | Third-party developer docs for building custom apps in `/modules` |

## Stories

- [ ] S01 — Render scheduler and explicit invalidation policy
- [ ] S02 — Local model/update/render pilot for live windows
- [ ] S03 — Microapp host lifecycle, redraw, and state contract
- [ ] S04 — Thin the composition root
- [ ] S05 — Cell-aware text correctness and Unicode discipline
- [ ] S06 — Visual regression, render telemetry, and dense-scene performance checks
- [ ] S07 — Third-party developer docs for custom modules

---

## S01 — Render scheduler and explicit invalidation policy

Status: not-started
Depends on: none
Risk: medium

### User story

As a maintainer, I want one explicit render/invalidation seam so that state
changes and terminal commits are not mixed together all over the codebase.

### Why this story exists

The devlog scan found direct `screen.render()` calls throughout the shell,
window manager, overlays, extracted collaborators, and individual windows.
That makes ownership blurry and will make future performance tuning harder.

### Expected files

- `src/core/app-controller.ts`
- `src/core/window-manager.ts`
- `src/core/editor-coordinator.ts`
- new scheduler file under `src/core/` or `src/services/`
- small follow-on touches in one or two representative windows

### Tasks

- [ ] add a tiny render scheduler / invalidation seam
- [ ] separate `requestRender`, live state sync, and persist intent
- [ ] inject the seam into `WindowManager`
- [ ] inject the seam into `EditorCoordinator`
- [ ] update shell-level comments/docs so render policy is explicit
- [ ] document who may still call direct `screen.render()` and why

### Acceptance criteria

- [ ] AC-1: there is a named render/invalidation seam with clear ownership
- [ ] AC-2: `WindowManager` move, resize, focus, and close paths no longer encode final render policy implicitly
- [ ] AC-3: `EditorCoordinator` routes redraw intent through the seam rather than direct terminal commits in its normal render/update path
- [ ] AC-4: render, sync, and persist intent are described separately in code
- [ ] AC-5: `bun run typecheck` passes

### Verification

- [ ] move, resize, focus, close windows — behaviour unchanged
- [ ] editor typing and save still work
- [ ] `/state` still updates correctly for routine mutations
- [ ] visual smoke in tmux confirms no missed redraws or flicker regression

### Out of scope for this story

- converting every existing window to the new seam
- browser window cleanup
- overlay-system rewrite

---

## S02 — Local model/update/render pilot for live windows

Status: not-started
Depends on: S01
Risk: medium

### User story

As a maintainer, I want at least one live-updating window to use a clear local
message/update/render pattern so the repo has a canonical example of
Elm-inspired discipline inside Blessed.

### Why this story exists

The best proving ground is a complex but bounded live surface. The spike found
`monster-cam-window.ts` to be the cleanest first candidate and
`music-player-window.ts` the next likely one.

### Expected files

- `src/windows/monster-cam-window.ts`
- `src/services/monster-cam-service.ts`
- optional second adopter: `src/windows/music-player-window.ts`

### Tasks

- [ ] define a local model for Monster Cam state
- [ ] define a local `Msg` union for service events and UI actions
- [ ] implement update-style logic for state transitions
- [ ] implement a single render function that applies model to widgets
- [ ] route service events through messages instead of direct widget mutation
- [ ] if the pattern lands well, adopt it in one more live window

### Acceptance criteria

- [ ] AC-1: Monster Cam has a readable local model/update/render shape
- [ ] AC-2: service events (`ready`, `error`, `frame`) feed one visible state path
- [ ] AC-3: widget mutation is concentrated in render/application functions
- [ ] AC-4: cleanup remains explicit and correct
- [ ] AC-5: `describeState()` still reports semantically useful live data
- [ ] AC-6: at least one second live window is either migrated or explicitly deferred with reasons recorded
- [ ] AC-7: `bun run typecheck` passes

### Verification

- [ ] Monster Cam opens, updates, toggles bg/monster modes, and closes cleanly
- [ ] `/state` reflects toggles and live semantic fields
- [ ] no regressions in focus, resize, or window close behaviour
- [ ] visual smoke in tmux confirms live updates still feel immediate

### Out of scope for this story

- global app-level reducer
- TEA conversion for every window family
- changing Monster Cam service process architecture

---

## S03 — Microapp host lifecycle, redraw, and state contract

Status: not-started
Depends on: S01
Risk: medium

### User story

As a module author, I want a clearer host contract so I know how to register,
redraw, clean up, and describe state without relying on implicit timing hacks.

### Why this story exists

The spike found the module boundary powerful but too implicit. The `setTimeout`
registration defer in `module-loader.ts` is a real signal that lifecycle is
not yet expressed cleanly enough.

### Expected files

- `src/services/module-loader.ts`
- `src/services/microapp-sdk.ts`
- representative modules in `modules/` and `modules-private/`
- docs/spec updates if contract changes

### Tasks

- [ ] audit the current `createWindow()` registration flow
- [ ] replace or reduce `setTimeout(ensureRegistered, 0)` lifecycle reliance
- [ ] define explicit redraw/invalidate guidance for modules
- [ ] tighten `describeState()` expectations for microapps
- [ ] migrate at least two representative modules to the improved contract
- [ ] ensure SDK exports are the preferred import path for module authors
- [ ] check workspace restore behaviour for touched modules

### Acceptance criteria

- [ ] AC-1: microapp registration semantics are explicit and documented
- [ ] AC-2: redraw/invalidation policy for microapps is clearer than “call `host.screen.render()` whenever”
- [ ] AC-3: at least two representative modules use the new pattern cleanly
- [ ] AC-4: module `describeState()` remains trustworthy for `/state` and agent use
- [ ] AC-5: migrated modules preserve workspace restore correctness
- [ ] AC-6: migrated modules preserve theme/restyle correctness with windows left open across a theme switch
- [ ] AC-7: `bun run typecheck` passes

### Verification

- [ ] representative module windows still open and close cleanly
- [ ] workspace restore still works for migrated modules
- [ ] theme switching with migrated modules open does not leave stale colours
- [ ] first-run demo modules remain clean, legible, and agent-operable

### Out of scope for this story

- module format redesign
- marketplace/remote module registry
- converting every module in one pass

---

## S04 — Thin the composition root

Status: not-started
Depends on: S01
Risk: medium

### User story

As a maintainer, I want `app-controller.ts` to remain the composition root
without also being the easiest place for every new behaviour to accumulate.

### Why this story exists

The spike confirmed `app-controller.ts` is structurally important but still too
broad. The goal is not to hollow it out; the goal is to keep it readable and
obviously in charge of wiring rather than detailed feature policy.

### Expected files

- `src/core/app-controller.ts`
- one or more new extracted collaborators in `src/core/` or `src/services/`
- touched window-family openers and restore actions

### Tasks

- [ ] identify one coherent extraction seam besides editor handling
- [ ] extract a focused collaborator or family coordinator
- [ ] reduce opportunistic utility logic in `app-controller.ts`
- [ ] keep dependency wiring explicit rather than hidden through globals
- [ ] preserve command, API, and workspace restore behaviour

### Acceptance criteria

- [ ] AC-1: `app-controller.ts` is materially thinner or more clearly sectioned
- [ ] AC-2: one new focused collaborator owns a coherent window/service family
- [ ] AC-3: command routing still flows through the canonical command system
- [ ] AC-4: touched surfaces preserve command and API parity
- [ ] AC-5: touched surfaces preserve workspace restore correctness
- [ ] AC-6: `bun run typecheck` passes

### Verification

- [ ] startup, menuing, workspace restore, and control API still function
- [ ] touched window families still open via commands and restore correctly
- [ ] no regressions in `/commands/list`, `/state`, or window focus behaviour

### Out of scope for this story

- replacing `app-controller.ts` with a global app runtime
- moving every opener out of the controller
- control API redesign

---

## S05 — Cell-aware text correctness and Unicode discipline

Status: not-started
Depends on: none
Risk: medium

### User story

As a human and as an agent, I want primers, lists, sidebars, and text-heavy
surfaces to measure and truncate text correctly even when Unicode width and
ANSI styling make the terminal awkward.

### Why this story exists

The spike and follow-up notes highlighted real Unicode and width bugs,
especially in private primers and ASCII-adjacent assets. The repo already has a
parked follow-on for Unicode/cell-aware rendering; this story starts the work
where it most affects visible correctness.

### Expected files

- `src/core/grid-canvas.ts`
- `src/core/ansi-utils.ts`
- `src/services/content-measurement.ts`
- text/list/sidebar-heavy windows and modules
- any follow-on spec or planning notes

### Tasks

- [ ] audit the worst current Unicode/cell-width failure surfaces
- [ ] define one shared text-width / truncation rule for touched surfaces
- [ ] reduce ad hoc width assumptions in list/sidebar/text rendering
- [ ] fix at least one primer-facing or module-facing Unicode bug class
- [ ] document remaining hard cases and the follow-on boundary

### Acceptance criteria

- [ ] AC-1: at least one shared rule/helper exists for touched width/truncation cases
- [ ] AC-2: identified Unicode failure cases reproduce before and pass after
- [ ] AC-3: primer/module surfaces with mixed-width text behave more predictably
- [ ] AC-4: touched surfaces preserve ANSI-coloured text behaviour where expected
- [ ] AC-5: follow-on scope for deeper cell-rendering work is documented clearly
- [ ] AC-6: `bun run typecheck` passes

### Verification

- [ ] visual review of known problematic primers/assets
- [ ] text-heavy windows still align correctly after changes
- [ ] no obvious regressions in ANSI-coloured content or figlet framing

### Out of scope for this story

- solving all Unicode rendering in the whole app
- replacing string rendering with a full cell engine everywhere
- theme/token redesign

---

## S06 — Visual regression, render telemetry, and dense-scene performance checks

Status: not-started
Depends on: S01
Risk: medium

### User story

As an operator of WibWob-DOS, I want evidence that complex scenes remain
responsive and visually correct as the desktop grows denser and more animated.

### Why this story exists

The long-term target includes very large terminals or projected displays with
many windows, complex art, and live movement. Performance and memory use are
not polish items; they are product constraints.

### Expected files

- `src/core/render-monitor.ts`
- smoke/verification scripts under `scripts/`
- selected live windows or test helpers
- planning/docs updates for verification canon

### Tasks

- [ ] strengthen render telemetry so redraw pressure is easier to observe
- [ ] add or improve visual regression capture for representative windows/scenes
- [ ] define one dense-scene smoke scenario with multiple live windows
- [ ] record acceptable behaviour expectations for render speed and stability
- [ ] note memory/perf blind spots honestly if tooling is still partial

### Acceptance criteria

- [ ] AC-1: render telemetry is easier to read and use during smoke testing
- [ ] AC-2: at least one dense-scene visual smoke workflow exists and is repeatable
- [ ] AC-3: representative animated/text-heavy windows are included in regression coverage
- [ ] AC-4: performance notes are captured in docs, not left as chat-only lore
- [ ] AC-5: a dense-scene smoke pass includes visual evidence plus at least one textual evidence artefact
- [ ] AC-6: `bun run typecheck` passes for any code touched

### Verification

- [ ] run the dense-scene smoke workflow
- [ ] capture screenshots or text evidence for the chosen scenario
- [ ] visually confirm the app remains usable in tmux during the test

### Out of scope for this story

- production-grade profiling suite
- solving every performance bottleneck in one pass
- GPU-accelerated or alternate-runtime rendering

---

## S07 — Third-party developer docs for custom modules

Status: not-started
Depends on: S03
Risk: low

### User story

As a third-party developer using WibWob-DOS for the first time, I want one
obvious documentation path that shows how to build a custom app under `/modules`
so I do not have to reverse-engineer the SDK from scattered examples.

### Why this story exists

The modules are both product surface and extension surface. If module authoring
is only learnable by spelunking examples and random `src/` imports, the system
looks less modular than it really is. This story makes extensibility legible.

### Expected files

- one long doc or a small family of docs under a planning-approved docs path
- `src/services/microapp-sdk.ts` if exports need cleanup for docs accuracy
- representative example modules in `modules/`
- possibly `modules/README.md` or a linked developer-doc landing page

### Tasks

- [ ] choose doc shape: one long page or a small doc family
- [ ] document the module mental model: manifest, setup, commands, window creation, cleanup, restyle, state reporting
- [ ] document the preferred SDK import path and anti-patterns
- [ ] include one minimal app example and one stateful/live app example
- [ ] include first-run guidance for where custom apps live in `/modules`
- [ ] include verification steps for making a new app appear in the running desktop

### Acceptance criteria

- [ ] AC-1: there is a clear third-party developer doc path for building custom apps under `/modules`
- [ ] AC-2: docs describe the canonical path without requiring direct imports from random `src/core/*` files
- [ ] AC-3: docs include one minimal module example and one stateful/live example
- [ ] AC-4: docs explain `describeState()`, cleanup, restyle, and command registration expectations
- [ ] AC-5: docs are accurate against the post-S03 host contract
- [ ] AC-6: a first-time developer can follow the docs to add a new module and see it appear in the app

### Verification

- [ ] follow the docs with a fresh minimal test module or update an example module accordingly
- [ ] visually verify the module appears in the running app
- [ ] verify linked examples and file paths are correct

### Out of scope for this story

- hosted module registry
- package manager integration
- full public docs site redesign

---

## Consolidated acceptance criteria

- [ ] AC-1: Blessed remains the runtime; no runtime migration is required for the epic to succeed
- [ ] AC-2: render/invalidation ownership is more explicit than at spike time
- [ ] AC-3: at least two live or complex surfaces show a cleaner local state/event/render pattern
- [ ] AC-4: microapp lifecycle and redraw semantics are clearer for module authors
- [ ] AC-5: `app-controller.ts` is thinner and more obviously a composition root
- [ ] AC-6: Unicode/cell correctness improves on at least one known bad surface
- [ ] AC-7: visual regression and render telemetry improve materially
- [ ] AC-8: hero modules remain clean first-run demos after the refactors
- [ ] AC-9: touched surfaces preserve workspace/snapshot restore correctness
- [ ] AC-10: touched surfaces preserve command and API parity
- [ ] AC-11: touched surfaces preserve theme/restyle correctness
- [ ] AC-12: there is a clear third-party developer doc path for building custom apps under `/modules`
- [ ] AC-13: `/state`, commands, and visible behaviour stay aligned for touched surfaces
- [ ] AC-14: `bun run typecheck` passes

## Risks

- Overreaching into a fake full-Elm rewrite instead of targeted local discipline
- Breaking workspace restore or semantic state while cleaning up lifecycle code
- Making module authoring harder in the name of purity
- Chasing performance lore without building usable evidence capture
- Touching Unicode width handling without enough visual verification
- Writing developer docs before the module-host contract is stable enough

## Out of scope

- unblessed migration
- React-driven microapps
- global flexbox layout system for the shell
- browser runtime support
- solving every Unicode/cell issue in one pass

## Stretch / later follow-on

- investigate flexbox-like responsive layout only for `zine`-class editorial surfaces
- deepen cell-aware rendering into a shared engine path if S05 proves the need
- add denser performance scenes once render telemetry and smoke scripts mature

## Branch

`epic/e033-blessed-architecture-calm`
