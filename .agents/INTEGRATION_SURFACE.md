# WibWob-DOS Integration Surface

**Complete API reference for piping external tools into WibWob-DOS.**

Source truth: `src/services/control-api.ts` and `src/core/command-catalog.ts`

---

## Architecture

The control API is a **Bun.serve()** HTTP+Unix-socket REST interface (port 8099 by default, with fallback chain 8099–8103). Routes dispatch through the **CommandRegistry**, which references **command-catalog.ts** as the single source of command metadata.

**Key principle (COAT):** No adapter owns semantics — all meaningful operations are commands first, accessible via menu/palette/API equally. The API is a **thin facade** over the command registry, not a separate command syntax.

---

## Endpoint Inventory

All endpoints return JSON unless otherwise noted. Base: `http://127.0.0.1:{port}`

### Meta / Health / Docs

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/` or `/help` | GET | Endpoint catalogue + service metadata | `{ ok, service, port, endpoints[] }` |
| `/openapi.json` | GET | OpenAPI 3.0 spec for machine parsing | OpenAPI object |
| `/docs` | GET | Interactive Scalar HTML docs | HTML (kepler theme) |
| `/health` | GET | Instance identity: pid, uptime, port, label, socket path | `{ instanceId, instanceLabel, pid, startedAt, uptime, port, socketPath }` |
| `/config` | GET | File system paths (scratch, captures, workspaces, state) | `{ scratchBase, capturesDir, workspacesDir, statePath }` |

### State / Inspection

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/state` | GET | **Full live desktop state** — window list with positions, focus, overlays | `{ windows[], focused, overlays, desktop }` |
| `/runtime/inspection` | GET | Structured snapshot: desktop, menu state, runtime stats, Scramble state | `{ snapshot: {...} }` |
| `/runtime/stats` | GET | Shell-level metrics: FPS, frame time, RAM, agent activity | `{ stats: {...} }` |
| `/commands/list` | GET | All registered commands, filtered by surface/tier | `{ ok: true, commands[] }` |
| `.../list?surface=api` | GET | Filter by visibility: `menu`, `palette`, `api`, `agent` | Commands visible to that surface |
| `.../list?includeUnavailable=1` | GET | Include commands disabled by unsatisfied `requires:` | Commands + unavailable reason |

### Window Content / Screenshots

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/windows/text?id=N` | GET | Raw text content of a window (no ANSI) | `{ ok: true, text: "..." }` |
| `/screenshot/text` | GET | Clean readable text screenshot (strips ANSI + blessed chrome) | Plain text, no TTY codes |
| `.../text?id=N` | GET | Crop to specific window rect | Window's text only |
| `/screenshot/ansi` | GET | Raw ANSI dump from blessed (preserves TTY escape sequences) | Raw ANSI text |
| `.../ansi?id=N` | GET | Crop ANSI to window rect | Window ANSI with escapes |
| `/content/primer-info?path=/abs/path.txt` | GET | Primer metadata: lines, width, animated, recommended window size | `{ lines, width, height, animated, recommend_w, recommend_h }` |

### World Chat (3D Backrooms)

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/world-chat/state` | GET | Current world key, transport status, channel list, snapshot | `{ worldKey, transport, channels[] }` |
| `/world-chat/channels` | GET | List all channels in current world | Array of channel metadata |
| `/world-chat/channel?id=%23channel-name` | GET | Read one channel (messages, participants) | `{ channel: {...} }` |
| `/world-chat/channel/text?id=%23channel` | GET | Plain text export of a channel | Plain text (Content-Type: text/plain) |

### Command Execution (Main Integration Point)

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/commands/run` | POST | `{ id: "command.id", args?: {...} }` | **Canonical command dispatch** — execute any registered command with arguments |

**Usage:**
```bash
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{ "id": "primer.open", "args": { "filePath": "/abs/path.txt" } }'
```

**Error handling:** Returns Zod validation errors if `args` fail the command's params schema:
```json
{
  "ok": false,
  "error": "Invalid arguments",
  "details": [
    { "path": "filePath", "message": "Required", "expected": "string", "received": "undefined" }
  ]
}
```

---

## File/URL Opening Commands (Integration Targets)

### Primer (ASCII Art / Text)

**Command ID:** `primer.open`

```bash
POST /commands/run
{ "id": "primer.open", "args": { "filePath": "/abs/path.txt" } }

