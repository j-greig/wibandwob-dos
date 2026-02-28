# AGENTS.md

This file is local guidance for agents working in `/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp`.

## Purpose

This spike is a terminal-native TypeScript MVP of a WibWob-DOS-style desktop shell.

Current goals:
- stay terminal-native
- use Bun as the runtime and package manager
- use `blessed` for rendering
- prove overlapping desktop-style windows, menus, file viewers, editing, and small animated views
- keep scope small and honest

Non-goals:
- do not port all of Turbo Vision here
- do not pretend this is already a full VT terminal emulator
- do not pivot this spike toward Electrobun or webview rendering unless explicitly requested

## Design Canon

This spike exists partly to undo the duplication and verbosity that accumulated in the C++ app.

The bar is:

- one concept, one owner
- one measurement path
- one sizing path
- one state path
- one layout path
- one agent/runtime integration path per feature

The code should be:

- DRY without becoming abstract theater
- small in surface area
- explicit in data flow
- semantically precise
- easy for multiple agents to extend without creating parallel systems

Prefer the most elegant correct implementation, not the fastest pile of special cases.

## Stack

- Runtime: Bun
- Renderer: `blessed`
- PTY backend: `@skitee3000/bun-pty`
- Main app entry: `/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/app.ts`

## Architecture

- `src/app.ts`
  - runtime bootstrap only
  - normalize env before importing the app controller
- `src/core/app-controller.ts`
  - app composition root
  - owns menus, startup, window creation, workspace restore, and high-level command flow
  - should coordinate, not become a utility dump
- `src/core/window-manager.ts`
  - z-order, focus, drag, resize, tile, cascade, close
- `src/core/desktop-geometry.ts`
  - canonical terminal geometry snapshot
  - exposes `{width, height, cellAspect}`
- `src/core/window-chrome.ts`
  - maps content size to window size
  - chrome offsets live here, not inline in window code
- `src/core/overlay-manager.ts`
  - transient UI primitives: flash, prompts, shared browser/openers
- `src/services/state-service.ts`
  - canonical live desktop/app/window state snapshot
  - every window should report semantic content metadata through `describeState()`
- `src/services/control-api.ts`
  - local HTTP control surface over state + window actions
- `src/services/workspace-service.ts`
  - named workspace persistence only
- `src/services/content-service.ts`
  - repo content discovery and text-file utility behavior
- `src/services/content-measurement.ts`
  - shared content measurement for primers, text, and future content types
  - returns content metrics, never chrome-adjusted widget math baked into callers
- `src/services/backrooms-service.ts`
  - Backrooms-specific corpus, run-root prep, playback helpers
- `src/services/figlet-service.ts`
  - shared FIGlet catalogue + real CLI render bridge

## Architecture Invariants

These rules are strict. Treat violations as bugs, not style nits.

1. Single source of truth per concern.
   - If a concept already has a home, extend that home.
   - Do not create a second helper/service/path for the same concern because it is locally convenient.

2. Measurement is content-only.
   - Content measurement returns content dimensions and content semantics.
   - Border, titlebar, padding, toolbar, and shadow are chrome, not content.

3. Chrome is declarative.
   - Window size math belongs in `window-chrome.ts`.
   - No inline `+2`, `+3`, `+6`, or copied size formulas in window code.

4. Desktop geometry is canonical.
   - Screen width/height/cellAspect come from `DesktopGeometryService`.
   - Do not invent local geometry math unless the result is immediately derived from canonical geometry.

5. Window state is self-describing.
   - Every window type must expose semantic metadata through `describeState()`.
   - If an agent needs a property, add it to the window metadata contract rather than teaching the agent to scrape UI text.

6. One reusable interaction component before many prompts.
   - Repeated picker/open/select flows belong in `OverlayManager` or a dedicated shared component.
   - Do not add one-off textbox prompts for file/font/workspace/content selection when a shared browser can do it.

7. Layout is an engine, not scattered commands.
   - New placement logic should move toward shared layout primitives, not bespoke coordinate code per feature.

8. Services own logic, windows own wiring.
   - Services discover, measure, persist, resolve, and transform data.
   - Window factories render widgets, bind keys/mouse, manage focus/cleanup, and expose state.

9. No duplicate fallbacks unless centrally owned.
   - If a fallback mode exists, it must be declared in the owning service.
   - Do not embed secondary fallback logic inside window code and service code at the same time.

10. Experimental integrations must stay behind one seam.
   - If we try a foreign runtime or agent stack, wrap it in a single service boundary first.
   - Do not leak vendor-specific assumptions across the app.

## Code Style

- Keep state explicit.
  - Prefer plain values and small records over hidden widget state.
- Keep services pure where possible.
  - File discovery, render helpers, workspace I/O, and catalogue logic belong in services.
- Keep window behavior local to the window factory.
  - A window type should own its content widget wiring, focus behavior, cleanup, and `describeState()`.
- Reuse shared browser/picker primitives.
  - Do not add new ad hoc one-line prompts for file/workspace/font selection when a browser/list picker fits.
- One source of truth per concern.
  - Workspace paths live in `WorkspaceService`.
  - Desktop geometry lives in `DesktopGeometryService`.
  - Window chrome math lives in `window-chrome.ts`.
  - Content measurement lives in `content-measurement.ts`.
  - Desktop state shape lives in `StateService` + `types.ts`.
  - Backrooms primer resolution lives in `BackroomsService`.
