/*---------------------------------------------------------*/
/*                                                         */
/*   desktop_icon.cpp - Desktop icon layer implementation  */
/*   E011 Phase 1: F01 S01-S02, F04 S16-S17               */
/*                                                         */
/*---------------------------------------------------------*/

#define Uses_TView
#define Uses_TDeskTop
#define Uses_TDrawBuffer
#define Uses_TRect
#define Uses_TEvent
#define Uses_TKeys
#define Uses_TText
#include <tvision/tv.h>

#include "desktop_icon.h"

#include <algorithm>
#include <cstring>
#include <fstream>
#include <sstream>
#include <vector>

/*---------------------------------------------------------*/
/* TDesktopIconView                                        */
/*---------------------------------------------------------*/

TDesktopIconView::TDesktopIconView(const TRect &bounds) :
    TView(bounds),
    selectedIdx_(-1)
{
    // Transparent — don't grab focus aggressively, but accept events
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable | ofFirstClick;
    eventMask |= evKeyDown | evMouseDown | evBroadcast;
}

TDesktopIconView::~TDesktopIconView()
{
}

/*---------------------------------------------------------*/
/* Grid layout helpers                                     */
/*---------------------------------------------------------*/

int TDesktopIconView::gridCols() const
{
    if (size.x <= 0) return 1;
    int cellW = ICON_WIDTH + ICON_PADDING;
    int cols = size.x / cellW;
    return (cols < 1) ? 1 : cols;
}

int TDesktopIconView::gridRows() const
{
    if (size.y <= 0) return 1;
    int cellH = ICON_HEIGHT + ICON_PADDING;
    int rows = size.y / cellH;
    return (rows < 1) ? 1 : rows;
}

TPoint TDesktopIconView::gridToScreen(int col, int row) const
{
    int cellW = ICON_WIDTH + ICON_PADDING;
    int cellH = ICON_HEIGHT + ICON_PADDING;
    return {col * cellW, row * cellH};
}

int TDesktopIconView::iconAtPoint(TPoint p) const
{
    for (int i = 0; i < (int)icons_.size(); ++i)
    {
        TPoint pos = icons_[i].position;
        if (p.x >= pos.x && p.x < pos.x + ICON_WIDTH &&
            p.y >= pos.y && p.y < pos.y + ICON_HEIGHT)
            return i;
    }
    return -1;
}

/*---------------------------------------------------------*/
/* Icon management                                         */
/*---------------------------------------------------------*/

void TDesktopIconView::addIcon(const DesktopIcon &icon)
{
    icons_.push_back(icon);
}

void TDesktopIconView::removeIcon(const std::string &id)
{
    auto it = std::remove_if(icons_.begin(), icons_.end(),
        [&](const DesktopIcon &ic) { return ic.id == id; });
    if (it != icons_.end())
    {
        icons_.erase(it, icons_.end());
        if (selectedIdx_ >= (int)icons_.size())
            selectedIdx_ = icons_.empty() ? -1 : (int)icons_.size() - 1;
    }
}

void TDesktopIconView::clearIcons()
{
    icons_.clear();
    selectedIdx_ = -1;
}

DesktopIcon* TDesktopIconView::findIcon(const std::string &id)
{
    for (auto &ic : icons_)
        if (ic.id == id)
            return &ic;
    return nullptr;
}

/*---------------------------------------------------------*/
/* Navigation                                              */
/*---------------------------------------------------------*/

void TDesktopIconView::selectNext()
{
    if (icons_.empty()) return;
    if (selectedIdx_ < 0)
        selectedIdx_ = 0;
    else
    {
        icons_[selectedIdx_].selected = false;
        selectedIdx_ = (selectedIdx_ + 1) % (int)icons_.size();
    }
    icons_[selectedIdx_].selected = true;
    drawView();
}

