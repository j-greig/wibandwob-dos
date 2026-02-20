/*---------------------------------------------------------*/
/*                                                         */
/*   quadra_view.cpp - Quadra falling blocks game          */
/*                                                         */
/*---------------------------------------------------------*/

#include "quadra_view.h"

#define Uses_TWindow
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include <algorithm>
#include <random>
#include <cstring>

// ── Piece shape data ──────────────────────────────────────
// Each piece has 4 rotations, each rotation is 4 (x,y) offsets
// relative to bounding-box top-left.
// Standard SRS-like shapes in a 4x4 grid.

static const int SHAPES[7][4][4][2] = {
    // I
    {{{0,1},{1,1},{2,1},{3,1}},
     {{2,0},{2,1},{2,2},{2,3}},
     {{0,2},{1,2},{2,2},{3,2}},
     {{1,0},{1,1},{1,2},{1,3}}},
    // O
    {{{1,0},{2,0},{1,1},{2,1}},
     {{1,0},{2,0},{1,1},{2,1}},
     {{1,0},{2,0},{1,1},{2,1}},
     {{1,0},{2,0},{1,1},{2,1}}},
    // T
    {{{1,0},{0,1},{1,1},{2,1}},
     {{1,0},{1,1},{2,1},{1,2}},
     {{0,1},{1,1},{2,1},{1,2}},
     {{1,0},{0,1},{1,1},{1,2}}},
    // S
    {{{1,0},{2,0},{0,1},{1,1}},
     {{1,0},{1,1},{2,1},{2,2}},
     {{1,1},{2,1},{0,2},{1,2}},
     {{0,0},{0,1},{1,1},{1,2}}},
    // Z
    {{{0,0},{1,0},{1,1},{2,1}},
     {{2,0},{1,1},{2,1},{1,2}},
     {{0,1},{1,1},{1,2},{2,2}},
     {{1,0},{0,1},{1,1},{0,2}}},
    // J
    {{{0,0},{0,1},{1,1},{2,1}},
     {{1,0},{2,0},{1,1},{1,2}},
     {{0,1},{1,1},{2,1},{2,2}},
     {{1,0},{1,1},{0,2},{1,2}}},
    // L
    {{{2,0},{0,1},{1,1},{2,1}},
     {{1,0},{1,1},{1,2},{2,2}},
     {{0,1},{1,1},{2,1},{0,2}},
     {{0,0},{1,0},{1,1},{1,2}}},
};

// Piece colors (TColorAttr: bg << 4 | fg, using bright colors)
static const TColorAttr PIECE_COLORS[7] = {
    TColorAttr(TColorRGB(0x00, 0xFF, 0xFF), TColorRGB(0x00, 0x00, 0x00)), // I = cyan
    TColorAttr(TColorRGB(0xFF, 0xFF, 0x00), TColorRGB(0x00, 0x00, 0x00)), // O = yellow
    TColorAttr(TColorRGB(0xAA, 0x00, 0xFF), TColorRGB(0x00, 0x00, 0x00)), // T = purple
    TColorAttr(TColorRGB(0x00, 0xFF, 0x00), TColorRGB(0x00, 0x00, 0x00)), // S = green
    TColorAttr(TColorRGB(0xFF, 0x00, 0x00), TColorRGB(0x00, 0x00, 0x00)), // Z = red
    TColorAttr(TColorRGB(0x00, 0x00, 0xFF), TColorRGB(0xFF, 0xFF, 0xFF)), // J = blue
    TColorAttr(TColorRGB(0xFF, 0xAA, 0x00), TColorRGB(0x00, 0x00, 0x00)), // L = orange
};

static const TColorAttr BOARD_BG    = TColorAttr(TColorRGB(0x18, 0x18, 0x18), TColorRGB(0x30, 0x30, 0x30));
static const TColorAttr BORDER_ATTR = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x60, 0x60, 0x60));
static const TColorAttr HUD_ATTR    = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xAA, 0xAA, 0xAA));
static const TColorAttr GHOST_ATTR  = TColorAttr(TColorRGB(0x30, 0x30, 0x30), TColorRGB(0x50, 0x50, 0x50));
static const TColorAttr TITLE_ATTR  = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xFF, 0xFF, 0x00));

