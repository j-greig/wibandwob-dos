# WibWob-DOS — GPT-5.4 Agent Prompt

You are inside the WibWob-DOS repository, working from the repo root (the directory above `/src`). Your job is to continue architectural and implementation work on the TypeScript terminal UI app without losing its current spirit.

This is not a greenfield app. It already has real structure, real modules, real windowing, real persistence, real agent affordances, and a distinct creative identity. You are here to make it clearer, more modular, more testable, and more internally legible while preserving the lived feel of the system.

The human wants to keep **Blessed**. Do not waste time trying to migrate the app to unblessed, Bubble Tea, Go, Ink, OpenTUI, or another framework unless explicitly asked. The gain sought here is **architectural clarity**, not library churn.

The key conceptual frame is:

**Bring Elm Architecture thinking into a Blessed TypeScript app, without pretending Blessed itself is Elm.**

Elm architecture: https://guide.elm-lang.org/architecture/
NOTE: source at https://github.com/evancz/guide.elm-lang.org/tree/master/book/architecture

That means:

* explicit state
* typed intents/messages
* predictable update flow
* render as a consequence of state, not random widget mutation from everywhere
* effects handled deliberately
* windows and services with clearer ownership
* a thinner composition root

You are not here to force ideological purity. You are here to evolve the app toward a better internal shape.

---

## 1. What the human wants

Infer and hold these intentions throughout:

1. Keep the current WibWob-DOS identity.

   * It is a weird desktop-like terminal world, not a generic enterprise dashboard.
   * It has windows, modules, chat/agent surfaces, creative microapps, and a sense of character.

2. Keep Blessed.

   * The human has already decided there is no benefit in switching libraries right now.
   * You may borrow ideas from Elm and Bubble Tea, but not their runtimes.

3. Improve architecture by tightening logic flow.

   * Reduce event-handler soup.
   * Reduce giant-controller drift.
   * Reduce hidden widget state.
   * Reduce duplicated render/persist/sync logic.

4. Think in a Blessed-first Elm-ish way.

   * Model -> messages -> update -> render -> effects.
   * Blessed is the IO/render commit layer.
   * Do not try to make Blessed widgets themselves pure.

5. Respect working code and existing seams.

   * Refactor through existing architecture where possible.
   * Prefer extraction, clearer ownership, and better contracts over dramatic rewrites.

6. Improve agent legibility and control.

   * This app is meant to be equally operable by a human and by an agent.
   * State descriptions, commands, window metadata, and control surfaces matter.

7. Preserve the existing modular philosophy.

   * `src/` contains the shell/runtime/core.
   * `modules/` and `modules-private/` hold microapps and domain apps.
   * Microapps are real citizens of the desktop.

---

## 2. My current reading of the codebase

You should verify this yourself in the repo, but start from this working model.

### High-level shape

The repo appears to have:

* `src/core/` for the shell, controller, windowing, command system, chrome, overlays, geometry, theme-adjacent pieces, snapshots, and UI primitives
* `src/services/` for state, content, workspace, editor, control API, domain logic, media/animation/tooling, world chat, agent session, and various service helpers
* `src/windows/` for concrete window factories and window families
* `modules/` and `modules-private/` for microapps and content packages

This is good news: the app already has real structure. The task is not to invent architecture from nothing, but to continue decomposition and make the flow more explicit.

### Strong existing seams

These look like good foundations, not throwaway code:

* `app-controller.ts`

  * composition root and runtime coordinator
  * owns screen setup, service graph, menus, startup, workspace restore, global keybindings, theme application, control API wiring, and high-level command flow
  * important but still too large

* `command-catalog.ts`

  * appears to be the source of truth for user-visible commands and metadata
  * this is a strong candidate for a future intent vocabulary or command-to-message bridge

* `command-registry.ts`

  * execution layer over command metadata
  * likely useful as a dispatch boundary

* `window-manager.ts`

  * likely central for z-order, focus, drag, resize, close, stacking, and window lifecycle
  * this is a critical place where runtime state and Blessed frame mutation probably meet

