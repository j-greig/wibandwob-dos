FastAPI MVP for Programmatic Control API (v1)

Overview
- Local-only FastAPI server that implements the v1 API described in `prds/programmatic-control-api-prd.md`.
- In-memory controller models windows, layout, menu commands, properties, workspace, screenshots, and pattern mode.
- WebSocket event stream broadcasts state changes for reactive clients (humans or LLM tools).
- Designed for a clean swap to an IPC or in-process adapter that talks to the Turbo Vision app.

Structure
- `tools/api_server/main.py`: FastAPI app, routes, and WebSocket endpoint.
- `tools/api_server/controller.py`: In-memory controller; replace with C++ IPC/in-process bridge later.
- `tools/api_server/models.py`: Domain entities (Window, Rect, AppState, WindowType).
- `tools/api_server/schemas.py`: Pydantic request/response models (create, move, props, state, etc.).
- `tools/api_server/events.py`: Broadcast hub for `/ws` clients.
- `tools/api_server/requirements.txt`: Python dependencies.
- `tools/api_server/README.md`: This guide.

Install and Run
- Python: 3.9+ (3.11 recommended). The code is 3.9-compatible.
- Create venv in API server dir: `cd tools/api_server && python3 -m venv venv`
- Activate venv: `source venv/bin/activate`
- Install deps: `pip install -r requirements.txt`
- **IMPORTANT**: Run from project root: `cd /path/to/tvision`
- Start server: `python -m tools.api_server.main --port=8089` (binds `127.0.0.1:8089`)
  - Or use venv directly: `./tools/api_server/venv/bin/python -m tools.api_server.main --port=8089`
- OpenAPI docs: `http://127.0.0.1:8089/docs`
- WebSocket: `ws://127.0.0.1:8089/ws`
- MCP endpoint: `http://127.0.0.1:8089/mcp` (requires `fastapi-mcp` installed)
- Deactivate venv when finished: `deactivate`

Alternative using uv (faster):
- `cd tools/api_server && uv venv && uv pip install -r requirements.txt`
- `cd ../.. && uv run python -m tools.api_server.main --port=8089`

Run the C++ App (for live control)
- Build once (from repo root): `cmake -S . -B build && cmake --build build -j`
- Build test app (from `test-tui`): `mkdir -p build && cd build && cmake .. && cmake --build . -j`
- Run the app: `./test_pattern`
- Verify socket exists (new terminal): `ls -l /tmp/test_pattern_app.sock`

Window Types
- **test_pattern** — Test pattern generator with gradients and wallpaper
- **gradient** — Gradient displays: `props: {"gradient": "horizontal|vertical|radial|diagonal"}`
- **frame_player** — Animation player: `props: {"path": "file.txt", "fps": 10}`
- **text_view** — Text/primer file viewer: `props: {"path": "file.txt"}` (readonly)
- **text_editor** — Interactive text editor (supports send_text/send_figlet APIs)
- **wallpaper** — Static wallpaper patterns

IPC Bridge to the C++ App
- The C++ `test_pattern` app now starts a Unix-domain socket listener at `/tmp/test_pattern_app.sock`.
- This FastAPI server auto-forwards core commands to the live app when the socket is available.
- To change the socket path, set `TV_IPC_SOCK=/custom/path.sock` (in both app and server if changed).

Key Endpoints
- Health: `GET /health` — basic liveness.
- Capabilities: `GET /capabilities` — window types, commands, properties schema.
- State: `GET /state` — `pattern_mode`, `windows`, `canvas`, `last_workspace`, `last_screenshot`, `uptime_sec`.
- Window lifecycle:
  - `POST /windows` — create: `{type, title?, rect?, props?}`
  - `POST /windows/{id}/move` — move/resize: `{x?, y?, w?, h?}`
  - `POST /windows/{id}/focus` — bring to front and focus
  - `POST /windows/{id}/clone` — duplicate window and props
  - `POST /windows/{id}/close` — close a window
  - `POST /windows/cascade` — cascade layout
  - `POST /windows/tile` — tile layout: `{cols?}`
  - `POST /windows/close_all` — close all windows
- Text editor API:
  - `POST /windows/{id}/send_text` — send text/ASCII to text editor: `{content, mode?, position?}`
  - `POST /text_editor/send_text` — auto-spawn text editor if needed: `{content, mode?, position?}`
  - `POST /windows/{id}/send_figlet` — send FIGlet ASCII art: `{text, font?, width?, mode?}`
  - `POST /text_editor/send_figlet` — auto-spawn text editor for FIGlet: `{text, font?, width?, mode?}`
  - `POST /windows/{id}/send_multi_figlet` — multi-font FIGlet segments: `{segments, separator?, mode?}`