void TDesktopIconView::selectPrev()
{
    if (icons_.empty()) return;
    if (selectedIdx_ < 0)
        selectedIdx_ = (int)icons_.size() - 1;
    else
    {
        icons_[selectedIdx_].selected = false;
        selectedIdx_ = (selectedIdx_ - 1 + (int)icons_.size()) % (int)icons_.size();
    }
    icons_[selectedIdx_].selected = true;
    drawView();
}

void TDesktopIconView::selectNone()
{
    if (selectedIdx_ >= 0 && selectedIdx_ < (int)icons_.size())
        icons_[selectedIdx_].selected = false;
    selectedIdx_ = -1;
    drawView();
}

DesktopIcon* TDesktopIconView::selectedIcon()
{
    if (selectedIdx_ >= 0 && selectedIdx_ < (int)icons_.size())
        return &icons_[selectedIdx_];
    return nullptr;
}

/*---------------------------------------------------------*/
/* Launch                                                   */
/*---------------------------------------------------------*/

void TDesktopIconView::launchSelected()
{
    DesktopIcon *ic = selectedIcon();
    if (!ic || ic->command.empty())
        return;

    // Store the command to launch, then fire a command event.
    // The app picks up cmDesktopLaunch and reads pendingLaunchCmd_.
    pendingLaunchCmd_ = ic->command;
    TEvent ev;
    ev.what = evCommand;
    ev.message.command = cmDesktopLaunch;
    ev.message.infoPtr = (void *)pendingLaunchCmd_.c_str();
    putEvent(ev);
}

/*---------------------------------------------------------*/
/* Auto-arrange                                             */
/*---------------------------------------------------------*/

void TDesktopIconView::arrangeIcons()
{
    int cols = gridCols();
    int col = 0, row = 0;
    for (auto &ic : icons_)
    {
        ic.position = gridToScreen(col, row);
        ++col;
        if (col >= cols)
        {
            col = 0;
            ++row;
        }
    }
    drawView();
}

/*---------------------------------------------------------*/
/* Drawing                                                  */
/*---------------------------------------------------------*/

void TDesktopIconView::drawIcon(TDrawBuffer &, const DesktopIcon &,
                                 int, int, bool) const
{
    // Unused — drawing is done inline in draw() for efficiency.
}

