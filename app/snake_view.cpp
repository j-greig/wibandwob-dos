/*---------------------------------------------------------*/
/*                                                         */
/*   snake_view.cpp - Classic Snake game                   */
/*                                                         */
/*---------------------------------------------------------*/

#include "snake_view.h"

#define Uses_TWindow
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include <algorithm>
#include <random>
#include <cstring>
#include <cstdio>

// ── Colors ────────────────────────────────────────────────

// Snake gradient: head is bright, body fades toward tail
static TColorAttr snakeColor(int index, int totalLen) {
    // Gradient from bright green (head) to dark green (tail)
    float t = (totalLen <= 1) ? 0.0f : (float)index / (float)(totalLen - 1);
    int r = (int)(0x00 + t * 0x10);
    int g = (int)(0xFF - t * 0xA0);
    int b = (int)(0x00 + t * 0x10);
    return TColorAttr(TColorRGB(r, g, b), TColorRGB(0x00, 0x00, 0x00));
}

static const TColorAttr HEAD_ATTR   = TColorAttr(TColorRGB(0x00, 0xFF, 0x00), TColorRGB(0x00, 0x20, 0x00));
static const TColorAttr FOOD_ATTR_A = TColorAttr(TColorRGB(0xFF, 0x30, 0x30), TColorRGB(0x40, 0x00, 0x00));
static const TColorAttr FOOD_ATTR_B = TColorAttr(TColorRGB(0xFF, 0xFF, 0x00), TColorRGB(0x40, 0x40, 0x00));
static const TColorAttr WALL_ATTR   = TColorAttr(TColorRGB(0x40, 0x40, 0x40), TColorRGB(0x80, 0x80, 0x80));
static const TColorAttr EMPTY_ATTR  = TColorAttr(TColorRGB(0x0A, 0x0A, 0x0A), TColorRGB(0x1A, 0x1A, 0x1A));
static const TColorAttr HUD_ATTR    = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xAA, 0xAA, 0xAA));
static const TColorAttr TITLE_ATTR  = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x00, 0xFF, 0x00));
static const TColorAttr DEAD_ATTR   = TColorAttr(TColorRGB(0xFF, 0x00, 0x00), TColorRGB(0xFF, 0xFF, 0xFF));
static const TColorAttr BG_ATTR     = TColorAttr(TColorRGB(0x08, 0x08, 0x08), TColorRGB(0x08, 0x08, 0x08));

// ── Random ────────────────────────────────────────────────
static std::mt19937& rng() {
    static std::mt19937 gen(std::random_device{}());
    return gen;
}

// ── TSnakeView ────────────────────────────────────────────

TSnakeView::TSnakeView(const TRect &bounds, unsigned periodMs_)
    : TView(bounds), basePeriodMs(periodMs_)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable | ofFirstClick;
    eventMask |= evBroadcast | evKeyDown;
    newGame();
}

TSnakeView::~TSnakeView() {
    stopTimer();
}

void TSnakeView::startTimer() {
    if (timerId == 0) {
        unsigned speed = currentSpeed();
        timerId = setTimer(speed, (int)speed);
    }
}

void TSnakeView::stopTimer() {
    if (timerId != 0) {
        killTimer(timerId);
        timerId = 0;
    }
}

void TSnakeView::restartTimer() {
    stopTimer();
    startTimer();
}

unsigned TSnakeView::currentSpeed() const {
    // Speed increases every 5 food eaten, minimum 40ms
    int reduction = (eaten / 5) * 10;
    int speed = (int)basePeriodMs - reduction;
    return (unsigned)std::max(40, speed);
}

// ── Game logic ────────────────────────────────────────────

void TSnakeView::newGame() {
    body.clear();
    int bw = boardW();
    int bh = boardH();
    // Start in center with 4 segments going right
    int cx = std::max(4, bw / 2);
    int cy = std::max(2, bh / 2);
    for (int i = 3; i >= 0; --i)
        body.push_back({cx - i, cy});

    dir = Dir::Right;
    nextDir = Dir::Right;
    gameOver = false;
    paused = false;
    score = 0;
    eaten = 0;
    deathFlash = 0;
    foodAnim = 0;
    spawnFood();
}

bool TSnakeView::isSnake(const Pos& p) const {
    for (const auto& s : body)
        if (s == p) return true;
    return false;
}

void TSnakeView::spawnFood() {
    int bw = boardW();
    int bh = boardH();
    // Play area is inside borders: x=[1..bw-2], y=[1..bh-2]
    int attempts = 0;
    do {
        std::uniform_int_distribution<int> distX(1, std::max(1, bw - 2));
        std::uniform_int_distribution<int> distY(1, std::max(1, bh - 2));
        food = {distX(rng()), distY(rng())};
        ++attempts;
    } while (isSnake(food) && attempts < 1000);
}

