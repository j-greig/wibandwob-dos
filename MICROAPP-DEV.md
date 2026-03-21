# MICROAPP-DEV — Agent Development Reference

> Distilled from `.pi/reflections/claude-code-cloud-agent-devlog.md`.
> Proven procedures only — no narrative, no trial-and-error.
>
> See also: `ARCHITECTURE.md §The microapp contract` · `PHILOSOPHY.md §The operational consequence`

---

## Quick start (copy-paste block)

```bash
# 1. Install (cloud-safe)
bun install --ignore-scripts

# 2. Start
bash scripts/ensure-running.sh --tmux

# 3. Typecheck
bun run typecheck

# 4. Health
curl -sf --max-time 5 http://127.0.0.1:8099/health

# 5. Open a microapp
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.click-counter.open"}'

# 6. Screenshot (text)
curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/text?id=1"

# 7. Close window
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"window.close","args":{"id":1}}'
```

---

## Environment detection: cloud vs local

| Signal | Cloud / headless | Local / human |
|--------|-----------------|---------------|
| `[ ! -t 0 ]` | true (no TTY) | false |
| `$TERM` | `dumb` or unset | `xterm-256color` etc. |
| `uname` | Linux (container) | Darwin (macOS) |
| tmux available | must install first | usually present |
| `script -q /dev/null` | **FAILS** (Linux flags differ) | works (macOS) |

**The critical difference:** macOS `script` accepts `script -q /dev/null bash -c "CMD"`.
Linux `script` uses `-c` flag: `script -q /dev/null -c "bash -c 'CMD'"`.

The startup scripts default to `--direct` mode which calls `script -q /dev/null`
with macOS syntax. In cloud Linux containers this produces:
```
script: unexpected number of arguments
```

**Rule: always use `--tmux` in cloud.** See `PATCHNOTES.md` for the permanent fix.

---

## Install

```bash
# WORKS everywhere:
bun install --ignore-scripts

# FAILS in cloud (canvas native module compilation):
bun install
# → error: install script from "canvas" exited with 1
# → node-pre-gyp ERR! (native compilation fails in cloud containers)
```

The `canvas` package is a transitive dependency. `--ignore-scripts` skips its
native build. Everything that matters still works.

---

## Starting WibWob-DOS

### Recommended (all environments)

```bash
bash scripts/ensure-running.sh --tmux
```

Output on success:
```
▶ ensure-running: mode=tmux port=8099
  creating tmux session: wibwob (205x55)
  launching in tmux: bun run dev:world
  waiting for API.....
✓ ready  instance=abc123  port=8099  mode=tmux
```

### Restart

```bash
bash scripts/restart.sh --tmux
```

### Hard restart (when API is hung)

```bash
kill -9 $(ps aux | grep "bun run src" | grep -v grep | awk '{print $2}')
tmux kill-session -t wibwob
sleep 2
bash scripts/ensure-running.sh --tmux
```

### Port stuck

```bash
bash scripts/clean-instances.sh --kill
```

---

## API interaction

### Always use `--max-time`

```bash
# BAD — hangs forever if API is unresponsive:
curl -sf http://127.0.0.1:8099/health

# GOOD:
curl -sf --max-time 5 http://127.0.0.1:8099/health
```

Without `--max-time`, a hung API causes your bash command to run in background
forever, consuming a process slot. This is the single most common agent footgun.

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | `{"ok":true,"instanceId":"..."}` |
| `/state` | GET | All windows, desktop geometry, theme |
| `/commands/list` | GET | Every registered command |
| `/commands/run` | POST | Execute a command by id |
| `/screenshot/text?id=N` | GET | Clean text capture of window N |
| `/screenshot/ansi?id=N` | GET | ANSI-rendered capture of window N |

### Command ID format

```
microapp.{appId}.{commandId}
```

- `{appId}` comes from `microapp.json` → `microapp.id`
- `{commandId}` comes from `host.registerCommand({ id: "open" })`
- Example: `microapp.wibwob.click-counter.open`

### Parsing state

```bash
curl -sf --max-time 5 http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    print(f'id={w[\"id\"]} title={w.get(\"title\",\"?\")}')"
```

---

## Scaffold a new microapp

```bash
bash .pi/skills/microapp-creator/scripts/scaffold-microapp.sh \
  microapps/<dir-name> <app-id> "<Title>" <menu-order>
```

Example:
```bash
bash .pi/skills/microapp-creator/scripts/scaffold-microapp.sh \
  microapps/click-counter wibwob.click-counter "Click Counter" 200
```

After scaffolding:

1. Edit `microapps/<name>/index.ts`
2. Add to `src/core/microapp-registry.ts` (beta tier for development)
3. `bun run typecheck`
4. Restart to load: `bash scripts/restart.sh --tmux`

### Registry entry

```typescript
// src/core/microapp-registry.ts — inside REGISTRY:
"wibwob.your-app-id": "beta",
```

---

## The four required hooks

Missing any one is the most common microapp failure mode
(`ARCHITECTURE.md:101-107`):

