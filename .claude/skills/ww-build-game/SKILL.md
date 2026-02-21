---
name: ww-build-game
description: Build a TUI game view for WibWob-DOS. Covers the full lifecycle from concept to tested, shipped game window with proper TV rendering, input handling, command registry, menu wiring, and screenshot verification. Use when user says "build a game", "add a game", "ww-build-game", or describes wanting a playable game in the TUI.
---

# ww-build-game

Build a playable game view inside WibWob-DOS's Turbo Vision TUI.

## Working Examples (Read These First)

These three shipped games cover every pattern you need. **Read the actual source** before writing new code:

| Game | Files | Lines | Architecture | Key Patterns |
|------|-------|-------|-------------|--------------|
| Quadra | `app/quadra_view.h/.cpp` | ~430 | Timer-tick, fixed 10x20 board | 7-bag randomizer, SRS rotation, wall kicks, chain gravity, ghost piece, double-width cells |
| Snake | `app/snake_view.h/.cpp` | ~410 | Timer-tick, dynamic board | Gradient body colors, direction buffering, food sparkle, speed progression, board resizes with window |
| Rogue | `app/rogue_view.h/.cpp` | ~850 | Turn-based, 60x30 map + camera | BSP dungeon gen, FOV ray marching, creature AI, items, multi-window terminal integration |

## Architecture Decision: Timer-Tick vs Turn-Based

Choose before writing any code. This shapes everything:

**Timer-tick** (Quadra, Snake): Game state advances on a clock. User input is immediate; physics/gravity are asynchronous. Requires timer lifecycle management (start/stop/restart, speed scaling, pause on minimize).

**Turn-based** (Rogue): World only advances when player acts. One keypress = one full game turn (player moves, then all creatures move, then redraw). No timer, no async state. Simpler lifecycle but AI runs synchronously inside `tryMove()`.

## Turbo Vision Includes (Silent Failure Mode)

Every `.h` file needs specific `#define Uses_*` **before** `#include <tvision/tv.h>`. Forgetting these causes link-time errors, not compile-time errors.

**Header** (`.h`):
```cpp
#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
```

**Implementation** (`.cpp`) — add these too:
```cpp
#define Uses_TWindow
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>
```

If you forget `Uses_TWindow`, the TWindow subclass compiles but fails to link. If you forget `Uses_TKeys`, `kbUp`/`kbDown` constants are missing.

## Constructor Contract

Every game view constructor MUST have these four lines. Missing any one causes a specific bug:

```cpp
TGameView::TGameView(const TRect &bounds)
    : TView(bounds)
{
    growMode = gfGrowHiX | gfGrowHiY;          // view resizes with window
    options |= ofSelectable | ofFirstClick;     // WITHOUT THIS: keyboard events silently dropped
    eventMask |= evBroadcast | evKeyDown;       // receive timer ticks + keyboard
    // ... init game state, call newGame()
}
```

**Bug #1 (keyboard)**: Without `ofSelectable | ofFirstClick`, the view never gets focus. Arrow keys, letters, everything is silently ignored. This was the actual bug that blocked Quadra for a full debug cycle.

**Bug #2 (timer)**: Without `evBroadcast` in eventMask, timer-tick games never receive `cmTimerExpired` broadcasts.

## Board Dimension Strategy

Three proven approaches. Choose based on game type:

### Fixed Board (Quadra)
Board is always 10x20. View size only affects centering and HUD placement.
```cpp
static constexpr int BOARD_W = 10;
static constexpr int BOARD_H = 20;
static constexpr int CELL_W = 2;  // each cell = "[]" for square aspect
// Board rendered at calculated offset, HUD to the right
int offX = std::max(0, (W - boardPixW - 16) / 2);
```
`changeBounds()` does NOT reset the game — board dimensions don't change.

### Dynamic Board (Snake)
Board dimensions are computed from window size. Play area changes on resize.
```cpp
int boardW() const { return size.x - HUD_WIDTH; }  // HUD_WIDTH = 18
int boardH() const { return size.y; }
```
**Critical**: `changeBounds()` MUST call `newGame()` because food positions, snake body, and wall boundaries all depend on board size. See `snake_view.cpp:changeBounds()`.

