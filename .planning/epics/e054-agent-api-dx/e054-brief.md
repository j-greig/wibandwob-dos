---
title: "E054 — Agent API DX: close the temporal and semantic gaps"
status: done
branch: epic/e054-agent-api-dx
issue: ~
---

# E054 — Agent API DX

---

## TUI monitoring toolkit (use this when verifying every story)

Before testing any story, confirm the app is running and pick a verification method.

### 1. Text dump — fast, works headless (primary)
```bash
tmux capture-pane -t wibwob -p                        # raw dump
tmux capture-pane -t wibwob -p | grep -v '^.\{20,\}$\|^a\+$'  # strip fill-char lines
```

### 2. Ghostty AppleScript — click menus, send keys, move mouse
Ghostty ships a full scripting dictionary (merged in 1.3.0). Works on macOS only.

```applescript
-- Get the terminal surface
tell application "Ghostty"
  set t to first terminal of front window

  -- Send text / keystrokes
  input text "curl -sf localhost:8099/health" & return to t

  -- Click at pixel coords (relative to terminal content area)
  -- Calibrate: cell_w = window_px_width / cols, cell_h = (window_px_height - 28) / rows
  send mouse position x 294.0 y 8.0 to t   -- e.g. col 42, row 0 = "Core Apps" menu
  send mouse button left button action press to t
  send mouse button left button action release to t

  -- Send a key with modifiers
  send key "q" modifiers "control" to t
end tell
```

```bash
# One-liner to click "Core Apps" menu (col 42, row 0, 173x66 terminal, window at 1111,156 1384x1167)
osascript -e '
  tell application "Ghostty"
    set t to first terminal of front window
    send mouse position x (42.0 * (1384/173)) y (0.5 * ((1167-28)/66)) to t
    send mouse button left button action press to t
    send mouse button left button action release to t
  end tell'
sleep 0.3
tmux capture-pane -t wibwob -p | head -10   # verify menu opened
```

Get window geometry for coord calibration:
```bash
osascript -e 'tell application "System Events" to tell process "Ghostty" to {position of window 1, size of window 1}'
# → 1111, 156, 1384, 1167  (x, y, w, h)
```

### 3. PNG screenshot — visual proof
```bash
screencapture -x -D 1 /tmp/tui-snap.png   # full display
# Then: read the file in pi to attach as evidence
```

### 4. API semantic state — preferred for assertions
```bash
curl -sf localhost:8099/state | python3 -m json.tool
curl -sf localhost:8099/health
curl -sf "localhost:8099/windows/text?id=N"
curl -sf localhost:8099/errors/recent
```

### Ensure running
```bash
bash scripts/ensure-running.sh --tmux
curl -sf --max-time 2 localhost:8099/health || echo "not running"
```

---

PHILOSOPHY.md says: "Whatever the human can do, the agent must be able to do."
Right now this breaks on time and semantics:
- A human watches state evolve in real time. An agent polls and guesses.
- A human sees errors on screen. An agent gets `{ok:true}` while the app crashes.
- A human knows which window just opened. An agent does `sleep 1` then `max(window.id)`.

Six stories. In implementation order — each one is independently mergeable.

---

## Stories

### S01 — Inline errors in command response
`[x]`

**The gap.**
`POST /commands/run` returns `{ok:true}` even when the microapp crashes during `setup()`.
The error IS captured in `error-buffer.ts` and exposed at `GET /errors/recent` — but the
agent must know to call it separately and correlate timestamps manually. `validate-microapp.sh`
never calls it; it infers failure only from blank `captureText`. A crash that renders something
but corrupts state is completely invisible.

**Files.**
- `src/services/control-api.ts` — the `/commands/run` handler only (~+10 lines)

**What to do.**
In the `/commands/run` handler, snapshot `getRecentErrors().length` before dispatch.
After dispatch, filter for new errors whose `microappId` matches the command being run
(derive microappId from command id: `microapp.wibwob.journal.open` → `wibwob.journal`).
Include non-empty errors array in the response.

