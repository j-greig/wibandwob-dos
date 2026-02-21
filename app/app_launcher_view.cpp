/*---------------------------------------------------------*/
/*   app_launcher_view.cpp — Applications folder browser   */
/*   macOS Finder-style app launcher for WibWob-DOS        */
/*---------------------------------------------------------*/

#define Uses_TWindow
#define Uses_TView
#define Uses_TScrollBar
#define Uses_TDrawBuffer
#define Uses_TKeys
#define Uses_TEvent
#define Uses_TRect
#include <tvision/tv.h>

#include "app_launcher_view.h"
#include <algorithm>
#include <cstring>

// ── Command IDs (must match test_pattern_app.cpp) ──
// We reference these via the AppEntry.command field.

// ── Palette ──
// Index 1: normal bg
// Index 2: normal text
// Index 3: icon glyph
// Index 4: focused bg
// Index 5: focused text
// Index 6: focused icon
// Index 7: category bar
// Index 8: category selected

#define cpAppGrid "\x08\x09\x0A\x0B\x0C\x0D\x0E\x0F"

// Internal command for category change
static const ushort cmCategoryChanged = 9900;
// Internal command for launching selected app
static const ushort cmLaunchApp = 9901;

// ═══════════════════════════════════════════════════
//  TCategoryBar
// ═══════════════════════════════════════════════════

constexpr const char* TCategoryBar::categories[];

TCategoryBar::TCategoryBar(const TRect& bounds)
    : TView(bounds), selected(0)
{
    eventMask |= evMouseDown | evKeyDown;
}

void TCategoryBar::draw()
{
    TDrawBuffer buf;

    TColorAttr normal = TColorAttr(TColorRGB(180, 180, 180), TColorRGB(30, 30, 40));
    TColorAttr sel    = TColorAttr(TColorRGB(255, 255, 255), TColorRGB(0, 80, 160));

    buf.moveChar(0, ' ', normal, size.x);

    int x = 1;
    for (int i = 0; i < NUM_CATEGORIES; i++) {
        TColorAttr attr = (i == selected) ? sel : normal;
        const char* label = categories[i];
        int len = (int)strlen(label);

        // Pad: " Label "
        if (x < size.x) buf.moveChar(x, ' ', attr, 1);
        x++;
        if (x + len <= size.x) buf.moveStr(x, label, attr);
        x += len;
        if (x < size.x) buf.moveChar(x, ' ', attr, 1);
        x++;
        // Gap
        x++;
    }

    writeLine(0, 0, size.x, 1, buf);
}

void TCategoryBar::handleEvent(TEvent& event)
{
    TView::handleEvent(event);

    if (event.what == evMouseDown) {
        // Figure out which category was clicked
        int x = 1;
        for (int i = 0; i < NUM_CATEGORIES; i++) {
            int len = (int)strlen(categories[i]) + 2; // " Label "
            if (event.mouse.where.x >= x && event.mouse.where.x < x + len) {
                if (i != selected) {
                    selected = i;
                    drawView();
                    // Notify parent
                    TEvent notify;
                    notify.what = evCommand;
                    notify.message.command = cmCategoryChanged;
                    notify.message.infoInt = i;
                    putEvent(notify);
                }
                clearEvent(event);
                return;
            }
            x += len + 1;
        }
    }

    if (event.what == evKeyDown) {
        bool changed = false;
        switch (event.keyDown.keyCode) {
            case kbTab:
                selected = (selected + 1) % NUM_CATEGORIES;
                changed = true;
                break;
            case kbShiftTab:
                selected = (selected + NUM_CATEGORIES - 1) % NUM_CATEGORIES;
                changed = true;
                break;
        }
        if (changed) {
            drawView();
            TEvent notify;
            notify.what = evCommand;
            notify.message.command = cmCategoryChanged;
            notify.message.infoInt = selected;
            putEvent(notify);
            clearEvent(event);
        }
    }
}

// ═══════════════════════════════════════════════════
//  TAppGridView
// ═══════════════════════════════════════════════════

