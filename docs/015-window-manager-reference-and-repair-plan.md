# Window Manager Reference And Repair Plan

Status: draft
Scope: terminal-native TS spike only

## Why this doc exists

The current spike proves the renderer, menus, state API, and several window
types. It does **not** yet prove the window manager.

Recent bugs make that clear:

- drag can cause a window to disappear on mouse release
- focus/z-order is not always visually coherent during move/drag
- tile/cascade origins were off by one row/column
- resize/repaint can leave stale text if the content view does not rerender
- shadows and wide-glyph content can leave ghost cells behind until another
  window happens to repaint over them

This is not surprising. `blessed` gives good terminal UI primitives, but it
does **not** ship a complete desktop/window-manager model. The app must own:

- z-order policy
- focus policy
- drag lifecycle
- resize lifecycle
- click suppression after drag
- layout presets
- repaint invalidation
- deterministic shadow/ghost-cell cleanup

So the right question is not "which library solves Turbo Vision desktop
windowing for us?" The right question is "which maintained codebases have the
best ideas worth borrowing into our own `WindowManager`?"

## Short answer

Use `blessed` as the renderer for now, but borrow window-manager logic from:

1. `terminal-kit`
2. `Terminal.Gui`
3. `stmux`
4. `@farjs/blessed`
5. `blessed` source itself

Do **not** assume one JS package already solves "Turbo Vision desktop inside a
terminal" cleanly.

## What `blessed` solves vs does not solve

`blessed` is good at:

- absolute positioning
- boxed widgets
- borders, lists, forms
- full-screen terminal ownership
- key and mouse event routing
- screen redraw

Useful source references:

