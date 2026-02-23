/*---------------------------------------------------------*/
/*   ascii_gallery_view.cpp — ASCII Art Gallery Browser    */
/*---------------------------------------------------------*/

#define Uses_TWindow
#define Uses_TView
#define Uses_TScrollBar
#define Uses_TInputLine
#define Uses_TDrawBuffer
#define Uses_TKeys
#define Uses_TEvent
#define Uses_TRect
#define Uses_TFrame
#define Uses_TProgram
#include <tvision/tv.h>

#include "ascii_gallery_view.h"
#include <algorithm>
#include <cstring>
#include <dirent.h>
#include <fstream>
#include <cctype>
#include <sys/stat.h>

// Internal commands
static const ushort cmGalleryTabChanged = 9910;
static const ushort cmGalleryFileChanged = 9911;
static const ushort cmGalleryOpenFile = 9912;
static const ushort cmGallerySearchChanged = 9913;

// ═══════════════════════════════════════════════════
//  TGalleryTabBar
// ═══════════════════════════════════════════════════

constexpr const char* TGalleryTabBar::tabLabels[];

TGalleryTabBar::TGalleryTabBar(const TRect& bounds)
    : TView(bounds), selected(0)
{
    // NOT selectable — we don't want the tab bar to steal keyboard focus.
    // Tab switching is handled at the window level via number keys.
    eventMask |= evMouseDown;
}

bool TGalleryTabBar::matchesTab(int tabIndex, char firstChar)
{
    char c = (char)std::tolower((unsigned char)firstChar);
    switch (tabIndex) {
        case 0: return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'c');
        case 1: return c >= 'd' && c <= 'l';
        case 2: return c == 'm';
        case 3: return c >= 'n' && c <= 's';
        case 4: return c >= 't' && c <= 'z';
        case 5: return true; // search — match all (filtered by search string)
        default: return false;
    }
}

void TGalleryTabBar::draw()
{
    TDrawBuffer b;
    TColorAttr normalAttr = {TColorRGB(0xAA, 0xAA, 0xAA), TColorRGB(0x20, 0x20, 0x20)};
    TColorAttr selectedAttr = {TColorRGB(0xFF, 0xFF, 0xFF), TColorRGB(0x00, 0x70, 0x70)};
    TColorAttr numAttr = {TColorRGB(0xFF, 0xFF, 0x00), TColorRGB(0x20, 0x20, 0x20)};
    TColorAttr numSelAttr = {TColorRGB(0xFF, 0xFF, 0x00), TColorRGB(0x00, 0x70, 0x70)};
    TColorAttr findAttr = {TColorRGB(0xFF, 0xCC, 0x00), TColorRGB(0x00, 0x70, 0x70)};

    b.moveChar(0, ' ', normalAttr, size.x);

    int x = 1;
    for (int i = 0; i < NUM_TABS && x < size.x - 1; i++) {
        bool sel = (i == selected);
        TColorAttr attr = sel ? selectedAttr : normalAttr;
        TColorAttr nAttr = sel ? numSelAttr : numAttr;
        // Find tab gets special highlight when selected
        if (i == 5 && sel) attr = findAttr;

        // Draw " N:Label "
        if (x < size.x) b.moveChar(x, ' ', attr, 1); x++;
        // Number key hint
        char num = '1' + i;
        if (x < size.x) b.moveChar(x, num, nAttr, 1); x++;
        if (x < size.x) b.moveChar(x, ':', attr, 1); x++;

        const char* label = tabLabels[i];
        int len = (int)strlen(label);
        for (int j = 0; j < len && x < size.x; j++) {
            b.moveChar(x, label[j], attr, 1);
            x++;
        }
        if (x < size.x) b.moveChar(x, ' ', attr, 1); x++;
        // Gap between tabs
        if (x < size.x) b.moveChar(x, ' ', normalAttr, 1); x++;
    }

    writeLine(0, 0, size.x, 1, b);
}

void TGalleryTabBar::handleEvent(TEvent& event)
{
    // Don't call TView::handleEvent — prevents focus stealing on click.

    if (event.what == evMouseDown) {
        TPoint local = makeLocal(event.mouse.where);
        int mx = local.x;
        int x = 1;
        for (int i = 0; i < NUM_TABS; i++) {
            int tabWidth = 4 + (int)strlen(tabLabels[i]);
            if (mx >= x && mx < x + tabWidth) {
                if (i != selected) {
                    selected = i;
                    drawView();
                    message(owner, evCommand, cmGalleryTabChanged, this);
                }
                clearEvent(event);
                return;
            }
            x += tabWidth + 1;
        }
    }
}

