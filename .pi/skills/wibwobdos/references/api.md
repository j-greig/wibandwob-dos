# Control API Reference

Base URL: `$WIBWOB_API` (set by connect.sh)
Auth: `Authorization: Bearer $WIBWOB_TOKEN` on all endpoints except `/health`, `/help`, `/openapi.json`

## Endpoints

```
GET  /health                      public — {"ok":true,"deployProfile":"...","sessionId":"..."}
GET  /help                        public — full endpoint catalogue
GET  /openapi.json                public — OpenAPI 3.0 spec
GET  /state                       full desktop + window state (use this for window ids)
GET  /commands/list               all command ids available under current profile
GET  /windows/text?id=N           window text content (ANSI-stripped)
GET  /screenshot/text             full TUI text dump

POST /commands/run                {"id":"command-id","args":{}}
POST /windows/batch               {"ops":[{"action":"move|resize|close","id":N,...}]}
POST /windows/send                {"id":N,"text":"..."}
POST /windows/agent-message       {"id":N,"text":"...","sender":"agent-name"}
POST /windows/focus               {"id":N}
POST /windows/move                {"id":N,"left":X,"top":Y}
POST /windows/resize              {"id":N,"width":W,"height":H}
POST /windows/close               {"id":N}
POST /windows/text/export         {"id":N}  → saves to scratch/captures/
POST /workspace/save              {"name":"layout-name"}
POST /workspace/load              {"name":"layout-name"}
```

## Window opener routes (aliases over /commands/run)

```
POST /view/primer/open            {"filePath":"/abs/path.txt","x":X,"y":Y,"w":W,"h":H}
POST /view/figlet/open            {"text":"HELLO","font":"optional"}
POST /view/editor/open            {"filePath":"/abs/path.txt"}
POST /view/browser-reader/open    {"filePath":"/abs/path.txt"}
POST /view/wibwob-agent/open      {}
POST /view/backrooms/open         {"theme":"…","mode":"auto|live|fake-live","model":"haiku|sonnet","turns":3}
POST /view/music-player/open      {"filePath":"/abs/path.mp3"}
```

## /state response shape

```json
{
  "app":     { "theme": "wibwob-dark", "sessionId": "ab3", "instanceLabel": "smoke" },
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

Window ids are integers, reset each session. Always read from `/state`.

## Themes

`wibwob-dark` · `wibwob-dark-nord` · `wibwob-dark-pastel` · `wibwob-phosphor` · `wibwob-light`

## Capability profiles

| Profile | What's disabled |
|---|---|
| `docker-safe` | chrome, monster_cam, backrooms, resource-heavy (plasma, companion), file-manager |
| `mvp` | same as docker-safe |
| `full` / unset | nothing — probe results only |
