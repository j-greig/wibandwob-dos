/*---------------------------------------------------------*/
/*                                                         */
/*   browser_view.cpp - TUI Browser Window Implementation  */
/*   Fetches URLs via Python API, renders markdown text    */
/*                                                         */
/*---------------------------------------------------------*/

#include "browser_view.h"

#define Uses_TKeys
#define Uses_TDrawBuffer
#define Uses_TColorAttr
#define Uses_MsgBox
#define Uses_TWindow
#define Uses_TFrame
#define Uses_TInputLine
#define Uses_TDialog
#define Uses_TButton
#define Uses_TLabel
#define Uses_TStaticText
#define Uses_TProgram
#define Uses_TDeskTop
#include <tvision/tv.h>

#include <cstdio>
#include <cstring>
#include <sstream>
#include <algorithm>
#include <fcntl.h>
#include <unistd.h>

/*---------------------------------------------------------*/
/*  TBrowserContentView Implementation                     */
/*---------------------------------------------------------*/

TBrowserContentView::TBrowserContentView(const TRect& bounds, TScrollBar* hScroll, TScrollBar* vScroll)
    : TScroller(bounds, hScroll, vScroll)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable;
}

void TBrowserContentView::draw() {
    TDrawBuffer buf;
    TColorAttr normalColor = getColor(1);

    int totalLines = static_cast<int>(wrappedLines.size());

    for (int y = 0; y < size.y; y++) {
        int lineIdx = delta.y + y;

        buf.moveChar(0, ' ', normalColor, size.x);

        if (lineIdx >= 0 && lineIdx < totalLines) {
            const auto& wl = wrappedLines[lineIdx];
            buf.moveStr(0, wl.text.c_str(), normalColor);
        }

        writeLine(0, y, size.x, 1, buf);
    }
}

void TBrowserContentView::changeBounds(const TRect& bounds) {
    TScroller::changeBounds(bounds);
    rebuildWrappedLines();
}

void TBrowserContentView::setContent(const std::vector<std::string>& newLines) {
    sourceLines = newLines;
    rebuildWrappedLines();
    scrollTo(0, 0);
    drawView();
}

void TBrowserContentView::clear() {
    sourceLines.clear();
    wrappedLines.clear();
    scrollTo(0, 0);
    setLimit(size.x, 0);
    drawView();
}

void TBrowserContentView::scrollToTop() {
    scrollTo(0, 0);
}

void TBrowserContentView::scrollLineUp() {
    int newY = std::max(0, delta.y - 1);
    scrollTo(delta.x, newY);
}

void TBrowserContentView::scrollLineDown() {
    int maxY = std::max(0, limit.y - size.y);
    int newY = std::min(maxY, delta.y + 1);
    scrollTo(delta.x, newY);
}

void TBrowserContentView::scrollPageUp() {
    int newY = std::max(0, delta.y - size.y);
    scrollTo(delta.x, newY);
}

void TBrowserContentView::scrollPageDown() {
    int maxY = std::max(0, limit.y - size.y);
    int newY = std::min(maxY, delta.y + size.y);
    scrollTo(delta.x, newY);
}

void TBrowserContentView::rebuildWrappedLines() {
    wrappedLines.clear();
    int width = size.x > 0 ? size.x : 80;

    for (const auto& line : sourceLines) {
        auto wrapped = wrapText(line, width);
        for (const auto& w : wrapped) {
            wrappedLines.push_back({w});
        }
    }

    setLimit(size.x, static_cast<int>(wrappedLines.size()));
    if (vScrollBar)
        vScrollBar->drawView();
}

std::vector<std::string> TBrowserContentView::wrapText(const std::string& text, int width) const {
    std::vector<std::string> lines;
    if (width <= 0) {
        lines.emplace_back("");
        return lines;
    }
    if (text.empty()) {
        lines.emplace_back("");
        return lines;
    }

    size_t lineStart = 0;
    while (lineStart < text.size()) {
        size_t remaining = text.size() - lineStart;
        if (static_cast<int>(remaining) <= width) {
            lines.push_back(text.substr(lineStart));
            break;
        }

        // Find last space within width
        size_t breakPos = lineStart + width;
        size_t spacePos = text.rfind(' ', breakPos);
        if (spacePos != std::string::npos && spacePos > lineStart) {
            lines.push_back(text.substr(lineStart, spacePos - lineStart));
            lineStart = spacePos + 1;
        } else {
            // No space found, hard break
            lines.push_back(text.substr(lineStart, width));
            lineStart += width;
        }
    }

    if (lines.empty()) {
        lines.emplace_back("");
    }
    return lines;
}

