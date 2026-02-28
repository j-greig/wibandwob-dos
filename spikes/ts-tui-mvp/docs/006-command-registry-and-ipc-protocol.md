# 006 — Command Registry & IPC Protocol

> Developer handover document for the WibWob-DOS TypeScript rebuild.
> Covers the full command inventory, IPC wire format, dispatch flow,
> MCP tool bridge, Python API server, and migration recommendations.

---

## 1. Architecture Overview

The current C++ system uses a three-layer architecture to expose TUI
commands to external consumers:

```
┌─────────────────────────────────────────────────────────┐
│  Claude MCP / Agent (mcp_tools.js)                      │
│  or any HTTP client                                     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (JSON)
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Python API Server (FastAPI, port 8089)                  │
│  main.py → controller.py → ipc_client.py                │
└──────────────────────┬──────────────────────────────────┘
                       │ Unix domain socket
                       │ line-delimited key:value protocol
                       ▼
┌─────────────────────────────────────────────────────────┐
│  C++ TUI App (Turbo Vision)                              │
│  api_ipc.cpp → command_registry.cpp → api_* functions   │
└─────────────────────────────────────────────────────────┘
```

This exists because the C++ TUI process owns the terminal and all UI
state. External processes can't call into it directly, so a Unix
domain socket provides the IPC bridge. The Python server adds HTTP/REST
semantics, Pydantic validation, and WebSocket events on top.

---

## 2. Full Command Inventory

The C++ command registry (`command_registry.cpp`) declares **86 commands**
via `get_command_capabilities()`. Each entry is a `CommandCapability`:

```cpp
struct CommandCapability {
    const char* name;        // e.g. "cascade"
    const char* description; // human-readable
    bool requires_path;      // legacy name — actually means "has_params"
};
```

### 2.1 Window Management (10 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `cascade` | — | Cascade all windows |
| `tile` | — | Tile all windows |
| `close_all` | — | Close all windows |
| `move_window` | `id`, `x`, `y` | Move window to position |
| `resize_window` | `id`, `w`, `h` or `id`, `aspect`, `w`/`h` | Resize; aspect ratios: `16:9`, `4:3`, `1:1`/`square`, `portrait`, `golden`, `A4`, any `W:H` |
| `focus_window` | `id` | Bring window to front and focus |
| `raise_window` | `id` | Bring to front of z-order |
| `lower_window` | `id` | Send to back of z-order |
| `close_window` | `id` | Close window by ID |
| `snap_window` | `id`, `zone` + optional `margin`, `cols`, `rows`, `col`, `row`, `colspan`, `rowspan` | Snap to named zone (`tl`, `tr`, `bl`, `br`, `left`, `right`, `top`, `bottom`, `full`, `center`) or grid cell |

### 2.2 Window Appearance (4 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `window_shadow` | `id`, `on` | Toggle drop shadow |
| `window_title` | `id`, `title` | Set/remove title bar text |
| `desktop_preset` | `preset` | Named desktop preset |
| `desktop_texture` | `char` | Set desktop fill character |

### 2.3 Desktop & Theme (7 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `desktop_color` | `fg`, `bg` (0–15) | Set desktop colours |
| `desktop_gallery` | `on` | Toggle gallery mode (hide menu/status) |
| `desktop_get` | — | Get desktop state JSON |
| `set_theme_mode` | `mode` (`light`/`dark`) | Theme mode |
| `set_theme_variant` | `variant` (`monochrome`/`dark_pastel`) | Theme variant |
| `reset_theme` | — | Reset to monochrome + light |
| `pattern_mode` | `mode` (`continuous`/`tiled`) | Pattern rendering mode |

### 2.4 Workspace & Screenshot (3 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `save_workspace` | — | Save current workspace |
| `open_workspace` | `path` | Open workspace file |
| `screenshot` | — | Capture screen to text snapshot |

