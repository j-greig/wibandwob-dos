---
id: spk-unblessed-upgrade
title: Upgrade TUI engine from blessed to unblessed — and TEA architecture assessment
status: done
branch: spike/spk-unblessed-upgrade
created: 2026-03-10
closed: 2026-03-10
---

# Spike: blessed → unblessed upgrade — and TEA architecture assessment

## Question

Can we swap our TUI rendering engine from `blessed` to `@unblessed/blessed`
or `@unblessed/node` — and what would we gain? Separately: is the Elm
Architecture a useful pattern for this codebase?

## Timebox

1 session. Decided.

---

## Baseline — current blessed usage

Grokked from `grep -r "import.*blessed" src/` and pattern analysis.

### Import surface

- 40 source files reference blessed
- 28 direct imports (`import blessed from "blessed"`)
- Key files: `app-controller.ts`, `window-manager.ts`, `types.ts`,
  `ui-parts.ts`, `ui-primitives.ts`, `modal.ts`, `tree-widget.ts`,
  `editor-coordinator.ts`, `menu-overlay-manager.ts`, `custom-cursor.ts`
  plus ~20 window files

### Widget usage spread

| Widget         | Rough call count |
|----------------|-----------------|
| blessed.box    | 43+             |
| blessed.Widgets.* (types) | 78+ |
| blessed.list   | 9               |
| blessed.textbox | 6              |
| blessed.screen | 1 direct create |

### Type annotation surface

Heavy use of `blessed.Widgets.Screen`, `.BoxElement`, `.Node`, `.Events`,
`.ListElement`, `.BoxOptions`, `.BlessedElement`, `.TextboxElement`.
These are the main migration risk — if unblessed re-exports equivalent types
under the same namespace the cost is near zero.

### Low-level APIs in use

- `screen.program.hideCursor()` / `showCursor()` — in `custom-cursor.ts`
- `screen.width` / `screen.height` — throughout
- `screen.render()` — throughout
- `element.on("mousedown"|"click"|"keypress")` — throughout
- `element.setContent()` — throughout
- `element.hide()` / `show()` — throughout

### Bespoke patterns

- Grid canvas: raw character-cell writes via `setContent` with ANSI colour codes
- Skeleton renderer: builds blessed box trees dynamically
- Panel layout: `createStack` / `createColumns` returning box arrays
- Custom cursor: overrides blessed's cursor handling via `screen.program`
- Render monitor: tracks `screen.render()` call rate
- Tree widget: builds a blessed box tree for file/dir navigation

---

## unblessed — what it is

Repo: https://github.com/vdeantoni/unblessed
Docs: https://unblessed.dev
Vendor copy: `vendor/unblessed/`
Latest: `1.0.0-alpha.23` (Dec 2025, active)

### Architecture

```
@unblessed/core      — platform-agnostic, Runtime interface
@unblessed/node      — Node.js runtime (auto-init, new API)
@unblessed/blessed   — 100% backward-compat wrapper (drop-in)
@unblessed/browser   — XTerm.js bridge
@unblessed/layout    — Yoga flexbox engine
@unblessed/react     — React/JSX renderer
@unblessed/vrt       — visual regression testing
```

### Migration path A — drop-in via @unblessed/blessed

Replace `"blessed"` with `"@unblessed/blessed"` in package.json.
Zero code changes. The package re-exports all original blessed API
including `Widgets.*` types and the default export pattern.

Risk: alpha software; Bun 1.3.8 compatibility untested.

### Migration path B — typed rewrite to @unblessed/node

Use the new class-based `Screen`, `Box` etc. API.
Requires changing all import sites and type annotations.
Gain: fully typed, strict mode, modern ESM.
Cost: ~40 files changed, high regression risk.

---

## Potential gains

| Area | Current | With unblessed |
|------|---------|---------------|
| Type safety | `blessed` TS defs are community stubs, often wrong | Native strict TS, blessed Widgets types preserved |
| Bugs | Several known blessed render glitches | 2,355 tests, 98.5% coverage, active fixes |
| Cursor restoration | Manual program.hideCursor hack | Cursor restored on exit by default (alpha.22+) |
| Animation system | Hand-rolled timers + setContent | 7 built-in animation types (rainbow/pulse/chase/gradient/...) |
| Theme system | Our own token system | unblessed has runtime theme switching too — may conflict |
| Text truncation | Manual cell-count math | Ink-style truncation with ANSI code preservation |
| Flexbox layout | Manual blessed.box top/left/width math | Yoga flexbox via @unblessed/layout |
| React renderer | N/A | @unblessed/react — JSX with flexbox for new microapps |
| Browser port | Not possible | @unblessed/browser via XTerm.js — future option |
| Test harness | No UI test infra | @unblessed/vrt visual regression testing |

