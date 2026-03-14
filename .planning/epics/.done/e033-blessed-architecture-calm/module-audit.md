# E033 Module Anti-Pattern Audit

## TL;DR

This is a rolling audit tracker for `/modules`.

Scope for this pass:
- inspect module-local anti-patterns
- do not change core runtime code
- prefer notes that can later become small, safe follow-up fixes

Legend:
- `[ ]` not yet audited
- `[x]` audited

## Module checklist

- [x] dream-forecast
- [x] e026-demo
- [x] example-primers
- [x] glitchbox
- [x] heartbeat
- [x] hello-world
- [x] patchbay-lab
- [x] sy2-chronicles
- [x] terminal
- [x] touchlab-mvp
- [x] wibwob-figlet-fonts
- [x] wibwob-poetry-clock
- [x] wibwob-tidepool
- [x] wibwob-tr808
- [x] wibwobworld
- [x] world-chatroom
- [x] zine

## Module: dream-forecast

- Audit status: complete.
- Result: strong positive reference module for the current safe lane.
- Positive note: it stays on the public SDK path and does not reach into `src/core/*` or ad hoc service seams.
- Positive note: runtime state is per-window rather than module-global, which keeps its `multiInstance: true` contract honest.
- Positive note: it uses a reasonably rich surface mix without sprawling into host-side IO or private shell seams: header/status bars, bordered panels, selectable list, button bars, stack/column layout, animation clock, snapshot restore, semantic state, and text capture.
- Watch-out: `render()` still ends in a direct `host.screen.render()` call. That is acceptable in a local module, but it means the module is disciplined rather than fully declarative.
- Watch-out: `describeState()` is correct and semantic, but it is recomputed from live helpers rather than from one canonical serialisable state object. Fine here, though worth keeping an eye on as the module grows.
- Safe future tidy-up target: if this module evolves further, preserve it as a canonical “complex but honest” example and resist packing file IO, network, or loader-side behaviour into it.

## Module: e026-demo

- Audit status: complete.
- Anti-pattern: the demo bypasses the preferred SDK surface by importing directly from `src/core/tree-widget.ts`, `src/core/ui-primitives.ts`, and `src/services/motion-service.ts`. For a feature showcase that is understandable, but as an example module it teaches authors to reach around the SDK.
- Anti-pattern: one demo window is trying to show tree widget, timer lifecycle, motion helpers, and render monitor all at once. That makes it a useful showroom, but a muddy example of module boundaries.
- Anti-pattern: repeated direct `host.screen.render()` calls appear in local handlers and timer callbacks. Fine for a demo, but it normalises ambient redraw discipline.
- Positive note: cleanup, restyle, state, and capture are all present, so the module is noisy rather than sloppy.
- Safe future tidy-up target: split “SDK coverage harness” concerns from “example module” concerns, or clearly label this as an internal demo rather than a canonical starter.

## Module: example-primers

- Audit status: complete.
- Result: low risk.
- `microapp.json` is honestly content-only, so the usual window lifecycle and redraw anti-patterns do not apply here.
- Watch-out: if loader-side behaviour is ever added, either keep this strictly data-oriented or rename it so the manifest remains truthful.

## Module: glitchbox

- Audit status: complete.
- Anti-pattern: one very large `index.ts` mixes command registration, window construction, animation, generative-art simulation, autonomous agent orchestration, button-bar wiring, keyboard handling, and state reporting in one place.
- Anti-pattern: module-level singleton state (`activeWindow`, `activeDancer`, shared field state, active render callback) makes behaviour depend on ambient mutable variables inside `setup(...)`.
- Anti-pattern: repeated direct `host.screen.render()` calls are scattered through handlers and timers rather than flowing through one calmer invalidation path.
- Anti-pattern: the module creates and manages its own `Agent`, auth storage, and model-selection logic inside the view module. That is a very heavy seam for a microapp.
- Anti-pattern: timing behaviour is split across the dance tick, energy-speed restarter, and the haiku agent tick, which raises drift risk and cleanup complexity.
- Positive note: cleanup, restyle, `describeState()`, and `captureText()` are explicit.
- Safe future tidy-up target: extract a local controller layer inside the module before touching any shared runtime seam.

## Module: heartbeat

- Audit status: complete. Cleaned in this pass.
- Fixed: imports now use the public SDK surface instead of `src/core/ui-primitives.ts`.
- Fixed: `describeState()` now exposes `bpm`, `uptime`, `frame`, and `beat` as machine-readable fields, not just a summary string.
- Remaining watch-out: animation is still driven by two independent timers for waveform and beat state. Acceptable for this tiny module, but worth noting.
- Positive note: the module is tiny, cleanup is correct, and the timer ownership is explicit.

## Module: hello-world