TAppGridView::TAppGridView(const TRect& bounds, TScrollBar* aVScrollBar)
    : TView(bounds), focused(0), scrollOffset(0), vScrollBar(aVScrollBar)
{
    eventMask |= evMouseDown | evKeyDown | evBroadcast;
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable | ofFirstClick;
    rebuildFilter();
}

int TAppGridView::cols() const
{
    int c = size.x / CELL_W;
    return c < 1 ? 1 : c;
}

int TAppGridView::rows() const
{
    int n = (int)filtered.size();
    int c = cols();
    return (n + c - 1) / c;
}

int TAppGridView::visibleRows() const
{
    return size.y / CELL_H;
}

void TAppGridView::rebuildFilter()
{
    filtered.clear();
    for (int i = 0; i < (int)allApps.size(); i++) {
        if (currentFilter.empty() || allApps[i].category == currentFilter)
            filtered.push_back(i);
    }
    if (focused >= (int)filtered.size())
        focused = filtered.empty() ? 0 : (int)filtered.size() - 1;
    scrollOffset = 0;
    adjustScrollBar();
}

void TAppGridView::setFilter(const std::string& category)
{
    currentFilter = category;
    rebuildFilter();
    drawView();
}

void TAppGridView::adjustScrollBar()
{
    if (vScrollBar) {
        int total = rows();
        int vis = visibleRows();
        vScrollBar->setParams(scrollOffset, 0, total > vis ? total - vis : 0, vis, 1);
    }
}

void TAppGridView::ensureFocusVisible()
{
    int c = cols();
    int focusRow = focused / c;
    int vis = visibleRows();

    if (focusRow < scrollOffset)
        scrollOffset = focusRow;
    else if (focusRow >= scrollOffset + vis)
        scrollOffset = focusRow - vis + 1;

    adjustScrollBar();
}

const AppEntry* TAppGridView::focusedApp() const
{
    if (focused >= 0 && focused < (int)filtered.size())
        return &allApps[filtered[focused]];
    return nullptr;
}

TPalette& TAppGridView::getPalette() const
{
    static TPalette palette(cpAppGrid, sizeof(cpAppGrid) - 1);
    return palette;
}

void TAppGridView::draw()
{
    TDrawBuffer buf;

    TColorAttr bgAttr     = TColorAttr(TColorRGB(40, 40, 50),   TColorRGB(20, 20, 28));
    TColorAttr nameAttr   = TColorAttr(TColorRGB(200, 200, 210), TColorRGB(20, 20, 28));
    TColorAttr iconAttr   = TColorAttr(TColorRGB(100, 180, 255), TColorRGB(20, 20, 28));
    TColorAttr descAttr   = TColorAttr(TColorRGB(120, 120, 130), TColorRGB(20, 20, 28));

    TColorAttr focBg      = TColorAttr(TColorRGB(40, 40, 50),   TColorRGB(0, 60, 130));
    TColorAttr focName    = TColorAttr(TColorRGB(255, 255, 255), TColorRGB(0, 60, 130));
    TColorAttr focIcon    = TColorAttr(TColorRGB(130, 210, 255), TColorRGB(0, 60, 130));
    TColorAttr focDesc    = TColorAttr(TColorRGB(200, 200, 220), TColorRGB(0, 60, 130));

    int c = cols();

    for (int y = 0; y < size.y; y++) {
        buf.moveChar(0, ' ', bgAttr, size.x);

        int gridRow = scrollOffset + y / CELL_H;
        int cellLine = y % CELL_H;

        for (int col = 0; col < c; col++) {
            int idx = gridRow * c + col;
            if (idx < 0 || idx >= (int)filtered.size()) continue;

            const AppEntry& app = allApps[filtered[idx]];
            bool isFocused = (idx == focused);
            int cellX = col * CELL_W;

            TColorAttr bg   = isFocused ? focBg   : bgAttr;
            TColorAttr name = isFocused ? focName  : nameAttr;
            TColorAttr icon = isFocused ? focIcon  : iconAttr;
            TColorAttr desc = isFocused ? focDesc  : descAttr;

            // Fill cell background
            if (isFocused && cellX < size.x) {
                int fillW = CELL_W < (size.x - cellX) ? CELL_W : (size.x - cellX);
                buf.moveChar(cellX, ' ', bg, fillW);
            }

            switch (cellLine) {
                case 0: // top padding / separator
                    break;
                case 1: { // icon + name: "🐍 Snake"
                    std::string line = app.icon + " " + app.name;
                    if ((int)line.size() > CELL_W - 2) line.resize(CELL_W - 2);
                    // Draw icon chars
                    if (cellX + 1 < size.x && app.icon.size() >= 2) {
                        buf.moveStr(cellX + 1, app.icon.c_str(), icon);
                        std::string nm = " " + app.name;
                        if ((int)nm.size() > CELL_W - 4) nm.resize(CELL_W - 4);
                        buf.moveStr(cellX + 1 + (int)app.icon.size(), nm.c_str(), name);
                    }
                    break;
                }
                case 2: { // description
                    std::string d = app.description;
                    if ((int)d.size() > CELL_W - 2) d.resize(CELL_W - 2);
                    if (cellX + 1 < size.x)
                        buf.moveStr(cellX + 1, d.c_str(), desc);
                    break;
                }
                case 3: // bottom padding
                    break;
            }
        }

        writeLine(0, y, size.x, 1, buf);
    }
}

