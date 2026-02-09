/*---------------------------------------------------------*/
/*                                                         */
/*   animated_blocks_view.cpp - Zigzag Block Animation    */
/*                                                         */
/*---------------------------------------------------------*/

#include "animated_blocks_view.h"

#define Uses_TWindow
#define Uses_TEvent
#include <tvision/tv.h>

namespace {
// 16 classic ANSI-ish foreground colors on black background.
static const TColorAttr kAnsi16[16] = {
    TColorAttr(TColorRGB(0x00,0x00,0x00), TColorRGB(0x00,0x00,0x00)), // Black
    TColorAttr(TColorRGB(0x00,0x00,0x80), TColorRGB(0x00,0x00,0x00)), // Blue
    TColorAttr(TColorRGB(0x00,0x80,0x00), TColorRGB(0x00,0x00,0x00)), // Green
    TColorAttr(TColorRGB(0x00,0x80,0x80), TColorRGB(0x00,0x00,0x00)), // Cyan
    TColorAttr(TColorRGB(0x80,0x00,0x00), TColorRGB(0x00,0x00,0x00)), // Red
    TColorAttr(TColorRGB(0x80,0x00,0x80), TColorRGB(0x00,0x00,0x00)), // Magenta
    TColorAttr(TColorRGB(0x80,0x80,0x00), TColorRGB(0x00,0x00,0x00)), // Yellow (dark)
    TColorAttr(TColorRGB(0xC0,0xC0,0xC0), TColorRGB(0x00,0x00,0x00)), // Light gray
    TColorAttr(TColorRGB(0x80,0x80,0x80), TColorRGB(0x00,0x00,0x00)), // Dark gray
    TColorAttr(TColorRGB(0x00,0x00,0xFF), TColorRGB(0x00,0x00,0x00)), // Light blue
    TColorAttr(TColorRGB(0x00,0xFF,0x00), TColorRGB(0x00,0x00,0x00)), // Light green
    TColorAttr(TColorRGB(0x00,0xFF,0xFF), TColorRGB(0x00,0x00,0x00)), // Light cyan
    TColorAttr(TColorRGB(0xFF,0x00,0x00), TColorRGB(0x00,0x00,0x00)), // Light red
    TColorAttr(TColorRGB(0xFF,0x00,0xFF), TColorRGB(0x00,0x00,0x00)), // Light magenta
    TColorAttr(TColorRGB(0xFF,0xFF,0x00), TColorRGB(0x00,0x00,0x00)), // Yellow
    TColorAttr(TColorRGB(0xFF,0xFF,0xFF), TColorRGB(0x00,0x00,0x00)), // White
};
}

TAnimatedBlocksView::TAnimatedBlocksView(const TRect &bounds, unsigned periodMs)
    : TView(bounds), periodMs(periodMs)
{
    // Anchor to top-left and grow to the right and bottom like other views.
    growMode = gfGrowHiX | gfGrowHiY;
    // Receive timer expirations via broadcast events (cmTimerExpired)
    eventMask |= evBroadcast;
}

TAnimatedBlocksView::~TAnimatedBlocksView() {
    stopTimer();
}

void TAnimatedBlocksView::setSpeed(unsigned periodMs_) {
    periodMs = periodMs_ ? periodMs_ : 1;
    if (timerId) {
        stopTimer();
        startTimer();
    }
}

void TAnimatedBlocksView::startTimer() {
    if (timerId == 0)
        timerId = setTimer(periodMs, (int)periodMs);
}

void TAnimatedBlocksView::stopTimer() {
    if (timerId != 0) {
        killTimer(timerId);
        timerId = 0;
    }
}

void TAnimatedBlocksView::advance() {
    // Simple phase accumulator; wraps implicitly in draw()
    ++phase;
}

void TAnimatedBlocksView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    // Ensure line buffer fits the current width (avoids TDrawBuffer 132-col cap).
    if ((int)lineBuf.size() < W)
        lineBuf.resize(W);

    // Render H rows; even rows move right, odd rows move left.
    for (int y = 0; y < H; ++y) {
        const bool moveRight = (y % 2 == 0);
        for (int x = 0; x < W; ++x) {
            int shifted = moveRight ? (x + phase) : (x - phase);
            int idx = shifted % 16;
            if (idx < 0) idx += 16;
            setCell(lineBuf[x], '\xDB', kAnsi16[idx]);
        }
        writeLine(0, y, W, 1, lineBuf.data());
    }
}

void TAnimatedBlocksView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId != 0 && ev.message.infoPtr == timerId) {
            advance();
            drawView();
            clearEvent(ev);
        }
    }
}

void TAnimatedBlocksView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if ((aState & sfExposed) != 0) {
        if (enable) {
            phase = 0;
            startTimer();
            drawView();
        } else {
            stopTimer();
        }
    }
}

void TAnimatedBlocksView::changeBounds(const TRect& bounds)
{
    TView::changeBounds(bounds);
    // Re-render immediately to cover any newly exposed area.
    drawView();
}

// A small wrapper window to ensure proper redraws on resize/tile.
class TAnimatedBlocksWindow : public TWindow {
public:
    explicit TAnimatedBlocksWindow(const TRect &bounds)
        : TWindow(bounds, "Animated Blocks", wnNoNumber)
        , TWindowInit(&TAnimatedBlocksWindow::initFrame) {}

    void setup(unsigned periodMs)
    {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TAnimatedBlocksView(c, periodMs));
    }

    virtual void changeBounds(const TRect& b) override
    {
        TWindow::changeBounds(b);
        // Force a full redraw after tiling/resizing operations so the
        // interior animated view repaints to the new bounds immediately.
        setState(sfExposed, True);
        redraw();
    }
};

// Factory helper; creates a tileable window hosting the animated view.
TWindow* createAnimatedBlocksWindow(const TRect &bounds)
{
    return createAnimatedBlocksWindow(bounds, /*periodMs=*/42);
}

TWindow* createAnimatedBlocksWindow(const TRect &bounds, unsigned periodMs)
{
    auto *w = new TAnimatedBlocksWindow(bounds);
    w->setup(periodMs);
    return w;
}