- Audit status: complete. Cleaned in this pass.
- Fixed: removed the no-op `win.onCleanup(() => {})` stub. Cleanup should only be registered when there is real cleanup to do.
- Remaining watch-out: `renderFiglet(...)` uses `spawnSync(...)` during banner generation. Acceptable for a toy example, but risky as canonical starter behaviour.
- Remaining watch-out: command metadata and banner/window strings are all handwritten inline, so new authors are likely to cargo-cult copy-paste duplication.
- Positive note: it otherwise uses the canonical SDK import path, state description, text capture, and restyle hook correctly.

## Module: patchbay-lab

- Audit status: complete.
- Anti-pattern: the module is enormous and acts as a coverage harness for terrain, animation, world chat, primer gallery, helper windows, semantic state, and snapshots all in one file. It is useful, but difficult to reason about as one microapp.
- Anti-pattern: it imports `EMPTY_PRIMER_SELECTED` directly from `src/core/empty-states.ts`, which leaks core internals into a module that otherwise mostly uses the SDK.
- Anti-pattern: file IO for primer preview uses raw `fs.readFileSync(...)` inside the module, which couples a UI surface to host filesystem assumptions.
- Anti-pattern: repeated `host.screen.render()` calls appear throughout helper-window management, chat updates, and animation plumbing.
- Anti-pattern: there is broad service coupling to terrain tools, content gallery tools, and world chat inside one window, making it more of an internal integration harness than a crisp module.
- Positive note: its semantic state and snapshot thinking are stronger than many smaller modules.
- Safe future tidy-up target: split this into smaller harnesses or extract local subcontrollers per bench.

## Module: sy2-chronicles

- Audit status: complete.
- Anti-pattern: the file is extremely large and blends content definitions, layout logic, animation, hot reload, input handling, inline editing, agent actions, and camera/webcam concerns in one place.
- Anti-pattern: it imports directly from several core seams such as `src/core/panel-layout.ts`, plus local panel loaders and panel types, so the module effectively owns a mini-framework.
- Anti-pattern: module-level webcam service state (`camService`, `camStarted`) creates ambient lifetime outside any one window instance.
- Anti-pattern: there are many direct `host.screen.render()` calls spread across scroll, drag, overlay, timer, and edit paths, which suggests high redraw coupling.
- Anti-pattern: this module appears to have grown by accretion. It is powerful, but difficult to audit because content, behaviour, and tooling all live together.
- Positive note: it does expose state, capture, cleanup, and restyle, so despite the sprawl it still participates in the app contract.
- Safe future tidy-up target: separate panel content sources from interaction/runtime control, then carve out local controllers for drag/search/edit.

## Module: terminal

- Audit status: complete at documentation level only.
- Anti-pattern: the module contains deep process-management logic, bridge spawning, PTY discovery, mouse passthrough patching, and resize protocol code inside the view module. That makes it far heavier than a typical microapp.
- Anti-pattern: it reaches into Blessed terminal internals via ad hoc structural typing and private-ish fields to install mouse passthrough. Necessary perhaps, but definitely fragile.
- Anti-pattern: `findNodePtyPath()` includes fallback probing logic that bakes local environment assumptions into the module.
- Anti-pattern: there are several direct `host.screen.render()` calls around bridge IO and focus wiring, reinforcing the terminal’s sensitivity to redraw timing.
- Positive note: the bridge/process cleanup path is explicit and the state/capture hooks exist.
- Caution: terminal remains a collision-prone seam, so any fixes here should wait for the active lane to settle.

## Module: touchlab-mvp

- Audit status: complete.
- Anti-pattern: even after the S12 composition pass, the module still carries a lot of bespoke nested-panel, dragging, resizing, palette, and overlay logic inside one file.
- Anti-pattern: it still defines TouchLab-local helpers like `drawArrow(...)` and a bespoke waveform source, so the shared composition vocabulary has not yet reduced all local composition code.
- Anti-pattern: repeated direct `host.screen.render()` calls remain scattered across drag, resize, keyboard, and animation-control paths.
- Anti-pattern: the `input` node is described as a parameter role but also behaves as a rendered source. That is not wrong, but it shows the composition vocabulary is still slightly fuzzy at the edges.
- Positive note: the module now uses the shared composition helper path and records composition roles in `describeState()`, which is exactly the right direction.
- Safe future tidy-up target: extract generic nested-node chrome or input/palette controls only if a second adopter truly needs them.

## Module: wibwob-figlet-fonts

- Audit status: complete.
- Result: low risk.
- `microapp.json` is honestly data-only and does not pretend to be a runtime microapp.
- Watch-out: if font rendering helpers are ever added later, keep catalogue data separate from font-discovery/runtime behaviour.

## Module: wibwob-poetry-clock

