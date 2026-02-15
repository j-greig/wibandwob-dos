#define Uses_TEvent
#define Uses_TDrawBuffer
#include <tvision/tv.h>

#include "browser_window.h"

BrowserWindow::BrowserWindow(const TRect& bounds) : TView(bounds) {
    options |= ofSelectable;
}

void BrowserWindow::setUrl(const std::string& url) {
    currentUrl = url;
}

void BrowserWindow::setContent(const std::string& content) {
    renderedContent = content;
}

void BrowserWindow::draw() {
    TDrawBuffer b;
    const TAttrPair color = getColor(0x0301);
    for (int y = 0; y < size.y; ++y) {
        b.moveChar(0, ' ', color, size.x);
        writeLine(0, y, size.x, 1, b);
    }
}

void BrowserWindow::handleEvent(TEvent& ev) {
    TView::handleEvent(ev);
    if (ev.what == evKeyDown) {
        if (ev.keyDown.keyCode == kbDown)
            ++scrollY;
        else if (ev.keyDown.keyCode == kbUp && scrollY > 0)
            --scrollY;
    }
}
