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

Run `bun scripts/gen-sdk-surface.ts` → `src/sdk/README.md` for the full directory.

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

| Hook | Purpose |
|------|---------|
| `captureText` | `wibwob read <id>` — semantic text. Falls back to screen crop if unregistered; prefer explicit. |
| `describeState` | `/state` API — include a meaningful `summary` |
| `onCleanup` | Stop every timer, destroy every handle |
| `onRestyle` | Re-apply `host.theme()` colours on theme switch |

---

## Host API

```typescript
host.createWindow({ title, width?, height?, left?, top? })  // → MicroappWindowHandle
host.registerCommand({ id, label, action, menu?, palette? }) // prefixed: microapp.<appId>.<id>
host.registerSnapshot({ serialize, restore })                // workspace persistence
host.theme()                    // ThemeTokens — call in onRestyle
host.flash("message")           // toast notification
host.promptValue(label, default, cb)   // inline text prompt
host.pickFile(label, dir, cb, opts?)   // file browser (opts: { fileFilter?, directoriesOnly? })
host.runCommand(localId)        // dispatch local command
host.runGlobalCommand(id)       // dispatch any command
host.repoRoot                   // absolute path to repo root
host.screen                     // raw blessed Screen (avoid)
host.geometry                   // { width, height }
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
bun scripts/gen-integration-surface.ts    # → COAT.md (80+ commands, all IDs)
grep "your-app" COAT.md
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
| `bun scripts/gen-integration-surface.ts` | `COAT.md` — endpoints + commands |
| `bun scripts/gen-sdk-surface.ts` | `src/sdk/README.md` — SDK export directory |
| `bun scripts/gen-primitives.ts` | `src/core/primitives.ts` — barrel export |
| `python3 scripts/gen-skills.py` | `.pi/skills/skills.md` — skill index |

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
