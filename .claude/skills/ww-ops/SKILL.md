---
name: ww-ops
description: |
  Build, test, launch, and operate WibWob-DOS. Covers: bun typecheck,
  app launch, health check, local agent smoke test, Docker VPS smoke test,
  screenshots, tmux ops.
  Use when: "build", "test", "launch", "start", "screenshot", "smoke test",
  "verify", "health check", or after editing TypeScript files.
---

# ww-ops — Build, Test, Launch, Operate

WibWob-DOS is a TypeScript/Bun app. No cmake, no C++, no make. Forget the old stack.

## 1. TYPECHECK

Always run before committing.

```bash
bun run typecheck    # tsc --noEmit — must be zero errors
```

## 2. LAUNCH (local dev)

```bash
# Development (watch mode)
bun run dev

# One-shot
bun run start

# In a tmux session (standard approach)
tmux new-session -d -s wibwob -x 254 -y 68 'bun run start'
```

The app binds the control API on `127.0.0.1:8099` by default.
To run a second instance (e.g. for room-chat tests): `CONTROL_API_PORT=8098 bun run start`

## 3. HEALTH CHECK

```bash
curl -sf http://127.0.0.1:8099/health
curl -sf http://127.0.0.1:8099/state | python3 -m json.tool
```

Health returns `{"ok":true,"sessionId":"abc","instanceLabel":"..."}`.
Wait up to 15s on first launch.

## 4. RESTART (live session)

```bash
APP_PID=$(ps aux | grep "bun run src/app.ts" | grep -v grep | awk '{print $2}')
kill $APP_PID && sleep 3
tmux send-keys -t wibwob 'bun run start' Enter
sleep 8 && curl -sf http://127.0.0.1:8099/health
```

Use SIGTERM (`kill $PID`), never `kill -9` as first resort — blessed needs clean shutdown.
If terminal is mangled after crash: `reset`

## 5. LOCAL AGENT SMOKE TEST

**LOCAL TMUX ONLY — not Docker.** Spins up a fresh headless instance on port 8098.

```bash
./tests/agent-smoke/run.sh
```

11 test cases: agent window open, /help, /session, /tools, /model, /clear,
simple prompt, /stop abort, /new, session log check, sender label.
Results in `tests/agent-smoke/results/<timestamp>/`.

## 6. DOCKER SMOKE TEST

Tests the Hetzner VPS deployment stack locally. Requires Docker with arm64 support
(native on Apple Silicon, QEMU on Intel).

```bash
# 1. Build smoke image (Ubuntu 24.04/arm64 — mirrors Hetzner wibwob1)
docker build --platform linux/arm64 -t wibwob-vps-smoke -f deploy/Dockerfile.smoke .

# 2. Run container
docker run --platform linux/arm64 -t -d \
  -p 127.0.0.1:2849:22 \
  -p 127.0.0.1:7681:7681 \
  --name wibwob-smoke wibwob-vps-smoke

# 3. Wait ~15s for app to boot, then check ttyd
sleep 15
curl -sf http://127.0.0.1:7681/ && echo "ttyd OK"

# 4. SSH in with test key (key is in deploy/)
ssh -i deploy/test_agent_key -p 2849 \
  -o StrictHostKeyChecking=no \
  wibwob@127.0.0.1

# 5. From inside container: hit control API
curl http://127.0.0.1:8099/health
curl -s http://127.0.0.1:8099/state | python3 -m json.tool

# 6. Verify capability gating (docker-safe profile)
curl -s http://127.0.0.1:8099/commands/list | \
  python3 -c "import sys,json; cmds=json.load(sys.stdin); print([c['id'] for c in cmds if 'chrome' in c['id'] or 'backrooms' in c['id'] or 'monster' in c['id']])"
# Should return [] — those commands are gated off by WIBWOB_DEPLOY_PROFILE=docker-safe

# 7. Cleanup
docker stop wibwob-smoke && docker rm wibwob-smoke
```

**What the smoke image provides:**
- Port 2849 → SSH (key auth only, test key at `deploy/test_agent_key`)
- Port 7681 → ttyd web terminal (xterm.js, full TUI in browser)
- Port 8099 → control API (internal only — access via SSH or add `-p 127.0.0.1:8099:8099`)
- `WIBWOB_DEPLOY_PROFILE=docker-safe` → disables chrome, monster_cam, backrooms

**Known issue:** ttyd has a resize race — blessed initialises before WebSocket sends
terminal dimensions. First paint may be blank for ~10s. This is a known gotcha,
not a failure.

## 7. SCREENSHOT

```bash
# Via control API
curl -sf -X POST http://127.0.0.1:8099/screenshot \
  -H "Content-Type: application/json" \
  -d '{"path":"scratch/captures/snap.txt"}'

# Or use the ww-screenshot skill for targeted window crops
```

## 8. KEY PATHS

| What | Path |
|------|------|
| App entry | `src/app.ts` |
| Control API | `src/services/control-api.ts` (port 8099) |
| Config | `.env` |
| Scratch / runtime outputs | `scratch/` (gitignored) |
| Workspaces | `scratch/workspaces/` |
| Agent smoke results | `tests/agent-smoke/results/` |
| Deploy stack | `deploy/` |
| Docker smoke image | `deploy/Dockerfile.smoke` |
| Capability profiles | `config/capability-profiles/` |
| tmux session name | `wibwob` |