void TDesktopIconView::draw()
{
    // Normal: black icons on grey, matching the TV desktop pattern
    TColorAttr normalBorder = TColorAttr(TColorRGB(60, 60, 60),   TColorRGB(176, 176, 176));
    TColorAttr normalFill   = TColorAttr(TColorRGB(0, 0, 0),      TColorRGB(200, 200, 200));
    TColorAttr normalArt    = TColorAttr(TColorRGB(0, 0, 0),      TColorRGB(200, 200, 200));

    // Selected: white-on-blue (classic TV highlight, colour only here)
    TColorAttr selBorder = TColorAttr(TColorRGB(255, 255, 255), TColorRGB(0, 0, 170));
    TColorAttr selFill   = TColorAttr(TColorRGB(255, 255, 255), TColorRGB(0, 0, 170));
    TColorAttr selArt    = TColorAttr(TColorRGB(255, 255, 100), TColorRGB(0, 0, 170));

    // Background: grey desktop pattern (░ char like original TV)
    TColorAttr bgAttr = TColorAttr(TColorRGB(128, 128, 128), TColorRGB(0, 0, 170));

    // Border characters (box-drawing)
    static const char *topLeft    = "\xe2\x94\x8c"; // ┌
    static const char *topRight   = "\xe2\x94\x90"; // ┐
    static const char *botLeft    = "\xe2\x94\x94"; // └
    static const char *botRight   = "\xe2\x94\x98"; // ┘
    static const char *horiz      = "\xe2\x94\x80"; // ─
    static const char *vert       = "\xe2\x94\x82"; // │

    TDrawBuffer buf;
    for (int y = 0; y < size.y; ++y)
    {
        // Grey pattern background like original TV desktop
        buf.moveChar(0, '\xB0', bgAttr, size.x); // ░

        for (int i = 0; i < (int)icons_.size(); ++i)
        {
            const DesktopIcon &ic = icons_[i];
            int iconTop = ic.position.y;
            int iconLeft = ic.position.x;
            int localY = y - iconTop;

            if (localY < 0 || localY >= ICON_HEIGHT)
                continue;
            if (iconLeft < 0 || iconLeft >= size.x)
                continue;

            bool sel = (i == selectedIdx_);
            TColorAttr borderAttr = sel ? selBorder : normalBorder;
            TColorAttr fillAttr   = sel ? selFill   : normalFill;
            TColorAttr artAttr    = sel ? selArt    : normalArt;
            int innerW = ICON_WIDTH - 2;

            if (localY == 0)
            {
                // Top border: ┌──────────────┐
                buf.moveStr(iconLeft, topLeft, borderAttr);
                for (int x = 1; x < ICON_WIDTH - 1; ++x)
                    buf.moveStr(iconLeft + x, horiz, borderAttr);
                buf.moveStr(iconLeft + ICON_WIDTH - 1, topRight, borderAttr);
            }
            else if (localY == ICON_HEIGHT - 1)
            {
                // Bottom border: └──────────────┘
                buf.moveStr(iconLeft, botLeft, borderAttr);
                for (int x = 1; x < ICON_WIDTH - 1; ++x)
                    buf.moveStr(iconLeft + x, horiz, borderAttr);
                buf.moveStr(iconLeft + ICON_WIDTH - 1, botRight, borderAttr);
            }
            else if (localY >= GLYPH_AREA_TOP &&
                     localY < GLYPH_AREA_TOP + GLYPH_AREA_H)
            {
                // Art rows: │  <art centered>  │
                buf.moveStr(iconLeft, vert, borderAttr);
                buf.moveChar(iconLeft + 1, ' ', fillAttr, innerW);
                buf.moveStr(iconLeft + ICON_WIDTH - 1, vert, borderAttr);

                int artRow = localY - GLYPH_AREA_TOP;
                if (artRow >= 0 && artRow < (int)ic.art.size())
                {
                    const std::string &line = ic.art[artRow];
                    int lineLen = (int)line.size();
                    int pad = (innerW - lineLen) / 2;
                    if (pad < 0) pad = 0;
                    buf.moveStr(iconLeft + 1 + pad, line.c_str(), artAttr);
                }
            }
            else if (localY == LABEL_ROW)
            {
                // Label row: │  <label centered>  │
                buf.moveStr(iconLeft, vert, borderAttr);
                buf.moveChar(iconLeft + 1, ' ', fillAttr, innerW);
                buf.moveStr(iconLeft + ICON_WIDTH - 1, vert, borderAttr);

                std::string lbl = ic.label;
                if ((int)lbl.size() > innerW)
                    lbl = lbl.substr(0, innerW);
                int pad = (innerW - (int)lbl.size()) / 2;
                if (pad < 0) pad = 0;
                buf.moveStr(iconLeft + 1 + pad, lbl.c_str(), fillAttr);
            }
            else
            {
                // Other interior rows (padding between art and label)
                buf.moveStr(iconLeft, vert, borderAttr);
                buf.moveChar(iconLeft + 1, ' ', fillAttr, innerW);
                buf.moveStr(iconLeft + ICON_WIDTH - 1, vert, borderAttr);
            }
        }

        writeLine(0, y, size.x, 1, buf);
    }
}

/*---------------------------------------------------------*/
/* Event handling                                           */
/*---------------------------------------------------------*/