void TSnakeView::tick() {
    if (gameOver || paused) return;

    ++foodAnim;

    // Apply buffered direction
    dir = nextDir;

    // Compute new head position
    Pos head = body.front();
    switch (dir) {
        case Dir::Up:    head.y -= 1; break;
        case Dir::Down:  head.y += 1; break;
        case Dir::Left:  head.x -= 1; break;
        case Dir::Right: head.x += 1; break;
    }

    int bw = boardW();
    int bh = boardH();

    // Wall collision
    if (head.x <= 0 || head.x >= bw - 1 || head.y <= 0 || head.y >= bh - 1) {
        gameOver = true;
        deathFlash = 6;
        if (score > highScore) highScore = score;
        stopTimer();
        return;
    }

    // Self collision (check against body excluding tail since tail moves)
    for (size_t i = 0; i < body.size() - 1; ++i) {
        if (body[i] == head) {
            gameOver = true;
            deathFlash = 6;
            if (score > highScore) highScore = score;
            stopTimer();
            return;
        }
    }

    // Move: add new head
    body.push_front(head);

    // Check food
    if (head == food) {
        score += 10 + eaten;  // increasing reward
        ++eaten;
        spawnFood();
        // Speed up — restart timer with new period
        restartTimer();
        // Don't remove tail = growth
    } else {
        body.pop_back();  // remove tail = no growth
    }
}

// ── Drawing ───────────────────────────────────────────────

void TSnakeView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    if ((int)lineBuf.size() < W)
        lineBuf.resize(W);

    const int bw = boardW();
    const int bh = boardH();
    const int hudX = bw + 1;
    const int snakeLen = (int)body.size();

    for (int y = 0; y < H; ++y) {
        // Clear entire line
        for (int x = 0; x < W; ++x)
            setCell(lineBuf[x], ' ', BG_ATTR);

        // Board area
        if (y < bh) {
            for (int x = 0; x < bw; ++x) {
                char ch = ' ';
                TColorAttr attr = EMPTY_ATTR;

                // Walls (border)
                bool isWall = (x == 0 || x == bw - 1 || y == 0 || y == bh - 1);
                if (isWall) {
                    if ((x == 0 || x == bw - 1) && (y == 0 || y == bh - 1))
                        ch = '+';
                    else if (y == 0 || y == bh - 1)
                        ch = '-';
                    else
                        ch = '|';
                    attr = WALL_ATTR;
                } else {
                    // Empty interior — subtle dot grid
                    ch = '.';
                }

                setCell(lineBuf[x], ch, attr);
            }

            // Draw food (sparkle animation)
            if (food.y == y && food.x >= 0 && food.x < bw) {
                bool sparkle = (foodAnim / 3) % 2 == 0;
                char fc = sparkle ? '*' : 'o';
                TColorAttr fa = sparkle ? FOOD_ATTR_A : FOOD_ATTR_B;
                setCell(lineBuf[food.x], fc, fa);
            }

            // Draw snake body (tail first so head overwrites)
            for (int i = snakeLen - 1; i >= 0; --i) {
                if (body[i].y == y && body[i].x >= 0 && body[i].x < bw) {
                    if (i == 0) {
                        // Head
                        char hch;
                        switch (dir) {
                            case Dir::Up:    hch = '^'; break;
                            case Dir::Down:  hch = 'v'; break;
                            case Dir::Left:  hch = '<'; break;
                            case Dir::Right: hch = '>'; break;
                            default:         hch = '@'; break;
                        }
                        TColorAttr ha = gameOver ? DEAD_ATTR : HEAD_ATTR;
                        setCell(lineBuf[body[i].x], hch, ha);
                    } else {
                        // Body segment with gradient
                        TColorAttr ba = gameOver ? DEAD_ATTR : snakeColor(i, snakeLen);
                        char bc;
                        // Determine body character based on direction between segments
                        if (i > 0 && i < snakeLen - 1) {
                            Pos prev = body[i - 1];
                            Pos next = body[i + 1];
                            bool h = (prev.y == body[i].y && next.y == body[i].y);
                            bool v = (prev.x == body[i].x && next.x == body[i].x);
                            if (h) bc = '=';
                            else if (v) bc = '#';
                            else bc = '+';  // corner
                        } else {
                            bc = '#';
                        }
                        setCell(lineBuf[body[i].x], bc, ba);
                    }
                }
            }

            // Death flash overlay
            if (gameOver && deathFlash > 0) {
                // Flash the head red/white
                // (already handled above with DEAD_ATTR)
            }
        }

        // HUD area
        if (hudX + 14 <= W) {
            if (y == 1) {
                const char* title = " S N A K E ";
                for (int i = 0; title[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], title[i], TITLE_ATTR);
            } else if (y == 3) {
                char buf[32];
                snprintf(buf, sizeof(buf), " Score: %d", score);
                for (int i = 0; buf[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], buf[i], HUD_ATTR);
            } else if (y == 4) {
                char buf[32];
                snprintf(buf, sizeof(buf), " Best:  %d", highScore);
                for (int i = 0; buf[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], buf[i], HUD_ATTR);
            } else if (y == 5) {
                char buf[32];
                snprintf(buf, sizeof(buf), " Length: %d", snakeLen);
                for (int i = 0; buf[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], buf[i], HUD_ATTR);
            } else if (y == 6) {
                char buf[32];
                snprintf(buf, sizeof(buf), " Eaten: %d", eaten);
                for (int i = 0; buf[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], buf[i], HUD_ATTR);
            } else if (y == 7) {
                char buf[32];
                unsigned spd = currentSpeed();
                snprintf(buf, sizeof(buf), " Speed: %ums", spd);
                for (int i = 0; buf[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], buf[i], HUD_ATTR);
            } else if (y == 9) {
                const char* help = " Arrows: Move";
                for (int i = 0; help[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], help[i], WALL_ATTR);
            } else if (y == 10) {
                const char* help = " P: Pause";
                for (int i = 0; help[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], help[i], WALL_ATTR);
            } else if (y == 11) {
                const char* help = " R: Restart";
                for (int i = 0; help[i] && hudX + i < W; ++i)
                    setCell(lineBuf[hudX + i], help[i], WALL_ATTR);
            }
        }

        // Game over overlay (centered on board)
        if (gameOver && y == bh / 2) {
            const char* msg = " GAME OVER ";
            int msgLen = 11;
            int mx = (bw - msgLen) / 2;
            for (int i = 0; i < msgLen && mx + i < bw; ++i)
                setCell(lineBuf[mx + i], msg[i], DEAD_ATTR);
        }
        if (gameOver && y == bh / 2 + 1) {
            char buf[32];
            snprintf(buf, sizeof(buf), " Score: %d ", score);
            int msgLen = (int)strlen(buf);
            int mx = (bw - msgLen) / 2;
            for (int i = 0; i < msgLen && mx + i < bw; ++i)
                setCell(lineBuf[mx + i], buf[i], DEAD_ATTR);
        }
        if (gameOver && y == bh / 2 + 2) {
            const char* msg = " Press R ";
            int msgLen = 9;
            int mx = (bw - msgLen) / 2;
            for (int i = 0; i < msgLen && mx + i < bw; ++i)
                setCell(lineBuf[mx + i], msg[i], DEAD_ATTR);
        }

        // Paused overlay
        if (paused && !gameOver && y == bh / 2) {
            const char* msg = " PAUSED ";
            int msgLen = 8;
            int mx = (bw - msgLen) / 2;
            TColorAttr pa = TColorAttr(TColorRGB(0x00, 0x00, 0x80), TColorRGB(0xFF, 0xFF, 0xFF));
            for (int i = 0; i < msgLen && mx + i < bw; ++i)
                setCell(lineBuf[mx + i], msg[i], pa);
        }

        writeLine(0, y, W, 1, lineBuf.data());
    }
}

