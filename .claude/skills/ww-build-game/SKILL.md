---
name: ww-build-game
description: Build a TUI game view for WibWob-DOS. Covers the full lifecycle from concept to tested, shipped game window with proper TV rendering, input handling, command registry, menu wiring, and screenshot verification. Use when user says "build a game", "add a game", "ww-build-game", or describes wanting a playable game in the TUI.
---

# ww-build-game

Build a playable game view inside WibWob-DOS's Turbo Vision TUI.

## Proven Games Built With This Process

| Game | Complexity | Key Features |
|------|-----------|--------------|
| Quadra (Tetris) | Medium | 7-bag randomizer, SRS rotation, wall kicks, chain gravity, ghost piece |
| Snake | Low-Medium | Gradient body, directional head, food sparkle, speed progression |
| WibWob Rogue | High | BSP dungeons, FOV, creatures, items, terminal integration, 5 floors |

## Lego Bricks (Reusable Patterns)

### 1. TView Game Skeleton

Every game view follows this exact pattern. Copy-paste and customize:

```cpp
// header: game_view.h
class TGameView : public TView {
public:
    explicit TGameView(const TRect &bounds);
    virtual ~TGameView();
    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;
private:
    std::vector<TScreenCell> lineBuf;
    // game state here
};

// constructor MUST have these lines:
TGameView::TGameView(const TRect &bounds)
    : TView(bounds)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable | ofFirstClick;   // CRITICAL for keyboard input
    eventMask |= evBroadcast | evKeyDown;
    // init game state
}
```

**GOTCHA**: Without `options |= ofSelectable | ofFirstClick`, the view will NOT receive keyboard events. This is the #1 cause of "keys don't work" bugs.

### 2. TScreenCell Rendering

The only correct way to render game graphics in Turbo Vision:

```cpp
void TGameView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    if ((int)lineBuf.size() < W)
        lineBuf.resize(W);

    for (int screenY = 0; screenY < H; ++screenY) {
        // Clear line
        for (int sx = 0; sx < W; ++sx)
            setCell(lineBuf[sx], ' ', C_BG);

        // Draw game content per cell
        for (int sx = 0; sx < W; ++sx) {
            char ch = '.';
            TColorAttr attr = TColorAttr(
                TColorRGB(bg_r, bg_g, bg_b),
                TColorRGB(fg_r, fg_g, fg_b)
            );
            setCell(lineBuf[sx], ch, attr);
        }

        writeLine(0, screenY, W, 1, lineBuf.data());
    }
}
```

**NEVER** write raw ANSI escape sequences. Always use `setCell()` + `writeLine()`.

### 3. TColorAttr (RGB colors)

```cpp
// TColorAttr(background, foreground)
TColorAttr attr = TColorAttr(TColorRGB(0x00,0x00,0x00), TColorRGB(0xFF,0xFF,0x00));

// Common game colors
static const TColorAttr C_BG     = TColorAttr(TColorRGB(0x08,0x08,0x08), TColorRGB(0x08,0x08,0x08));
static const TColorAttr C_WALL   = TColorAttr(TColorRGB(0x30,0x30,0x40), TColorRGB(0x60,0x60,0x70));
static const TColorAttr C_PLAYER = TColorAttr(TColorRGB(0x00,0x00,0x00), TColorRGB(0xFF,0xFF,0x00));
static const TColorAttr C_HUD    = TColorAttr(TColorRGB(0x00,0x00,0x00), TColorRGB(0xAA,0xAA,0xAA));
```

### 4. TWindow Wrapper (Factory Pattern)

```cpp
class TGameWindow : public TWindow {
public:
    explicit TGameWindow(const TRect &bounds)
        : TWindow(bounds, "Game Title", wnNoNumber)
        , TWindowInit(&TGameWindow::initFrame) {}

    void setup() {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);        // Inset by 1 for frame
        insert(new TGameView(c));
    }

    virtual void changeBounds(const TRect& b) override {
        TWindow::changeBounds(b);
        setState(sfExposed, True);
        redraw();
    }
};

TWindow* createGameWindow(const TRect &bounds) {
    auto *w = new TGameWindow(bounds);
    w->setup();
    return w;
}
```

### 5. Timer-Based Animation

For games needing continuous updates (Snake, not turn-based like Roguelike):

