---
id: E033
title: Blessed Architecture Calm
status: in-progress
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

Quick environment note: if Python-side capability checks fail during this epic,
prefer `uv` for local venv setup and package installation before inventing ad
hoc wrappers or bypasses. This was useful for bringing up
`assets/mediapipe-venv/` for Monster Cam smoke work.

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
- Retire unnecessary backward-compat cruft where we can prove it is no longer needed,
  rather than preserving legacy commands, aliases, and dead compatibility paths forever

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
8. The control API likely contains some fast-grown, vibe-engineered edges:
   alias routes, overlapping command surfaces, and endpoint contracts that
   may be useful but not yet as coherent as the rest of the architecture.
9. Runtime telemetry exists only as fragments: `src/core/render-monitor.ts`
   is real but unwired, Monster Cam reports its own service FPS only, and the
   shell has no dedicated debug/stats surface for FPS, frame time, RAM, or
   agent/session health.
10. Blessed custom stream routing may be strategically useful for composition
    work: a `blessed.screen()` can manually target arbitrary duplex streams,
    which suggests future possibilities for piping one Blessed surface into
    another widget or composition surface rather than treating every animated
    system as a top-level window only.
11. Application launching and window switching still lean too much on menus,
    commands, and knowledge of the system. There is room for a more immediate,
    TUI-native macOS-like launcher/switcher surface with icon-ish affordances,
    running indicators, and one-click open/focus behaviour.
12. Third-party developers do not yet have a clean “build your first custom
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
- the control API becomes easier to discover, trust, and extend without route drift
- runtime telemetry becomes a real operator tool rather than an unwired primitive
- composition work has a clearer path toward embeddable Blessed surfaces, not only top-level windows
- application launching and switching become faster and more intuitive through a TUI-native macOS-like launcher/switcher surface
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
- As an external operator or agent integration author, I can discover the API,
  predict its naming and behaviour, and trust `GET /help`, `GET /openapi.json`,
  commands, and live state to agree.
- As a developer or operator in a debugging session, I can turn on a stats
  surface and see render FPS, frame timing, RAM usage, and key agent/session
  health signals without inventing ad hoc instrumentation.
- As a human operator, I can switch between running apps and launch apps faster
  through a TUI-fied macOS-like launcher/switcher surface with recognisable
  indicators and instant open/focus behaviour.
- As a third-party developer, I can read one obvious doc path and build a custom
  app under `/modules` without copying random internals from `src/`.

## Non-goals

- Replatforming to unblessed, Bubble Tea, Ink, OpenTUI, or webview UI
- Full virtual-DOM abstraction for Blessed
- Whole-app global reducer conversion
- Browser portability work
- React surface area expansion
- Flexbox-first shell rewrite
- Keeping legacy aliases or compatibility shims by default when the epic proves they are unnecessary

## Story register

| Story | Status | Depends on | Risk | Summary |
|------|--------|------------|------|---------|
| S01 | done | none | medium | Render scheduler and explicit invalidation policy |
| S02 | done | S01 | medium | Local model/update/render pilot for live windows |
| S03 | done | S01 | medium | Microapp host lifecycle, redraw, and state contract |
| S04 | done | none | medium | Thin the composition root |
| S05 | done | none | medium | API contract audit and control-surface cleanup |
| S06 | not-started | none | medium | Cell-aware text correctness and Unicode discipline |
| S07 | done | none, then coordinate with S01 | medium | Visual regression, render telemetry, and dense-scene performance checks |
| S08 | done | none, then coordinate with S01 and S07 | medium | Runtime telemetry, stats surface, and agent/session health metrics |
| S09 | not-started | none | medium | WibWobTUI macOS-ification for app launch and switching |
| S10 | done | S03 | low | Third-party developer docs for building custom apps in `/modules` |
| S11 | not-started | S03, S07 | medium | Composable animated surfaces for zine, touchlab, and future dashboard modules |
| S12 | not-started | S03, S11 | medium | TouchDesigner-like composition scaffolding for ASCII / ANSI art modules |

## Stories

- [x] S01 — Render scheduler and explicit invalidation policy
- [x] S02 — Local model/update/render pilot for live windows
- [x] S03 — Microapp host lifecycle, redraw, and state contract
- [x] S04 — Thin the composition root
- [x] S05 — API contract audit and control-surface cleanup
- [ ] S06 — Cell-aware text correctness and Unicode discipline
- [x] S07 — Visual regression, render telemetry, and dense-scene performance checks
- [x] S08 — Runtime telemetry, stats surface, and agent/session health metrics
- [ ] S09 — WibWobTUI macOS-ification for app launch and switching
- [x] S10 — Third-party developer docs for custom modules
- [ ] S11 — Composable animated surfaces for zine, touchlab, and future dashboard modules
- [ ] S12 — TouchDesigner-like composition scaffolding for ASCII / ANSI art modules

## Recommended execution order

Phase A — core foundations and cleanup
- S01 render scheduler
- S04 thin the composition root
- S05 API cleanup
- S06 Unicode / cell correctness

Phase B — observability and proof
- S08 runtime telemetry / stats surface
- S07 dense-scene smoke, regression evidence, and render telemetry workflows

Phase C — local architecture and module contract
- S02 local model/update/render pilot
- S03 microapp host lifecycle and redraw contract

Phase D — user-facing operability and authoring
- S09 WibWobTUI macOS-ification for app launch and switching
- S10 third-party developer docs for custom modules

Phase E — advanced composition
- S11 composable animated surfaces for zine / touchlab / dashboard modules
- S12 TouchDesigner-like composition scaffolding

