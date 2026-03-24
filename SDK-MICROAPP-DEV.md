---
title: WibWob-DOS — Microapp Developer Guide
description: Build, verify, ship, and survive in cloud. Setup, hooks, SDK surface, patterns.
audience: agents building microapps
---

# SDK-MICROAPP-DEV — Building WibWob-DOS Microapps

> The one guide. Build → verify → ship → survive in cloud.
> See also: `GOTCHAS.md` (burns buffer) · `ARCHITECTURE.md §The microapp contract`

---

## Quick start

```bash
# 0. Install (--ignore-scripts required — canvas native module fails in cloud)
bun install --ignore-scripts

# 1. Start
bash scripts/ensure-running.sh --tmux
curl -sf --max-time 5 http://127.0.0.1:8099/health

# 2. Scaffold
bash .pi/skills/microapp-creator/scripts/scaffold-microapp.sh \
  microapps/hello-world wibwob.hello-world "Hello World" 300

# 3. Register in src/core/microapp-registry.ts:
#    "wibwob.hello-world": "beta",

# 4. Typecheck + restart
bun run typecheck
bash scripts/restart.sh --tmux

# 5. Verify
bash scripts/validate-microapp.sh microapp.wibwob.hello-world.open
```

---

## Mental model

A microapp is `index.ts` + `microapp.json`. Your `setup(host)` function receives the
host object — your entire interface to the runtime. You never touch blessed directly.

```
microapps/your-app/
  index.ts         ← setup(host) → create windows, register commands
  microapp.json    ← id, title, menu order, flags
```

**COAT test**: "Would this work without the TUI, using only the API?"
Every window must expose `describeState()` and `captureText()` so agents can read it.

**Stability tiers** — every export in the SDK carries a tier:

| Tier | Meaning |
|------|---------|
| `@public` | Stable — microapps should use these |
| `@beta` | Functional, may change |
| `@internal` | Host-only — do not use in microapps |

Full export directory: `grep -E '@(public|beta|internal)' src/services/microapp-sdk.ts`

**Lifecycle:**
```
microapp.json discovered → setup(host) called → window live → onCleanup on close
```

**Dev loop:**
```bash
bash scripts/reload-microapp.sh <id>   # close → reload → reopen (microapp code only)
curl -sf --max-time 5 http://127.0.0.1:8099/state   # verify in state
```

`reload-microapp.sh` only reloads microapp `index.ts` files. If you edited
`src/services/*`, `src/core/*`, or `src/sdk/*` → full restart required:
`bash scripts/restart.sh --tmux`

**`wibwob` CLI is a compiled binary.** Changes to `src/cli/wibwob.ts` don't
take effect on restart — rebuild and reinstall: `bun run cli:install`.
Server-side changes (commands, control-api) take effect on TUI restart only.

---

## The four required hooks

Missing any one fails silently. Use `registerMicroappHooks` — TypeScript enforces all four:

```typescript
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { registerMicroappHooks } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open", label: "My App",
    menu: [{ category: "applications", order: 300 }],
    palette: { order: 300 },
    action: () => {
      const win = host.createWindow({ title: "My App", width: 60, height: 20 });
      win.body.setContent("Hello, world!");

      registerMicroappHooks(win, {
        captureText:   () => "Hello, world!",
        describeState: () => ({ summary: "My App" }),
        onCleanup:     () => {},
        onRestyle:     () => { win.body.style.bg = host.theme().body.bg; host.screen.render(); },
      });
    },
  });
}
```

| Hook | Signature | Purpose |
|------|-----------|---------|
| `captureText` | `(fn: () => string): void` | `wibwob read <id>` — semantic text. Never return empty. Falls back to screen crop if missing; prefer explicit. |
| `describeState` | `(fn: () => { summary: string; [k: string]: unknown }): void` | `/state` API — `summary` is required in practice; agents use it for orientation. |
| `onCleanup` | `(fn: () => void): void` | Stop every timer, destroy every handle. Fires on window close. |
| `onRestyle` | `(fn: () => void): void` | Re-apply `host.theme()` colours on theme switch. Must reach every styled node. |

**onRestyle minimum pattern:**
```typescript
onRestyle: () => {
  header.update({});      // CompositionHelpers re-apply theme when called with {}
  host.screen.render();   // always call render() at the end
},
```

**Scrollable elements — use `safeSetStyle`, not `el.style =`**

For any element created with `scrollable: true` or a `scrollbar` option, always use
`safeSetStyle` instead of direct assignment:

```typescript
import { safeSetStyle } from "../../src/services/microapp-sdk.js";

// BAD — wipes blessed's internal scrollbar state, crashes on next render:
viewer.style = host.theme().body;

// GOOD:
safeSetStyle(viewer, host.theme().body);
```

Blessed sets an internal `this.track` widget at construction time when `scrollbar.track`
is provided. A direct `el.style = newStyle` replaces the entire style object and removes
`style.track`, while `this.track` persists — causing a `TypeError` on the next render.
`safeSetStyle` detects this and re-injects the required sub-styles automatically.

**describeState minimum pattern:**
```typescript
describeState: () => ({
  summary: "My App — showing X",   // one sentence, present tense, agent-readable
  itemCount: items.length,          // any extra state an agent might need
}),
```

---

## Host API

```typescript
host.createWindow({ title, width?, height?, left?, top? })  // → MicroappWindowHandle
host.registerCommand({ id, label, description?, action, menu?, palette?, multiInstance?, direct? })
host.registerSnapshot({ serialize, restore })                // workspace persistence
host.theme()                    // ThemeTokens — call in onRestyle
host.flash("message")           // toast notification
host.promptValue(label, default, cb)   // inline text prompt
host.pickFile(label, dir, cb, opts?)   // file browser (opts: { fileFilter?, directoriesOnly? })
host.runCommand(localId)        // dispatch local command
host.runGlobalCommand(id)       // dispatch any command
host.repoRoot                   // absolute path to repo root
host.screen                     // raw blessed Screen (avoid)
host.geometry                   // { width, height, cellAspect }
```

**Window handle extras** (on the handle returned by `createWindow`):
```typescript
win.setTitle(title)             // update window chrome title
win.focus()                     // bring window to front
win.close()                     // programmatic close (triggers onCleanup)
win.registerClickable(node, label)  // expose a button/tab to agents
                                    // appears in wibwob state under details.clickables
                                    // called automatically by createButtonBar + createTabs
```

---

## Building UI

### CompositionHelpers (`@public` — use these)

Self-positioning. Pass `win.body` as parent. Return `{ element, update, destroy }`.

```typescript
import {
  createHeaderBar, createStatusBar, createTextViewer,
  createInputLine, createScrollView, createListPanel,
  createSplitView, createTabs, createCanvas,
} from "../../src/services/microapp-sdk.js";

const header = createHeaderBar(win.body, { left: "My App" });
const viewer = createTextViewer(win.body, { top: 1, bottom: 1 });
const status = createStatusBar(win.body, { left: "ready" });
```

Common compositions:
- **Display:** `createHeaderBar` + `createTextViewer` + `createStatusBar`
- **Chat:** `createHeaderBar` + `createScrollView` + `createInputLine`
- **Browser:** `createHeaderBar` + `createSplitView` (list + viewer)
- **Settings:** `createHeaderBar` + `createTabs`

When in doubt: CompositionHelpers. They're `@public` and stable.

**Layout rule:** CompositionHelpers own `top: 0` by default. When combining
header + content + footer, pass offsets: `createTextViewer(win.body, { top: 1, bottom: 1 })`.
`createSplitView` also defaults to `top: 0` — override with `{ top: 1 }` if you have a header.

**Key bindings** go on `.element`, not the handle: `canvas.element.key(["space"], cb)`.

**Restyle pattern:** `header.update({})` with empty opts re-applies theme. This is
intentional — call it in `onRestyle` for every CompositionHelper.

**Resize:** `win.onResize(() => { /* recalculate, re-render */ })` — not called on
initial render, only on window resize.

**`createInputLine`** uses blessed's modal textbox — enters edit mode on focus,
Esc exits. This is a blessed constraint, not SDK.

### LayoutParts (`@internal` — advanced)

`createProgressBar`, `createKeyValuePanel`, `createDataTable`. No parent arg.
Return `{ node, layout(rect), restyle, destroy }`. Require `createStack`:

```typescript
import { createStack, createProgressBar } from "../../src/services/microapp-sdk.js";

const bar = createProgressBar({ label: "CPU", value: 0, max: 100 });
const root = createStack(win.body, [{ key: "cpu", basis: 3, part: bar }]);
root.layout({ top: 0, left: 0, width: Number(win.body.width), height: Number(win.body.height) });
```

**Never mix CompositionHelpers and LayoutParts in `createStack`** — TypeScript catches
it (`missing: node, layout, restyle`) but only if you run `bun run typecheck`. Without
typecheck, the window renders blank with no error.

