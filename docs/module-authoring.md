# Module Authoring Guide

## TL;DR

If you want to build a custom WibWob-DOS app, start with `modules/hello-world/`,
import from `../../src/services/microapp-sdk.js`, register one `open` command,
and render everything inside `win.body`.

Use `module.json` for metadata and command placement.
Use `win.describeState()` and `win.captureText()` so the app, API, and agents can
see something meaningful.
Use `win.onCleanup()` for timers and `win.onRestyle()` for theme updates.

Good starter references:

- minimal: `modules/hello-world/`
- richer live module: `modules/glitchbox/`
- broad feature demo: `modules/e026-demo/`
- composition note: `docs/ascii-composition-vocabulary.md`
- scaffold helper: `bash scripts/scaffold-microapp.sh modules/<name> <app-id> "<Title>"`

## What a module is

In this repo, a custom app usually means a microapp module under `modules/`.
A microapp is a TypeScript entrypoint plus a `module.json` manifest. The host
loads it, gives it a real window, and projects commands into the menu,
palette, API, and agent surfaces.

Canonical layout:

```text
modules/my-app/
  module.json
  index.ts
```

## The one import rule

Prefer this import path for host types and shared helpers:

```ts
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
```

If a helper already exists on the SDK surface, import it from the SDK instead of
reaching into scattered `src/core/*` or `src/services/*` paths.

Current direction:

- GOOD: `../../src/services/microapp-sdk.js`
- SOMETIMES OK: direct import into `src/` only when the SDK does not yet expose
  the thing you need
- BAD: importing from `src/core/app-controller.ts` or other app-internal owners

This keeps module authoring on one stable path instead of cargo-culting random
internals.

## Step 1 — scaffold or copy a tiny example

Fastest path:

```bash
bash scripts/scaffold-microapp.sh modules/my-app wibwob.my-app "My App"
```

Or copy the smallest example:

- `modules/hello-world/`

That example shows the minimum viable shape:

- one `open` command
- one window
- one body widget
- `describeState`
- `captureText`
- `onRestyle`

## Step 2 — write module.json

Minimal example:

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "description": "Short human description",
  "type": "microapp",
  "entry": "index.ts",
  "microapp": {
    "id": "wibwob.my-app",
    "title": "My App",
    "description": "Shown in palette and API surfaces",
    "multiInstance": true,
    "persist": false,
    "menu": [
      { "category": "applications", "order": 50, "label": "My App" }
    ],
    "palette": { "order": 210, "label": "My App" },
    "agent": true,
    "api": true
  }
}
```

Notes:

- `microapp.id` becomes the namespace for generated commands
- `open` usually becomes `microapp.<id>.open`
- `multiInstance: true` means multiple windows are allowed
- `persist: true` means workspace save/load should restore the window
- menu categories are: `file`, `edit`, `view`, `window`, `applications`, `help`

## Step 3 — write index.ts

Smallest useful pattern:

```ts
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "My App",
    menu: [{ category: "applications", order: 50, label: "My App" }],
    palette: { order: 210, label: "My App" },
    action: () => openMyApp(host),
  });
}

