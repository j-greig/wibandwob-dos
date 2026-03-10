# 013 — Event System, Persistence & Multi-Instance

> Developer handover for the WibWob-DOS TypeScript rebuild.
> Covers the Turbo Vision event model, IPC socket lifecycle, multi-instance
> support, screenshot system, workspace save/load, debug logging,
> tmux-launch orchestration, and the TS spike's state/workspace services.

---

## 1. Turbo Vision Event Model

### 1.1 Event categories

Turbo Vision routes events through a tree of `TView` objects. Every event is a
`TEvent` struct with a `what` field indicating its category:

| Category | Constant | Routing | Purpose |
|----------|----------|---------|---------|
| Keyboard | `evKeyDown` | Focus chain (top → focused view) | Key presses |
| Mouse | `evMouse` (click/move/etc.) | Positional (view under cursor) | Clicks, drags |
| Command | `evCommand` | Broadcast to all views | Menu selections, hotkeys, API actions |
| Broadcast | `evBroadcast` | Broadcast to all views | Timer ticks, state notifications |

### 1.2 Command events (`evCommand`)

Used for discrete actions. Each command has a `ushort` ID:

```cpp
const ushort cmMicropolisAscii = 213;
const ushort cmScreenshot = 101;
const ushort cmSaveWorkspace = 110;
// ... ~80 more in wwdos_app.cpp
```

Commands flow through `handleEvent()`. The app's `handleEvent` has a massive
`switch` block (~500 lines) dispatching to spawn functions, toggles, etc.
A view calls `clearEvent(ev)` to consume the event and stop propagation.

### 1.3 Broadcast events (`evBroadcast`)

Used for ambient notifications that any view may react to:

- `cmTimerExpired` — fired by Turbo Vision's timer system. Views that call
  `setTimer(interval, repeat)` receive this with their `TTimerId` in
  `ev.message.infoPtr`. Used by Micropolis, animated views, terminal polling.
- `cmCheckTerminalUpdates` — custom broadcast sent from `idle()` so tvterm
  windows can poll their PTYs.

### 1.4 The idle loop

`TWwdosApp::idle()` is called by the Turbo Vision event loop whenever there
are no pending events. WibWob-DOS uses it for:

```cpp
void TWwdosApp::idle() {
    TApplication::idle();
    if (ipcServer) ipcServer->poll();     // Accept + handle IPC commands
    scrambleEngine.poll();                 // Poll async LLM responses
    message(this, evBroadcast,            // Trigger terminal refresh
            cmCheckTerminalUpdates, nullptr);
}
```

**Critical insight**: IPC commands are processed synchronously inside `idle()`.
The C++ TUI is single-threaded — `poll()` calls `accept()` (non-blocking),
reads the command, executes it (which may spawn windows, modify state), writes
the response, and closes the connection. All within one `idle()` cycle.

### 1.5 Implications for TS rebuild

The TS TUI should model events similarly:

| C++ concept | TS equivalent |
|-------------|---------------|
| `evCommand` | Custom event bus / command dispatcher |
| `evBroadcast` | EventEmitter or pub/sub |
| `evKeyDown` | Terminal raw key events (blessed/ink) |
| `idle()` | `setImmediate()` / event loop tick handler |
| `cmTimerExpired` | `setInterval()` per component |

**Recommendation**: Use a typed command registry (like the existing
`command_registry.cpp` pattern) rather than a giant switch block. The TS spike
can use a `Map<string, CommandHandler>`.

---

## 2. IPC Socket Lifecycle

### 2.1 Architecture

```
┌──────────────┐     Unix socket      ┌──────────────┐
│  API Server  │ ◄──────────────────► │  C++ TUI     │
│  (FastAPI)   │   /tmp/wibwob_*.sock │  (wwdos)     │
│  port 8089+  │                      │  idle→poll() │
└──────────────┘                      └──────────────┘
       ▲                                     ▲
       │ HTTP                                │ stdin/stdout
       ▼                                     ▼
   External clients                    Terminal (tmux)
```

The C++ app creates a Unix domain socket. The Python API server connects to
it, translating HTTP requests into IPC commands.

### 2.2 Socket path resolution

**C++ side** (`wwdos_app.cpp` constructor):

```cpp
std::string sockPath = "/tmp/wwdos.sock";           // default
const char* inst = std::getenv("WIBWOB_INSTANCE");
if (inst && inst[0] != '\0')
    sockPath = "/tmp/wibwob_" + std::string(inst) + ".sock";
```