**Ignore `host.ui.*`** — it exposes both models through one accessor, making it easy
to mix them unknowingly. Use top-level SDK imports instead.

---

## Timers and animation

**Which timer?**

| Need | Use |
|------|-----|
| Periodic refresh (≥1s) | `createTimer` + `Set` |
| Frame-rate animation (≤8fps) | `createAnimationClock` |
| One-shot delay | `createTimer` (NOT raw `setTimeout` — not lifecycle-managed) |
| Multiple independent concerns | Separate `Set` per concern — `clearTimers` clears the whole Set |

### Simple interval

```typescript
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";

const timers = new Set<ReturnType<typeof setInterval>>();
createTimer(() => { viewer.update({ content: buildContent() }); host.screen.render(); }, 2000, timers);
// onCleanup: clearTimers(timers);
```

### Animation clock

```typescript
import { createAnimationClock } from "../../src/services/microapp-sdk.js";

const clock = createAnimationClock(8); // ≤8fps — higher saturates blessed render
clock.pause();                          // MUST pause immediately — starts running on creation
const unsub = clock.subscribe((tick) => { render(tick); host.screen.render(); });
clock.play();
// onCleanup: unsub(); clock.destroy();
```

**CPU cliff:** `createAnimationClock(30)` + grid-canvas + `host.screen.render()` =
87% CPU, API dead. Stay ≤8fps. Avoid ANSI escape codes inside grid cells —
they create massive strings for blessed to diff on every frame.

---

## Persistence

| Need | Use |
|------|-----|
| Restore on workspace reload | `host.registerSnapshot({ serialize, restore })` |
| File-based (survives restart) | `safeWriteFile` / `safeReadJSON` from SDK |
| Never | raw `fs.*` — architecture violation |

```typescript
// Workspace snapshot — pair with "persist": true in microapp.json
host.registerSnapshot({
  serialize: () => ({ items }),
  restore: (_snap, payload) => { host.runCommand("open", payload); },
});

// File persistence
import { safeWriteFile, safeReadJSON } from "../../src/services/microapp-sdk.js";
import path from "node:path";
const dataFile = path.join(host.repoRoot, "scratch", "microapps", "my-app", "data.json");
safeWriteFile(dataFile, JSON.stringify(state));       // creates parent dirs
const saved = safeReadJSON<MyState>(dataFile);        // returns undefined on error
```

---

## Verification

After writing each app:

```bash
bun run typecheck                                                    # catches type errors
bash scripts/validate-microapp.sh microapp.wibwob.<id>.open          # ≥5 chars = PASS
bash scripts/validate-microapp.sh microapp.wibwob.<id>.open 50       # stricter for rich apps
```

`captureText` must return non-empty text even on blank state:
```typescript
captureText: () => content.trim() || `My App — empty (${items.length} items)`,
```

### Manual debug

```bash
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' -d '{"id":"microapp.wibwob.<id>.open"}'
sleep 1
bash scripts/screenshot-window.sh --list                    # get window ID
curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/text?id=N"
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' -d '{"id":"window.close","args":{"id":N}}'
```

---

## microapp.json

```jsonc
{
  "name": "my-app",
  "version": "1.0.0",
  "type": "microapp",
  "entry": "index.ts",
  "dev": { "watch": ["index.ts"], "reopenCommand": "microapp.wibwob.my-app.open" },
  "microapp": {
    "id": "wibwob.my-app",       // must match registry key — never change after shipping
    "title": "My App",
    "multiInstance": false,       // true = multiple windows allowed
    "persist": false,             // true = workspace save/restore (needs registerSnapshot)
    "agent": true,                // expose via agent tools
    "api": true,                  // expose via HTTP API
    "menu": [{ "category": "applications", "order": 300, "label": "My App" }],
    "palette": { "order": 300, "label": "Open My App" }
  }
}
```

---

## Worked examples

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

---

## Footguns

1. **Mixed component models in `createStack`** → blank window, no runtime error
2. **`captureText` returning empty** → validation fails, agents can't read state
3. **`createAnimationClock` starts immediately** → call `clock.pause()` on next line
4. **Forgetting `onCleanup`** → timers run forever after close
5. **`host.ui.*` mixes both models** → same trap as #1, use SDK imports
6. **`pkill -f "curl.*8099"` kills your own command** → run pkill in separate invocation
7. **Batch-verify loop** → rapid curl overwhelms single-threaded bun, one at a time

Full list: `GOTCHAS.md`

---

## COAT compliance — every keybind needs a command