- Properties: `POST /props/{id}` — update window props: `{props:{...}}`
- Menu commands: `POST /menu/command` — `{command, args?}` (supports `cascade`, `tile`, `close_all`, `save_workspace`, `open_workspace`, `screenshot`)
- Workspace: `POST /workspace/save|open` — `{path}`
- Screenshot: `POST /screenshot` — `{path?}` returns `{path}`
- Pattern mode: `POST /pattern_mode` — `{mode:"continuous"|"tiled"}`
- **Batch layout: `POST /windows/batch_layout`** — create/move/close multiple windows in one call with macro support
- **Timeline operations: `GET /timeline/status?group_id=...`, `POST /timeline/cancel`** — for future scheduled operations 
- **Primer discovery: `GET /primers/list`** — list all available primer files with metadata (128 primers available)
- **Batch primers: `POST /primers/batch`** — spawn up to 20 primer windows at once with auto-sizing
- WebSocket events: `GET /ws`

WebSocket Events
- `window.created` — `{id, type, title, rect, z, focused, props}`
- `window.updated` — same payload as created
- `window.closed` — `{id}`
- `layout.cascade` — `{}`
- `layout.tile` — `{cols}`
- `command.executed` — `{command, ok, ...}`
- `workspace.saved` — `{path}`
- `workspace.opened` — `{path}`
- `screenshot.saved` — `{path}`
- `pattern.mode` — `{mode}`

Examples (curl)
- Create a test pattern window:
  - `curl -X POST localhost:8089/windows -H 'Content-Type: application/json' -d '{"type":"test_pattern","title":"TP #1","rect":{"x":2,"y":1,"w":40,"h":12}}'`
- Create text editor and send ASCII art:
  - `curl -X POST localhost:8089/text_editor/send_figlet -H 'Content-Type: application/json' -d '{"text":"TURBO TEXT","font":"slant","mode":"replace"}'`
- Send text to existing text editor:
  - `curl -X POST localhost:8089/windows/<id>/send_text -H 'Content-Type: application/json' -d '{"content":"Hello world!\n","mode":"append"}'`
- Load primer file as text view:
  - `curl -X POST localhost:8089/windows -H 'Content-Type: application/json' -d '{"type":"text_view","props":{"path":"primers/monster-emoji.txt"}}'`
- Batch spawn primers with positioning:
  - `curl -X POST localhost:8089/primers/batch -H 'Content-Type: application/json' -d '{"primers":[{"primer_path":"primers/monster-angel-of-death.txt","x":10,"y":5},{"primer_path":"primers/iso-disco-cubes.txt","x":50,"y":5}]}'`
- Tile all windows (2 columns):
  - `curl -X POST localhost:8089/windows/tile -H 'Content-Type: application/json' -d '{"cols":2}'`
- Update frame player FPS:
  - `curl -X POST localhost:8089/props/<id> -H 'Content-Type: application/json' -d '{"props":{"fps":24}}'`
- Execute a menu command (save workspace):
  - `curl -X POST localhost:8089/menu/command -H 'Content-Type: application/json' -d '{"command":"save_workspace","args":{"path":"workspace.json"}}'`

## Text Editor & Primer Files

### Text Editor Features
The text_editor window type supports real-time text injection via API:
- **Live text streaming**: Send content while user interacts with editor
- **ASCII art integration**: Built-in FIGlet font support for headers/banners  
- **Multiple modes**: append (add to end), replace (clear all), insert (at cursor)
- **Auto-spawn**: API endpoints auto-create editor if none exists

### FIGlet ASCII Art Fonts
Popular fonts include: `standard`, `slant`, `big`, `small`, `banner`, `bubble`, `doom`, `starwars`
```bash
# Send ASCII art header
curl -X POST localhost:8089/text_editor/send_figlet \
  -H 'Content-Type: application/json' \
  -d '{"text":"TURBO TEXT","font":"slant","mode":"replace"}'
```

### Primer File Loading
Load pre-made ASCII art/animations from `test-tui/primers/`:
```bash
# Monster emoji art
curl -X POST localhost:8089/windows -H 'Content-Type: application/json' \
  -d '{"type":"text_view","props":{"path":"primers/monster-emoji.txt"}}'

# Wibwob portrait 
curl -X POST localhost:8089/windows -H 'Content-Type: application/json' \
  -d '{"type":"text_view","props":{"path":"primers/wibwob-portrait-2.txt"}}'

# Animated ASCII (frame format)
curl -X POST localhost:8089/windows -H 'Content-Type: application/json' \
  -d '{"type":"frame_player","props":{"path":"primers/ascii-draws-itself.txt","fps":8}}'
```

Available primer files: `perception.txt`, `monster-emoji.txt`, `wibwob-portrait-2.txt`, `ascii-draws-itself.txt`

### Primer Discovery API
Discover all available primer files with metadata:
```bash
# List all primer files
curl -X GET localhost:8089/primers/list

# Response includes name, path, and file size
{
  "primers": [
    {"name": "monster-emoji", "path": "primers/monster-emoji.txt", "size_kb": 3.3},
    {"name": "perception", "path": "primers/perception.txt", "size_kb": 5.4}
  ],
  "count": 128
}
```