Notes:
- S04, S05, and S06 are intentionally parallelisable and should not wait on S01 unless they touch its exact seam.
- S07 can begin before S01 fully lands by defining benchmark scenes, evidence formats, and telemetry workflows.
- S08 should happen before or alongside the heavier dense-scene validation work so the benchmark passes have a real stats surface.
- S10 should follow the stabilized module-host contract from S03.
- S12 should not start before S11 proves the lower-level animated embedding path.

---

## S01 — Render scheduler and explicit invalidation policy

Status: done
Depends on: none
Risk: medium

### User story

As a maintainer, I want one explicit render/invalidation seam so that state
changes and terminal commits are not mixed together all over the codebase.

### Why this story exists

The devlog scan found direct `screen.render()` calls throughout the shell,
window manager, overlays, extracted collaborators, and individual windows.
That makes ownership blurry and will make future performance tuning harder.

Here, “tiny” means the API surface and decision surface, not the total number
of adoption call sites. The goal is a very small app-level seam above Blessed
such as `requestRender`, `requestSync`, and `requestPersist`, while allowing a
broader but incremental wiring pass across a few core owners.

The scheduler lives above Blessed as an app-level gate. It does not replace
Blessed batching or alter Blessed internals; Blessed remains the final commit
layer once the app decides to render.

### Expected files

- `src/core/app-controller.ts`
- `src/core/window-manager.ts`
- `src/core/editor-coordinator.ts`
- new scheduler file under `src/core/` or `src/services/`
- small follow-on touches in one or two representative windows

### Tasks

- [x] add a tiny render scheduler / invalidation seam
- [x] separate `requestRender`, live state sync, and persist intent
- [x] inject the seam into `WindowManager`
- [x] inject the seam into `EditorCoordinator`
- [x] update shell-level comments/docs so render policy is explicit
- [x] document who may still call direct `screen.render()` and why

### Acceptance criteria

- [x] AC-1: there is a named render/invalidation seam with clear ownership
- [x] AC-2: `WindowManager` move, resize, focus, and close paths no longer encode final render policy implicitly
- [x] AC-3: `EditorCoordinator` routes redraw intent through the seam rather than direct terminal commits in its normal render/update path
- [x] AC-4: render, sync, and persist intent are described separately in code
- [x] AC-5: direct `screen.render()` calls from unconverted windows continue to work without interference from the scheduler
- [x] AC-6: the scheduler seam has direct test coverage for its gating / batching logic
- [x] AC-7: `bun run typecheck` passes

### Verification

- [x] scheduler tests pass
- [x] move, resize, focus, close windows — behaviour unchanged
- [x] editor typing and save still work
- [x] `/state` still updates correctly for routine mutations
- [x] visual smoke in tmux confirms no missed redraws or flicker regression

### Out of scope for this story

- converting every existing window to the new seam
- browser window cleanup
- overlay-system rewrite

---

## S02 — Local model/update/render pilot for live windows

Status: done
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

- [x] define a local model for Monster Cam state
- [x] define a local `Msg` union for service events and UI actions
- [x] implement update-style logic for state transitions
- [x] implement a single render function that applies model to widgets
- [x] route service events through messages instead of direct widget mutation
- [ ] if the pattern lands well, adopt it in one more live window

### Acceptance criteria

- [x] AC-1: Monster Cam has an explicit local pattern named in code, with a model type, a message/event type, an update/apply-transition function, and a render/apply-to-widgets function
- [x] AC-2: service events (`ready`, `error`, `frame`) feed one visible state path
- [x] AC-3: widget mutation is concentrated in render/application functions
- [x] AC-4: cleanup remains explicit and correct
- [x] AC-5: `describeState()` still reports semantically useful live data
- [x] AC-6: the second-candidate surface is named explicitly in the story outcome, with either a real migration or a concrete defer note that does not weaken the epic-level two-surface requirement
- [x] AC-7: `bun run typecheck` passes

### Verification

- [x] Monster Cam opens, toggles bg/monster modes, and closes cleanly; live frame updates still depend on local camera availability
- [x] `/state` reflects toggles and live semantic fields
- [x] no regressions in focus, resize, or window close behaviour
- [x] visual smoke in tmux confirms the local model-driven surface updates and remains responsive in this environment

### Current outcome note

Monster Cam now has a named local model/update/render path via
`src/windows/monster-cam-model.ts` and `src/windows/monster-cam-window.ts`.
The second candidate remains `src/windows/music-player-window.ts`, but is
explicitly deferred for a later E033 pass because the file is much broader and
would blur this story's "first canonical example" goal. The epic-level two-
surface requirement remains open and must be satisfied by a later story.

Local `assets/mediapipe-venv/` was then provisioned with `uv`, allowing real
window-open and toggle/close smoke in tmux. In this environment the camera feed
still did not progress beyond the starting state, so full ready/frame evidence
remains outstanding even though the model/update/render seam is now landed.

### Out of scope for this story

- global app-level reducer
- TEA conversion for every window family
- changing Monster Cam service process architecture

---

## S03 — Microapp host lifecycle, redraw, and state contract

Status: done
Depends on: S01
Risk: medium

### User story

As a module author, I want a clearer host contract so I know how to register,
redraw, clean up, and describe state without relying on implicit timing hacks.

### Why this story exists

The spike found the module boundary powerful but too implicit. The `setTimeout`
registration defer in `module-loader.ts` is a real signal that lifecycle is
not yet expressed cleanly enough.

The first move here is to understand and document why that defer exists and
what ordering guarantee it currently protects. Only after that should the code
replace it with a clearer mount / registration phase if the same guarantees can
be preserved.

There is also a concrete SDK import anti-pattern to clean up: several modules
bypass `microapp-sdk.ts` and import directly from `src/core/*`. Verified
examples include imports of `panel-layout.js`, `ui-parts.js`,
`ui-primitives.js`, `canvas-types.js`, `tree-widget.js`, and
`empty-states.js` from modules such as zine, sy2-chronicles, e026-demo,
heartbeat, and patchbay-lab.