### 2.5 Scramble (cat overlay) (4 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `open_scramble` | — | Toggle Scramble overlay |
| `scramble_expand` | — | Toggle smol/tall mode |
| `scramble_say` | `text` | Send message to Scramble chat |
| `scramble_pet` | — | Pet the cat |

### 2.6 Chat & Room (6 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `open_room_chat` | — | Open Room Chat window |
| `room_chat_receive` | `sender`, `text`, `ts?` | Deliver incoming message |
| `room_presence` | `participants` (JSON array) | Update participant list |
| `chat_receive` | `sender`, `text` | Display remote chat in Scramble |
| `open_wibwob` | — | Open Wib&Wob chat window |
| `wibwob_ask` | `text` | Send user message, trigger AI response |
| `get_chat_history` | — | Return chat history as JSON |

### 2.7 Generative Art Windows (17 commands)

| Command | Description |
|---------|-------------|
| `open_verse` | Verse Field generative poetry |
| `open_mycelium` | Organic growth simulation |
| `open_orbit` | Hypnotic geometry |
| `open_torus` | Spinning 3D shape |
| `open_cube` | Rotating 3D wireframe |
| `open_life` | Conway's Game of Life |
| `open_blocks` | Abstract pattern generator |
| `open_score` | Musical notation display |
| `open_ascii` | ASCII art display |
| `open_animated_gradient` | Animated colour gradient |
| `open_gradient` | Static gradient (optional `kind`) |
| `open_monster_cam` | Monster Camera |
| `open_monster_verse` | Eldritch poetry |
| `open_monster_portal` | Dimensional rift |
| `open_backrooms_tv` | Live streaming ASCII art (optional `theme`, `turns`, `primers`, `model`) |
| `open_contour_map` | Topographic map generator (optional `seed`, `terrain`, `levels`, `grow`, `triptych`) |
| `open_generative_lab` | Cellular automata playground |

### 2.8 Games (5 commands)

| Command | Description |
|---------|-------------|
| `open_micropolis_ascii` | Micropolis ASCII MVP |
| `open_quadra` | Falling blocks |
| `open_snake` | Snake game |
| `open_rogue` | Dungeon crawler |
| `open_deep_signal` | Space scanner |

### 2.9 Apps & Gallery (5 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `open_apps` | — | Application launcher browser |
| `open_gallery` | — | ASCII Art Gallery browser |
| `gallery_list` | `tab?`, `search?` | List primers with dimensions JSON |
| `open_primer` | `path` + optional `x`, `y`, `w`, `h`, `frameless`, `shadowless`, `title` | Open primer file |
| `primer_info` | `path` | Get content dimensions without opening |

### 2.10 Text & Figlet (7 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `open_figlet_text` | `text?`, `font?`, `x?`, `y?`, `shadow?` | Open FIGlet text window |
| `open_text_editor` | `title?` | Open text editor |
| `figlet_set_text` | `id`, `text` | Change figlet window text |
| `figlet_set_font` | `id`, `font` | Change figlet font |
| `figlet_set_color` | `id`, `fg?`, `bg?` (hex RGB) | Set figlet colours |
| `figlet_list_fonts` | — | List available font names |
| `list_figlet_fonts` | — | List fonts (JSON array) |

### 2.11 FIGlet Preview (1 command)

| Command | Params | Description |
|---------|--------|-------------|
| `preview_figlet` | `text`, `font?`, `width?`, `info?` | Render FIGlet text; with `info=true` returns JSON metadata |

### 2.12 Paint Canvas (10 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `new_paint_canvas` | — | Open new paint canvas |
| `paint_cell` | `id`, `x`, `y`, `fg?`, `bg?` | Set single cell |
| `paint_text` | `id`, `x`, `y`, `text`, `fg?`, `bg?` | Write text |
| `paint_line` | `id`, `x0`, `y0`, `x1`, `y1`, `erase?` | Draw line |
| `paint_rect` | `id`, `x0`, `y0`, `x1`, `y1`, `erase?` | Draw rectangle |
| `paint_clear` | `id` | Clear canvas |
| `paint_export` | `id` | Export as text |
| `paint_save` | `id`, `path` | Save to .wwp file |
| `paint_load` | `id`, `path` | Load from .wwp file |
| `open_paint_file` | `path` | Open paint window with file loaded |
| `paint_stamp_figlet` | `id`, `text`, `font?`, `x?`, `y?`, `fg?`, `bg?` | Stamp FIGlet onto canvas |

