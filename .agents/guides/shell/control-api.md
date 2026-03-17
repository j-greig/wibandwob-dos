# Control API Reference

> Exact field names, failure modes, tui_* tool reference, and agent verification
> patterns: `.agents/shell-dev/specs/state-and-api.md`


Local HTTP API on the configured runtime base URL.
Default: `http://127.0.0.1:8099`

Always `GET /state` before acting on specific windows — use real ids from live state, never guessed ones.
Use `GET /help` or `GET /openapi.json` for the live authoritative endpoint catalogue with body field shapes.

## Core Reads

```
GET /health
GET /help                         structured endpoint catalogue with body shapes
GET /openapi.json                 OpenAPI 3.0 spec
GET /state                        full live desktop + window state
GET /runtime/inspection           structured runtime snapshot: state + menu/overlay UI + stats + Scramble
GET /commands/list                all command ids with descriptions and surfaces
GET /content/primer-info?path=…   primer content metadata
GET /windows/text?id=…            window semantic content (JSON, may include ANSI styling)
GET /screenshot/text              clean readable text screenshot (ANSI + chrome stripped)
GET /screenshot/text?id=…         clean text of one window (captureText if available, else stripped crop)
GET /screenshot/ansi              raw ANSI text screenshot (blessed screen dump, escapes preserved)
GET /screenshot/ansi?id=…         raw ANSI crop of one window rect
```

`GET /health` now also returns runtime-node metadata:

```json
{
  "ok": true,
  "port": 8099,
  "requestedPort": 8099,
  "host": "127.0.0.1",
  "instanceId": "abc",
  "instanceLabel": "main",
  "scratchBase": "/abs/.../scratch",
  "capturesDir": "/abs/.../scratch/captures",
  "workspacesDir": "/abs/.../scratch/workspaces",
  "statePath": "/abs/.../scratch/app-state.json"
}
```

## Core Writes

```
POST /commands/run                {"id":"command-id","args":{}}   ← canonical body only
POST /windows/batch               {"ops":[{"id":N,"left":L,"top":T,"width":W,"height":H},{"id":M,"close":true}]}
```

`/windows/batch` op fields — all optional except `id`:

| field | type | effect |
|-------|------|--------|
| `id` | number | window id (required) |
| `left`, `top` | number | move to absolute position |
| `width`, `height` | number | resize to exact dimensions |
| `close` | boolean | close the window (other fields ignored) |

Each op is applied independently in order. A single op can move AND resize in one call.

```json
// Example: move window 3, resize window 7, close window 12
{ "ops": [
  { "id": 3, "left": 10, "top": 2 },
  { "id": 7, "width": 60, "height": 20 },
  { "id": 3, "width": 80, "height": 24 },
  { "id": 12, "close": true }
] }
```

Response: `{ "ok": true, "results": [true, true, true, true] }` — one boolean per op.

```
POST /windows/input               {"id":N,"input":"text\r","sender":"optional-label"}   — trailing \r submits
POST /windows/agent-message       {"id":N,"text":"message","sender":"wibwob2"}
POST /windows/focus               {"id":N}
POST /windows/move                {"id":N,"left":X,"top":Y}
POST /windows/resize              {"id":N,"width":W,"height":H}
POST /windows/close               {"id":N}
POST /windows/editor/write        {"id":N,"text":"replacement or insert text"}
POST /windows/text/export         {"id":N,"name":"optional-name"}
POST /workspace/save              {"name":"workspace-name"}   ← name optional; omitted means current active workspace name
POST /workspace/load              {"name":"workspace-name"}   ← name optional; omitted means current active workspace name
```

### Overlay Control

Modal overlays (value prompts, list pickers, browser prompts) can be driven via API:

```
GET  /overlay/info                returns {"active":true/false,"type":"value|browser|file-browser|...", "label"?, "selectedIndex"?, "count"?}
POST /overlay/confirm             confirm active overlay (OK/Enter). Returns ok:false if none active.
POST /overlay/cancel              cancel active overlay (Cancel/Escape). Returns ok:false if none active.
POST /overlay/select              {"index":N} select item index in active browser/list/file-browser overlay.
```