### Expected files

- `src/services/module-loader.ts`
- `src/services/microapp-sdk.ts`
- representative modules in `modules/` and `modules-private/`
- docs/spec updates if contract changes

### Tasks

- [x] audit the current `createWindow()` registration flow and document why the defer exists
- [x] replace or reduce `setTimeout(ensureRegistered, 0)` lifecycle reliance only if an explicit lifecycle hook preserves the same guarantees
- [x] define explicit redraw/invalidate guidance for modules
- [x] tighten `describeState()` expectations for microapps
- [x] re-export missing shared helpers through `microapp-sdk.ts` where module authors currently reach into `src/core/*`
- [x] migrate at least two representative modules to the improved contract and SDK import path
- [x] identify a shared architecture for embedding animated subwindows or animated surfaces inside other modules, with `modules/zine/index.ts` and `modules/touchlab-mvp/` as target consumers if feasible
- [x] check workspace restore behaviour for touched modules

### Acceptance criteria

- [x] AC-1: microapp registration semantics are explicit and documented, including the ordering guarantee that the old defer was providing
- [x] AC-2: redraw/invalidation policy for microapps is clearer than “call `host.screen.render()` whenever”
- [x] AC-3: at least two representative modules use the new pattern cleanly
- [x] AC-4: module `describeState()` remains trustworthy for `/state` and agent use
- [x] AC-5: the SDK import anti-pattern is reduced in the touched modules by routing shared helpers through `microapp-sdk.ts`
- [x] AC-6: existing modules remain compatible during the transition; this is not a flag-day rewrite
- [x] AC-7: the story records whether a shared animated-subwindow architecture for `modules/zine/index.ts` and `modules/touchlab-mvp/` is feasible now, deferred, or partially landed
- [x] AC-8: migrated modules preserve workspace restore correctness
- [x] AC-9: migrated modules preserve theme/restyle correctness with windows left open across a theme switch
- [x] AC-10: `bun run typecheck` passes

### Verification

- [x] representative module windows still open and close cleanly
- [x] workspace restore still works for migrated modules
- [x] theme switching with migrated modules open does not leave stale colours
- [x] first-run demo modules remain clean, legible, and agent-operable

### Current outcome note

The SDK import anti-pattern is now reduced in a first pass by re-exporting
missing helpers through `src/services/microapp-sdk.ts` and migrating multiple
modules (`patchbay-lab`, `e026-demo`, `zine`, and `sy2-chronicles`) away from
direct `src/core/*` imports for the touched helpers.

`module-loader.ts` now documents the registration ordering guarantee explicitly
and reduces the old `setTimeout(ensureRegistered, 0)` defer to a microtask,
which preserves the same setup contract with less event-loop drift.

Shared animated-subwindow architecture is NOT fully landed here. Current status:
partially-landed / deferred. Existing primitives such as
`createLazyMountedPlayer`, `createContourPlayer`, and the touched `zine` /
`patchbay-lab` import cleanup prove the shape, but the fuller reusable embedding
contract remains future work for S11 and S12.

### Out of scope for this story

- module format redesign
- marketplace/remote module registry
- converting every module in one pass

---

## S04 — Thin the composition root

Status: done
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

- [x] identify one coherent extraction seam besides editor handling
- [x] extract a focused collaborator or family coordinator
- [x] reduce opportunistic utility logic in `app-controller.ts`
- [x] keep dependency wiring explicit rather than hidden through globals
- [x] preserve command, API, and workspace restore behaviour

### Acceptance criteria

- [x] AC-1: `app-controller.ts` is materially thinner or more clearly sectioned
- [x] AC-2: one new focused collaborator owns a coherent window/service family
- [x] AC-3: command routing still flows through the canonical command system
- [x] AC-4: touched surfaces preserve command and API parity
- [x] AC-5: touched surfaces preserve workspace restore correctness
- [x] AC-6: `bun run typecheck` passes

### Verification

- [x] startup, menuing, workspace restore, and control API still function
- [x] touched window families still open via commands and restore correctly
- [x] no regressions in `/commands/list`, `/state`, or window focus behaviour

### Current outcome note

A new `src/core/shell-chrome.ts` collaborator now owns desktop wallpaper,
status-line rendering, top identity widgets, dev restart chrome, resize repaint,
and chromeless toggling. `app-controller.ts` remains the composition root, but
this shell-only behaviour is now wired through one focused owner instead of
sprawling across the controller body.

### Out of scope for this story

- replacing `app-controller.ts` with a global app runtime
- moving every opener out of the controller
- control API redesign

---

## S05 — API contract audit and control-surface cleanup

Status: done
Depends on: none
Risk: medium

### User story

As an external operator or agent integration author, I want the control API to
feel deliberately designed rather than quickly accreted, so I can discover it,
trust it, and extend against it without guessing which routes are canonical.

### Why this story exists

The same kind of architectural scrutiny applied to Blessed and TypeScript
ownership should also be applied to the API. `control-api.ts` already provides
real value, but it likely has some fast-grown edges: alias routes, overlapping
command surfaces, and contracts that are useful but not always as crisp as the
rest of the architecture. This story audits the API with the same calm,
repo-specific standards used elsewhere in the epic.

### Expected files

- `src/services/control-api.ts`
- `src/services/agent-tools.ts`
- `src/core/command-registry.ts`
- `src/core/command-catalog.ts`
- `src/services/state-service.ts`
- `.agents/specs/state-and-api.md`
- any touched tests under `src/tests/`

### Tasks

