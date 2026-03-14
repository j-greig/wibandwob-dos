# Building custom microapps for WibWob-DOS

## TL;DR

Create a directory under `microapps/` with a `microapp.json` manifest and an
`index.ts` entry point. Your setup function receives a `MicroappHost` that
gives you window creation, command registration, theme access, and screen
rendering. Reload or restart the app and your microapp appears in the menus.

Terminology:

- repo folder name: `microapps/`
- runtime concept: `microapp`
- manifest file: `microapp.json`
- private sibling tree: `microapps-private/` for non-public microapps, commonly
  maintained as a separate private repo/submodule

## Quick start

Use the scaffold script to create a new microapp package:

```bash
bash scripts/scaffold-microapp.sh microapps/my-app wibwob.myapp "My App" 150
```

This creates `microapps/my-app/microapp.json` and `microapps/my-app/index.ts` with
working boilerplate. Restart the app or run `wibwob cmd microapps.reload` and
"My App" appears in the Applications menu and command palette.

Related scripts and tools:

- `bash scripts/scaffold-microapp.sh ...` — scaffold a new microapp package
- `wibwob cmd microapps.reload` — canonical microapp-only reload path
- `bun run watch:microapp -- microapps/my-app --open` — best-effort reopen loop
- `bash scripts/restart.sh` — required when you changed `src/` host code
- `./scripts/screenshot-window.sh "My App"` — text-first visual proof
- `tmux attach -t wibwob` — look at the actual TUI, not only `/state`

## Directory structure

```
microapps/
  my-app/
    microapp.json    # manifest — tells the loader what this microapp package is
    index.ts       # entry point — exports a default setup function
```

## The manifest: microapp.json

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "description": "My custom app",
  "type": "microapp",
  "entry": "index.ts",
  "microapp": {
    "id": "wibwob.myapp",
    "title": "My App",
    "description": "A short description shown in command listings.",
    "multiInstance": false,
    "persist": false,
    "menu": [
      { "category": "applications", "order": 150, "label": "My App" }
    ],
    "palette": { "order": 150, "label": "Open My App" },
    "agent": true,
    "api": true
  }
}
```

Key fields:

- `id` — globally unique microapp identifier, used as `appType` in state
- `multiInstance` — true if multiple windows of this type can coexist
- `persist` — true if window state should survive workspace save/restore
- `menu` — where the app appears in the menu bar
- `palette` — where the app appears in the command palette
- `agent` — whether the Wib&Wob agent can open this app
- `api` — whether the control API can open this app

Optional top-level dev fields:

- `dev.watch` — relative files or directories to watch for microapp-only reload
- `dev.reopenCommand` — command to run after `microapps.reload` when a watcher is
  hot-reopening the microapp's windows
- `dev.reopenArgs` — JSON args passed to that reopen command

Example:

```json
"dev": {
  "watch": ["index.ts", "microapp.json"],
  "reopenCommand": "microapp.wibwob.myapp.open"
}
```

## The entry point: index.ts

```typescript
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "My App",
    description: "Open the My App window.",
    menu: [{ category: "applications", order: 150, label: "My App" }],
    palette: { order: 150, label: "Open My App" },
    action: () => openMyApp(host),
  });
}