### Highest-value wins for WibWob-DOS

1. ANSI text truncation — we fight this constantly in list/sidebar rendering
2. Cursor restoration fix — our custom-cursor.ts is fragile
3. Proper TS types — would eliminate many `as any` casts in window code
4. VRT tooling — screenshot-based regression tests for windows
5. React renderer — new microapps could be written as JSX components

---

## Risks and unknowns

### R1: Bun compatibility (HIGH)
unblessed requires Node.js >= 22. Bun 1.3.8 implements most Node APIs
but not all. Critical unknowns:
- Does `child_process` / `tty` / `net` work correctly in Bun with unblessed?
- Does the NodeRuntime class in `@unblessed/blessed` initialise cleanly under Bun?
- Does `screen.program` (low-level tput/terminfo) behave identically?

Test: `bun add @unblessed/blessed@alpha` + smoke test the screen creation.

### R2: Alpha stability (MEDIUM)
The project is actively developed and at alpha.23. Breaking changes possible
between alpha versions. We'd want to pin to a specific alpha and vendor
the source (already done) rather than take live npm updates blindly.

### R3: Type namespace shift (LOW-MEDIUM)
If `@unblessed/blessed` re-exports `Widgets` types correctly, our 78+
type references cost nothing. If the namespace differs, that is ~78 edits.
Check: does `@unblessed/core` export a `Widgets` namespace?

### R4: `screen.program` API (LOW)
`custom-cursor.ts` calls `screen.program.hideCursor()` and `showCursor()`.
The `@unblessed/blessed` drop-in should preserve this. alpha.22 adds
automatic cursor restoration on exit — may make our custom-cursor.ts
redundant.

### R5: Our custom render loop vs unblessed render optimisation (LOW)
We have `render-monitor.ts` and carefully timed `screen.render()` calls.
unblessed has "smart CSR and damage buffer" optimisation. May help or
may conflict with our pattern of explicit render calls after every geometry change.

---

## Spike tasks

### Phase 1 — Drop-in test (Session 1)

- [~] Copy unblessed repo to `vendor/unblessed/` (done)
- [ ] Add `@unblessed/blessed@alpha` to package.json and `bun install`
- [ ] Change `import blessed from "blessed"` → `import blessed from "@unblessed/blessed"` in ONE file (app-controller.ts)
- [ ] Run `bun run typecheck` — note type errors
- [ ] Run `bun run dev` — does the app start?
- [ ] Check: does screen render correctly?
- [ ] Check: does `screen.program.hideCursor()` work?
- [ ] Check: do mouse events fire on boxes?
- [ ] If OK: change all 28 import sites, typecheck, smoke

### Phase 2 — Capability audit (Session 1 continued or Session 2)

- [ ] Test ANSI truncation on list/sidebar widgets
- [ ] Test animation API: try a rainbow/pulse on a plasma window
- [ ] Assess @unblessed/vrt for screenshot testing
- [ ] Check if @unblessed/react could power new microapps (side-by-side with blessed boxes)

### Phase 3 — Decision and outcome (Session 2)

- [ ] Write findings section below
- [ ] Decision: adopt drop-in / adopt with typed rewrite / defer / drop
- [ ] If adopt: plan the PR (import swap, type fixes, cursor simplification)
- [ ] If defer: document blockers and conditions to revisit

---

## Agent notes

| Date | Note |
|------|------|
| 2026-03-10 | Spike opened. vendor/unblessed/ added (alpha.23). Blessed usage: 40 files, 28 imports, heavy Widgets.* types. Key unknowns: Bun compat, Widgets namespace. |

---

## Findings (fill in as spike progresses)

TBD — to be populated during Phase 1 and 2.

---

---

## App Architecture: The Elm Architecture on top of blessed/unblessed

### Why this matters here

blessed gives you a widget API and an event system. It does not give you an
opinionated app architecture. Its docs describe it as "a high-level terminal
interface library with widgets and event bubbling" — full stop.