```ts
// Before dispatch:
const errorCountBefore = getRecentErrors().length;

// After dispatch:
const newErrors = getRecentErrors()
  .slice(errorCountBefore)
  .filter(e => !e.microappId || commandId.includes(e.microappId));

return Response.json({
  ...result,
  ...(newErrors.length > 0 ? { errors: newErrors } : {}),
});
```

**Response shape (error case).**
```json
{
  "ok": true,
  "errors": [{
    "microappId": "wibwob.journal",
    "hook": "setup",
    "message": "Cannot read properties of undefined (reading 'body')",
    "timestamp": "2026-03-22T11:00:00.000Z"
  }]
}
```

**Risk.** Errors captured asynchronously after `queueMicrotask` may not appear before
the response returns. `errors` array therefore only covers synchronous setup errors.
Async errors remain available at `GET /errors/recent`. Document this boundary.

---

### S02 — Address windows by appType not numeric id
`[x]`

**The gap.**
`GET /windows/text?id=N` requires a numeric window id. Agents always know the appType
(`wibwob.journal`) but must do a full `GET /state` round-trip to resolve it to a number.
Two calls where one would do. The host has `findWindowByAppType()` already.

**Files.**
- `src/services/control-api.ts` — the `/windows/text` handler only (~+8 lines)

**What to do.**
Accept `?appType=wibwob.journal` as an alternative to `?id=N`. When `appType` is given
and `id` is absent, find the matching window: focused instance if `multiInstance: true`,
otherwise the sole instance.

```ts
// In the /windows/text handler:
const appType = url.searchParams.get("appType");
if (!idParam && appType) {
  const wins = this.deps.windows.getWindows()
    .filter(w => w.details?.appType === appType);
  // prefer focused, else most recently opened (last in array)
  const win = wins.find(w => w.focused) ?? wins.at(-1);
  if (!win) return Response.json({ ok: false, error: `No window with appType: ${appType}` }, { status: 404 });
  id = win.id;
}
```

**Before.**
```bash
STATE=$(curl -sf localhost:8099/state)
ID=$(echo $STATE | python3 -c "import json,sys; print(next(w['id'] for w in json.load(sys.stdin)['windows'] if w['appType']=='wibwob.journal'))")
curl "localhost:8099/windows/text?id=$ID"
```

**After.**
```bash
curl "localhost:8099/windows/text?appType=wibwob.journal"
```

**Risk.** Multi-instance ambiguity. Resolve: focused window wins, else last opened.
Document the tie-break rule in the endpoint description.

---

### S03 — Return windowId from open commands
`[x]`

**The gap.**
Opening a microapp returns `{ok:true}` with no indication of which window was created.
`validate-microapp.sh` does `sleep 1` then `GET /state` then `max(w['id'])` to find it.
The window ID IS assigned synchronously — `WindowManager.createFrame()` does
`id: this.nextWindowId++` before `queueMicrotask` fires — it's just not surfaced.

**Files.**
- `src/core/window-manager.ts` — add `getLastCreatedId()` (~+5 lines)
- `src/core/app-controller.ts` — `buildMicroappDeps().focusOrCreate` wrapper (~+3 lines)

**What to do.**

In `WindowManager`, track the id assigned in the most recent `createFrame()` call:
```ts
private _lastCreatedId: number | undefined;

createFrame(title, kind): WindowRecord {
  const record: WindowRecord = { id: this.nextWindowId++, ... };
  this._lastCreatedId = record.id;
  return record;
}

getLastCreatedId(): number | undefined {
  const id = this._lastCreatedId;
  this._lastCreatedId = undefined; // consume once
  return id;
}
```

In `buildMicroappDeps().focusOrCreate`, after calling `this.focusOrCreate()`,
read and return the id:
```ts
focusOrCreate: (appType, createFn, multiInstance) => {
  const wasFocused = !multiInstance && Boolean(this.findWindowByAppType(appType));
  if (wasFocused) {
    log.app(`[wibwob] focusOrCreate intercepted "${appType}" — ...`);
  }
  this.focusOrCreate(appType as AppType, createFn, multiInstance);
  const windowId = wasFocused
    ? this.findWindowByAppType(appType as AppType)?.id
    : this.windowManager.getLastCreatedId();
  return { focused: wasFocused, windowId };
},
```