### 2.13 Terminal (3 commands)

| Command | Params | Description |
|---------|--------|-------------|
| `open_terminal` | — | Open terminal emulator |
| `terminal_write` | `text`, `window_id?` | Send text input |
| `terminal_read` | `window_id?` | Read visible content |

### 2.14 Browser (1 command)

| Command | Description |
|---------|-------------|
| `open_browser` | Open in-terminal web browser |

### 2.15 Internal (1 command)

| Command | Params | Description |
|---------|--------|-------------|
| `inject_command` | `cmd_id` | Inject raw Turbo Vision command event |

---

## 3. IPC Wire Format

### 3.1 Transport

- **Unix domain socket** at `/tmp/wibwob_{instance}.sock` (or `/tmp/wwdos.sock` fallback)
- **Stream socket** (`SOCK_STREAM`), not datagram
- **Non-blocking** listener on the C++ side; polled from the TUI event loop
- **One command per connection** — connect, send, receive, close
- Large responses use `SO_LINGER` + `SO_SNDBUF=65536` to avoid truncation

### 3.2 Authentication (optional)

When `WIBWOB_AUTH_SECRET` is set, the connection requires HMAC-SHA256
challenge-response before any commands are accepted:

```
Server → Client: {"type":"challenge","nonce":"<32-hex-chars>"}\n
Client → Server: {"type":"auth","hmac":"<64-hex-chars>"}\n
Server → Client: {"type":"auth_ok"}\n
```

The HMAC is computed as `HMAC-SHA256(secret, nonce)`. Nonces are
single-use (replay protection with a 1000-nonce LRU window).

### 3.3 Command Format

Commands are **single-line, space-delimited, key=value pairs**:

```
cmd:<command_name> key1=value1 key2=value2\n
```

Example:
```
cmd:exec_command name=move_window id=win-42 x=10 y=5\n
```

### 3.4 Value Encoding

All values are **strings**. Special characters are handled two ways:

1. **Percent-encoding** for spaces, newlines, and special chars:
   - `%20` → space
   - `%0A` → newline
   - `%0D` → carriage return

2. **Base64 encoding** for multiline content (used by `send_text`):
   - Prefix the value with `base64:` marker
   - Example: `content=base64:SGVsbG8gV29ybGQ=`
   - The C++ side decodes both `base64:` prefix and standard percent-encoding

### 3.5 Response Format

Responses are newline-terminated strings:

| Response | Meaning |
|----------|---------|
| `ok\n` | Success, no data |
| `err <message>\n` | Failure with reason |
| `{...json...}\n` | JSON payload (state, capabilities, etc.) |

### 3.6 IPC Commands (in api_ipc.cpp)

The IPC server (`api_ipc.cpp`) handles **two layers** of commands:

1. **Direct commands** — handled inline in `poll()` with their own `cmd:` names:
   - `get_capabilities`, `get_window_types`, `get_state`, `get_canvas_size`
   - `create_window` (type-based, uses window_type_registry)
   - `cascade`, `tile`, `close_all`, `pattern_mode`, `save_workspace`, `open_workspace`
   - `screenshot`, `move_window`, `resize_window`, `focus_window`, `close_window`
   - `send_text`, `send_figlet`
   - `paint_cell`, `paint_text`, `paint_line`, `paint_rect`, `paint_clear`, `paint_export`
   - `gen_lab` (generative lab actions)
   - `export_state`, `import_state`
   - `room_chat_receive`, `room_presence`, `room_chat_pending`, `room_chat_display_name`
   - `browser_fetch`
   - `subscribe_events` (persistent connection for push events)