**Gotcha**: Use `std::max(1, boardW() - 2)` when generating random positions. If window is narrower than HUD_WIDTH + 3, `boardW() - 2` goes negative and `uniform_int_distribution` gets UB.

### Fixed Map + Camera (Rogue)
Map is always 60x30. View is a scrolling viewport with camera tracking player.
```cpp
static constexpr int MAP_W = 60;
static constexpr int MAP_H = 30;
camX = player.x - viewW / 2;
camY = player.y - viewH / 2;
camX = std::max(0, std::min(camX, MAP_W - viewW));  // clamp
```
`changeBounds()` calls `updateCamera()` but NOT `generateLevel()`.

## Timer Lifecycle (Real-Time Games Only)

Timer management is more complex than it looks. All three operations needed:

```cpp
// Members:
TTimerId timerId {0};
unsigned basePeriodMs;

// Start (checked — prevents duplicate timers)
void startTimer() {
    if (timerId == 0) {
        unsigned speed = currentSpeed();
        timerId = setTimer(speed, (int)speed);
    }
}

// Stop
void stopTimer() {
    if (timerId != 0) { killTimer(timerId); timerId = 0; }
}

// Restart (speed changed — e.g. level up, food eaten)
void restartTimer() {
    stopTimer();
    startTimer();
}
```

### Speed Scaling Formulas (from working games)

**Quadra**: `max(50ms, 500ms - (level-1) * 40ms)` — level 1=500ms, level 12+=50ms
**Snake**: `max(40ms, 120ms - (eaten/5) * 10ms)` — start=120ms, eats 40+ food=40ms

### setState Interplay

Timer-based games MUST stop timers when hidden (minimized/unfocused) and restart when shown:

```cpp
void setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if (aState & sfExposed) {
        if (enable && !gameOver && !paused)
            startTimer();      // window became visible: resume
        else
            stopTimer();       // window hidden: pause physics
    }
}
```

Without this, timers fire while the window is hidden, causing state drift. See `quadra_view.cpp` and `snake_view.cpp` setState implementations.

## TScreenCell Rendering

The only correct way to render game graphics. Never write raw ANSI.

```cpp
void draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    if ((int)lineBuf.size() < W)
        lineBuf.resize(W);          // resize once, reuse every frame

    for (int screenY = 0; screenY < H; ++screenY) {
        for (int sx = 0; sx < W; ++sx)
            setCell(lineBuf[sx], ' ', C_BG);    // clear line

        // ... draw game content with setCell(lineBuf[sx], ch, attr) ...

        writeLine(0, screenY, W, 1, lineBuf.data());
    }
}
```

`TColorAttr(background, foreground)` — note the order. Background first.
```cpp
static const TColorAttr C_PLAYER = TColorAttr(TColorRGB(0x00,0x00,0x00), TColorRGB(0xFF,0xFF,0x00));
```

## Input Handling

### Arrow Keys vs Letters

```cpp
const ushort key = ev.keyDown.keyCode;      // for arrow keys: kbUp, kbDown, kbLeft, kbRight
const uchar ch = ev.keyDown.charScan.charCode;  // for letters: 'r', 'p', 't', etc.
```