- Content metrics are content metrics.
  - `contentWidth` / `contentHeight` should describe the renderable payload.
  - Border, titlebar, toolbar, and padding belong to chrome sizing, not measurement.
- Keep names precise.
  - Prefer domain names that describe intent: `measurePrimerContent`, `contentToWindowSize`, `getPrimerInfo`.
  - Avoid vague helpers like `utils`, `misc`, `helpers2`, or duplicate verbs for the same operation.
- Prefer composable helpers over inheritance theater.
  - No framework-within-a-framework.
  - Small functions, direct wiring, obvious ownership.

## Anti-Patterns

Do not introduce these:

- parallel measurement functions for different callers
- per-window copies of generic sizing logic
- state fields that duplicate the same fact under different names
- direct widget scraping when semantic state can be exposed
- vendor code referenced directly from many app files
- giant controller growth when a window family or service can be extracted cleanly
- “just this once” prompt flows that should be shared components
- hardcoded geometry magic numbers without named ownership

## Pi Integration Rule

`pi-mono` is vendored for evaluation and potential runtime reuse.

Current direction:

- yes to using `pi-coding-agent` as an engine inside the TS spike
- no to letting vendor UI own the desktop/window-manager architecture

The safe rule is:

- if we embed pi, wrap it behind one service such as `wibwob-agent-service.ts`
- our app still owns:
  - window chrome
  - workspace restore
  - desktop state
  - z-order / resize / drag
  - typed metadata for agent-visible state

If we experiment with a PTY-hosted interactive pi session inside a terminal window, treat it as an experiment, not the architectural foundation. The foundation should still be service-backed and state-aware.

Run commands:

```bash
bun install
bun run typecheck
bun run dev
```

## Current Behavior

The spike currently includes:
- fullscreen terminal app shell
- top menu bar
- bottom status line
- desktop background fill
- draggable floating windows
- primer viewer window
- text editor window
- primer browser window
- shared browser/openers for workspace and file selection
- animated generative art window
- experimental shell window backed by Bun PTY
- Backrooms TV with real/fake-live modes and per-run primer roots
- FIGlet window backed by the shared font catalogue and real `figlet` CLI

## Important Constraints

1. Keep this spike pragmatic.
   - Prefer the smallest vertical slice that makes the terminal-native direction clearer.
   - Avoid speculative abstractions.

2. Preserve the desktop-window-manager feel.
   - Overlapping windows, focus, z-order, drag, tile, and cascade matter more than fancy widgets.
   - If a library shortcut breaks the WibWob desktop feel, it is probably the wrong shortcut.

3. Be honest about the terminal.
   - The current shell window is a shell pane, not a full embedded VT emulator.
   - PTY launch should work.
   - Fullscreen TUIs inside the pane should not be claimed as supported unless they actually work.

4. Prefer custom simple behavior over broken widget magic.
   - The editor and drag logic are intentionally custom because some stock blessed behaviors were flaky.
   - If a built-in blessed widget regresses interaction, replace or wrap it rather than fighting it blindly.

5. Keep Bun-first assumptions.
   - Do not reintroduce Node-only runtime assumptions unless explicitly necessary.
   - `node-pty` previously failed under Bun with `posix_spawnp failed`; the spike uses `@skitee3000/bun-pty` now.

## Editing Guidance

When changing the spike:
- extract repeated picker/browser behavior into `OverlayManager` or a focused service
- extract new window types out of `app-controller.ts` once they stop being tiny
- keep `app-controller.ts` as orchestration, not as the place all parsing/render helpers go
- prefer explicit state for drag/focus/window management
- update `describeState()` whenever a window gains meaningful new internal state

If you add a new window type:
- extend `WindowKind`
- wire it through menus or a clear key path
- ensure it can focus cleanly
- ensure cleanup runs on close if timers or external resources are involved
- add meaningful `describeState()` metadata
- if it renders sized content, route its measurement through `content-measurement.ts`
- if it needs non-standard chrome, declare that in `window-chrome.ts`
- if it repeats a pattern already used elsewhere, extract the pattern first

If you change terminal behavior:
- test PTY launch directly
- test the in-app terminal window
- separate “shell commands work” from “real TUI apps work”

## Verification

At minimum, run:

```bash
bun run typecheck
```

When touching interactive behavior, also do a manual smoke run:

```bash
bun run start
```

Manual smoke targets:
- open menu items
- open a primer
- open a text file
- type in the editor
- drag a window
- close a window
- open the terminal pane and run a simple command like `pwd` or `echo ok`

## Known Rough Edges

- The terminal pane still is not a real VT renderer.
- `app-controller.ts` is still too large and should continue being decomposed into window-family helpers.
- Workspace startup semantics are not yet unified with default workspace auto-load.
- Shared open/save UX is improving, but save-as still uses the older textbox path.

## Preferred Next Steps

Good next slices:
1. resize handles and stronger window management
2. better file open/save UX
3. cleaner shell-pane behavior
4. screenshot/export support for comparing layouts to WibWob-DOS captures

Avoid:
1. full Turbo Vision porting work
2. heavy framework layering
3. pretending terminal emulation is solved when only PTY spawning works