// ── Random ────────────────────────────────────────────────
static std::mt19937& rng() {
    static std::mt19937 gen(std::random_device{}());
    return gen;
}

// ── TQuadraView ───────────────────────────────────────────

TQuadraView::TQuadraView(const TRect &bounds, unsigned periodMs_)
    : TView(bounds), periodMs(periodMs_)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable | ofFirstClick;
    eventMask |= evBroadcast | evKeyDown;
    newGame();
}

TQuadraView::~TQuadraView() {
    stopTimer();
}

void TQuadraView::startTimer() {
    if (timerId == 0) {
        unsigned speed = std::max(50u, periodMs - (unsigned)(level - 1) * 40);
        timerId = setTimer(speed, (int)speed);
    }
}

void TQuadraView::stopTimer() {
    if (timerId != 0) {
        killTimer(timerId);
        timerId = 0;
    }
}

// ── Piece bag (7-bag randomizer) ──────────────────────────

PieceType TQuadraView::nextFromBag() {
    if (bag.empty()) {
        for (int i = 0; i < (int)PieceType::COUNT; ++i)
            bag.push_back((PieceType)i);
        std::shuffle(bag.begin(), bag.end(), rng());
    }
    PieceType t = bag.back();
    bag.pop_back();
    return t;
}

// ── Game logic ────────────────────────────────────────────

void TQuadraView::newGame() {
    for (auto& row : board)
        row.fill(0);
    score = 0;
    lines = 0;
    level = 1;
    chainCount = 0;
    gameOver = false;
    paused = false;
    bag.clear();
    next.type = nextFromBag();
    next.rotation = 0;
    spawnPiece();
}

void TQuadraView::getCells(const Piece& p, int out[4][2]) const {
    int t = (int)p.type;
    int r = p.rotation & 3;
    for (int i = 0; i < 4; ++i) {
        out[i][0] = p.x + SHAPES[t][r][i][0];
        out[i][1] = p.y + SHAPES[t][r][i][1];
    }
}

bool TQuadraView::collides(const Piece& p) const {
    int cells[4][2];
    getCells(p, cells);
    for (int i = 0; i < 4; ++i) {
        int cx = cells[i][0], cy = cells[i][1];
        if (cx < 0 || cx >= BOARD_W || cy >= BOARD_H)
            return true;
        if (cy >= 0 && board[cy][cx] != 0)
            return true;
    }
    return false;
}

void TQuadraView::spawnPiece() {
    current.type = next.type;
    current.rotation = 0;
    current.x = BOARD_W / 2 - 2;
    current.y = -1;
    next.type = nextFromBag();
    next.rotation = 0;

    if (collides(current)) {
        gameOver = true;
        stopTimer();
    }
}

bool TQuadraView::tryMove(int dx, int dy) {
    Piece test = current;
    test.x += dx;
    test.y += dy;
    if (!collides(test)) {
        current = test;
        return true;
    }
    return false;
}

bool TQuadraView::tryRotate(int dir) {
    Piece test = current;
    test.rotation = (test.rotation + dir + 4) % 4;
    // Basic wall kick: try 0, then -1, +1
    if (!collides(test)) { current = test; return true; }
    test.x -= 1;
    if (!collides(test)) { current = test; return true; }
    test.x += 2;
    if (!collides(test)) { current = test; return true; }
    return false;
}

