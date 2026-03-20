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

Missing any one fails silently — this is the most common microapp bug:

| Hook | Purpose |
|------|---------|
| `win.describeState()` | Agents read this to understand what the window contains |
| `win.captureText()` | Powers `wibwob read <id>` — must return plain text |
| `win.onCleanup()` | Called on close — stop all timers and listeners here |
| `win.onRestyle()` | Called on theme switch — re-apply every themed colour |

---

## What host gives you

| | What it does |
|-|-------------|
| `host.createWindow(init)` | Create the blessed frame — returns `win` handle |
| `host.registerCommand(def)` | Register palette / menu / API / agent command |
| `host.theme()` | Current theme tokens — use in `onRestyle` |
| `host.runCommand(id)` | Dispatch a local command by id |
| `host.runGlobalCommand(id)` | Dispatch any global command |
| `host.flash(msg)` | Show a toast notification |
| `host.promptValue(label, default, cb)` | Open an inline value prompt |
| `host.pickFile(label, dir, cb)` | Open the file browser prompt |
| `host.ui.*` | Layout primitives — `createStack`, `createRow`, `createHeaderBar`, etc. |
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
  <output>`src/services/microapp-loader.ts` — discovery, host construction, tier visibility rules</output>
  <generator>read the source — manifest interfaces and host factory are ground truth</generator>
  <deeper>`PHILOSOPHY.md` — why the SDK boundary exists · `ARCHITECTURE.md` — full system context</deeper>
</progressive-disclosure>