- [x] audit the current endpoint catalogue for overlap, drift, ambiguous aliases, and legacy cruft
- [x] identify which routes are canonical versus backward-compat alias paths
- [x] remove alias or backward-compat routes that are no longer justified, rather than preserving them by default
- [x] tighten route naming and documentation where the API currently feels vibe-engineered
- [x] ensure `GET /help`, `GET /openapi.json`, command routes, and live state descriptions agree
- [x] check parity between control API routes and agent/control tooling where they overlap
- [x] add tests for any new pure-ish API normalization helpers or touched endpoint behaviour
- [x] update state/API docs so the cleaned contract is written down, not left in code only

### Acceptance criteria

- [x] AC-1: the API has a clearer distinction between canonical routes and backward-compat aliases
- [x] AC-2: unjustified alias or legacy routes touched by the story are retired rather than preserved automatically
- [x] AC-3: `GET /help`, `GET /openapi.json`, and the real handlers agree on touched routes and shapes
- [x] AC-4: touched control routes preserve or improve command/state parity for agents and external operators
- [x] AC-5: any remaining backward-compat path is explicitly justified and documented rather than retained by inertia
- [x] AC-6: touched API seams have direct test coverage where practical
- [x] AC-7: `.agents/specs/state-and-api.md` is updated if the contract changes
- [x] AC-8: `bun run typecheck` passes

### Verification

- [ ] `GET /help` is accurate
- [ ] `GET /openapi.json` is accurate
- [ ] representative `GET /state`, command, window, and alias routes behave as documented
- [ ] agent/control tooling still works on touched routes

### Out of scope for this story

- replacing the control API framework wholesale
- deleting every alias route in one pass
- inventing a second control surface parallel to the existing one

---

## S06 — Cell-aware text correctness and Unicode discipline

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

Known bad-case anchors for this story include problematic private primers with
mixed-width characters, narrow sidebar/list truncation, ANSI-styled text width
drift, and framed or figlet-adjacent text around mixed-width characters.

Known troublesome ASCII / Unicode-heavy primers to test:

- `modules-private/wibwob-primers/primers/cosmic-horror.txt`
  - repro note: drag a primer window while showing this file; known render corruption exists
  - screenshot reference: `/var/folders/00/hh5g78b97blgb_7dlj2plsrc0000gn/T/pi-clipboard-22ef905e-bc57-4404-9f3d-54c8fbe299de.png`
- `modules-private/wibwob-primers/primers/graveyard-emoji-flow.txt`
  - screenshot reference: `/var/folders/00/hh5g78b97blgb_7dlj2plsrc0000gn/T/pi-clipboard-eeba5096-4476-4614-988b-a60093cdbd9a.png`
- `modules-private/wibwob-primers/primers/conscious-matrix-1.txt`
  - screenshot reference: `/var/folders/00/hh5g78b97blgb_7dlj2plsrc0000gn/T/pi-clipboard-b4afe3b2-0706-4713-8598-04fd5a2b247a.png`

### Expected files

- `src/core/grid-canvas.ts`
- `src/core/ansi-utils.ts`
- `src/services/content-measurement.ts`
- text/list/sidebar-heavy windows and modules
- any follow-on spec or planning notes

### Tasks

- [ ] audit the known bad Unicode/cell-width failure surfaces first
- [ ] define one shared text-width / truncation rule for touched surfaces
- [ ] reduce ad hoc width assumptions in list/sidebar/text rendering
- [ ] test whether `libncursesw` wide-character behaviour is useful reference material or toolkit input for fixing complex ASCII-art rendering bugs
- [ ] fix at least one primer-facing or module-facing Unicode bug class
- [ ] document remaining hard cases and the follow-on boundary

### Acceptance criteria

- [ ] AC-1: at least one shared rule/helper exists for touched width/truncation cases
- [ ] AC-2: identified Unicode failure cases reproduce before and pass after
- [ ] AC-3: primer/module surfaces with mixed-width text behave more predictably
- [ ] AC-4: touched surfaces preserve ANSI-coloured text behaviour where expected
- [ ] AC-5: follow-on scope for deeper cell-rendering work is documented clearly
- [ ] AC-6: touched API or state descriptions do not regress because of text-width fixes where relevant
- [ ] AC-7: `bun run typecheck` passes

### Verification

- [ ] visual review of known problematic primers/assets
- [ ] text-heavy windows still align correctly after changes
- [ ] no obvious regressions in ANSI-coloured content or figlet framing

### Out of scope for this story

- solving all Unicode rendering in the whole app
- replacing string rendering with a full cell engine everywhere
- theme/token redesign

---

## S07 — Visual regression, render telemetry, and dense-scene performance checks

Status: done
Depends on: none, then coordinate with S01
Risk: medium

### User story

As an operator of WibWob-DOS, I want evidence that complex scenes remain
responsive and visually correct as the desktop grows denser and more animated.

### Why this story exists

The long-term target includes very large terminals or projected displays with
many windows, complex art, and live movement. Performance and memory use are
not polish items; they are product constraints.

This story can start before S01 fully lands: instrumentation, artifact format,
and scene definition work are useful immediately. Scheduler-aware interpretation
of the results can then tighten later.

Known animated surfaces to include in render-controller and dense-scene smoke
coverage:

Core windows / window families:
- `src/windows/generative-windows.ts`
- `src/windows/plasma-window.ts`
- `src/windows/terrain-lab-window.ts`
- `src/windows/contour-window.ts`
- `src/windows/monster-cam-window.ts`
- `src/windows/music-player-window.ts`
- `src/windows/browser-windows.ts` (animated text / primer playback)
- `src/windows/backrooms-windows.ts` (fallback playback timers)
- `src/windows/backrooms-log-browser-window.ts` (refresh timer)

Animated or timer-driven modules:
- `modules/glitchbox/`
- `modules/heartbeat/`
- `modules/touchlab-mvp/`
- `modules/patchbay-lab/`
- `modules/wibwob-poetry-clock/`
- `modules/sy2-chronicles/`
- `modules/e026-demo/`
- `modules/zine/`