function openMyApp(host: MicroappHost) {
  const win = host.createWindow({ title: "My App", width: 80, height: 24 });

  const body = blessed.box({
    parent: win.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    content: "Hello from a microapp",
    style: host.theme().body,
  });

  win.describeState(() => ({
    summary: "My App is open.",
  }));

  win.captureText(() => body.getContent());

  win.onRestyle(() => {
    body.style = host.theme().body;
  });

  win.onCleanup(() => {});
  win.focus();
}
```

## Two reference levels

### 1. Minimal example

Use `modules/hello-world/` when you need the simplest possible starter.

It demonstrates:

- figlet content in a window
- a single open command
- basic state description
- theme restyling

### 2. Stateful live example

Use `modules/glitchbox/` when you need a real, stateful, animated module.

It demonstrates:

- multiple commands beyond `open`
- `direct: true` query/control commands
- timers and animation
- richer SDK imports
- a long-lived active window pattern
- state updates and redraw loops

Also useful:

- `modules/e026-demo/` for a broad feature sampler
- `modules/wibwob-poetry-clock/` for a compact but more lived-in app

## Command rules

Register commands through `host.registerCommand()`.

Typical opener:

```ts
host.registerCommand({
  id: "open",
  label: "My App",
  action: () => openMyApp(host),
});
```

For commands that return data from an already-open module, use `direct: true`.
Without it, the host may focus/open a window and swallow the return value.

Example:

```ts
host.registerCommand({
  id: "inspect",
  direct: true,
  action: () => ({ ok: true, status: "ready" }),
});
```

## Window contract you should actually use

You do not own the chrome. You own the content inside `win.body`.

Use these every time:

- `win.describeState(() => ({ summary: ... }))`
- `win.captureText(() => ...)`
- `win.onCleanup(() => ...)`
- `win.onRestyle(() => ...)`
- `win.onResize(() => ...)` when layout depends on size
- `win.onInput((text) => ...)` when your module accepts programmatic input

Why this matters:

- `/state` becomes useful
- copy/export works
- agent control works
- workspace and operator tooling stay coherent

## Timers, animation, and cleanup

Do not scatter raw `setInterval` if a shared helper already exists.
Prefer SDK helpers such as `createTimer`.
For animated subsurfaces inside a larger module, prefer `createEmbeddedLivePlayer`
over a handwritten timer loop.

Pattern:

```ts
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";

const timers = new Set<ReturnType<typeof setInterval>>();
createTimer(() => {
  host.screen.render();
}, 500, timers);

win.onCleanup(() => clearTimers(timers));
```

If you create subscriptions, players, or monitors, destroy or unsubscribe from
all of them in `onCleanup()`.

Example embedded animation bridge:

```ts
import { createEmbeddedLivePlayer, readNodeViewport } from "../../src/services/microapp-sdk.js";

const player = createEmbeddedLivePlayer({
  fps: 6,
  generator: (tick, width, height) => renderMyFrame(tick, width, height),
  getViewport: (target) => readNodeViewport(target, {
    minWidth: 8,
    minHeight: 4,
    fallbackWidth: 24,
    fallbackHeight: 6,
  }),
  onFrame: (content) => {
    latestFrame = content;
    updateComposite();
  },
  render: () => host.screen.render(),
  clearOnStop: false,
});

player.attachTarget(myAnimatedBox);
player.setRunning(true);
win.onCleanup(() => player.destroy());
```

## Theme and restyle rule

Do not snapshot theme tokens once at startup and assume they stay valid.
Always call `host.theme()` when re-applying styles.

Pattern:

```ts
win.onRestyle(() => {
  box.style = host.theme().body;
  host.screen.render();
});
```

## Testing your module

Minimum loop:

```bash
bun run typecheck
bash scripts/restart.sh
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.my-app.open"}'
curl -s http://127.0.0.1:8099/state | python3 -m json.tool
./scripts/screenshot-window.sh "My App"
```

Visual check still matters:

```bash
tmux attach -t wibwob
```

## Common mistakes

- importing from app-controller or other load-bearing internals
- adding widgets to the frame instead of `win.body`
- forgetting `describeState` and `captureText`
- forgetting `direct: true` for query/control commands that must return data
- reading `host.theme()` once and never restyling
- forgetting cleanup for timers, subscriptions, or players
- treating modules as private hacks instead of public contract consumers

## What this guide does NOT promise

This is the current best path, not a forever-frozen SDK promise.

The practical contract today is:

- use `microapp-sdk.js` as the first import surface
- follow the existing host/window lifecycle hooks
- copy the canonical patterns from `hello-world`, `glitchbox`, and `e026-demo`
- if docs and runtime diverge, fix the docs first unless a tiny runtime export is
  genuinely missing