void TAppGridView::handleEvent(TEvent& event)
{
    TView::handleEvent(event);

    if (event.what == evKeyDown) {
        int c = cols();
        int n = (int)filtered.size();
        if (n == 0) return;

        int oldFocused = focused;
        bool handled = true;

        switch (event.keyDown.keyCode) {
            case kbLeft:
                if (focused > 0) focused--;
                break;
            case kbRight:
                if (focused < n - 1) focused++;
                break;
            case kbUp:
                if (focused >= c) focused -= c;
                break;
            case kbDown:
                if (focused + c < n) focused += c;
                break;
            case kbHome:
                focused = 0;
                break;
            case kbEnd:
                focused = n - 1;
                break;
            case kbEnter: {
                // Launch the focused app
                const AppEntry* app = focusedApp();
                if (app && app->command) {
                    TEvent launch;
                    launch.what = evCommand;
                    launch.message.command = app->command;
                    launch.message.infoPtr = nullptr;
                    putEvent(launch);
                }
                clearEvent(event);
                return;
            }
            default:
                handled = false;
                break;
        }

        if (handled) {
            if (focused != oldFocused) {
                ensureFocusVisible();
                drawView();
            }
            clearEvent(event);
        }
    }

    if (event.what == evMouseDown) {
        int c = cols();
        int col = event.mouse.where.x / CELL_W;
        int row = scrollOffset + event.mouse.where.y / CELL_H;
        int idx = row * c + col;
        if (idx >= 0 && idx < (int)filtered.size()) {
            if (idx == focused && event.mouse.eventFlags & meDoubleClick) {
                // Double-click = launch
                const AppEntry* app = focusedApp();
                if (app && app->command) {
                    TEvent launch;
                    launch.what = evCommand;
                    launch.message.command = app->command;
                    launch.message.infoPtr = nullptr;
                    putEvent(launch);
                }
            }
            focused = idx;
            ensureFocusVisible();
            drawView();
        }
        clearEvent(event);
    }
}

// ═══════════════════════════════════════════════════
//  TAppLauncherWindow
// ═══════════════════════════════════════════════════

// Command IDs — must match test_pattern_app.cpp
static const ushort cmNewPaintCanvas   = 113;
static const ushort cmTextEditor       = 130;
static const ushort cmVerseField       = 138;
static const ushort cmOrbitField       = 150;
static const ushort cmMyceliumField    = 151;
static const ushort cmTorusField       = 152;
static const ushort cmCubeField        = 153;
static const ushort cmMonsterPortal    = 154;
static const ushort cmBrowser          = 170;
static const ushort cmScrambleCat      = 180;
static const ushort cmMicropolisAscii  = 213;
static const ushort cmOpenTerminal     = 214;
static const ushort cmQuadra           = 215;
static const ushort cmSnake            = 216;
static const ushort cmRogue            = 217;
static const ushort cmDeepSignal       = 219;