Minimum must-test anchors from the human's explicit list:
- `modules/glitchbox/`
- `modules/heartbeat/`
- `src/windows/generative-windows.ts`
- `src/windows/plasma-window.ts`
- `src/windows/terrain-lab-window.ts`
- `src/windows/contour-window.ts`
- `src/windows/monster-cam-window.ts`

### Expected files

- `src/core/render-monitor.ts`
- smoke/verification scripts under `scripts/`
- selected live windows or test helpers
- planning/docs updates for verification canon

### Tasks

- [x] strengthen render telemetry so redraw pressure is easier to observe
- [x] define at least one concrete artifact format for evidence capture
- [x] define one dense-scene benchmark scenario
- [x] record provisional behaviour expectations for render speed and stability
- [x] note memory/perf blind spots honestly if tooling is still partial

### Acceptance criteria

- [x] AC-1: render telemetry is easier to read and use during smoke testing
- [x] AC-2: at least one dense-scene visual smoke workflow exists and is repeatable
- [x] AC-3: the first benchmark scene is named explicitly: 12 windows open including at least 2 animated surfaces such as Monster Cam and Music Player viz
- [x] AC-4: the evidence format is concrete, for example tmux text dump plus screenshot plus render-monitor readout
- [x] AC-5: provisional behaviour expectations are written down, for example whether the render loop stays under roughly 200ms per frame in the benchmark scene
- [x] AC-6: performance notes are captured in docs, not left as chat-only lore
- [x] AC-7: a dense-scene smoke pass includes visual evidence plus at least one textual evidence artefact
- [x] AC-8: `bun run typecheck` passes for any code touched

### Verification

- [x] run the dense-scene smoke workflow
- [x] capture screenshots or text evidence for the chosen scenario
- [x] visually confirm the app remains usable in tmux during the test

### Out of scope for this story

- production-grade profiling suite
- solving every performance bottleneck in one pass
- GPU-accelerated or alternate-runtime rendering

---

## S08 — Runtime telemetry, stats surface, and agent/session health metrics

Status: done
Depends on: none, then coordinate with S01 and S07
Risk: medium

### User story

As a developer or operator in a debugging session, I want one obvious stats
surface so I can see render FPS, frame timing, RAM usage, and key agent/session
health signals while the app is running, without inventing ad hoc probes.

### Why this story exists

The repo already has a useful primitive sitting unused: `createRenderMonitor(screen)`
in `src/core/render-monitor.ts`. It can measure render FPS and frame timing, but
nothing in the shell currently wires it up. The shell also has no debug/stats
flag or diagnostics surface beyond environment variables, and Monster Cam’s FPS
readout is service-level camera FPS rather than desktop render FPS.

This story turns telemetry from a hidden primitive into a real operator tool.
It should also think beyond render alone: if future multiple-agent setups matter,
we need at least a first pass at session-health visibility for the in-app agent.

It also needs to cover terminal recursion. The PTY-backed terminal module makes
WibWob-DOS able to run inside WibWob-DOS, and the human has already pushed this
four levels deep. So telemetry and smoothness checks should not assume a
single-level desktop only. We need to know whether the terminal app still feels
smooth, preserves API/agent affordances, and degrades sanely under recursive
use.

Reference bug / architecture anchor for terminal recursion work:
- fix context: `a2f5a8da0a4b6f94ce41db38e5349c7211b1a2da`
- initial terminal architecture summary worth preserving:
  `feat(terminal): PTY-backed terminal emulator module`
  `Architecture: Bun process <-> Node bridge (pty-bridge.cjs) <-> node-pty <-> real PTY`

### Expected files

- `src/core/render-monitor.ts`
- `src/core/app-controller.ts`
- `src/core/cli.ts` or the nearest startup/config seam if a debug/stats flag is added
- `src/services/wibwob-agent-session.ts`
- `src/windows/wibwob-agent-window.ts`
- `modules/terminal/index.ts`
- optional diagnostics surface under `src/windows/` or as a small microapp
- docs / AGENTS updates if a new debug mode or stats command is introduced

### Tasks

- [x] wire the existing render monitor into the shell in a controlled way
- [x] decide the first operator surface: top-right indicator, help-menu diagnostics window, command palette action, or small diagnostics microapp
- [x] decide the first debug gate: env var, startup flag, dev-only surface, or explicit command
- [x] expose at least render FPS, frame timing, and RAM usage in the chosen surface
- [x] add a first pass at agent/session health stats that are actually useful, such as active agent window/session presence, turn/streaming status, or message/tool counts where available
- [x] test recursive WibWob-DOS-in-terminal runs and record what still works at multiple depths, including API reachability and agent affordances
- [x] keep the surface lightweight and non-invasive, ideally dev-only by default if always visible chrome would clutter the desktop
- [x] document how operators turn the stats surface on and what each metric means

### Acceptance criteria

- [x] AC-1: the existing render-monitor primitive is used by a real shell-visible or command-visible diagnostics path
- [x] AC-2: the chosen stats surface reports render FPS and frame timing from shell-level render monitoring, not only service-local FPS
- [x] AC-3: the chosen stats surface reports RAM usage from the running process
- [x] AC-4: the chosen stats surface includes at least one useful Wib&Wob agent/session health signal beyond raw render stats
- [x] AC-5: terminal-recursive WibWob-DOS runs are exercised as part of the telemetry story, with findings recorded for at least more than one depth level
- [x] AC-6: the story records whether API access and key agent affordances remain usable through recursive terminal runs, and where they degrade
- [x] AC-7: the stats surface can be turned on intentionally and does not become unavoidable chrome for normal users unless explicitly desired
- [x] AC-8: if a flag or env var is introduced, it is documented and wired cleanly at startup
- [x] AC-9: touched telemetry seams have direct test coverage where practical
- [x] AC-10: `bun run typecheck` passes

