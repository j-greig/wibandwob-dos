#include "micropolis_ascii_view.h"
#include "micropolis_tool_palette.h"

#define Uses_TWindow
#define Uses_TEvent
#include <tvision/tv.h>

#include <algorithm>
#include <cstdlib>
#include <sstream>

namespace {
constexpr int kWorldW = 120;
constexpr int kWorldH = 100;

// Tool IDs matching EditingTool enum in vendor/MicropolisCore/MicropolisEngine/src/tool.h
// Kept here to avoid pulling engine headers into the view
constexpr int kToolRes      = 0;  // TOOL_RESIDENTIAL
constexpr int kToolCom      = 1;  // TOOL_COMMERCIAL
constexpr int kToolInd      = 2;  // TOOL_INDUSTRIAL
constexpr int kToolQuery    = 5;  // TOOL_QUERY
constexpr int kToolWire     = 6;  // TOOL_WIRE
constexpr int kToolBulldoze = 7;  // TOOL_BULLDOZER
constexpr int kToolRoad      = 9;  // TOOL_ROAD
constexpr int kToolCoalPower = 13; // TOOL_COALPOWER   (4×4 footprint)
constexpr int kToolNucPower  = 14; // TOOL_NUCLEARPOWER (4×4 footprint)

const char* tool_name(int tool_id) {
    switch (tool_id) {
        case kToolQuery:    return "Query";
        case kToolBulldoze: return "Bulldoze";
        case kToolRoad:      return "Road";
        case kToolWire:     return "Wire";
        case kToolRes:      return "Res";
        case kToolCom:      return "Com";
        case kToolInd:      return "Ind";
        case kToolCoalPower: return "CoalPwr";
        case kToolNucPower:  return "NucPwr";
        default:            return "?";
    }
}

static const char* kMonthNames[] = {
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
};

// Speed levels: index = simSpeed_ value (0-4)
// Ticks fired per 120ms timer pulse
static const int kTicksPerFire[] = { 0, 1, 4, 16, 64 };
static const char* kSpeedNames[]  = { "||PAUSE", "1-SLOW", "2-MED", "3-FAST", "4-ULTRA" };

std::string save_slot_path(int slot) {
    if (slot < 1) slot = 1;
    if (slot > 3) slot = 3;
    return "saves/slot" + std::to_string(slot) + ".city";
}

TColorAttr color_for_glyph(char ch, char zone_prefix = '\0') {
    if ((ch == '1' || ch == '2' || ch == '3') &&
        (zone_prefix == 'r' || zone_prefix == 'c' || zone_prefix == 'i')) {
        if (zone_prefix == 'r') {
            if (ch == '1') return TColorAttr(0x02);
            if (ch == '2') return TColorAttr(0x0A);
            return TColorAttr(0x0F);
        }
        if (zone_prefix == 'c') {
            if (ch == '1') return TColorAttr(0x01);
            if (ch == '2') return TColorAttr(0x09);
            return TColorAttr(0x0B);
        }
        if (ch == '1') return TColorAttr(0x06);
        if (ch == '2') return TColorAttr(0x0E);
        return TColorAttr(0x0C);
    }

    if (ch == '.' && (zone_prefix == 'r' || zone_prefix == 'c' || zone_prefix == 'i')) {
        return color_for_glyph(zone_prefix);
    }

    switch (ch) {
        case '~': return TColorAttr(0x1F); // water
        case '"': return TColorAttr(0x2F); // woods
        case '-': return TColorAttr(0x08); // road horizontal
        case '|': return TColorAttr(0x08); // road vertical
        case '+': return TColorAttr(0x08); // road intersections
        case '#': return TColorAttr(0x08); // rail
        case 'w': return TColorAttr(0x0B); // wire
        case 'r': return TColorAttr(0x02); // residential
        case 'c': return TColorAttr(0x01); // commercial
        case 'i': return TColorAttr(0x06); // industrial
        case 'H': return TColorAttr(0x0D); // hospital
        case 'P': return TColorAttr(0x1E); // police
        case 'F': return TColorAttr(0x4F); // fire station
        case '*': return TColorAttr(0x4E); // fire / power plant
        case ':': return TColorAttr(0x08); // rubble
        default:  return TColorAttr(0x07);
    }
}

} // namespace

TMicropolisAsciiView::TMicropolisAsciiView(const TRect &bounds) : TView(bounds) {
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable;
    eventMask |= evBroadcast;
    bridge_.initialize_new_city(seed_, 2);
    std::system("mkdir -p saves");
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
    const bool useWideTiles = size.x >= 2;
    const int viewW = std::max(1, useWideTiles ? size.x / 2 : size.x);
    const int viewH = std::max(1, size.y - 2); // top bar + bottom bar
    const int maxX = std::max(0, kWorldW - viewW);
    const int maxY = std::max(0, kWorldH - viewH);
    camX_ = std::max(0, std::min(camX_, maxX));
    camY_ = std::max(0, std::min(camY_, maxY));
}

