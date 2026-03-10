# GPT-5.4 Agentic Devlog

Source prompt: `./gpt54-agent-prompt.md`
Date: 2026-03-10
Branch: `spike/spk-unblessed-upgrade`
Mode: read-first architecture audit and refactor planning

## ORIENTATION

This log runs beside `gpt54-agent-prompt.md` and tracks concrete repo reading, architectural interpretation, and the next refactor moves implied by that prompt. This pass stayed read-only inside `src/`: the goal was to map the system properly before pretending to improve it.

The strongest framing from the prompt proved correct on first contact: this is not a framework-migration problem. It is a control-flow and ownership problem inside an already rich Blessed desktop. The repo already has the right nouns — controller, command catalog, registry, state service, workspace service, module loader, microapp SDK, window manager — but some of the verbs are still sprayed across callbacks and window files.

## INPUTS

Primary prompt:
- `.planning/spikes/spk-unblessed-upgrade/gpt54-agent-prompt.md`

Project constitution:
- `AGENTS.md`
- `.agents/architecture.md`
- `.agents/invariants.md`

Key code read in `src/`:
- `src/core/app-controller.ts`
- `src/core/window-manager.ts`
- `src/core/editor-coordinator.ts`
- `src/core/command-catalog.ts`
- `src/core/command-registry.ts`
- `src/services/state-service.ts`
- `src/services/module-loader.ts`
- `src/services/microapp-sdk.ts`
- `src/services/workspace-service.ts`
- `src/services/control-api.ts`
- `src/services/wibwob-agent-session.ts`
- `src/services/monster-cam-service.ts`
- `src/windows/text-windows.ts`
- `src/windows/wibwob-agent-window.ts`
- `src/windows/monster-cam-window.ts`
- `src/windows/music-player-window.ts`
- representative microapps in `modules/hello-world`, `modules/world-chatroom`, `modules/sy2-chronicles`

Useful scans:
- `screen.render()` across `src/`
- `onStateChanged` callback propagation
- `setTimeout` / defer usage
- largest TypeScript files in `src/`

## SIZE-PRESSURE

Current file-size hotspots match the architectural pressure points. `src/core/app-controller.ts` is 2176 lines. `src/core/ui-parts.ts` is 1555. `src/windows/browser-windows.ts` is 1430. `src/windows/music-player-window.ts` is 1075. `src/services/wibwob-agent-session.ts` is 1063. These are not automatically bad, but they are where ownership blur and incidental policy are most likely to accumulate.

The prompt singled out `app-controller.ts` as the main decomposition target and the code agrees. It is still acting as composition root, but also as policy router, lifecycle shim, state sync funnel, workspace restorer, window factory dispatcher, and feature host for a long tail of surfaces. It is more coherent than a random god object, but it is still too central.

## SHELL-MAP

The shell already has an encouraging shape.

`src/core/app-controller.ts` composes the world. It builds the screen, menu chrome, desktop box, status line, `WindowManager`, `OverlayManager`, `CommandRegistry`, `MenuOverlayManager`, `EditorCoordinator`, `ControlApiService`, and `StateService`, then loads modules and restores workspaces. That is legitimate composition-root work. The drift comes from the long tail of per-window opening logic and state/persist/render policy being wired ad hoc from here.

`src/core/command-catalog.ts` and `src/core/command-registry.ts` are healthy seams. The catalog is genuinely the source of truth for command metadata; the registry projects that into menus, palette, API, and runtime dispatch. This is the nearest thing the app has to a typed intent spine already. It should be strengthened, not bypassed.

`src/core/window-manager.ts` owns a great deal of real shell behaviour: frame creation, focus, z-order, drag, resize, maximize, close, tile, cascade. This is a proper owner. The weak point is that it commits renders directly and eagerly at many lifecycle edges, so it currently mixes lifecycle ownership with render scheduling policy.

## STATE-BACKBONE

`src/services/state-service.ts` is one of the cleanest architectural facts in the system. It builds a canonical `DesktopState` from screen geometry, focused window, menu state, and per-window `describeState()`. That means semantic state is not an afterthought; it is an explicit backbone.

