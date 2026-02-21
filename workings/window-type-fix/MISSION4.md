# MISSION4: API/MCP Connection Status Indicator in TUI

> **For the next Claude session**: Read this entire file before doing anything.
> Find the first task with status `todo`, execute it, update this file, continue.
> Never skip a task. Never guess — validate with builds, screenshots, and API calls.

---

## The Feature

Currently you can only tell if the API server is connected by looking at the backend terminal running `start_api_server.sh`. There's no visual indicator in the TUI itself. When the AI agent is connected and ready, the human should see it at a glance.

**Goal**: A discreet, always-visible status indicator showing API/IPC/MCP connection state.

---

## Design

### Placement

Two candidates — implement **both** and pick the one that feels right:

**Option A — Menu bar, left of kaomoji** (top-right):
```
 File  Edit  View  Window  Tools  Help          API ● つ◕‿◕‿◕༽つ
```
The kaomoji already draws at `size.x - 12`. Place the API indicator at `size.x - 18` or so.

JAMES: DO OPTION B ONLY! Remove quantum print from bottom line too to make room. remove F10/menu from bottom line too

**Option B — Status line, far right** (bottom-right):
```
 Alt-X Exit  Ctrl-N New  F5 Repaint  F6 Next  ...          IPC ● MCP ●
```

### States

| State | Display | Colour | Meaning |
|-------|---------|--------|---------|
| IPC listening, no API connected | `API ○` | dim/grey | Socket open but no HTTP server polling |
| API connected (health OK) | `API ●` | green | Python API server is connected and healthy |
| API error / disconnected | `API ✗` | red | Socket error or API server crashed |
| MCP mounted | `MCP` | green (appended) | MCP endpoint is active |

### Detection Logic

The C++ TUI already has the IPC socket (`ApiIpcServer`). It knows:
- Whether the socket is listening (`fd_listen_ >= 0`)
- Whether clients have connected (track in `poll()`)
- Last successful command timestamp (add a field)

For API health: the Python server periodically calls `get_state` via IPC. Track recency of last IPC command — if >10s since last command, mark as "no API". This avoids the TUI needing to make outbound HTTP calls.

### Implementation Approach

1. Add connection state tracking to `ApiIpcServer` (last command time, client count)
2. Expose state via a method: `ApiIpcServer::getConnectionStatus()`
3. Draw the indicator in `TCustomMenuBar::draw()` (next to kaomoji) or `TCustomStatusLine::draw()`
4. Update on each `idle()` cycle (already calls `ipcServer->poll()`)

---

## Known Facts

- Kaomoji draws at `size.x - 12` in `TCustomMenuBar::draw()` (line ~310 of test_pattern_app.cpp)
- Status line defined at line 2299: `TCustomStatusLine` extending `TStatusLine`
- `ApiIpcServer::poll()` runs every idle cycle — natural place to update timestamps
- `fd_listen_` is -1 when not listening, >=0 when socket is open
- `event_subscribers_` vector tracks persistent connections (event push clients)
- The app already tracks `ipcServer` as a member of `TTestPatternApp`

---

## Task Queue

