# WibWob-DOS Microapp SDK

How to build a microapp window for WibWob-DOS. Read this before touching
any file in `modules/` or `modules-private/`.

Reference implementation: `modules/hello-world/` (minimal)
Full example with all primitives: `modules/e026-demo/` (F03/F05/F06/F07)

---

## What is a microapp?

A TypeScript module that drops a window into the WibWob-DOS desktop. It gets:
- A blessed window frame (chrome, drag, resize, close, z-order)
- Commands registered in the menu, palette, and control API
- Access to the screen, theme, and window manager via a host object
- Lifecycle hooks: cleanup, restyle, resize, input

---

## File structure

```
modules/my-app/
  module.json   — manifest (id, title, commands, menu placement)
  index.ts      — export default function setup(host: MicroappHost)
```

---

## module.json

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "description": "What this does",
  "type": "microapp",
  "entry": "index.ts",
  "microapp": {
    "id": "wibwob.my-app",
    "title": "My App",
    "description": "Short description for palette/agent",
    "multiInstance": true,
    "persist": false,
    "menu": [
      { "category": "applications", "order": 50, "label": "My App" }
    ],
    "palette": { "order": 215, "label": "My App" },
    "agent": true,
    "api": true
  }
}
```

`menu.category` must be one of: `file` `edit` `view` `window` `applications` `help`
`multiInstance: true` lets the user open multiple windows at once.
`persist: true` means the workspace saves/restores the window on reload.

---

## index.ts skeleton

```typescript
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",                       // becomes microapp.wibwob.my-app.open
    label: "My App",
    menu: [{ category: "applications", order: 50, label: "My App" }],
    palette: { order: 215, label: "My App" },
    action: () => openMyApp(host),
  });
}

function openMyApp(host: MicroappHost) {
  const win = host.createWindow({ title: "My App", width: 80, height: 24 });

  // ... add blessed widgets as children of win.body ...

  win.describeState(() => ({ summary: "My App" }));
  win.captureText(() => "text content for copy/export");
  win.onRestyle(() => { /* re-apply host.theme() to your widgets */ });
  win.onCleanup(() => { /* clear timers, destroy resources */ });
  win.focus();
}
```

---

## MicroappHost API

```typescript
// Create a window — returns a MicroappWindowHandle
host.createWindow({ title, width?, height?, left?, top? })

// Register a command in menu/palette/API/agent surfaces
host.registerCommand({ id, label, description?, action, menu?, palette?, multiInstance?, direct? })

// Run another command (full id or local id within this module)
host.runCommand("markdown.open", { filePath: "/path/to/file.md" })
host.runCommand("open")           // runs microapp.wibwob.my-app.open

// Blessed screen — for screen.render() and screen.width/height
host.screen

// Desktop geometry
host.geometry  // { width, height, cellAspect }

// Current theme tokens — call on every render, not once at startup
host.theme()   // → ThemeTokens

// WindowFacade — move/resize/focus/close by id
host.windows.moveWindow(id, x, y)
host.windows.resizeWindow(id, w, h)
host.windows.focusWindow(id)
host.windows.closeWindow(id)

// UI layout primitives (blessed widget factories)
host.ui.createStack(...)
host.ui.createColumns(...)
host.ui.createHeaderBar(...)
host.ui.createStatusBar(...)
host.ui.createTextBlock(...)
host.ui.createRule(...)
host.ui.createFigletDisplay(...)
host.ui.createAnimatedPanel(...)
host.ui.createButtonBar(...)
host.ui.applyRect(node, rect)
```

---

## MicroappWindowHandle API

```typescript
win.id            // window id (number) — use for host.windows.* calls
win.body          // blessed BoxElement — parent all your widgets here

win.focus()       // focus the window
win.close()       // close it

win.describeState(fn)   // () => { summary, ...extras } — shown in /state
win.captureText(fn)     // () => string — raw text for copy/export
win.onCleanup(fn)       // runs on close — clear timers here
win.onRestyle(fn)       // runs on theme change — re-apply host.theme()
win.onResize(fn)        // runs when window is resized
win.onInput(fn)         // (input: string) => void — receives writeInput calls
```

---

## Core primitives you can import directly

These live in `src/` but are stable and safe to import from modules:

### Blessed widgets
```typescript
import blessed from "blessed";
// Add widgets as children of win.body
const box = blessed.box({ parent: win.body, top: 0, left: 0, ... });
```

### TreeWidget (F05)
```typescript
import { createTreeWidget, type TreeNode } from "../../src/core/tree-widget.js";

const tree = createTreeWidget(parentBox, { style: host.theme().body });
tree.setNodes([
  { id: "a", label: "Folder", children: [
    { id: "a1", label: "Child" }
  ]}
]);
tree.onSelect((node) => console.log(node.label));
tree.onFocus((node) => console.log(node.label));

// Expand/collapse programmatically
tree.expandNode("a");
tree.collapseNode("a");
tree.toggleNode("a");

const focused = tree.getFocusedNode();
tree.destroy();  // call in win.onCleanup()
```

Keys wired automatically: j/k up/down, Enter/Space/←/→ toggle, g/G ends.

### Lifecycle timers (F06)
```typescript
import { createTimer, clearTimers } from "../../src/core/ui-primitives.js";