```typescript
win.describeState(() => ({ summary: "..." }))  // agents read this via /state
win.captureText(() => "content text")           // wibwob read <id>
win.onCleanup(() => { /* stop timers */ })      // prevent zombie processes
win.onRestyle(() => { /* re-apply host.theme() */ })  // theme switching
```

---

## Import rule

```typescript
// ONLY import from this path:
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createStatusBar, createHeaderBar } from "../../src/services/microapp-sdk.js";

// NEVER import from src/core/*, src/ui/*, or src/services/* directly.
// This is a COAT violation (ARCHITECTURE.md:109-110).
```

---

## Two component models

This is the biggest source of confusion for agents. Both are imported from
`microapp-sdk.ts` with no indication which is which.

### 1. Composition helpers (`@public`, from `sdk/composition-helpers.ts`)

`createStatusBar`, `createTextViewer`, `createListPanel`, `createSplitView`,
`createTabs`, `createCanvas`, `createInputLine`, `createHeaderBar`, `createScrollView`

- Take `parent: blessed.Widgets.BoxElement` as first arg
- Position themselves in parent with `top`/`bottom` offsets
- Return handles with `.element`, `.update()`, `.destroy()`

### 2. LayoutPart components (`@internal`, from `core/ui-parts*.ts`)

`createProgressBar`, `createKeyValuePanel`, `createDataTable`, `createSpinner`

- Do NOT take a parent arg
- Need `createStack`/`createRow` for positioning
- Return `LayoutPart` with `.node`, `.layout(rect)`, `.restyle()`, `.destroy()`
- Used via: `const root = createStack(win.body, [{ key, basis, part }])`

**When in doubt:** use composition helpers. They're `@public` and stable.

---

## Visual verification pattern

The correct workflow for verifying a microapp — one at a time, with delays:

```bash
# 1. Open
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.your-app.open"}'
sleep 1

# 2. List windows to get ID
bash scripts/screenshot-window.sh --list

# 3. Text screenshot
curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/text?id=1"

# 4. ANSI screenshot
curl -sf --max-time 5 "http://127.0.0.1:8099/screenshot/ansi?id=1"

# 5. Close before testing next
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"window.close","args":{"id":1}}'
```

**Do NOT batch-verify in a loop.** Rapid curl churn overwhelms the
single-threaded bun runtime.

### Automated blank-app check

Use `scripts/validate-microapp.sh` for a single-command PASS/FAIL verdict:

```bash
bash scripts/validate-microapp.sh microapp.wibwob.your-app.open
# ✓ PASS — microapp.wibwob.your-app.open (143 chars)
# ✗ FAIL — captureText returned 3 chars (< 50 minimum)
```

A **passing app** produces ≥5 chars of readable text from `captureText` (the default).
For content-rich apps (clocks, lists, canvases) pass a higher bar: `validate-microapp.sh <id> 50`.
A **blank app** returns an empty string or pure whitespace — 0–4 chars.
If validate-microapp fails, check that your `captureText` hook returns real content.

> The validate script opens the app, waits 1s, screenshots text, checks length,
> closes the window, and exits 0 (PASS) or 1 (FAIL).

---

## Performance gotchas

### Animation clock + grid-canvas = CPU cliff

```
createAnimationClock(30) + per-cell ANSI codes + gridToText + host.screen.render()
= 87% CPU, API unresponsive, instance effectively dead
```

Fixes:
- Use **8-10fps max** for animation clocks
- Call `clock.pause()` immediately after creation (it starts running!)
- Avoid ANSI escape codes inside grid cells — use plain characters
- `clock.destroy()` in `onCleanup`

### blessed render is the bottleneck

Every `host.screen.render()` triggers blessed's full diffing algorithm. At 30fps
with complex content, this saturates the event loop and blocks HTTP request handling.

---

## Discovering command IDs — COAT.md

Before opening or interacting with any microapp via curl, generate the live
command/endpoint snapshot:

```bash
bun scripts/gen-coat.ts   # writes COAT.md — 80+ commands, all IDs listed
```

Then grep COAT.md for your app's command IDs rather than guessing:

```bash
grep "world-clock" COAT.md
# → microapp.wibwob.world-clock.open
```

COAT.md is auto-generated — never edit it. Regenerate whenever you add a microapp.

---

## Persistence

**Decision tree — choose one:**

| Need | Pattern | How |
|------|---------|-----|
| Restore window state when workspace reloads | `registerSnapshot` | `host.registerSnapshot({ serialize, restore })` |
| File-based persistence (survives process restart) | `safeWriteFile` + `safeReadJSON` | From SDK — see below |
| Never | raw `fs.*` / `fs/promises` | ARCHITECTURE invariant 7 violation |

### `registerSnapshot` — workspace persistence

```typescript
// In setup(host):
host.registerSnapshot({
  serialize: () => ({ items }),           // called on workspace save
  restore: (_snap, payload) => {
    items = payload.items as Item[];       // called on workspace restore
    host.runCommand("open", payload);      // re-open with restored state
  },
});
```