void TQuadraView::lockPiece() {
    int cells[4][2];
    getCells(current, cells);
    for (int i = 0; i < 4; ++i) {
        int cx = cells[i][0], cy = cells[i][1];
        if (cy >= 0 && cy < BOARD_H && cx >= 0 && cx < BOARD_W)
            board[cy][cx] = (Cell)((int)current.type + 1);
    }
    // Clear lines with Quadra-style gravity chain
    chainCount = 0;
    int totalCleared = clearLines();
    if (totalCleared > 0) {
        // Quadra gravity: blocks fall after clearing, may trigger more clears
        bool moreClears = true;
        while (moreClears) {
            applyGravity();
            int extra = clearLines();
            if (extra > 0) {
                chainCount++;
                totalCleared += extra;
            } else {
                moreClears = false;
            }
        }
        // Scoring: base * (1 + chains)
        int baseScore = 0;
        switch (totalCleared) {
            case 1: baseScore = 100; break;
            case 2: baseScore = 300; break;
            case 3: baseScore = 500; break;
            default: baseScore = 800; break;
        }
        score += baseScore * level * (1 + chainCount);
        lines += totalCleared;
        level = 1 + lines / 10;
        // Update timer speed for new level
        stopTimer();
        startTimer();
    }
    spawnPiece();
}

int TQuadraView::clearLines() {
    int cleared = 0;
    for (int y = BOARD_H - 1; y >= 0; --y) {
        bool full = true;
        for (int x = 0; x < BOARD_W; ++x) {
            if (board[y][x] == 0) { full = false; break; }
        }
        if (full) {
            // Remove this row, shift everything down
            for (int yy = y; yy > 0; --yy)
                board[yy] = board[yy - 1];
            board[0].fill(0);
            ++cleared;
            ++y; // re-check this row
        }
    }
    return cleared;
}

void TQuadraView::applyGravity() {
    // Quadra-style: each cell falls independently until it lands
    for (int x = 0; x < BOARD_W; ++x) {
        int writeY = BOARD_H - 1;
        for (int y = BOARD_H - 1; y >= 0; --y) {
            if (board[y][x] != 0) {
                if (writeY != y) {
                    board[writeY][x] = board[y][x];
                    board[y][x] = 0;
                }
                --writeY;
            }
        }
    }
}

void TQuadraView::tick() {
    if (gameOver || paused) return;
    if (!tryMove(0, 1)) {
        lockPiece();
    }
}

// ── Drawing ───────────────────────────────────────────────