Do NOT use `charCode` for arrow keys (it's 0). Do NOT use `keyCode` for letters (it includes scan code).

### Direction Buffering (Snake Pattern)

Prevents 180-degree reversal deaths. Input is checked against **current** heading, not buffered direction:

```cpp
// In handleEvent (immediate):
if (key == kbUp && dir != Dir::Down)
    nextDir = Dir::Up;      // buffer the intent

// In tick() (on timer):
dir = nextDir;              // apply buffered direction
// ... then move
```

Without this, pressing Up then Left within one tick period would bypass the Up→Down check.

## Window Wrapper Factory

```cpp
class TGameWindow : public TWindow {
public:
    explicit TGameWindow(const TRect &bounds)
        : TWindow(bounds, "Game Title", wnNoNumber)
        , TWindowInit(&TGameWindow::initFrame) {}   // MI syntax — required

    void setup() {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);        // view is 2 chars narrower, 2 shorter than window
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
    w->setup();               // NOT in constructor — setup() is called after construction
    return w;
}
```

`setup()` is separate from the constructor because `insert()` needs the window to be fully constructed first. `getExtent().grow(-1,-1)` accounts for the window frame border — the view is inset by 1 on each side.

## State Machine Patterns

### Playing / Paused / Game Over (Quadra, Snake)

```cpp
if (gameOver) {
    if (ch == 'r' || ch == 'R') { newGame(); stopTimer(); startTimer(); }
} else if (paused) {
    if (ch == 'p' || ch == 'P') { paused = false; startTimer(); }
} else {
    // normal gameplay input
    if (ch == 'p' || ch == 'P') { paused = true; stopTimer(); }
}
```

**Order matters**: check gameOver FIRST, then paused, then normal. The restart path must `stopTimer()` before `startTimer()` to avoid duplicate timers.

### Playing / Game Over / Victory (Rogue)

```cpp
if (gameOver || victory) {
    if (ch == 'r' || ch == 'R') {
        player = Player{};   // default-constructed = fresh state
        gameOver = false;
        victory = false;
        log.clear();
        generateLevel();
    }
} else {
    // movement, combat, item interaction
}
```

No pause state for turn-based games — the game is always "paused" between keypresses.

## Multi-Window Integration (Cross-View Communication)

Games can spawn other TUI windows. The pattern uses Turbo Vision's event system:

**Step 1**: Declare command constant (in header or test_pattern_app.cpp):
```cpp
extern const ushort cmRogueHackTerminal;  // in rogue_view.h
const ushort cmRogueHackTerminal = 218;   // in test_pattern_app.cpp
```

**Step 2**: Post event from game view:
```cpp
TEvent termEvent;
termEvent.what = evCommand;
termEvent.message.command = cmRogueHackTerminal;
termEvent.message.infoInt = (hasChip ? 1 : 0);  // pass data to handler
termEvent.message.infoPtr = nullptr;
putEvent(termEvent);
```

**Step 3**: Handle in test_pattern_app.cpp:
```cpp
case cmRogueHackTerminal: {
    TRect desk = deskTop->getExtent();
    TRect termBounds(desk.b.x - 52, 1, desk.b.x - 1, 19);
    TWindow* tw = createTerminalWindow(termBounds);
    if (tw) {
        deskTop->insert(tw);
        registerWindow(tw);
        auto* termWin = dynamic_cast<TWibWobTerminalWindow*>(tw);
        if (termWin)
            termWin->sendText("echo '=== HACK COMPLETE ==='\n");
    }
    clearEvent(event);
    break;
}
```

`sendText()` injects text byte-by-byte as keyboard events into the terminal emulator. Include `"tvterm_view.h"` for `TWibWobTerminalWindow`.

## Wiring Checklist (8 Files)

| # | File | What to Add |
|---|------|-------------|
| 1 | `app/game_view.h` | New header with `#define Uses_*`, class decl, factory prototype |
| 2 | `app/game_view.cpp` | Implementation with `#define Uses_TWindow/TEvent/TKeys` |
| 3 | `app/test_pattern_app.cpp` | **6 spots**: include, `cmConstant`, menu item `*new TMenuItem("~N~ame", cmFoo, kbNoKey) +`, handleEvent case, friend decl, `api_spawn_*` function |
| 4 | `app/command_registry.cpp` | **3 spots**: `extern void api_spawn_*(...)`, capability `{"open_*", "description", false}`, dispatch `if (name == "open_*") { api_spawn_*(app, boundsPtr); return "ok"; }` |
| 5 | `app/CMakeLists.txt` | Add `game_view.cpp` to test_pattern sources list |
| 6 | `app/command_registry_test.cpp` | Stub `void api_spawn_*(TTestPatternApp&, const TRect*) {}` AND test token `"\"name\":\"open_*\""` |
| 7 | `app/scramble_engine_test.cpp` | Same stub (both test executables link command_registry.cpp) |
| 8 | (Optional) `tools/api_server/models.py` | `WindowType` enum for REST/MCP parity |

### Finding the Next Command ID

Scan for highest `const ushort cm* = NNN;` in `app/test_pattern_app.cpp` (around line 225). Use NNN+1. Current highest: `cmRogueHackTerminal = 218`.

### Menu Item Syntax

```cpp
*new TMenuItem("~G~ame Name", cmFoo, kbNoKey) +
```
The `~G~` marks the hotkey letter (underlined in menu). Chain with `+` to next item.

## Random Number Generation

Use `std::mt19937` as a class member. Seed from `std::random_device{}()` in constructor.

**CRITICAL**: `std::uniform_int_distribution<int>(a, b)` with `a > b` is **undefined behavior** — typically segfaults. Always guard:

```cpp
int lo = ..., hi = ...;
if (lo > hi) std::swap(lo, hi);  // or: if (lo > hi) return;
std::uniform_int_distribution<int> dist(lo, hi);
```

This was the actual segfault that crashed the roguelike on first open. The BSP split could produce partitions where `w < 4`, making `rw(4, w-2)` have `a > b`.

## Common Bugs (Ranked by How Often They Bit)

| # | Bug | Symptom | Root Cause | Fix |
|---|-----|---------|-----------|-----|
| 1 | Keys silently ignored | Game opens but nothing responds | Missing `ofSelectable \| ofFirstClick` | Add to constructor `options` |
| 2 | Segfault on window open | Crash before anything renders | `uniform_int_distribution(a, b)` where `a > b` | Guard all distribution bounds |
| 3 | Linker error: undefined reference | Build fails at link stage | Missing stub in test .cpp files | Add stub in BOTH test files |
| 4 | HUD not visible | Game renders but no stats shown | Width check `hudX + HUD_WIDTH <= W` too strict | Use actual minimum text width, not constant |
| 5 | Timer keeps running when hidden | Game state drifts while minimized | No `setState(sfExposed)` override | Stop timer on `!enable`, start on `enable` |
| 6 | Socket "already in use" | TUI won't start, no IPC | Stale socket from crashed session | `rm -f /tmp/test_pattern_app.sock*` |
| 7 | Game doesn't redraw | State changes but screen is stale | Missing `drawView()` call | Call after EVERY state change |
| 8 | 180-degree death in Snake | Pressing opposite direction kills | No direction buffer | Use `nextDir` vs `dir` pattern |
| 9 | `duplicate session: ww` | tmux won't create new session | Previous tmux session still alive | `tmux kill-server` before creating |
| 10 | API server won't start | `exit code 144` or connection refused | Background process killed by shell exit | Use `& disown` and wait 8-10s |

## Testing Workflow (Battle-Tested)

This exact sequence works. Deviating from it causes the bugs listed above.

### 1. Build
```bash
cmake --build ./build 2>&1 | tail -20
```

### 2. Run ctests (catches linker/stub issues)
```bash
cd /path/to/repo/build && ctest --output-on-failure
```

### 3. Start TUI in tmux
```bash
# MUST kill everything first — stale sockets and sessions cause failures
tmux kill-server 2>/dev/null
rm -f /tmp/test_pattern_app.sock /tmp/test_pattern_app.sock.lock
sleep 2

# MUST specify -x and -y — without them TUI gets 0x0 canvas
tmux new-session -d -s ww -x 120 -y 40
sleep 0.5

# MUST redirect stderr — IPC socket won't appear without it
tmux send-keys -t ww "./build/app/test_pattern 2>/tmp/wibwob_debug.log" Enter
sleep 5

# Verify socket exists before proceeding
ls /tmp/test_pattern_app.sock
```

**Why stderr redirect?** The IPC listener logs to stderr. Without redirect, the TTY fights with Turbo Vision's screen buffer and the socket listener fails silently.

### 4. Start API server
```bash
cd /path/to/repo
WIBWOB_REPO_ROOT=$(pwd) uv run \
  --with-requirements tools/api_server/requirements.txt \
  python3 -m uvicorn tools.api_server.main:app \
  --host 127.0.0.1 --port 8089 &
disown    # prevent shell exit from killing the server

sleep 8   # first run installs deps (~3-8s), subsequent runs ~1s
curl -sf http://127.0.0.1:8089/health
# Expected: {"ok":true}
```

### 5. Open game + screenshot
```bash
# Open via API
curl -sf -X POST http://127.0.0.1:8089/menu/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"open_game"}'

# Screenshot (text dump of screen buffer)
sleep 1 && tmux capture-pane -t ww -p 2>&1
```

### 6. Gameplay testing via tmux
```bash
tmux send-keys -t ww Right          # arrow keys
tmux send-keys -t ww r              # letter keys
tmux send-keys -t ww Enter          # special keys

# Batch movement (explore roguelike dungeon):
for i in $(seq 1 10); do tmux send-keys -t ww Right; sleep 0.05; done

# Verify state after actions:
tmux capture-pane -t ww -p 2>&1 | grep "HP:\|Score:\|Level:"
```

### 7. Recovering from crashes
If the TUI segfaults (check with `tmux capture-pane` — look for shell prompt or "Segmentation fault"):
```bash
pkill -f uvicorn 2>/dev/null
tmux kill-server 2>/dev/null
rm -f /tmp/test_pattern_app.sock*
# Check debug log for clues:
tail -20 /tmp/wibwob_debug.log
# Then restart from step 3
```

## BSP Dungeon Generation (Roguelike Pattern)

The roguelike's BSP algorithm recursively splits the map into partitions, places rooms in leaf nodes, then connects rooms with corridors.

```
generateBSP(0, 0, 60, 30, depth=4)
    ├── split horizontally at x=28
    │   ├── generateBSP(0, 0, 28, 30, 3)  → Room A, Room B
    │   └── generateBSP(28, 0, 32, 30, 3) → Room C, Room D
    └── connect: A→B, B→C, C→D (corridor between consecutive room centers)

Place stairs in rooms.back(), terminal in rooms[1], player in rooms[0].
```

Safe implementation — guards every distribution:
```cpp
void generateBSP(int x, int y, int w, int h, int depth) {
    if (w < 6 || h < 5) return;           // absolute minimum for a 3x3 room + borders
    if (depth <= 0 || w < 12 || h < 10) {  // leaf: place room
        int maxRW = std::min(w - 2, 10);
        int minRW = std::min(3, maxRW);
        if (maxRW < minRW) return;         // safety: can't make a room
        // ... uniform_int_distribution with guaranteed a <= b
    }
    // split: ensure each half is at least 6 wide (or 5 tall)
    int minSplit = x + 6, maxSplit = x + w - 6;
    if (minSplit > maxSplit) minSplit = maxSplit = x + w / 2;
}
```

See `rogue_view.cpp:generateBSP()` for the full working implementation.

## Game Design Wisdom for TUI

- **Characters ARE your graphics**: `@` player, `#` walls, `.` floors, `+` doors, `>` stairs, `~` water, `&` terminals, `!` potions, `$` gold, `r` rat, `D` dragon. Players intuitively read these.
- **Color carries meaning**: green HP = healthy, red HP = danger. Item colors by rarity. Creature colors by threat level. Dim grey for fog/seen-but-not-visible. Bright for in-FOV.
- **Reserve bottom for HUD**: 1 line stats + 1 separator + N log lines. Log is a `std::deque<LogMessage>` capped at 2*LOG_LINES. Color-code messages: green=good, red=bad, blue=info.
- **Guarantee early fun**: Place a useful item in the starting room. Place the first interesting encounter (terminal, creature) in the second room. Don't make the player wander 30 turns before anything happens.
- **Double-width cells for square aspect**: Tetrominos rendered as `[]` (2 chars per cell) look square in a terminal. Single chars are portrait-oriented.
- **Food sparkle**: Alternate `*`/`o` every 3 frames with color shift (red/yellow). Simple animation that makes static items feel alive.
- **Ghost piece**: Hard-drop preview in falling-block games. Calculated in `draw()` by dropping piece until collision.

## Acceptance Criteria

- [ ] `cmake --build ./build` — no errors
- [ ] `ctest --output-on-failure` — all pass (especially `command_registry` and `scramble_engine`)
- [ ] Game opens via `curl -X POST .../menu/command -d '{"command":"open_game"}'`
- [ ] `tmux capture-pane` shows game rendering correctly
- [ ] Arrow keys / game keys work (tested via `tmux send-keys`)
- [ ] Game over state shows message, R restarts
- [ ] HUD visible at default window size
- [ ] No raw ANSI escape sequences in any `TDrawBuffer` write
- [ ] Timer stops when window minimized, resumes when exposed (real-time games)
- [ ] Window resize doesn't crash (test by changing tmux size)