### Verification

- [x] enable the stats surface and verify FPS/frame timing/RAM visibly update during runtime
- [x] confirm the render numbers change under a dense-scene benchmark rather than staying static
- [x] confirm at least one agent/session metric changes meaningfully during agent activity
- [x] run at least a recursive terminal smoke path and record what happens to FPS/RAM/agent affordances across depth
- [x] visually verify the diagnostics surface does not make the normal desktop unusable

### Current outcome note

A first S08 slice is landed but not closed. The shell now has an optional
runtime stats badge controlled by the `--stats` CLI flag. It reports shell-level
render FPS, average frame time, RAM usage, and basic in-app agent activity.
The implementation lives in `src/core/runtime-stats.ts` and is wired from
`app-controller.ts`.

A structured operator endpoint now exists at `GET /runtime/stats`, which makes
it easier to capture evidence for later dense-scene and recursion passes without
screen-scraping the top bar. Operator usage and metric vocabulary are documented
in `docs/runtime-stats-surface.md`.

Recursive smoke completed on the `a1c` instance. After fixing two terminal
module issues (spawn-helper not executable after bun install, and writeInput
not wired through the microapp SDK onInput path), nested WibWob-DOS runs
successfully inside a terminal window:

- outer instance on port 8102, nested on port 8103
- both /health and /runtime/stats respond at both levels
- stats badge visible in both outer and nested menu bars
- agent message counts change correctly through the API
- keyboard input from the human does not reach the terminal widget (blessed
  focus path issue, pre-existing and out of scope for S08)
- API-driven input via /windows/input works for automation

Evidence: `scratch/evidence/e033-s08-recursive-smoke.md`

### Out of scope for this story

- full observability platform
- remote telemetry backend
- perfect per-window profiling
- solving all future multi-agent monitoring in one pass

---

## S09 — WibWobTUI macOS-ification for app launch and switching

Status: not-started
Depends on: none
Risk: medium

### User story

As a human operator, I want to switch between running apps and launch apps
faster through a TUI-fied macOS-like launcher/switcher surface, so opening or
focusing an app feels instant and legible rather than buried in menus and
commands.

### Why this story exists

The desktop already has windows, commands, menus, and modules, but the app
launch and app-switch flow is still more operator-knowledge-heavy than it
should be. A TUI-native macOS-like surface could make the system feel more
immediate: click or focus an app icon-ish entry to open it instantly, show
running indicators, and use one consistent surface to launch or jump to an
existing app.

The goal is not to clone Finder or Dock literally. The goal is to translate the
best interaction patterns into terminal-native form: recognisable app entries,
running-state indicators, instant open/focus, and faster switching between live
windows or app types.

### Expected files

- `src/core/app-controller.ts`
- `src/core/command-registry.ts`
- `src/core/command-catalog.ts`
- relevant launcher/switcher UI surface under `src/core/` or `src/windows/`
- `src/services/state-service.ts` if running indicators need stronger semantic state
- touched docs if this becomes a canonical launch path

### Tasks

- [ ] define the TUI-native launcher/switcher surface: dock-like strip, app shelf, finder-like launcher, or similar
- [ ] use canonical command metadata rather than inventing a parallel app registry
- [ ] support instant open for unopened apps and instant focus/jump for already-running ones
- [ ] add running indicators or equivalent TUI state cues for active apps
- [ ] make the surface mouse-friendly and keyboard-friendly
- [ ] ensure the interaction feels macOS-inspired but terminal-native, not a fake pixel clone

### Acceptance criteria

- [ ] AC-1: there is one clear launcher/switcher surface for opening and focusing apps faster
- [ ] AC-2: clicking or selecting an app entry opens it if absent and focuses it if already running
- [ ] AC-3: the surface shows running-state indicators or equivalent cues for active apps
- [ ] AC-4: the implementation reuses canonical command/state sources rather than inventing a second app registry
- [ ] AC-5: the surface works with both mouse and keyboard interaction
- [ ] AC-6: `bun run typecheck` passes

### Verification

- [ ] open multiple apps and verify the launcher/switcher can jump between them quickly
- [ ] verify unopened apps launch directly from the surface
- [ ] visually verify indicators update as apps open and close
- [ ] confirm the surface feels faster than the current menu-only path for common app switching

### Out of scope for this story

- pixel-perfect macOS imitation
- replacing the command palette
- full desktop shell redesign

---

## S10 — Third-party developer docs for custom modules

Status: done
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

- one long doc or a small family of docs under `docs/`
- `modules/README.md` as a landing pointer if needed
- `src/services/microapp-sdk.ts` if exports need cleanup for docs accuracy
- representative example modules in `modules/`

### Tasks

- [x] choose doc shape: one long page or a small doc family
- [x] document the module mental model: manifest, setup, commands, window creation, cleanup, restyle, state reporting
- [x] document the preferred SDK import path and anti-patterns
- [x] include one minimal app example and one stateful/live app example
- [x] include first-run guidance for where custom apps live in `/modules`
- [x] include verification steps for making a new app appear in the running desktop

### Acceptance criteria

- [x] AC-1: there is a clear third-party developer doc path for building custom apps under `/modules`
- [x] AC-2: docs describe the canonical path without requiring direct imports from random `src/core/*` files
- [x] AC-3: docs include one minimal module example and one stateful/live example
- [x] AC-4: docs explain `describeState()`, cleanup, restyle, invalidation, and command registration expectations
- [x] AC-5: docs are accurate against the post-S03 host contract
- [x] AC-6: a first-time developer can follow the docs to add a new module and see it appear in the app

### Verification

