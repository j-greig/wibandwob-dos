# Building custom modules for WibWob-DOS

## TL;DR

Create a directory under `modules/` with a `module.json` manifest and an
`index.ts` entry point. Your setup function receives a `MicroappHost` that
gives you window creation, command registration, theme access, and screen
rendering. Restart the app and your module appears in the menus.

## Quick start

Use the scaffold script to create a new module:

```bash
bash scripts/scaffold-microapp.sh modules/my-app wibwob.myapp "My App" 150
```

This creates `modules/my-app/module.json` and `modules/my-app/index.ts` with
working boilerplate. Restart the app and "My App" appears in the Applications
menu and command palette.

## Directory structure

```
modules/
  my-app/
    module.json    # manifest — tells the loader what this module is
    index.ts       # entry point — exports a default setup function
```

## The manifest: module.json

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

### host.screen

The blessed screen instance. Call `host.screen.render()` after visual changes.

### host.theme()

Returns the current theme object. Use in `style:` properties and in `onRestyle`.

## Required lifecycle hooks

Every module window MUST implement these four hooks:

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

The SDK re-exports all helpers that module authors need. If something is missing,
add it to `src/services/microapp-sdk.ts` rather than importing from `src/core/`.

## Workspace persistence

If your module sets `"persist": true` in `module.json`, implement snapshot
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

- `modules/demo-hello-world/` — minimal static example (figlet banner)
- `modules/demo-heartbeat/` — animated example with timers and state reporting
- `modules/demo-glitchbox/` — complex animated surface with multiple commands
- `modules/dream-forecast/` — stateful microapp with per-window model
- `modules/demo-e026-demo/` — broad feature sampler (tween, tree widget, sidebar)
- `modules/demo-wibwob-poetry-clock/` — compact but lived-in real app

## Further reading

- `src/services/microapp-sdk.ts` — full list of SDK exports
- `.agents/module-dev/sdk-reference.md` — SDK API reference and advanced primitives
- `scripts/scaffold-microapp.sh` — automated module scaffolding