The important subtlety is how state freshness works. `StateService` is cache-based and depends on callers to invoke `sync()` or `persistAndNotify()`. `app-controller.ts` routes many window callbacks through `syncLiveState()`, and `updateStatusLine()` itself calls `this.state.sync()`. That works, but it means state invalidation policy is social rather than structural. If a window mutates meaningful state and forgets to call `onStateChanged`, the semantic world goes stale.

## RENDER-PRESSURE

The render scan is loud. `screen.render()` appears throughout core and window code: `app-controller.ts`, `window-manager.ts`, `editor-coordinator.ts`, `text-windows.ts`, `monster-cam-window.ts`, `music-player-window.ts`, `wibwob-agent-window.ts`, `browser-windows.ts`, `backrooms-windows.ts`, `overlay-manager.ts`, `menu-overlay-manager.ts`, and more. This is not just a style issue. It means render ownership is currently distributed across shell, window manager, individual windows, overlays, and microapps.

There are really three render domains hiding inside that one API call. First: shell commits such as focus, move, resize, close, menu open, overlay open. Second: local window redraws after state changes. Third: timer-driven animation or streaming surfaces such as music visualisation, monster cam, and agent transcript/player updates. Those domains want different policies, but today they all call the same terminal commit point directly.

A representative smell appears in `src/windows/monster-cam-window.ts`: service events mutate local booleans, update widget content, fire `onStateChanged`, and call `screen.render()` directly. Another appears in `src/windows/music-player-window.ts`: an internal controller subscription calls a local `render()` which updates layout, player pane, playlist, viz pane, toolbar, notifies state, then renders the whole screen. This is orderly inside the window, but the final render commit is still hard-wired.

## EVENT-FLOW

The app already contains proto-TEA patterns in several places.

Best current seam: `src/core/editor-coordinator.ts`. It gives editor behaviour one owner. File open, save, save-as, dirty tracking, key handling, text insertion, deletion, and render all route through one coordinator with injected dependencies: `windowManager`, `overlays`, `content`, `screen`, `syncLiveState`, and `persistState`. It is not pure TEA, but it is very close to “one coherent stateful collaborator with explicit dependencies”. This file is the strongest proof that the repo can improve by extraction rather than rewrite.

`src/windows/text-windows.ts` also shows a useful local pattern. It keeps mode state locally with `currentMode`, `figletEnabled`, cached markdown lines, and dedicated `applyMode`, `renderView`, `updateStatus`, and `scrollBy` functions. The weakness is the same global one: widget mutations and `screen.render()` are interleaved directly. The shape is good; the render policy is not yet disciplined.

`src/windows/wibwob-agent-window.ts` is another strong but busy local architecture. It has local state for draft text, player-bar visibility, block maps, info bar, transcript stack, and session metadata; it exposes a clear render vocabulary like `renderPlayerBar`, `renderLayout`, `renderInput`, `renderInfoBar`, and `updateTranscript`. This is almost a local Elm-style window already, just without an explicit `Msg` union and with direct render commits after many updates.

## MICROAPP-BOUNDARY

The microapp system is better than expected. `src/services/module-loader.ts` gives modules a coherent host with `createWindow`, command registration, snapshot hooks, theme registration, command execution, geometry, world chat access, and shared UI primitives. `src/services/microapp-sdk.ts` then re-exports a large, usable toolkit for module authors.

But the microapp boundary has two architectural faults. First, render policy is still implicit: the host gives `screen`, and modules call `host.screen.render()` whenever they like. Second, registration uses a deferred `setTimeout(ensureRegistered, 0)` inside `createWindow()`. That is an explicit race-management hack. It exists for a real reason — letting the module wire `describeState`, cleanup, and restyle before first sync — but it means workspace restore and microapp lifecycle semantics are not quite declarative yet.

A good contrast sits in the example modules. `modules/hello-world/index.ts` is tiny and easy to reason about. `modules/world-chatroom/index.ts` is productive but imperative: local state, many input handlers, direct content mutation, direct `host.screen.render()`. `modules/sy2-chronicles/index.ts` is ambitious and clearly benefits from the SDK, but it also shows how quickly a microapp can become its own mini-runtime. That makes render and lifecycle conventions more important, not less.