# Optional positioning:
{ "id": "primer.open", "args": { 
    "filePath": "/path.txt",
    "x": 10, "y": 5,       # columns, rows
    "w": 60, "h": 30       # width, height
  } 
}
```

- **filePath**: Absolute path to text file. Can be `.txt`, `.ans`, any ASCII-encodable.
- **What it opens**: Full-featured primer viewer with semantic line wrapping, animation support (if file contains animation metadata).
- **Multiinstance**: ✓ (can have many primer windows)
- **Returns**: `{ ok: true, windowId: N, title: "..." }`
- **Typical sources**: ASCII art, generated diagrams, code listings

**Alias endpoint** (backward compat): `/view/primer/open`

---

### Markdown Reader

**Command ID:** `markdown.open`

```bash
POST /commands/run
{ "id": "markdown.open", "args": { "filePath": "/abs/path.md" } }
```

- **filePath**: Absolute path to `.md` file.
- **Features**: Figlet H1/H2 headings, syntax-highlighted code blocks, semantic list rendering.
- **Multiinstance**: ✓
- **Returns**: `{ ok: true, windowId: N }`
- **Typical sources**: Documentation, READMEs, formatted notes

**Alias endpoint**: `/view/reader/open`

---

### Text Editor

**Command ID:** `editor.open`

```bash
# Open existing file:
POST /commands/run
{ "id": "editor.open", "args": { "filePath": "/abs/path.txt" } }

# Create unsaved buffer with initial content:
{ "id": "editor.open", "args": { 
    "title": "Untitled Buffer",
    "initial": "line 1\nline 2"
  } 
}
```

- **filePath** (optional): Absolute path to existing or new file.
- **title** (optional): Name for unsaved buffer (when filePath omitted).
- **initial** (optional): Seed text for unsaved buffer.
- **Multiinstance**: ✓
- **Returns**: `{ ok: true, windowId: N }`
- **Use case**: Script output capture, generated code, collaborative editing input

**Alias endpoint**: `/view/editor/open`

**Write to editor:** `editor.write` command (see below)

---

### File Manager / Finder

**Command ID:** `finder.open`

```bash
POST /commands/run
{ "id": "finder.open" }
```

- Opens file browser (no args).
- **Navigate to path:** `finder.navigate` command:

```bash
{ "id": "finder.navigate", "args": { "path": "/Users/james/Downloads" } }
```

- **Search files in Finder:**

```bash
{ "id": "finder.search", "args": { 
    "query": "test",
    "glob": "*.ts"      # optional glob filter
  } 
}
```

- **Semantic search (QMD):**

```bash
{ "id": "finder.advanced_search", "args": {
    "query": "type definitions",
    "mode": "vec"  # lex, vec, or hyde
  } 
}
```

- **Multiinstance**: No (one instance per call, but only one active at a time)
- **Returns**: `{ ok: true, windowId: N }`

**Alias endpoint**: `/view/file-manager/open`

---

### Music Player

**Command ID:** `music-player.open`

```bash
POST /commands/run
{ "id": "music-player.open", "args": { "filePath": "/abs/path.wav" } }