void TQuadraView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    if ((int)lineBuf.size() < W)
        lineBuf.resize(W);

    // Layout: board is centered, HUD on the right
    const int boardPixW = BOARD_W * CELL_W + 2; // +2 for borders
    const int boardPixH = BOARD_H + 2;
    const int offX = std::max(0, (W - boardPixW - 16) / 2); // 16 for HUD
    const int offY = std::max(0, (H - boardPixH) / 2);

    // Ghost piece position (hard drop preview)
    Piece ghost = current;
    while (!gameOver) {
        Piece test = ghost;
        test.y += 1;
        if (collides(test)) break;
        ghost = test;
    }

    for (int screenY = 0; screenY < H; ++screenY) {
        // Clear line
        for (int sx = 0; sx < W; ++sx)
            setCell(lineBuf[sx], ' ', TColorAttr(TColorRGB(0x10, 0x10, 0x10), TColorRGB(0x10, 0x10, 0x10)));

        int boardY = screenY - offY - 1; // -1 for top border

        // Board area
        if (screenY == offY) {
            // Top border
            for (int bx = 0; bx < boardPixW && offX + bx < W; ++bx)
                setCell(lineBuf[offX + bx], (bx == 0 || bx == boardPixW - 1) ? '+' : '-', BORDER_ATTR);
        } else if (screenY == offY + boardPixH - 1) {
            // Bottom border
            for (int bx = 0; bx < boardPixW && offX + bx < W; ++bx)
                setCell(lineBuf[offX + bx], (bx == 0 || bx == boardPixW - 1) ? '+' : '-', BORDER_ATTR);
        } else if (boardY >= 0 && boardY < BOARD_H) {
            // Left border
            if (offX < W)
                setCell(lineBuf[offX], '|', BORDER_ATTR);

            // Board cells
            for (int bx = 0; bx < BOARD_W; ++bx) {
                int sx = offX + 1 + bx * CELL_W;
                if (sx + 1 >= W) break;

                Cell c = board[boardY][bx];
                TColorAttr attr = BOARD_BG;
                char ch0 = '.', ch1 = ' ';

                if (c != 0) {
                    attr = PIECE_COLORS[c - 1];
                    ch0 = '[';
                    ch1 = ']';
                }

                setCell(lineBuf[sx], ch0, attr);
                setCell(lineBuf[sx + 1], ch1, attr);
            }

            // Draw ghost piece
            if (!gameOver && !paused) {
                int ghostCells[4][2];
                getCells(ghost, ghostCells);
                for (int i = 0; i < 4; ++i) {
                    if (ghostCells[i][1] == boardY) {
                        int sx = offX + 1 + ghostCells[i][0] * CELL_W;
                        if (sx + 1 < W && board[boardY][ghostCells[i][0]] == 0) {
                            // Only draw ghost if not occupied by current piece
                            bool isCurrentCell = false;
                            int curCells[4][2];
                            getCells(current, curCells);
                            for (int j = 0; j < 4; ++j) {
                                if (curCells[j][0] == ghostCells[i][0] && curCells[j][1] == ghostCells[i][1])
                                    isCurrentCell = true;
                            }
                            if (!isCurrentCell) {
                                setCell(lineBuf[sx], '[', GHOST_ATTR);
                                setCell(lineBuf[sx + 1], ']', GHOST_ATTR);
                            }
                        }
                    }
                }
            }

            // Draw current piece
            if (!gameOver) {
                int curCells[4][2];
                getCells(current, curCells);
                for (int i = 0; i < 4; ++i) {
                    if (curCells[i][1] == boardY) {
                        int sx = offX + 1 + curCells[i][0] * CELL_W;
                        if (sx + 1 < W) {
                            TColorAttr attr = PIECE_COLORS[(int)current.type];
                            setCell(lineBuf[sx], '[', attr);
                            setCell(lineBuf[sx + 1], ']', attr);
                        }
                    }
                }
            }

            // Right border
            int rx = offX + boardPixW - 1;
            if (rx < W)
                setCell(lineBuf[rx], '|', BORDER_ATTR);
        }

        // HUD area (right of board)
        int hudX = offX + boardPixW + 2;
        if (hudX + 14 < W) {
            if (screenY == offY + 1) {
                // Title
                const char* title = "Q U A D R A";
                for (int i = 0; title[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], title[i], TITLE_ATTR);
            } else if (screenY == offY + 3) {
                char buf[32];
                snprintf(buf, sizeof(buf), "Score: %d", score);
                for (int i = 0; buf[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], buf[i], HUD_ATTR);
            } else if (screenY == offY + 4) {
                char buf[32];
                snprintf(buf, sizeof(buf), "Lines: %d", lines);
                for (int i = 0; buf[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], buf[i], HUD_ATTR);
            } else if (screenY == offY + 5) {
                char buf[32];
                snprintf(buf, sizeof(buf), "Level: %d", level);
                for (int i = 0; buf[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], buf[i], HUD_ATTR);
            } else if (screenY == offY + 7) {
                const char* label = "Next:";
                for (int i = 0; label[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], label[i], HUD_ATTR);
            } else if (screenY >= offY + 8 && screenY <= offY + 11) {
                // Draw next piece preview
                int py = screenY - (offY + 8);
                int t = (int)next.type;
                TColorAttr attr = PIECE_COLORS[t];
                for (int i = 0; i < 4; ++i) {
                    if (SHAPES[t][0][i][1] == py) {
                        int px = SHAPES[t][0][i][0];
                        int sx = hudX + px * CELL_W;
                        if (sx + 1 < W) {
                            setCell(lineBuf[sx], '[', attr);
                            setCell(lineBuf[sx + 1], ']', attr);
                        }
                    }
                }
            } else if (screenY == offY + 13 && chainCount > 0) {
                char buf[32];
                snprintf(buf, sizeof(buf), "Chain x%d!", chainCount);
                for (int i = 0; buf[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], buf[i], TITLE_ATTR);
            } else if (screenY == offY + 15) {
                const char* help = "Arrows/ZX/Space";
                for (int i = 0; help[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], help[i], BORDER_ATTR);
            } else if (screenY == offY + 16) {
                const char* help = "P=Pause R=Reset";
                for (int i = 0; help[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], help[i], BORDER_ATTR);
            }
        }

        // Game over overlay
        if (gameOver) {
            int midY = offY + boardPixH / 2;
            if (screenY == midY) {
                const char* msg = " GAME OVER ";
                int msgX = offX + (boardPixW - 11) / 2;
                TColorAttr goAttr = TColorAttr(TColorRGB(0xFF, 0x00, 0x00), TColorRGB(0xFF, 0xFF, 0xFF));
                for (int i = 0; msg[i] && msgX + i < W; ++i)
                    setCell(lineBuf[msgX + i], msg[i], goAttr);
            } else if (screenY == midY + 1) {
                const char* msg = " Press R ";
                int msgX = offX + (boardPixW - 9) / 2;
                TColorAttr goAttr = TColorAttr(TColorRGB(0xFF, 0x00, 0x00), TColorRGB(0xFF, 0xFF, 0xFF));
                for (int i = 0; msg[i] && msgX + i < W; ++i)
                    setCell(lineBuf[msgX + i], msg[i], goAttr);
            }
        }

        // Paused overlay
        if (paused && !gameOver) {
            int midY = offY + boardPixH / 2;
            if (screenY == midY) {
                const char* msg = " PAUSED ";
                int msgX = offX + (boardPixW - 8) / 2;
                for (int i = 0; msg[i] && msgX + i < W; ++i)
                    setCell(lineBuf[msgX + i], msg[i], TITLE_ATTR);
            }
        }

        writeLine(0, screenY, W, 1, lineBuf.data());
    }
}

