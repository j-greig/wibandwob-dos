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
- `src/core/overlay-manager.ts`
  - transient UI primitives: flash, prompts, shared browser/openers
- `src/services/state-service.ts`
  - canonical live desktop/app/window state snapshot
- `src/services/control-api.ts`
  - local HTTP control surface over state + window actions
- `src/services/workspace-service.ts`
  - named workspace persistence only
- `src/services/content-service.ts`
  - repo content discovery and text-file utility behavior
- `src/services/backrooms-service.ts`
  - Backrooms-specific corpus, run-root prep, playback helpers
- `src/services/figlet-service.ts`
  - shared FIGlet catalogue + real CLI render bridge

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
  - Desktop state shape lives in `StateService` + `types.ts`.
  - Backrooms primer resolution lives in `BackroomsService`.
- Prefer composable helpers over inheritance theater.
  - No framework-within-a-framework.
  - Small functions, direct wiring, obvious ownership.

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