2. **Registry-dispatched commands** — via `cmd:exec_command name=<cmd_name> ...`:
   - Routes to `exec_registry_command()` which handles all 86 registered commands
   - This is the canonical path used by the Python API server

### 3.7 Event Subscription

The `subscribe_events` command keeps the connection open for push events:

```
Client → Server: cmd:subscribe_events\n
Server → Client: {"type":"subscribed"}\n
Server → Client: {"type":"event","seq":1,"event":"window.created","payload":{...}}\n
Server → Client: {"type":"event","seq":2,"event":"...","payload":{...}}\n
...
```

Dead subscribers are automatically pruned on write failure.

---

## 4. Command Registration Pattern

### 4.1 Static Registration

Commands are declared in a static vector (no dynamic registration):

```cpp
static const std::vector<CommandCapability> capabilities = {
    {"cascade", "Cascade all windows on desktop", false},
    {"move_window", "Move a window (id, x, y params)", true},
    // ...
};
```

The `requires_path` field (despite the misleading name) is actually a
`has_params` boolean. Commands with `false` take no arguments; commands
with `true` need one or more key=value parameters.

### 4.2 Dispatch

`exec_registry_command()` is a **linear if-else chain** — no dispatch
table, no hash map. Each command name is string-compared sequentially:

```cpp
std::string exec_registry_command(
    TWwdosApp& app,
    const std::string& name,
    const std::map<std::string, std::string>& kv)
{
    if (name == "cascade") { api_cascade(app); return "ok"; }
    if (name == "tile") { api_tile(app); return "ok"; }
    // ... 84 more if-blocks ...
    return "err unknown command";
}
```

Each block:
1. Extracts params from the `kv` map via `kv.find()`
2. Validates required params (returns `"err missing ..."`)
3. Calls the corresponding `api_*` function
4. Returns `"ok"` or a JSON string result

---

## 5. Full Dispatch Flow

### 5.1 HTTP → IPC → C++ → Response → HTTP

```
Agent calls:  POST /menu/command {"command": "move_window", "args": {"id": "w1", "x": "10", "y": "5"}}
       │
       ▼
FastAPI route (main.py: menu_command)
       │ validates via Pydantic (MenuCommand schema)
       ▼
Controller.exec_command(name, args) (controller.py)
       │ builds IPC params: {"name": "move_window", "id": "w1", "x": "10", "y": "5"}
       ▼
ipc_client.send_cmd("exec_command", params)
       │ formats: "cmd:exec_command name=move_window id=w1 x=10 y=5\n"
       │ connects to Unix socket
       │ sends line, reads response
       ▼
api_ipc.cpp: poll()
       │ parses "cmd:exec_command" → extracts name + kv map
       │ calls exec_registry_command(app, "move_window", {"id":"w1","x":"10","y":"5"})
       ▼
command_registry.cpp: exec_registry_command()
       │ matches "move_window" → calls api_move_window(app, "w1", 10, 5)
       │ returns "ok" or JSON result
       ▼
Response flows back through: IPC socket → ipc_client → controller → FastAPI → HTTP JSON
```

### 5.2 create_window — Separate Path

The `create_window` IPC command uses a **separate dispatch** via `window_type_registry`:

```
cmd:create_window type=gradient x=0 y=0 w=40 h=12
  → find_window_type_by_name("gradient")
  → spec->spawn(app, kv)
  → returns {"success":true,"id":"win-42"}
```

This is a parallel registry to command_registry, specific to spawning
typed windows with bounds. The Python controller uses `create_window`
for the `POST /windows` endpoint.

---

## 6. Error Handling Patterns

### 6.1 C++ Side

- **Missing params**: `return "err missing id"` / `"err missing path"`
- **Not found**: `return "err paint window not found"` / `"err file not found: <path>"`
- **Unknown command**: `return "err unknown command"` (registry) / `"err unknown cmd"` (IPC)
- **Invalid values**: `return "err invalid aspect '<value>' — use ..."`