// ── Event handling ────────────────────────────────────────

void TQuadraView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);

    // Timer tick
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId != 0 && ev.message.infoPtr == timerId) {
            tick();
            drawView();
            clearEvent(ev);
            return;
        }
    }

    if (ev.what == evKeyDown) {
        const ushort key = ev.keyDown.keyCode;
        const uchar ch = ev.keyDown.charScan.charCode;
        bool handled = true;

        if (gameOver) {
            if (ch == 'r' || ch == 'R') {
                newGame();
                stopTimer();
                startTimer();
            } else {
                handled = false;
            }
        } else if (paused) {
            if (ch == 'p' || ch == 'P') {
                paused = false;
                startTimer();
            } else {
                handled = false;
            }
        } else {
            if (key == kbLeft)       { tryMove(-1, 0); }
            else if (key == kbRight) { tryMove(1, 0); }
            else if (key == kbDown)  { tryMove(0, 1); }
            else if (key == kbUp || ch == 'x' || ch == 'X') { tryRotate(1); }
            else if (ch == 'z' || ch == 'Z') { tryRotate(-1); }
            else if (ch == ' ') {
                // Hard drop
                while (tryMove(0, 1)) {}
                lockPiece();
            }
            else if (ch == 'p' || ch == 'P') {
                paused = true;
                stopTimer();
            }
            else if (ch == 'r' || ch == 'R') {
                newGame();
                stopTimer();
                startTimer();
            }
            else { handled = false; }
        }

        if (handled) {
            drawView();
            clearEvent(ev);
        }
    }
}

void TQuadraView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if ((aState & sfExposed) != 0) {
        if (enable) {
            startTimer();
            drawView();
        } else {
            stopTimer();
        }
    }
}

void TQuadraView::changeBounds(const TRect& bounds) {
    TView::changeBounds(bounds);
    drawView();
}

// ── Window wrapper ────────────────────────────────────────

class TQuadraWindow : public TWindow {
public:
    explicit TQuadraWindow(const TRect &bounds)
        : TWindow(bounds, "Quadra", wnNoNumber)
        , TWindowInit(&TQuadraWindow::initFrame) {}

    void setup() {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TQuadraView(c, 500));
    }

    virtual void changeBounds(const TRect& b) override {
        TWindow::changeBounds(b);
        setState(sfExposed, True);
        redraw();
    }
};

TWindow* createQuadraWindow(const TRect &bounds) {
    auto *w = new TQuadraWindow(bounds);
    w->setup();
    return w;
}