Pair with `"persist": true` in `microapp.json`.

### `safeWriteFile` / `safeReadJSON` — file persistence

```typescript
import { safeWriteFile, safeReadJSON } from "../../src/services/microapp-sdk.js";
import path from "node:path";

const dataDir = path.join(host.repoRoot, "scratch", "microapps", "my-app");
const dataFile = path.join(dataDir, "data.json");

// Save
safeWriteFile(dataFile, JSON.stringify(state));

// Load
const saved = safeReadJSON<MyState>(dataFile);
if (saved) state = saved;
```

`safeWriteFile` / `safeReadJSON` swallow errors and return `undefined`/`false` —
correct posture for microapp-level I/O.

---

## microapp.json key fields

```jsonc
{
  "microapp": {
    "id": "wibwob.your-app",       // must match registry key
    "title": "Your App",
    "multiInstance": false,         // true = multiple windows allowed
    "persist": false,               // true = workspace save/restore via registerSnapshot
    "agent": true,                  // expose via agent tools
    "api": true,                    // expose via HTTP API
    "menu": [
      { "category": "applications", "order": 200, "label": "Your App" }
    ],
    "palette": { "order": 200, "label": "Open Your App" }
  }
}
```

`persist: true` requires `host.registerSnapshot(...)` to be called in `setup()`.

---

## gen-* scripts (all work headlessly)

These are pure file-I/O — no running instance needed:

| Script | Produces | Run with |
|--------|----------|----------|
| `scripts/gen-coat.ts` | `COAT.md` (endpoint + command snapshot) | `bun scripts/gen-coat.ts` |
| `scripts/gen-primitives.ts` | `src/core/primitives.ts` (barrel export) | `bun scripts/gen-primitives.ts` |
| `scripts/gen-sdk-surface.ts` | `.pi/sdk-surface.md` (SDK export directory) | `bun scripts/gen-sdk-surface.ts` |
| `scripts/gen-skills.py` | `.pi/skills/skills.md` (skill index) | `python3 scripts/gen-skills.py` |

---

## What NOT to do

### Don't use `--direct` mode in cloud
```bash
# FAILS:
bash scripts/ensure-running.sh --direct
bash scripts/restart.sh --direct
bash scripts/start-alt-instance.sh --direct

# WORKS:
bash scripts/ensure-running.sh --tmux
bash scripts/restart.sh --tmux
bash scripts/start-alt-instance.sh --tmux
```

### Don't use pkill patterns that match yourself
```bash
# THIS KILLS YOUR OWN COMMAND:
pkill -f "curl.*8099" && curl http://127.0.0.1:8099/health
# Run pkill in a separate bash invocation instead.
```

### Don't run verify loops with many curl calls
```bash
# THIS CAUSES HANGS:
for i in {1..10}; do
  curl -sf -X POST ... open app
  curl -sf ... screenshot
  curl -sf -X POST ... close
done
# Test one microapp at a time with proper delays.
```

### Don't use raw `fs.*` in microapps

```typescript
// VIOLATION — raw Node fs in a microapp:
import fs from "node:fs";
fs.writeFileSync(path, data);

// CORRECT — use SDK safe-fs:
import { safeWriteFile } from "../../src/services/microapp-sdk.js";
safeWriteFile(path, data);
```

Raw `fs.*` bypasses error handling and violates ARCHITECTURE invariant 7.
`safeWriteFile` and friends swallow errors safely and are now `@public` in the SDK.

### Don't rely on background commands for API calls
Commands that `curl` the API may run in background when the tool executor
decides to background them. Always use `--max-time` so they don't hang
indefinitely.

---

## Microapp triad workflow

For any microapp work, three roles run in sequence (`CLAUDE.md:38-48`):

1. **microapp-product-owner** — scope + keep/cut decisions (always first)
2. **microapp-developer** — implements one slice only
3. **microapp-doc-refiner** — updates canonical docs for that slice

Product-owner defines the slice before developer touches code.
3 small slices > 1 large one. Every slice produces binary evidence.

---

## File reference

| What | Path |
|------|------|
| App entry | `src/app.ts` |
| Control API | `src/services/control-api.ts` |
| SDK surface | `src/services/microapp-sdk.ts` |
| Command catalog | `src/core/command-catalog.ts` |
| Microapp registry | `src/core/microapp-registry.ts` |
| Process manager lib | `scripts/lib/process-manager.sh` |
| Cloud agent devlog | `.pi/reflections/claude-code-cloud-agent-devlog.md` |
| Skill index | `.pi/skills/skills.md` |
| Ops skill | `.pi/skills/ww-ops/SKILL.md` |
| Creator skill | `.pi/skills/microapp-creator/SKILL.md` |

---

## CLAUDE.md pointer (add this)

Add to `CLAUDE.md` under "How these docs work":

```markdown
- `MICROAPP-DEV.md` — agent dev workflow: install, start, scaffold, verify, gotchas
- `PATCHNOTES.md` — script patches for cross-platform (cloud + local) compatibility
```