function openMyApp(host: MicroappHost) {
  const win = host.createWindow({ title: "My App", width: 60, height: 20 });

  const content = blessed.box({
    parent: win.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    content: "Hello from My App!",
    style: host.theme().body,
  });

  // Required lifecycle hooks:

  win.describeState(() => ({
    summary: "My App — running.",
  }));

  win.captureText(() => content.getContent());

  win.onRestyle(() => {
    content.style = host.theme().body;
    host.screen.render();
  });

  win.onCleanup(() => {
    // Stop timers, close connections, etc.
  });
}
```

## Host API reference

The `host` object (`MicroappHost`) provides:

### host.createWindow(init)

Creates a new window and returns a `MicroappWindowHandle`.

```typescript
const win = host.createWindow({
  title: "My App",
  width: 60,
  height: 20,
  left: 10,   // optional
  top: 5,     // optional
});
```

### Window handle methods

- `win.body` — the blessed box you parent your widgets to
- `win.id` — the window's numeric ID in the window manager
- `win.focus()` — bring the window to front and focus it
- `win.close()` — close and destroy the window
- `win.setFocusTarget(widget)` — redirect keyboard focus to a specific widget
- `win.setTitle(title)` — update the window's title bar text
- `win.describeState(fn)` — REQUIRED: return semantic state for GET /state
- `win.captureText(fn)` — REQUIRED: return plain text content for text export
- `win.onCleanup(fn)` — REQUIRED: called when the window closes
- `win.onRestyle(fn)` — called when the theme changes
- `win.onResize(fn)` — called when the window is resized
- `win.onInput(fn)` — receive text input from the control API

### host.registerCommand(def)

Registers a command that appears in menus, palette, and API.

```typescript
host.registerCommand({
  id: "open",
  label: "My App",
  description: "Open the window.",
  menu: [{ category: "applications", order: 150, label: "My App" }],
  palette: { order: 150, label: "Open My App" },
  action: () => openMyApp(host),
});
```

For commands that query or control an already-open window rather than opening
one, add `direct: true` so the return value passes through to the API caller:

```typescript
host.registerCommand({
  id: "inspect",
  direct: true,
  label: "Inspect My App",
  description: "Return current state from the running window.",
  action: () => ({ ok: true, status: "ready", tick: currentTick }),
});
```

Without `direct: true`, the host may focus/open a window and swallow the
return value.

## Fast reload loop

Microapp-only changes do not need a full shell restart anymore.

```bash
bun run typecheck
wibwob cmd microapps.reload
```

For edit-save-reload during development, there is also an experimental watcher:

```bash
bun run watch:microapp -- microapps/my-app --open
```

What it tries to do:

- watches `dev.watch` entries from `microapp.json` or defaults to `index.ts,microapp.json`
- runs `microapps.reload`
- if the microapp is already open, attempts a close → reload → reopen cycle using `dev.reopenCommand`
- attempts to restore the reopened window geometry

Current status:

- `microapps.reload` itself is stable and is the canonical microapp-only reload path
- hot-swapping an already-open microapp window is still best-effort
- reliable full window-state handoff is a later abstraction task, not part of
  the stable refactor contract

## Input ownership

Global app cycling no longer owns bare `Tab`.

- use `Tab` and `Shift-Tab` inside your microapp when they are useful
- the shell-level app-cycle path is `Meta-Tab` / `Meta-Shift-Tab`
- if your terminal does not send those chords cleanly, expose an in-app fallback
  key as well
- some modules can be reopened cleanly, but reliable state handoff needs a
  higher-level host abstraction than this refactor should build

Use the watcher as scaffolding during development, not as a guaranteed hot
microapp runtime. If you need certainty, close the microapp window first or fall
back to a shell restart.

### host.screen

The blessed screen instance. Call `host.screen.render()` after visual changes.

### host.theme()

Returns the current theme object. Use in `style:` properties and in `onRestyle`.

### host.pickFile(label, startDir, onSelect, options?)

Opens a file browser prompt overlay. The user navigates directories and picks
a file. `onSelect` receives the absolute path. Options: `fileFilter`,
`previewLimit`, `directoriesOnly`.

### host.flash(message)

Show a transient flash message on the TUI overlay layer.

### host.promptValue(label, defaultValue, onSubmit)

Prompt the user for a single text value via overlay.

### host.repoRoot

Absolute path to the WibWob-DOS repo root. Use instead of hardcoding paths.

## Required lifecycle hooks

Every microapp window MUST implement these four hooks:

1. `win.describeState(() => ({ summary: "..." }))` — semantic state for agents
   and GET /state. Without this, workspace restore and agent tools degrade.

2. `win.captureText(() => "text content")` — plain text for GET /windows/text
   and text export. Return the visible content of your window.

3. `win.onCleanup(() => { ... })` — stop timers, close connections, release
   resources. Without this, closing the window leaks.

4. `win.onRestyle(() => { ... })` — update widget styles from `host.theme()`
   when the user cycles themes. Call `host.screen.render()` at the end.

## Adding animation

### Simple timers

Use `createTimer` from the SDK for interval-based updates:

```typescript
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";

