/*---------------------------------------------------------*/
/*                                                         */
/*   wibwob_scroll_test.cpp - Scrollbar Fix Prototypes     */
/*                                                         */
/*---------------------------------------------------------*/

#include "wibwob_scroll_test.h"

#define Uses_TKeys
#define Uses_TDrawBuffer
#define Uses_TColorAttr
#include <tvision/tv.h>

#include <algorithm>

//=============================================================================
// Shared test content - prefilled chat with ASCII art
//=============================================================================

std::vector<TestMessage> getTestChatContent() {
    return {
        {"System", "=== SCROLLBAR TEST MODE ==="},
        {"System", "Resize this window to test scrollbar behaviour."},
        {"System", "The scrollbar should: (1) always be visible, (2) fill full height, (3) track content position."},
        {"", ""},
        {"User", "Hello Wib&Wob! Can you draw me a cat?"},
        {"", ""},
        {"Wib", R"(~~~grr'ntak~~~ *manifesting feline geometry...*

      /\_/\
     ( o.o )
      > ^ <
     /|   |\
    (_|   |_)

つ◕‿◕‿⚆༽つ A quantum cat materialises!)"},
        {"", ""},
        {"User", "Nice! Now can you show me something more complex?"},
        {"", ""},
        {"Wob", R"(Certainly. Here's a robot head with precise geometric specifications:

    ┌─────────────┐
    │  ◉     ◉  │
    │      │      │
    │   ╰───╯   │
    ├─────────────┤
    │ ░░░░░░░░░░░ │
    │ ░ ROBOT ░ │
    │ ░░░░░░░░░░░ │
    └─────────────┘

つ⚆‿◕‿◕༽つ Geometric precision achieved.)"},
        {"", ""},
        {"User", "Can you show me a space scene?"},
        {"", ""},
        {"Wib", R"(*cosmic vibrations intensifying...*

    ·  *  ·    ★    ·  *
         *  ·       ·
    ·        ╭────╮    *
      *      │◐◐◐│      ·
    ·      ──┤    ├──
             │◑◑◑│   *
        *    ╰────╯     ·
    ★    ·  *     · ★
         ·    *   ·

...brl'zzzt... Space station floating in the void!)"},
        {"", ""},
        {"Wob", R"(Allow me to add some technical specifications:

    ╔════════════════════════════════╗
    ║ STATION ALPHA-7 SPECIFICATIONS ║
    ╠════════════════════════════════╣
    ║ Crew capacity:    12 personnel ║
    ║ Orbital period:   94 minutes   ║
    ║ Power output:     4.2 MW       ║
    ║ Status:           OPERATIONAL  ║
    ╚════════════════════════════════╝)"},
        {"", ""},
        {"User", "This is great! One more - something abstract?"},
        {"", ""},
        {"Wib", R"(~~~vrr'llh~ha~~~ *reality folding...*

    ╱╲╱╲╱╲╱╲╱╲╱╲╱╲
    ╲  ◇   ◇   ◇  ╱
    ╱ ◇ ▣ ◇ ▣ ◇ ╲
    ╲  ◇   ◇   ◇  ╱
    ╱╲╱╲╱╲╱╲╱╲╱╲╱╲
       ╲ ╲ ╱ ╱
        ╲ ╳ ╱
         ╲╱

Fractal consciousness tessellation complete!)"},
        {"", ""},
        // Add more lines to ensure scrollable content
        {"System", "--- Additional test content follows ---"},
        {"Test", "Line 1: Lorem ipsum dolor sit amet, consectetur adipiscing elit."},
        {"Test", "Line 2: Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."},
        {"Test", "Line 3: Ut enim ad minim veniam, quis nostrud exercitation ullamco."},
        {"Test", "Line 4: Duis aute irure dolor in reprehenderit in voluptate velit."},
        {"Test", "Line 5: Excepteur sint occaecat cupidatat non proident."},
        {"Test", "Line 6: Sunt in culpa qui officia deserunt mollit anim id est laborum."},
        {"Test", "Line 7: Curabitur pretium tincidunt lacus. Nulla gravida orci a odio."},
        {"Test", "Line 8: Nullam varius, turpis et commodo pharetra."},
        {"Test", "Line 9: Est eros bibendum elit, nec luctus magna felis sollicitudin mauris."},
        {"Test", "Line 10: Integer in mauris eu nibh euismod gravida."},
        {"System", "--- End of test content ---"},
        {"System", "Scroll up/down to verify scrollbar behaviour."},
        {"System", "Resize window to verify scrollbar repositioning."}
    };
}

//=============================================================================
// OPTION A: standardScrollBar() fix implementation
//=============================================================================

TWibWobTestViewA::TWibWobTestViewA(const TRect& bounds, TScrollBar* vScroll)
    : TView(bounds)
    , vScrollBar(vScroll)
{
    options |= ofSelectable;
    eventMask |= evKeyDown | evBroadcast;
    growMode = gfGrowHiX | gfGrowHiY;
    loadTestContent();
}

void TWibWobTestViewA::loadTestContent() {
    messages = getTestChatContent();
    updateScrollBar();
}

int TWibWobTestViewA::getMessageAreaHeight() const {
    return size.y;
}

std::vector<std::string> TWibWobTestViewA::wrapText(const std::string& text, int width) const {
    std::vector<std::string> lines;
    if (width <= 0) {
        lines.emplace_back("");
        return lines;
    }

    size_t lineStart = 0;
    const size_t length = text.size();

    while (lineStart <= length) {
        size_t newlinePos = text.find('\n', lineStart);
        std::string segment;
        if (newlinePos == std::string::npos) {
            segment = text.substr(lineStart);
        } else {
            segment = text.substr(lineStart, newlinePos - lineStart);
        }

        if (!segment.empty() && segment.back() == '\r') {
            segment.pop_back();
        }

        if (segment.empty()) {
            lines.emplace_back("");
        } else {
            size_t pos = 0;
            while (pos < segment.size()) {
                size_t slice = std::min(segment.size() - pos, static_cast<size_t>(width));
                lines.push_back(segment.substr(pos, slice));
                pos += slice;
            }
        }

        if (newlinePos == std::string::npos) break;
        lineStart = newlinePos + 1;
        if (lineStart == length) {
            lines.emplace_back("");
            break;
        }
    }

    if (lines.empty()) lines.emplace_back("");
    return lines;
}

int TWibWobTestViewA::calculateTotalLines() const {
    int total = 0;
    for (const auto& msg : messages) {
        std::string displayText = msg.sender.empty() ? msg.content : msg.sender + ": " + msg.content;
        auto wrapped = wrapText(displayText, size.x - 1);
        total += wrapped.size();
    }
    return total;
}

void TWibWobTestViewA::updateScrollBar() {
    if (!vScrollBar) return;

    int totalLines = calculateTotalLines();
    int visibleLines = getMessageAreaHeight();
    int maxScroll = std::max(0, totalLines - visibleLines);

    vScrollBar->setParams(scrollOffset, 0, maxScroll, visibleLines, 1);
}

void TWibWobTestViewA::draw() {
    TDrawBuffer buf;
    TColorAttr normalColor = getColor(1);
    TColorAttr userColor = getColor(1);
    TColorAttr wibColor = getColor(1);

    int y = 0;
    int maxY = getMessageAreaHeight();
    int currentLine = 0;

    for (const auto& msg : messages) {
        if (y >= maxY) break;

        TColorAttr msgColor = normalColor;
        if (msg.sender == "User") msgColor = userColor;
        else if (msg.sender == "Wib" || msg.sender == "Wob") msgColor = wibColor;

        std::string displayText = msg.sender.empty() ? msg.content : msg.sender + ": " + msg.content;
        auto wrappedLines = wrapText(displayText, size.x - 1);

        for (const auto& line : wrappedLines) {
            if (currentLine >= scrollOffset && y < maxY) {
                buf.moveChar(0, ' ', msgColor, size.x);
                buf.moveStr(0, line.c_str(), msgColor);
                writeLine(0, y, size.x, 1, buf);
                y++;
            }
            currentLine++;
        }
    }

    // Fill remaining space
    while (y < maxY) {
        buf.moveChar(0, ' ', normalColor, size.x);
        writeLine(0, y, size.x, 1, buf);
        y++;
    }
}

void TWibWobTestViewA::handleEvent(TEvent& event) {
    TView::handleEvent(event);

    if (event.what == evKeyDown) {
        int totalLines = calculateTotalLines();
        int maxScroll = std::max(0, totalLines - getMessageAreaHeight());

        switch (event.keyDown.keyCode) {
            case kbUp:
                if (scrollOffset > 0) { scrollOffset--; updateScrollBar(); drawView(); }
                clearEvent(event);
                break;
            case kbDown:
                if (scrollOffset < maxScroll) { scrollOffset++; updateScrollBar(); drawView(); }
                clearEvent(event);
                break;
            case kbPgUp:
                scrollOffset = std::max(0, scrollOffset - getMessageAreaHeight() / 2);
                updateScrollBar();
                drawView();
                clearEvent(event);
                break;
            case kbPgDn:
                scrollOffset = std::min(maxScroll, scrollOffset + getMessageAreaHeight() / 2);
                updateScrollBar();
                drawView();
                clearEvent(event);
                break;
            case kbHome:
                scrollOffset = 0;
                updateScrollBar();
                drawView();
                clearEvent(event);
                break;
            case kbEnd:
                scrollOffset = maxScroll;
                updateScrollBar();
                drawView();
                clearEvent(event);
                break;
        }
    } else if (event.what == evBroadcast && event.message.command == cmScrollBarChanged) {
        if (event.message.infoPtr == vScrollBar && vScrollBar) {
            scrollOffset = vScrollBar->value;
            drawView();
            clearEvent(event);
        }
    }
}

void TWibWobTestViewA::changeBounds(const TRect& bounds) {
    TView::changeBounds(bounds);
    updateScrollBar();
    drawView();
}

//-----------------------------------------------------------------------------
// TWibWobTestWindowA - Uses standardScrollBar() (KEY DIFFERENCE FROM ORIGINAL)
//-----------------------------------------------------------------------------

TWibWobTestWindowA::TWibWobTestWindowA(const TRect& bounds, const std::string& title)
    : TWindow(bounds, title.c_str(), wnNoNumber)
    , TWindowInit(&TWibWobTestWindowA::initFrame)
{
    options |= ofTileable;
    growMode = gfGrowHiX | gfGrowHiY;

    TRect client = getExtent();
    client.grow(-1, -1);

    // KEY FIX: Use standardScrollBar() instead of manual creation
    // This creates the scrollbar in the FRAME area with correct positioning
    vScrollBar = standardScrollBar(sbVertical | sbHandleKeyboard);

    // Content view takes full client area (scrollbar is in frame, not client)
    contentView = new TWibWobTestViewA(client, vScrollBar);
    insert(contentView);
}

void TWibWobTestWindowA::changeBounds(const TRect& bounds) {
    TWindow::changeBounds(bounds);
    if (contentView) {
        contentView->updateScrollBar();
    }
    redraw();
}

TFrame* TWibWobTestWindowA::initFrame(TRect r) {
    return new TFrame(r);
}

TWindow* createWibWobTestWindowA(const TRect& bounds, const std::string& title) {
    return new TWibWobTestWindowA(bounds, title);
}

//=============================================================================
// OPTION B: TScroller-based implementation
//=============================================================================

TWibWobTestViewB::TWibWobTestViewB(const TRect& bounds, TScrollBar* hScroll, TScrollBar* vScroll)
    : TScroller(bounds, hScroll, vScroll)
{
    options |= ofSelectable;
    growMode = gfGrowHiX | gfGrowHiY;
    loadTestContent();
}

void TWibWobTestViewB::loadTestContent() {
    messages = getTestChatContent();
    rebuildWrappedLines();
}

std::vector<std::string> TWibWobTestViewB::wrapText(const std::string& text, int width) const {
    std::vector<std::string> lines;
    if (width <= 0) {
        lines.emplace_back("");
        return lines;
    }

    size_t lineStart = 0;
    const size_t length = text.size();

    while (lineStart <= length) {
        size_t newlinePos = text.find('\n', lineStart);
        std::string segment;
        if (newlinePos == std::string::npos) {
            segment = text.substr(lineStart);
        } else {
            segment = text.substr(lineStart, newlinePos - lineStart);
        }

        if (!segment.empty() && segment.back() == '\r') {
            segment.pop_back();
        }

        if (segment.empty()) {
            lines.emplace_back("");
        } else {
            size_t pos = 0;
            while (pos < segment.size()) {
                size_t slice = std::min(segment.size() - pos, static_cast<size_t>(width));
                lines.push_back(segment.substr(pos, slice));
                pos += slice;
            }
        }

        if (newlinePos == std::string::npos) break;
        lineStart = newlinePos + 1;
        if (lineStart == length) {
            lines.emplace_back("");
            break;
        }
    }

    if (lines.empty()) lines.emplace_back("");
    return lines;
}

void TWibWobTestViewB::rebuildWrappedLines() {
    wrappedLines.clear();
    maxLineWidth = 0;

    for (const auto& msg : messages) {
        std::string displayText = msg.sender.empty() ? msg.content : msg.sender + ": " + msg.content;
        auto wrapped = wrapText(displayText, size.x - 1);

        for (const auto& line : wrapped) {
            wrappedLines.push_back({line, msg.sender});
            maxLineWidth = std::max(maxLineWidth, static_cast<int>(line.size()));
        }
    }

    // KEY: Use TScroller's setLimit to update scrollbar automatically
    setLimit(maxLineWidth, static_cast<int>(wrappedLines.size()));
}

void TWibWobTestViewB::draw() {
    TDrawBuffer buf;
    TColorAttr normalColor = getColor(1);
    TColorAttr userColor = getColor(1);
    TColorAttr wibColor = getColor(1);

    for (int y = 0; y < size.y; y++) {
        int lineIdx = delta.y + y;  // KEY: Use TScroller's delta.y for scroll position

        buf.moveChar(0, ' ', normalColor, size.x);

        if (lineIdx >= 0 && lineIdx < static_cast<int>(wrappedLines.size())) {
            const auto& wl = wrappedLines[lineIdx];
            TColorAttr color = normalColor;
            if (wl.sender == "User") color = userColor;
            else if (wl.sender == "Wib" || wl.sender == "Wob") color = wibColor;

            buf.moveStr(0, wl.text.c_str(), color);
        }

        writeLine(0, y, size.x, 1, buf);
    }
}

void TWibWobTestViewB::scrollDraw() {
    TScroller::scrollDraw();
    // TScroller handles scroll position via delta, just redraw
}

void TWibWobTestViewB::handleEvent(TEvent& event) {
    TScroller::handleEvent(event);

    // Additional keyboard handling beyond TScroller defaults
    if (event.what == evKeyDown) {
        switch (event.keyDown.keyCode) {
            case kbHome:
                scrollTo(0, 0);
                clearEvent(event);
                break;
            case kbEnd:
                scrollTo(0, std::max(0, static_cast<int>(wrappedLines.size()) - size.y));
                clearEvent(event);
                break;
        }
    }
}

//-----------------------------------------------------------------------------
// TWibWobTestWindowB - Uses TScroller pattern (proper TV architecture)
//-----------------------------------------------------------------------------

TWibWobTestWindowB::TWibWobTestWindowB(const TRect& bounds, const std::string& title)
    : TWindow(bounds, title.c_str(), wnNoNumber)
    , TWindowInit(&TWibWobTestWindowB::initFrame)
{
    options |= ofTileable;
    growMode = gfGrowHiX | gfGrowHiY;

    TRect client = getExtent();
    client.grow(-1, -1);

    // Create scrollbar using standard method
    TScrollBar* vScroll = standardScrollBar(sbVertical | sbHandleKeyboard);
    // No horizontal scroll for chat

    // Pass scrollbar to TScroller-based view
    contentView = new TWibWobTestViewB(client, nullptr, vScroll);
    insert(contentView);
}

TFrame* TWibWobTestWindowB::initFrame(TRect r) {
    return new TFrame(r);
}

TWindow* createWibWobTestWindowB(const TRect& bounds, const std::string& title) {
    return new TWibWobTestWindowB(bounds, title);
}

//=============================================================================
// OPTION C: Split View Architecture Test
// Uses actual TWibWobMessageView + TWibWobInputView with prepopulated content
//=============================================================================

#include "wibwob_view.h"

TWindow* createWibWobTestWindowC(const TRect& bounds, const std::string& title) {
    // Create the actual production window
    TWibWobWindow* win = new TWibWobWindow(bounds, title);

    // Get the message view and prepopulate with test content
    TWibWobMessageView* msgView = win->getMessageView();

    auto testContent = getTestChatContent();
    for (const auto& msg : testContent) {
        msgView->addMessage(msg.sender, msg.content, false);
    }

    // Update status to indicate test mode
    TWibWobInputView* inputView = win->getInputView();
    inputView->setStatus("Test C: Split Architecture - Try scrolling!");

    return win;
}