// ── Event handling ────────────────────────────────────────

void TSnakeView::handleEvent(TEvent &ev) {
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
                restartTimer();
            } else {
                handled = false;
            }
        } else if (paused) {
            if (ch == 'p' || ch == 'P') {
                paused = false;
                startTimer();
            } else if (ch == 'r' || ch == 'R') {
                newGame();
                restartTimer();
            } else {
                handled = false;
            }
        } else {
            // Direction changes — prevent 180-degree reversal
            if ((key == kbUp || ch == 'w' || ch == 'W') && dir != Dir::Down) {
                nextDir = Dir::Up;
            } else if ((key == kbDown || ch == 's' || ch == 'S') && dir != Dir::Up) {
                nextDir = Dir::Down;
            } else if ((key == kbLeft || ch == 'a' || ch == 'A') && dir != Dir::Right) {
                nextDir = Dir::Left;
            } else if ((key == kbRight || ch == 'd' || ch == 'D') && dir != Dir::Left) {
                nextDir = Dir::Right;
            } else if (ch == 'p' || ch == 'P') {
                paused = true;
                stopTimer();
            } else if (ch == 'r' || ch == 'R') {
                newGame();
                restartTimer();
            } else {
                handled = false;
            }
        }

        if (handled) {
            drawView();
            clearEvent(ev);
        }
    }
}

void TSnakeView::setState(ushort aState, Boolean enable) {
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

void TSnakeView::changeBounds(const TRect& bounds) {
    TView::changeBounds(bounds);
    // Reset game when window is resized since board dimensions change
    newGame();
    drawView();
}

// ── Window wrapper ────────────────────────────────────────

class TSnakeWindow : public TWindow {
public:
    explicit TSnakeWindow(const TRect &bounds)
        : TWindow(bounds, "Snake", wnNoNumber)
        , TWindowInit(&TSnakeWindow::initFrame) {}

    void setup() {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TSnakeView(c, 120));
    }

    virtual void changeBounds(const TRect& b) override {
        TWindow::changeBounds(b);
        setState(sfExposed, True);
        redraw();
    }
};

TWindow* createSnakeWindow(const TRect &bounds) {
    auto *w = new TSnakeWindow(bounds);
    w->setup();
    return w;
}