/*---------------------------------------------------------*/
/*  TBrowserWindow Implementation                          */
/*---------------------------------------------------------*/

TBrowserWindow::TBrowserWindow(const TRect& bounds)
    : TWindow(bounds, "Browser", wnNoNumber),
      TWindowInit(&TBrowserWindow::initFrame)
{
    options |= ofTileable;
    eventMask |= evBroadcast;

    // Create vertical scrollbar for content
    TRect sbRect = getExtent();
    sbRect.a.x = sbRect.b.x - 1;
    sbRect.a.y = 2;   // Below URL bar row
    sbRect.b.y -= 3;  // Above status + hints rows
    vScrollBar = new TScrollBar(sbRect);
    insert(vScrollBar);

    // Create content view (interior minus URL bar, status, hints, scrollbar)
    TRect contentRect = getExtent();
    contentRect.grow(-1, -1);  // Shrink by frame
    contentRect.a.y += 1;     // Below URL bar
    contentRect.b.y -= 2;     // Above status bar + key hints
    contentRect.b.x -= 1;     // Room for scrollbar
    contentView = new TBrowserContentView(contentRect, nullptr, vScrollBar);
    insert(contentView);
}

TBrowserWindow::~TBrowserWindow() {
    cancelFetch();
    stopPollTimer();
}

TFrame* TBrowserWindow::initFrame(TRect r) {
    return new TFrame(r);
}

void TBrowserWindow::changeBounds(const TRect& bounds) {
    TWindow::changeBounds(bounds);
    layoutChildren();
    drawView();
}

void TBrowserWindow::layoutChildren() {
    if (!contentView) return;

    TRect ext = getExtent();
    ext.grow(-1, -1);

    // Scrollbar: rightmost column
    if (vScrollBar) {
        TRect sbRect = getExtent();
        sbRect.a.x = sbRect.b.x - 2;  // Inside frame, rightmost
        sbRect.b.x = sbRect.b.x - 1;
        sbRect.a.y = 2;
        sbRect.b.y = ext.b.y - 1;  // Above status + hints
        vScrollBar->changeBounds(sbRect);
    }

    // Content view
    TRect contentRect = ext;
    contentRect.a.y += 1;    // Below URL bar
    contentRect.b.y -= 2;    // Above status + hints
    contentRect.b.x -= 1;    // Room for scrollbar
    contentView->changeBounds(contentRect);
}

void TBrowserWindow::handleEvent(TEvent& event) {
    TWindow::handleEvent(event);

    // Timer-driven poll for async fetch
    if (event.what == evBroadcast && event.message.command == cmTimerExpired) {
        if (pollTimerId != 0 && event.message.infoPtr == pollTimerId) {
            pollFetch();
            clearEvent(event);
            return;
        }
    }

    if (event.what == evKeyDown) {
        switch (event.keyDown.keyCode) {
            case kbUp:
                if (contentView) contentView->scrollLineUp();
                clearEvent(event);
                break;
            case kbDown:
                if (contentView) contentView->scrollLineDown();
                clearEvent(event);
                break;
            case kbPgUp:
                if (contentView) contentView->scrollPageUp();
                clearEvent(event);
                break;
            case kbPgDn:
                if (contentView) contentView->scrollPageDown();
                clearEvent(event);
                break;
            case kbHome:
                if (contentView) contentView->scrollToTop();
                clearEvent(event);
                break;
            default:
                // Check for character keys
                char ch = event.keyDown.charScan.charCode;
                switch (ch) {
                    case 'g':
                    case 'G':
                        promptForUrl();
                        clearEvent(event);
                        break;
                    case 'b':
                        navigateBack();
                        clearEvent(event);
                        break;
                    case 'f':
                        navigateForward();
                        clearEvent(event);
                        break;
                    case 'r':
                    case 'R':
                        if (!currentUrl.empty()) {
                            fetchUrl(currentUrl);
                        }
                        clearEvent(event);
                        break;
                }
                break;
        }
        drawView();
    }
}