**Python side** (`ipc_client.py::resolve_sock_path()`):

1. If `WIBWOB_INSTANCE` is set → `/tmp/wibwob_{instance}.sock`
2. Otherwise, auto-discover: glob `/tmp/wibwob_*.sock`, try connecting to each
3. Fallback: `/tmp/wwdos.sock`

The Python client caches the resolved path (`_SOCK_PATH_CACHE`) and
re-discovers on connection failure (`reset_sock_path()`).

### 2.3 Socket creation and stale cleanup

`ApiIpcServer::start(path)`:

1. **Check for existing socket file** via `stat()`
2. **Probe liveness** via `probe_socket_live()` — attempts a TCP `connect()`:
   - If connection succeeds → another instance is listening → **abort with error**
   - If connection fails → stale socket → `unlink()` and proceed
3. Create `AF_UNIX, SOCK_STREAM` socket
4. Set **non-blocking** (`O_NONBLOCK`)
5. `bind()` + `listen(backlog=4)`

```cpp
static bool probe_socket_live(const std::string& path) {
    int fd = ::socket(AF_UNIX, SOCK_STREAM, 0);
    struct sockaddr_un addr;
    addr.sun_family = AF_UNIX;
    snprintf(addr.sun_path, sizeof(addr.sun_path), "%s", path.c_str());
    bool live = (::connect(fd, ...) == 0);
    ::close(fd);
    return live;
}
```

### 2.4 Authentication

If `WIBWOB_AUTH_SECRET` is set, the IPC server performs HMAC-SHA256
challenge-response authentication on each connection:

1. Server sends `{"type":"challenge","nonce":"<hex>"}\n`
2. Client responds with `{"hmac":"<hex>"}\n` (HMAC-SHA256 of nonce using shared secret)
3. Server verifies HMAC, checks nonce replay (keeps last 1000), sends `{"type":"auth_ok"}\n`

Uses CommonCrypto on macOS, OpenSSL on Linux.

### 2.5 Command protocol

Single-line text protocol:

```
cmd:<name> key1=value1 key2=value2\n
```

Values are percent-encoded (`%20` for space, `%0A` for newline). The `content`
parameter supports `base64:` prefix for binary/multiline content.

Response is a single line: `ok\n`, `err <message>\n`, or JSON + `\n`.

**Important**: each command is a separate connection (connect → send → recv →
close). There is no persistent connection for commands. This is simple but
means every API call has socket setup overhead.

### 2.6 Event subscription

The `subscribe_events` command is special: the connection stays open and the
server pushes newline-delimited JSON events:

```json
{"type":"event","seq":1,"event":"state_changed","payload":{"id":"w3"}}
```

Subscribers are tracked in `event_subscribers_` (vector of fds). Dead
subscribers are detected on write failure and pruned. All subscriber writes
are non-blocking to avoid stalling the TUI event loop.

### 2.7 Connection status indicator

The status bar shows API status:
- **API ON** (green) — command received within last 10 seconds
- **API IDLE** (grey) — socket listening but no recent commands
- **API OFF** (red) — socket not listening

---

## 3. Multi-Instance Support

### 3.1 WIBWOB_INSTANCE environment variable

Multiple WibWob-DOS instances can run concurrently by setting different
`WIBWOB_INSTANCE` values:

```bash
WIBWOB_INSTANCE=room1 ./build/app/wwdos 2>/tmp/wibwob_debug_room1.log
WIBWOB_INSTANCE=room2 ./build/app/wwdos 2>/tmp/wibwob_debug_room2.log
```

Each gets its own socket: `/tmp/wibwob_room1.sock`, `/tmp/wibwob_room2.sock`.

### 3.2 Auto-discovery

The Python `ipc_client.py` can find running instances without knowing the
instance name:

```python
candidates = glob.glob("/tmp/wibwob_*.sock")
for sock in candidates:
    s = socket.socket(AF_UNIX, SOCK_STREAM)
    s.connect(sock)  # probe liveness
    return sock       # first live one wins
```

### 3.3 Port assignment

The API server port defaults to 8090 but is configurable via `WIBWOB_PORT`:

```bash
WIBWOB_PORT=8091 ./scripts/tmux-launch.sh room2
```

### 3.4 Collision prevention

If two instances try to use the same socket path, the second one detects the
first via `probe_socket_live()` and refuses to start:

```
[ipc] ERROR: socket /tmp/wibwob_foo.sock is already in use by another instance.
Set WIBWOB_INSTANCE to a unique value or stop the other instance.
```