The result in practice: event-handler soup. `box.on('click', () => { selectedTool = 'brush'; status.setContent('Brush'); screen.render() })` scattered across 40 files. State split between widget internals, service singletons, and ad-hoc locals. No single path from input to output.

The Elm Architecture (TEA) solves this. It is a set of design principles, not
something tied to Elm syntax. The Elm guide explicitly says it emphasises
patterns that generalise to any language.

References:
- Elm Architecture: https://guide.elm-lang.org/architecture/
- Elm Guide: https://guide.elm-lang.org/
- blessed: https://github.com/chjj/blessed
- unblessed: https://github.com/vdeantoni/unblessed
- Migration from blessed: https://unblessed.dev/docs/getting-started/migration-from-blessed

### The core mapping

| TEA concept    | TS/blessed equivalent |
|----------------|-----------------------|
| Model          | Plain TS object holding all app state |
| Msg            | Discriminated union of all events/actions |
| update()       | Pure-ish reducer: (model, msg) -> [nextModel, effects] |
| view()         | Function deriving screen content from model |
| Cmd / Sub      | Async work and external sources: timers, keyboard, mouse, file IO, child processes, websockets |

This is the same shape the Elm guide documents.

### What the flow looks like

```
blessed event -> Msg -> update(model, msg) -> nextModel + effects -> render(nextModel)
```

Instead of:
```ts
box.on('click', () => {
  selectedTool = 'brush'
  status.setContent('Brush')
  screen.render()
})
```

You do:
```ts
dispatch({ type: 'ToolSelected', tool: 'brush' })
```

Then:
```ts
type Msg =
  | { type: 'ToolSelected'; tool: Tool }
  | { type: 'MouseDown'; x: number; y: number }
  | { type: 'KeyPressed'; key: string }
  | { type: 'Tick' }
  | { type: 'FileLoaded'; content: string }

type Model = {
  tool: Tool
  status: string
  canvas: string[][]
}

function update(model: Model, msg: Msg): [Model, Effect[]] {
  switch (msg.type) {
    case 'ToolSelected':
      return [{ ...model, tool: msg.tool, status: `Tool: ${msg.tool}` }, []]
    case 'MouseDown':
      return [paintAt(model, msg.x, msg.y), []]
    default:
      return [model, []]
  }
}
```

And the render layer becomes one place:
```ts
function render(model: Model, ui: UI) {
  ui.status.setContent(model.status)
  ui.canvas.setContent(drawCanvas(model.canvas))
  ui.screen.render()
}
```

### The critical rule: blessed is the commit layer

Do NOT try to make blessed itself pure. Treat it as the terminal IO substrate.

- Core logic stays reducer-like and testable
- View derives screen content from state
- Actual widget mutation is the final side-effect step

blessed is plumbing. Your Elm-ish layer is the architecture.

### Composing sub-models

Elm's composition model works directly in TS. Each window or panel gets its
own Model, Msg, and update. A root dispatcher routes messages downward and
lifts child messages upward.

```ts
type AppModel = {
  menu: MenuModel
  desktop: DesktopModel
  paint: PaintModel
  status: StatusModel
}

type AppMsg =
  | { type: 'MenuMsg'; msg: MenuMsg }
  | { type: 'DesktopMsg'; msg: DesktopMsg }
  | { type: 'PaintMsg'; msg: PaintMsg }
  | { type: 'StatusMsg'; msg: StatusMsg }
```

This scales. A flat widget jungle does not.

### Effects as commands

Async work — file load/save, timers, subprocess output, network, debounce,
animation ticks — should be returned as effect descriptors from update(),
not triggered inline. Elm's Cmd pattern is the right model:

```ts
type Effect =
  | { type: 'SaveFile'; path: string; content: string }
  | { type: 'LoadFile'; path: string; onDone: (content: string) => Msg }
  | { type: 'Delay'; ms: number; msg: Msg }
  | { type: 'SpawnProcess'; cmd: string; onOutput: (line: string) => Msg }
```

The runtime runs effects after each update, feeds results back as messages.
The reducer never touches IO directly.

### Five rules for TEA on a TS TUI

1. Put UI state in the model: focus, scroll offsets, selected widget, current
   modal, cursor mode, viewport position. Not half-hidden inside widgets.
