/*---------------------------------------------------------*/
/*                                                         */
/*   text_editor_view.cpp - API-Controllable Text Editor  */
/*                                                         */
/*   Multi-line text editor that can receive content      */
/*   via API calls for dynamic text/ASCII art display     */
/*                                                         */
/*---------------------------------------------------------*/

#include "text_editor_view.h"

#define Uses_TWindow
#define Uses_TFrame
#define Uses_TColorAttr
#define Uses_TDrawBuffer
#define Uses_TKeys
#include <tvision/tv.h>

#include <cstring>
#include <algorithm>
#include <sstream>

TTextEditorView::TTextEditorView(const TRect &bounds)
    : TView(bounds), 
      cursorLine(0), 
      cursorCol(0),
      scrollTop(0), 
      scrollLeft(0),
      readOnly(false),
      showCursor(true),
      hScrollBar(nullptr),
      vScrollBar(nullptr)
{
    options |= ofSelectable;
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evBroadcast | evKeyboard;
    
    // Initialize with empty content
    lines.push_back("");
    
    // Set up colors
    normalColor = TColorAttr(TColorRGB(220, 220, 220), TColorRGB(0, 0, 0));
    selectedColor = TColorAttr(TColorRGB(255, 255, 255), TColorRGB(0, 100, 200));
}

TTextEditorView::~TTextEditorView() {
    // Cleanup handled by parent
}

void TTextEditorView::draw() {
    int W = size.x, H = size.y;
    if (W <= 0 || H <= 0) return;

    // Calculate visible range
    size_t endLine = std::min(scrollTop + H, lines.size());
    
    for (int y = 0; y < H; ++y) {
        size_t lineIndex = scrollTop + y;
        TDrawBuffer b;
        
        if (lineIndex < lines.size()) {
            const std::string& line = lines[lineIndex];
            
            // Calculate visible portion of line
            size_t startCol = std::min(scrollLeft, line.length());
            size_t endCol = std::min(scrollLeft + W, line.length());
            
            std::string visibleText = line.substr(startCol, endCol - startCol);
            
            // Draw the text
            int col = 0;
            if (!visibleText.empty()) {
                ushort w = b.moveCStr(col, visibleText.c_str(), 
                    TAttrPair{normalColor, normalColor}, W - col);
                col += (w > 0 ? w : 0);
            }
            
            // Fill remainder with spaces
            if (col < W) {
                b.moveChar(col, ' ', normalColor, (ushort)(W - col));
            }
        } else {
            // Empty line
            b.moveChar(0, ' ', normalColor, (ushort)W);
        }
        
        writeLine(0, y, W, 1, b);
    }
    
    // Show cursor if focused and in visible area
    if (showCursor && (state & sfFocused)) {
        if (cursorLine >= scrollTop && cursorLine < scrollTop + H) {
            int cursorX = (int)(cursorCol - scrollLeft);
            int cursorY = (int)(cursorLine - scrollTop);
            
            if (cursorX >= 0 && cursorX < W && cursorY >= 0 && cursorY < H) {
                setCursor(cursorX, cursorY);
                showCursor = true;
            }
        }
    }
}