* `editor-coordinator.ts`

  * already a meaningful extraction
  * appears to own editor open/save/dirty/render/keypress behavior
  * already gets injected `syncLiveState` and `persistState` hooks, which is a strong sign that editor logic has begun separating from the main controller

* `state-service.ts`

  * canonical live desktop/app/window state
  * important for human visibility, control API, and agent access
  * likely still too dependent on distributed invalidation triggers, but conceptually sound

* `microapp-sdk.ts`

  * the contract between the shell and microapps
  * very important seam
  * currently useful, but likely still exposes too much direct imperative rendering behavior to modules

* `module-loader.ts`

  * module discovery and module wiring
  * key to keeping external apps integrated cleanly

### Likely rough edges / pressure points

This is my current take and should guide your audit:

1. `app-controller.ts` is still too broad.

   * It looks like a real composition root, but also still carries too much runtime policy and too many orchestration details.
   * Goal: keep it as the composition root, but remove opportunistic logic.

2. Render ownership is probably too distributed.

   * Many windows and microapps likely call `screen.render()` directly.
   * This is okay for tiny prototypes, but scales badly.
   * Goal: move toward explicit invalidation / render scheduling conventions.

3. Some widget mutation likely bypasses clear state ownership.

   * Blessed encourages direct mutation.
   * The codebase probably needs stronger conventions around where mutation is allowed.

4. Microapps may be slightly too imperative.

   * The current microapp pattern seems simple and productive, but likely lets apps own timers, direct widget updates, and direct screen renders.
   * That is not inherently wrong, but there should be clearer lifecycle and redraw policy.

5. Workspace restore and window lifecycle may have race edges.

   * Deferred registration patterns are worth investigating carefully.

6. There may be inconsistent patterns between windows.

   * Some likely follow a clean “service-owned logic, window-owned render” pattern.
   * Others likely bundle service logic, event handling, and widget mutation together.
   * Goal: identify the best existing pattern and standardise around it.

---

## 3. Explicit design stance: Elm thinking for WibWob-DOS

Do not force a fake Elm runtime into the app.

Instead, translate Elm Architecture into practical Blessed rules.

### The translation

Elm concept -> WibWob-DOS equivalent

* `Model`

  * explicit TS records for app state, window state, service state, editor state, chat state, etc.

* `Msg`

  * typed events/intents/actions represented as discriminated unions or clear command/event objects
  * not every part of the app needs one giant global union immediately
  * local window-level unions are fine

* `update(model, msg)`

  * reducer-like logic that computes next state and possibly effect descriptions
  * keep this pure where reasonable
  * not every single subsystem must be fully pure from day one, but aim in that direction

* `view(model)`

  * functions that derive widget content/layout/visibility from current state
  * in Blessed, this usually means “apply state to widgets” rather than returning a virtual tree

* `Cmd` / side effects

  * file I/O, timers, subprocesses, control API calls, agent session messages, network/chat transport, module loading, etc.
  * effects should be explicit and localised

### Blessed-specific rule

**Blessed is the render/IO layer, not the app architecture.**

So the preferred flow is:

1. external event occurs
2. translate it into a typed message / intent
3. update state
4. apply render changes from state
5. schedule or run side effects deliberately

Not this:

* key handler mutates widget
* timer mutates widget
* service callback mutates widget
* controller mutates widget
* then random `screen.render()` calls happen all over the place

### Pragmatic version

You are allowed to be hybrid.

Acceptable intermediate state:

* local model/update/render inside a complex window factory
* service-owned state with imperative render bridge
* controller-level dispatch for only some subsystems
* explicit invalidation even if rendering is still imperative under the hood

Unacceptable direction:

* expanding ad hoc widget mutation patterns
* more giant switchboards in `app-controller.ts`
* hidden behavior inside widget callbacks with no clear owner

---

## 4. Architecture goals

Your task is to move the codebase toward these goals.

### Goal A — thinner composition root

`app-controller.ts` should remain the composition root and startup orchestrator, but it should increasingly:

* wire dependencies
* start services
* delegate
* rebuild menus / shell chrome / workspace startup
* expose top-level app commands

It should increasingly **not**:

* own detailed behavior for specific window families
* absorb utility logic
* accumulate one-off event handling details
* become the only place where the system can be understood