void TMicropolisAsciiView::clampCursor() {
    curX_ = std::max(0, std::min(curX_, kWorldW - 1));
    curY_ = std::max(0, std::min(curY_, kWorldH - 1));
}

void TMicropolisAsciiView::autopanTowardCursor() {
    const bool useWideTiles = size.x >= 2;
    const int viewW = std::max(1, useWideTiles ? size.x / 2 : size.x);
    const int viewH = std::max(1, size.y - 2);
    const int margin = 2;
    if (curX_ < camX_ + margin)          camX_ = curX_ - margin;
    if (curX_ >= camX_ + viewW - margin) camX_ = curX_ - viewW + margin + 1;
    if (curY_ < camY_ + margin)          camY_ = curY_ - margin;
    if (curY_ >= camY_ + viewH - margin) camY_ = curY_ - viewH + margin + 1;
}

void TMicropolisAsciiView::applyActiveTool() {
    if (activeTool_ == kToolQuery) return;
    const auto result = bridge_.apply_tool(activeTool_, curX_, curY_);
    lastResult_ = result.message;
    lastResultTick_ = 25;
}

void TMicropolisAsciiView::advanceSim() {
    const int ticks = kTicksPerFire[simSpeed_];
    if (ticks > 0) bridge_.tick(ticks);
    if (lastResultTick_ > 0) --lastResultTick_;
}