**Rule:** Any key binding that mutates state (playback, selection, mode, data) must have a `host.registerCommand` equivalent so agents and the API can trigger it without a human at the keyboard.

**Paired pattern — the only acceptable form:**

```typescript
// ✅ COAT-compliant: key binding paired with registered command
const doRefresh = () => { /* mutates state */ refreshList(); };

host.registerCommand({
  id: "refresh",
  label: "Refresh",
  description: "Re-scan and refresh the list.",
  action: () => { doRefresh(); },
});

canvas.element.key(["r"], doRefresh); // same handler — zero duplication
```

Navigation-only keys (scroll, focus) don't need commands. Cosmetic keys (toggle viz mode) are optional. When in doubt: if an agent needs to drive it, register it.

---

## Patterns & Gotchas

Hard-won patterns from the MAPP 1-10 audit. Each has burned at least one session.

### 1. Two component models — know which you're using

**CompositionHelpers** (`createStatusBar`, `createTextViewer`, `createListPanel`, `createSplitView`, `createTabs`, `createCanvas`) return `{ element, update, destroy }` and self-parent into a blessed box. **Use these for new microapps.**

**LayoutParts** (`createProgressBar`, `createKeyValuePanel`) return `{ node, layout(rect), restyle(), destroy() }`. They do NOT self-parent — you must position them via `createStack` or `createRow`, which are `@internal`.

They are structurally incompatible. You cannot put a CompositionHelper handle into `createStack`. No runtime error — the window just renders blank.

```typescript
// WRONG — createTextViewer is a CompositionHelper, not a LayoutPart
const stack = createStack(win.body, [{ key: "text", basis: 1, part: createTextViewer(...) }]);

// RIGHT — CompositionHelpers self-parent, just pass the parent box
const viewer = createTextViewer(win.body, { ... });
```

### 2. Three timer mechanisms — pick the right one

| Mechanism | Lifecycle | Use when |
|-----------|-----------|----------|
| `setInterval` | Manual `clearInterval` | Never — leaks on close |
| `createTimer(fn, ms, timers)` | `clearTimers(timers)` clears ALL | Periodic updates with cleanup |
| `createAnimationClock(fps)` | `subscribe` + `clock.destroy()` | Animation loops |

`createAnimationClock` **starts immediately** — call `clock.pause()` right after creation if you need deferred start. Multiple timers via `createTimer` share one `Set` — if you need independent pause/resume, use separate Sets.

```typescript
const timers = new Set<ReturnType<typeof setInterval>>();
createTimer(() => refresh(), 1000, timers);
onCleanup(() => clearTimers(timers));

// Animation:
const clock = createAnimationClock(8); // 8fps max — see performance note below
const unsub = clock.subscribe(() => render());
onCleanup(() => { unsub(); clock.destroy(); });
clock.pause(); // pause until ready
```

### 3. `createCanvas` — call `getSize()` after attach, not during construction

The internal drawille canvas allocates at attach time using whatever blessed dimensions exist then. If you call `getSize()` during construction, you get 0×0.

```typescript
// WRONG
const canvas = createCanvas(win.body, {});
const { width, height } = canvas.getSize(); // 0×0 at construction

// RIGHT — use onResize which fires after layout settles
canvas.onResize(() => {
  const { width, height } = canvas.getSize(); // real dimensions
  initGrid(width, height);
});
```

For `blessed-contrib` widgets outside a grid, emit `resize` after layout:

```typescript
function applyContribRect(widget: any, rect: Rect) {
  applyRect(widget, rect);
  widget.emit?.("resize"); // re-allocates internal drawille canvas
}
```

### 4. ANSI in grid cells = performance cliff

`paintText` accepts ANSI escape codes in cell content. At 30fps with ANSI-per-cell, bun hits 87% CPU and the HTTP API becomes unresponsive.