// ═══════════════════════════════════════════════════
//  TGalleryFileList
// ═══════════════════════════════════════════════════

static const std::string emptyStr;

TGalleryFileList::TGalleryFileList(const TRect& bounds, TScrollBar* aVScrollBar)
    : TView(bounds), focused(0), scrollOffset(0), vScrollBar(aVScrollBar)
{
    options |= ofSelectable | ofFirstClick;
    eventMask |= evMouseDown | evKeyDown | evBroadcast;
    growMode = gfGrowHiY;
}

const std::string& TGalleryFileList::focusedFile() const
{
    if (focused >= 0 && focused < (int)fullPaths.size())
        return fullPaths[focused];
    return emptyStr;
}

void TGalleryFileList::adjustScrollBar()
{
    if (vScrollBar) {
        vScrollBar->setParams(scrollOffset, 0,
            std::max(0, (int)files.size() - size.y),
            size.y - 1, 1);
    }
}

void TGalleryFileList::ensureFocusVisible()
{
    if (focused < scrollOffset)
        scrollOffset = focused;
    else if (focused >= scrollOffset + size.y)
        scrollOffset = focused - size.y + 1;
    adjustScrollBar();
}

void TGalleryFileList::draw()
{
    TColorAttr normalAttr = {TColorRGB(0xCC, 0xCC, 0xCC), TColorRGB(0x10, 0x10, 0x10)};
    TColorAttr focusedAttr = {TColorRGB(0xFF, 0xFF, 0xFF), TColorRGB(0x00, 0x50, 0x80)};

    for (int y = 0; y < size.y; y++) {
        TDrawBuffer b;
        int idx = scrollOffset + y;
        if (idx >= 0 && idx < (int)files.size()) {
            TColorAttr attr = (idx == focused) ? focusedAttr : normalAttr;
            b.moveChar(0, ' ', attr, size.x);
            const std::string& name = files[idx];
            int maxLen = size.x - 2;
            std::string display = (int)name.size() > maxLen ? name.substr(0, maxLen) : name;
            b.moveStr(1, display, attr);
        } else {
            b.moveChar(0, ' ', normalAttr, size.x);
        }
        writeLine(0, y, size.x, 1, b);
    }
}

void TGalleryFileList::handleEvent(TEvent& event)
{
    TView::handleEvent(event);

    if (event.what == evMouseDown) {
        select();
        TPoint local = makeLocal(event.mouse.where);
        int clickY = local.y;
        int idx = scrollOffset + clickY;
        if (idx >= 0 && idx < (int)files.size()) {
            focused = idx;
            ensureFocusVisible();
            drawView();
            message(owner, evCommand, cmGalleryFileChanged, this);
            if (event.mouse.eventFlags & meDoubleClick) {
                message(owner, evCommand, cmGalleryOpenFile, this);
            }
        }
        clearEvent(event);
        return;
    }

    if (event.what == evKeyDown) {
        if (files.empty()) {
            switch (event.keyDown.keyCode) {
                case kbUp: case kbDown: case kbPgUp: case kbPgDn:
                case kbHome: case kbEnd: case kbEnter:
                    clearEvent(event);
                    return;
                default:
                    return;
            }
        }
        int oldFocused = focused;
        switch (event.keyDown.keyCode) {
            case kbUp:
                if (focused > 0) focused--;
                else focused = (int)files.size() - 1;
                clearEvent(event);
                break;
            case kbDown:
                if (focused < (int)files.size() - 1) focused++;
                else focused = 0;
                clearEvent(event);
                break;
            case kbPgUp:
                focused = std::max(0, focused - size.y);
                clearEvent(event);
                break;
            case kbPgDn:
                focused = std::min((int)files.size() - 1, focused + size.y);
                clearEvent(event);
                break;
            case kbHome:
                focused = 0;
                clearEvent(event);
                break;
            case kbEnd:
                focused = (int)files.size() - 1;
                clearEvent(event);
                break;
            case kbEnter:
                message(owner, evCommand, cmGalleryOpenFile, this);
                clearEvent(event);
                return;
            default:
                return;
        }
        if (focused != oldFocused) {
            ensureFocusVisible();
            drawView();
            message(owner, evCommand, cmGalleryFileChanged, this);
        }
        return;
    }

    // Scroll bar changes
    if (event.what == evBroadcast && event.message.command == cmScrollBarChanged) {
        if (event.message.infoPtr == vScrollBar && vScrollBar) {
            scrollOffset = vScrollBar->value;
            drawView();
            clearEvent(event);
        }
    }
}