All error strings start with `"err "` — this is the detection convention.

### 6.2 Python Side

```python
# ipc_client.py — returns None on connection failure
if resp and resp.lower().startswith("err"):
    handled["ok"] = False
    handled["error"] = resp

# controller.py — wraps results
return {"ok": True, "result": resp}  # success
return {"ok": False, "error": resp}  # failure

# main.py — converts to HTTP errors
if not res.get("ok"):
    raise HTTPException(status_code=400, detail=res.get("error"))
```

### 6.3 IPC Connection Failures

- `ipc_client.py` returns `None` on `ConnectionRefusedError` or `FileNotFoundError`
- Auto-rediscovery: `reset_sock_path()` clears cached path on failure
- 5-second socket timeout prevents hangs
- Controller falls back to local state if IPC is unavailable

---

## 7. MCP Tool Bridge

### 7.1 Philosophy: Two Tools, Total Coverage

`mcp_tools.js` wraps the entire command registry into exactly **2 MCP tools**
(plus 2 helper tools):

| MCP Tool | Maps to | Purpose |
|----------|---------|---------|
| `tui_list_commands` | `GET /commands` | Discover all available commands |
| `tui_menu_command` | `POST /menu/command` | Execute any command by name |
| `tui_get_state` | `GET /state` | Get current desktop state |
| `tui_batch_layout` | `POST /windows/batch_layout` | Batch window operations |

The key insight: **new C++ commands are instantly available via MCP**
without touching `mcp_tools.js`. The agent calls `tui_list_commands`
first to discover what's available, then executes by name.

### 7.2 Implementation

```javascript
// mcp_tools.js uses the Claude Agent SDK
const { createSdkMcpServer, tool } = require('@anthropic-ai/claude-agent-sdk');

// All args are coerced to strings (matching C++ expectation)
args: z.record(z.union([z.string(), z.number()]).transform(v => String(v)))
```

The MCP server talks to the Python API server via HTTP (`http://127.0.0.1:8089`),
not directly to the C++ socket. This gives it validation, state sync,
and WebSocket events for free.

---

## 8. Python API Server Architecture

### 8.1 Layer Breakdown

| File | Role |
|------|------|
| `main.py` | FastAPI app, route definitions, Pydantic validation, HTTP ↔ controller glue |
| `controller.py` | Business logic, IPC orchestration, state sync, event emission |
| `ipc_client.py` | Low-level Unix socket client, command formatting, base64/percent encoding |
| `schemas.py` | Pydantic models for all request/response shapes |
| `models.py` | Internal domain models (`AppState`, `Window`, `Rect`, `WindowType` enum) |
| `events.py` | WebSocket event hub for real-time state push |

### 8.2 Key Patterns

**State sync**: Controller maintains a local `AppState` mirror. On every
query, it calls `send_cmd("get_state")` to sync with C++. This is the
"source of truth is C++, Python is a cache" pattern.

**Dual registries**: Both commands and window types come from C++ via IPC
(`get_capabilities` and `get_window_types`). Python never maintains its
own authoritative list — the C++ registries are canonical.

**Actor tracking**: Commands carry an `actor` field (`"api"`, `"mcp"`,
`"gallery_arrange"`) for audit logging to NDJSON.

**Event emission**: After every state mutation, the controller emits
events via `EventHub` to connected WebSocket clients.

### 8.3 Notable Endpoints Beyond Menu/Command

| Endpoint | Purpose |
|----------|---------|
| `POST /windows` | Typed window creation with Pydantic-validated type literals |
| `POST /windows/batch_layout` | Batch create/move/close with grid macros |
| `POST /gallery/arrange` | Layout algorithm engine (masonry, packery, poetry, cluster, stamp) |
| `POST /browser/open` | Full browser pipeline (fetch → readability → markdown → TUI text) |
| `POST /monodraw/load` | Monodraw JSON import |
| `GET /primers/list` | Primer file discovery across module directories |
| `WS /ws` | Real-time state events |

