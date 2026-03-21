---
name: ww-ops
description: |
  Build, test, launch, and operate WibWob-DOS. Covers: bun typecheck,
  app launch, health check, restart, reload, screenshots, tmux session
  management, dual-instance setup, Docker VPS smoke test.
  Use when: "build", "test", "launch", "start", "restart", "screenshot",
  "smoke test", "verify", "health check", "tmux", or after editing TypeScript files.
---

# ww-ops — Build, Test, Launch, Operate

WibWob-DOS is a TypeScript/Bun app. Runtime: Bun. Renderer: blessed. Entry: `src/app.ts`.

## 1. TYPECHECK

Always run before committing.

```bash
bun run typecheck    # tsc --noEmit — must be zero errors
```

## 2. LAUNCH

### Preferred scripts (use these, not raw tmux commands)

| Script | What | Idempotent? |
|--------|------|-------------|
| `bash scripts/ensure-running.sh` | Start if not running, no-op if alive | ✅ Yes |
| `bash scripts/restart.sh` | Stop → relaunch → verify new instance | No (kills first) |
| `bash scripts/reload-microapp.sh <id>` | Close windows → reload code → reopen | ✅ Yes |
| `bash scripts/attach.sh` (alias: `wwdos`) | Attach to tmux (starts if needed) | ✅ Yes |

`ensure-running.sh` handles ALL cases: no tmux server, no session, session
exists but app dead, app already running. Multiple agents can call it safely —
first wins, rest see "already running."

### Manual launch (no existing session)

```bash
tmux new-session -d -s wibwob -x 205 -y 55
tmux send-keys -t wibwob 'bun run dev:world' Enter
sleep 10 && curl -sf --max-time 5 http://127.0.0.1:8099/health
```

### ⚠ Multi-agent rule

If another agent owns the tmux session, do NOT restart or kill processes.
Use API calls only (`curl http://127.0.0.1:8099/...`) for inspection.
Check with the human before running `restart.sh` or `ensure-running.sh`.

## 3. HEALTH CHECK

```bash
curl -sf http://127.0.0.1:8099/health
curl -sf http://127.0.0.1:8099/state | python3 -m json.tool
```

Health returns `{"ok":true,"instanceId":"abc","instanceLabel":"..."}`.
Wait up to 15s on first launch.

## 4. RESTART

Use `bash scripts/restart.sh` (preferred). Manual pattern:

```bash
APP_PID=$(ps aux | grep "bun run src/app.ts" | grep -v grep | awk '{print $2}')
kill $APP_PID && sleep 3
tmux send-keys -t wibwob 'bun run dev:world' Enter
sleep 10 && curl -sf --max-time 5 http://127.0.0.1:8099/health
```

Use SIGTERM (`kill $PID`), never `kill -9` as first resort — blessed needs
clean shutdown to release mouse tracking escape codes.
If terminal is mangled after crash: `reset`

### When to restart vs reload

| Changed | Action |
|---------|--------|
| `microapps/*/index.ts` or `microapp.json` | Reload: `bash scripts/reload-microapp.sh <id>` |
| `src/core/*`, `src/services/*`, `src/windows/*` | RESTART required |
| Theme files, `package.json`, `tsconfig.json` | RESTART required |

## 5. SCREENSHOT

### Full TUI text dump

```bash
curl -sf --max-time 5 -X POST http://127.0.0.1:8099/screenshot \
  -H "Content-Type: application/json" \
  -d '{"path":"scratch/captures/snap.txt"}'
```

### Single window crop (targeted, small context)

```bash
# By window id
./scripts/screenshot-window.sh 2

# By title substring (case-insensitive, first match)
./scripts/screenshot-window.sh "poetry"
```

Returns plain-text crop of the window rect — no ANSI escapes, no chrome
outside bounds. Small enough to paste anywhere or hand to another agent.

How it works: resolves window id via `GET /state`, calls
`GET /screenshot/text?id=N` (server-side crop), strips ANSI client-side.

### Spatial map

```bash
bash scripts/minimap.sh          # ASCII layout of all windows
bash scripts/overlap-check.sh    # detect overlapping windows
```

### macOS display capture (PNG)

```bash
# Built-in laptop screen (usually display 2 when external connected)
screencapture -x -D 2 /tmp/shot.png
# Or use the script:
bash scripts/capture-tui-png.sh --display 2
```

James uses a MacBook Air with external display. TUI terminal (Ghostty)
runs on the **laptop built-in screen**. When external is connected:
built-in = D2, external = D1. Laptop only: no `-D` flag needed.

## 6. LOCAL AGENT SMOKE TEST

**LOCAL TMUX ONLY — not Docker.** Spins up a fresh headless instance on port 8098.

```bash
./tests/agent-smoke/run.sh
```

11 test cases: agent window open, /help, /session, /tools, /model, /clear,
simple prompt, /stop abort, /new, session log check, sender label.
Results in `tests/agent-smoke/results/<timestamp>/`.

## 7. DOCKER SMOKE TEST

Tests the Hetzner/VPS deployment stack locally. Requires Docker with arm64 support.

Canonical command (hosting-agnostic smoke skill):

```bash
bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh docker-vps
```

Manual image flow (fallback only):

```bash
docker build --platform linux/arm64 -t wibwob-smoke-image -f deploy/Dockerfile.smoke .
docker run --platform linux/arm64 -t -d \
  -p 127.0.0.1:2849:22 -p 127.0.0.1:7681:7681 \
  --name wibwob-smoke wibwob-smoke-image
sleep 15 && curl -sf --max-time 5 http://127.0.0.1:7681/ && echo "ttyd OK"
# SSH: ssh -i deploy/test_agent_key -p 2849 -o StrictHostKeyChecking=no wibwob@127.0.0.1
# Cleanup: docker stop wibwob-smoke && docker rm wibwob-smoke
```

`WIBWOB_DEPLOY_PROFILE=docker-safe` disables chrome, monster_cam, backrooms.

## 8. DUAL-INSTANCE SETUP

Two instances for IRC relay / room-chat tests. Each needs its own tmux
window, API port, and scratch dir.

```bash
bash scripts/start-alt-instance.sh
```

Verify both:
```bash
curl -s http://127.0.0.1:8099/health   # main
curl -s http://127.0.0.1:8098/health   # alt
```

Alt uses: `WIBWOB_INSTANCE_LABEL=zuk CONTROL_API_PORT=8098 SCRATCH_DIR=scratch/alt`

## 9. ENVIRONMENT

| Var | Default | Purpose |
|-----|---------|---------|
| `CONTROL_API_PORT` | `8099` | HTTP control API port |
| `SCRATCH_DIR` | `scratch` | Base dir for workspaces, state, logs |
| `WIBWOB_INSTANCE_LABEL` | unset | IRC nick prefix and API instanceLabel |
| `WIBWOB_CHAT_TRANSPORT` | `local` | `local` or `irc` |

## 10. KEY PATHS

| What | Path |
|------|------|
| App entry | `src/app.ts` |
| Control API | `src/services/control-api.ts` (port 8099) |
| Scratch / runtime | `scratch/` (gitignored) |
| Workspaces | `scratch/workspaces/` |
| Agent smoke results | `tests/agent-smoke/results/` |
| Deploy stack | `deploy/` |
| tmux session | `wibwob` |

## 11. CONVENIENCE SCRIPTS

```bash
bun run dev               # basic launch (no IRC)
bun run dev:world         # main instance with IRC (port 8099, label=main)
bun run dev:world:alt     # alt instance with IRC (port 8098, label=zuk)
bash scripts/list-scripts.sh  # index of all scripts with descriptions
```
