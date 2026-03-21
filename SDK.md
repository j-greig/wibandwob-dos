# SDK.md — Building WibWob-DOS Microapps

## Start here

Use the `microapp-creator` skill — it scaffolds the directory, `microapp.json`, and `index.ts` with all four required hooks wired in. Don't hand-roll the boilerplate.

---

## Minimal working microapp

```typescript
// microapps/my-app/index.ts
import type { MicroappHost } from "../../src/services/microapp-sdk.js"

export default function setup(host: MicroappHost) {
  const win = host.createWindow({ title: "My App" })

  // render something
  win.body.setContent("Hello world")

  // required — agents read this
  win.describeState(() => ({ summary: "My App is open" }))

  // required — wibwob read <id>
  win.captureText(() => win.body.getContent())

  // required — stop timers, listeners
  win.onCleanup(() => {})

  // required — reapply colours on theme change
  win.onRestyle(() => { win.body.style.bg = host.theme().body.bg })
}
```

**One import rule:** only `import from "../../src/services/microapp-sdk.js"`. Importing from `src/core/` or `src/services/` directly is a COAT violation.

---

## The four required hooks

Missing any one fails silently — this is the most common microapp bug.
**Preferred pattern** — use the typed helper that enforces all four at once:

```typescript
import { registerMicroappHooks } from "../../src/services/microapp-sdk.js";

registerMicroappHooks(win, {
  captureText:   () => myContent,                        // plain text, must be non-empty
  describeState: () => ({ summary: "My App — ready" }), // agents read this
  onCleanup:     () => { clock?.destroy(); },            // stop ALL timers here
  onRestyle:     () => { label.style.fg = host.theme().text.fg; },
});
```

TypeScript will error if you omit any of the four. Individual methods still work for conditional wiring.

| Hook | Purpose |
|------|---------|
| `captureText` | Powers `wibwob read <id>` — must return >0 non-whitespace chars |
| `describeState` | Agents read this via `/state` API — include a meaningful `summary` |
| `onCleanup` | Called on close — stop every timer, destroy every handle |
| `onRestyle` | Called on theme switch — re-apply every `host.theme()` colour |

---

## What host gives you

| | What it does |
|-|-------------|
| `host.createWindow(init)` | Create the blessed frame — returns `win` handle |
| `host.registerCommand(def)` | Register palette / menu / API / agent command |
| `host.registerSnapshot({serialize,restore})` | Workspace persistence — save/restore window state |
| `host.theme()` | Current theme tokens — use in `onRestyle` |
| `host.runCommand(id)` | Dispatch a local command by id |
| `host.runGlobalCommand(id)` | Dispatch any global command |
| `host.flash(msg)` | Show a toast notification |
| `host.promptValue(label, default, cb)` | Open an inline value prompt |
| `host.pickFile(label, dir, cb)` | Open the file browser prompt |
| `host.screen` | Raw blessed screen (avoid unless necessary) |
| `host.geometry` | Desktop geometry — width, height, usable area |
| `host.repoRoot` | Absolute path to repo root |

---

## microapp.json — key fields

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "type": "microapp",
  "entry": "index.ts",
  "microapp": {
    "id": "my-app",
    "title": "My App",
    "description": "What it does",
    "multiInstance": false,
    "persist": false,
    "menu": [{ "category": "applications", "order": 50 }],
    "palette": { "order": 50 },
    "agent": true,
    "api": true
  }
}
```

| Field | Effect |
|-------|--------|
| `multiInstance` | Allow >1 window open simultaneously |
| `persist` | Save and restore window across sessions |
| `menu` | Appear in app menu (core tier only) |
| `palette` | Appear in command palette |
| `agent` / `api` | Expose commands to agents and HTTP API |

---

## Component models — two families, one import path

Both exported from `microapp-sdk.ts`. Not interchangeable.

**CompositionHelpers** (`@public` — prefer): `createHeaderBar`, `createStatusBar`, `createTextViewer`, `createListPanel`, `createSplitView`, `createTabs`, `createInputLine`, `createCanvas`, `createScrollView`. Take `parent` as first arg, self-position, return `{ element, update, destroy }`.

**LayoutParts** (`@internal`): `createProgressBar`, `createKeyValuePanel`, `createDataTable`. Take no parent, return `{ node, layout(rect), restyle, destroy }`. Require `createStack`.

**Never mix in `createStack`** — TypeScript allows it silently (via `LayoutPart<any>`) but
`.layout()` fails → blank window. `host.ui.*` exposes both together — same trap. See `GOTCHAS.md`.

**Persistence:** workspace restore → `host.registerSnapshot({ serialize, restore })`. File persistence → `safeWriteFile` / `safeReadJSON` from SDK (never raw `fs.*`). Full pattern in `MICROAPP-DEV.md`.

**Animation clocks:** `createAnimationClock(fps)` starts immediately — call `clock.pause()` next line. Max 8–10fps or blessed render saturates. `clock.destroy()` in `onCleanup`.

---

## Dev loop

```bash
bash scripts/reload-microapp.sh <id>   # close → reload code → reopen
curl localhost:8099/state              # verify window appeared in state
wibwob read <id>                       # check captureText output
```

---

## Lifecycle

```
microapp.json discovered → setup(host) called
  └── createWindow / registerCommand / wire 4 hooks
        │
        ▼
      Window live — commands, API, agents all reach it
        │
        ▼
      Close → onCleanup() — release everything
```

<progressive-disclosure>
  <output>`src/sdk/README.md` — full SDK export surface by stability tier</output>
  <output>`src/services/microapp-loader.ts` — discovery, host construction, tier visibility rules</output>
  <generator>read the source — manifest interfaces and host factory are ground truth</generator>
  <deeper>`PHILOSOPHY.md` — why the SDK boundary exists · `ARCHITECTURE.md` — full system context</deeper>
</progressive-disclosure>
