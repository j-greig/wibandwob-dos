#include "micropolis_tool_palette.h"

#include "micropolis_ascii_view.h"

#include <algorithm>
#include <sstream>
#include <string>

namespace {

constexpr int kToolRes = 0;
constexpr int kToolCom = 1;
constexpr int kToolInd = 2;
constexpr int kToolQuery = 5;
constexpr int kToolWire = 6;
constexpr int kToolBulldoze = 7;
constexpr int kToolRoad = 9;
constexpr int kToolCoalPower = 13;
constexpr int kToolNucPower = 14;

struct PaletteToolRow {
    int hotkey;
    int toolId;
    const char *name;
    const char *cost;
};

const PaletteToolRow kToolRows[] = {
    {1, kToolQuery, "Query", "$0"},
    {2, kToolBulldoze, "Bulldoze", "$1"},
    {3, kToolRoad, "Road", "$10"},
    {4, kToolWire, "Wire", "$5"},
    {5, kToolRes, "Res", "$100"},
    {6, kToolCom, "Com", "$100"},
    {7, kToolInd, "Ind", "$100"},
    {8, kToolCoalPower, "CoalPwr", "$3k"},
    {9, kToolNucPower, "NucPwr", "$5k"},
};

const char* kMonthNames[] = {
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
};

std::string fitLine(const std::string &s, int width) {
    if (width <= 0) {
        return std::string();
    }
    if ((int)s.size() <= width) {
        return s;
    }
    return s.substr(0, width);
}

void writeFilledLine(TView *view, int y, TColorAttr attr, const std::string &text) {
    if (y < 0 || y >= view->size.y) {
        return;
    }
    TDrawBuffer b;
    b.moveChar(0, ' ', attr, view->size.x);
    const std::string out = fitLine(text, view->size.x);
    if (!out.empty()) {
        b.moveStr(0, out.c_str(), attr);
    }
    view->writeLine(0, y, view->size.x, 1, b);
}

std::string formatFundsDate(const MicropolisSnapshot &s, int width) {
    const int month = static_cast<int>((s.city_time % 48) / 4);
    const int year = static_cast<int>(s.city_time / 48 + 1900);
    std::ostringstream line;
    line << "$" << s.total_funds << " "
         << kMonthNames[std::max(0, std::min(month, 11))] << " " << year;
    return fitLine(line.str(), width);
}

std::string formatToolRow(const PaletteToolRow &row, bool active, int width) {
    if (width <= 0) {
        return std::string();
    }
    std::string text(width, ' ');

    std::ostringstream prefix;
    prefix << (active ? '>' : ' ') << row.hotkey << " " << row.name;
    const std::string left = prefix.str();
    const std::string cost = row.cost;

    for (int i = 0; i < width && i < (int)left.size(); ++i) {
        text[i] = left[i];
    }

    int start = width - static_cast<int>(cost.size());
    if (start < 0) {
        start = 0;
    }
    for (int i = 0; i < (int)cost.size() && (start + i) < width; ++i) {
        text[start + i] = cost[i];
    }

    return text;
}

} // namespace

TMicropolisToolPalette::TMicropolisToolPalette(const TRect &bounds, TMicropolisAsciiView *mapView)
    : TView(bounds)
    , map_(mapView) {
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evBroadcast;
}

void TMicropolisToolPalette::draw() {
    const MicropolisSnapshot s = map_ ? map_->snapshot() : MicropolisSnapshot{};
    const int activeTool = map_ ? map_->activeTool() : -1;
    const int saveSlot = map_ ? map_->saveSlot() : 1;
    const std::string result = map_ ? map_->lastResult() : std::string();
    const int resultTick = map_ ? map_->lastResultTick() : 0;

    int y = 0;
    writeFilledLine(this, y++, TColorAttr(0x70), formatFundsDate(s, size.x));

    std::ostringstream pop;
    pop << "Pop: " << s.total_pop;
    writeFilledLine(this, y++, TColorAttr(0x70), fitLine(pop.str(), size.x));

    writeFilledLine(this, y++, TColorAttr(0x07), std::string(std::max(0, size.x), '-'));

    for (const PaletteToolRow &row : kToolRows) {
        const bool isActive = row.toolId == activeTool;
        const TColorAttr attr = isActive ? TColorAttr(0x1F) : TColorAttr(0x03);
        writeFilledLine(this, y++, attr, formatToolRow(row, isActive, size.x));
    }

    writeFilledLine(this, y++, TColorAttr(0x07), std::string(std::max(0, size.x), '-'));

    if (resultTick > 0 && !result.empty()) {
        writeFilledLine(this, y++, TColorAttr(0x70), fitLine(std::string(">> ") + result, size.x));
    } else {
        writeFilledLine(this, y++, TColorAttr(0x70), std::string());
    }

    const std::string footerLines[] = {
        std::string("Slot: ") + std::to_string(saveSlot),
        "F2 save",
        "F3 load",
        "Tab: slot",
    };
    for (const std::string &line : footerLines) {
        if (y >= size.y) {
            break;
        }
        writeFilledLine(this, y++, TColorAttr(0x08), fitLine(line, size.x));
    }

    for (; y < size.y; ++y) {
        writeFilledLine(this, y, TColorAttr(0x07), std::string());
    }
}

void TMicropolisToolPalette::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);

    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        drawView();
    }
}