// In your openMyApp function:
const timers = new Set<ReturnType<typeof setInterval>>();

createTimer(() => {
  // runs every 500ms
  host.screen.render();
}, 500, timers);

// In win.onCleanup():
win.onCleanup(() => clearTimers(timers));
```

Never use raw `setInterval` in a microapp — always use `createTimer` so
cleanup is guaranteed.

### Motion / tween (F07)
```typescript
import {
  tweenWindowPosition,
  tweenWindowSize,
  tween,
  EASINGS,
} from "../../src/services/motion-service.js";

// Slide window to x=20, y=5 over 400ms
tweenWindowPosition(host.windows, win.id, 20, 5, 400, "easeOutCubic");

// Resize over 300ms then snap back
tweenWindowSize(host.windows, win.id, 120, 36, 300, "easeOutCubic");

// Raw tween — any numeric value
const { cancel } = tween({
  from: 0, to: 100, duration: 600,
  easing: EASINGS.elasticOut,
  onUpdate: (v) => { myBox.width = Math.round(v); host.screen.render(); },
  onComplete: () => console.log("done"),
});
// cancel() to stop early
```

Available easings: `linear` `easeIn` `easeOut` `easeInOut` `easeInCubic`
`easeOutCubic` `easeInOutCubic` `elasticOut` `bounceOut`

### RenderMonitor — screen FPS instrumentation

```typescript
import { createRenderMonitor } from "../../src/services/microapp-sdk.js";

const monitor = createRenderMonitor(host.screen);

// Point-in-time readings
monitor.fps          // frames rendered in last 1000ms
monitor.avgFrameMs   // average ms between renders
monitor.totalFrames  // lifetime frame count

// Subscribe to periodic updates (default 1000ms interval)
const unsub = monitor.subscribe((r) => {
  console.log(`${r.fps} fps  ${r.avgFrameMs.toFixed(1)}ms/frame`);
}, 500);

// Cleanup — always call in win.onCleanup()
win.onCleanup(() => {
  unsub();
  monitor.destroy();  // restores original screen.render
});
```

`createRenderMonitor` wraps `screen.render` to count call frequency.
FPS reflects actual TUI render throughput — animations, timers, and user
input all show up here. One monitor per window is sufficient; destroy it
on cleanup to restore `screen.render` to its original form.

### Markdown viewer (F03)
```typescript
// Open any .md file in the viewer window
host.runCommand("markdown.open", { filePath: "/absolute/path/to/file.md" });

// Toggle figlet headings on the focused markdown viewer
host.runCommand("markdown.toggle_figlet");
```

### Scrollbars
```typescript
import { createScrollbar, scrollableStyle } from "../../src/core/ui-primitives.js";

const scroll = blessed.box({
  parent: win.body,
  scrollable: true, alwaysScroll: true,
  scrollbar: createScrollbar(),
  style: scrollableStyle(host.theme().body),
});
```

---

## Theme

Always call `host.theme()` when you need tokens — not once at startup.
The theme changes when the user cycles themes; `onRestyle` fires and you
re-apply.

```typescript
const t = host.theme();
t.body           // { fg, bg }
t.selected       // { fg, bg } — highlighted list items
t.muted          // { fg }    — secondary text
t.titleBarFocused    // { fg, bg }
t.titleBarUnfocused  // { fg, bg }
t.windowBorderFocused    // { fg }
t.windowBorderUnfocused  // { fg }
```

---

## Restyle pattern

```typescript
win.onRestyle(() => {
  myBox.style = host.theme().body;
  myList.style = { ...host.theme().body, selected: host.theme().selected };
  host.screen.render();
});
```

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| `setInterval` directly | Use `createTimer(fn, ms, timers)` |
| `host.theme()` called once at startup | Call it inside `onRestyle` and per-render |
| Widgets added to `win.frame` | Add to `win.body` only |
| `host.windowManager()` | Use `host.windows` |
| `win.screen` | Use `host.screen` |
| Importing from `src/core/app-controller.ts` | Never — use host API |
| `multiInstance: false` + opening twice | Set `multiInstance: true` if each call should open a new window |

---

## Testing your microapp

```bash
# Typecheck
bun run typecheck

# Restart the app (wibwob tmux session)
bash scripts/restart.sh

# Open your app via API
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.my-app.open"}'

# Check it appears in state
curl -s http://127.0.0.1:8099/state | python3 -m json.tool | grep -A5 kind

# Screenshot a window
./scripts/screenshot-window.sh "My App"
```

---

## Checklist before shipping

- [ ] `bun run typecheck` passes
- [ ] `module.json` has unique `id` (no collision with existing modules)
- [ ] `win.onCleanup()` clears all timers and destroys tree widgets
- [ ] `win.onRestyle()` re-applies `host.theme()` to all styled widgets
- [ ] `win.describeState()` returns a useful `summary`
- [ ] Commands registered with `api: true` appear in `GET /commands/list`
- [ ] Window visible and sized correctly on first open