## STATE-EVENT-RENDER MAP

### App shell

Events enter from Blessed screen handlers, menu clicks, global keybindings, window-manager interactions, control API calls, and workspace restore. State lives partly in controller fields, partly in `WindowManager`, partly in `StateService`, and partly in service singletons like Scramble and world chat. Rendering is committed by shell code, `WindowManager`, overlays, and many windows. Side effects include disk writes, process spawn, API server start, module loading, workspace I/O, and agent session startup. The shape is serviceable but still too coupled through `app-controller.ts`.

### Editor subsystem

Events come from editor keypresses, save commands, and file open actions. State lives in `WindowRecord.editor`, dirty flags, and file metadata, with mutations centralised in `EditorCoordinator` plus the pure-ish helpers in `src/services/editor-service.ts`. Rendering is local: the coordinator calls `renderEditorState(window.editor)`, syncs live state, then renders the screen. Side effects such as disk I/O and prompts are explicit. This is the cleanest candidate model for future extractions.

### Monster Cam

Events come from `MonsterCamService` emitter events: `ready`, `error`, and `frame`, plus local keypress and button clicks. State lives entirely in local variables inside `openMonsterCamWindow`: face/hand/pose booleans, emotion, fps, bbox, background toggle, monster toggle. Rendering is immediate widget mutation followed by `screen.render()`. Side effects are camera worker spawn and socket traffic owned by the service, with `frame.cleanup = () => svc.stop()`. This is the clearest place to introduce a tiny local model/update/render loop.

### Music Player

Events come from `AudioController.subscribe(render)`, toolbar clicks, keypresses, list selection, file browser results, and a visualiser interval. State is split between the internal `AudioController`, local viz/layout flags in the window, and the live widget tree. Rendering is more disciplined than in smaller windows because it flows through local `layout()`, `renderPlayer()`, `renderPlaylist()`, `renderViz()`, then `render()`. The problem is that timer ticks and controller events still drive whole-screen commits directly.

### Microapp path

Events enter through microapp command actions, widget handlers inside the module, world-chat subscriptions, timers, and resize hooks. State is whatever the microapp chooses to keep locally. Rendering is entirely imperative inside the module, usually by mutating boxes and calling `host.screen.render()`. Side effects are broad because the SDK is permissive: command registration, snapshots, themes, timers, world chat, and arbitrary subprocess-friendly helpers. This is powerful, but the host contract needs a clearer redraw and registration grammar.

## REFRACTOR-SEAMS

Top refactor targets, in order of leverage versus risk:

1. Render invalidation policy.

This is the best cross-cutting seam. The app needs a small render scheduler or invalidation gate that separates “state changed” from “commit the terminal frame now”. This does not require a giant architecture rewrite. It can begin as a tiny service with `requestRender(reason?)` and maybe `requestStateSync()` and later grow into a stronger contract. Right now too many files own the final commit.

2. Local TEA extraction for one live window.

`src/windows/monster-cam-window.ts` is the best first proving ground. It has obvious local state, a small message vocabulary, and a clean service boundary. A refactor here could introduce `MonsterCamModel`, `MonsterCamMsg`, `updateMonsterCam`, and `renderMonsterCam` without touching the rest of the app much.

3. Microapp host lifecycle clarity.

`module-loader.ts` should eventually stop relying on `setTimeout(ensureRegistered, 0)`. The host wants an explicit “wire window, then commit registration” phase, or an API where `createWindow()` returns an unregistered draft handle and the module calls `mount()` when ready. That would reduce restore races and make initial state sync deterministic.

4. Window-family extraction out of `app-controller.ts`.

The controller can stay the composition root while losing chunks of opener and restore logic. Good extraction candidates are workspace restore actions, browser/finder family openers, and creative/live surfaces. The model is already present in `EditorCoordinator`.

5. `describeState()` contract tightening.

The state system is good enough to invest in. Windows and microapps should converge on more consistent, semantic detail payloads. That would improve agent legibility and reduce UI scraping pressure.

