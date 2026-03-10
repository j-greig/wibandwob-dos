---
subsystem: state-and-api
covers: StateService, DesktopState, control API (port 8099), agent tools (tui_*)
files:
  - src/services/state-service.ts
  - src/services/control-api.ts
  - src/services/agent-tools.ts
  - src/core/types.ts (DesktopState, DesktopWindowState, WindowStateDetails)
triggers:
  pre-change: field names in DesktopState/DesktopWindowState, describeState() contract, API endpoints
  post-change: GET /state fields match, /health responds, tui_get_state returns correct shape
---

## Overview

StateService holds a cached DesktopState snapshot rebuilt on sync(). The HTTP control API
(port 8099) exposes this state plus command execution and window operations. Agent tools
(tui_*) wrap the API surface for the in-process Wib&Wob agent. Field name correctness
is critical — agents get wrong data silently when field names drift between code and docs.

## Key Files

- src/services/state-service.ts — cache, sync(), persistAndNotify(), subscriber model
- src/services/control-api.ts:70 — ENDPOINT_CATALOGUE (authoritative list of all endpoints)
- src/services/agent-tools.ts — tui_* tool definitions and implementations
- src/core/types.ts:185 — DesktopWindowState; :165 — WindowStateDetails; :192 — DesktopState

## State Shape

DesktopState (types.ts:192) — returned by GET /state and tui_get_state:

  timestamp: string (ISO)
  app:
    name: string
    mode: string
    cwd: string
    statePath: string
    instanceLabel?: string
    sessionId?: string
    theme?: string
    controlApiEnabled?: boolean
    controlApiPort?: number
  screen:
    width: number
    height: number
    cellAspect: number
    openWindowCount: number
  focus:
    windowId?: number
    title?: string
    kind?: WindowKind
  menu:
    open: boolean
    label?: string
  windows: DesktopWindowState[]

DesktopWindowState (types.ts:175) — one entry per open window:

  id: number           — use this for all window operations (move, resize, close, focus)
  kind: WindowKind     — "editor"|"primer"|"browser"|"microapp"|etc
  appType: AppType     — more specific than kind (e.g. "text-editor" vs kind "editor")
  title: string
  left: number         — NOT "x" — it is "left"
  top: number          — NOT "y" — it is "top"
  width: number|null
  height: number|null
  zIndex: number       — higher = in front
  focused: boolean
  maximized: boolean
  filePath?: string    — only file-backed windows
  details: WindowStateDetails  — window-specific extras from describeState()

CRITICAL field names agents get wrong:
  CORRECT: left, top, width, height
  WRONG:   x, y, w, h  (these do not exist)

## Control API Endpoints

Base URL: http://127.0.0.1:8099 (or CONTROL_API_PORT env)

  GET  /health          → { ok: true, port, sessionId, instanceLabel? }
  GET  /state           → DesktopState (full live snapshot)
  GET  /commands/list   → CommandListItem[] (optional ?surface=menu|palette|api|agent)
  POST /commands/run    → { ok, result?, error? }
                          body: { id: string, args?: object }
  GET  /help            → endpoint catalogue (human+agent readable)
  GET  /openapi.json    → OpenAPI 3.0 spec
  POST /windows/batch   → batch move/resize/focus; prefer over chained individual calls
  GET  /windows/text    → raw window text content; ?id=N
  GET  /screenshot/text → ANSI-stripped text; ?id=N

Scramble endpoints:
  GET  /scramble/state  → { status, model, sleeping, lastMessage, messageCount }
  POST /scramble/say    → { text: string } → reply
  POST /scramble/pet, /scramble/sleep, /scramble/wake, /scramble/meow

Full catalogue: src/services/control-api.ts:70

Always GET /health before any other call to confirm the app is ready.
Always GET /state to get real window IDs before targeting windows.

## describeState() Contract

Every registered window SHOULD implement describeState() returning WindowStateDetails:

  {
    appType: AppType,       // REQUIRED — workspace restore uses this
    summary?: string,       // short human-readable status line
    contentPreview?: string,
    lineCount?: number,
    [key: string]: unknown  // window-specific extras
  }

Windows without describeState() log a warning at registration and produce degraded
state (no appType in GET /state details). This breaks workspace restore for that window.

## Agent Tools (tui_*)

Available inside the Wib&Wob agent session. Source: src/services/agent-tools.ts.

  tui_get_state         — returns full DesktopState; always call first to get real window IDs
  tui_list_commands     — returns all commands with id, label, description, args
  tui_menu_command      — { command: string, args?: object } — executes a command by id
  tui_run_command       — alias for tui_menu_command (legacy name)
  tui_open_window       — { type: AppType } — open a window by appType
  tui_close_window      — { id: number }
  tui_focus_window      — { id: number }
  tui_move_window       — { id: number, left: number, top: number, width?: number, height?: number }
  tui_send_input        — { id: number, text: string } — send text to a window's input
  tui_read_window       — { id: number } — read window text content
  tui_screenshot        — captures text screenshot

Pattern for agents: tui_get_state → read window IDs → tui_menu_command or tui_move_window.
Never guess window IDs. Never call tui_list_commands with assumed command names.

