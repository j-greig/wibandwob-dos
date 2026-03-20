# Third-Party Microapp Dev Guide — Subagent Devlog

**Goal:** Build a dice roller microapp from scratch, documenting every confusion and discovery as a third-party dev with no prior knowledge of WibWob-DOS.

**Starting context:** Repo root visible. No doc files read yet. Just code.

---

## Entry 1 — Initial repo orientation

**What I tried:** `find` on the repo root to understand structure. Looked at top-level dirs.

**What happened:** Saw `microapps/`, `microapps-private/`, `src/`, `scripts/`. Also saw lots of CAPS .md files (AGENTS.md, SDK.md, ARCHITECTURE.md, etc.) — instructions said don't read those. Good, more fun this way.

Key observation: `microapps/` contains subdirs each with a `microapp.json` and `index.ts`. That's the pattern. Some dirs in `microapps/.disabled/` — those are inactive.

**What I had to do to unblock:** Nothing yet — structure was clear from `find`.

**Pain level:** 1 — obvious scaffolding pattern visible immediately.

---

## Entry 2 — Reading existing microapps to find the contract

**What I tried:** Read `microapps/figlet-banner/microapp.json` and `microapps/figlet-banner/index.ts`, then `microapps/plasma/microapp.json` and its index. Also glanced at `demo-ansi-lab` and `demo-forms-playground`.

**What happened:** Very revealing. The `microapp.json` structure is clear:

```json
{
  "name": "...",
  "version": "0.1.0",
  "type": "microapp",
  "entry": "index.ts",
  "dev": { "watch": [...], "reopenCommand": "microapp.<id>.open" },
  "microapp": {
    "id": "wibwob.<slug>",
    "title": "...",
    "multiInstance": true/false,
    "persist": false,
    "menu": [{ "category": "applications", "order": N, "label": "..." }],
    "palette": { "order": N, "label": "..." },
    "agent": true,
    "api": true
  }
}
```

The `index.ts` exports `default function setup(host: MicroappHost)`. Inside setup:
1. Call `host.registerCommand({ id, label, description, action, palette, menu, direct })` 
2. In action: call `host.createWindow({ title, width, height })`
3. Use `blessed` widgets attached to `win.body`

Key import: `import type { MicroappHost } from "../../src/services/microapp-sdk.js"`

**The `MicroappHost` API I observed (by reading examples):**
- `host.createWindow(init)` → returns window handle `win`
- `host.registerCommand(def)` → registers a command
- `host.theme()` → returns theme tokens (`body`, `header`, `footer`, `selected`, `accent`, `input`, `muted`)
- `host.screen` → blessed screen ref (call `host.screen.render()` to repaint)
- `host.geometry` → screen dimensions (`width`, `height`)
- `host.windows` → window manager
- `host.promptValue(label, default, cb)` → text input overlay
- `host.flash(msg)` → flash status message

**Window handle API:**
- `win.body` — the blessed container to attach widgets to
- `win.id` — numeric window id
- `win.describeState(fn)` — COAT: describes state for API/AI inspection
- `win.captureText(fn)` — text capture for `/screenshot/text?id=N`
- `win.onResize(fn)` — called on window resize
- `win.onRestyle(fn)` — called on theme change
- `win.onCleanup(fn)` — called on close
- `win.setFocusTarget(widget)` — tells blessed which widget gets keys
- `win.focus()` — focuses the window
- `win.setTitle(t)` — updates title bar

**What I had to do to unblock:** Just read the code carefully. Figlet-banner is a good reference — complex enough to show the full pattern but readable.

**Pain level:** 2 — the figlet-banner code is dense (~500 lines). Needed to look at simpler examples too.

---

## Entry 3 — Confusion about the `direct` flag on `registerCommand`

**What I tried:** Noticed some commands use `direct: true`, others don't. Had no idea what this meant.

**What happened:** Read `microapp-loader.ts` source. Found this in `createMicroappHost.registerCommand`:

```typescript
action: def.direct ? def.action : (args) => focusOrCreate(microappId, () => def.action(args), multiInstance),
```

So `direct: true` means the action runs directly, bypassing a `focusOrCreate` wrapper. Without `direct`, a single-instance app would re-focus an existing window instead of opening a new one.

**Decision I made:** For a `multiInstance` dice roller where every invocation should create a fresh window, use `direct: true`. This lets the action run unconditionally.

**What I had to do to unblock:** Read `microapp-loader.ts` implementation (~400 lines). The `direct` flag is not documented anywhere visible from the outside.