void TBrowserWindow::draw() {
    TWindow::draw();
    drawUrlBar();
    drawStatusBar();
    drawKeyHints();
}

void TBrowserWindow::drawUrlBar() {
    TDrawBuffer buf;
    TColorAttr urlColor = getColor(1);
    TColorAttr labelColor = getColor(2);

    int w = size.x - 2;  // Interior width (minus frame)
    if (w <= 0) return;

    buf.moveChar(0, ' ', urlColor, w);

    // "URL: " prefix
    buf.moveStr(0, " URL: ", labelColor);

    // Show current URL or placeholder
    std::string display = currentUrl.empty() ? "(press g to navigate)" : currentUrl;
    if (static_cast<int>(display.size()) > w - 7) {
        display = display.substr(0, w - 10) + "...";
    }
    buf.moveStr(6, display.c_str(), urlColor);

    writeLine(1, 1, w, 1, buf);
}

void TBrowserWindow::drawStatusBar() {
    TDrawBuffer buf;
    TColorAttr statusColor = getColor(2);

    int w = size.x - 2;
    int y = size.y - 3;  // Two rows from bottom (inside frame)
    if (w <= 0 || y < 0) return;

    buf.moveChar(0, ' ', statusColor, w);

    std::string status;
    switch (fetchState) {
        case Idle:
            status = pageTitle.empty() ? "Ready" : pageTitle;
            break;
        case Fetching:
            status = "Fetching...";
            break;
        case Ready:
            status = pageTitle.empty() ? "Done" : pageTitle;
            break;
        case Error:
            status = "Error: " + errorMessage;
            break;
    }

    if (static_cast<int>(status.size()) > w - 1) {
        status = status.substr(0, w - 4) + "...";
    }
    buf.moveStr(1, status.c_str(), statusColor);

    writeLine(1, y, w, 1, buf);
}

void TBrowserWindow::drawKeyHints() {
    TDrawBuffer buf;
    TColorAttr hintColor = getColor(2);

    int w = size.x - 2;
    int y = size.y - 2;  // Bottom row inside frame
    if (w <= 0 || y < 0) return;

    buf.moveChar(0, ' ', hintColor, w);
    buf.moveStr(1, "g:Go  b:Back  f:Fwd  r:Refresh  PgUp/PgDn:Scroll  Esc:Close", hintColor);

    writeLine(1, y, w, 1, buf);
}

void TBrowserWindow::promptForUrl() {
    // Simple input dialog for URL
    TRect dlgRect(0, 0, 60, 8);
    dlgRect.move((TProgram::deskTop->size.x - 60) / 2, (TProgram::deskTop->size.y - 8) / 2);

    TDialog* dlg = new TDialog(dlgRect, "Navigate to URL");

    TRect inputRect(3, 2, 57, 3);
    TInputLine* input = new TInputLine(inputRect, 1024);
    dlg->insert(input);
    dlg->insert(new TLabel(TRect(2, 1, 57, 2), "Enter URL:", input));

    TRect okRect(15, 5, 25, 7);
    TRect cancelRect(35, 5, 45, 7);
    dlg->insert(new TButton(okRect, "~O~K", cmOK, bfDefault));
    dlg->insert(new TButton(cancelRect, "Cancel", cmCancel, bfNormal));

    // Pre-fill with current URL if any
    if (!currentUrl.empty()) {
        input->setData(const_cast<char*>(currentUrl.c_str()));
    }

    ushort result = TProgram::deskTop->execView(dlg);
    if (result == cmOK) {
        char urlBuf[1024];
        input->getData(urlBuf);
        std::string url(urlBuf);
        // Trim trailing whitespace/nulls
        while (!url.empty() && (url.back() == ' ' || url.back() == '\0'))
            url.pop_back();
        if (!url.empty()) {
            // Add https:// if no scheme
            if (url.find("://") == std::string::npos) {
                url = "https://" + url;
            }
            fetchUrl(url);
        }
    }
    destroy(dlg);
}