- upstream repo: [chjj/blessed](https://github.com/chjj/blessed)
- examples: [example/](https://github.com/chjj/blessed/tree/master/example)
- tests: [test/](https://github.com/chjj/blessed/tree/master/test)
- textbox source: [lib/widgets/textbox.js](https://github.com/chjj/blessed/blob/master/lib/widgets/textbox.js)
- textarea source: [lib/widgets/textarea.js](https://github.com/chjj/blessed/blob/master/lib/widgets/textarea.js)

`blessed` does **not** solve for us:

- desktop-style overlapping window policy
- robust drag + release semantics
- explicit z-order model
- click suppression after drag
- layout presets like tile/cascade/magazine/cinema
- universal content resize contracts
- reliable stale-cell cleanup for shadows, wide glyphs, and overlapping repaint

That logic belongs in our code.

## Best external references to borrow from

### 1. Terminal Kit

Primary reference:

- repo: [cronvel/terminal-kit](https://github.com/cronvel/terminal-kit)

Why it matters:

- has a document model for interactive widgets
- explicitly supports focus and mouse dispatch
- has overlap-aware GUI ambitions
- has a `Window` direction in the document system

What to borrow conceptually:

- document-level focus ownership
- predictable mouse capture and release
- explicit input routing by active widget
- container-first layout thinking

Useful entry points:

- repo root: [terminal-kit](https://github.com/cronvel/terminal-kit)
- samples: [sample/](https://github.com/cronvel/terminal-kit/tree/master/sample)
- document model docs in README/changelog

What **not** to do:

- do not pivot the spike wholesale to Terminal Kit mid-repair
- use it as a design reference, not as an immediate framework migration

### 2. Terminal.Gui

Primary reference:

- docs: [Terminal.Gui v2 docs](https://gui-cs.github.io/Terminal.Gui/docs/newinv2)
- repo: [gui-cs/Terminal.Gui](https://github.com/gui-cs/Terminal.Gui)

Why it matters:

- closest modern terminal GUI reference to Turbo Vision ideas
- explicitly models `View`, focus, containers, layout, move/resize
- much closer to the architecture we want than most JS TUIs

What to borrow conceptually:

- one authoritative view tree
- top-level desktop coordinates vs child coordinates
- view-local bounds, not ad hoc screen-relative math
- clear separation between content bounds and chrome bounds
- deterministic repaint ownership instead of trusting incidental terminal diffing

Useful places to read:

- docs root: [newinv2](https://gui-cs.github.io/Terminal.Gui/docs/newinv2)
- repo root: [Terminal.Gui](https://github.com/gui-cs/Terminal.Gui)

### 3. stmux

Primary reference:

- repo: [rse/stmux](https://github.com/rse/stmux)

Why it matters:

- real terminal-native app with pane/window logic
- useful example of keyboard focus and layout decisions around terminal regions

What to borrow:

- pane focus model
- terminal subview ownership patterns
- key-routing ideas

Do **not** copy:

- app-level product architecture
- assume mux pane logic equals desktop window logic

### 4. @farjs/blessed

Primary reference:

- repo: [farjs/blessed](https://github.com/farjs/blessed)

Why it matters:

- maintained blessed lineage
- useful as a sanity check against upstream `blessed` quirks

What to borrow:

- practical modern blessed expectations
- bug workarounds
- maintained TS-facing usage patterns

### 5. Blessed source itself

Primary references:

- [textbox.js](https://github.com/chjj/blessed/blob/master/lib/widgets/textbox.js)
- [textarea.js](https://github.com/chjj/blessed/blob/master/lib/widgets/textarea.js)

Why it matters:

- input bugs in this spike were directly caused by misunderstanding how
  `inputOnFocus`, `readInput()`, `_reading`, and focus rewinding interact

What to borrow:

- only one input lifecycle per widget
- never mix manual and implicit read modes casually
- expect hidden focus rewinding behavior when using `inputOnFocus`

## What we should **not** chase right now

### Rezi

- site: [rezitui.dev](https://rezitui.dev/)

Good Bun-native toolkit, but not the best fit for overlapping desktop-style
window management. The earlier spike already showed it pushed us away from the
actual WibWob shape.

### blessed-xterm as a window-manager answer

- repo: [rse/blessed-xterm](https://github.com/rse/blessed-xterm)

Relevant for terminal emulation, not for desktop window-manager policy.

### Electrobun / webview

- docs: [blackboard.sh/electrobun/docs](https://blackboard.sh/electrobun/docs/)

Potentially useful for a different product direction, but not for repairing the
terminal-native spike.

## Current spike files that matter most

The current ownership is already mostly right:

- window manager: [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts)
- controller orchestration: [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts)
- state surface: [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/state-service.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/state-service.ts)
- type contracts: [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/types.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/types.ts)

The next step is not more extraction for its own sake. The next step is to make
`WindowManager` behavior correct and boring.

## Rules to borrow into our own WindowManager

### Rule 1: Desktop coordinates are desktop-relative

Never mix screen-relative and desktop-relative Y coordinates.

In this spike:

- desktop starts under the menu bar
- child windows should treat desktop `top=0` as the first valid row
- no method should clamp some paths to `top >= 1` and others to `top >= 0`

### Rule 2: Drag is a captured interaction, not a click side effect

Real drag flow:

1. `mousedown` on title bar starts capture
2. subsequent `mousemove` updates frame origin by delta
3. `mouseup` ends capture
4. post-drag click on the same control should be ignored briefly

This is the likely cause of the current "window disappears on release" bug.

### Rule 3: Focus and z-order are one policy

When a window is focused:

- it becomes the front-most sibling
- visual chrome updates to match
- this happens consistently on click, title drag start, resize grip, and API focus

Do not rely on only `setFront()` or only array order. Keep both coherent.

### Rule 4: Layout presets operate on desktop bounds only

Tile/cascade should compute from:

- desktop width
- desktop height
- zero-based desktop origin

They should not manually compensate for the menu/status rows. The desktop
already accounts for that.

### Rule 5: Views rerender when their frame changes

When bounds change:

- content views with wrapping need rerender
- terminal buffers need viewport refresh
- chat/text windows need transcript/input refresh

Window geometry changes are not purely frame changes. They are often content
layout changes.

### Rule 6: Every user-visible action needs state/API parity

This repo canon already applies:

- open/focus/move/resize/close should be in control API
- state should reflect title, type, size, position, focus, content metadata

This is critical for automated verification loops.

## Useful code to inspect locally before changing behavior

Local spike code:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/state-service.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/state-service.ts)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/wibwob-chat-window.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/wibwob-chat-window.ts)

Local blessed source:

- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/node_modules/blessed/lib/widgets/textbox.js](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/node_modules/blessed/lib/widgets/textbox.js)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/node_modules/blessed/lib/widgets/textarea.js](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/node_modules/blessed/lib/widgets/textarea.js)
- [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/node_modules/blessed/example/simple-form.js](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/node_modules/blessed/example/simple-form.js)

## Concrete repair plan

### Epoch A — Make drag/release impossible to destroy a window

- [ ] add temporary WM trace logging under `scratch/window-manager.log`
- [ ] log `mousedown`, `mousemove`, `mouseup`, `click`, `focus`, `close`
- [ ] confirm whether post-drag click is still firing close/focus paths
- [ ] keep click suppression after drag
- [ ] ensure no drag path mutates `windows[]` except through `focusWindow()`
- [ ] verify with manual drag on `Scramble` and `Wib&Wob Chat`

### Epoch B — Normalize coordinate space

- [ ] audit every `top` clamp and default in `WindowManager`
- [ ] ensure all desktop children use desktop-relative coordinates only
- [ ] keep tile origin at desktop `(0,0)`
- [ ] keep cascade origin at desktop `(1,0)`
- [ ] verify state snapshots after `tile` and `cascade`

### Epoch C — Make z-order deterministic

- [ ] ensure `focusWindow()` is the only place that reorders `windows[]`
- [ ] make all focus entry points route through it
- [ ] verify click, drag-start, resize-start, API focus all produce same z-order
- [ ] add a control-API smoke that opens three windows and focuses them in order

### Epoch D — Rerender on geometry change

- [ ] ensure chat rerenders on resize
- [ ] ensure buffered terminal rerenders on resize
- [ ] ensure text viewers/editors rerender or reposition cursor on resize
- [ ] add text-capture verification after resize

### Epoch E — Only then consider more abstraction

- [ ] if WM behavior is stable, split `WindowManager` into:
  - geometry policy
  - drag/resize controller
  - z-order/focus controller
- [ ] do not split before behavior is stable

## Verification loop

Use the existing spike API/state loop, not just eyeballing.

Current artifacts:

- state: [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scratch/app-state.json](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scratch/app-state.json)
- captures: [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scratch/captures](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scratch/captures)
- xterm logs: [/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scratch/xterm](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/scratch/xterm)

Recommended loop:

1. start the app
2. query `/state`
3. open/focus/move/resize via control API where possible
4. export text capture
5. compare with expected desktop state
6. patch one window-manager rule at a time

## Recommendation

Do not switch frameworks yet.

The right move is:

- keep `blessed`
- repair `WindowManager`
- borrow policy ideas from Terminal Kit and Terminal.Gui
- study `stmux` and `blessed-xterm` only for terminal-pane behavior

If the repaired spike still fights us after the window manager is stable, then
re-evaluate the renderer. Not before.