```cpp
// In constructor:
timerId = setTimer(periodMs, timerId);

// In handleEvent:
if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
    if (ev.message.infoPtr == (void*)(uintptr_t)timerId) {
        tick();
        drawView();
        clearEvent(ev);
    }
}

// In destructor:
if (timerId) killTimer(timerId);
```

### 6. Input Handling

```cpp
void TGameView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);
    if (ev.what == evKeyDown) {
        const ushort key = ev.keyDown.keyCode;
        const uchar ch = ev.keyDown.charScan.charCode;
        bool handled = true;

        if (key == kbUp)         { /* up */ }
        else if (key == kbDown)  { /* down */ }
        else if (key == kbLeft)  { /* left */ }
        else if (key == kbRight) { /* right */ }
        else if (ch == 'r' || ch == 'R') { /* restart */ }
        else { handled = false; }

        if (handled) {
            drawView();
            clearEvent(ev);
        }
    }
}
```

### 7. HUD Rendering

```cpp
// Reserve bottom rows for HUD
const int hudY = H - 1;  // or H - hudHeight
char buf[120];
snprintf(buf, sizeof(buf), " Score:%d  Level:%d  HP:%d/%d",
    score, level, hp, maxHp);
for (int i = 0; buf[i] && i < W; ++i)
    setCell(lineBuf[i], buf[i], C_HUD);
```

**GOTCHA**: Check `hudX + textLen <= W` before writing. Off-by-one here causes HUD to disappear on narrow windows.

### 8. Cross-View Communication (Command Broadcasting)

To trigger app-level actions from a game view (e.g., spawn a terminal window):

```cpp
// In game view:
TEvent ev;
ev.what = evCommand;
ev.message.command = cmMyCustomCommand;
ev.message.infoInt = someData;
putEvent(ev);

// In test_pattern_app.cpp handleEvent:
case cmMyCustomCommand: {
    // App-level action (spawn windows, etc.)
    clearEvent(event);
    break;
}
```

## Wiring Checklist (8 Files to Touch)

Every new game requires changes to these files:

| # | File | Changes |
|---|------|---------|
| 1 | `app/game_view.h` | New header file |
| 2 | `app/game_view.cpp` | New implementation |
| 3 | `app/test_pattern_app.cpp` | Include, cmConstant, menu item, handleEvent case, friend decl, api_spawn function |
| 4 | `app/command_registry.cpp` | extern, capability entry, dispatch case |
| 5 | `app/CMakeLists.txt` | Add .cpp to test_pattern sources |
| 6 | `app/command_registry_test.cpp` | Stub for api_spawn_xxx + test token |
| 7 | `app/scramble_engine_test.cpp` | Stub for api_spawn_xxx |
| 8 | (Optional) `tools/api_server/models.py` | WindowType enum for REST/MCP |

### test_pattern_app.cpp Changes (6 spots):

```cpp
// 1. Include (near line 90)
#include "game_view.h"

// 2. Command constant (near line 225)
const ushort cmGame = 218;  // next available

// 3. Menu item (in initMenuBar, View submenu)
*new TMenuItem("~G~ame Name", cmGame, kbNoKey) +

// 4. handleEvent case (in handleEvent switch)
case cmGame: {
    TRect r = deskTop->getExtent();
    r.grow(-2, -1);
    TWindow* w = createGameWindow(r);
    deskTop->insert(w);
    registerWindow(w);
    clearEvent(event);
    break;
}

// 5. Friend declaration (in class TTestPatternApp)
friend void api_spawn_game(TTestPatternApp& app, const TRect* bounds);

// 6. API spawn function
void api_spawn_game(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 60, 30);
    TWindow* w = createGameWindow(r);
    deskTop->insert(w);
    app.registerWindow(w);
}
```

### command_registry.cpp Changes (3 spots):

```cpp
// 1. Extern declaration
extern void api_spawn_game(TTestPatternApp& app, const TRect* bounds);

// 2. Capability entry (in get_command_capabilities)
{"open_game", "Open Game window", false}

// 3. Dispatch case (in exec_registry_command)
if (name == "open_game") { api_spawn_game(app, boundsPtr); return "ok"; }
```

### Test Stubs (both test files):

```cpp
void api_spawn_game(TTestPatternApp&, const TRect*) {}
// And add test token in command_registry_test.cpp:
"\"name\":\"open_game\"",
```

## Common Gotchas