The dynamic command action in `microapp-loader.ts` already passes `focusResult` through —
update it to include `windowId`:
```ts
action: def.direct ? def.action : (args) => {
  const focusResult = focusOrCreate(microappId, () => def.action(args), multiInstance);
  return { ok: true, ...(focusResult.focused ? { focused: true } : {}), windowId: focusResult.windowId };
},
```

**Response shape.**
```json
{ "ok": true, "windowId": 7 }
{ "ok": true, "focused": true, "windowId": 4 }
```

**Before.**
```bash
curl -X POST localhost:8099/commands/run -d '{"id":"microapp.wibwob.journal.open"}'
# → {"ok":true}
sleep 1
curl localhost:8099/state | python3 -c "import json,sys; print(max(w['id'] for w in json.load(sys.stdin)['windows']))"
# → 7
```

**After.**
```bash
curl -X POST localhost:8099/commands/run -d '{"id":"microapp.wibwob.journal.open"}'
# → {"ok":true,"windowId":7}
```

**Risk.** `getLastCreatedId()` is consumed-once so concurrent opens don't interfere.
The window isn't in `getWindows()` until the microtask fires — agents calling
`GET /windows/text?id=7` immediately may get 404 for one event-loop tick.
Mitigate in validate-microapp.sh by replacing `sleep 1` with a short retry loop
(3 × 100ms) before declaring failure. Or document the tick boundary.

---

### S04 — Surface missing hooks in /state
`[x]`

**The gap.**
When a microapp doesn't register `captureText`, `describeState`, `onCleanup`, or
`onRestyle`, the only signal is a blank `wibwob read` or a silent theme-switch bug.
The host knows at registration time which hooks are set (we added `describeStateOverridden`
in the SDK hardening pass). Agents can't see this without trying to exercise the hooks.

**Files.**
- `src/core/types.ts` — add `missingHooks?: string[]` to `WindowStateDetails` (~+1 line)
- `src/core/window-manager.ts` — expose hook flags on `WindowRecord` (~+4 lines)
- `src/services/microapp-loader.ts` — write flags to frame after hook registration pass (~+6 lines)

**What to do.**

Add to `WindowRecord` (types.ts or window-manager.ts):
```ts
missingHooks?: string[];  // populated after setup() completes
```

In `microapp-loader.ts`, in the second `queueMicrotask` (the one we added for warnings),
also write to the frame:
```ts
queueMicrotask(() => {
  const missing: string[] = [];
  if (!describeStateOverridden) missing.push("describeState");
  if (!frame.captureText)       missing.push("captureText");
  if (!frame.cleanup)           missing.push("onCleanup");
  if (!frame.onRestyle)         missing.push("onRestyle");
  if (missing.length > 0) {
    log.app(`[wibwob] ${microappId} — missing hooks: ${missing.join(", ")}`);
    frame.missingHooks = missing;
  }
});
```

In `state-service.ts` `buildState()`, when building `DesktopWindowState`, include
`missingHooks` if present in the frame's `describeState()` result or directly from
the frame record.

**Response shape (broken microapp).**
```json
{
  "id": 7, "appType": "wibwob.journal",
  "details": {
    "summary": "Journal",
    "missingHooks": ["captureText", "onCleanup"]
  }
}
```

**Risk.** `missingHooks` only present when non-empty — no change to healthy windows.
`WindowRecord` gets a new optional field; no breaking change.

---

### S05 — microapps.reload-app command
`[x]`

**The gap.**
`reload-microapp.sh` does: find windows by appType → close each → sleep 0.3 →
`microapps.reload` → sleep 0.5 → reopen. Four API calls, two hardcoded sleeps,
60 lines of bash. All of this is host-owned coordination that belongs in the runtime,
not in a shell script.

**Files.**
- `src/core/command-catalog.ts` — new command definition (~+10 lines)
- `src/core/app-controller.ts` — action implementation (~+30 lines)
- `scripts/reload-microapp.sh` — reduce to thin wrapper or delete