### Batch Primer Spawning
Spawn up to 20 primer windows at specified positions:
```bash
# Batch spawn primers with precise positioning
curl -X POST localhost:8089/primers/batch -H 'Content-Type: application/json' \
  -d '{
    "primers": [
      {"primer_path": "primers/monster-emoji.txt", "x": 10, "y": 5},
      {"primer_path": "primers/space-cat.txt", "x": 60, "y": 15},
      {"primer_path": "primers/hypersigil-mesh.txt", "x": 100, "y": 25}
    ]
  }'

# Windows auto-size based on content, only position is required
# Returns list of created windows with their final dimensions
```

## Batch Layout (LLM-Optimized)

The batch layout endpoint enables AI agents to create complex window arrangements in a single call, following MCP "second wave" principles:

### Create a 3x2 Grid of Test Pattern Windows
```bash
curl -X POST localhost:8089/windows/batch_layout \
  -H 'Content-Type: application/json' \
  -d '{
    "request_id": "grid-demo-001",
    "group_id": "demo-scene", 
    "defaults": {"view_type": "test_pattern"},
    "ops": [{
      "op": "macro.create_grid",
      "title": "Demo Window",
      "grid": {
        "cols": 3, "rows": 2,
        "cell_w": 25, "cell_h": 8,
        "gap_x": 1, "gap_y": 1,
        "origin": {"x": 2, "y": 2, "w": 0, "h": 0},
        "order": "row_major"
      }
    }]
  }'
```

### Mixed Operations (Create + Move + Close)
```bash
curl -X POST localhost:8089/windows/batch_layout \
  -H 'Content-Type: application/json' \
  -d '{
    "request_id": "mixed-ops-001", 
    "ops": [
      {
        "op": "create",
        "view_type": "gradient",
        "title": "Rainbow Gradient",
        "bounds": {"x": 10, "y": 3, "w": 30, "h": 10},
        "options": {"gradient": "diagonal"}
      },
      {
        "op": "move_resize", 
        "window_id": "existing_window_id",
        "bounds": {"x": 45, "y": 3, "w": 30, "h": 10}
      },
      {
        "op": "close",
        "window_id": "another_window_id"
      }
    ]
  }'
```

### Dry Run (Simulate Without Applying)
```bash
curl -X POST localhost:8089/windows/batch_layout \
  -H 'Content-Type: application/json' \
  -d '{
    "request_id": "preview-001",
    "dry_run": true,
    "defaults": {"view_type": "gradient"},
    "ops": [{
      "op": "macro.create_grid",
      "grid": {"cols": 4, "rows": 3, "cell_w": 20, "cell_h": 6}
    }]
  }'
```

### Response Format
All batch operations return:
```json
{
  "dry_run": false,
  "applied": true,
  "group_id": "demo-scene",
  "op_results": [
    {
      "status": "applied",
      "window_id": "win_abc123",
      "final_bounds": {"x": 2, "y": 2, "w": 25, "h": 8}
    }
  ],
  "warnings": [],
  "timeline_summary": {"counts": {"ops": 6}}
}
```

## MCP Integration

When MCP is available (`pip install fastapi-mcp`), these tools are exposed for AI agents:

- `tui_get_state` — Get current TUI state (maps to `/state`)
- `tui_create_window` — Create windows (maps to `/windows`)
- `tui_move_window` — Move/resize windows (maps to `/windows/{id}/move`)
- `tui_focus_window` — Focus windows (maps to `/windows/{id}/focus`)
- `tui_close_window` — Close windows (maps to `/windows/{id}/close`)
- `tui_cascade_windows` — Cascade layout (maps to `/windows/cascade`)
- `tui_tile_windows` — Tile layout (maps to `/windows/tile`)
- `tui_close_all_windows` — Close all windows (maps to `/windows/close_all`)
- `tui_set_pattern_mode` — Set pattern mode (maps to `/pattern_mode`)
- `tui_screenshot` — Take screenshots (maps to `/screenshot`)
- `tui_send_text` — Send text to text editor (maps to `/windows/{id}/send_text`)
- `tui_send_figlet` — Generate and send FIGlet ASCII art (maps to `/windows/{id}/send_figlet`)
- `tui_batch_layout` — Batch window operations (maps to `/windows/batch_layout`)
- `tui_timeline_cancel` — Cancel timeline operations 
- `tui_timeline_status` — Check timeline status

### MCP Example Usage (Claude Code)
```bash
# Via Claude Code MCP integration
claude -p --mcp-config=.mcp.json "Create a 4x3 grid of gradient windows with 2-pixel gaps"
claude -p --mcp-config=.mcp.json "Send HELLO WORLD in bubble font to a text editor"
claude -p --mcp-config=.mcp.json "Load the monster emoji primer file"
```

Design Notes and Next Steps
- Localhost-only, no authentication (v1 scope). API keys and remote binding come in v2.
- The `Controller` is the swap point for a C++ bridge:
  - Option A: In-process HTTP server embedded into the TV app and route directly to UI-thread handlers.
  - Option B: IPC (Unix domain socket / named pipe) where Python speaks JSON-RPC to the app; `Controller` forwards calls and mirrors state.
- Once bridged, endpoints should call into actual menu commands and window factories from `test_pattern_app.cpp` and related modules.