# Open without auto-loading:
{ "id": "music-player.open" }
```

- **filePath** (optional): Absolute path to `.wav`, `.mp3`, `.flac`, etc.
- **Returns**: `{ ok: true, windowId: N }`

**Alias endpoint**: `/view/music-player/open`

---

### Web Browser (Chrome)

**Command ID:** `web-reader.open`

```bash
POST /commands/run
{ "id": "web-reader.open", "args": { "url": "https://example.com" } }
```

- **url** (optional): HTTP/HTTPS URL. Opens to default page if omitted.
- **Requires**: Chrome binary (`requires: ["bin.chrome"]`)
- **Multiinstance**: ✓
- **Returns**: `{ ok: true, windowId: N }`

---

### Backrooms TV (Generative AI Sessions)

**Command ID:** `backrooms.open`

```bash
POST /commands/run
{ "id": "backrooms.open", "args": {
    "theme": "liminal fluorescent maze",  # aesthetic description
    "primers": "primer1.txt,primer2.ans", # optional CSV paths for context
    "mode": "live",                        # auto, live, or fake-live
    "model": "sonnet",                     # haiku, sonnet, or opus
    "turns": 5                             # 1–20, default 3
  } 
}
```

- **theme**: Mood/scene description for generative session
- **primers** (optional): CSV list of absolute paths to primer files (visual context)
- **mode**: `auto` (auto-decide), `live` (real LLM), `fake-live` (simulated without API calls)
- **model**: Claude model size (haiku < sonnet < opus, speed/cost tradeoff)
- **turns**: Conversation length (default 3, max 20)
- **Returns**: `{ ok: true, channel: {...}, windowId: N }`

**Alias endpoint**: `/view/backrooms/open`

---

### Generative Art / Plasma

**Command ID:** `microapp.wibwob.generative.open` (or legacy `art.open`)

```bash
POST /commands/run
{ "id": "microapp.wibwob.generative.open" }
```

- Opens procedural generative art window.
- No arguments.
- **Returns**: `{ ok: true, windowId: N }`

---

### Figlet Typography

**Command ID:** `figlet.open` (or `microapp.wibwob.figlet.open`)

```bash
POST /commands/run
{ "id": "figlet.open", "args": {
    "text": "HELLO WORLD",
    "font": "banner"  # optional, defaults to catalogue favourite
  } 
}
```

- **text**: ASCII string to render as figlet
- **font** (optional): Figlet font name
- **List fonts:**

```bash
POST /commands/run
{ "id": "figlet.fonts" }
```

Returns: `{ ok: true, fonts: [...], default: "...", current: "..." }`

- **Multiinstance**: ✓
- **Returns**: `{ ok: true, windowId: N }`

**Alias endpoint**: `/view/figlet/open-default` (creates with defaults, no prompt)

---

### Zine Canvas Documents

**Command ID:** `microapp.wibwob.zine.open`

```bash
POST /commands/run
{ "id": "microapp.wibwob.zine.open", "args": {
    "filePath": "/abs/path.canvas.yaml"
  } 
}
```

- **filePath**: Absolute path to `.canvas.yaml` document.
- **List available canvases:**

```bash
{ "id": "microapp.wibwob.zine.list-canvases" }
```

Returns: `{ ok: true, files: [{ index, filePath, title }, ...] }`

- **Alias endpoint**: `/view/zine/open?filePath=...` or `?index=0`

---

### Scramble Chat (Companion AI)

**Command ID:** `companion.open` (floating) or `companion.smol` (popup)

```bash
POST /commands/run
{ "id": "companion.open" }   # Full floating window
{ "id": "companion.smol" }   # Smol popup anchored to corner
```

- **Send message to Scramble:**

```bash
{ "id": "scramble.say", "args": { "text": "Hello Scramble!" } }
```

- **Pet Scramble:**

```bash
{ "id": "scramble.pet" }
```

- **Sleep/wake:**

```bash
{ "id": "scramble.sleep" }
{ "id": "scramble.wake" }
```

- **Meow:**

```bash
{ "id": "scramble.meow" }
```

- **Pop smol to floating:**

```bash
{ "id": "scramble.pop-out" }
```

- **Expand/collapse:**

```bash
{ "id": "scramble.expand" }
```

---

### Agent Chat Window

**Command ID:** `agent.open`

```bash
POST /commands/run
{ "id": "agent.open" }
```

- Opens (or focuses) the native Wib&Wob Agent chat.
- **Send message to agent:**

```bash
{ "id": "agent.send", "args": { "text": "Run a command for me" } }
```

- **Via dedicated endpoint:** `POST /windows/agent-message` with `{ id: N, text: "...", sender: "External Tool" }`

---

### Command Palette & Workspace Manager

**Command ID:** `palette.open`

```bash
POST /commands/run
{ "id": "palette.open" }
```

- Opens searchable command palette.

**Command ID:** `workspace.manage`

```bash
POST /commands/run
{ "id": "workspace.manage" }
```

- Opens workspace save/load UI.

---

## Text Manipulation Commands (Editing Surface)

### Editor Write

**Command ID:** `editor.write`

```bash
POST /commands/run
{ "id": "editor.write", "args": { "text": "new content here" } }
```

- Replaces entire focused editor window content.
- **Returns**: `{ ok: true }`

---

### Text Surface FX (Glitch, Shear, Breed, Flip)

**Command ID:** `fx.glitch`

```bash
POST /commands/run
{ "id": "fx.glitch", "args": {
    "filePath": "/abs/path.txt",
    "intensity": 0.5,      # 0–1
    "seed": 42             # optional
  } 
}
```

Returns: `{ ok: true, windowId: N, filePath: "generated_file.txt" }`

**Command ID:** `fx.shear`

```bash
{ "id": "fx.shear", "args": {
    "filePath": "/abs/path.txt",
    "skew": 2
  } 
}
```

**Command ID:** `fx.breed` (mix two files)

```bash
{ "id": "fx.breed", "args": {
    "file1": "/path/a.txt",
    "file2": "/path/b.txt",
    "mode": "xor",          # xor, density, blend, random, interleave
    "bias": 0.5             # weight toward file2
  } 
}
```

**Command ID:** `fx.flip`

```bash
{ "id": "fx.flip", "args": {
    "filePath": "/abs/path.txt",
    "direction": "v"        # v, h, or both
  } 
}
```

---

## Window Management Commands

All require window ID from `/state`:

| Command | Endpoint | Body | Description |
|---------|----------|------|-------------|
| `window.focus` | `POST /commands/run` | `{ id, args: { id: N } }` | Focus window by id |
| `window.move` | `POST /commands/run` | `{ id, args: { id: N, left, top } }` | Move to absolute coords (columns, rows) |
| `window.resize` | `POST /commands/run` | `{ id, args: { id: N, width, height } }` | Resize in columns × rows |
| `window.close` | `POST /commands/run` | `{ id, args: { id: N } }` | Close window |
| `window.set_chrome` | `POST /commands/run` | `{ id, args: { id: N, mode: "standard"\|"none" } }` | Toggle chrome (frameless) |
| `window.toggle_maximize` | `POST /commands/run` | `{ id, args: { id: N } }` | Maximize/restore |

**Direct endpoints** (also work):

```bash
POST /windows/focus         { id: 5 }
POST /windows/move          { id: 5, left: 10, top: 0 }
POST /windows/resize        { id: 5, width: 80, height: 30 }
POST /windows/close         { id: 5 }
POST /windows/maximize      { id: 5 }
```

**Batch operations:**

```bash
POST /windows/batch
{
  "ops": [
    { "id": 1, "left": 0, "top": 0, "width": 40, "height": 40 },
    { "id": 2, "left": 40, "top": 0, "width": 40, "height": 40 },
    { "id": 3, "close": true }
  ]
}
```

---

## Overlay / Modal Control

Overlays are modal dialogs (file pickers, confirmations, etc.). Use these to drive overlays programmatically:

| Command | Endpoint | Description |
|---------|----------|-------------|
| `overlay.info` | `POST /commands/run` | Check active overlay type + selected index |
| `overlay.select` | `POST /commands/run` + `{ index: N }` | Select item in list/browser overlay |
| `overlay.confirm` | `POST /commands/run` | Confirm overlay (OK/Enter) |
| `overlay.cancel` | `POST /commands/run` | Cancel overlay (Escape) |

**Direct endpoints:**

```bash
GET /overlay/info
POST /overlay/confirm
POST /overlay/cancel
POST /overlay/select        { "index": 2 }
```

---

## Window Content Export

**Command ID:** `window.export_text`

```bash
POST /commands/run
{ "id": "window.export_text", "args": { "id": 5, "name": "my-output" } }
```

- Writes window text to `scratch/captures/{timestamp}_{name}.txt`
- **Returns**: `{ ok: true, path: "/abs/path/to/file.txt" }`

**Direct endpoint:**

```bash
POST /windows/text/export
{ "id": 5, "name": "output-label" }
```

---

## Workspace Persistence

**Save workspace layout:**

```bash
POST /commands/run
{ "id": "workspace.save", "args": { "name": "my-layout" } }
```

**Load workspace layout:**

```bash
POST /commands/run
{ "id": "workspace.load_named", "args": { "name": "my-layout" } }
```

**Direct endpoints:**

```bash
POST /workspace/save        { "name": "layout-1" }
POST /workspace/load        { "name": "layout-1" }
```

---

## Canvas Document Management

**Command ID:** `canvas.load`

```bash
POST /commands/run
{ "id": "canvas.load", "args": { "filePath": "/abs/path.canvas.yaml" } }
```

**Command ID:** `canvas.export`

```bash
POST /commands/run
{ "id": "canvas.export", "args": { 
    "filePath": "/abs/path.canvas.yaml",
    "title": "My Layout"
  } 
}
```

---

## Theme Management

**Command ID:** `theme.set`

```bash
POST /commands/run
{ "id": "theme.set", "args": { "name": "wibwob-dark-pastel" } }
```

Valid themes:
- `wibwob-dark`
- `wibwob-dark-nord`
- `wibwob-dark-pastel`
- `wibwob-phosphor`
- `wibwob-light`

**Cycle theme:**

```bash
{ "id": "theme.cycle" }
```

**Interactive picker:**

```bash
{ "id": "theme.choose" }
```

---

## Input/Interaction Endpoints

### Send Input to Window

```bash
POST /windows/input
{ "id": 5, "input": "text to send\r" }
```

- `\r` at end = submit/confirm
- Useful for automated UI interaction

### Send Message to Agent

```bash
POST /windows/agent-message
{ "id": 5, "text": "Do something", "sender": "External Tool" }
```

---

## Unix Socket Discovery (Local-only)

For true local-only integration (no port binding):

```bash
ls -la ~/.config/wibwob/instances/  # or scratch/instances/
# Shows: label.sock → can connect via AF_UNIX
```

Example:
```bash
curl --unix-socket ~/.config/wibwob/instances/main.sock http://localhost/state
```

---

## Complete Request/Response Examples

### Open a Primer File

```bash
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "primer.open",
    "args": {
      "filePath": "/Users/james/repos/wibandwob-dos/scratch/art/scene1.txt",
      "x": 10,
      "y": 2,
      "w": 100,
      "h": 60
    }
  }' | jq .
