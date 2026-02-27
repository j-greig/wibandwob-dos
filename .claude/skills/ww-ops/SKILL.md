---
name: ww-ops
description: |
  Build, test, launch, and operate WibWob-DOS. Covers: C++ build + ctest,
  API server launch, smoke testing, screenshots, tmux monitor, Docker ops.
  Use when: "build", "test", "launch", "start", "screenshot", "smoke test",
  "verify", "health check", or after editing C++ files.
---

# ww-ops — Build, Test, Launch, Operate

Everything needed to run WibWob-DOS, in one place.

## 1. BUILD

```bash
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release 2>&1
cmake --build ./build -j$(sysctl -n hw.ncpu 2>/dev/null || nproc) 2>&1
cd ./build && ctest --output-on-failure 2>&1
```

Binary: ./build/app/wwdos

## 2. LAUNCH (local dev)

```bash
# Quick: TUI + API in one shot
./scripts/dev-start.sh

# Manual:
./build/app/wwdos 2>/tmp/wibwob_debug.log    # in a terminal/tmux pane
tools/api_server/venv/bin/uvicorn tools.api_server.main:build_app \
  --factory --host 127.0.0.1 --port 8089      # in another pane
```

### 4-pane tmux monitor

```bash
.claude/skills/ww-ops/scripts/monitor.sh       # opens split view
```

```
+---------------------+------------------+
|                     |  CHAT LOG tail   |
|   TUI (live)        +------------------+
|                     |  APP DEBUG tail  |
|                     +------------------+
|                     |  COMMANDS        |
+---------------------+------------------+
```

## 3. HEALTH CHECK

```bash
curl -sf http://127.0.0.1:8089/health
curl -sf http://127.0.0.1:8089/state | python3 -m json.tool > /dev/null
```

## 4. SCREENSHOT

```bash
# Via API
curl -sf -X POST http://127.0.0.1:8089/screenshot \
  -H "Content-Type: application/json" \
  -d '{"path": "logs/screenshots/capture.txt"}'

# Via script
.claude/skills/ww-ops/scripts/capture.sh
```

Screenshots land in logs/screenshots/tui_YYYYMMDD_HHMMSS.txt
(ANSI export disabled by default — .txt only)

## 5. SMOKE TEST

```bash
# Full visual parade (29 window types + 15 commands)
python3 tools/smoke_parade.py --delay 1.5

# Jump to specific step
python3 tools/smoke_parade.py --delay 1.0 --start 28

# Contract parity tests (no running TUI needed)
tools/api_server/venv/bin/pytest tests/contract/test_window_type_parity.py -v
```

## 6. API SMOKE

```bash
# Quick endpoint check
curl -sf http://127.0.0.1:8089/state | python3 -m json.tool

# Browser flow
.claude/skills/ww-ops/scripts/smoke_api.sh \
  --base http://127.0.0.1:8089 \
  --open-url https://symbient.life \
  --format text
```

## 7. DOCKER (headless/CI)

```bash
make up-real                    # real C++ backend
make up-real && make provision && make deploy && make test   # full gate
```

## 8. VERIFY MODES

| Mode | What runs |
|------|-----------|
| quick | build + ctest + health check |
| standard | quick + API smoke + state validation |
| strict | standard + parity tests + planning brief validation |

## Key Paths

| What | Path |
|------|------|
| Binary | ./build/app/wwdos |
| API server | tools/api_server/main.py (port 8089) |
| IPC socket | /tmp/wwdos.sock |
| Screenshots | logs/screenshots/ |
| Debug log | /tmp/wibwob_debug.log |
| Smoke results | logs/smoke_parade/ |
| Contract tests | tests/contract/ |

## Critical Gotcha: /menu/command double-wrapped envelope

POST /menu/command wraps C++ IPC result in a Python envelope.
The inner result is a JSON STRING, not a top-level object:

  {"ok": true, "result": "{\"messages\":[...]}"}

Always: json.loads(outer["result"]) to get inner data.

## Known Crashers (skip in automated tests)

- micropolis_ascii: SIGBUS in Micropolis::clearMap() during init
- room_chat: blink timer UAF on rapid close (partially fixed)