void TDesktopIconView::handleEvent(TEvent &ev)
{
    TView::handleEvent(ev);

    if (ev.what == evKeyDown)
    {
        switch (ev.keyDown.keyCode)
        {
            case kbRight:
            case kbTab:
                selectNext();
                clearEvent(ev);
                break;
            case kbLeft:
            case kbShiftTab:
                selectPrev();
                clearEvent(ev);
                break;
            case kbDown:
            {
                // Move down one row in grid
                int cols = gridCols();
                if (selectedIdx_ >= 0 && selectedIdx_ + cols < (int)icons_.size())
                {
                    icons_[selectedIdx_].selected = false;
                    selectedIdx_ += cols;
                    icons_[selectedIdx_].selected = true;
                    drawView();
                }
                clearEvent(ev);
                break;
            }
            case kbUp:
            {
                int cols = gridCols();
                if (selectedIdx_ >= cols)
                {
                    icons_[selectedIdx_].selected = false;
                    selectedIdx_ -= cols;
                    icons_[selectedIdx_].selected = true;
                    drawView();
                }
                clearEvent(ev);
                break;
            }
            case kbEnter:
                launchSelected();
                clearEvent(ev);
                break;
            case kbEsc:
                selectNone();
                clearEvent(ev);
                break;
        }
    }
    else if (ev.what == evMouseDown)
    {
        TPoint local = makeLocal(ev.mouse.where);
        int idx = iconAtPoint(local);
        if (idx >= 0)
        {
            if (selectedIdx_ >= 0 && selectedIdx_ < (int)icons_.size())
                icons_[selectedIdx_].selected = false;
            selectedIdx_ = idx;
            icons_[selectedIdx_].selected = true;
            drawView();

            // Double-click launches
            if (ev.mouse.eventFlags & meDoubleClick)
                launchSelected();

            clearEvent(ev);
        }
        else
        {
            selectNone();
        }
    }
}

/*---------------------------------------------------------*/
/* Persistence — minimal JSON                              */
/*---------------------------------------------------------*/

bool TDesktopIconView::saveState(const std::string &path) const
{
    std::ofstream f(path);
    if (!f) return false;
    f << "[\n";
    for (int i = 0; i < (int)icons_.size(); ++i)
    {
        const auto &ic = icons_[i];
        if (i > 0) f << ",\n";
        f << "  {\"id\":\"" << ic.id
          << "\",\"label\":\"" << ic.label
          << "\",\"command\":\"" << ic.command
          << "\",\"category\":\"" << ic.category
          << "\",\"x\":" << ic.position.x
          << ",\"y\":" << ic.position.y
          << "}";
    }
    f << "\n]\n";
    return true;
}

bool TDesktopIconView::loadState(const std::string &path)
{
    // Minimal JSON array parsing — same hand-rolled style as the rest of the codebase
    std::ifstream f(path);
    if (!f) return false;
    std::string content((std::istreambuf_iterator<char>(f)),
                         std::istreambuf_iterator<char>());
    // TODO: parse JSON and populate icons_
    // For now just return false to indicate no saved state
    (void)content;
    return false;
}

/*---------------------------------------------------------*/
/* Factory                                                  */
/*---------------------------------------------------------*/

TDesktopIconView* createDesktopIconView(const TRect &desktopBounds)
{
    return new TDesktopIconView(desktopBounds);
}

