---
id: spk-unblessed-upgrade
title: Upgrade TUI engine from blessed to unblessed
status: in-progress
branch: spike/spk-unblessed-upgrade
created: 2026-03-10
---

# Spike: blessed → unblessed upgrade

## Question

Can we swap our TUI rendering engine from `blessed` (unmaintained, JS, no types)
to `@unblessed/blessed` or `@unblessed/node` (TypeScript-native, 2,355 tests,
active development) — and what would we gain?

## Timebox

2 sessions. Decision at end: adopt, defer, or drop.

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

Target: a root App model, a typed Msg union, a dispatch function wired to
all blessed events, a render() called once per update. Windows become
sub-models. Commands replace inline async.

This is a multi-sprint refactor, not a spike. But the spike is a good place
to prototype the shape of the dispatcher and one window sub-model to validate
the pattern before committing.

---

## Decision

TBD