2. Typed messages everywhere. TS discriminated unions give you most of Elm's
   clarity benefit without the compiler overhead.
3. Keep update() free of direct widget calls. No box.setContent() inside
   reducers. Return state and effect descriptions.
4. Treat effects as commands. Return them; do not fire them.
5. Compose sub-models. One root Model with named sub-fields; one root Msg
   with wrapper variants. Route and lift at the root dispatcher.

### How this intersects with the unblessed upgrade

The architecture advice is the same whether we stay on blessed or move to
unblessed. unblessed's typed API makes the view layer cleaner (no as any
casts, real widget types), but the TEA structure sits above the library
in both cases.

If we adopt the drop-in (@unblessed/blessed), the architecture refactor is
a separate, independent strand of work.

If we ever adopt @unblessed/react, the React/JSX renderer is itself a
TEA-compatible view layer — React's reconciler is conceptually similar to
the view -> DOM diff pattern Elm uses.

### What this would mean for WibWob-DOS

Current state: 40 files with direct blessed event wiring, state scattered
across service singletons and window locals, no single update path.

A full app-level TEA refactor would mean: one root App model, a typed Msg
union, a dispatch function wired to all blessed events, a render() called
once per update. Windows become sub-models. Commands replace inline async.

This is a multi-sprint refactor, not a spike. See "TEA: constructive
critique" section below for why full app-level TEA is probably the wrong call.

---

## Compatibility assessment (haiku agent, 2026-03-10)

Analysis of src/ against vendor/unblessed/. Seven areas checked.

### Migration guide patterns: CLEAR

All patterns we use are supported by the @unblessed/blessed backward-compat
wrapper: blessed.Widgets.* types, screen.render(), factory functions
(blessed.box, blessed.list, blessed.textbox), blessed.screen() options.
No migration-breaking patterns found in our codebase.

### Type namespace: COMPATIBLE

unblessed/packages/core/src/types/index.ts exports a Widgets namespace.
Every type we reference maps cleanly:
  blessed.Widgets.Screen, BoxElement, BlessedElement, ListElement,
  Events.IKeyEventArg, BoxOptions, TextboxElement.
No gaps or renames found.

### screen.program: COMPATIBLE

custom-cursor.ts only calls hideCursor() and showCursor(). Both exist in
unblessed Program with identical escape sequences. Access pattern unchanged.
alpha.22 adds automatic cursor restoration on exit — custom-cursor.ts may
become partially redundant if we ever migrate.

### Render loop: COMPATIBLE

RenderMonitor wraps 234 explicit screen.render() calls. unblessed's damage
buffer is an optimisation inside render() — does not change the calling
convention. No conflict.

### Grid canvas: COMPATIBLE

grid-canvas.ts is pure string manipulation feeding setContent(). No blessed
internal cell buffer access. Zero migration cost. unblessed ships CharCanvas
(vendor/unblessed/packages/core/src/widgets/char-canvas.ts) as a future
enhancement — out of scope for a drop-in swap.

### Bun 1.3.8 compatibility: NO BLOCKING ISSUES (static analysis)

@unblessed/blessed imports: fs, tty, net, child_process, stream, events,
string_decoder, buffer, url, util — all implemented in Bun 1.3.8. NodeRuntime
class wires these at module load. No dynamic requires or known Bun stubs.
Note: runtime smoke test still required before committing.

### API differences: TWO ONLY

Migration guide documents exactly two differences from blessed:
1. Node >= 22.0.0 — Bun 1.3.8 satisfies this
2. Runtime injection — transparent via @unblessed/blessed wrapper

### Overall risk rating: LOW (but see maintenance section)

Technical compatibility is solid. The only unresolved question is live
runtime smoke test under Bun. However — see maintenance reality below.

---

## Maintenance reality (2026-03-10)

### blessed

- Stars: 11,777 — forks: 562 — npm downloads: 5.6 million / month
- Last push: March 2024. Not archived.
- Open issues: 253 (longstanding; nothing critical for our usage)
- Status: stable-frozen. Not abandoned. The API is complete. The world
  depends on it. Like a load-bearing library that does what it does and
  no longer needs to change.

### unblessed

- Stars: 7 — forks: 1 — watchers: 0
- Last push: December 2025. Three months of silence at time of writing.
- Status: one-person alpha experiment. Technically impressive — strict TS,
  2,355 tests. But community signal is essentially zero. 7 stars after
  multiple alpha releases is not adoption, it is a project looking for users.