## BEST-NEXT-SEAM

Best next seam: render invalidation policy, piloted through one live-updating window.

Why this seam wins: it improves architecture without forcing a library change, without demanding a global reducer, and without destabilising workspace restore or command routing first. It also aligns exactly with the prompt’s Elm-ish direction: update state first, render as consequence, make effect ownership explicit. If `screen.render()` remains callable from everywhere, every later refactor will partly dissolve back into callback soup.

The safest proving sequence is not “global rewrite”. It is:

1. add a tiny render scheduler/invalidation helper at shell level
2. inject it into one subsystem
3. convert one live window to local model/update/render
4. evaluate ergonomics
5. spread the pattern to the next two offenders

A useful sketch for the first move:

    interface RenderScheduler {
      requestRender(reason?: string): void;
      requestStateSync(reason?: string): void;
      requestPersist(reason?: string): void;
    }

That is deliberately modest. It does not need a virtual DOM. It just makes the terminal commit point and state-sync intent explicit.

## EXECUTION-PLAN

Recommended order of work after this planning pass:

### Step 1 — add explicit render scheduling

Create a tiny scheduler service in `src/core/` or `src/services/` that batches same-tick renders and gives the shell one place to own final `screen.render()`. Do not chase total purity yet. The initial value is making render ownership visible and injectable.

Adopt it first in `WindowManager`, `EditorCoordinator`, and `monster-cam-window.ts`. Those three surfaces already sit on clean seams and cover shell lifecycle, extracted collaborator, and local live window. This gives a real end-to-end trial without dragging browser windows or microapps into the first pass.

### Step 2 — refactor Monster Cam to local model/update/render

Keep `MonsterCamService` as the side-effect owner. Rewrite the window into explicit local state transitions. Something as small as these messages is enough:

    type MonsterCamMsg =
      | { type: "ready" }
      | { type: "error"; message: string }
      | { type: "frame"; frame: MonsterCamFrame }
      | { type: "toggle-bg" }
      | { type: "toggle-monster" };

This creates a canonical example for other live windows: service events become messages, messages update model, render consumes model, cleanup stays explicit.

### Step 3 — formalise microapp registration

Replace `setTimeout(ensureRegistered, 0)` in `module-loader.ts` with an explicit registration phase. This is medium risk but high value because it touches agent-visible state, workspace restore timing, and all microapps. Do it only after the render scheduler exists so the host API can move toward `win.mount()` plus `host.invalidate()` together.

### Step 4 — split controller families

Extract the first non-editor collaborator from `app-controller.ts`. Best candidates are a workspace restore coordinator or a browser/finder family opener set. Avoid abstract factories; use plain dependency-injected functions or a focused class, mirroring `EditorCoordinator`.

### Step 5 — spread the local-window pattern

Apply the same local state/event/render discipline to `wibwob-agent-window.ts` or `music-player-window.ts`. Those files are already part-way there. The change is not conceptual; it is about making the message flow first-class and letting render scheduling stop being an ambient side effect.

## RISKS

The biggest risk is overreaching. The app does not need a single giant TEA runtime. It needs local message discipline and clearer shell policies. A global reducer too early would crush the existing modularity and probably fight the microapp system.

The second risk is breaking agent or API parity while “cleaning up” UI code. `StateService`, `describeState()`, command metadata, and control API visibility are hard-won structural assets. Any refactor should preserve or improve those surfaces.

The third risk is treating microapps as second-class during cleanup. They are not. The SDK is one of the repo’s strongest ideas. The right move is to give microapps a better host contract, not to retreat from them.

## IMMEDIATE-NEXT

If this planning track becomes implementation work, the next concrete changes should be:

1. create `render-scheduler.ts` and thread it through `app-controller.ts`, `window-manager.ts`, and `editor-coordinator.ts`
2. refactor `src/windows/monster-cam-window.ts` into a local model/update/render shape using that scheduler
3. run `bun run typecheck`
4. restart the app and visually verify the Monster Cam window plus normal shell focus/move/resize behaviour
5. record the pattern back into `.agents/` if the scheduler contract proves good