---

## 4. Screenshot System

### 4.1 Architecture

Screenshots capture the **Turbo Vision screen buffer** directly — not a
terminal screenshot. This gives pixel-perfect cell-level output.

`frame_capture.cpp` provides:

| Class | Role |
|-------|------|
| `CapturedFrame` | Grid of `TScreenCell` values (char + attribute per cell) |
| `FrameCapture` | Capture + export engine (singleton via `getFrameCapture()`) |

### 4.2 Capture methods

```cpp
CapturedFrame captureScreen();              // Full screen buffer
CapturedFrame captureView(TView* view);     // Specific view's bounds
CapturedFrame captureRegion(x, y, w, h);    // Arbitrary rectangle
```

All read directly from `TScreen::screenBuffer` — the raw cell array that
Turbo Vision maintains.

### 4.3 Export formats

| Format | Use case |
|--------|----------|
| `PlainText` | Default — character grid with optional metadata header |
| `AnsiEscapes` | ANSI colour codes (currently disabled by default) |
| `Html` | Standalone HTML with inline CSS |
| `Json` | Cell-level data with optional colour/position info |
| `Clipboard` | Plain text without timestamps |

### 4.4 Screenshot command

`TWwdosApp::takeScreenshot(bool showDialog)`:

1. Creates `logs/screenshots/` directory
2. Generates timestamped filename: `tui_YYYYMMDD_HHMMSS.txt`
3. Captures screen buffer → `CapturedFrame`
4. Exports as plain text (ANSI export disabled — "nobody uses it")
5. Optionally shows a modal confirmation dialog

API usage: `cmd:screenshot` (calls `takeScreenshot(false)` — no dialog).

### 4.5 Corruption analysis

`FrameCapture` includes heuristic corruption detection:
- Cells with control characters (< 32, not space/tab/newline) are "corrupted"
- `corruptionIntensity` = ratio of corrupted cells to total
- Pattern identification: "None", "Light Scatter", "Moderate Corruption",
  "Heavy Distortion"

This was designed for the glitch engine feature — capturing intentionally
corrupted frames for artistic export.

---

## 5. Workspace Save/Load

### 5.1 Format

Workspaces are JSON files in `workspaces/`:

```json
{
  "version": 1,
  "app": "test_pattern",
  "timestamp": "2026-02-28T18:30:00",
  "screen": { "width": 200, "height": 55 },
  "globals": { "patternMode": "continuous" },
  "desktop": {
    "char": "░",
    "fg": 7,
    "bg": 0,
    "gallery": false,
    "preset": "classic"
  },
  "windows": [
    {
      "type": "room_chat",
      "title": "Chat",
      "bounds": { "x": 2, "y": 1, "w": 50, "h": 15 },
      "zoomed": false,
      "anchor": "right",
      "props": { ... }
    }
  ]
}
```

### 5.2 Save flow

`buildWorkspaceJson()`:
1. Records screen size, timestamp, pattern mode
2. Serializes desktop background state (texture char, colours, preset, gallery mode)
3. Iterates all windows on desktop (z-order traversal via `deskTop->first()` circular list)
4. For each window: type name (from `window_type_registry`), title, bounds, zoomed state
5. Window-type-specific props (gradient type, animation path, etc.)

Save locations:
- **Quick save** (F6 / API): `workspaces/last_workspace.json` + timestamped snapshot
- **Save As**: user-named file in `workspaces/`
- Both use atomic write (write to `.tmp`, then `rename`)

### 5.3 Load flow

`loadWorkspaceFromFile(path)`:
1. Reads entire file, validates presence of `"version"` and `"windows"` keys
2. Extracts `globals.patternMode`
3. Extracts `desktop` state (preset, char, fg, bg, gallery)
4. **Closes all existing windows** (`closeAll(false)` — including session windows)
5. Parses window array — extracts type, title, bounds, props for each
6. Applies **anchor logic**: `"right"` anchor makes `x` relative to right edge;
   `"bottom"` makes `y` relative to bottom edge (responsive layout)
7. Clamps bounds to current desktop size (minimum 16×6)
8. Spawns each window via its registered factory

### 5.4 Workspace management

- `openWorkspace()` — file dialog rooted at `workspaces/*.json`
- `saveWorkspaceAs()` — input dialog, sanitizes name, confirms overwrite
- `manageWorkspaces()` — UI for browsing/deleting workspaces
- Recent workspaces — scans `workspaces/` by mtime, shows last 5 in menu
- `WIBWOB_LAYOUT_PATH` env var — auto-restores a workspace on startup (for room deployment)