**What to do.**

Add to command catalog:
```ts
{
  id: "microapps.reload-app",
  label: "Reload Microapp",
  description: "Close all windows for a microapp, reload its code, and reopen.",
  group: "system",
  actionKey: "reloadMicroapp",
  api: true,
  agent: true,
  returns: "json",
  params: z.object({ microappId: z.string() }),
}
```

Add `reloadMicroapp` to `AppMenuActions` interface, implement in `app-controller.ts`:
```ts
reloadMicroapp: async ({ microappId }) => {
  // 1. Close matching windows
  const closed: number[] = [];
  for (const win of this.windowManager.getWindows()) {
    if (win.microappId === microappId) {
      closed.push(win.id);
      this.windowManager.closeWindowById(win.id);
    }
  }

  // 2. Reload
  const reload = await this.reloadMicroappsFromDisk();
  if (reload.requiresRestart) {
    return { ok: false, requiresRestart: true, blockedFiles: reload.blockedFiles };
  }

  // 3. Reopen
  const openId = `microapp.${microappId}.open`;
  const openResult = this.runApiCommand(openId);
  const windowId = this.windowManager.getLastCreatedId();

  return { ok: true, closed, reloaded: reload.reloaded, windowId };
}
```

Note: `reloadMicroappsFromDisk` is async. Check whether `CommandRegistry.run()` /
`runApiCommand` handles async actions — if not, this needs a small runner change or
must fire-and-forget and return `{ok:true, reloading:true}`. Verify before implementing.

**Before.**
```bash
bash scripts/reload-microapp.sh wibwob.journal
# 4 curl calls, 2 sleeps, python3 parsing
```

**After.**
```bash
curl -X POST localhost:8099/commands/run \
  -d '{"id":"microapps.reload-app","args":{"microappId":"wibwob.journal"}}'
# → {"ok":true,"closed":[4],"reloaded":1,"windowId":7}
```

**Risk.** Async runner compatibility. Investigate `CommandRegistry.runCommand()` return
type — if it awaits the action result already, this is clean. If not, refactor the
action to be synchronous (close + reload + schedule reopen) and return a polling token.

---

### S06 — GET /events — SSE stream
`[x]`

**The gap.**
"Whatever the human can do, the agent must be able to do." That breaks on time.
A human watches the screen evolve in real time. An agent polls `/state` and asks
"has anything changed yet?" on a loop. That's not equal control — it's a degraded
approximation of it.

The current agent interaction model:
```
command → sleep → poll /state → did it work? → sleep → poll again
```

After this story:
```
subscribe to /events → command → event confirms result → next command
```

**Why this is the right architectural move.**
Bun's HTTP server has native SSE support (`Response` with `ReadableStream`).
`StateService` already emits internal events via `subscribe()` — this just exposes them.
No new state model. No new pub/sub primitive. ~80 lines of implementation.

All 85+ commands, all microapps, all existing endpoints become more powerful without
touching them. The SSE stream is additive.

Closes known concrete bugs:
- 500ms race after `desktop.clear-all` (agents can subscribe and wait for `windows-cleared`)
- Workspace restore timing (subscribe → `workspace-restored` event → proceed)
- Batch operations returning `false` with no explanation (event shows what failed)

**Files.**
- `src/services/control-api.ts` — new `/events` route (~+50 lines)
- `src/services/state-service.ts` — expose typed event emission (~+20 lines)
- `src/core/command-registry.ts` — emit `command-completed`/`command-failed` events (~+10 lines)
- `src/cli/wibwob.ts` — `wibwob watch` subcommand (~+20 lines)

**What to do.**

In `state-service.ts`, add a typed event emitter alongside the existing state subscriber:
```ts
export type RuntimeEvent =
  | { type: "window-opened";   windowId: number; appType: string; details: WindowStateDetails }
  | { type: "window-closed";   windowId: number; appType: string }
  | { type: "state-changed";   snapshot: DesktopState }
  | { type: "command-completed"; commandId: string; windowId?: number }
  | { type: "command-failed";  commandId: string; error: string }
  | { type: "microapp-reloaded"; microappId: string; reloaded: number };

// Add alongside existing subscribe():
subscribeEvents(listener: (event: RuntimeEvent) => void): () => void
emitEvent(event: RuntimeEvent): void
```