- Audit status: complete.
- Anti-pattern: the module combines shelling out to `figlet`, direct auth-file reads, direct API calls to Anthropic, local animation players, contour rendering, and clock UI logic in one file.
- Anti-pattern: it owns network/auth concerns directly inside the module rather than depending on a calmer service seam.
- Anti-pattern: multiple time sources exist at once: a Scramble player interval, a 15-second tick interval, async poem fetch timeouts, and optional contour animation. That makes the lifecycle harder to reason about than the simple premise suggests.
- Anti-pattern: repeated `host.screen.render()` calls appear both in local animation and async update paths.
- Positive note: fallback behaviour is clearly intentional and the module does provide state, capture, cleanup, and restyle.
- Safe future tidy-up target: separate poem-generation transport from clock presentation, even if both remain module-local.

## Module: wibwob-tidepool

- Audit status: complete. Cleaned in this pass.
- Fixed: all mutable runtime state (engine, timers, speed, history, highlight) is now per-window inside `openTidePool(...)`, making `multiInstance: true` honest.
- Fixed: snapshot registration moved outside the window-open function so it registers once at setup, not per-window.
- Remaining watch-out: the module still drives its own tick scheduler and render loop with direct `host.screen.render()` calls. Acceptable, but noted.
- Positive note: the engine/renderer split is conceptually clean and now the lifecycle ownership matches.

## Module: wibwob-tr808

- Audit status: complete.
- Anti-pattern: module-level `engine`, `audio`, and `stepCursor` state live outside the window-open function even though the module owns a large amount of mutable playback state.
- Anti-pattern: the file defines local UI helper types (`Rect`, `UiPart`, `StackChild`) that look like copies of concepts the app already has elsewhere. That hints at local type shadowing instead of reuse.
- Anti-pattern: audio sample rerender throttling, keyboard input mapping, engine event handling, and window rendering all live together in one large setup flow.
- Positive note: the engine/renderer/audio split is stronger than many modules and gives the code a decent internal structure.
- Positive note: state, capture, cleanup, and restyle are present.
- Safe future tidy-up target: move mutable runtime state into the window scope and replace local shadow types with shared ones where possible.

## Module: wibwobworld

- Audit status: complete.
- Anti-pattern: the module mixes terrain generation, multiple render modes, first-person camera behaviour, file export, capture writing, chatspot joining, and debug logging inside one file.
- Anti-pattern: it uses raw `fs.mkdirSync(...)` and `fs.writeFileSync(...)` for captures and exports directly from the module, which couples UI behaviour to host filesystem assumptions.
- Anti-pattern: it imports a large surface area from the SDK and local helpers, making it feel closer to a subsystem than a small microapp.
- Anti-pattern: broad mutable state inside `openWorld(...)` covers caches, camera state, export state, focus state, and chat state, so the cognitive load is high.
- Positive note: the module at least keeps most of that state inside the window-open scope rather than leaking everything globally.
- Safe future tidy-up target: split render-mode control, capture/export actions, and world-chat integration into smaller local helpers.

## Module: world-chatroom

- Audit status: complete.
- Anti-pattern: this is a relatively tidy module, but it still couples UI layout, transcript rendering, world-chat transport state, participant rendering, input composition, and channel-join behaviour in one file.
- Anti-pattern: there are many direct `host.screen.render()` calls around input arming, focus changes, message send, and subscription updates.
- Anti-pattern: the module uses local cached width/height workarounds to compensate for Blessed sizing quirks. Sensible, but a sign that layout knowledge is leaking into the module.
- Positive note: state reporting is solid and the channel/transport model is at least visible in `describeState()`.
- Safe future tidy-up target: extract transcript/status/input rendering helpers locally before considering any shared chat surface abstractions.

## Module: zine

- Audit status: complete.
- Anti-pattern: the file is large and blends file discovery, picker UI, canvas layout, sidebar file browser, hot reload, editing, YAML writeback, scrolling, search, and animation ticking in one place.
- Anti-pattern: it imports directly from `src/core/panel-layout.ts`, `src/core/canvas-types.ts`, `src/core/ui-primitives.ts`, and `src/core/ui-parts.ts`, so the module depends on several non-SDK internals.
- Anti-pattern: raw filesystem operations (`existsSync`, `readdirSync`, `readFileSync`, `writeFileSync`, `fs.watch`) are deeply embedded in the module, making it both editor and runtime surface at once.
- Anti-pattern: repeated `host.screen.render()` calls appear throughout picker, sidebar, scroll, watch, edit, and resize paths.
- Anti-pattern: the central tick loop and watcher lifecycle are both module-owned, which is powerful but creates a lot of hidden coordination inside one file.
- Positive note: despite the sprawl, the module has clear product intent and does expose state, cleanup, and restyle hooks.
- Safe future tidy-up target: separate file-browser/editor concerns from canvas-runtime concerns before extracting any shared editorial abstractions.