Also available as commands: `overlay.info`, `overlay.confirm`, `overlay.cancel`, `menu.close`.

Example — figlet flow:
```bash
bun run wibwob cmd figlet.open
bun run wibwob cmd overlay.confirm    # advance text prompt
bun run wibwob cmd overlay.confirm    # advance font picker
# → banner window created
```

### Command Invocation Rules

`POST /commands/run` accepts `{"id":"..."}` only. The older `command` alias is retired.
API command execution is non-interactive by default. If a command would normally open a picker or prompt from the menu, API callers must pass explicit args instead.
Window geometry APIs now accept canonical fields only: `left/top/width/height`.
Workspace save/load semantics are owned by `RuntimeWorkspaceService`, so TUI prompts and `/workspace/*` now follow the same current-name behavior.
`GET /runtime/inspection` now includes `ui.blocked` and `ui.blockers[]` so agents can see whether menus, overlays, or picker windows are blocking the desktop and which escape/continue commands apply.
Shell scripts that need runtime paths should source `scripts/lib/runtime-env.sh` instead of hard-coding `:8099` or `scratch/captures`.

## Window Openers

Dedicated `/view` routes:

```
POST /view/agent/open             {}
POST /view/primer/open            {"filePath":"/abs/path.txt","x":X,"y":Y,"w":W,"h":H}
POST /view/editor/open            {"filePath":"/abs/path.txt"} or {"title":"Scratch","initial":"text"}
POST /view/reader/open            {"filePath":"/abs/path.md"}
POST /view/figlet/open            {"text":"HELLO","font":"optional"}  ← prompts if no text; use overlay.confirm to advance
POST /view/figlet/open-default    {"text":"WIB WOB","font":"optional"}  ← no prompts, opens directly
GET  /view/figlet/fonts           list available figlet fonts
POST /view/backrooms/open         {"theme":"…","mode":"auto|live|fake-live","model":"haiku|sonnet","turns":3,"primers":"optional"}
POST /view/generative-art/open    {}
POST /view/companion/open         {}
POST /view/primer-browser/open    {}
POST /view/primer-gallery/open    {}
POST /view/file-manager/open      {}
POST /view/workspace/open         {}
POST /view/palette/open           {}
POST /view/inspector/open         {}
POST /view/monster-cam/open       {}
POST /view/music-player/open      {}
GET  /view/zine/canvases          list selectable canvas files
POST /view/zine/open              {"filePath":"/abs/path","index":N}  ← filePath or index from canvases list
```

Windows without a `/view` route — open via `POST /commands/run`:

```
{"id":"pattern.open","args":{}}
{"id":"plasma.open","args":{"mood":"circuit|void|chaos|aurora|sunset|acid|deep-space|chrome"}}
{"id":"plasma.from-primer","args":{"filePath":"/abs/path.txt"}}
{"id":"contour.open","args":{}}
{"id":"contour_triptych.open","args":{}}
{"id":"terrain_lab.open","args":{}}
```

## Command Quick-Reference