void TTextEditorView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);
    
    if (readOnly) return;
    
    if (ev.what == evKeyDown) {
        bool handled = true;
        
        switch (ev.keyDown.keyCode) {
            case kbUp:
                if (cursorLine > 0) {
                    cursorLine--;
                    cursorCol = std::min(cursorCol, lines[cursorLine].length());
                    scrollToCursor();
                }
                break;
                
            case kbDown:
                if (cursorLine < lines.size() - 1) {
                    cursorLine++;
                    cursorCol = std::min(cursorCol, lines[cursorLine].length());
                    scrollToCursor();
                }
                break;
                
            case kbLeft:
                if (cursorCol > 0) {
                    cursorCol--;
                } else if (cursorLine > 0) {
                    cursorLine--;
                    cursorCol = lines[cursorLine].length();
                }
                scrollToCursor();
                break;
                
            case kbRight:
                if (cursorCol < lines[cursorLine].length()) {
                    cursorCol++;
                } else if (cursorLine < lines.size() - 1) {
                    cursorLine++;
                    cursorCol = 0;
                }
                scrollToCursor();
                break;
                
            case kbHome:
                cursorCol = 0;
                scrollToCursor();
                break;
                
            case kbEnd:
                cursorCol = lines[cursorLine].length();
                scrollToCursor();
                break;
                
            case kbPgUp:
                if (scrollTop > 0) {
                    scrollTop = (scrollTop > size.y) ? scrollTop - size.y : 0;
                    cursorLine = scrollTop;
                    cursorCol = std::min(cursorCol, lines[cursorLine].length());
                }
                break;
                
            case kbPgDn:
                scrollTop = std::min(scrollTop + size.y, 
                                   (lines.size() > size.y) ? lines.size() - size.y : 0);
                cursorLine = scrollTop;
                cursorCol = std::min(cursorCol, lines[cursorLine].length());
                break;
                
            case kbEnter:
                // Split line at cursor
                if (cursorLine < lines.size()) {
                    std::string currentLine = lines[cursorLine];
                    std::string leftPart = currentLine.substr(0, cursorCol);
                    std::string rightPart = currentLine.substr(cursorCol);
                    
                    lines[cursorLine] = leftPart;
                    lines.insert(lines.begin() + cursorLine + 1, rightPart);
                    cursorLine++;
                    cursorCol = 0;
                    scrollToCursor();
                }
                break;
                
            case kbBack:
                if (cursorCol > 0) {
                    lines[cursorLine].erase(cursorCol - 1, 1);
                    cursorCol--;
                } else if (cursorLine > 0) {
                    // Join with previous line
                    cursorCol = lines[cursorLine - 1].length();
                    lines[cursorLine - 1] += lines[cursorLine];
                    lines.erase(lines.begin() + cursorLine);
                    cursorLine--;
                }
                scrollToCursor();
                break;
                
            case kbDel:
                if (cursorCol < lines[cursorLine].length()) {
                    lines[cursorLine].erase(cursorCol, 1);
                } else if (cursorLine < lines.size() - 1) {
                    // Join with next line
                    lines[cursorLine] += lines[cursorLine + 1];
                    lines.erase(lines.begin() + cursorLine + 1);
                }
                break;
                
            default:
                // Handle regular character input
                if (ev.keyDown.charScan.charCode >= 32 && 
                    ev.keyDown.charScan.charCode < 127) {
                    char ch = ev.keyDown.charScan.charCode;
                    lines[cursorLine].insert(cursorCol, 1, ch);
                    cursorCol++;
                    scrollToCursor();
                } else {
                    handled = false;
                }
                break;
        }
        
        if (handled) {
            drawView();
            clearEvent(ev);
        }
    }
}

void TTextEditorView::sendText(const std::string& content, const std::string& mode, const std::string& position) {
    if (mode == "replace") {
        replaceContent(content);
    } else if (mode == "append") {
        appendText(content);
    } else if (mode == "insert") {
        if (position == "cursor") {
            insertText(content, cursorLine, cursorCol);
        } else if (position == "start") {
            insertText(content, 0, 0);
        } else { // "end"
            appendText(content);
        }
    }
    
    scrollToCursor();
    drawView();
}

void TTextEditorView::clearContent() {
    lines.clear();
    lines.push_back("");
    cursorLine = 0;
    cursorCol = 0;
    scrollTop = 0;
    scrollLeft = 0;
    drawView();
}

void TTextEditorView::insertText(const std::string& content, size_t lineIndex, size_t colIndex) {
    // Split content into lines
    std::istringstream iss(content);
    std::string line;
    std::vector<std::string> newLines;
    
    while (std::getline(iss, line)) {
        newLines.push_back(line);
    }
    
    if (newLines.empty()) return;
    
    // Ensure we have valid line index
    lineIndex = std::min(lineIndex, lines.size() - 1);
    colIndex = std::min(colIndex, lines[lineIndex].length());
    
    if (newLines.size() == 1) {
        // Single line insertion
        lines[lineIndex].insert(colIndex, newLines[0]);
        cursorLine = lineIndex;
        cursorCol = colIndex + newLines[0].length();
    } else {
        // Multi-line insertion
        std::string currentLine = lines[lineIndex];
        std::string leftPart = currentLine.substr(0, colIndex);
        std::string rightPart = currentLine.substr(colIndex);
        
        // Replace current line with first new line
        lines[lineIndex] = leftPart + newLines[0];
        
        // Insert middle lines
        for (size_t i = 1; i < newLines.size() - 1; ++i) {
            lines.insert(lines.begin() + lineIndex + i, newLines[i]);
        }
        
        // Insert last line with right part
        lines.insert(lines.begin() + lineIndex + newLines.size() - 1, 
                    newLines.back() + rightPart);
        
        cursorLine = lineIndex + newLines.size() - 1;
        cursorCol = newLines.back().length();
    }
}