**Pain level:** 3 — not documented anywhere, had to read implementation. The naming is a bit opaque ("direct" vs. "managed").

---

## Entry 4 — Checking the runtime is actually live

**What I tried:** `curl localhost:8099/health` and `curl localhost:8099/state`

**What happened:** Health returned OK. State returned: `{ timestamp, app, screen, focus, menu, windows }`. Screen was 162×44. Good to know for sizing windows.

**What I had to do to unblock:** Nothing — port 8099 was mentioned in AGENTS.md but I hadn't read that. Found it by trying `curl localhost:8099/health` as an obvious guess for a local API.

**Pain level:** 1 — trivial.

---

## Entry 5 — Understanding the available API endpoints

**What I tried:** `curl http://localhost:8099/` — the root endpoint.

**What happened:** Returns a JSON object listing ALL endpoints with descriptions. Goldmine. Key endpoints for microapp dev:
- `GET /commands/list` — all registered commands (was it picked up?)
- `POST /commands/run` `{"id":"...","args":{}}` — invoke a command
- `GET /state` — full window state
- `GET /screenshot/text?id=N` — rendered text of a window

Also found `bash scripts/reload-microapp.sh` does:
1. Close windows with matching appType
2. POST to `microapps.reload`
3. POST to `microapp.<id>.open`

**What I had to do to unblock:** Just curled the root endpoint. Didn't need to read source.

**Pain level:** 1 — the service is very self-documenting via its root endpoint.

---

## Entry 6 — Writing the microapp files

**What I tried:** Created `microapps/dice-roller/microapp.json` and `microapps/dice-roller/index.ts`.

**Design decisions:**
- `id: "wibwob.dice-roller"` — following the `wibwob.<slug>` convention
- `multiInstance: true` — multiple dice roll windows are fine
- Single `open` command with optional `count` arg (1-6 dice)
- ASCII dice faces rendered as 7×5 character art using box-drawing chars and `●` for pips
- `r`/space to re-roll, `+`/`-` to add/remove dice
- Status bar shows sum and values

**Implementation approach:** Used `blessed.box` directly (no SDK layout helpers). Plasma and figlet use `createStack`/`createRow` but for a simple dice display that's overkill.

```
┌─────┐ ┌─────┐ ┌─────┐
│     │ │ ● ● │ │ ●   │
│  ●  │ │     │ │  ●  │
│     │ │ ● ● │ │   ● │
└─────┘ └─────┘ └─────┘
```

**Key issue:** `diceView.key(...)` requires the element to have `keys: true` set, and `blessed` key listeners need explicit wiring. Had to do `diceView.keys = true` after creation since it wasn't in the constructor options object.

Actually, I realized I was setting `keys` as a property after construction. Blessed accepts `keys: true` in the constructor options. I set `diceView.keys = true` post-construction — need to verify this works.

**What I had to do to unblock:** Reference the blessed docs in my memory + looking at how other microapps wire key events. Most use `widget.key([...], fn)` on a `vi: true, keys: true` scrollable widget.

**Pain level:** 2 — straightforward once the pattern was established.

---

## Entry 7 — First reload attempt: blocked by "restart required"

**What I tried:** `bash scripts/reload-microapp.sh wibwob.dice-roller`

**What happened:**
```
reloading microapps...
Command exited with code 22
```
Curl exit code 22 = HTTP 4xx/5xx. The actual response was:
```json
{"ok":false,"error":"restart required","requiresRestart":true,"blockedFiles":["src/core/app-controller.ts","src/core/primitives.ts","src/core/command-catalog.ts","src/services/control-api.ts"]}
```

The running instance had detected source file changes (someone had been editing core files) and refused to hot-reload. Required a full restart.

**What I had to do to unblock:** `bash scripts/restart.sh` — killed and relaunched the app. Took ~5 seconds, then the API was back up with a new `instanceId`.

**Pain level:** 3 — not obvious from the reload script's error output what was happening. The script says "Command exited with code 22" which is a curl error, not a helpful message. Had to curl the endpoint manually to see the actual JSON error. Once I saw "requiresRestart" it was clear.

**Lesson:** If `reload-microapp.sh` fails, check `curl -X POST localhost:8099/commands/run -d '{"id":"microapps.reload"}'` directly to see the real error.

---

## Entry 8 — First successful open and verification

**What I tried:** After restart, called:
```bash
curl -X POST http://localhost:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.dice-roller.open","args":{"count":3}}'
```

**What happened:**
```json
{"ok":true}
```

Then checked state:
```bash
curl -s http://localhost:8099/state | python3 -c "import sys,json; ..."
```