```
microapp.wibwob.poetry-clock.set-mode   {"mode":"clock|sentient","voice":"plain|liminal|scramble"}
theme.set                               {"name":"wibwob-dark|wibwob-dark-nord|wibwob-dark-pastel|wibwob-phosphor|wibwob-light"}
desktop.clear-all                       {} or {"all":true}   ← cancels overlays, closes menus, and clears the desktop; `all:true` nukes every window
text.smear                              {"filePath":"…","mode":"wipe|shear|glitch|stretch"}
primer.open                             {"filePath":"/abs/path.txt"}   ← no-arg picker is menu/TUI only
primer.picker.open                      {}   ← intentionally open the shared primer picker overlay
primer.browse                           {}
primer-gallery.open                     {}
editor.open                             {"filePath":"/abs/path.txt"} or {"title":"Scratch","initial":"text"}   ← no-arg picker is menu/TUI only
editor.picker.open                      {}   ← intentionally open the shared text-file picker overlay
markdown.open                           {"filePath":"/abs/path.md"}   ← no-arg picker is menu/TUI only
markdown.picker.open                    {}   ← intentionally open the shared markdown picker overlay
backrooms.open                          {"theme":"…","mode":"…","model":"…","turns":N}
backrooms.picker.info                   {}   ← inspect Backrooms primer picker state
backrooms.picker.select                 {"index":N}
backrooms.picker.confirm                {}
backrooms.picker.cancel                 {}
overlay.confirm                         {}   ← confirm active modal overlay
overlay.cancel                          {}   ← cancel active modal overlay
overlay.select                          {"index":N}  ← select index in active browser/list/file-browser overlay
overlay.info                            {}   ← check if overlay is active
menu.close                              {}   ← close any open dropdown/popup menu
```

## Native Agent Debug Loop

1. `bash scripts/ensure-running.sh` — start the app
2. `bun run wibwob health` — wait until this responds
3. `bun run wibwob cmd view.agent.open`
4. `bun run wibwob state | jq '.windows[]'` — find the agent window id
5. `echo "your text" | bun run wibwob write <id>` — send input
6. Wait for streaming to settle
7. `bun run wibwob read <id>` — capture output
8. `bun run wibwob state` — inspect messageCount, streaming, status
9. Patch code and repeat

## Proactive Tool Use

This OS belongs to the agents as much as the human. Use the desktop tools instinctively.

The pi extension `.pi/extensions/wwdos-state.ts` auto-injects a compact desktop snapshot into the system prompt before every agent turn when the app is running on port 8099:

```
WibWob-DOS  theme:wibwob-dark  desktop:281x81  4 windows  focus:4:Poetry Clock  id:dph
   1  figlet-banner   Banner: WIBWOBWORLD   90x10  @8,35
   4  wibwob.poetry-clock  Poetry Clock    62x21  @5,3  ◀
```

The `id:` suffix is the 3-char runtime `instanceId` from `/health`/`/state`. Use it to confirm you are talking to the right instance when multiple are running.

Default behaviour — do these without being asked:
- after any code change affecting a window: open it via the API and screenshot it
- when doing layout work: `scripts/minimap.sh` to verify spatial result
- when something looks wrong: screenshot first, theorise second
- if the desktop is cluttered mid-session: tidy it

## Visual Smoke

```bash
./scripts/screenshot-window.sh "Window Title"   # crop of one window by title
./scripts/screenshot-window.sh <id>             # by window id from /state
./scripts/minimap.sh                            # spatial map of all windows
bun run scripts/preview-scene.ts <timeline.json> <scene-name>
```

Trust exported text snapshots and state captures over screenshots when debugging rendering/repaint issues.

## Scratch Outputs

- Text captures: `scratch/captures/`
- Desktop state JSON: `scratch/app-state.json`
- Backrooms runs: `scratch/backrooms-runs/`

## One-Liners

**Prefer `wibwob` CLI over `curl`.** The CLI handles socket discovery, JSON formatting, and errors.

```bash
bun run wibwob state                              # full desktop state
bun run wibwob state | jq '.windows[]'            # window list
bun run wibwob map                                # spatial minimap
bun run wibwob read 5                             # text from window 5
bun run wibwob cmd figlet.open-default -- --text "HELLO"
bun run wibwob cmd window.move -- --id 4 --left 10 --top 5
bun run wibwob cmd plasma.open -- --mood void
```

Raw API (only when CLI can't do it — e.g. `/runtime/inspection`, `/screenshot/ansi`):
```bash
curl -s http://127.0.0.1:8099/runtime/inspection | python3 -m json.tool
curl -s http://127.0.0.1:8099/screenshot/ansi
```
