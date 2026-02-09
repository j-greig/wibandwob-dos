/*---------------------------------------------------------*/
/*                                                         */
/*   transparent_text_view.cpp - Text View with           */
/*   Transparent/Custom Background Support                */
/*                                                         */
/*---------------------------------------------------------*/

#include "transparent_text_view.h"
#include <algorithm>

/*---------------------------------------------------------*/
/* TTransparentTextView Implementation                    */
/*---------------------------------------------------------*/

TTransparentTextView::TTransparentTextView(const TRect& bounds,
                                         const std::string& filePath)
    : TView(bounds),
      fileName(filePath),
      bgColor(0, 0, 0),           // Default black background
      fgColor(220, 220, 220),     // Default light grey foreground
      useCustomBg(false),         // Start with terminal default
      scrollY(0),
      scrollX(0)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable;

    loadFile(filePath);
}

void TTransparentTextView::loadFile(const std::string& path)
{
    std::ifstream file(path);
    if (!file.is_open()) {
        lines.push_back("Error: Could not open file");
        lines.push_back(path);
        return;
    }

    std::string line;
    while (std::getline(file, line)) {
        // Remove \r if present (Windows line endings)
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        lines.push_back(line);
    }

    if (lines.empty()) {
        lines.push_back(""); // Ensure at least one line exists
    }
}

size_t TTransparentTextView::utf8Length(const std::string& str) const
{
    size_t count = 0;
    for (size_t i = 0; i < str.size(); ) {
        unsigned char c = str[i];
        if (c < 0x80) {
            i += 1;
        } else if ((c & 0xE0) == 0xC0) {
            i += 2;
        } else if ((c & 0xF0) == 0xE0) {
            i += 3;
        } else if ((c & 0xF8) == 0xF0) {
            i += 4;
        } else {
            i += 1; // Invalid UTF-8, skip
        }
        count++;
    }
    return count;
}

void TTransparentTextView::draw()
{
    TDrawBuffer b;

    // Determine fill attribute/character.
    TColorAttr textAttr;
    char fillChar = ' ';

    if (useCustomBg) {
        // Custom background mode - opaque with RGB colors.
        textAttr = TColorAttr(fgColor, bgColor);
    } else {
        // Blend with the desktop background if available.
        if (TProgram::deskTop && TProgram::deskTop->background) {
            TBackground *bg = TProgram::deskTop->background;
            textAttr = bg->getColor(0x01);
            fillChar = bg->pattern;
        } else {
            TColorDesired defaultFg = {};
            TColorDesired defaultBg = {};
            textAttr = TColorAttr(defaultFg, defaultBg);
        }
    }

    for (int i = 0; i < size.y; i++)
    {
        int lineIndex = scrollY + i;

        if (lineIndex >= 0 && lineIndex < static_cast<int>(lines.size()))
        {
            const std::string& line = lines[lineIndex];

            // Seed buffer with the desktop background sample.
            b.moveChar(0, fillChar, textAttr, size.x);

            // Draw visible portion of text
            if (scrollX < static_cast<int>(utf8Length(line)))
            {
                // Calculate byte offset for scrollX character position
                int charPos = 0;
                size_t bytePos = 0;
                while (charPos < scrollX && bytePos < line.size()) {
                    unsigned char c = line[bytePos];
                    if (c < 0x80) {
                        bytePos += 1;
                    } else if ((c & 0xE0) == 0xC0) {
                        bytePos += 2;
                    } else if ((c & 0xF0) == 0xE0) {
                        bytePos += 3;
                    } else if ((c & 0xF8) == 0xF0) {
                        bytePos += 4;
                    } else {
                        bytePos += 1;
                    }
                    charPos++;
                }

                // Draw text starting from calculated position
                if (bytePos < line.size()) {
                    std::string visibleText = line.substr(bytePos);
                    b.moveStr(0, TStringView(visibleText.data(), visibleText.size()), textAttr);
                }
            }
        }
        else
        {
            // Empty line - keep background copy intact.
            b.moveChar(0, fillChar, textAttr, size.x);
        }

        writeLine(0, i, size.x, 1, b);
    }
}

void TTransparentTextView::handleEvent(TEvent& event)
{
    TView::handleEvent(event);

    // Simple keyboard scrolling
    if (event.what == evKeyDown)
    {
        int maxScrollY = std::max(0, static_cast<int>(lines.size()) - size.y);
        switch (event.keyDown.keyCode)
        {
            case kbUp:
                if (scrollY > 0) {
                    scrollY--;
                    drawView();
                }
                clearEvent(event);
                break;
            case kbDown:
                if (scrollY < maxScrollY) {
                    scrollY++;
                    drawView();
                }
                clearEvent(event);
                break;
            case kbPgUp:
                scrollY = std::max(0, scrollY - size.y);
                drawView();
                clearEvent(event);
                break;
            case kbPgDn:
                scrollY = std::min(maxScrollY, scrollY + size.y);
                drawView();
                clearEvent(event);
                break;
            case kbHome:
                scrollY = 0;
                drawView();
                clearEvent(event);
                break;
            case kbEnd:
                scrollY = maxScrollY;
                drawView();
                clearEvent(event);
                break;
        }
    }
}

void TTransparentTextView::setBackgroundColor(TColorRGB color)
{
    bgColor = color;
    useCustomBg = true;
    drawView();
}

void TTransparentTextView::setBackgroundToDefault()
{
    useCustomBg = false;
    drawView();
}

/*---------------------------------------------------------*/
/* TTransparentTextWindow Implementation                  */
/*---------------------------------------------------------*/

TTransparentTextWindow::TTransparentTextWindow(const TRect& bounds,
                                             const std::string& title,
                                             const std::string& filePath)
    : TWindow(bounds, title.c_str(), wnNoNumber),
      TWindowInit(&TTransparentTextWindow::initFrame)
{
    options |= ofTileable;

    // Calculate interior bounds for text view
    TRect interior = getExtent();
    interior.grow(-1, -1);

    // Create text view without scrollbars (keyboard scrolling only)
    textView = new TTransparentTextView(interior, filePath);
    insert(textView);
}

void TTransparentTextWindow::changeBounds(const TRect& bounds)
{
    TWindow::changeBounds(bounds);
    setState(sfExposed, True);

    if (textView) {
        textView->drawView();
    }

    redraw();
}

TFrame* TTransparentTextWindow::initFrame(TRect r)
{
    return new TFrame(r);
}