### Goal B — stronger ownership boundaries

Prefer this split:

* **services own logic/state and domain behavior**
* **windows own layout, focus handling, event wiring, render, cleanup**
* **controller wires them together**
* **window manager owns window lifecycle and shell-level frame behavior**

### Goal C — explicit render policy

Introduce or strengthen conventions such as:

* who is allowed to call `screen.render()`
* when code should request invalidation instead of rendering immediately
* when batched rendering is appropriate
* which operations imply state sync and which imply persistence

The ideal end state is not necessarily one single render loop, but a clear rulebook.

### Goal D — clearer message/intent flow

Use the command system and local event vocabularies as stepping stones toward a more explicit architecture.

Examples:

* app-level commands can map to intents
* editor keystrokes can map to `EditorMsg`
* agent session events can map to `AgentWindowMsg`
* monster cam frame events can map to `MonsterCamMsg`

### Goal E — better local patterns for complex windows

Complex windows should ideally settle into a repeatable shape:

* local model
* typed messages/events
* service hooks / subscriptions
* render function
* cleanup function
* `describeState()` and `captureText()` wired clearly

This is where Elm thinking becomes most useful without forcing a global rewrite.

### Goal F — preserve agent legibility

The app is not only a GUI. It is a world an agent can inspect and operate.

That means:

* window state must remain meaningful
* command metadata must stay accurate
* control API parity matters
* `describeState()` is important
* workspace snapshots must stay trustworthy
* semantic app/window metadata matters as much as visuals

---

## 5. How to inspect the codebase

Before making changes, examine the repo methodically.

### Start with these files

At minimum, read these first:

* `src/core/app-controller.ts`
* `src/core/window-manager.ts`
* `src/core/editor-coordinator.ts`
* `src/core/command-catalog.ts`
* `src/core/command-registry.ts`
* `src/services/state-service.ts`
* `src/services/module-loader.ts`
* `src/services/microapp-sdk.ts`
* `src/services/workspace-service.ts`
* `src/windows/text-windows.ts`
* `src/services/editor-service.ts`
* `src/services/file-actions.ts`
* `src/windows/wibwob-agent-window.ts`
* `src/services/wibwob-agent-session.ts`
* `src/windows/monster-cam-window.ts`
* `src/services/monster-cam-service.ts`
* `src/core/overlay-manager.ts`
* `src/core/menu-overlay-manager.ts`

Then inspect representative modules under:

* `modules/`
* `modules-private/`

Include at least one simple microapp and one more stateful/interactive one.

### While reading, answer these questions

1. Where does state actually live?
2. Where is state duplicated?
3. Which code paths mutate Blessed widgets directly?
4. Who decides when `screen.render()` runs?
5. Who decides when live state sync runs?
6. Who decides when persistent state is written?
7. Which windows already have a good internal pattern?
8. Which windows are controllers in disguise?
9. Which services are pure-ish and which are secretly UI-coupled?
10. Which existing abstractions are good and should be reinforced rather than replaced?

### Specifically search for

* direct `screen.render()` calls
* `setContent`, `setLabel`, `setFront`, `focus`, geometry mutation, and style mutation scattered across files
* timers and intervals in windows and microapps
* `setTimeout(..., 0)` lifecycle or registration tricks
* duplicated persistence/sync calls
* windows with bespoke keyboard handling
* files that mix domain logic and render logic too tightly
* any hidden dependency on implicit Blessed textbox behavior

### Build a map

Write down:

* shell/core pieces
* service/domain pieces
* window/view pieces
* microapp boundary pieces
* persistence/snapshot pieces
* external control/agent pieces

Do not change code until you understand which boundary each file belongs to.

---

## 6. Working assumptions about specific areas

Use these as hypotheses to confirm or correct.

### `app-controller.ts`

Treat this as the main decomposition target.

Desired outcome:

* stays the app root
* delegates more
* becomes easier to read top-to-bottom
* loses opportunistic utility behavior
* gets clearer section ownership

When editing it:

* avoid adding more mixed concerns
* prefer extracting focused collaborators
* prefer explicit dependency injection over hidden imports when reasonable

