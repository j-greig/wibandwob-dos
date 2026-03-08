# Control API Reference

Base: `http://127.0.0.1:8099`  (or `$WIBWOB_API` from connect.sh)

**Auth:** All endpoints except `/health`, `/`, `/help`, `/openapi.json` require
`Authorization: Bearer $WIBWOB_TOKEN` header.

**Rule: always GET /state first — use real window ids from live state, never guessed ones.**

## Discovery

```bash
GET  /health                          # {"ok":true,"port":8099,"instanceLabel":"...","sessionId":"..."} (no auth)
GET  /help                            # structured endpoint catalogue with body shapes (no auth)
GET  /openapi.json                    # OpenAPI 3.0 spec (no auth)
GET  /state                           # full desktop + window state (canonical)
GET  /commands/list                   # all command ids, descriptions, surfaces
```

## Reading

```bash
GET  /windows/text?id=N               # window text content (no ANSI)
GET  /screenshot/text                 # full TUI ANSI-stripped text
GET  /screenshot/text?id=N            # single window crop
GET  /content/primer-info?path=…      # primer content metadata
```

## Writing

```bash
POST /commands/run                    {"id":"command-id","args":{}}
POST /windows/input                   {"id":N,"input":"text\r"}   ← \r submits
POST /windows/agent-message           {"id":N,"text":"...","sender":"agent-name"}
POST /windows/focus                   {"id":N}
POST /windows/move                    {"id":N,"left":X,"top":Y}
POST /windows/resize                  {"id":N,"width":W,"height":H}
POST /windows/close                   {"id":N}
POST /windows/batch                   {"ops":[{"id":N,"x":X,"y":Y,"w":W,"h":H},...]}
POST /windows/text/export             {"id":N}  → saves to scratch/captures/
POST /workspace/save                  {"name":"my-layout"}
POST /workspace/load                  {"name":"my-layout"}
```

## Window openers (dedicated routes)

```bash
POST /view/wibwob-agent/open          {}
POST /view/primer/open                {"filePath":"/abs/path.txt","x":X,"y":Y,"w":W,"h":H}
POST /view/editor/open                {"filePath":"/abs/path.txt"}
POST /view/browser-reader/open        {"filePath":"/abs/path.txt"}
POST /view/figlet/open                {"text":"HELLO","font":"optional"}
POST /view/backrooms/open             {"theme":"…","mode":"auto|live|fake-live","model":"haiku|sonnet","turns":3}
POST /view/art/open                   {}
POST /view/companion/open             {}
POST /view/primer-browser/open        {}
POST /view/primer-gallery/open        {}
POST /view/file-manager/open          {}
POST /view/workspace/open             {}
POST /view/palette/open               {}
POST /view/inspector/open             {}
POST /view/monster-cam/open           {}
POST /view/music-player/open          {}
```

## Common one-liners

```bash
# What is on screen right now
curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" $WIBWOB_API/state | python3 -c "
import sys,json; d=json.load(sys.stdin)
for w in d['windows']: print(w['id'], w.get('title','?'))"

# Open a figlet headline
curl -s -X POST $WIBWOB_API/view/figlet/open \
  -H "Authorization: Bearer $WIBWOB_TOKEN" \
  -H "Content-Type: application/json" -d '{"text":"WIBWOB"}'

# Open plasma art in void mode
curl -s -X POST $WIBWOB_API/commands/run \
  -H "Authorization: Bearer $WIBWOB_TOKEN" \
  -H "Content-Type: application/json" -d '{"id":"plasma.open","args":{"mood":"void"}}'

# Change theme
curl -s -X POST $WIBWOB_API/commands/run \
  -H "Authorization: Bearer $WIBWOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"theme.set","args":{"name":"wibwob-phosphor"}}'

# Send agent message to window 3
curl -s -X POST $WIBWOB_API/windows/agent-message \
  -H "Authorization: Bearer $WIBWOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":3,"text":"hello from agent","sender":"my-agent"}'

# Move window 2 to top-left corner
curl -s -X POST $WIBWOB_API/windows/move \
  -H "Authorization: Bearer $WIBWOB_TOKEN" \
  -H "Content-Type: application/json" -d '{"id":2,"left":0,"top":0}'

# Batch-move two windows at once
curl -s -X POST $WIBWOB_API/windows/batch \
  -H "Authorization: Bearer $WIBWOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ops":[{"id":1,"x":0,"y":0,"w":60,"h":20},{"id":2,"x":61,"y":0,"w":60,"h":20}]}'
```

## /state response shape

```json
{
  "app":     { "theme": "wibwob-dark", "sessionId": "ab3", "instanceLabel": "main" },
  "screen":  { "width": 280, "height": 81, "cellAspect": 2.0 },
  "focus":   { "windowId": 3 },
  "windows": [
    {
      "id": 3,
      "title": "WibWobWorld",
      "kind": "microapp",
      "appType": "wibwob.world",
      "focused": true,
      "rect": { "x": 5, "y": 3, "w": 120, "h": 40 }
    }
  ]
}
```

Window ids are integers and reset each session. Always read from `/state`.

## Themes

```
wibwob-dark           default dark
wibwob-dark-nord      nord palette
wibwob-dark-pastel    muted pastels
wibwob-phosphor       green phosphor CRT
wibwob-light          light mode
```
