/*---------------------------------------------------------*/
/*                                                         */
/*   animated_gradient_view.cpp - Animated Gradient View  */
/*                                                         */
/*---------------------------------------------------------*/

#include "animated_gradient_view.h"

#define Uses_TWindow
#define Uses_TEvent
#include <tvision/tv.h>

TAnimatedHGradientView::TAnimatedHGradientView(
    const TRect &bounds, 
    unsigned periodMs,
    TColorRGB startColor,
    TColorRGB endColor
) : TView(bounds), 
    periodMs(periodMs), 
    startColor(startColor), 
    endColor(endColor)
{
    // Anchor to top-left and grow to the right and bottom like other views.
    growMode = gfGrowHiX | gfGrowHiY;
    // Receive timer expirations via broadcast events (cmTimerExpired)
    eventMask |= evBroadcast;
}

TAnimatedHGradientView::~TAnimatedHGradientView() {
    stopTimer();
}

void TAnimatedHGradientView::setSpeed(unsigned periodMs_) {
    periodMs = periodMs_ ? periodMs_ : 1;
    if (timerId) {
        stopTimer();
        startTimer();
    }
}

void TAnimatedHGradientView::setColors(TColorRGB start, TColorRGB end) {
    startColor = start;
    endColor = end;
}

void TAnimatedHGradientView::startTimer() {
    if (timerId == 0)
        timerId = setTimer(periodMs, (int)periodMs);
}

void TAnimatedHGradientView::stopTimer() {
    if (timerId != 0) {
        killTimer(timerId);
        timerId = 0;
    }
}

void TAnimatedHGradientView::advance() {
    // Simple phase accumulator; creates flowing effect
    ++phase;
}

// Linear interpolation between two colors
TColorRGB TAnimatedHGradientView::interpolate(TColorRGB start, TColorRGB end, float t) {
    // Clamp t to [0, 1] range
    if (t < 0.0f) t = 0.0f;
    if (t > 1.0f) t = 1.0f;
    
    int r = (int)(start.r + (end.r - start.r) * t);
    int g = (int)(start.g + (end.g - start.g) * t);
    int b = (int)(start.b + (end.b - start.b) * t);
    
    return TColorRGB(r, g, b);
}

void TAnimatedHGradientView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    // Ensure line buffer fits the current width (avoids TDrawBuffer 132-col cap).
    if ((int)lineBuf.size() < W)
        lineBuf.resize(W);

    const char fillChar = '\xDB';  // Full block character

    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            // Horizontal gradient with animation phase offset
            // Colors flow left to right, with phase creating the animation
            float t;
            if (W > 1) {
                // Add phase to create flowing effect, wrap around using modulo
                int animatedX = (x + phase) % (W * 2);  // Double width for smoother flow
                if (animatedX >= W) {
                    animatedX = (W * 2 - 1) - animatedX;  // Bounce back
                }
                t = (float)animatedX / (W - 1);
            } else {
                t = 0.0f;
            }
            
            TColorRGB color = interpolate(startColor, endColor, t);
            TColorAttr attr(color, color);  // Same fore/back color for solid block
            
            setCell(lineBuf[x], fillChar, attr);
        }
        writeLine(0, y, W, 1, lineBuf.data());
    }
}

void TAnimatedHGradientView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId != 0 && ev.message.infoPtr == timerId) {
            advance();
            drawView();
            clearEvent(ev);
        }
    }
}

void TAnimatedHGradientView::setState(ushort aState, Boolean enable) {
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

void TAnimatedHGradientView::changeBounds(const TRect& bounds)
{
    TView::changeBounds(bounds);
    // Re-render immediately to cover any newly exposed area.
    drawView();
}

// A wrapper window to ensure proper redraws on resize/tile.
class TAnimatedGradientWindow : public TWindow {
public:
    explicit TAnimatedGradientWindow(const TRect &bounds)
        : TWindow(bounds, "Animated Gradient", wnNoNumber)
        , TWindowInit(&TAnimatedGradientWindow::initFrame) {}

    void setup()
    {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TAnimatedHGradientView(c, /*periodMs=*/100));
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
TWindow* createAnimatedGradientWindow(const TRect &bounds)
{
    auto *w = new TAnimatedGradientWindow(bounds);
    w->setup();
    return w;
}