| Problem | Cause | Fix |
|---------|-------|-----|
| Keys don't work | Missing `ofSelectable \| ofFirstClick` | Add to constructor options |
| HUD disappears | Width check too tight | Use `hudX + minWidth <= W` |
| Segfault on open | Bad random distribution `(a > b)` | Guard `uniform_int_distribution` bounds |
| Linker error | Missing test stubs | Add stub in both test .cpp files |
| Game doesn't redraw | Not calling `drawView()` | Call after every state change |
| Wrong key codes | Mixing keyCode vs charCode | Use `kbUp/kbDown` for arrows, `charScan.charCode` for letters |
| Build fails | Missing .cpp in CMakeLists | Add to test_pattern sources |
| Socket "already in use" | Stale socket from crashed session | `rm -f /tmp/test_pattern_app.sock*` |

## BSP Dungeon Generation (Roguelike Pattern)

Safe BSP that avoids undefined behavior:

```cpp
void generateBSP(int x, int y, int w, int h, int depth) {
    if (w < 6 || h < 5) return;  // too small for a room
    if (depth <= 0 || w < 12 || h < 10) {
        // Leaf: create room with SAFE distribution bounds
        int maxRW = std::min(w - 2, 10);
        int minRW = std::min(3, maxRW);
        if (maxRW < minRW) return;
        // ... create room
    }
    // Split with minimum partition size
    int minSplit = x + 6, maxSplit = x + w - 6;
    if (minSplit > maxSplit) minSplit = maxSplit = x + w / 2;
    // ... recurse
}
```

**CRITICAL**: `std::uniform_int_distribution<int>(a, b)` with `a > b` is undefined behavior and will segfault.

## Testing Workflow

### 1. Build
```bash
cmake --build ./build 2>&1 | tail -20
```

### 2. Run ctests
```bash
cd build && ctest --output-on-failure
```

### 3. Start TUI + API
```bash
tmux kill-server; rm -f /tmp/test_pattern_app.sock*; sleep 1
tmux new-session -d -s ww -x 120 -y 40
tmux send-keys -t ww "./build/app/test_pattern 2>/tmp/wibwob_debug.log" Enter
sleep 5  # wait for socket
WIBWOB_REPO_ROOT=$(pwd) uv run --with-requirements tools/api_server/requirements.txt \
  python3 -m uvicorn tools.api_server.main:app --host 127.0.0.1 --port 8089 &
sleep 8 && curl -sf http://127.0.0.1:8089/health
```

### 4. Open game window via API
```bash
curl -sf -X POST http://127.0.0.1:8089/menu/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"open_game"}'
```

### 5. Screenshot verification
```bash
tmux capture-pane -t ww -p 2>&1
```

### 6. Send keystrokes for gameplay testing
```bash
tmux send-keys -t ww Right  # arrow keys
tmux send-keys -t ww r      # letter keys
```

## Multi-Window Integration

Games can spawn other TUI windows for multi-window gameplay:

1. Define a command constant: `const ushort cmMyAction = NNN;`
2. In game view, post command: `putEvent(evCommand, cmMyAction)`
3. In app handleEvent, catch and spawn window (terminal, chat, etc.)
4. Use `TWibWobTerminalWindow::sendText()` to inject text into terminals

Example: Roguelike opens a terminal window when hacking a dungeon terminal,
showing an animated hacking sequence while the game applies bonuses.

## Game Design Tips for TUI

- **Character as graphics**: `@` player, `#` walls, `.` floors, `+` doors, `>` stairs, `~` water, `&` terminals
- **Color = information**: HP bar changes color at 50%, enemies by danger level, items by type
- **FOV/fog of war**: Adds mystery and performance (only draw visible area)
- **HUD at bottom**: Reserve 1-2 rows for stats, 3-5 rows for message log
- **Message log**: Color-coded by type (green=good, red=bad, blue=info, green=terminal)
- **Progressive difficulty**: Scale creature stats, spawn rates, and item rarity by floor/level
- **Guarantee early fun**: Place key items (data chips, potions) in the first room

## Acceptance Criteria

- [ ] `cmake --build ./build` passes with no errors
- [ ] `ctest --output-on-failure` all tests pass (especially command_registry and scramble_engine)
- [ ] Game opens via API command (`open_game`)
- [ ] Game renders correctly (screenshot verification)
- [ ] Keyboard input works (arrow keys, action keys)
- [ ] Game over / victory states work
- [ ] Restart (R key) works
- [ ] HUD displays correctly at all reasonable window sizes