## Invariants

1. GET /state IDs are session-local. Always re-fetch after any window open/close.
2. StateService.sync() must be called after state-visible mutations — state does NOT
   auto-invalidate. Windows that mutate their own display must call onStateChanged().
3. persistAndNotify() is heavier than sync() — only call for workspace-level events
   (save, load, theme change), not on every keypress.
4. describeState() is called synchronously by StateService.buildState() — it must be fast.
5. The state cache is NOT thread-safe — all mutations happen on the single Bun event loop.
6. GET /health must return ok:true before any other endpoint is reliable.

## Failure Modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| GET /state shows stale window data | sync() not called after mutation | Call stateService.sync() or wire onStateChanged callback |
| Window missing from /state | registerWindow() not called or window closed | GET /state first; re-open if needed |
| POST /commands/run returns {ok:false} | Wrong command id, missing required args | GET /commands/list first; check exact id and arg names |
| tui_move_window has no effect | Used "x"/"y" instead of "left"/"top" | Field names are left, top, width, height |
| Wrong window targeted | Cached/guessed window ID | Always GET /state for fresh IDs before targeting |
| /health returns connection refused | App not running or wrong port | Check CONTROL_API_PORT; run curl /health; restart if needed |
| width/height null in /state | Window created without explicit size | Normal for auto-sized windows; use frame dimensions from blessed directly if needed |

## Do / Don't

DO: GET /health first, then GET /state, then act on real IDs
DON'T: hardcode or guess window IDs across sessions

DO: use left/top/width/height in all API calls and state reads
DON'T: use x/y/w/h — they do not exist in DesktopWindowState

DO: call POST /windows/batch for multi-window layout changes
DON'T: chain individual move calls — batch is atomic and cheaper

DO: check command id with GET /commands/list before POST /commands/run
DON'T: assume command ids — they change; catalog is source of truth

DO: call stateService.sync() after window mutations in app-controller
DON'T: rely on state auto-updating — it is cache-based

DO: check /scramble/state before sending to Scramble (may be sleeping/offline)
DON'T: send Scramble messages and assume they land — check status first

## Agent Verification Patterns (from agentic-devlog 2026-03-08/09)

### /windows/input is NOT end-to-end proof

POST /windows/input injects logical input into a window record's writeInput hook.
It does NOT prove: blessed key focus, global key routing, or mouse behavior.
For real keyboard UX proof: use `tmux send-keys -t wibwob:0 "text" Enter`.
For API correctness proof: use /windows/input + GET /state.
NEVER claim UX is correct from /windows/input alone.

### Color changes cannot be proved by agent — use text

Agent pane captures (tmux capture-pane) return characters, not colors.
Color-only changes are invisible to agents. Always include text-visible
changes alongside any color change to verify: title, body text, or status line.

### describeState() should surface child content for rich microapps

For microapps with sub-panels, GET /state only shows the top-level window.
Content inside panels is invisible to agents without a bespoke inspect command.
Convention: implement a `<module>.panel.inspect` command returning per-panel
{ contentLines, nonEmptyLines, lpos, fixed, firstLine, lastLine }.
Better: include optional contentPreview per child in describeState() details.
Proposed pattern: `details.panels: [{ id, title, contentLines, nonEmptyLines }]`

### focusOrCreate swallows return values — use direct:true for query commands

module-loader.ts:261 — without `direct: true`, registerCommand wraps the action
in focusOrCreate() and discards the return value. Caller gets `{ok:true}` with no data.
ALL query/control commands on already-open windows must use `direct: true`:

  host.registerCommand({ id: "my.inspect", direct: true, action: () => { return data; } })

Without direct:true: action fires, return value discarded, API response is empty.
With direct:true: action fires directly, return value passed through to API caller.

### POST /windows/mouse — does not exist yet

There is no agent-facing API to synthesize mouse down/move/up inside a window.
Nested drag/resize CANNOT be robustly agent-tested. Workaround: route nested
drag/resize off `screen.on("mouse")` and use text-visible feedback to verify.
Wishlist: `POST /windows/mouse { id, action, x, y, button }` — not yet implemented.

## Change Checklist

When changing DesktopState or DesktopWindowState shape:
- [ ] Update types.ts
- [ ] Update StateService.buildState() to populate new fields
- [ ] Update openapi.json / help text if field is user-facing
- [ ] Check agent-tools.ts formatDesktopSummary for impacted summary text
- [ ] Verify GET /state returns correct new shape

When adding a control API endpoint:
- [ ] Add to ENDPOINT_CATALOGUE in control-api.ts:70
- [ ] Implement handler in the same file
- [ ] GET /help should list the new endpoint
- [ ] bun run typecheck passes

## Agent Notes
<!-- Append-only. Agents write here during sessions using their edit tool.
     Do not modify the spec body directly. Human consolidates into body quarterly.
     Format: one row per finding. Types: failure-mode | invariant | correction | gotcha | do-dont -->

| Date | Type | Subsystem | Finding | Triggered by |
|------|------|-----------|---------|--------------|