void populateDefaultIcons(TDesktopIconView *view)
{
    if (!view) return;

    TColorAttr white = TColorAttr(TColorRGB(200, 200, 200), TColorRGB(0, 0, 80));
    TColorAttr bright = TColorAttr(TColorRGB(255, 255, 255), TColorRGB(0, 0, 80));
    TColorAttr green = TColorAttr(TColorRGB(100, 255, 100), TColorRGB(0, 0, 80));
    TColorAttr cyan  = TColorAttr(TColorRGB(100, 200, 255), TColorRGB(0, 0, 80));
    TColorAttr gold  = TColorAttr(TColorRGB(255, 200, 80),  TColorRGB(0, 0, 80));
    TColorAttr pink  = TColorAttr(TColorRGB(255, 150, 200), TColorRGB(0, 0, 80));

    // Helper to build an icon
    auto make = [&](const char *id, const char *label, const char *cmd,
                    const char *cat, TColorAttr artCol,
                    std::vector<std::string> art) -> DesktopIcon
    {
        DesktopIcon ic;
        ic.id = id;
        ic.label = label;
        ic.command = cmd;
        ic.category = cat;
        ic.art = std::move(art);
        ic.color = white;
        ic.artColor = artCol;
        return ic;
    };

    // ── Apps ──────────────────────────────────────────────

    view->addIcon(make("terminal", "Terminal", "open_terminal", "apps", green, {
        " ,-------. ",
        " |C:\\>_  | ",
        " |       | ",
        " `-------' ",
    }));

    view->addIcon(make("browser", "Browser", "open_browser", "apps", cyan, {
        " .-------. ",
        " | W W W | ",
        " |-------| ",
        " |_______| ",
    }));

    view->addIcon(make("paint", "Paint", "new_paint_canvas", "apps", pink, {
        "    /|     ",
        "   / |     ",
        "  /  | ___ ",
        " /___||___]",
    }));

    view->addIcon(make("text_edit", "Editor", "open_text_editor", "apps", bright, {
        " .-------. ",
        " |= --- =| ",
        " | ----- | ",
        " |_______| ",
    }));

    // ── Games ─────────────────────────────────────────────

    view->addIcon(make("micropolis", "Micropolis", "open_micropolis_ascii", "games", gold, {
        "  _  n  _  ",
        " |=||H||=| ",
        " |=||=||=| ",
        " |_||_||_| ",
    }));

    view->addIcon(make("quadra", "Quadra", "open_quadra", "games", cyan, {
        "   [][]    ",
        "   []      ",
        "     [][]  ",
        "       []  ",
    }));

    view->addIcon(make("snake", "Snake", "open_snake", "games", green, {
        "  @@@      ",
        "    @      ",
        "    @@@    ",
        "      @>>  ",
    }));

    view->addIcon(make("rogue", "Rogue", "open_rogue", "games", gold, {
        " .##..##.  ",
        " #..@..#.  ",
        " .#....#.  ",
        " ..####..  ",
    }));

    view->addIcon(make("deep_sig", "Deep Signal", "open_deep_signal", "games", cyan, {
        "    *      ",
        "  * . *    ",
        " *  .  *   ",
        "  * . *    ",
    }));

    // ── Generative Art ────────────────────────────────────

    view->addIcon(make("verse", "Verse", "open_verse", "art", pink, {
        "  ~ ~ ~ ~  ",
        " ~ . ~ . ~ ",
        "  ~ ~ ~ ~  ",
        " ~ . ~ . ~ ",
    }));

    view->addIcon(make("mycelium", "Mycelium", "open_mycelium", "art", green, {
        "  \\|/ /|   ",
        "   |/  |   ",
        "  /|  /|\\  ",
        " / | / | \\ ",
    }));

    view->addIcon(make("orbit", "Orbit", "open_orbit", "art", cyan, {
        "   .---.   ",
        "  / . o \\  ",
        "  \\ o . /  ",
        "   `---'   ",
    }));

    // ── Folders (open folder windows) ───────────────────

    view->addIcon(make("folder_apps", "Apps", "open_folder:apps", "", bright, {
        " .-------. ",
        " | .---. | ",
        " | |   | | ",
        " |_`---'_| ",
    }));

    view->addIcon(make("folder_games", "Games", "open_folder:games", "", gold, {
        " .-------. ",
        " | .---. | ",
        " | |   | | ",
        " |_`---'_| ",
    }));

    view->addIcon(make("folder_art", "Art", "open_folder:art", "", cyan, {
        " .-------. ",
        " | .---. | ",
        " | |   | | ",
        " |_`---'_| ",
    }));

    // ── Scramble (always on desktop) ──────────────────────

    view->addIcon(make("scramble", "Scramble", "open_scramble", "", pink, {
        "  /\\_/\\    ",
        " ( o.o )   ",
        "  > ^ <    ",
        " /|   |\\   ",
    }));

    view->arrangeIcons();
}