Emit events from existing mutation points:
- `windowManager.registerWindow()` → `window-opened`
- `windowManager.closeWindowById()` → `window-closed`
- `StateService.persistAndNotify()` → `state-changed` (already fires on state changes)
- `/commands/run` handler → `command-completed` or `command-failed` after dispatch

In `control-api.ts`, add the SSE endpoint:
```ts
if (request.method === "GET" && url.pathname === "/events") {
  const typeFilter  = url.searchParams.get("type");
  const windowFilter = url.searchParams.get("window")
    ? Number(url.searchParams.get("window")) : undefined;

  let unsub: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      unsub = stateService.subscribeEvents((event) => {
        if (typeFilter && event.type !== typeFilter) return;
        if (windowFilter && !("windowId" in event && event.windowId === windowFilter)) return;
        const data = `data: ${JSON.stringify({ ...event, timestamp: new Date().toISOString() })}\n\n`;
        controller.enqueue(new TextEncoder().encode(data));
      });
    },
    cancel() { unsub?.(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

Add to endpoint catalogue:
```ts
{ method: "GET", path: "/events",
  description: "SSE stream of runtime events. ?type=window-opened|window-closed|state-changed|command-completed|command-failed. ?window=N filters to one window." },
```

In `src/cli/wibwob.ts`, add `wibwob watch` subcommand:
```ts
// wibwob watch [--type TYPE] [--window N]
// Streams /events to stdout as JSON-lines. Ctrl-C to stop.
```

**Usage after.**
```bash
# In one terminal — subscribe before acting:
wibwob watch --type window-opened

# In another:
curl -X POST localhost:8099/commands/run -d '{"id":"microapp.wibwob.journal.open"}'
# → wibwob watch prints:
# {"type":"window-opened","windowId":7,"appType":"wibwob.journal","timestamp":"..."}

# Wait for a specific event in a script:
wibwob watch --type command-completed | grep '"commandId":"desktop.clear-all"' | head -1

# Pipe + grep — fully Unix-composable:
wibwob watch | grep '"type":"window-closed"'
```

**Risk.**
SSE connections are long-lived — need to handle client disconnect gracefully (the
`cancel()` callback in `ReadableStream` handles this). Bun's server handles concurrent
SSE connections without blocking. Test with multiple simultaneous subscribers.
One risk: if `StateService` isn't accessible from `ControlApiService` constructor
deps, wire it in — check the dep injection in `app-controller.ts` `buildControlApi()`.

**Future.**
Once `/events` exists, S01–S05 become optional optimisations rather than workarounds.
Agents can subscribe → command → wait for `command-completed` event with full context,
instead of needing `windowId` in the response. Build S01–S05 first (they're simpler and
immediately useful without SSE); S06 makes the whole surface dramatically more powerful.

---

## Implementation order rationale

S01 and S02 are single-file, ~10 lines each. Ship them fast.
S03 requires two files but closes the root cause of `sleep 1` everywhere.
S04 adds a diagnostic field — low risk, high value for debugging.
S05 collapses the reload dance — verify async runner before starting.
S06 last — it's the capstone. Once it's live, the whole API surface upgrades.

Each story is independently mergeable. No story depends on the previous ones being done.
S06 makes S01–S05 partially redundant in the long run, but S01–S05 are worth shipping
regardless because they improve the synchronous surface that most agents use today.

---

## Definition of done

- [ ] Each story has a passing `bun run typecheck` and `bun test`
- [ ] Each new endpoint / field documented in the endpoint catalogue in `control-api.ts`
- [ ] `validate-microapp.sh` updated to use `windowId` from response (post S03)
- [ ] `wibwob watch` subcommand ships with S06
- [ ] `reload-microapp.sh` reduced to thin wrapper (or deleted) post S05