### `EditorCoordinator`

This already looks like a successful extraction seam.

Use it as a model for future decomposition:

* one coherent owner
* injected dependencies
* clear API
* editor-specific behavior not smeared across the controller

If you find parallel opportunities elsewhere, copy this style.

### `CommandCatalog` and `CommandRegistry`

Treat these as foundational.

They likely give you:

* single source of truth for user-visible command metadata
* discoverability for menus, palette, API, and agent surfaces
* a possible bridge from imperative command execution toward intent-based dispatch

Do not fragment command metadata again.

If introducing richer message/intention flow, consider doing it by extending this system rather than bypassing it.

### `StateService`

This is probably the semantic state backbone.

Protect it.

The likely improvement area is not “replace it,” but:

* make state invalidation more systematic
* make `describeState()` conventions tighter
* reduce cases where a window changes materially without state sync

### `Microapp SDK`

This is one of the most important files in the repo.

The human wants modules and microapps to remain first-class.

So the SDK should evolve toward:

* stable lifecycle hooks
* clear registration semantics
* clear render/invalidation rules
* clear cleanup rules
* clean state reporting
* agent/control compatibility

Be cautious with breaking changes.

If you evolve the SDK, provide a migration path or keep compatibility.

### Workspace / snapshots / restore

This is one of the places where architecture gets real.

Any change here must preserve:

* window restoration accuracy
* focus restoration where intended
* semantic state integrity
* module/window restore reliability

Avoid subtle races.

---

## 7. Microapp stance

Microapps are not toys. Treat them as proper applications living inside the desktop.

Current microapp pattern seems roughly like:

* `module.json`
* `index.ts` setup(host)
* register command(s)
* open a window through the host
* add Blessed widgets to `win.body`
* optionally define lifecycle hooks: cleanup, restyle, resize, input, state description

This is productive and should stay.

But improve the contract over time.

### Preferred future microapp style

Encourage microapps to be written like this:

* small local state record
* explicit render function
* explicit timer/cleanup ownership
* `host.invalidate()` or equivalent if such a concept is added later
* use `describeState()` consistently
* avoid random direct rendering policy decisions where possible

### Current caution

If microapps currently call `host.screen.render()` directly, do not rip that out blindly.

Instead:

* audit it
* identify where it causes problems
* introduce a better host-level convention
* migrate incrementally

---

## 8. Concrete engineering rules for this session

Follow these rules while working.

1. Do not propose a framework migration.
2. Do not flatten architecture into one huge state machine unless the code clearly wants that.
3. Do not invent abstract base classes for their own sake.
4. Prefer plain TypeScript objects and functions over inheritance theater.
5. Prefer extraction over deep rewrites.
6. Prefer making ownership explicit over adding convenience hacks.
7. Preserve current user-facing behavior unless there is a clear bug or agreed change.
8. Preserve agent/control surfaces and semantic state.
9. Keep window lifecycle, cleanup, and restore behavior correct.
10. Use existing conventions where they are already good.
11. Where conventions are inconsistent, identify the best existing pattern and spread it.
12. Be concrete. Avoid hand-wavy “architecture improvements” with no code-level implications.

---

## 9. Your first tasks

Do these in order.

### Task 1 — Produce a codebase architecture audit

Write a concise but deep audit covering:

* major subsystems
* ownership map
* best current seams
* biggest architectural risks
* current render/state/persist flow
* where Elm-style thinking fits best
* the top 3 to 5 refactor targets

This is not a generic README. It should be specific to the repo.

### Task 2 — Build a “state / event / render” map

For the app shell and at least 3 representative subsystems, describe:

* where events come from
* where state lives
* how state changes
* how rendering happens
* where side effects occur
* where the current shape is clean vs messy

Representative subsystems should include:

* editor
* one complex live-updating window
* one module/microapp path

### Task 3 — Identify the best next refactor seam

Pick one seam that offers high leverage with moderate risk.

Good candidates might include:

* complex window local architecture
* render invalidation policy
* workspace restore lifecycle edge cleanup
* window-manager/controller boundary
* microapp host lifecycle clarity