## WORKLOG

Read the prompt first, then checked the repo constitution before touching conclusions. The existing docs were useful and importantly consistent with the code: the command catalog really is canonical, the state service really is semantic rather than scraped, and the editor coordinator really is the clearest example of the desired extraction style. That made the planning sharper because it turned the task from “invent architecture” into “spread the best existing architecture”.

The code scan then concentrated on where state, events, and terminal commits currently meet. `screen.render()` distribution was the biggest signal. It appears in shell infrastructure, overlays, window manager, extracted collaborators, and individual windows, which explains why the repo still feels callback-heavy even where the nouns are clean. The main conclusion from this pass is simple: the next improvement should not be another big subsystem. It should be a tiny explicit render/invalidation seam, then one proof-of-pattern window refactor to show how Elm-ish local architecture fits Blessed without pretending Blessed is pure.

## SIDETRACK-UNBLESSED-PROMPT

Exact human prompt, condensed only for readability not meaning:

“Before we do a quick sidequest: does unblessed offer us anything useful? New TS-strict updated blessed in 2025, but after a promising start no commits for 3 months so we can’t adopt it as canon or as a blessed alternative. Just curious what, if anything, we could port or steal from its ideas.”

Follow-up constraints added by the human:

- testing needs to be better
- modularity matters, especially shared and private modules because they are the hero/demo surfaces for first-time repo testers
- leave React integration alone
- flexbox is only interesting later as a stretch idea for responsive `zine`-style layouts
- Unicode edge cases are real, especially in private primers and ASCII-adjacent art assets
- long-term performance target is very high-resolution, animation-heavy WibWob-DOS scenes, so render speed and memory usage matter directly

Concrete question being answered:

Not “should we migrate to unblessed now?” but “which specific unblessed ideas, implementation techniques, or standards are worth porting into the current Blessed codebase even if we never adopt unblessed itself?”

Concrete inspection checklist used for the sidetrack:

- check whether the unblessed compatibility layer actually preserves the Blessed patterns this repo uses heavily
- check whether `blessed.Widgets.*` types map cleanly enough to tell us anything useful about stricter typing
- check whether our `screen.program` usage has any meaningful analogue
- check whether our heavy `screen.render()` pattern would benefit from any render-policy ideas rather than a runtime swap
- check whether our string-based grid and ASCII rendering could benefit from cell/canvas ideas
- check whether unblessed suggests anything useful for testing, modularity, and layout discipline
- explicitly separate “useful ideas to steal” from “features we should ignore for now”

Repo-specific surfaces compared in this sidetrack:

- `src/core/app-controller.ts` — render ownership and central orchestration pressure
- `src/core/window-manager.ts` — window lifecycle plus direct render commits
- `src/core/editor-coordinator.ts` — example of the kind of focused extracted collaborator we do want
- `src/core/render-monitor.ts` — current render-rate instrumentation seam
- `src/services/module-loader.ts` — module host lifecycle and registration semantics
- `src/services/microapp-sdk.ts` — public module authoring surface
- `src/core/grid-canvas.ts` and text-heavy windows — string/cell rendering implications
- `modules/` and `modules-private/` — first-run extensibility and demo surface quality
- local compatibility notes in `/Users/james/Repos/wibandwob-dos/.planning/spikes/spk-unblessed-upgrade/unblessed-compat-assessment.md`
- wider spike notes in `/Users/james/Repos/wibandwob-dos/.planning/spikes/spk-unblessed-upgrade/spike.md`

## SIDETRACK-UNBLESSED-SOURCES

Primary links captured for future agent passes:

- GitHub: https://github.com/vdeantoni/unblessed
- Docs intro: https://unblessed.dev/docs/getting-started/introduction
- Local assessment: `/Users/james/Repos/wibandwob-dos/.planning/spikes/spk-unblessed-upgrade/unblessed-compat-assessment.md`
- Existing spike brief: `/Users/james/Repos/wibandwob-dos/.planning/spikes/spk-unblessed-upgrade/spike.md`

## SIDETRACK-UNBLESSED-VERDICT