TAppLauncherWindow::TAppLauncherWindow(const TRect& bounds)
    : TWindowInit(&TAppLauncherWindow::initFrame),
      TWindow(bounds, "Applications", 0)
{
    flags = wfMove | wfGrow | wfClose | wfZoom;
    growMode = gfGrowAll;

    TRect interior = getExtent();
    interior.grow(-1, -1);

    // Category bar at top
    TRect catRect(interior.a.x, interior.a.y, interior.b.x, interior.a.y + 1);
    categoryBar = new TCategoryBar(catRect);
    insert(categoryBar);

    // Scrollbar
    TRect sbRect(interior.b.x - 1, interior.a.y + 2, interior.b.x, interior.b.y);
    TScrollBar* sb = new TScrollBar(sbRect);
    insert(sb);

    // Grid view
    TRect gridRect(interior.a.x, interior.a.y + 2, interior.b.x - 1, interior.b.y);
    grid = new TAppGridView(gridRect, sb);
    populateApps();
    grid->rebuildFilter();
    insert(grid);

    // Separator line between category bar and grid will be drawn by the grid
}

void TAppLauncherWindow::populateApps()
{
    auto& apps = grid->allApps;
    apps.clear();

    // ── Games ──
    apps.push_back({"open_micropolis", "Micropolis",     "\xE2\x8F\x9A", "games",    "City builder sim", cmMicropolisAscii});
    apps.push_back({"open_quadra",     "Quadra",         "\xE2\x96\xA0", "games",    "Falling blocks",   cmQuadra});
    apps.push_back({"open_snake",      "Snake",          "\xE2\x89\x88", "games",    "Classic snake",    cmSnake});
    apps.push_back({"open_rogue",      "WibWob Rogue",   "\xE2\x98\xA0", "games",    "Dungeon crawler",  cmRogue});
    apps.push_back({"open_deep_signal","Deep Signal",    "\xE2\x97\x89", "games",    "Space scanner",    cmDeepSignal});

    // ── Tools ──
    apps.push_back({"open_editor",     "Text Editor",    "\xE2\x9C\x8E", "tools",    "Edit text files",  cmTextEditor});
    apps.push_back({"open_browser",    "Browser",        "\xE2\x8C\x90", "tools",    "Web browser",      cmBrowser});
    apps.push_back({"open_terminal",   "Terminal",       "\x3E\x5F",     "tools",    "Shell terminal",   cmOpenTerminal});

    // ── Creative ──
    apps.push_back({"open_paint",      "Paint Canvas",   "\xE2\x99\xA5", "creative", "Draw & paint",     cmNewPaintCanvas});
    apps.push_back({"open_scramble",   "Scramble Cat",   "\xE2\x99\xA0", "creative", "AI chat cat",      cmScrambleCat});

    // ── Demos (generative art) ──
    apps.push_back({"open_verse",      "Verse Field",    "\xE2\x88\x9E", "demos",    "Generative art",   cmVerseField});
    apps.push_back({"open_orbit",      "Orbit Field",    "\xE2\x97\x8B", "demos",    "Orbital patterns",  cmOrbitField});
    apps.push_back({"open_mycelium",   "Mycelium",       "\xE2\x80\xA2", "demos",    "Growing network",   cmMyceliumField});
    apps.push_back({"open_torus",      "Torus Field",    "\xE2\x97\x8E", "demos",    "Torus geometry",    cmTorusField});
    apps.push_back({"open_cube",       "Cube Spinner",   "\xE2\x97\x86", "demos",    "3D cube",           cmCubeField});
    apps.push_back({"open_portal",     "Monster Portal", "\xE2\x98\x85", "demos",    "Monster generator",cmMonsterPortal});
}

void TAppLauncherWindow::handleEvent(TEvent& event)
{
    if (event.what == evCommand && event.message.command == cmCategoryChanged) {
        int cat = event.message.infoInt;
        if (cat == 0) {
            grid->setFilter("");
        } else {
            const char* cats[] = {"", "games", "tools", "creative", "demos"};
            grid->setFilter(cats[cat]);
        }
        clearEvent(event);
        return;
    }

    TWindow::handleEvent(event);
}

TWindow* createAppLauncherWindow(const TRect& bounds)
{
    return new TAppLauncherWindow(bounds);
}