### 5.5 Import/export via API

Two additional IPC commands handle state snapshots:

- `export_state path=<file>` — calls `saveWorkspacePath()`
- `import_state path=<file>` — loads file, validates shape, applies with
  compatibility normalization (`"rect"` → `"bounds"` key rename for legacy
  snapshots)

---

## 6. Debug Logging

### 6.1 Convention

All C++ stderr output follows the pattern `[tag] message`:

```
[wibwob] IPC socket: /tmp/wibwob_room1.sock
[ipc] Auth OK for connection
[ipc] exec_command name=screenshot
[workspace] open path=workspaces/demo.json ok=true
```

### 6.2 Log capture

The `tmux-launch.sh` script redirects stderr to a debug log:

```bash
WIBWOB_INSTANCE=${INSTANCE} ./build/app/wwdos 2>/tmp/wibwob_debug_${INSTANCE}.log
```

This captures all `fprintf(stderr, ...)` output including IPC commands, auth
results, workspace operations, and error messages.

The API server logs separately:

```bash
tools/api_server/venv/bin/uvicorn ... &>/tmp/api_${INSTANCE}.log
```

### 6.3 Python IPC client logging

`ipc_client.py` prints structured logs to stdout:

```
[IPC] → create_window(type=micropolis_ascii)
[IPC] ✓ create_window → id=w7
[IPC] Socket closed
```

Includes param summaries (truncated content, basename-only paths) and
success/error indicators.

---

## 7. tmux-launch.sh — Clean Startup Orchestration

### 7.1 Script flow

```bash
#!/bin/bash
SESSION="${1:-wibwob}"
INSTANCE="${SESSION}"
SOCK="/tmp/wibwob_${INSTANCE}.sock"
PORT="${WIBWOB_PORT:-8090}"
```

1. **Cleanup**: kills any existing uvicorn on the target port, kills the tmux
   session, removes the stale socket file
2. **Launch TUI**: creates a new tmux session (200×55), sends the
   `./build/app/wwdos` command with `WIBWOB_INSTANCE` and stderr redirect
3. **Wait for socket**: polls for up to 15 seconds until the socket file
   appears
4. **Launch API**: starts uvicorn in background, waits 3 seconds, probes
   `/state` endpoint for health check

### 7.2 Usage

```bash
./scripts/tmux-launch.sh          # default: session "wibwob", port 8090
./scripts/tmux-launch.sh room2    # session "room2", port 8090
WIBWOB_PORT=8091 ./scripts/tmux-launch.sh room2  # custom port
```

Attach with: `tmux attach -t wibwob`

---

## 8. TS Spike Services

### 8.1 StateService (`state-service.ts`)

The TS spike already has a state service that mirrors the C++ `api_get_state()`
command but runs in-process:

**Design**:
- Constructor takes `StateServiceOptions` (appName, mode, cwd, statePath)
  and `StateDependencies` (callbacks to get screen size, windows, focus)
- `buildState()` assembles a `DesktopState` snapshot including:
  - App metadata (name, mode, cwd, control API status)
  - Screen dimensions and open window count
  - Focus state (window ID, title, kind)
  - Menu state (open/closed, label)
  - Per-window details (id, kind, bounds, zIndex, focused, filePath, app-specific details)
- `sync()` rebuilds state without persisting
- `persistAndNotify()` rebuilds, writes to disk (JSON), and notifies listeners
- Listeners subscribe via `subscribe()` → returns unsubscribe function

**Key difference from C++**: the C++ `get_state` command serializes state on
demand (pull model). The TS service supports both pull (`getState()`) and push
(`subscribe()`) models. The push model is better for reactive UIs.

### 8.2 WorkspaceService (`workspace-service.ts`)

Simple workspace persistence:

- `save(snapshots: WindowSnapshot[])` — writes JSON to `{workspaceDir}/{name}.json`
- `load()` → `WindowSnapshot[]` — reads and parses
- `list()` → `string[]` — lists available workspace names
- `exists()` → boolean
- `setCurrentWorkspaceName(name)` — sanitizes (lowercase, alphanumeric + `-._`)

**Key differences from C++**:
1. The C++ version serializes the full desktop state (globals, desktop texture,
   window z-order, per-window props). The TS version only serializes window
   snapshots — it needs desktop state, globals, and anchor logic added.