- [x] follow the docs with a fresh minimal test module or update an example module accordingly
- [x] visually verify the module appears in the running app
- [x] verify linked examples and file paths are correct

### Outcome note

One long doc at `docs/building-custom-modules.md` covers the full module
authoring path: manifest, entry point, host API, required lifecycle hooks,
animation, SDK imports, workspace persistence, and a verification checklist.
References hello-world and heartbeat as examples, plus the scaffold script.

### Out of scope for this story

- hosted module registry
- package manager integration
- full public docs site redesign

---

## S11 — Composable animated surfaces for zine, touchlab, and future dashboard modules

Status: not-started
Depends on: S03, S07
Risk: medium

### User story

As a module author building editorial or dashboard-style surfaces, I want a
shared way to embed animated windows or animated players as subsurfaces inside
other modules, so I can compose motion-rich layouts in `modules/zine/`,
`modules/touchlab-mvp/`, and future modules without inventing bespoke
embedding code each time.

### Why this story exists

The epic already identifies a future desire to support animated subwindows in
`modules/zine/index.ts` and `modules/touchlab-mvp/`. The module and telemetry
stories also surfaced a broad set of animated windows and timer-driven modules.
If composability matters, it should become a first-class architecture story
rather than a vague stretch wish.

This story should prefer one shared architecture over one-off embedding paths.
It can build on existing animation primitives such as `createAnimatedPanel`,
`createLazyMountedPlayer`, and related SDK exports, but the outcome should be a
clear reusable pattern rather than two special-case integrations.

### Expected files

- `src/services/microapp-sdk.ts`
- `src/services/animation-service.ts`
- `src/core/ui-parts.ts`
- `modules/zine/index.ts`
- `modules/touchlab-mvp/`
- any shared helper extracted for animated embedding
- docs or notes for the pattern if the contract changes

### Tasks

- [ ] audit the existing animated-surface primitives and current embedding patterns
- [ ] define the shared architecture for composable animated subsurfaces
- [ ] identify the minimum contract needed for embedding an animated player or animated window fragment inside another module
- [ ] implement the shared path in reusable code rather than per-module hacks
- [ ] adopt the shared path in `modules/zine/` and `modules/touchlab-mvp/` if feasible in this epic pass, or land one adopter and record the second as a concrete follow-on
- [ ] verify the new path plays nicely with restyle, resize, cleanup, and window lifecycle

### Acceptance criteria

- [ ] AC-1: there is a named shared architecture or helper path for embedding animated subsurfaces inside modules
- [ ] AC-2: the path is reusable and not specific only to `zine` or only to `touchlab-mvp`
- [ ] AC-3: at least one real module adopter uses the shared path successfully
- [ ] AC-4: feasibility and next-step status for both `modules/zine/` and `modules/touchlab-mvp/` are recorded clearly
- [ ] AC-5: the embedded animated path preserves cleanup, resize, and restyle correctness
- [ ] AC-6: the shared path does not require modules to bypass the SDK and reach into random `src/core/*` internals
- [ ] AC-7: `bun run typecheck` passes

### Verification

- [ ] open the adopter module and verify the embedded animated surface renders correctly
- [ ] resize the containing module/window and confirm the animated subsurface adapts or degrades predictably
- [ ] switch themes and confirm no stale-colour leakage
- [ ] close the module and confirm timers / animation resources clean up cleanly

### Out of scope for this story

- making every existing animated window embeddable in one pass
- solving general nested-window layout for the whole OS
- replatforming all animation around a new rendering engine

---

## S12 — TouchDesigner-like composition scaffolding for ASCII / ANSI art modules

Status: not-started
Depends on: S03, S11
Risk: medium

### User story

As a creator building terminal-native visual compositions, I want a small set of
shared composition primitives inspired by TouchDesigner so I can patch, layer,
mix, preview, and animate ASCII / ANSI art surfaces inside WibWob-DOS without
rewriting a bespoke mini-engine for every creative module.

### Why this story exists

`modules/touchlab-mvp/` already points toward this future: it has source nodes,
a mix node, nested frames, a canvas, inspector controls, and simple animation.
That makes it more than a toy; it is an early proof that WibWob-DOS wants a
terminal-native composition language.

Thinking in TouchDesigner terms, the useful transferable ideas are not the full
app metaphor or GPU pipeline. The useful ideas are smaller and fit the TUI:
source operators, transform/composite operators, parameter controls, preview vs
output surfaces, reusable graph/player contracts, and a way to treat animated
ASCII/ANSI content as composable materials rather than isolated windows.

One additional technical angle is worth keeping in scope here: Blessed can
manually route a `blessed.screen()` instance to arbitrary duplex streams. If
that proves workable in this repo, it may offer a surprisingly powerful path
for piping one Blessed surface into another widget or composition container.
That does not mean "nest full apps everywhere" by default, but it is highly
relevant reference material for embeddable composition work and should be
investigated before inventing a more complicated bespoke path.

This story should identify the minimum shared scaffolding needed for those
possibilities and land it in a form that future creative modules can reuse.

### Expected files

- `modules/touchlab-mvp/index.ts`
- `modules/zine/index.ts`
- `src/services/microapp-sdk.ts`
- `src/services/animation-service.ts`
- `src/core/ui-parts.ts`
- any new shared composition helper under `src/core/` or `src/services/`
- supporting docs if the pattern becomes part of the public module contract

### Tasks

- [ ] audit what `modules/touchlab-mvp/` already proves: source generation, mixing, nested node frames, inspector state, animation toggle, and simple compositing
- [ ] define the smallest reusable composition vocabulary for TUI art modules, for example source, transform, mix, output, parameter, and preview
- [ ] test whether Blessed custom duplex stream routing can help embed one Blessed surface inside another composition surface before inventing a more bespoke architecture
- [ ] decide which parts belong in shared code versus staying module-local experimentation
- [ ] extract one or more shared helpers or contracts that let modules compose animated ASCII / ANSI surfaces without reaching into random internals
- [ ] verify the scaffolding can serve both a patch-oriented creative module (`modules/touchlab-mvp/`) and a layout/editorial surface (`modules/zine/` or similar)
- [ ] document what is intentionally not being copied from TouchDesigner, so scope stays terminal-native and honest