### 8.4 WindowType Enum Parity

The `WindowCreate` schema uses a `Literal` type that must stay in sync
with `window_type_registry.cpp`. This is enforced by
`tests/contract/test_window_type_parity.py`.

---

## 9. TS Spike's control-api.ts — Comparison

The TypeScript spike (`spikes/ts-tui-mvp/src/services/control-api.ts`)
takes a radically simpler approach:

### 9.1 Architecture

- **No IPC** — direct function calls within the same process
- **No Unix socket** — uses Bun's built-in HTTP server
- **Handler-based** — constructor takes a `ControlApiHandlers` interface
- **Minimal surface** — ~10 endpoints vs ~50+ in the Python server

### 9.2 Current Endpoints

| Endpoint | Method |
|----------|--------|
| `/health` | GET |
| `/state` | GET |
| `/content/primer-info` | GET |
| `/windows/focus` | POST |
| `/windows/move` | POST |
| `/windows/resize` | POST |
| `/windows/close` | POST |
| `/view/backrooms/open` | POST |
| `/workspace/save` | POST |
| `/workspace/load` | POST |

### 9.3 Key Differences from C++ System

| Aspect | C++ + Python | TS Spike |
|--------|-------------|----------|
| IPC mechanism | Unix socket | None (in-process) |
| Serialization | Text k=v protocol | JSON (Bun.serve) |
| Command discovery | `get_capabilities` | Hardcoded routes |
| Auth | HMAC-SHA256 challenge | None |
| Event push | Socket subscription + WebSocket | None yet |
| State sync | Poll-based (IPC round-trip) | Direct handler call |
| Command count | 86+ registry commands | ~10 routes |

### 9.4 Gap Analysis

The TS spike is missing:
- Command registry pattern (discover + execute by name)
- ~75 commands (paint, figlet, generative art, games, etc.)
- Event subscription/push
- Batch layout operations
- Gallery arrangement engine
- Browser pipeline
- Authentication

---

## 10. Recommendations for the TS Rebuild

### 10.1 Eliminate IPC — Use Direct Function Calls

**Strong recommendation: Replace Unix socket IPC with direct in-process calls.**

The IPC layer exists solely because C++ and Python are separate processes.
In a TypeScript monolith, the TUI app and API server share a process.
The TS spike already demonstrates this with `ControlApiHandlers`.

**Benefits:**
- No serialization/deserialization overhead
- No socket lifecycle management
- No encoding hacks (base64, percent-encoding)
- Type-safe at compile time
- No connection failure modes
- Simpler debugging (no two-process coordination)

**Risk:** Tight coupling between API and TUI. Mitigate by keeping the
handler interface as an abstraction boundary.

### 10.2 Keep the Command Registry Pattern

Even without IPC, the **command registry** concept is valuable:

```typescript
// Recommended: typed command registry
interface CommandDef {
  name: string;
  description: string;
  params: z.ZodSchema;  // Zod schema for validation
  execute: (app: App, args: Record<string, string>) => CommandResult;
}

const registry = new Map<string, CommandDef>();

// Registration
registry.set("cascade", {
  name: "cascade",
  description: "Cascade all windows on desktop",
  params: z.object({}),
  execute: (app) => { app.cascade(); return { ok: true }; }
});

// Discovery endpoint (for MCP/agents)
app.get("/commands", () => Array.from(registry.values()).map(summarize));

// Universal execute endpoint
app.post("/menu/command", ({ command, args }) => {
  const cmd = registry.get(command);
  if (!cmd) throw new Error("unknown command");
  return cmd.execute(app, args);
});
```

This preserves the **"two MCP tools cover everything"** pattern which is
genuinely elegant. New commands are instantly available to agents.

### 10.3 Replace Linear Dispatch with a Map