2. The C++ version has atomic write (tmp + rename). The TS version uses direct
   `writeFileSync` — should add atomic write for crash safety.
3. No timestamped snapshots in the TS version yet.
4. No anchor/responsive layout logic in the TS version.

---

## 9. TS Rebuild Recommendations

### 9.1 Event system

| Recommendation | Rationale |
|----------------|-----------|
| Use a typed `CommandBus` with `Map<string, Handler>` | Avoids the giant switch block; enables plugin-style registration |
| Separate command events from broadcast events | Commands are directed; broadcasts are ambient. Different dispatch. |
| Timer events via framework-native intervals | Don't reinvent Turbo Vision's timer queue |
| IPC → event bridge should be async | C++ processes IPC synchronously in `idle()`. TS should use async handlers to avoid blocking the render loop. |

### 9.2 IPC / Control API

| Recommendation | Rationale |
|----------------|-----------|
| Use HTTP or WebSocket instead of Unix sockets | TS ecosystem has better HTTP tooling; WebSocket gives native pub/sub for event subscription |
| Keep the text protocol as a compatibility layer | If you need to talk to the Python API server unchanged |
| Add request IDs for correlation | The C++ protocol has no request IDs — each connection is one request. WebSocket would need them. |
| Move auth to HTTP headers (Bearer token) | Simpler than challenge-response per connection |

### 9.3 Persistence

| Recommendation | Rationale |
|----------------|-----------|
| Extend `WorkspaceService` with desktop state | Match the C++ version's full-desktop serialization |
| Add atomic writes | `writeFileSync` to `.tmp` then `renameSync` |
| Add anchor/responsive layout | The `"anchor": "right"` system in C++ enables responsive workspace layouts across different terminal sizes |
| Add timestamped snapshots | One-liner: write to `{name}_{YYMMDD_HHMM}.json` alongside the primary file |
| Merge `StateService` and `WorkspaceService` | They serve related but distinct purposes. State = runtime introspection. Workspace = persistence. Keep separate but share types. |

### 9.4 Multi-instance

| Recommendation | Rationale |
|----------------|-----------|
| Support `WIBWOB_INSTANCE` env var from day 1 | Same convention for backward compat with existing scripts |
| Use port-based discovery instead of socket probing | Each instance gets a unique HTTP port; discovery via port scanning or a registry file |
| Write a PID file alongside the socket/port | Enables robust stale-instance detection |

### 9.5 Screenshots

| Recommendation | Rationale |
|----------------|-----------|
| Capture the terminal screen buffer directly | blessed/ink expose the screen buffer; don't shell out to `tmux capture-pane` |
| Keep plain text as the primary format | It's the most useful for AI agents and debugging |
| Drop ANSI export (already disabled in C++) | Nobody uses it |
| Add JSON export for programmatic consumption | Cell-level data for diffing, testing, visual regression |

### 9.6 Debug logging

| Recommendation | Rationale |
|----------------|-----------|
| Use a structured logger (e.g. `pino`) | Better than `console.error` for structured `[tag] message` output |
| Write to `/tmp/wibwob_debug_{instance}.log` | Match existing convention for tooling compatibility |
| Add log levels (debug/info/warn/error) | The C++ code has no levels — everything goes to stderr. TS can do better. |

---

## 10. Key Patterns for the TS Developer

1. **Single-threaded event loop** — the C++ app is single-threaded. IPC,
   rendering, simulation, and input all share one thread via the `idle()` →
   `poll()` pattern. In TS, use `async/await` but be aware that long-running
   handlers will block the render loop.

2. **Window registration** — every window gets a stable string ID (`w1`, `w2`,
   ...) assigned by `registerWindow()`. IDs are never reused within a session.
   The TS version should maintain the same guarantee.

3. **State-changed events** — `registerWindow()` publishes a `state_changed`
   event to all subscribers. This is the primary mechanism for external tools
   (API server, AI agents) to detect desktop changes.

4. **closeAll preserves session** — by default, `closeAll()` keeps chat and
   terminal windows alive so the AI agent doesn't lose its communication
   channel. The TS version should have the same concept of "session-critical"
   windows that survive workspace switches.

5. **Atomic workspace writes** — write to `.tmp`, then `rename()`. This
   prevents partial writes from corrupting the workspace file if the process
   crashes mid-write.

6. **Probe before bind** — always check if a socket/port is already in use
   before claiming it. The C++ `probe_socket_live()` pattern prevents
   accidental instance collisions.