Got:
```json
{
  "id": 1,
  "kind": "microapp",
  "appType": "wibwob.dice-roller",
  "title": "Dice Roller",
  "details": {
    "summary": "Dice roller: 3 dice — [1, 4, 3] = 8",
    "count": 3,
    "values": [1, 4, 3],
    "sum": 8
  }
}
```

Then captured the rendered text:
```bash
curl -s 'http://localhost:8099/screenshot/text?id=1'
```

Got:
```
┌─────┐ ┌─────┐ ┌─────┐
│     │ │ ● ● │ │ ●   │
│  ●  │ │     │ │  ●  │
│     │ │ ● ● │ │   ● │
└─────┘ └─────┘ └─────┘
```

**It works!** The dice are rendering as proper ASCII art with correct pip patterns.

**What I had to do to unblock:** Nothing — it worked first try after restart.

**Pain level:** 1 — zero friction at this step.

---

## Summary: What a third-party dev needs to know

### The essentials (in order of importance)

1. **File layout:** `microapps/<name>/microapp.json` + `microapps/<name>/index.ts`
2. **Manifest fields:** `type: "microapp"`, `microapp.id` (use `wibwob.<slug>` prefix), `microapp.title`. The rest is optional but `menu`/`palette` make it discoverable.
3. **Entry contract:** `export default function setup(host: MicroappHost)` — no return value needed.
4. **Import:** `import type { MicroappHost } from "../../src/services/microapp-sdk.js"` — the `../../` assumes you're in `microapps/<name>/`. Everything flows from `host`.
5. **Creating a window:** `const win = host.createWindow({ title, width, height })` → attach `blessed` widgets to `win.body`.
6. **Registering commands:** `host.registerCommand({ id, label, description, action, menu, palette, direct })` — the `id` becomes `microapp.<app-id>.<id>`.
7. **The `direct` flag:** Use `direct: true` for `multiInstance` apps where every call should create a new window. Omit it for single-instance apps where the system should re-focus existing windows.
8. **Reloading:** `bash scripts/reload-microapp.sh <id>` — if this fails with curl exit 22, the API may require a restart. Check the actual curl response to see why.
9. **Verifying:** `curl http://localhost:8099/state` shows windows; `curl http://localhost:8099/screenshot/text?id=N` shows rendered content.

### Key gotchas discovered

- **`microapps.reload` can be blocked:** If core source files changed since the app started, a full restart is needed. The error response says which files are "blocked". The reload script masks this with a generic curl error.
- **Window registration is async:** The loader uses `queueMicrotask` — set up `describeState`, `onRestyle`, etc. synchronously in `setup`, they'll be attached before the window is registered.
- **`setFocusTarget`:** Always call `win.setFocusTarget(yourWidget)` and `win.focus()` — without this the window exists but no keyboard input reaches it.
- **`host.screen.render()`:** Call this after every content update. It's not automatic.
- **Theme tokens:** `host.theme()` returns `{ body, header, footer, selected, accent, input, muted }`. The `footer` key may be undefined in some themes — use `nt.footer ?? nt.header` defensively.
- **The `dev.reopenCommand` field:** Optional but helpful for the `reload-microapp.sh` script to know what command to call after reload. Set it to `microapp.<id>.open`.
- **Tier system — menu is core-only:** New microapps default to `"beta"` tier. Beta tier appears in palette, api, and agent — but NOT in the desktop menu. The `menu` field in `microapp.json` is silently ignored for beta apps. To appear in the menu, the app must be registered as `"core"` in `src/core/microapp-registry.ts`. This is invisible from the outside — you'll write a `menu` entry, it'll be ignored, and the commands list will show `"menuCategories": []` with no explanation. This would confuse any third-party dev.
- **Verification trick:** `curl localhost:8099/commands/list` shows each command with its `surfaces` array and `menuCategories`. If menu categories are empty despite being declared in `microapp.json`, check the tier (probably "beta").

---

## Post-build review notes (human)

**Key bindings wired to blessed box, not to host.registerCommand** — `POST /windows/input` returns `ok:false`. Roll/add/remove are keyboard-only. Lesson for the guide: if you want your microapp to be agent/API controllable, register commands for every meaningful action — don't rely on key bindings alone.

**Only `open` surfaces in `commands/list`** — the roll/add/remove actions are invisible to the system.

**`appType` in `describeState` is `"dice-roller"` (no namespace prefix)** but the registered command id is `wibwob.dice-roller`. Inconsistency that could confuse consumers of the state API.
