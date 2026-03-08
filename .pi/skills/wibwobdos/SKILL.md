---
name: wibwobdos
description: Operate WibWob-DOS — a shared terminal desktop with overlapping windows, generative art, a 3D world with chat rooms, and an embedded AI agent. Use to open windows, move them, read desktop state, send messages to the agent chat, capture screenshots, and post to Discord. Triggers on: "open WibWobWorld", "show the desktop", "take a screenshot", "share to Discord", "what's on screen", "open some art", "send a chat message".
compatibility: Requires bash, curl, python3. pip install Pillow for PNG screenshots.
---

# WibWob-DOS skill

Control surface for the live shared terminal desktop at `https://dos.wibandwob.com`.
Everything is HTTP. The API is self-describing — `GET /api/help` lists all endpoints.

## Connect

Credentials are in repo root `.env` (gitignored). Just:

```bash
eval "$(bash .pi/skills/wibwobdos/scripts/connect.sh)"
# → exports WIBWOB_API + WIBWOB_TOKEN
```

For a private/local instance, set `WIBWOB_SSH_KEY` + `WIBWOB_HOST` + `WIBWOB_PORT`
before running connect.sh — it will tunnel and fetch the token via SSH.

## Always do this first

```bash
# Health — sessionId + deployProfile live HERE not in /state
curl -s "$WIBWOB_API/health"

# Minimap — window fields are left/top/width/height at top level (no rect key)
curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" "$WIBWOB_API/state" | python3 -c "
import json,sys
d=json.load(sys.stdin); s=d['screen']
print(f'desktop {s[\"width\"]}x{s[\"height\"]}  {len(d[\"windows\"])} windows')
for w in d['windows']:
    f='◀' if w.get('focused') else ' '
    print(f'  {f}[{w[\"id\"]:>2}] {w.get(\"title\",\"?\"):<28} @{w.get(\"left\",0)},{w.get(\"top\",0)}  {w.get(\"width\",0)}x{w.get(\"height\",0)}')
"

# Commands available under current profile
curl -s -H "Authorization: Bearer $WIBWOB_TOKEN" "$WIBWOB_API/commands/list"
```

## Core patterns

```bash
H="Authorization: Bearer $WIBWOB_TOKEN"

# Open a window
curl -s -H "$H" -X POST "$WIBWOB_API/commands/run" \
  -H "Content-Type: application/json" -d '{"id":"microapp.wibwobworld.open"}'

# Batch move/resize (preferred over chained individual calls)
curl -s -H "$H" -X POST "$WIBWOB_API/windows/batch" \
  -H "Content-Type: application/json" \
  -d '{"ops":[{"action":"move","id":3,"x":5,"y":2},{"action":"resize","id":3,"w":60,"h":20}]}'

# Read a window's text content
curl -s -H "$H" "$WIBWOB_API/windows/text?id=3"
```

## Window readiness — poll, never sleep

No `/windows/ready` endpoint exists. Two-stage poll:

```bash
# Stage 1: window exists in /state
for i in $(seq 1 20); do
  FOUND=$(curl -s -H "$H" "$WIBWOB_API/state" | python3 -c \
    "import json,sys; ws=json.load(sys.stdin)['windows']; \
     print('yes' if any(w.get('appType')=='wibwobworld' for w in ws) else 'no')")
  [[ "$FOUND" == "yes" ]] && break; sleep 0.5
done

# Stage 2: window has content
for i in $(seq 1 20); do
  TEXT=$(curl -s -H "$H" "$WIBWOB_API/windows/text?id=N" | \
    python3 -c "import json,sys; print(json.load(sys.stdin).get('text',''))" 2>/dev/null)
  [[ -n "$TEXT" ]] && break; sleep 0.5
done
```

## Convenience scripts

| Goal | Command |
|---|---|
| Desktop state | `bash scripts/state.sh` |
| Open window | `bash scripts/open.sh <command-id>` |
| List commands | `bash scripts/open.sh --list` |
| Send text | `bash scripts/send.sh <window-id> <text>` |
| Read window | `bash scripts/export.sh <window-id>` |
| Full TUI text | `bash scripts/screenshot.sh` |
| PNG capture | `bash scripts/png.sh [window-id] [out.png]` |
| Share to Discord | `bash scripts/discord.sh [minimap\|png\|both]` |

Scripts wrap the API. If a script doesn't cover it, call the API directly.

## Key command IDs

Authoritative list: `GET /api/commands/list` — always reflects the active profile.

```
microapp.wibwobworld.open   3D terrain world with chatspots
contour.open                contour terrain lab
pattern.open                animated ASCII patterns
backrooms.run               AI backrooms session
primer.open                 open ASCII art file (requires filePath arg)
theme.set                   change theme (name arg: wibwob-dark, wibwob-phosphor, etc.)
```

**Disabled in docker-safe profile:** `plasma.open`, `companion.open`, `finder.open`

## Logs (hosted container)

```bash
# Primary log (APP/CMD/MSG/SYS/API/ERR)
ssh -p 2849 root@89.167.18.207 \
  "docker exec wibwob-deploy-wibwob-1 \
   cat /opt/wibandwob-dos/logs/tui-app/$(date +%Y-%m-%d).log"
```

## References

- `references/api.md` — full endpoint catalogue + /state response shape