```

Response:
```json
{
  "ok": true,
  "windowId": 7,
  "title": "scene1.txt"
}
```

### Navigate Finder and Search

```bash
# Navigate
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "finder.navigate",
    "args": { "path": "/Users/james/Downloads" }
  }'

# Search for TypeScript files
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "finder.search",
    "args": { 
      "query": "test",
      "glob": "*.test.ts"
    }
  }'
```

### Open Markdown + Export Text

```bash
# Open
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "markdown.open",
    "args": { "filePath": "/path/to/README.md" }
  }'

# Export the window text
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "window.export_text",
    "args": { "id": 3, "name": "readme-capture" }
  }'

# Returns:
# { "ok": true, "path": "/scratch/captures/2024-12-03T10-30-45.123Z_readme-capture.txt" }
```

### Start Backrooms TV Session

```bash
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "backrooms.open",
    "args": {
      "theme": "abandoned subway station",
      "mode": "live",
      "model": "sonnet",
      "turns": 4
    }
  }'
```

### Batch Window Layout

```bash
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "window.tile"
  }'

# Or manual batch:
curl -X POST http://127.0.0.1:8099/windows/batch \
  -H 'Content-Type: application/json' \
  -d '{
    "ops": [
      { "id": 1, "left": 0, "top": 1, "width": 78, "height": 40 },
      { "id": 2, "left": 0, "top": 41, "width": 78, "height": 39 }
    ]
  }'