```typescript
// WRONG — ANSI codes in every cell at high fps
clock = createAnimationClock(30);
clock.subscribe(() => paintText(grid, row, col, `\x1b[31m${char}\x1b[0m`));

// RIGHT — plain chars, colour via theme or post-process
clock = createAnimationClock(8); // 8fps ceiling for grid renders
clock.subscribe(() => paintText(grid, row, col, char));
```

**Rule:** max 8fps for grid renders. Apply colour globally, not per-cell.

### 5. `createButton` steals focus — use as indicator only

`createButton` sets `focusable: true` + `keys: true` by default. Used as a status indicator, it eats all keyboard shortcuts from the parent widget.

**Workaround:** Don't use `createButton` for non-interactive indicators. Use a plain `blessed.box` with styled content, or `createTextViewer` in read-only mode.

### 6. Focus and input — three separate paths

| Path | What it handles |
|------|----------------|
| `win.onInput(text)` | Plumb/write API — text piped from another window or `wibwob write` |
| `canvas.key(["enter"], fn)` | Keyboard shortcuts on a blessed element |
| `screen.on("keypress", fn)` | Raw keypress with `(ch, key)` including modifiers |

`win.onInput` is NOT keyboard input. `createInputLine` is modal (`inputOnFocus`) — pressing a key enters edit mode, Escape exits. Tab/Shift-Tab are reliable for focus switching; 1-5 number keys may be captured by the shell.

### 7. Destroy order matters

Destroy children before parents. Destroying a parent while children are still live causes orphan errors in blessed.

```typescript
onCleanup(() => {
  childWidget.destroy();  // first
  parentStack.destroy();  // then
});
```

### 8. `host.promptValue()` — undocumented but excellent

Modal text input. Takes focus, returns a promise that resolves to the entered string or `null` on cancel. No docs — found it by reading `microapp-host.ts` types.

```typescript
const value = await host.promptValue("Enter a name:");
if (value === null) return; // cancelled
```

---

## Import rule

```typescript
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createHeaderBar, safeWriteFile, registerMicroappHooks } from "../../src/services/microapp-sdk.js";
// Never: src/core/*, src/services/* (except sdk), src/ui/*, node:fs
```

---

## Cloud / headless ops

Everything below is specific to running in Linux containers or headless agent environments.

### Environment signals

| Signal | Cloud / headless | Local / human |
|--------|-----------------|---------------|
| `[ ! -t 0 ]` | true (no TTY) | false |
| `$TERM` | `dumb` or unset | `xterm-256color` |
| `uname` | Linux | Darwin |

The startup scripts auto-detect headless and use `--tmux`. Never use `--direct` in cloud.

### Install

```bash
bun install --ignore-scripts    # canvas native module fails in containers
```

### Start / restart / hard restart

```bash
bash scripts/ensure-running.sh --tmux          # start
bash scripts/restart.sh --tmux                 # restart
# Hard restart (API hung):
kill -9 $(ps aux | grep "bun run src" | grep -v grep | awk '{print $2}')
tmux kill-session -t wibwob && sleep 2
bash scripts/ensure-running.sh --tmux
# Port stuck:
bash scripts/clean-instances.sh --kill
```

### curl — always `--max-time`

```bash
curl -sf --max-time 5 http://127.0.0.1:8099/health    # without --max-time = zombie on hang
```

### API endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | `{"ok":true,"instanceId":"..."}` |
| `/state` | GET | All windows, desktop geometry, theme |
| `/commands/list` | GET | All registered commands |
| `/commands/run` | POST | Execute command by id |
| `/screenshot/text?id=N` | GET | captureText output for window N |
| `/screenshot/ansi?id=N` | GET | ANSI render of window N |

Command IDs: `microapp.{appId}.{commandId}` (e.g. `microapp.wibwob.click-counter.open`)

### Discovering command IDs

```bash
curl -sf localhost:8099/commands/list | grep "your-app"   # live command IDs
wibwob commands | grep "your-app"                         # or via CLI
```

### Parsing state

```bash
curl -sf --max-time 5 http://127.0.0.1:8099/state | python3 -c "
import sys,json; d=json.load(sys.stdin)
for w in d.get('windows',[]): print(f'id={w[\"id\"]} title={w.get(\"title\",\"?\")}')"
```

### gen-* scripts (all headless-safe)

| Script | Output |
|--------|--------|
| `bun scripts/gen-primitives.ts` | `src/core/primitives.ts` — barrel export |
| `python3 scripts/gen-skills.py` | `.pi/skills/skills.md` — skill index |
| `bash scripts/doc-sync.sh --list` | show all watched paths |

### File reference

| What | Path |
|------|------|
| SDK surface | `src/services/microapp-sdk.ts` |
| Host interface | `src/sdk/microapp-host.ts` |
| Command catalog | `src/core/command-catalog.ts` |
| Microapp registry | `src/core/microapp-registry.ts` |
| Process manager | `scripts/lib/process-manager.sh` |

### Microapp triad workflow

1. **microapp-product-owner** — scope + keep/cut decisions (always first)
2. **microapp-developer** — implements one slice only
3. **microapp-doc-refiner** — updates canonical docs for that slice