// ═══════════════════════════════════════════════════
//  TGalleryPreview (scrollable)
// ═══════════════════════════════════════════════════

TGalleryPreview::TGalleryPreview(const TRect& bounds, TScrollBar* aVScrollBar)
    : TView(bounds), scrollOffset(0), vScrollBar(aVScrollBar)
{
    options |= ofSelectable | ofFirstClick;
    eventMask |= evKeyDown | evBroadcast | evMouseDown;
    growMode = gfGrowHiX | gfGrowHiY;
}

void TGalleryPreview::adjustScrollBar()
{
    if (vScrollBar) {
        vScrollBar->setParams(scrollOffset, 0,
            std::max(0, (int)lines.size() - size.y),
            size.y - 1, 1);
    }
}

void TGalleryPreview::ensureVisible(int line)
{
    if (line < scrollOffset)
        scrollOffset = line;
    else if (line >= scrollOffset + size.y)
        scrollOffset = line - size.y + 1;
    adjustScrollBar();
}

void TGalleryPreview::clear()
{
    lines.clear();
    currentPath.clear();
    scrollOffset = 0;
    adjustScrollBar();
    drawView();
}

void TGalleryPreview::loadFile(const std::string& path)
{
    if (path == currentPath) return;
    currentPath = path;
    lines.clear();
    scrollOffset = 0;

    std::ifstream f(path);
    if (!f) {
        lines.push_back("(cannot open file)");
        adjustScrollBar();
        drawView();
        return;
    }

    std::string line;
    int lineCount = 0;
    while (std::getline(f, line) && lineCount < 2000) {
        if (!line.empty() && line.back() == '\r')
            line.pop_back();
        // Stop at frame delimiter — show only first frame
        if (line == "----")
            break;
        lines.push_back(std::move(line));
        lineCount++;
    }
    adjustScrollBar();
    drawView();
}

void TGalleryPreview::draw()
{
    TColorAttr textAttr = {TColorRGB(0xDD, 0xDD, 0xDD), TColorRGB(0x00, 0x00, 0x00)};
    TColorAttr emptyAttr = {TColorRGB(0x40, 0x40, 0x40), TColorRGB(0x00, 0x00, 0x00)};

    for (int y = 0; y < size.y; y++) {
        TDrawBuffer b;
        int lineIdx = scrollOffset + y;
        if (lineIdx >= 0 && lineIdx < (int)lines.size()) {
            b.moveChar(0, ' ', textAttr, size.x);
            b.moveStr(0, lines[lineIdx], textAttr);
        } else if (lines.empty() && y == size.y / 2) {
            const char* msg = "Select a file to preview";
            b.moveChar(0, ' ', emptyAttr, size.x);
            int startX = std::max(0, (size.x - (int)strlen(msg)) / 2);
            b.moveStr(startX, msg, emptyAttr);
        } else {
            b.moveChar(0, ' ', textAttr, size.x);
        }
        writeLine(0, y, size.x, 1, b);
    }
}

void TGalleryPreview::handleEvent(TEvent& event)
{
    TView::handleEvent(event);

    if (event.what == evMouseDown) {
        select();
        clearEvent(event);
        return;
    }

    if (event.what == evKeyDown) {
        if (lines.empty()) {
            // Consume nav keys silently when empty
            switch (event.keyDown.keyCode) {
                case kbUp: case kbDown: case kbPgUp: case kbPgDn:
                case kbHome: case kbEnd:
                    clearEvent(event);
                    return;
                default:
                    return;
            }
        }
        int maxScroll = std::max(0, (int)lines.size() - size.y);
        int oldOffset = scrollOffset;
        switch (event.keyDown.keyCode) {
            case kbUp:
                if (scrollOffset > 0) scrollOffset--;
                clearEvent(event);
                break;
            case kbDown:
                if (scrollOffset < maxScroll) scrollOffset++;
                clearEvent(event);
                break;
            case kbPgUp:
                scrollOffset = std::max(0, scrollOffset - size.y);
                clearEvent(event);
                break;
            case kbPgDn:
                scrollOffset = std::min(maxScroll, scrollOffset + size.y);
                clearEvent(event);
                break;
            case kbHome:
                scrollOffset = 0;
                clearEvent(event);
                break;
            case kbEnd:
                scrollOffset = maxScroll;
                clearEvent(event);
                break;
            default:
                return;
        }
        if (scrollOffset != oldOffset) {
            adjustScrollBar();
            drawView();
        }
        return;
    }

    // Scroll bar changes
    if (event.what == evBroadcast && event.message.command == cmScrollBarChanged) {
        if (event.message.infoPtr == vScrollBar && vScrollBar) {
            scrollOffset = vScrollBar->value;
            drawView();
            clearEvent(event);
        }
    }
}