```

---

## Integration Patterns

### Pattern 1: External Tool → Primer

Generate output, write to file, open in WibWob:

```bash
# 1. Generate ASCII art
python scripts/gen-diagram.py > /tmp/diagram.txt

# 2. Open in WibWob
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "primer.open",
    "args": { "filePath": "/tmp/diagram.txt" }
  }'
```

### Pattern 2: Script + Agent Chat

Capture output, send to agent:

```bash
# 1. Run test, capture output
npm test 2>&1 > /tmp/test-output.log

# 2. Send to agent
curl -X POST http://127.0.0.1:8099/windows/agent-message \
  -H 'Content-Type: application/json' \
  -d '{
    "id": 5,
    "text": "Test output in /tmp/test-output.log — debug this",
    "sender": "CI Pipeline"
  }'
```

### Pattern 3: Dashboard Assembly

Arrange multiple windows programmatically:

```bash
# 1. Open multiple views
for file in model.md config.yaml logs.txt; do
  curl -X POST http://127.0.0.1:8099/commands/run \
    -H 'Content-Type: application/json' \
    -d "{ \"id\": \"markdown.open\", \"args\": { \"filePath\": \"/path/$file\" } }"
done

# 2. Poll /state to get window ids
STATE=$(curl http://127.0.0.1:8099/state)
WINDOW_IDS=$(echo $STATE | jq '.windows[].id')

# 3. Tile layout
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{ "id": "window.tile" }'
```

### Pattern 4: Real-time Primer Updates

Generate, open, then update content:

```bash
# 1. Create initial file
echo "Starting..." > /tmp/live.txt
curl -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "primer.open",
    "args": { "filePath": "/tmp/live.txt" }
  }'

