# WibWob-DOS Microapp Developer Guide

> A cold-reader tutorial. You need no prior context — follow this doc to build,
> register, and ship a working microapp. Read time: ~10 minutes.
>
> For quick reference after you know the basics: `SDK.md` · `GOTCHAS.md`

---

## Quick start — 60 seconds

```bash
# 1. Start WibWob-DOS
bash scripts/ensure-running.sh --tmux
curl -sf --max-time 5 http://127.0.0.1:8099/health

# 2. Scaffold a new microapp
bash .pi/skills/microapp-creator/scripts/scaffold-microapp.sh \
  microapps/hello-world wibwob.hello-world "Hello World" 300

# 3. Register it (add to src/core/microapp-registry.ts)
#    "wibwob.hello-world": "beta",

# 4. Restart to load
bash scripts/restart.sh --tmux

# 5. Open it and verify
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.hello-world.open"}'
bash scripts/validate-microapp.sh microapp.wibwob.hello-world.open
```

---

## Mental model

A microapp is a single TypeScript file (`index.ts`) that exports a `setup(host)` function
plus a `microapp.json` manifest. That's it.

```
microapps/
  your-app/
    index.ts         ← your code
    microapp.json    ← id, title, menu order, flags
```

When WibWob-DOS loads, it discovers all registered microapps, calls your `setup(host)`,
and wires your commands into the desktop menu, command palette, and HTTP API.

The **host** object is your entire interface to the runtime — create windows, register
commands, read themes, save state. You never touch `blessed` internals directly.

The **COAT test**: "Would this work without the TUI, using only the API?" If your
microapp only works when a human is watching, it's incomplete. Every window must
expose readable state via `describeState()` and `captureText()`.

---

## The four required hooks

**Missing any one fails silently** — your window appears but misbehaves.

Use `registerMicroappHooks` — TypeScript enforces all four:

```typescript
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { registerMicroappHooks } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "My App",
    menu: [{ category: "applications", order: 300 }],
    palette: { order: 300 },
    action: () => {
      const win = host.createWindow({ title: "My App", width: 60, height: 20 });

      win.body.setContent("Hello, world!");

      registerMicroappHooks(win, {
        captureText:   () => "Hello, world!",           // wibwob read <id>
        describeState: () => ({ summary: "My App" }),   // /state API
        onCleanup:     () => {},                        // stop timers here
        onRestyle:     () => {                          // theme changed
          win.body.style.bg = host.theme().body.bg;
          host.screen.render();
        },
      });
    },
  });
}
```

| Hook | What it's for | Consequence if missing |
|------|--------------|------------------------|
| `captureText` | `wibwob read <id>` — plain text snapshot | API returns empty; validation fails |
| `describeState` | `/state` API — structured window metadata | Agents can't understand what's open |
| `onCleanup` | Called on window close | Timer/interval leaks, zombie processes |
| `onRestyle` | Called on theme switch | Window stays wrong colours after theme change |

---

## Host API

Everything your microapp needs lives on `host`:

```typescript
host.createWindow({ title, width?, height?, left?, top? })
  // → win: MicroappWindowHandle
  //   win.id           — window id (for /state, /screenshot)
  //   win.body         — blessed BoxElement to render into
  //   win.setTitle()   — update the title bar
  //   win.focus()      — give keyboard focus
  //   win.close()      — close programmatically

host.registerCommand({ id, label, description?, action, menu?, palette? })
  // Your app's commands. id is prefixed: microapp.<appId>.<id>

host.registerSnapshot({ serialize, restore })
  // Workspace persistence — save/restore on workspace load/unload

host.theme()                    // ThemeTokens — always call in onRestyle
host.flash("message")          // toast notification
host.promptValue(label, default, cb)  // inline text prompt
host.pickFile(label, dir, cb)        // file browser

host.repoRoot                  // absolute path to repo root
host.screen                    // raw blessed Screen (avoid unless necessary)
host.geometry                  // { width, height } of the desktop
```

---

## Building UI

### Composition helpers (use these — `@public`, stable)

These are the recommended building blocks. Pass `win.body` as the parent; they
self-position and handle layout:

```typescript
import {
  createHeaderBar, createStatusBar, createTextViewer,
  createInputLine, createScrollView, createListPanel,
  createSplitView, createTabs, createCanvas,
} from "../../src/services/microapp-sdk.js";

// Header + content + footer (the most common pattern)
const header = createHeaderBar(win.body, { left: "My App" });
const viewer = createTextViewer(win.body, { top: 1, bottom: 1 });
const status = createStatusBar(win.body, { left: "ready" });

// Update on data change
viewer.update({ content: "New content here" });
header.update({ right: new Date().toLocaleTimeString() });

// Destroy in onCleanup
header.destroy(); viewer.destroy(); status.destroy();
```

Key compositions:
- **Read-only display:** `createHeaderBar` + `createTextViewer` + `createStatusBar`
- **Chat / log:** `createHeaderBar` + `createScrollView` + `createInputLine`
- **Browser:** `createHeaderBar` + `createSplitView` (left: list, right: viewer)
- **Settings:** `createHeaderBar` + `createTabs` + content per tab

### LayoutPart components (`@internal` — advanced)

`createProgressBar`, `createKeyValuePanel`, `createDataTable` are LayoutParts —
they return `{ node, layout(rect), restyle, destroy }` and need `createStack`:

```typescript
import { createStack, createProgressBar } from "../../src/services/microapp-sdk.js";

const cpuBar = createProgressBar({ label: "CPU", value: 0, max: 100 });
const root = createStack(win.body, [
  { key: "cpu", basis: 3, part: cpuBar },
]);
// Call on resize:
root.layout({ top: 0, left: 0, width: Number(win.body.width), height: Number(win.body.height) });
```

**Never pass a CompositionHelper to `createStack`** — TypeScript catches it
(`missing: node, layout, restyle`) but only if you run `bun run typecheck`. If you mix
them, the window renders blank at runtime with no error.

---

## Timers and animation

### Simple interval — `createTimer`

```typescript
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";

const timers = new Set<ReturnType<typeof setInterval>>();

createTimer(() => {
  content = buildContent();
  viewer.update({ content });
  host.screen.render();
}, 2000, timers); // fire every 2 seconds

// In onCleanup:
clearTimers(timers);
```

### Animation clock — `createAnimationClock`

For frame-rate-driven animation (clocks, sequencers, live displays):

```typescript
import { createAnimationClock } from "../../src/services/microapp-sdk.js";

const clock = createAnimationClock(8); // 8fps MAX — higher saturates blessed
clock.pause();                          // MUST pause immediately — it starts running!

// Subscribe to ticks
const unsub = clock.subscribe((tick) => {
  render(tick);
  host.screen.render();
});

clock.play(); // start when ready

// In onCleanup:
unsub();
clock.destroy();
```

> **CPU cliff warning:** `createAnimationClock(30)` + grid-canvas + `host.screen.render()`
> = 87% CPU, API unresponsive. Stay at ≤8fps. ANSI codes in grid cells make it worse.

---

## Persistence

**Decision:** what kind of persistence do you need?

| Need | Use |
|------|-----|
| Restore window state when workspace reloads | `host.registerSnapshot` |
| User-visible file save (survives process restart) | `safeWriteFile` from SDK |
| Never | raw `fs.*` — ARCHITECTURE invariant violation |

### Workspace snapshot

```typescript
host.registerSnapshot({
  serialize: () => ({ items }),             // called on workspace save
  restore: (_snap, payload) => {
    items = (payload as { items: Item[] }).items;
    host.runCommand("open", payload);       // re-open restored
  },
});
// Also set "persist": true in microapp.json
```

### File persistence

```typescript
import { safeWriteFile, safeReadJSON } from "../../src/services/microapp-sdk.js";
import path from "node:path";

const dataFile = path.join(host.repoRoot, "scratch", "microapps", "my-app", "data.json");

// Save
safeWriteFile(dataFile, JSON.stringify(state));

// Load (on open)
const saved = safeReadJSON<MyState>(dataFile);
if (saved) state = saved;
```

