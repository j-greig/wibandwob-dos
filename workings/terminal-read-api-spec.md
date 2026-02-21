# Terminal Read API — Implementation Spec

**Status:** Ready to implement
**Author:** Claude Code (2026-02-21)
**Purpose:** Enable the embedded Wib&Wob agent (inside the TUI chat window) to read the contents of a terminal window and send text to a specific terminal by ID.

---

## Problem Statement

The `Window → Terminal` menu option creates a tvterm-backed terminal emulator window. The embedded Claude agent (running inside the `TWibWobWindow` / Scramble chat) can currently use the `tui_terminal_write` MCP tool to inject text into a terminal, but **cannot read what the terminal displays**. This is one-way blind communication — the agent can type but cannot see output.

Two gaps exist:

1. **No read API** — nothing exposes the terminal's cell grid (glyph + color per cell) to IPC/REST/MCP.
2. **No window-ID targeting** — `terminal_write` always hits the most recently created terminal. Multiple terminals are unsupported.

---

## Current Architecture (What Exists)

### C++ layer

**`app/tvterm_view.h` / `app/tvterm_view.cpp`**

```cpp
class TWibWobTerminalWindow : public tvterm::BasicTerminalWindow {
public:
    void sendText(const std::string& text);   // EXISTS — injects chars as KeyDown events
    // MISSING: getOutputText()
};

TWindow* createTerminalWindow(const TRect& bounds);
```

`sendText` works by finding the child `tvterm::TerminalView`, then calling:
```cpp
termView->termCtrl.sendEvent(termEvent);  // one call per character
```

**`vendor/tvterm/include/tvterm/termctrl.h`** — `TerminalController`

```cpp
template <class Func>
auto TerminalController::lockState(Func&& func);
// Locks a mutex, calls func(TerminalState&), returns result.
// IMPORTANT: non-reentrant — do not call from within another lockState callback.
```

**`vendor/tvterm/include/tvterm/termemu.h`** — `TerminalState`

```cpp
struct TerminalState {
    TerminalSurface surface;   // the rendered cell grid
    bool cursorChanged;
    TPoint cursorPos;          // {x=col, y=row}
    bool cursorVisible;
    bool cursorBlink;
    bool titleChanged;
    GrowArray title;           // window title bytes
};
```

`TerminalSurface` inherits privately from `TDrawSurface`:
```cpp
class TerminalSurface : private TDrawSurface {
public:
    using TDrawSurface::size;          // TPoint{x=cols, y=rows}
    using TDrawSurface::at;            // TScreenCell& at(int y, int x)
    RowDamage& damageAtRow(size_t y);  // dirty tracking (optional for read)
};
```

**`vendor/tvision/include/tvision/scrncell.h`** — Cell extraction

```cpp
// From TScreenCell:
const TCellChar& getChar(const TScreenCell& cell);   // glyph
const TColorAttr& getAttr(const TScreenCell& cell);  // colors

// From TCellChar:
TStringView getText() const;          // UTF-8 bytes of this glyph
bool isWideCharTrail() const;         // true for right half of wide (2-col) chars — SKIP these
bool isWide() const;                  // true for left half of wide char
```

So the read loop is:
```cpp
termView->termCtrl.lockState([&](tvterm::TerminalState& state) {
    int rows = state.surface.size.y;
    int cols = state.surface.size.x;
    std::string out;
    for (int y = 0; y < rows; y++) {
        for (int x = 0; x < cols; x++) {
            const TScreenCell& cell = state.surface.at(y, x);
            const TCellChar& ch = getChar(cell);
            if (!ch.isWideCharTrail()) {
                TStringView sv = ch.getText();
                out.append(sv.data(), sv.size());
            }
        }
        out += '\n';
    }
    return out;
});
```

Trailing whitespace per line should be stripped before the `\n`.

**`app/test_pattern_app.cpp`** — Existing terminal API functions (lines ~3540–3567)

```cpp
void api_spawn_terminal(TTestPatternApp& app, const TRect* bounds);
std::string api_terminal_write(TTestPatternApp& app, const std::string& text);
```