void TBrowserWindow::fetchUrl(const std::string& url) {
    cancelFetch();
    pushHistory(url);
    currentUrl = url;
    fetchState = Fetching;
    pageTitle.clear();
    errorMessage.clear();
    startFetch(url);
    drawView();
}

void TBrowserWindow::startFetch(const std::string& url) {
    // Build curl command to call Python API server
    // Escape the URL for shell safety (basic escaping of single quotes)
    std::string escapedUrl = url;
    std::string::size_type pos = 0;
    while ((pos = escapedUrl.find('\'', pos)) != std::string::npos) {
        escapedUrl.replace(pos, 1, "'\\''");
        pos += 4;
    }

    std::string cmd = "curl -s -X POST http://127.0.0.1:8089/browser/fetch "
                      "-H 'Content-Type: application/json' "
                      "-d '{\"url\":\"" + escapedUrl + "\"}' 2>/dev/null";

    fetchPipe = popen(cmd.c_str(), "r");
    if (!fetchPipe) {
        fetchState = Error;
        errorMessage = "Failed to start fetch";
        drawView();
        return;
    }

    // Set non-blocking
    int fd = fileno(fetchPipe);
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);

    fetchBuffer.clear();
    startPollTimer();
}

void TBrowserWindow::pollFetch() {
    if (!fetchPipe) return;

    char buf[4096];
    while (true) {
        ssize_t n = ::read(fileno(fetchPipe), buf, sizeof(buf) - 1);
        if (n > 0) {
            buf[n] = '\0';
            fetchBuffer.append(buf, n);
        } else if (n == 0) {
            // EOF
            finishFetch();
            return;
        } else {
            // EAGAIN or error
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                return;  // No data yet, try again on next timer
            }
            // Real error
            finishFetch();
            return;
        }
    }
}

void TBrowserWindow::finishFetch() {
    stopPollTimer();
    if (fetchPipe) {
        int status = pclose(fetchPipe);
        fetchPipe = nullptr;

        if (status != 0 || fetchBuffer.empty()) {
            fetchState = Error;
            errorMessage = "Fetch failed (API server running?)";
            drawView();
            return;
        }
    }

    // Parse JSON response — extract markdown and title
    std::string markdown = extractJsonStringField(fetchBuffer, "tui_text");
    if (markdown.empty()) {
        markdown = extractJsonStringField(fetchBuffer, "markdown");
    }
    pageTitle = extractJsonStringField(fetchBuffer, "title");

    if (markdown.empty() && pageTitle.empty()) {
        // Check for error in response
        std::string detail = extractJsonStringField(fetchBuffer, "detail");
        if (!detail.empty()) {
            fetchState = Error;
            errorMessage = detail;
        } else {
            fetchState = Error;
            errorMessage = "Empty response from API";
        }
        drawView();
        return;
    }

    // Split markdown into lines
    std::vector<std::string> lines;
    std::istringstream stream(markdown);
    std::string line;
    while (std::getline(stream, line)) {
        // Strip \r
        if (!line.empty() && line.back() == '\r') line.pop_back();
        lines.push_back(line);
    }

    if (contentView) {
        contentView->setContent(lines);
    }

    fetchState = Ready;

    // Update window title
    if (!pageTitle.empty()) {
        std::string winTitle = "Browser - " + pageTitle;
        if (winTitle.size() > 60) winTitle = winTitle.substr(0, 57) + "...";
        delete[] title;
        title = newStr(winTitle.c_str());
        frame->drawView();
    }

    drawView();
}

void TBrowserWindow::cancelFetch() {
    stopPollTimer();
    if (fetchPipe) {
        pclose(fetchPipe);
        fetchPipe = nullptr;
    }
    fetchBuffer.clear();
}

void TBrowserWindow::startPollTimer() {
    if (pollTimerId == 0)
        pollTimerId = setTimer(100, 100);
}

void TBrowserWindow::stopPollTimer() {
    if (pollTimerId != 0) {
        killTimer(pollTimerId);
        pollTimerId = 0;
    }
}