// ═══════════════════════════════════════════════════
//  TGalleryWindow
// ═══════════════════════════════════════════════════

TGalleryWindow::TGalleryWindow(const TRect& bounds, const std::string& aPrimerDir)
    : TWindowInit(&TWindow::initFrame),
      TWindow(bounds, "ASCII Gallery", wnNoNumber),
      primerDir(aPrimerDir),
      searchInput(nullptr)
{
    options |= ofTileable;

    TRect interior = getExtent();
    interior.grow(-1, -1); // Inside frame

    // Tab bar at top (1 row) — not selectable
    TRect tabR(interior.a.x, interior.a.y, interior.b.x, interior.a.y + 1);
    tabBar = new TGalleryTabBar(tabR);
    insert(tabBar);

    // Search input (hidden by default, shown when Find tab active)
    // Sits just below the tab bar, spans the file list width
    int listWidth = std::min(32, interior.b.x / 3);
    TRect searchR(interior.a.x, interior.a.y + 1, interior.a.x + listWidth - 1, interior.a.y + 2);
    searchInput = new TInputLine(searchR, 128);
    searchInput->hide();
    insert(searchInput);

    // Scroll bar for file list
    TRect sbR(interior.a.x + listWidth - 1, interior.a.y + 1, interior.a.x + listWidth, interior.b.y);
    listScrollBar = new TScrollBar(sbR);
    insert(listScrollBar);

    // File list — selectable/focusable
    TRect listR(interior.a.x, interior.a.y + 1, interior.a.x + listWidth - 1, interior.b.y);
    fileList = new TGalleryFileList(listR, listScrollBar);
    insert(fileList);

    // Preview scroll bar (right edge of preview area)
    TRect psbR(interior.b.x - 1, interior.a.y + 1, interior.b.x, interior.b.y);
    previewScrollBar = new TScrollBar(psbR);
    insert(previewScrollBar);

    // Preview pane — now selectable for scroll focus
    TRect prevR(interior.a.x + listWidth, interior.a.y + 1, interior.b.x - 1, interior.b.y);
    preview = new TGalleryPreview(prevR, previewScrollBar);
    insert(preview);

    // Scan files and apply initial filter
    scanFiles();
    applyFilter();

    // Give keyboard focus to the file list
    fileList->select();
}

int TGalleryWindow::getSelected() const
{
    return tabBar ? tabBar->selected : 0;
}

const std::string& TGalleryWindow::getSearchText() const
{
    return lastSearchText;
}

void TGalleryWindow::setSelected(int tabIndex)
{
    if (!tabBar)
        return;

    if (tabIndex < 0)
        tabIndex = 0;
    if (tabIndex >= TGalleryTabBar::NUM_TABS)
        tabIndex = TGalleryTabBar::NUM_TABS - 1;

    tabBar->selected = tabIndex;
    tabBar->drawView();
    showSearchInput(tabIndex == 5);
    applyFilter();
    if (tabIndex == 5 && searchInput)
        searchInput->select();
}

void TGalleryWindow::setSearchText(const std::string& text)
{
    lastSearchText = text;
    if (searchInput)
        searchInput->setData(const_cast<char*>(text.c_str()));
    if (tabBar && tabBar->selected == 5)
        applySearch();
}

void TGalleryWindow::scanFiles()
{
    allFiles.clear();
    allPaths.clear();

    DIR* dir = opendir(primerDir.c_str());
    if (!dir) return;

    struct dirent* entry;
    while ((entry = readdir(dir)) != nullptr) {
        if (entry->d_name[0] == '.') continue;
        std::string name = entry->d_name;
        if (name.size() < 5) continue;
        std::string ext = name.substr(name.size() - 4);
        if (ext != ".txt") continue;

        allFiles.push_back(name);
        allPaths.push_back(primerDir + "/" + name);
    }
    closedir(dir);

    // Sort alphabetically via index array
    std::vector<size_t> indices(allFiles.size());
    for (size_t i = 0; i < indices.size(); i++) indices[i] = i;
    std::sort(indices.begin(), indices.end(), [&](size_t a, size_t b) {
        return allFiles[a] < allFiles[b];
    });

    std::vector<std::string> sortedFiles, sortedPaths;
    sortedFiles.reserve(allFiles.size());
    sortedPaths.reserve(allPaths.size());
    for (size_t i : indices) {
        sortedFiles.push_back(allFiles[i]);
        sortedPaths.push_back(allPaths[i]);
    }
    allFiles = std::move(sortedFiles);
    allPaths = std::move(sortedPaths);
}