```json
[
  {
    "id": "M4-T01",
    "title": "Add connection state tracking to ApiIpcServer",
    "status": "done",
    "instructions": [
      "Edit app/api_ipc.h:",
      "  Add public struct ConnectionStatus { bool listening; bool api_active; int client_count; }",
      "  Add public method: ConnectionStatus getConnectionStatus() const",
      "  Add private fields: std::chrono::steady_clock::time_point last_command_time_; int total_commands_;",
      "Edit app/api_ipc.cpp:",
      "  In poll(), after successful command handling, update last_command_time_ = now",
      "  In getConnectionStatus(): listening = (fd_listen_ >= 0), api_active = (now - last_command_time_ < 10s), client_count = event_subscribers_.size()",
      "Build: cmake --build build 2>&1 | tail -5"
    ],
    "expected_output": "Build succeeds. ApiIpcServer now tracks connection state."
  },
  {
    "id": "M4-T02",
    "title": "Draw API status indicator in menu bar next to kaomoji",
    "status": "done",
    "instructions": [
      "Edit app/test_pattern_app.cpp TCustomMenuBar::draw()",
      "After the kaomoji drawing block, add API indicator drawing:",
      "  Get ipcServer connection status from the app (need to pass reference or use global)",
      "  Draw 'API' text + status dot (● or ○ or ✗) to the left of the kaomoji",
      "  Use green attr for active, grey for idle, red for error",
      "  Position: xPos = size.x - kaomojiWidth - 6 (for 'API ● ')",
      "  Use TColorRGB for green (0,200,0), grey (128,128,128), red (200,0,0)",
      "Build and run. Take screenshot to verify indicator appears.",
      "Test with API server running and stopped — verify colour changes"
    ],
    "expected_output": "Menu bar shows 'API ●' in green when API is connected. Grey when not."
  },
  {
    "id": "M4-T03",
    "title": "Make indicator update live without full redraw",
    "status": "done",
    "instructions": [
      "The menu bar's draw() is called during update() which runs on idle",
      "Verify the indicator changes state when API server starts/stops",
      "If it doesn't update: ensure TCustomMenuBar::update() calls drawView()",
      "The existing blink timer already causes periodic redraws — indicator should piggyback",
      "Test cycle: start TUI -> no API (grey) -> start API -> API ● (green) -> kill API -> API ✗ (red/grey)",
      "Take screenshots at each state"
    ],
    "expected_output": "Indicator transitions between states within ~5 seconds of state change."
  },
  {
    "id": "M4-T04",

    "title": "Add MCP indicator (optional, if space permits)",
    "status": "done",
    "instructions": [
      "The MCP server is mounted on the Python side — C++ can't directly detect it",
      "Option: when API is active and responding to commands, assume MCP is mounted (it's wired in main.py)",
      "If space allows: show 'API ● MCP' when API is active, just 'API ○' when not",
      "Keep it discreet — the kaomoji is the star, indicator is supporting cast",
      "Adjust positioning to avoid overlap with kaomoji or menu items",
      "Build, screenshot, verify"
    ],
    "expected_output": "Clean, discreet indicator that doesn't crowd the menu bar."
  },
  {
    "id": "M4-T05",
    "title": "Final polish and commit",
    "status": "done",
    "instructions": [
      "Review the indicator at different terminal widths (80, 120, 160 cols)",
      "Ensure it gracefully hides when terminal is too narrow (< 80 cols)",
      "Verify no flicker or rendering artifacts",
      "Run parity tests: uv run --with pytest pytest tests/contract/ -q",
      "Build clean: cmake --build build 2>&1 | tail -5",
      "Commit: feat(ui): add API connection status indicator to menu bar",
      "Take final screenshot for evidence"
    ],
    "expected_output": "Clean commit. Indicator works at all reasonable terminal widths."
  }
]
```

---

## Design Reference

### Current menu bar right side (line ~310):
```cpp
const char* kaomoji = getKaomojiForState();
int kaomojiWidth = 12;
int xPos = size.x - kaomojiWidth;
// draws kaomoji at top-right
```

### Target layout:
```
... Help          API ● つ◕‿◕‿◕༽つ
                  ^^^^^^ ^^^^^^^^^^^^
                  new    existing
                  (6ch)  (12ch)
```

### Colour scheme (TrueColor):
```cpp
TColorRGB apiGreen(0, 180, 0);     // connected
TColorRGB apiGrey(100, 100, 100);   // idle/no API
TColorRGB apiRed(200, 50, 50);      // error
TColorRGB menuBg(255, 255, 255);    // match menu bar bg
```

---

## Findings Log

### M4-T01 — pending
### M4-T02 — pending
### M4-T03 — pending
### M4-T04 — pending
### M4-T05 — pending

---

## HOW TO CONTINUE THIS MISSION (for new Claude sessions)

1. Read this file completely
2. Find first task with `"status": "todo"` in the Task Queue JSON
3. Follow its `instructions` array step by step
4. After completing, update the task's `"status"` to `"done"` in the JSON
5. Write findings to the Findings Log section
6. Move to next todo task
7. If stuck: launch Codex debugger for architecture analysis

**Repo**: `/Users/james/repos/wibandwob-dos`
**API**: `http://127.0.0.1:8089`
**Build**: `cmake --build /Users/james/repos/wibandwob-dos/build`
**Screenshot**: `bash .claude/skills/screenshot/scripts/capture.sh`
**Key files**:
- `app/test_pattern_app.cpp` — TCustomMenuBar (line ~258), TCustomStatusLine (line ~372), initStatusLine (line ~2299)
- `app/api_ipc.h` / `app/api_ipc.cpp` — IPC server, connection tracking