void TBrowserWindow::pushHistory(const std::string& url) {
    // If we navigated back and are now going to a new URL, truncate forward history
    if (historyIndex >= 0 && historyIndex < static_cast<int>(urlHistory.size()) - 1) {
        urlHistory.resize(historyIndex + 1);
    }
    urlHistory.push_back(url);
    historyIndex = static_cast<int>(urlHistory.size()) - 1;
}

void TBrowserWindow::navigateBack() {
    if (historyIndex <= 0) return;
    historyIndex--;
    currentUrl = urlHistory[historyIndex];
    fetchState = Fetching;
    pageTitle.clear();
    errorMessage.clear();
    startFetch(currentUrl);
    drawView();
}

void TBrowserWindow::navigateForward() {
    if (historyIndex >= static_cast<int>(urlHistory.size()) - 1) return;
    historyIndex++;
    currentUrl = urlHistory[historyIndex];
    fetchState = Fetching;
    pageTitle.clear();
    errorMessage.clear();
    startFetch(currentUrl);
    drawView();
}

// Encode a Unicode codepoint as UTF-8 bytes
static void appendUtf8(std::string& out, uint32_t cp) {
    if (cp < 0x80) {
        out.push_back(static_cast<char>(cp));
    } else if (cp < 0x800) {
        out.push_back(static_cast<char>(0xC0 | (cp >> 6)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else if (cp < 0x10000) {
        out.push_back(static_cast<char>(0xE0 | (cp >> 12)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else if (cp < 0x110000) {
        out.push_back(static_cast<char>(0xF0 | (cp >> 18)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 12) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    }
}

// Parse a 4-digit hex value from a string at position pos
static uint16_t parseHex4(const std::string& s, size_t pos) {
    uint16_t val = 0;
    for (int j = 0; j < 4 && pos + j < s.size(); ++j) {
        char h = s[pos + j];
        val <<= 4;
        if (h >= '0' && h <= '9') val |= (h - '0');
        else if (h >= 'a' && h <= 'f') val |= (h - 'a' + 10);
        else if (h >= 'A' && h <= 'F') val |= (h - 'A' + 10);
    }
    return val;
}

// Reuse the extractJsonStringField pattern from claude_code_sdk_provider.cpp
// Extended with \uXXXX Unicode escape handling for proper UTF-8 output
std::string TBrowserWindow::extractJsonStringField(const std::string& json, const std::string& key) {
    const std::string pattern = "\"" + key + "\":\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos)
        return "";
    pos += pattern.size();
    std::string out;
    bool escape = false;
    for (size_t i = pos; i < json.size(); ++i) {
        char c = json[i];
        if (escape) {
            switch (c) {
                case '\\': out.push_back('\\'); break;
                case '"':  out.push_back('"'); break;
                case '/':  out.push_back('/'); break;
                case 'n':  out.push_back('\n'); break;
                case 'r':  out.push_back('\r'); break;
                case 't':  out.push_back('\t'); break;
                case 'u': {
                    // \uXXXX Unicode escape
                    if (i + 4 < json.size()) {
                        uint16_t hi = parseHex4(json, i + 1);
                        i += 4;
                        // Check for surrogate pair: \uD800-\uDBFF followed by \uDC00-\uDFFF
                        if (hi >= 0xD800 && hi <= 0xDBFF && i + 2 < json.size()
                            && json[i + 1] == '\\' && json[i + 2] == 'u' && i + 6 < json.size()) {
                            uint16_t lo = parseHex4(json, i + 3);
                            if (lo >= 0xDC00 && lo <= 0xDFFF) {
                                uint32_t cp = 0x10000 + ((uint32_t)(hi - 0xD800) << 10) + (lo - 0xDC00);
                                appendUtf8(out, cp);
                                i += 6;  // Skip \uXXXX of low surrogate
                            } else {
                                appendUtf8(out, hi);
                            }
                        } else {
                            appendUtf8(out, hi);
                        }
                    }
                    break;
                }
                default:   out.push_back(c); break;
            }
            escape = false;
            continue;
        }
        if (c == '\\') {
            escape = true;
            continue;
        }
        if (c == '"') {
            break;
        }
        out.push_back(c);
    }
    return out;
}

// Factory function
TWindow* createBrowserWindow(const TRect& bounds) {
    return new TBrowserWindow(bounds);
}