void TGalleryWindow::applyFilter()
{
    int tabIdx = tabBar->selected;

    // Search tab — delegate to applySearch()
    if (tabIdx == 5) {
        applySearch();
        return;
    }

    std::vector<std::string> filtered;
    std::vector<std::string> filteredPaths;

    for (size_t i = 0; i < allFiles.size(); i++) {
        if (!allFiles[i].empty() &&
            TGalleryTabBar::matchesTab(tabIdx, allFiles[i][0])) {
            filtered.push_back(allFiles[i]);
            filteredPaths.push_back(allPaths[i]);
        }
    }

    fileList->files = filtered;
    fileList->fullPaths = filteredPaths;
    fileList->focused = 0;
    fileList->scrollOffset = 0;
    fileList->adjustScrollBar();
    fileList->drawView();

    fileList->select();
    updatePreview();
}

void TGalleryWindow::applySearch()
{
    // Get current search text
    char buf[130] = {};
    if (searchInput) {
        // TInputLine stores data in its internal buffer
        const char* data = searchInput->data;
        if (data) strncpy(buf, data, sizeof(buf) - 1);
    }
    std::string query(buf);

    // Lowercase for case-insensitive match
    std::string lowerQuery;
    lowerQuery.reserve(query.size());
    for (char c : query)
        lowerQuery += (char)std::tolower((unsigned char)c);

    std::vector<std::string> filtered;
    std::vector<std::string> filteredPaths;

    for (size_t i = 0; i < allFiles.size(); i++) {
        if (lowerQuery.empty()) {
            // Empty query = show all
            filtered.push_back(allFiles[i]);
            filteredPaths.push_back(allPaths[i]);
        } else {
            // Case-insensitive substring match
            std::string lowerName;
            lowerName.reserve(allFiles[i].size());
            for (char c : allFiles[i])
                lowerName += (char)std::tolower((unsigned char)c);
            if (lowerName.find(lowerQuery) != std::string::npos) {
                filtered.push_back(allFiles[i]);
                filteredPaths.push_back(allPaths[i]);
            }
        }
    }

    fileList->files = filtered;
    fileList->fullPaths = filteredPaths;
    fileList->focused = 0;
    fileList->scrollOffset = 0;
    fileList->adjustScrollBar();
    fileList->drawView();

    updatePreview();
}

void TGalleryWindow::updatePreview()
{
    const std::string& path = fileList->focusedFile();
    if (path.empty())
        preview->clear();
    else
        preview->loadFile(path);
}

void TGalleryWindow::showSearchInput(bool show)
{
    if (!searchInput) return;

    TRect interior = getExtent();
    interior.grow(-1, -1);
    int listWidth = std::min(32, interior.b.x / 3);

    if (show) {
        searchInput->show();
        // Shrink file list top by 1 row to make room for search input
        TRect listR(interior.a.x, interior.a.y + 2, interior.a.x + listWidth - 1, interior.b.y);
        fileList->changeBounds(listR);
        // Move list scrollbar too
        TRect sbR(interior.a.x + listWidth - 1, interior.a.y + 2, interior.a.x + listWidth, interior.b.y);
        listScrollBar->changeBounds(sbR);
    } else {
        searchInput->hide();
        // Restore file list to full height
        TRect listR(interior.a.x, interior.a.y + 1, interior.a.x + listWidth - 1, interior.b.y);
        fileList->changeBounds(listR);
        TRect sbR(interior.a.x + listWidth - 1, interior.a.y + 1, interior.a.x + listWidth, interior.b.y);
        listScrollBar->changeBounds(sbR);
    }
    fileList->adjustScrollBar();
    fileList->drawView();
}