`api_terminal_write` uses a Z-order walk to find the first `TWibWobTerminalWindow` — it has no window_id parameter.

The app tracks window IDs via `winToId` / `idToWin` maps (`registerWindow()` assigns them). These maps are the correct lookup mechanism — do NOT use the Z-order scan for ID-targeted commands.

**`app/command_registry.cpp`** — Command capabilities (lines ~32–59, dispatch ~187–196)

```cpp
{"open_terminal",    "Open a terminal emulator window", false},
{"terminal_write",   "Send text input to the terminal emulator (requires text param)", true},
// MISSING:
// {"terminal_read",  "Read the visible text output of a terminal window", false},
```

**`app/api_ipc.cpp`** — IPC socket command dispatch
Terminal commands are dispatched via the generic command registry path. New commands added to `command_registry.cpp` are automatically routed if their dispatch case is added to `exec_registry_command()`.

### Python / API layer

**`tools/api_server/mcp_tools.py`** — MCP tools

```python
@mcp.tool("tui_terminal_write")
async def terminal_write_tool(text: str) -> Dict[str, Any]:
    """Send text as keyboard input to the active terminal emulator window"""
    # EXISTS — calls exec_command("terminal_write", {"text": text})

# MISSING:
# @mcp.tool("tui_terminal_read")
# async def terminal_read_tool(window_id: Optional[str] = None) -> Dict[str, Any]:
```

**`tools/api_server/main.py`** — REST endpoints
Terminal access is only via the generic `POST /menu/command`. No dedicated terminal REST endpoint exists.

---

## What to Build

### 1. C++ — `TWibWobTerminalWindow::getOutputText()`

**File:** `app/tvterm_view.h` / `app/tvterm_view.cpp`

Add to header:
```cpp
// Returns the visible text content of this terminal window.
// Each row is separated by '\n'. Wide char trails are skipped.
// Trailing whitespace per row is stripped.
std::string getOutputText() const;
```

Add to implementation:
```cpp
std::string TWibWobTerminalWindow::getOutputText() const
{
    // Find the TerminalView child to access its controller.
    tvterm::TerminalView* termView = nullptr;
    TView* start = const_cast<TWibWobTerminalWindow*>(this)->first();
    if (start) {
        TView* v = start;
        do {
            if (auto* tv = dynamic_cast<tvterm::TerminalView*>(v)) {
                termView = tv;
                break;
            }
            v = v->next;
        } while (v != start);
    }
    if (!termView) return "";

    std::string result;
    termView->termCtrl.lockState([&](tvterm::TerminalState& state) {
        int rows = state.surface.size.y;
        int cols = state.surface.size.x;
        for (int y = 0; y < rows; y++) {
            std::string row;
            for (int x = 0; x < cols; x++) {
                const TScreenCell& cell = state.surface.at(y, x);
                const TCellChar& ch = getChar(cell);
                if (!ch.isWideCharTrail()) {
                    TStringView sv = ch.getText();
                    row.append(sv.data(), sv.size());
                }
            }
            // Strip trailing whitespace
            size_t last = row.find_last_not_of(" \t");
            if (last != std::string::npos)
                row = row.substr(0, last + 1);
            else
                row.clear();
            result += row;
            result += '\n';
        }
    });
    return result;
}
```

**Required includes** in `tvterm_view.cpp` — `termemu.h` is already included. You also need:
```cpp
#define Uses_TScreenCell
// scrncell.h is included transitively via tvision/tv.h — confirm by build
```

### 2. C++ — `api_terminal_read()` and `api_terminal_write()` with window_id

**File:** `app/test_pattern_app.cpp`

Add friend declaration (alongside the existing terminal friends, ~line 783):
```cpp
friend std::string api_terminal_read(TTestPatternApp&, const std::string& window_id);
```

