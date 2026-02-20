#include "micropolis_ascii_view.h"

#define Uses_TWindow
#define Uses_TEvent
#include <tvision/tv.h>

#include <algorithm>
#include <sstream>

namespace {
constexpr int kWorldW = 120;
constexpr int kWorldH = 100;

TColorAttr color_for_glyph(char ch) {
    switch (ch) {
        case '~': return TColorAttr(0x1F); // water
        case '"': return TColorAttr(0x2F); // woods
        case '=': return TColorAttr(0x07); // road
        case '#': return TColorAttr(0x08); // rail
        case 'R': return TColorAttr(0x2A); // residential
        case 'C': return TColorAttr(0x1B); // commercial
        case 'I': return TColorAttr(0x6E); // industrial
        case 'H': return TColorAttr(0x7C); // hospital
        case 'P': return TColorAttr(0x1F); // police
        case 'F': return TColorAttr(0x4F); // fire station
        case '*': return TColorAttr(0x4E); // fire
        case ':': return TColorAttr(0x08); // rubble
        default: return TColorAttr(0x07);
    }
}
} // namespace

TMicropolisAsciiView::TMicropolisAsciiView(const TRect &bounds) : TView(bounds) {
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable;
    eventMask |= evBroadcast;
    bridge_.initialize_new_city(seed_, 2);
}

TMicropolisAsciiView::~TMicropolisAsciiView() {
    stopTimer();
}

void TMicropolisAsciiView::startTimer() {
    if (timerId_ == 0) {
        timerId_ = setTimer(120, 120);
    }
}

void TMicropolisAsciiView::stopTimer() {
    if (timerId_ != 0) {
        killTimer(timerId_);
        timerId_ = 0;
    }
}

void TMicropolisAsciiView::clampCamera() {
    const int viewW = std::max(1, size.x);
    const int viewH = std::max(1, size.y - 1);
    const int maxX = std::max(0, kWorldW - viewW);
    const int maxY = std::max(0, kWorldH - viewH);
    camX_ = std::max(0, std::min(camX_, maxX));
    camY_ = std::max(0, std::min(camY_, maxY));
}

void TMicropolisAsciiView::advanceSim() {
    bridge_.tick(1);
}

void TMicropolisAsciiView::draw() {
    TDrawBuffer b;

    const auto s = bridge_.snapshot();
    std::ostringstream status;
    status << "Micropolis ASCII seed=" << seed_
           << " t=" << s.city_time
           << " pop=" << s.total_pop
           << " score=" << s.city_score
           << " R/C/I=" << s.res_valve << "/" << s.com_valve << "/" << s.ind_valve
           << " cam=" << camX_ << "," << camY_;
    std::string line = status.str();
    if ((int)line.size() > size.x) {
        line.resize(size.x);
    }
    b.moveChar(0, ' ', TColorAttr(0x70), size.x);
    b.moveStr(0, line.c_str(), TColorAttr(0x70));
    writeLine(0, 0, size.x, 1, b);

    for (int y = 1; y < size.y; ++y) {
        b.moveChar(0, ' ', TColorAttr(0x07), size.x);
        const int wy = camY_ + (y - 1);
        for (int x = 0; x < size.x; ++x) {
            const int wx = camX_ + x;
            if (wx < kWorldW && wy < kWorldH) {
                const char g = bridge_.glyph_for_tile(bridge_.tile_at(wx, wy));
                b.putChar(x, g);
                b.putAttribute(x, color_for_glyph(g));
            }
        }
        writeLine(0, y, size.x, 1, b);
    }
}

void TMicropolisAsciiView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId_ != 0 && ev.message.infoPtr == timerId_) {
            advanceSim();
            drawView();
            clearEvent(ev);
            return;
        }
    }
    if (ev.what == evKeyDown) {
        const ushort key = ev.keyDown.keyCode;
        bool moved = false;
        if (key == kbLeft) { camX_ -= 1; moved = true; }
        else if (key == kbRight) { camX_ += 1; moved = true; }
        else if (key == kbUp) { camY_ -= 1; moved = true; }
        else if (key == kbDown) { camY_ += 1; moved = true; }
        else if (key == kbPgUp) { camY_ -= 8; moved = true; }
        else if (key == kbPgDn) { camY_ += 8; moved = true; }
        else if (key == kbHome) { camX_ = 0; camY_ = 0; moved = true; }
        if (moved) {
            clampCamera();
            drawView();
            clearEvent(ev);
        }
    }
}

void TMicropolisAsciiView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if ((aState & sfExposed) != 0) {
        if (enable) {
            clampCamera();
            startTimer();
            drawView();
        } else {
            stopTimer();
        }
    }
}

class TMicropolisAsciiWindow : public TWindow {
public:
    explicit TMicropolisAsciiWindow(const TRect &bounds)
        : TWindow(bounds, "Micropolis ASCII MVP", wnNoNumber)
        , TWindowInit(&TMicropolisAsciiWindow::initFrame) {}

    void setup() {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TMicropolisAsciiView(c));
    }
};

TWindow* createMicropolisAsciiWindow(const TRect &bounds) {
    auto *w = new TMicropolisAsciiWindow(bounds);
    w->setup();
    return w;
}