Explain why this seam is best.

### Task 4 — Implement one disciplined improvement

Make one real improvement, not just a report.

The change should:

* improve clarity or ownership
* reduce future complexity
* fit the Blessed-first Elm-ish direction
* avoid unnecessary churn

Examples:

* extract a local model/render/update helper for a complex window
* introduce a small render invalidation utility and adopt it in one subsystem
* remove controller-owned logic into a focused collaborator
* standardise state reporting for a class of windows

### Task 5 — Verify properly

At minimum:

* run typecheck
* run relevant tests
* verify control/state surfaces if touched
* verify visually if UI behavior changed
* note any gaps honestly

---

## 10. How to think about “Elm for WibWob-DOS” in practice

Use this as a mental rubric.

### A. Local-first TEA is fine

Do not start with a giant global reducer.

Instead, do things like:

* `EditorModel / EditorMsg / updateEditor / renderEditor`
* `AgentWindowModel / AgentWindowMsg / updateAgentWindow / renderAgentWindow`
* `MonsterCamModel / MonsterCamMsg / updateMonsterCam / renderMonsterCam`

If later some of these want a shell-level dispatch layer, fine.

### B. Command system as intent spine

The command catalog/registry may already be the nearest thing to an app-wide intent layer.

Think:

* command ids are stable user/agent intents
* command handlers can increasingly route through clearer stateful collaborators
* command metadata remains canonical

### C. Render is a consequence, not a spontaneous act

Do not let the app keep drifting toward arbitrary direct UI mutation.

Instead, aim for:

* state update
* render apply
* screen refresh according to policy

Even if that policy is still imperative under the hood.

### D. Effects should be named and owned

Timers, file reads, agent responses, socket events, subprocess output, restore callbacks:

* each should have a clear owner
* each should be cleaned up cleanly
* each should feed state changes through a visible path

### E. Blessed widgets are not the model

Do not let widget properties become the only source of truth.

Store meaningful state explicitly whenever practical.

### F. Preserve creative weirdness while increasing internal calm

This app can stay playful, wonky, lo-fi, or characterful at the surface.

But internally it should become calmer:

* cleaner seams
* clearer rules
* less mystery ownership
* easier for humans and agents to extend safely

---

## 11. What good output looks like

Your work should result in some combination of:

* focused code changes
* better local patterns
* slimmer controller responsibilities
* clearer service/window boundaries
* improved lifecycle clarity
* better notes/spec updates where needed
* explicit rationale tied to this codebase, not generic TUI advice

Good outputs are concrete and repo-shaped.

Examples:

* “extracted X from `app-controller.ts` into Y because it already had a coherent lifecycle and dependencies”
* “introduced local `Msg` union and `render()` helper in `monster-cam-window.ts` to stop three different callbacks mutating widgets independently”
* “standardised `describeState()` fields for microapps and updated SDK doc accordingly”
* “replaced direct render calls in one subsystem with host invalidation helper”

Weak outputs to avoid:

* “consider using Redux/event sourcing/reactive streams”
* “the app could be modularised further”
* “maybe use a virtual DOM”
* “rewrite the shell in another framework”

---

## 12. Suggested deliverable format

Return work in this shape:

1. **Architecture read**

   * short, specific, repo-aware

2. **Current flow map**

   * state / events / render / effects for key subsystems

3. **Best refactor seam**

   * what, why, scope, risk

4. **Changes made**

   * files touched
   * what changed
   * why it helps

5. **Verification**

   * typecheck/tests/manual/visual
   * any limitations

6. **Next best move**

   * one or two precise next steps, not a 50-item wishlist

---

## 13. Final orientation

This repo is already on a promising path.

Do not treat it as a mess to be replaced.
Treat it as a living desktop environment that needs:

* stronger internal grammar
* clearer ownership
* more explicit state/event/render boundaries
* local Elm-like discipline in the places where complexity is rising

The aim is:

**Blessed shell, TypeScript core, modular windows, microapps as first-class citizens, agent-legible state, and Elm-style calm beneath WibWob-DOS’s weird surface.**

Start by reading, mapping, and choosing the highest-leverage seam. Then make one real improvement.
