---
name: ww-build-test
description: Build and verify WibWob-DOS in one shot. Compiles C++ TUI app, runs ctests, checks API health, runs IPC smoke tests, validates state JSON, and optionally captures screenshots for visual review. Use when user says "build", "build and test", "verify build", "ww-build-test", or after editing C++ files that need compilation.
---

# ww-build-test

One-shot build, test, and verify cycle for WibWob-DOS.

## Modes

| Mode | What runs |
|------|-----------|
| `quick` | build + ctest + health check |
| `standard` | quick + API smoke + IPC smoke |
| `strict` | standard + parity checks + planning brief validation + `gh status` |
| `screenshot` | quick + TUI screenshot capture for visual review |

Default: `quick`

## Pipeline

### 1. Build (always)
```bash
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release 2>&1
cmake --build ./build 2>&1
```
On failure: parse compiler errors, report file:line + message. Check if new .cpp missing from CMakeLists.

### 2. Ctests (always)
```bash
cd ./build && ctest --output-on-failure 2>&1
```

### 3. API health (quick+)
```bash
curl -sf http://127.0.0.1:8089/health
```
If not running and mode >= `standard`: `./start_api_server.sh &` then retry.

### 4. IPC smoke (standard+)
Requires TUI app + API server running:
```bash
uv run tools/api_server/test_ipc.py 2>&1
```

### 5. State validation (standard+)
```bash
curl -sf http://127.0.0.1:8089/state | python3 -m json.tool > /dev/null
```

### 6. Browser smoke (standard+, optional)
```bash
curl -sf -X POST http://127.0.0.1:8089/browser/fetch_ext \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","reader":"readability"}'
```

### 7. Parity check (strict only)
Read `app/command_registry.cpp` capabilities, compare against:
- Menu items in `test_pattern_app.cpp`
- MCP tools in `tools/api_server/mcp_tools.py`
Report symmetric diff.

### 8. Planning brief check (strict only)
For any changed `*-brief.md` files (via `git diff --name-only`):
- Verify `Status:`, `GitHub issue:`, `PR:` headers present
- Verify every `AC-` line has a `Test:` line
- Print `gh status` summary

### 9. Screenshot (screenshot mode)
```bash
curl -sf -X POST http://127.0.0.1:8089/screenshot
```
Produces three files per capture:
- `screenshots/tui_{timestamp}.png` — visual review
- `screenshots/tui_{timestamp}.txt` — plain text
- `screenshots/tui_{timestamp}.ans` — ANSI color

Read `.txt` for quick verification. Show `.png` path for visual review.

## Output Format

```
BUILD
  status:    PASS/FAIL
  errors:    N compiler errors
  warnings:  N warnings

TESTS
  ctest:     N/N passed
  api:       OK / NOT RUNNING / FAIL
  ipc:       OK / SKIPPED / FAIL
  state:     VALID / SKIPPED / FAIL
  browser:   OK / SKIPPED / FAIL

PARITY (strict only)
  drift:     NONE / [list missing surfaces]

PLANNING (strict only)
  briefs:    OK / [list issues]

SCREENSHOT
  latest:    screenshots/tui_YYYYMMDD_HHMMSS.png
```

Each failed stage includes:
- `stage`: build/api/ipc/browser/planning
- `evidence`: command + key stderr line
- `next_action`: concrete fix hint

## Paths
- Build: `./build`
- Binary: `./build/app/test_pattern`
- API: `./start_api_server.sh` (port 8089)
- Screenshots: `./screenshots/`
- Debug: `./build/app/test_pattern 2> /tmp/wibwob_debug.log`
- Socket: `/tmp/test_pattern_app.sock`