### Acceptance criteria

- [ ] AC-1: the story defines a named shared composition vocabulary for ASCII / ANSI art modules rather than leaving TouchLab as a one-off experiment
- [ ] AC-2: at least one shared helper, contract, or primitive is extracted from the composition work and is usable outside `modules/touchlab-mvp/`
- [ ] AC-3: the scaffolding is demonstrated in at least one second context beyond TouchLab, or that second-context feasibility is recorded concretely with blockers
- [ ] AC-4: the story records whether Blessed custom stream routing is useful, irrelevant, or too awkward for the composition architecture, so the question is closed for future implementers
- [ ] AC-5: the shared path works with animated surfaces and not only static text blocks
- [ ] AC-6: the design stays terminal-native and does not require React, webview, or GPU-style assumptions
- [ ] AC-7: the extracted path remains compatible with module cleanup, resize, restyle, and state reporting expectations
- [ ] AC-8: `bun run typecheck` passes

### Verification

- [ ] open TouchLab and verify the composition scaffolding still supports animated source → mix → output style behaviour
- [ ] exercise the shared path in at least one second module or prototype surface
- [ ] verify resize, theme switch, and close cleanup remain correct
- [ ] confirm the resulting pattern is understandable enough to document for future module authors

### Out of scope for this story

- cloning TouchDesigner feature-for-feature
- real-time shader graphs or GPU effects
- node editor UI for the entire OS
- replacing windows with a full patcher runtime

---

## Consolidated acceptance criteria

- [ ] AC-1: Blessed remains the runtime; no runtime migration is required for the epic to succeed
- [ ] AC-2: render/invalidation ownership is more explicit than at spike time
- [ ] AC-3: at least two live or complex surfaces show a cleaner local state/event/render pattern
- [ ] AC-4: microapp lifecycle and redraw semantics are clearer for module authors
- [ ] AC-5: `app-controller.ts` is thinner and more obviously a composition root
- [ ] AC-6: Unicode/cell correctness improves on at least one known bad surface
- [ ] AC-7: visual regression and render telemetry improve materially
- [ ] AC-8: a real stats/diagnostics surface exists for development-time runtime observation, including render stats and basic process or agent health signals
- [ ] AC-9: hero modules remain clean first-run demos after the refactors
- [ ] AC-10: touched surfaces preserve workspace/snapshot restore correctness
- [ ] AC-11: touched surfaces preserve command and API parity
- [ ] AC-12: touched surfaces preserve theme/restyle correctness
- [ ] AC-13: there is a clear third-party developer doc path for building custom apps under `/modules`
- [ ] AC-14: there is a reusable path for composing animated subsurfaces inside module-driven editorial or dashboard layouts
- [ ] AC-15: there is a shared, terminal-native composition vocabulary or helper path for TouchDesigner-like ASCII / ANSI art composition work
- [ ] AC-16: `/state`, commands, and visible behaviour stay aligned for touched surfaces
- [ ] AC-17: `bun run typecheck` passes

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

## Cross-cutting cleanup principle

When this epic touches legacy code, legacy commands, alias routes, or compatibility
shims, the default should be removal once they are proven unnecessary.

Do not keep backward-compat cruft by habit.

If a legacy path remains, the burden is to justify it explicitly in code and
in docs. If it no longer serves a real user, operator, agent, workspace, or
migration need, retire it.

## Parallel work: a2 lane

a2 is building ESLint SDK boundary enforcement (tier 1) on their branch:
- `eslint.config.js` with `no-restricted-imports` scoped to `modules/**`
- bans `../../src/core/*` and `../../src/services/*` except `microapp-sdk`
- `lint` script in `package.json` (opt-in, not wired into typecheck)
- fixes violations in modules a2 already touched (patchbay, zine, sy2, e026, dream-forecast)
- tier 2 (tsconfig paths alias `@wibwob/sdk`) and tier 3 (separate tsconfig for modules) noted but NOT approved yet

## ESLint opportunities beyond SDK boundary

Places where lint rules would catch real bugs or drift we have hit:

1. **SDK boundary** (tier 1, a2 building now) — modules importing src/core internals
2. **No floating promises** — async handlers in control-api and agent-tools that
   forget `await`, causing silent swallowed errors. `no-floating-promises` via
   typescript-eslint would catch these.
3. **Consistent type imports** — `import type` vs value import. We have a mix;
   `consistent-type-imports` would enforce the `type` keyword and help tree-shaking.
4. **No unused vars** — TypeScript noUnusedLocals is off; an eslint rule would
   catch dead locals without needing a tsconfig change.
5. **Blessed style object shape** — not lintable with stock rules, but a custom
   rule or type-narrowing pattern could catch `style: { fg: "red" }` where
   the theme object was expected (a recurring bug source in restyle hooks).
6. **Timer cleanup enforcement** — modules that call setInterval without
   registering in a cleanup set. Not trivially lintable but a custom rule
   scanning for `setInterval` without `createTimer` in module files would help.

Priority: 1 now (a2), 2+3+4 next time we touch eslint config, 5+6 only if
the pattern keeps causing regressions.

## Stretch / later follow-on

- investigate flexbox-like responsive layout only for `zine`-class editorial surfaces
- deepen cell-aware rendering into a shared engine path if S05 proves the need
- add denser performance scenes once render telemetry and smoke scripts mature

## Branch

`epic/e033-blessed-architecture-calm`