void TTextEditorView::appendText(const std::string& content) {
    if (lines.empty()) {
        lines.push_back("");
    }
    
    // Move to end
    cursorLine = lines.size() - 1;
    cursorCol = lines[cursorLine].length();
    
    insertText(content, cursorLine, cursorCol);
}

void TTextEditorView::replaceContent(const std::string& content) {
    lines.clear();
    
    // Split content into lines
    std::istringstream iss(content);
    std::string line;
    
    while (std::getline(iss, line)) {
        lines.push_back(line);
    }
    
    if (lines.empty()) {
        lines.push_back("");
    }
    
    cursorLine = 0;
    cursorCol = 0;
    scrollTop = 0;
    scrollLeft = 0;
}

void TTextEditorView::scrollToCursor() {
    // Vertical scrolling
    if (cursorLine < scrollTop) {
        scrollTop = cursorLine;
    } else if (cursorLine >= scrollTop + size.y) {
        scrollTop = cursorLine - size.y + 1;
    }
    
    // Horizontal scrolling
    if (cursorCol < scrollLeft) {
        scrollLeft = cursorCol;
    } else if (cursorCol >= scrollLeft + size.x) {
        scrollLeft = cursorCol - size.x + 1;
    }
}

void TTextEditorView::scrollToEnd() {
    if (lines.size() > size.y) {
        scrollTop = lines.size() - size.y;
    } else {
        scrollTop = 0;
    }
    
    cursorLine = lines.size() - 1;
    cursorCol = lines[cursorLine].length();
    scrollToCursor();
}

void TTextEditorView::setState(ushort s, Boolean en) {
    TView::setState(s, en);
    if ((s & sfFocused) != 0) {
        drawView();
    }
}

void TTextEditorView::changeBounds(const TRect& b) {
    TView::changeBounds(b);
    drawView();
}

std::string TTextEditorView::runFiglet(const std::string& text, const std::string& font, int width) {
    // Escape text for shell safety
    std::string escapedText = text;
    // Basic shell escaping - replace quotes with escaped quotes
    size_t pos = 0;
    while ((pos = escapedText.find("\"", pos)) != std::string::npos) {
        escapedText.replace(pos, 1, "\\\"");
        pos += 2;
    }
    
    // Build command
    std::string fontDir = "/usr/local/Cellar/figlet/2.2.5/share/figlet/fonts";
    std::string cmd = "figlet -d \"" + fontDir + "\" -f \"" + font + "\"";
    
    if (width > 0) {
        cmd += " -w " + std::to_string(width);
    }
    
    cmd += " \"" + escapedText + "\" 2>/dev/null";
    
    // Execute and capture output
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) return {};
    
    std::string output;
    char buffer[4096];
    while (fgets(buffer, sizeof(buffer), pipe)) {
        output += buffer;
    }
    pclose(pipe);
    
    return output;
}

void TTextEditorView::sendFigletText(const std::string& text, const std::string& font, int width, const std::string& mode) {
    // Use current view width if not specified
    int figletWidth = (width > 0) ? width : size.x - 2;
    
    // Generate figlet ASCII art
    std::string figletOutput = runFiglet(text, font, figletWidth);
    
    if (!figletOutput.empty()) {
        sendText(figletOutput, mode, "end");
    } else {
        // Fallback to plain text if figlet fails
        sendText("[ " + text + " ]\n", mode, "end");
    }
}

// Window wrapper implementation
TTextEditorWindow::TTextEditorWindow(const TRect &r) 
    : TWindow(r, "Text Editor", wnNoNumber), 
      TWindowInit(&TTextEditorWindow::initFrame),
      editorView(nullptr)
{
}

void TTextEditorWindow::setup() {
    options |= ofTileable;
    TRect c = getExtent();
    c.grow(-1, -1);
    editorView = new TTextEditorView(c);
    insert(editorView);
}

void TTextEditorWindow::changeBounds(const TRect& b) {
    TWindow::changeBounds(b);
    setState(sfExposed, True);
    redraw();
}

TFrame* TTextEditorWindow::initFrame(TRect r) {
    return new TFrame(r);
}

TWindow* createTextEditorWindow(const TRect &bounds) {
    auto *w = new TTextEditorWindow(bounds);
    w->setup();
    return w;
}