# Control API Reference

Local HTTP API on `http://127.0.0.1:8099`.

Always `GET /state` before acting on specific windows — use real ids from live state, never guessed ones.
Use `GET /help` or `GET /openapi.json` for the live authoritative endpoint catalogue with body field shapes.

## Core Reads

```
GET /health
GET /help                         structured endpoint catalogue with body shapes
GET /openapi.json                 OpenAPI 3.0 spec
GET /state                        full live desktop + window state
GET /commands/list                all command ids with descriptions and surfaces
GET /content/primer-info?path=…   primer content metadata
GET /windows/text?id=…            window text content
GET /screenshot/text?id=…         text screenshot of window
```

## Core Writes

```
POST /commands/run                {"id":"command-id","args":{}}
POST /windows/batch               {"ops":[{"id":N,"x":X,"y":Y,"w":W,"h":H},{"id":M,"close":true}]}
```

`/windows/batch` op fields — all optional except `id`:

| field | type | effect |
|-------|------|--------|
| `id` | number | window id (required) |
| `x`, `y` | number | move to absolute position |
| `w`, `h` | number | resize to exact dimensions |
| `close` | boolean | close the window (other fields ignored) |

Each op is applied independently in order. A single op can move AND resize in one call.

```json
// Example: move window 3, resize window 7, close window 12
{ "ops": [
  { "id": 3, "x": 10, "y": 2 },
  { "id": 7, "w": 60, "h": 20 },
  { "id": 3, "w": 80, "h": 24 },
  { "id": 12, "close": true }
] }
```

Response: `{ "ok": true, "results": [true, true, true, true] }` — one boolean per op.

```
POST /windows/input               {"id":N,"input":"text\r"}   — trailing \r submits
POST /windows/agent-message       {"id":N,"text":"message","sender":"wibwob2"}
POST /windows/focus               {"id":N}
POST /windows/move                {"id":N,"left":X,"top":Y}
POST /windows/resize              {"id":N,"width":W,"height":H}
POST /windows/close               {"id":N}
POST /windows/text/export         {"id":N,"name":"optional-name"}
POST /workspace/save              {"name":"workspace-name"}
POST /workspace/load              {"name":"workspace-name"}
```

## Window Openers

Dedicated `/view` routes:

```
POST /view/wibwob-agent/open      {}
POST /view/primer/open            {"filePath":"/abs/path.txt","x":X,"y":Y,"w":W,"h":H}
POST /view/editor/open            {"filePath":"/abs/path.txt"}
POST /view/browser-reader/open    {"filePath":"/abs/path.txt"}
POST /view/figlet/open            {"text":"HELLO","font":"optional"}
POST /view/backrooms/open         {"theme":"…","mode":"auto|live|fake-live","model":"haiku|sonnet","turns":3,"primers":"optional"}
POST /view/art/open               {}
POST /view/companion/open         {}
POST /view/primer-browser/open    {}
POST /view/primer-gallery/open    {}
POST /view/file-manager/open      {}
POST /view/workspace/open         {}
POST /view/palette/open           {}
POST /view/inspector/open         {}
POST /view/monster-cam/open       {}
POST /view/music-player/open      {}
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

## Capability Profiles

Commands are gated by capability keys declared in `requires: [...]` on each command definition.
The active profile is set via `WIBWOB_DEPLOY_PROFILE` env var → `config/capability-profiles/<name>.json`.

Profile JSON shape:
```json
{
  "forceOff": ["feature.editor-open", "feature.agent"],
  "forceOn":  ["bin.figlet", "feature.resource-heavy"],
  "stripMenuFrom": [
    { "id": "app.quit",  "reason": "public instance — prevent visitors quitting the shared process" },
    { "id": "some.cmd", "reason": "not in MVP surface" }
  ]
}
```

- `forceOff` — marks a capability key unavailable regardless of probe; hides all commands that `require` it from menus AND blocks execution
- `forceOn` — marks a capability key available even if probe returns false
- `stripMenuFrom` — hides a specific command from all menus by command ID; command remains runnable via API and `POST /commands/run`. Use for commands that work but shouldn't be in the UI for this deployment (e.g. `app.quit` on a public shared instance). Each entry requires a `reason` string — logged at startup.

`GET /commands/list` reflects profile filtering — only available commands are returned.
`GET /health` returns `deployProfile` name.

Current profiles: `docker-safe` (VPS MVP), `full` (local dev, no gates).

## Command Quick-Reference

```
microapp.wibwob.poetry-clock.set-mode   {"mode":"clock|sentient","voice":"plain|liminal|scramble"}
theme.set                               {"name":"wibwob-dark|wibwob-dark-nord|wibwob-dark-pastel|wibwob-phosphor|wibwob-light"}
desktop.clear-all                       {}   ← API/timeline only; agent:false intentional
text.smear                              {"filePath":"…","mode":"wipe|shear|glitch|stretch"}
primer.open                             {"filePath":"/abs/path.txt"}
primer.browse                           {}
primer_gallery.open                     {}
editor.open                             {"filePath":"/abs/path.txt"}
backrooms.run                           {"theme":"…","mode":"…","model":"…","turns":N}
```

## Native Agent Debug Loop

1. `bun run start` — launch the app
2. `GET /health` — wait until this responds (`{"ok":true,"port":8099,"sessionId":"abc"}`)
3. `POST /view/wibwob-agent/open`
4. `GET /state` — find the `wibwob-agent` window id
5. `POST /windows/input` with `{"id":N,"input":"your text\r"}`
6. Wait for streaming to settle
7. `POST /windows/text/export` — persist a text capture
8. `GET /state` — inspect `messageCount`, `streaming`, `status`, `model`
9. Patch code and repeat

## Proactive Tool Use

This OS belongs to the agents as much as the human. Use the desktop tools instinctively.

The pi extension `.pi/extensions/wwdos-state.ts` auto-injects a compact desktop snapshot into the system prompt before every agent turn when the app is running on port 8099:

```
WibWob-DOS  theme:wibwob-dark  desktop:281x81  4 windows  focus:4:Poetry Clock  id:dph
   1  figlet-banner   Banner: WIBWOBWORLD   90x10  @8,35
   4  wibwob.poetry-clock  Poetry Clock    62x21  @5,3  ◀
```

The `id:` suffix is the 3-char `sessionId` from `/health`/`/state`. Use it to confirm you are talking to the right instance when multiple are running.

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

```bash
curl -s http://127.0.0.1:8099/state | python3 -m json.tool
curl -s -X POST http://127.0.0.1:8099/view/figlet/open \
  -H "Content-Type: application/json" -d '{"text":"HELLO"}'
curl -s -X POST http://127.0.0.1:8099/windows/move \
  -H "Content-Type: application/json" -d '{"id":4,"left":10,"top":5}'
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H "Content-Type: application/json" -d '{"id":"plasma.open","args":{"mood":"void"}}'
```