`safeWriteFile` creates parent directories and swallows errors — correct posture for microapp I/O.

---

## Verifying your microapp

After writing each app:

```bash
# 1. Typecheck (catches missing hooks, wrong types)
bun run typecheck

# 2. Validate — non-blank captureText, opens and closes cleanly
bash scripts/validate-microapp.sh microapp.wibwob.<your-id>.open

# For content-rich apps (expect >50 chars):
bash scripts/validate-microapp.sh microapp.wibwob.<your-id>.open 50
```

The validator opens your app, waits 1 second, takes a text screenshot, checks content
length, closes the window, and exits 0 (PASS) or 1 (FAIL).

**`captureText` must return non-empty text** — even on a blank initial state:
```typescript
captureText: () => {
  const content = renderContent().trim();
  return content.length > 0
    ? content
    : `My App — empty state (${items.length} items)`;
},
```

---

## microapp.json reference

```jsonc
{
  "name": "my-app",
  "version": "1.0.0",
  "type": "microapp",
  "entry": "index.ts",
  "dev": {
    "watch": ["index.ts"],
    "reopenCommand": "microapp.wibwob.my-app.open"
  },
  "microapp": {
    "id": "wibwob.my-app",      // must match registry key — never change after shipping
    "title": "My App",
    "multiInstance": false,      // true = multiple windows allowed
    "persist": false,            // true = workspace save/restore (needs registerSnapshot)
    "agent": true,               // expose via agent tools
    "api": true,                 // expose via HTTP API
    "menu": [{ "category": "applications", "order": 300, "label": "My App" }],
    "palette": { "order": 300, "label": "Open My App" }
  }
}
```

**Never change the `id` field** after a microapp is shipped — it's the key into the
command registry, workspace saves, and API paths. Renaming it silently breaks everything.

---

## Worked examples

These 10 microapps in `microapps/` cover the full SDK surface:

| App | Key patterns |
|-----|-------------|
| `click-counter` | Minimal app, registerMicroappHooks, key bindings |
| `pomodoro` | Multi-phase state, createTimer, header/status bar |
| `dice-roller` | createCanvas, ASCII art, animation with createTimer |
| `md-preview` | createSplitView, renderMarkdown, host.pickFile |
| `sys-monitor` | Pure CompositionHelpers, createTimer refresh, ASCII bars |
| `color-palette` | createTabs, createListPanel, onSelect callback |
| `ascii-studio` | blankGrid/paintText/gridToText, safeWriteFile, createCanvas |
| `chat-sim` | createScrollView + createInputLine, win.onInput for agents |
| `kanban` | blessed.list, host.promptValue, registerSnapshot persistence |
| `step-seq` | createAnimationClock, grid-canvas, subscribe/unsubscribe |

Read `sys-monitor` for a clean CompositionHelper example. Read `kanban` for
`registerSnapshot` + `safeWriteFile` persistence patterns. Read `step-seq` for
`createAnimationClock` lifecycle.

---

## Common footguns

See `GOTCHAS.md` for the full list. Top 5:

1. **Mixed component models in `createStack`** → blank window, no error. Use CompositionHelpers or LayoutParts, never both.
2. **`captureText` returning empty** → validation fails, agents can't read state. Add a fallback string.
3. **`createAnimationClock` starts running immediately** → call `clock.pause()` on the next line.
4. **Forgetting `onCleanup`** → timers run forever after window closes. Always `clock.destroy()` and `clearTimers()`.
5. **`host.ui.*` mixes both component models** → same trap as #1. Use top-level SDK imports instead.

---

## Import rule

```typescript
// ALL imports from one path only:
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createHeaderBar, safeWriteFile, registerMicroappHooks } from "../../src/services/microapp-sdk.js";

// NEVER import from:
// src/core/*     — COAT violation
// src/services/* — except microapp-sdk.js
// src/ui/*       — internal
// node:fs        — use safeWriteFile instead
```

---

## Full SDK surface

Run this to see every export by stability tier:

```bash
bun scripts/gen-sdk-surface.ts   # writes src/sdk/README.md
```

`@public` exports are stable API. `@beta` may change. `@internal` are host-only.
