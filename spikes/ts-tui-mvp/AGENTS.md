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
- animated generative art window
- experimental shell window backed by Bun PTY

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

When changing `/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/app.ts`:
- keep new helpers small and local
- reduce repeated config where it is obvious
- do not turn the spike into a large framework
- prefer explicit state for drag/focus/window management

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

- The terminal pane still strips control sequences and is not a real VT renderer.
- Window resizing is not fully implemented yet.
- The spike is still mostly single-file and intentionally rough.

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