void TGalleryWindow::cycleFocus(bool forward)
{
    bool searchVisible = (tabBar->selected == 5);

    // Build focus order: fileList → preview → [searchInput]
    TView* focusOrder[3];
    int count = 0;
    focusOrder[count++] = fileList;
    focusOrder[count++] = preview;
    if (searchVisible && searchInput)
        focusOrder[count++] = searchInput;

    // Find current focused view
    TView* current = this->current; // TGroup::current = focused subview
    int currentIdx = -1;
    for (int i = 0; i < count; i++) {
        if (focusOrder[i] == current) {
            currentIdx = i;
            break;
        }
    }

    int nextIdx;
    if (currentIdx < 0) {
        nextIdx = 0; // default to file list
    } else if (forward) {
        nextIdx = (currentIdx + 1) % count;
    } else {
        nextIdx = (currentIdx + count - 1) % count;
    }

    focusOrder[nextIdx]->select();
}

void TGalleryWindow::handleEvent(TEvent& event)
{
    // Intercept Tab/Shift-Tab BEFORE TWindow processes them
    // (TWindow would try to do its own focus cycling otherwise)
    if (event.what == evKeyDown) {
        if (event.keyDown.keyCode == kbTab) {
            cycleFocus(true);
            clearEvent(event);
            return;
        } else if (event.keyDown.keyCode == kbShiftTab) {
            cycleFocus(false);
            clearEvent(event);
            return;
        }
    }

    // Let TWindow dispatch to focused subview first
    TWindow::handleEvent(event);

    if (event.what == evCommand) {
        switch (event.message.command) {
            case cmGalleryTabChanged:
                showSearchInput(tabBar->selected == 5);
                applyFilter();
                // If search tab, focus the input
                if (tabBar->selected == 5 && searchInput) {
                    searchInput->select();
                }
                clearEvent(event);
                break;
            case cmGalleryFileChanged:
                updatePreview();
                clearEvent(event);
                break;
            case cmGalleryOpenFile: {
                const std::string& path = fileList->focusedFile();
                if (!path.empty()) {
                    openPath = path;
                    message(TProgram::application, evCommand, 109 /* cmOpenAnimation */,
                            (void*)openPath.c_str());
                }
                clearEvent(event);
                break;
            }
        }
    }

    // Window-level number key shortcuts for tab switching
    if (event.what == evKeyDown) {
        char ch = event.keyDown.charScan.charCode;
        if (ch >= '1' && ch <= '0' + TGalleryTabBar::NUM_TABS) {
            // Only intercept number keys if NOT in the search input
            // (let user type numbers into search field)
            if (tabBar->selected != 5 || this->current != searchInput) {
                int newTab = ch - '1';
                if (newTab != tabBar->selected) {
                    tabBar->selected = newTab;
                    tabBar->drawView();
                    showSearchInput(newTab == 5);
                    applyFilter();
                    if (newTab == 5 && searchInput) {
                        searchInput->select();
                    }
                }
                clearEvent(event);
            }
        }
        // Escape in search input → back to file list
        else if (event.keyDown.keyCode == kbEsc && tabBar->selected == 5
                 && this->current == searchInput) {
            fileList->select();
            clearEvent(event);
        }
        // Enter in search input → focus file list to navigate results
        else if (event.keyDown.keyCode == kbEnter && tabBar->selected == 5
                 && this->current == searchInput) {
            fileList->select();
            clearEvent(event);
        }
    }

    // Live search: after every event, check if search text changed
    if (tabBar->selected == 5 && searchInput) {
        const char* data = searchInput->data;
        std::string cur(data ? data : "");
        if (cur != lastSearchText) {
            lastSearchText = cur;
            applySearch();
        }
    }
}

// ═══════════════════════════════════════════════════
//  Factory
// ═══════════════════════════════════════════════════

static std::string galleryFindPrimerDir()
{
    const char* moduleDirs[] = { "modules-private", "modules" };
    for (const char* base : moduleDirs) {
        DIR* dir = opendir(base);
        if (!dir) continue;
        struct dirent* entry;
        while ((entry = readdir(dir)) != nullptr) {
            if (entry->d_name[0] == '.') continue;
            std::string candidate = std::string(base) + "/" + entry->d_name + "/primers";
            struct stat st;
            if (stat(candidate.c_str(), &st) == 0 && S_ISDIR(st.st_mode)) {
                closedir(dir);
                return candidate;
            }
        }
        closedir(dir);
    }
    struct stat st;
    if (stat("app/primers", &st) == 0 && S_ISDIR(st.st_mode))
        return "app/primers";
    return "primers";
}

TWindow* createAsciiGalleryWindow(const TRect& bounds)
{
    std::string primerDir = galleryFindPrimerDir();
    return new TGalleryWindow(bounds, primerDir);
}