The C++ system's 86-deep if-else chain should become a `Map<string, Handler>`:

```typescript
// Instead of:  if (name === "cascade") { ... } else if (name === "tile") { ... }
// Use:
const handlers = new Map<string, CommandHandler>([
  ["cascade", cascadeHandler],
  ["tile", tileHandler],
  // ...
]);
```

### 10.4 Type All Values Properly

The C++ protocol sends **all values as strings** (`"10"` not `10`).
In TypeScript, use proper types at the handler interface and only
stringify at the HTTP boundary:

```typescript
// Handler interface uses real types:
moveWindow(id: string, x: number, y: number): void;

// HTTP layer parses:
const x = parseInt(body.x, 10);
```

### 10.5 Replace Base64/Percent-Encoding with JSON

The IPC encoding hacks exist because the wire format is line-delimited
`key=value`. With HTTP JSON, none of this is needed:

```json
{"command": "send_text", "args": {"id": "w1", "content": "Hello\nWorld"}}
```

### 10.6 Preserve the Event System

The C++ event subscription model (`subscribe_events`) and Python
WebSocket hub should be carried forward. Consider:

```typescript
// Server-Sent Events (simpler than WebSocket for one-way push)
app.get("/events", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const unsub = eventBus.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  req.on("close", unsub);
});
```

### 10.7 Authentication

If the TS rebuild needs remote access (not just localhost), implement
auth at the HTTP layer with standard mechanisms (API key header, JWT)
rather than the custom HMAC challenge-response. The HMAC protocol was
designed for the raw socket case.

### 10.8 Migration Priority

For a phased migration, implement commands in this order:

1. **Phase 1 — Core**: `get_state`, window management (move, resize, focus, close, cascade, tile), `screenshot`
2. **Phase 2 — Content**: open_* commands for all window types, theme/desktop commands
3. **Phase 3 — Interaction**: paint canvas, terminal read/write, text editor, figlet
4. **Phase 4 — Advanced**: gallery arrange, batch layout, browser pipeline, Scramble/chat
5. **Phase 5 — Agent**: MCP tool bridge (can reuse `mcp_tools.js` almost unchanged if HTTP API is compatible)

### 10.9 API Compatibility

If backward compatibility with existing MCP tools / agents is desired,
keep the same HTTP endpoint shapes:

- `GET /state` — same response shape
- `GET /commands` — same command manifest format
- `POST /menu/command` — same `{command, args}` body
- `POST /windows` — same `WindowCreate` schema

This lets `mcp_tools.js` work with the TS rebuild unmodified.

---

## Appendix A: IPC Client Socket Resolution

```
1. WIBWOB_INSTANCE env var → /tmp/wibwob_{instance}.sock
2. Auto-discover: probe /tmp/wibwob_*.sock for live connections
3. Fallback: /tmp/wwdos.sock
```

## Appendix B: Command Capabilities JSON Shape

```json
{
  "version": "v1",
  "commands": [
    {
      "name": "cascade",
      "description": "Cascade all windows on desktop",
      "requires_path": false
    }
  ]
}
```

## Appendix C: File Map

| File | Purpose |
|------|---------|
| `app/command_registry.h` | `CommandCapability` struct, function declarations |
| `app/command_registry.cpp` | 86 commands: capabilities vector + dispatch function |
| `app/api_ipc.cpp` | Unix socket server, auth, IPC command parsing, direct commands |
| `tools/api_server/ipc_client.py` | Python socket client with encoding + auto-discovery |
| `tools/api_server/controller.py` | Business logic, state sync, IPC orchestration |
| `tools/api_server/main.py` | FastAPI routes, Pydantic validation |
| `tools/api_server/schemas.py` | All Pydantic request/response models |
| `app/llm/sdk_bridge/mcp_tools.js` | MCP tool bridge (2 tools + 2 helpers) |
| `spikes/ts-tui-mvp/src/services/control-api.ts` | TS spike's minimal HTTP API |