function openMyApp(host: MicroappHost) {
  const win = host.createWindow({ title: "Animated", width: 40, height: 10 });
  const timers = new Set<ReturnType<typeof setInterval>>();

  const display = blessed.box({
    parent: win.body,
    top: 0, left: 0, right: 0, bottom: 0,
    style: host.theme().body,
  });

  let tick = 0;
  createTimer(() => {
    tick++;
    display.setContent(`Tick: ${tick}`);
    host.screen.render();
  }, 100, timers);

  win.describeState(() => ({ summary: `Animated — tick ${tick}` }));
  win.captureText(() => `Tick: ${tick}`);
  win.onRestyle(() => { display.style = host.theme().body; host.screen.render(); });
  win.onCleanup(() => clearTimers(timers));
}
```

### Embedded live animation

For animated subsurfaces inside a larger module, use `createEmbeddedLivePlayer`
instead of a handwritten timer loop:

```typescript
import { createEmbeddedLivePlayer, readNodeViewport } from "../../src/services/microapp-sdk.js";

const player = createEmbeddedLivePlayer({
  fps: 6,
  generator: (tick, width, height) => renderMyFrame(tick, width, height),
  getViewport: (target) => readNodeViewport(target, {
    minWidth: 8, minHeight: 4,
    fallbackWidth: 24, fallbackHeight: 6,
  }),
  onFrame: (content) => { /* update dependent state */ },
  render: () => host.screen.render(),
});

player.attachTarget(myAnimatedBox);
player.setRunning(true);
win.onCleanup(() => player.destroy());
```

## SDK imports

Import shared helpers from the SDK surface, not from deep `src/` paths:

```typescript
// Good — canonical SDK import
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";

// Bad — reaches into core internals
import { createTimer } from "../../src/core/ui-primitives.js";
```

The SDK re-exports all helpers that microapp authors need. If something is missing,
add it to `src/services/microapp-sdk.ts` rather than importing from `src/core/`.

Additional SDK exports for specialised modules:

```typescript
// Syntax highlighting (for code editors)
import { highlightCode, HIGHLIGHTED_LANGUAGES } from "../../src/services/microapp-sdk.js";

// Theme variant type (for theme modules)
import type { ThemeVariant } from "../../src/services/microapp-sdk.js";
```

## Workspace persistence

If your module sets `"persist": true` in `microapp.json`, implement snapshot
save/restore so the window survives workspace save/load cycles. The window
handle provides snapshot hooks through the host's workspace system.

## Verification checklist

After creating your module:

1. `bun run typecheck` — must pass
2. Restart the app
3. Check the Applications menu for your app
4. Open it and verify the window appears
5. Check `curl http://127.0.0.1:8099/state` — your window should appear with
   the correct `appType` and `summary`
6. Cycle the theme — your window should restyle correctly
7. Close the window — no console errors, no leaked timers

## Common mistakes

- Importing from `app-controller.ts` or other load-bearing internals
- Adding widgets to the window frame instead of `win.body`
- Forgetting `describeState` and `captureText` (breaks /state and text export)
- Forgetting `direct: true` for query/control commands that must return data
- Reading `host.theme()` once at startup and never restyling
- Forgetting cleanup for timers, subscriptions, or players
- Using `setInterval` directly instead of `createTimer` (leaks on close)

## Examples in the repo

- `microapps/demo-hello-world/` — minimal static example (figlet banner)
- `microapps/demo-heartbeat/` — animated example with timers and state reporting
- `microapps/demo-glitchbox/` — complex animated surface with multiple commands
- `microapps/dream-forecast/` — stateful microapp with per-window model
- `microapps/demo-e026-demo/` — broad feature sampler (tween, tree widget, sidebar)
- `microapps/demo-wibwob-poetry-clock/` — compact but lived-in real app

## Further reading

- `src/services/microapp-sdk.ts` — full list of SDK exports
- `.agents/microapp-dev/sdk-reference.md` — SDK API reference and advanced primitives
- `scripts/scaffold-microapp.sh` — automated module scaffolding