# 2. Update in loop (file on disk changes, primer watches)
for i in {1..10}; do
  echo "Update $i: $(date)" >> /tmp/live.txt
  sleep 1
done
```

---

## File Path Requirements

### Absolute Paths Only

- All `filePath` arguments must be **absolute paths** (start with `/`).
- No `~` expansion; use `$HOME` in shell or `/Users/username/...` in scripts.
- Paths can be anywhere user has read access (WibWob runs as current user).

### Path Validation

- `src/core/safe-fs.ts` handles all file I/O.
- Symlinks are followed.
- Non-existent paths: handled gracefully (primer.open tries to create/edit, editor.open opens an unsaved buffer).

### Example Safe Paths

```bash
/Users/james/repos/project/docs/README.md          # ✓
/var/tmp/generated-output.txt                       # ✓
~/.config/wibwob/config.yaml                        # ✗ use $HOME
./relative/path.txt                                 # ✗ use $(pwd)/relative/path.txt
```

---

## Command Visibility & Requirements

Every command in the catalog has:

- **`api: true`** — exposed to `/commands/run` (most do)
- **`agent: true`** — visible to Wib&Wob Agent chat
- **`requires: [...]`** — unsatisfied requirements disable command (example: `web-reader.open` requires `bin.chrome`)

Query availability:

```bash
curl http://127.0.0.1:8099/commands/list?surface=api&includeUnavailable=1
```

---

## Error Handling

### Invalid Command ID

```json
{
  "ok": false,
  "error": "Command not found"
}
```

### Invalid Arguments (Zod Schema Failure)

```json
{
  "ok": false,
  "error": "Invalid arguments",
  "details": [
    {
      "path": "filePath",
      "message": "Expected string, received undefined",
      "expected": "string",
      "received": "undefined"
    }
  ]
}
```

### File Not Found (Graceful)

- `primer.open`: Opens an empty editor with suggestion to create
- `markdown.open`: Returns error in dialog
- `editor.open`: Opens unsaved buffer (filePath becomes title)

### Overlay Errors

```json
{
  "ok": false,
  "error": "No active overlay"
}
```

---

## Discovery & Introspection

### List All Commands

```bash
curl http://127.0.0.1:8099/commands/list | jq '.commands | length'
```

### Filter by Tier

```bash
# Only microapp commands
curl http://127.0.0.1:8099/commands/list?tier=microapp

# Custom microapp
curl http://127.0.0.1:8099/commands/list?tier=wibwob.zine
```

### Get Desktop State

```bash
curl http://127.0.0.1:8099/state | jq '.windows[] | {id, kind, title}'
```

### Check Scramble AI Status

```bash
curl http://127.0.0.1:8099/scramble/state | jq '{status, model, messageCount}'
```

---

## Summary: What External Tools Can Do

| Task | Command(s) | Key Args |
|------|-----------|----------|
| **Display generated ASCII** | `primer.open` | `filePath` |
| **Show documentation** | `markdown.open` | `filePath` |
| **Edit files** | `editor.open` | `filePath`, `title`, `initial` |
| **Browse files** | `finder.open`, `finder.navigate` | `path` (navigate) |
| **Play audio** | `music-player.open` | `filePath` |
| **Open websites** | `web-reader.open` | `url` |
| **Run generative session** | `backrooms.open` | `theme`, `primers`, `mode`, `model`, `turns` |
| **Talk to AI** | `agent.send`, `scramble.say` | `text` |
| **Arrange windows** | `window.move`, `window.resize`, `window.tile`, `windows/batch` | `id`, `left`, `top`, `width`, `height` |
| **Capture output** | `window.export_text`, `/screenshot/text` | `id`, `name` |
| **Edit surface** | `fx.glitch`, `fx.breed`, etc. | `filePath`, mode-specific args |
| **Control playback** | Theme, workspace, canvas commands | See each section |

---

## Next Steps: Building an Integration

1. **Discover local instance:** Check for Unix socket or use port 8099–8103
2. **Query state:** `GET /state` to list current windows and their IDs
3. **Open your view:** `POST /commands/run` with appropriate command
4. **Arrange if needed:** `POST /windows/batch` for multi-window layouts
5. **Monitor/interact:** `POST /windows/input` or agent message for interaction
6. **Capture results:** `POST /windows/text/export` or `/screenshot/text`

All operations return JSON. No session management needed — each request is stateless over the control API.