Current stance: do not adopt unblessed as canon, but do actively borrow from it. The compatibility assessment in `unblessed-compat-assessment.md` argues the drop-in path may be technically plausible, but that is still a migration claim, not a reason to tie the project’s long-term runtime to a dependency whose recent momentum is unclear. The better move is selective theft.

Most valuable ideas to port into WibWob-DOS now:

- stricter TypeScript posture around widget contracts and local state ownership
- a cleaner runtime seam between app state, render scheduling, and terminal commit
- more cell-aware text handling for ANSI-safe truncation, Unicode edge cases, and layout correctness
- better visual and regression-testing discipline
- stronger modularity expectations at the subsystem and module-host boundary

Least useful right now:

- React integration
- wholesale runtime migration
- flexbox as a general layout rewrite
- browser-portability ambitions

## SIDETRACK-UNBLESSED-TESTING

The unblessed comparison sharpened one existing conclusion: WibWob-DOS testing needs to improve, especially around visible output. The repo already says visual verification is mandatory, but the architecture plan should treat that as a subsystem concern rather than a final checklist item. The missing capability is not just “more tests”; it is stronger regression capture for windows, theme shifts, overlapping layouts, ANSI-heavy text views, and live-updating surfaces.

That matters even more if the project’s long-term target is extremely high-resolution desktop scenes with many concurrent animations and moving parts. The future failure mode is not a TypeScript error; it is a terminal that technically runs while rendering too slowly, tearing visually, leaking memory, or degrading under animated load. Testing should grow toward sustained-scene checks, frame-rate awareness, and evidence capture for dense multi-window compositions.

## SIDETRACK-UNBLESSED-MODULARITY

The comparison also reinforces that modularity is one of the repo’s public face layers. The shared and private modules are not side content; they are hero surfaces and first-run advertisements for how extensible the system feels. `modules/hello-world`, `modules/world-chatroom`, `modules/sy2-chronicles`, and the private prompt/primer modules collectively teach newcomers what this desktop is and what it can become.

That makes the module boundary worth polishing as product, not just architecture. The `module-loader.ts` host contract, `microapp-sdk.ts`, shared UI primitives, and snapshot/state conventions should become cleaner and more legible because they directly shape first impressions for anyone testing or extending the repo. Better module lifecycle semantics and redraw rules would improve both agent legibility and newcomer trust.

## SIDETRACK-UNBLESSED-TEXT-AND-UNICODE

Cell-aware text handling is worth stealing conceptually. WibWob-DOS already has a known unicode/cell-rendering follow-on in planning, and the need is real: some private primers and ASCII-adjacent assets contain awkward characters that render inconsistently, mis-measure width, or drift visually once ANSI styling and box constraints mix together.

So the right takeaway is not “switch to unblessed for Unicode”. It is “treat text measurement, truncation, and cell rendering as a first-class engine concern”. This connects directly to list/sidebar truncation, primer rendering, figlet framing, mixed Unicode art, and any future high-density layouts where one bad width assumption can ripple through the whole desktop.

## SIDETRACK-UNBLESSED-FLEXBOX

React stays out. Flexbox stays a later, narrow research thread.

The only place where flexbox-like thinking currently looks interesting is the `zine` direction and similar responsive editorial layouts where three-column-to-one-column collapse might eventually be cleaner with a stronger layout engine. That is a stretch investigation for later, not a near-term architectural move for the shell. The current shell problem is still render ownership and state/event clarity, not lack of flex layouts.

## SIDETRACK-UNBLESSED-PERFORMANCE

Long-term performance and memory discipline should stay explicit in the architecture plan. If WibWob-DOS is meant to drive very large terminals or projected displays with dense scenes, many windows, complex ASCII, and multiple live animations, then render speed and memory usage are core product constraints. They are not merely implementation polish.

This supports the earlier refactor ordering. A render scheduler or invalidation seam is useful not just because it is architecturally tidy, but because it is a prerequisite for understanding, controlling, and later optimising redraw pressure. Likewise, local model/update/render patterns make it easier to reason about what actually changes per frame and where memory or rendering work is being created unnecessarily.