### Verdict

Stay on blessed. It is stable-frozen, not abandoned. 5.6M npm downloads/month
is the market's verdict. The ecosystem has decided it is done and working.

Revisit unblessed if and only if:
- It reaches 1.0.0 stable (not alpha)
- Meaningful community adoption (hundreds of stars, active issues/PRs)
- A specific blessed bug is blocking us that unblessed demonstrably fixes

Until then: vendor snapshot stays as reference material. Migration is parked.

## Promotion outcome

This spike now promotes to an implementation epic rather than a migration.
The follow-on plan is:

- `.planning/epics/e033-blessed-architecture-calm/e033-brief.md`

Core direction of the promotion:
- keep Blessed
- introduce explicit render/invalidation ownership
- adopt local model/update/render patterns in selected live windows
- clarify the microapp host lifecycle and redraw contract
- thin `app-controller.ts`
- improve Unicode/cell correctness, visual regression, and performance telemetry

---

## TEA: constructive critique

The Elm Architecture is excellent for a certain class of app. WibWob-DOS is
not obviously that class. This section is the honest assessment.

### The core tension

TEA's elegance comes from view-as-pure-function-of-model. Elm can do this
because it has a virtual DOM — it diffs old and new virtual trees and patches
cheaply.

blessed has no virtual DOM. Widgets are mutable objects with internal state.
To run a "view" function on every message you must either:

A. Recreate blessed boxes on every event — catastrophically slow, and you
   lose focus, scroll, and cursor state on every update.
B. Do selective widget mutation — which is exactly what the codebase already
   does, just with extra ceremony around it.

You cannot have the pure view guarantee in a blessed app. What you get is
TEA-ish: typed messages, a reducer for some state, then an imperative render
step that mutates specific widgets. That is tractable, but it is not the clean
thing the Elm guide is describing.

### Window state is genuinely heterogeneous and local

A paint canvas has brush, colour, undo stack, viewport. A music player has
playlist, playback position, visualiser mode. A terminal has scroll buffer,
cursor position, PTY state. Folding all of that into one root AppModel is not
cleaner — it is a god object. The wiring cost of sub-models is real: every
new window type adds Model, Msg wrapper, a case in root update, and a case in
root render. For a desktop that can have 20+ window types, that is a lot of
scaffolding for unclear gain.

### The app already has a service layer

state-service.ts, workspace-service.ts, wibwob-agent-session.ts — these ARE
models, just not in TEA form. The problem is not a missing architecture.
It is inconsistency: some state in services, some in window locals, some
inside blessed widget internals. TEA formalises what already exists but does
not obviously fix the inconsistency problem.

### What TEA actually gives you here

Not pure views. But:
- Typed messages: you can reason about what can happen
- Reducer: unit-test state transitions without a screen
- Effects as commands: async work is auditable and not buried in callbacks

These are worth having. The question is whether full app-level TEA is the
right vehicle for them.

### The pragmatic version

TEA at the window level, not the app level.

Each window dispatches messages internally through its own small update
function. Windows communicate upward via the existing command registry —
which is already basically a message bus. The window manager owns the spatial
model. The services own persistence. No root AppModel with every window's
state folded in.

This gives the real benefits (testable state transitions per window, typed
events, no scattered mutation) without rebuilding the composition root.

### Recommended approach

Do not refactor the app shell to TEA. It is working, complex, and the cost
would be high.

The next time a new window type is built — a paint canvas, a game, a complex
microapp — build it TEA-style internally: Model, Msg, update, imperative
render step. Evaluate whether it is actually better to work in. That is
more useful evidence than a speculative full-app refactor.

The Elm Architecture is the right way to think about state INSIDE a window.
It is probably the wrong pattern to apply wholesale to the app shell.

---

## Decision

**Stay on blessed. Park the unblessed migration. Apply TEA at window level only.**

1. blessed is stable-frozen with massive ecosystem adoption — not a problem to solve
2. unblessed is a one-person alpha with no community — wrong time to depend on it
3. TEA full app-level refactor costs too much for a working codebase; the view-
   purity guarantee is impossible on blessed anyway
4. TEA at window level is the right scope: build the next complex window TEA-style
   and validate the pattern before any broader commitment