Add implementation (after `api_terminal_write`, ~line 3568):
```cpp
std::string api_terminal_read(TTestPatternApp& app, const std::string& window_id)
{
    TWibWobTerminalWindow* termWin = nullptr;

    if (!window_id.empty()) {
        // Target by registered window ID
        auto it = app.idToWin.find(window_id);
        if (it != app.idToWin.end()) {
            termWin = dynamic_cast<TWibWobTerminalWindow*>(it->second);
        }
        if (!termWin) return "err window not found or not a terminal";
    } else {
        // Fall back: first terminal in Z-order
        TView* start = app.deskTop->first();
        if (start) {
            TView* v = start;
            do {
                if (auto* tw = dynamic_cast<TWibWobTerminalWindow*>(v)) {
                    termWin = tw;
                    break;
                }
                v = v->next;
            } while (v != start);
        }
    }
    if (!termWin) return "err no terminal window";
    return termWin->getOutputText();
}
```

Also **update `api_terminal_write`** to accept an optional `window_id` parameter (same lookup pattern as above). The current signature `api_terminal_write(TTestPatternApp&, const std::string& text)` should become:
```cpp
std::string api_terminal_write(TTestPatternApp& app, const std::string& text, const std::string& window_id = "");
```
And update the friend declaration accordingly.

### 3. C++ — Command Registry

**File:** `app/command_registry.cpp`

In `get_command_capabilities()`, add:
```cpp
{"terminal_read", "Read the visible text content of a terminal window (optional: window_id param)", false},
```

In `exec_registry_command()`, add dispatch case:
```cpp
} else if (cmd == "terminal_read") {
    std::string wid = params.count("window_id") ? params.at("window_id") : "";
    result = api_terminal_read(app, wid);
}
```

Also update the `terminal_write` dispatch to pass through `window_id`:
```cpp
} else if (cmd == "terminal_write") {
    std::string text = params.count("text") ? params.at("text") : "";
    std::string wid  = params.count("window_id") ? params.at("window_id") : "";
    result = api_terminal_write(app, text, wid);
}
```

### 4. Python — MCP Tool

**File:** `tools/api_server/mcp_tools.py`

Add after the `tui_terminal_write` tool (~line 665):
```python
@mcp.tool("tui_terminal_read")
async def terminal_read_tool(window_id: str = "") -> Dict[str, Any]:
    """Read the visible text content of a terminal emulator window.

    Returns the current text visible in the terminal as a plain-text string,
    one row per line with trailing whitespace stripped. The embedded agent
    can use this to see command output after calling tui_terminal_write.

    Args:
        window_id: Optional window ID to target a specific terminal.
                   If omitted, reads from the first open terminal window.

    Returns:
        Dictionary with 'text' key containing terminal output.
    """
    controller = get_controller()
    params = {}
    if window_id:
        params["window_id"] = window_id
    result = await controller.exec_command("terminal_read", params, actor="mcp")
    if not result.get("ok"):
        return _exec_result_error(result)
    return {"success": True, "text": result.get("result", "")}
```

### 5. Python — REST Endpoint (Optional but Recommended)

**File:** `tools/api_server/main.py`

Add a dedicated endpoint for cleaner ergonomics (the generic `/menu/command` route also works):
```python
@app.get("/terminal/{window_id}/output")
async def get_terminal_output(window_id: str = ""):
    """Get the current visible text content of a terminal window."""
    ctl = get_controller()
    params = {}
    if window_id and window_id != "active":
        params["window_id"] = window_id
    result = await ctl.exec_command("terminal_read", params, actor="api")
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "terminal not found"))
    return {"window_id": window_id, "text": result.get("result", "")}
```

Usage examples:
```bash
# Read active/first terminal
curl http://127.0.0.1:8089/terminal/active/output

# Read specific terminal by ID
curl http://127.0.0.1:8089/terminal/win_3/output

# Via generic command route (also works)
curl -X POST http://127.0.0.1:8089/menu/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"terminal_read","args":{"window_id":"win_3"}}'
```

---

## Wib&Wob Chat Usage Pattern

Once implemented, the embedded Claude agent can do this from the TUI chat window using MCP tools:

```
1. tui_create_window(window_type="terminal")
   → returns {"window_id": "win_5", ...}

2. tui_terminal_write(text="ls -la\n", window_id="win_5")
   → injects command

3. [wait ~200ms for shell to respond]

4. tui_terminal_read(window_id="win_5")
   → returns {"text": "total 48\ndrwxr-xr-x  8 james ...\n..."}
```

The agent can now see command output, check for errors, and act on results.

---

## Includes Required in `tvterm_view.cpp`

The following are already present via `tvision/tv.h` or explicit includes:
- `TEvent`, `TRect`, `TPoint`, `TWindow`, `TKeys` — yes (lines 1–8)
- `tvterm/termctrl.h` — yes (line 11)
- `tvterm/termview.h` — yes (line 12)
- `tvterm/termemu.h` — yes (line 13)

For `getChar` / `TScreenCell` / `TCellChar`:
- Add `#define Uses_TScreenCell` before `#include <tvision/tv.h>` if not already covered
- `getChar` and `getAttr` are defined in `tvision/scrncell.h`, included transitively by `Uses_TScreenCell`

Verify by checking if the build gives undefined symbol errors for `getChar` — if so, add the define.

---

## Scope Boundaries (Do Not Over-Build)

- **Text only** — Return the visible cell grid as plain UTF-8 text. Do not return color/attribute data unless a follow-up spec requests it.
- **Visible surface only** — Do not attempt scrollback history. tvterm's `TerminalSurface` only holds the current viewport; scrollback is managed by the PTY emulator (vterm) and not directly accessible via this surface.
- **No event streaming** — Do not implement WebSocket push for terminal output. Read-on-demand is sufficient.
- **No PTY process tracking** — Do not expose PID or process status. Out of scope.

---

## Files to Touch

| File | Change |
|---|---|
| `app/tvterm_view.h` | Add `getOutputText() const` declaration |
| `app/tvterm_view.cpp` | Implement `getOutputText()` |
| `app/test_pattern_app.cpp` | Add `api_terminal_read()`, update `api_terminal_write()` signature, add friend decls |
| `app/command_registry.cpp` | Add `terminal_read` capability + dispatch, update `terminal_write` dispatch for `window_id` |
| `tools/api_server/mcp_tools.py` | Add `tui_terminal_read` MCP tool |
| `tools/api_server/main.py` | Add `GET /terminal/{window_id}/output` endpoint |

Total: 6 files. No new files created.

---

## Acceptance Criteria

- [ ] `tui_terminal_read()` MCP tool returns the current visible text of a terminal window
- [ ] `tui_terminal_write(window_id="win_N")` targets a specific terminal (not just the last created)
- [ ] `tui_terminal_read(window_id="win_N")` targets a specific terminal
- [ ] `tui_terminal_read()` with no args falls back gracefully to first open terminal
- [ ] `terminal_read` command appears in `get_state()` capability list
- [ ] `GET /terminal/active/output` returns 200 with text when a terminal is open
- [ ] `GET /terminal/active/output` returns 404 when no terminal is open
- [ ] Wide chars (2-column CJK etc.) are handled correctly — trail cells skipped
- [ ] Build passes: `cmake --build ./build`
- [ ] Smoke test: open terminal, run `echo hello`, read output — response contains "hello"

---

## Test Script (Manual Smoke Test)

```bash
# 1. Start TUI + API server (see CLAUDE.md for full sequence)

# 2. Open a terminal
curl -s -X POST http://127.0.0.1:8089/menu/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"open_terminal"}'

# 3. Get the window ID from state
curl -s http://127.0.0.1:8089/state | python3 -m json.tool | grep -A3 terminal

# 4. Write a command (replace win_N with actual ID)
curl -s -X POST http://127.0.0.1:8089/menu/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"terminal_write","args":{"text":"echo HELLO_FROM_WIBWOB\n","window_id":"win_N"}}'

# 5. Wait for shell output
sleep 0.5

# 6. Read the terminal output
curl -s http://127.0.0.1:8089/terminal/win_N/output | python3 -m json.tool

# Expected: {"window_id":"win_N","text":"...HELLO_FROM_WIBWOB\n..."}
```