void TMicropolisAsciiView::draw() {
    TDrawBuffer b;
    const bool useWideTiles = size.x >= 2;
    const int visibleTiles = std::max(1, useWideTiles ? size.x / 2 : size.x);

    // --- Top strip (row 0) ---
    const auto s = bridge_.snapshot();
    const int month = static_cast<int>((s.city_time % 48) / 4);
    const int year  = static_cast<int>(s.city_time / 48 + 1900);
    std::ostringstream top;
    top << "$" << s.total_funds
        << "  " << kMonthNames[std::max(0, std::min(month, 11))] << " " << year
        << "  Pop:" << s.total_pop
        << "  Score:" << s.city_score
        << "  R:" << (s.res_valve >= 0 ? "+" : "") << s.res_valve
        << " C:" << (s.com_valve >= 0 ? "+" : "") << s.com_valve
        << " I:" << (s.ind_valve >= 0 ? "+" : "") << s.ind_valve
        << "  [" << kSpeedNames[simSpeed_] << "] -/+"
        << "  Slot:" << saveSlot_ << "  F2:save F3:load";
    std::string topLine = top.str();
    if ((int)topLine.size() > size.x) topLine.resize(size.x);
    b.moveChar(0, ' ', TColorAttr(0x70), size.x);
    b.moveStr(0, topLine.c_str(), TColorAttr(0x70));
    writeLine(0, 0, size.x, 1, b);

    // --- Map rows (1 to size.y-2) ---
    for (int y = 1; y < size.y - 1; ++y) {
        b.moveChar(0, ' ', TColorAttr(0x07), size.x);
        const int wy = camY_ + (y - 1);
        if (useWideTiles) {
            for (int tx = 0; tx < visibleTiles; ++tx) {
                const int wx = camX_ + tx;
                const int x  = tx * 2;
                if (wx < kWorldW && wy < kWorldH) {
                    const std::string pair = bridge_.glyph_pair_for_tile(bridge_.tile_at(wx, wy));
                    const char g0 = pair.empty() ? '?' : pair[0];
                    const char g1 = pair.size() > 1 ? pair[1] : ' ';
                    const bool isCursor = (wx == curX_ && wy == curY_);
                    const TColorAttr attr0 = isCursor ? TColorAttr(0x70) : color_for_glyph(g0);
                    const TColorAttr attr1 = isCursor ? TColorAttr(0x70) : color_for_glyph(g1, g0);
                    b.putChar(x, g0);
                    b.putAttribute(x, attr0);
                    if (x + 1 < size.x) {
                        b.putChar(x + 1, g1);
                        b.putAttribute(x + 1, attr1);
                    }
                }
            }
        } else {
            for (int x = 0; x < size.x; ++x) {
                const int wx = camX_ + x;
                if (wx < kWorldW && wy < kWorldH) {
                    const char g = bridge_.glyph_for_tile(bridge_.tile_at(wx, wy));
                    const bool isCursor = (wx == curX_ && wy == curY_);
                    b.putChar(x, g);
                    b.putAttribute(x, isCursor ? TColorAttr(0x70) : color_for_glyph(g));
                }
            }
        }
        writeLine(0, y, size.x, 1, b);
    }

    // --- Bottom hint row (last row) ---
    if (size.y >= 2) {
        std::ostringstream hint;
        hint << "[" << tool_name(activeTool_) << "]"
             << " 1:Qry 2:Blz 3:Rd 4:Wr 5:R 6:C 7:I 8:Coal 9:Nuc"
             << "  Ent:place Esc:cancel";
        if (lastResultTick_ > 0 && !lastResult_.empty()) {
            hint << "  >> " << lastResult_;
        }
        std::string hintLine = hint.str();
        if ((int)hintLine.size() > size.x) hintLine.resize(size.x);
        b.moveChar(0, ' ', TColorAttr(0x30), size.x);
        b.moveStr(0, hintLine.c_str(), TColorAttr(0x30));
        writeLine(0, size.y - 1, size.x, 1, b);
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
        const uchar  ch  = ev.keyDown.charScan.charCode;
        bool handled = true;

        // Cursor movement — camera auto-pans at edge
        if      (key == kbLeft)  { curX_--; }
        else if (key == kbRight) { curX_++; }
        else if (key == kbUp)    { curY_--; }
        else if (key == kbDown)  { curY_++; }
        else if (key == kbPgUp)  { curY_ -= 8; }
        else if (key == kbPgDn)  { curY_ += 8; }
        else if (key == kbHome)  { curX_ = 60; curY_ = 50; } // recenter

        // Tool select  (1=Query 2=Bulldoze 3=Road 4=Wire 5=Res 6=Com 7=Ind)
        else if (ch == '1') { activeTool_ = kToolQuery; }
        else if (ch == '2') { activeTool_ = kToolBulldoze; }
        else if (ch == '3') { activeTool_ = kToolRoad; }
        else if (ch == '4') { activeTool_ = kToolWire; }
        else if (ch == '5') { activeTool_ = kToolRes; }
        else if (ch == '6') { activeTool_ = kToolCom; }
        else if (ch == '7') { activeTool_ = kToolInd; }
        else if (ch == '8') { activeTool_ = kToolCoalPower; }
        else if (ch == '9') { activeTool_ = kToolNucPower; }

        // Speed controls
        else if (ch == 'p' || ch == 'P') { simSpeed_ = (simSpeed_ == 0) ? 1 : 0; }
        else if (ch == '-' || ch == '_') { if (simSpeed_ > 0) --simSpeed_; }
        else if (ch == '+' || ch == '=') { if (simSpeed_ < 4) ++simSpeed_; }

        // Apply tool
        else if (key == kbEnter || ch == ' ') { applyActiveTool(); }

        // Save/load slots
        else if (key == kbF2) {
            const auto result = bridge_.save_city(save_slot_path(saveSlot_));
            lastResult_ = result.message;
            lastResultTick_ = 25;
        }
        else if (key == kbF3) {
            const auto result = bridge_.load_city(save_slot_path(saveSlot_));
            lastResult_ = result.message;
            lastResultTick_ = 25;
            if (result.ok) {
                camX_ = 0;
                camY_ = 0;
            }
        }
        else if (key == kbTab) {
            saveSlot_ = (saveSlot_ % 3) + 1;
            lastResult_ = "Slot " + std::to_string(saveSlot_);
            lastResultTick_ = 25;
        }

        // Cancel / query mode
        else if (key == kbEsc || ch == 'q') { activeTool_ = kToolQuery; lastResult_.clear(); lastResultTick_ = 0; }

        else { handled = false; }

        if (handled) {
            clampCursor();
            autopanTowardCursor();
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
        : TWindow(bounds, "WibWobCity", wnNoNumber)
        , TWindowInit(&TMicropolisAsciiWindow::initFrame) {}

    void setup() {
        options |= ofTileable;
        TRect interior = getExtent();
        interior.grow(-1, -1);
        constexpr int kPaletteW = 16;
        TRect mapRect = interior;
        mapRect.b.x -= kPaletteW;
        TRect palRect = interior;
        palRect.a.x = interior.b.x - kPaletteW;

        auto *mapView = new TMicropolisAsciiView(mapRect);
        auto *palette = new TMicropolisToolPalette(palRect, mapView);
        insert(mapView);
        insert(palette);
    }
};

TWindow* createMicropolisAsciiWindow(const TRect &bounds) {
    auto *w = new TMicropolisAsciiWindow(bounds);
    w->setup();
    return w;
}
