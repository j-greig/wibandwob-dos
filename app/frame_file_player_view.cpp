/*---------------------------------------------------------*/
/*                                                         */
/*   frame_file_player_view.cpp - ASCII frame player      */
/*   Reads file, splits by '----' lines, timer-advances   */
/*                                                         */
/*---------------------------------------------------------*/

#include "frame_file_player_view.h"
#include "gradient.h"

#define Uses_TKeys
#define Uses_TDialog
#define Uses_TProgram
#define Uses_TDeskTop
#define Uses_TApplication
#define Uses_TRadioButtons
#define Uses_TSItem
#define Uses_TStaticText
#define Uses_TButton
#include <tvision/tv.h>

#include <fstream>
#include <sstream>
#include <algorithm>

// ANSI-like spectrum backgrounds (same order as common 16-color palettes)
static const TColorRGB kAnsiBg[16] = {
    TColorRGB(0x00,0x00,0x00), // Black
    TColorRGB(0x00,0x00,0x80), // Blue
    TColorRGB(0x00,0x80,0x00), // Green
    TColorRGB(0x00,0x80,0x80), // Cyan
    TColorRGB(0x80,0x00,0x00), // Red
    TColorRGB(0x80,0x00,0x80), // Magenta
    TColorRGB(0x80,0x80,0x00), // Brown/Olive
    TColorRGB(0xC0,0xC0,0xC0), // Light gray
    TColorRGB(0x80,0x80,0x80), // Dark gray
    TColorRGB(0x00,0x00,0xFF), // Light blue
    TColorRGB(0x00,0xFF,0x00), // Light green
    TColorRGB(0x00,0xFF,0xFF), // Light cyan
    TColorRGB(0xFF,0x00,0x00), // Light red
    TColorRGB(0xFF,0x00,0xFF), // Light magenta
    TColorRGB(0xFF,0xFF,0x00), // Yellow
    TColorRGB(0xFF,0xFF,0xFF), // White
};

// Gradient rendering utilities extracted from gradient.cpp
namespace {
    // Linear interpolation between two colors
    TColorRGB interpolateColors(TColorRGB start, TColorRGB end, float t) {
        t = std::max(0.0f, std::min(1.0f, t));
        uint8_t r = static_cast<uint8_t>(start.r + (end.r - start.r) * t);
        uint8_t g = static_cast<uint8_t>(start.g + (end.g - start.g) * t);
        uint8_t b = static_cast<uint8_t>(start.b + (end.b - start.b) * t);
        return TColorRGB(r, g, b);
    }
    
    // Get gradient color for horizontal gradient
    TColorRGB getHorizontalGradientColor(int x, int width, TColorRGB start, TColorRGB end) {
        if (width <= 1) return start;
        float t = static_cast<float>(x) / (width - 1);
        return interpolateColors(start, end, t);
    }
    
    // Get gradient color for vertical gradient
    TColorRGB getVerticalGradientColor(int y, int height, TColorRGB start, TColorRGB end) {
        if (height <= 1) return start;
        float t = static_cast<float>(y) / (height - 1);
        return interpolateColors(start, end, t);
    }
    
    // Get gradient color for radial gradient
    TColorRGB getRadialGradientColor(int x, int y, int width, int height, TColorRGB start, TColorRGB end) {
        float centerX = width * 0.5f;
        float centerY = height * 0.5f;
        float maxDist = std::sqrt(centerX * centerX + centerY * centerY);
        float dist = std::sqrt((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY));
        float t = maxDist > 0 ? dist / maxDist : 0;
        return interpolateColors(start, end, t);
    }
    
    // Get gradient color for diagonal gradient
    TColorRGB getDiagonalGradientColor(int x, int y, int width, int height, TColorRGB start, TColorRGB end) {
        float t = (static_cast<float>(x) / width + static_cast<float>(y) / height) * 0.5f;
        return interpolateColors(start, end, t);
    }
    
    // Get background color based on configuration and position
    TColorAttr getBackgroundAttr(const TBackgroundConfig& config, int x, int y, int width, int height) {
        switch (config.type) {
            case TBackgroundType::Transparent:
                return TColorAttr(0x07); // Default system attribute - transparent background
                
            case TBackgroundType::Solid: {
                const TColorRGB &bg = kAnsiBg[config.solidColorIndex];
                int bright = (int)bg.r * 299 + (int)bg.g * 587 + (int)bg.b * 114;
                TColorRGB fg = bright > 128000 ? TColorRGB(0x20,0x20,0x20) : TColorRGB(0xFF,0xFF,0xFF);
                return TColorAttr(fg, bg);
            }
                
            case TBackgroundType::HorizontalGradient: {
                TColorRGB bg = getHorizontalGradientColor(x, width, config.gradientStart, config.gradientEnd);
                int bright = (int)bg.r * 299 + (int)bg.g * 587 + (int)bg.b * 114;
                TColorRGB fg = bright > 128000 ? TColorRGB(0x20,0x20,0x20) : TColorRGB(0xFF,0xFF,0xFF);
                return TColorAttr(fg, bg);
            }
                
            case TBackgroundType::VerticalGradient: {
                TColorRGB bg = getVerticalGradientColor(y, height, config.gradientStart, config.gradientEnd);
                int bright = (int)bg.r * 299 + (int)bg.g * 587 + (int)bg.b * 114;
                TColorRGB fg = bright > 128000 ? TColorRGB(0x20,0x20,0x20) : TColorRGB(0xFF,0xFF,0xFF);
                return TColorAttr(fg, bg);
            }
                
            case TBackgroundType::RadialGradient: {
                TColorRGB bg = getRadialGradientColor(x, y, width, height, config.gradientStart, config.gradientEnd);
                int bright = (int)bg.r * 299 + (int)bg.g * 587 + (int)bg.b * 114;
                TColorRGB fg = bright > 128000 ? TColorRGB(0x20,0x20,0x20) : TColorRGB(0xFF,0xFF,0xFF);
                return TColorAttr(fg, bg);
            }
                
            case TBackgroundType::DiagonalGradient: {
                TColorRGB bg = getDiagonalGradientColor(x, y, width, height, config.gradientStart, config.gradientEnd);
                int bright = (int)bg.r * 299 + (int)bg.g * 587 + (int)bg.b * 114;
                TColorRGB fg = bright > 128000 ? TColorRGB(0x20,0x20,0x20) : TColorRGB(0xFF,0xFF,0xFF);
                return TColorAttr(fg, bg);
            }
                
            default:
                return TColorAttr(0x07); // Fallback
        }
    }
}

FrameFilePlayerView::FrameFilePlayerView(const TRect &bounds, const std::string &path, unsigned periodMs)
    : TView(bounds), periodMs(periodMs) {
    growMode = gfGrowHiX | gfGrowHiY;
    // Receive timer expirations via broadcast events (cmTimerExpired).
    // See TProgram::idle() and TTimerQueue in the library.
    eventMask |= evBroadcast;
    loadAndIndex(path);
}

FrameFilePlayerView::~FrameFilePlayerView() {
    stopTimer();
}

void FrameFilePlayerView::startTimer() {
    if (timerId == 0)
        // Periodic, UI-thread timer. First timeout == period.
        timerId = setTimer(periodMs, (int)periodMs);
}

void FrameFilePlayerView::stopTimer() {
    if (timerId != 0) {
        killTimer(timerId);
        timerId = 0;
    }
}

void FrameFilePlayerView::advanceFrame() {
    if (!frames.empty())
        frameIndex = (frameIndex + 1) % frames.size();
}

size_t FrameFilePlayerView::nextLineStart(const std::string &s, size_t pos) {
    // Advance to index after '\n' (or EOF)
    size_t n = s.size();
    while (pos < n) {
        char c = s[pos++];
        if (c == '\n') break;
    }
    return pos;
}

size_t FrameFilePlayerView::findLineEnd(const std::string &s, size_t pos, size_t limit) {
    // Return index of '\n' or limit (exclusive). Does not skip '\n'.
    size_t i = pos;
    limit = std::min(limit, s.size());
    while (i < limit && s[i] != '\n') ++i;
    return i; // points at '\n' or limit
}

void FrameFilePlayerView::loadAndIndex(const std::string &path) {
    // Read whole file
    std::ifstream in(path, std::ios::in | std::ios::binary);
    if (!in) {
        loadOk = false;
        errorMsg = "Failed to open file: " + path;
        return;
    }
    std::ostringstream oss;
    oss << in.rdbuf();
    fileData = oss.str();

    frames.clear();
    size_t n = fileData.size();
    size_t pos = 0;

    // Optional header FPS=... on first line.
    // If present, use it to refine the period unless the caller already
    // provided a ctor 'periodMs' override (the caller controls precedence).
    if (pos < n) {
        size_t lineEnd = findLineEnd(fileData, pos, n);
        size_t pureEnd = lineEnd;
        if (pureEnd > pos && fileData[pureEnd - 1] == '\r') --pureEnd;
        if (pureEnd - pos >= 4 && fileData.compare(pos, 4, "FPS=") == 0) {
            // Parse simple integer value
            int fps = 0;
            try {
                fps = std::stoi(fileData.substr(pos + 4, pureEnd - (pos + 4)));
            } catch (...) {
                fps = 0;
            }
            if (fps > 0) {
                unsigned p = (unsigned)(1000 / fps);
                if (p == 0) p = 1;
                periodMs = p;
            }
            pos = nextLineStart(fileData, pos);
        }
    }

    // Build frames using delimiter lines exactly equal to "----" (allow CR before LF)
    const std::string delim = "----";
    const size_t npos = std::string::npos;
    size_t curStart = npos;

    while (pos < n) {
        size_t lineStart = pos;
        size_t lineEnd = findLineEnd(fileData, pos, n);    // index of '\n' or n
        size_t pureEnd = lineEnd;
        if (pureEnd > lineStart && fileData[pureEnd - 1] == '\r') --pureEnd;

        bool isDelim = (pureEnd - lineStart == delim.size() &&
                        fileData.compare(lineStart, delim.size(), delim) == 0);

        if (isDelim) {
            if (curStart == npos) {
                // Frame begins after this delimiter
                curStart = nextLineStart(fileData, lineStart);
            } else {
                // Close previous frame before this delimiter line
                frames.push_back(Span{curStart, lineStart});
                curStart = nextLineStart(fileData, lineStart);
            }
        }

        pos = nextLineStart(fileData, pos);
    }

    if (curStart != npos) {
        // If there is trailing content after last delimiter, include it.
        if (curStart <= n)
            frames.push_back(Span{curStart, n});
    } else {
        // No delimiter present: whole file is one frame (may be empty)
        frames.push_back(Span{0, n});
    }

    // Ensure at least one frame to render
    if (frames.empty())
        frames.push_back(Span{0, 0});

    frameIndex = 0;
    loadOk = true;
}

void FrameFilePlayerView::draw() {
    TDrawBuffer buf;
    const int W = size.x, H = size.y;
    
    // Fallback: fill with spaces if nothing to show (background-aware)
    auto fillRow = [&](int y) {
        for (int x = 0; x < W; ++x) {
            TColorAttr attr = getBackgroundAttr(bgConfig, x, y, W, H);
            buf.moveChar(x, ' ', attr, 1);
        }
        writeLine(0, y, W, 1, buf);
    };

    if (W <= 0 || H <= 0) return;

    if (!loadOk || frames.empty()) {
        for (int y = 0; y < H; ++y) fillRow(y);
        return;
    }

    Span s = frames[frameIndex];
    size_t p = s.start;
    size_t end = std::min(s.end, fileData.size());

    for (int y = 0; y < H; ++y) {
        if (p >= end) {
            fillRow(y);
            continue;
        }

        size_t lineEnd = findLineEnd(fileData, p, end);
        size_t pureEnd = lineEnd;
        if (pureEnd > p && fileData[pureEnd - 1] == '\r') --pureEnd;
        size_t len = pureEnd > p ? pureEnd - p : 0;

        // Render line with proper text handling
        int n = (int)std::min<size_t>(len, (size_t)W);
        if (n > 0) {
            std::string line(fileData.data() + p, fileData.data() + p + n);
            
            // For solid/transparent, use safe text rendering
            if (bgConfig.type == TBackgroundType::Solid || bgConfig.type == TBackgroundType::Transparent) {
                TColorAttr attr = getBackgroundAttr(bgConfig, 0, y, W, H);
                buf.moveStr(0, line.c_str(), attr);
            } else {
                // For gradients, use middle color for text to avoid corruption
                TColorAttr attr = getBackgroundAttr(bgConfig, W/2, y, W, H);
                buf.moveStr(0, line.c_str(), attr);
            }
        }
        // Fill remaining width with background
        if (bgConfig.type == TBackgroundType::Solid || bgConfig.type == TBackgroundType::Transparent) {
            TColorAttr attr = getBackgroundAttr(bgConfig, 0, y, W, H);
            if (W > n) buf.moveChar(n, ' ', attr, W - n);
        } else {
            for (int x = n; x < W; ++x) {
                TColorAttr attr = getBackgroundAttr(bgConfig, x, y, W, H);
                buf.moveChar(x, ' ', attr, 1);
            }
        }

        writeLine(0, y, W, 1, buf);

        // Advance to next line (skip '\n' if present)
        p = (lineEnd < end && fileData[lineEnd] == '\n') ? lineEnd + 1 : lineEnd;
    }
}

void FrameFilePlayerView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        // Only act on our own timer; 'infoPtr' carries the TTimerId that fired.
        if (timerId != 0 && ev.message.infoPtr == timerId) {
            advanceFrame();
            drawView();
            clearEvent(ev);
        }
    }
}

void FrameFilePlayerView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if ((aState & sfExposed) != 0) {
        if (enable) {
            frameIndex = 0;
            // Start periodic animation strictly from the UI/event loop.
            // No threads; timer callbacks arrive as cmTimerExpired broadcasts.
            startTimer();
            drawView();
        } else {
            // Pause when hidden to avoid unnecessary work.
            stopTimer();
        }
    }
}

// TTextFileView implementation
TTextFileView::TTextFileView(const TRect &bounds, const std::string &path) : TGroup(bounds)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable;
    
    // Create vertical scrollbar on right edge
    TRect r = getExtent();
    r.a.x = r.b.x - 1;
    vScrollBar = new TScrollBar(r);
    insert(vScrollBar);
    
    loadFile(path);
    setLimit();
}

TTextFileView::~TTextFileView()
{
    // ScrollBar will be destroyed by TView destructor
}

void TTextFileView::loadFile(const std::string &path)
{
    std::ifstream file(path);
    if (!file) {
        loadOk = false;
        errorMsg = "Failed to open file: " + path;
        return;
    }
    
    lines.clear();
    std::string line;
    while (std::getline(file, line)) {
        // Strip CR for CRLF files.
        if (!line.empty() && line.back() == '\r')
            line.pop_back();
        // Skip internal guidance notes: lines prefixed with 1-4 '#'.
        if (!line.empty() && line[0] == '#') {
            size_t i = 0;
            while (i < line.size() && line[i] == '#' && i < 4)
                ++i;
            if (i >= 1)
                continue; // exclude this line
        }
        lines.push_back(line);
    }
    
    loadOk = true;
}

void TTextFileView::setLimit()
{
    if (vScrollBar) {
        int maxLines = std::max(0, (int)lines.size() - size.y);
        vScrollBar->setParams(topLine, 0, maxLines, size.y - 1, 1);
    }
}

void TTextFileView::draw()
{
    // Always draw when explicitly called by TVision framework
    // The needsRedraw optimization caused blank windows during terminal resize
    needsRedraw = false; // Clear flag early to prevent recursive calls
    
    TDrawBuffer buf;
    int viewHeight = size.y;
    int viewWidth = size.x - 1; // Leave space for scrollbar
    
    for (int y = 0; y < viewHeight; y++) {
        int lineIndex = topLine + y;
        
        if (lineIndex < (int)lines.size()) {
            // Display line with background-aware coloring but preserve text integrity
            const std::string& line = lines[lineIndex];
            
            // For solid colors and transparency, use efficient text rendering
            if (bgConfig.type == TBackgroundType::Solid || bgConfig.type == TBackgroundType::Transparent) {
                TColorAttr attr = getBackgroundAttr(bgConfig, 0, y, viewWidth, viewHeight);
                TAttrPair attrs{attr, attr};
                ushort written = buf.moveCStr(0, line.c_str(), attrs, viewWidth);
                if (written < viewWidth) {
                    buf.moveChar(written, ' ', attr, viewWidth - written);
                }
            } else {
                // For gradients, render entire line first then apply background
                TColorAttr defaultAttr = getBackgroundAttr(bgConfig, viewWidth/2, y, viewWidth, viewHeight);
                TAttrPair attrs{defaultAttr, defaultAttr};
                ushort written = buf.moveCStr(0, line.c_str(), attrs, viewWidth);
                if (written < viewWidth) {
                    buf.moveChar(written, ' ', defaultAttr, viewWidth - written);
                }
                
                // Apply gradient background to spaces only to avoid text corruption
                for (int x = written; x < viewWidth; ++x) {
                    TColorAttr attr = getBackgroundAttr(bgConfig, x, y, viewWidth, viewHeight);
                    buf.moveChar(x, ' ', attr, 1);
                }
            }
        } else {
            // Empty line with background
            if (bgConfig.type == TBackgroundType::Solid || bgConfig.type == TBackgroundType::Transparent) {
                TColorAttr attr = getBackgroundAttr(bgConfig, 0, y, viewWidth, viewHeight);
                buf.moveChar(0, ' ', attr, viewWidth);
            } else {
                for (int x = 0; x < viewWidth; ++x) {
                    TColorAttr attr = getBackgroundAttr(bgConfig, x, y, viewWidth, viewHeight);
                    buf.moveChar(x, ' ', attr, 1);
                }
            }
        }
        
        writeLine(0, y, viewWidth, 1, buf);
    }
}

void TTextFileView::handleEvent(TEvent &ev)
{
    TGroup::handleEvent(ev);
    
    if (ev.what == evKeyDown) {
        switch (ev.keyDown.keyCode) {
            case kbUp:
                if (topLine > 0) {
                    topLine--;
                    needsRedraw = true;
                    setLimit();
                    drawView();
                }
                clearEvent(ev);
                break;
                
            case kbDown:
                if (topLine + size.y < (int)lines.size()) {
                    topLine++;
                    needsRedraw = true;
                    setLimit();
                    drawView();
                }
                clearEvent(ev);
                break;
                
            case kbPgUp:
                topLine = std::max(0, topLine - size.y);
                needsRedraw = true;
                setLimit();
                drawView();
                clearEvent(ev);
                break;
                
            case kbPgDn:
                topLine = std::min((int)lines.size() - size.y, topLine + size.y);
                if (topLine < 0) topLine = 0;
                needsRedraw = true;
                setLimit();
                drawView();
                clearEvent(ev);
                break;
                
            case kbHome:
                topLine = 0;
                needsRedraw = true;
                setLimit();
                drawView();
                clearEvent(ev);
                break;
                
            case kbEnd:
                topLine = std::max(0, (int)lines.size() - size.y);
                needsRedraw = true;
                setLimit();
                drawView();
                clearEvent(ev);
                break;
        }
    } else if (ev.what == evBroadcast && ev.message.command == cmScrollBarChanged) {
        if (ev.message.infoPtr == vScrollBar) {
            topLine = vScrollBar->value;
            needsRedraw = true;
            drawView();
        }
    }
}

void TTextFileView::changeBounds(const TRect& bounds)
{
    TGroup::changeBounds(bounds);
    needsRedraw = true;  // Trigger redraw when window is resized
    setLimit();          // Update scrollbar limits
}

// Helper function to detect if file contains frame delimiters
bool hasFrameDelimiters(const std::string& filePath)
{
    std::ifstream file(filePath);
    if (!file) return false;
    
    std::string line;
    while (std::getline(file, line)) {
        // Remove trailing \r if present (CRLF handling)
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        if (line == "----") {
            return true;
        }
    }
    return false;
}

// --- Background Color Support ---

namespace {

// Simple color grid view for palette picker
class TColorGridView : public TView {
public:
    int selected {0};
    TColorGridView(const TRect &r, int initial=0) : TView(r), selected(initial) { options |= ofSelectable; }
    virtual void draw() override {
        const int cols = 4, rows = 4; int cellW = size.x / cols; if (cellW < 8) cellW = 8;
        TDrawBuffer b;
        for (int ry = 0; ry < rows; ++ry) {
            b.moveChar(0, ' ', TColorAttr(0x07), size.x);
            int xPos = 0;
            for (int cx = 0; cx < cols; ++cx) {
                int idx = ry*cols + cx;
                if (idx >= 16) break;
                const TColorRGB &bg = kAnsiBg[idx];
                int bright = (int)bg.r * 299 + (int)bg.g * 587 + (int)bg.b * 114;
                TColorRGB fg = bright > 128000 ? TColorRGB(0x20,0x20,0x20) : TColorRGB(0xFF,0xFF,0xFF);
                TColorAttr attr(fg, bg);
                int sw = std::min(cellW-1, 12);
                if (xPos < size.x) b.moveChar(xPos, ' ', attr, std::min(sw, size.x - xPos));
                if (idx == selected && xPos < size.x) {
                    TColorAttr mk(TColorRGB(0xFF,0xFF,0xFF), TColorRGB(0x00,0x00,0x00));
                    b.moveChar(xPos, '>', mk, 1);
                }
                xPos += cellW;
            }
            writeLine(0, ry, size.x, 1, b);
        }
    }
    virtual void handleEvent(TEvent &ev) override {
        if (ev.what == evKeyDown) {
            switch (ev.keyDown.keyCode) {
                case kbLeft: if (selected > 0) selected--; clearEvent(ev); drawView(); break;
                case kbRight: if (selected < 15) selected++; clearEvent(ev); drawView(); break;
                case kbUp: if (selected >= 4) selected -= 4; clearEvent(ev); drawView(); break;
                case kbDown: if (selected <= 11) selected += 4; clearEvent(ev); drawView(); break;
                case kbEnter: case ' ': endModal(cmOK); clearEvent(ev); break;
                case kbEsc: endModal(cmCancel); clearEvent(ev); break;
            }
        }
        TView::handleEvent(ev);
    }
};

// Simple enhanced background selector - extends the existing color grid
class TEnhancedColorGridView : public TView {
public:
    TBackgroundConfig config;
    int gridSelected {0};
    int typeSelected {0}; // 0=solid, 1=transparent, 2=hgrad, 3=vgrad, 4=radial, 5=diagonal
    
    TEnhancedColorGridView(const TRect &r, const TBackgroundConfig& currentConfig) 
        : TView(r), config(currentConfig) { 
        options |= ofSelectable; 
        gridSelected = currentConfig.solidColorIndex;
        typeSelected = (int)currentConfig.type;
    }
    
    virtual void draw() override {
        TDrawBuffer b;
        
        // Draw background type selector at top
        b.moveChar(0, ' ', TColorAttr(0x07), size.x);
        if (typeSelected == 0) b.moveStr(0, ">Solid", TColorAttr(0x0F));
        else b.moveStr(0, " Solid", TColorAttr(0x07));
        
        if (typeSelected == 1) b.moveStr(7, ">Trans", TColorAttr(0x0F));
        else b.moveStr(7, " Trans", TColorAttr(0x07));
        
        if (typeSelected == 2) b.moveStr(14, ">HGrad", TColorAttr(0x0F));
        else b.moveStr(14, " HGrad", TColorAttr(0x07));
        
        if (typeSelected == 3) b.moveStr(21, ">VGrad", TColorAttr(0x0F));
        else b.moveStr(21, " VGrad", TColorAttr(0x07));
        
        writeLine(0, 0, size.x, 1, b);
        
        // Draw color grid (starting at row 2)
        const int cols = 4, rows = 4; 
        int cellW = (size.x - 2) / cols; 
        if (cellW < 8) cellW = 8;
        
        for (int ry = 0; ry < rows; ++ry) {
            b.moveChar(0, ' ', TColorAttr(0x07), size.x);
            int xPos = 1;
            for (int cx = 0; cx < cols; ++cx) {
                int idx = ry*cols + cx;
                if (idx >= 16) break;
                const TColorRGB &bg = kAnsiBg[idx];
                int bright = (int)bg.r * 299 + (int)bg.g * 587 + (int)bg.b * 114;
                TColorRGB fg = bright > 128000 ? TColorRGB(0x20,0x20,0x20) : TColorRGB(0xFF,0xFF,0xFF);
                TColorAttr attr(fg, bg);
                int sw = std::min(cellW-1, 12);
                if (xPos < size.x) b.moveChar(xPos, ' ', attr, std::min(sw, size.x - xPos));
                if (idx == gridSelected && xPos < size.x) {
                    TColorAttr mk(TColorRGB(0xFF,0xFF,0xFF), TColorRGB(0x00,0x00,0x00));
                    b.moveChar(xPos, '>', mk, 1);
                }
                xPos += cellW;
            }
            writeLine(0, ry + 2, size.x, 1, b);
        }
    }
    
    virtual void handleEvent(TEvent &ev) override {
        if (ev.what == evKeyDown) {
            switch (ev.keyDown.keyCode) {
                case kbTab:
                    typeSelected = (typeSelected + 1) % 4; // Cycle through types
                    clearEvent(ev); drawView(); break;
                case kbLeft: if (gridSelected > 0) gridSelected--; clearEvent(ev); drawView(); break;
                case kbRight: if (gridSelected < 15) gridSelected++; clearEvent(ev); drawView(); break;
                case kbUp: if (gridSelected >= 4) gridSelected -= 4; clearEvent(ev); drawView(); break;
                case kbDown: if (gridSelected <= 11) gridSelected += 4; clearEvent(ev); drawView(); break;
                case kbEnter: case ' ': 
                    // Update config based on selection
                    config.type = (TBackgroundType)typeSelected;
                    config.solidColorIndex = gridSelected;
                    if (typeSelected == 2) { // Horizontal gradient
                        config.gradientStart = TColorRGB(0x00, 0x00, 0xFF);
                        config.gradientEnd = TColorRGB(0xFF, 0x00, 0xFF);
                    } else if (typeSelected == 3) { // Vertical gradient
                        config.gradientStart = TColorRGB(0xFF, 0x00, 0x00);
                        config.gradientEnd = TColorRGB(0xFF, 0xFF, 0x00);
                    }
                    endModal(cmOK); clearEvent(ev); break;
                case kbEsc: endModal(cmCancel); clearEvent(ev); break;
            }
        }
        TView::handleEvent(ev);
    }
};

static ushort runEnhancedBgDialog(TBackgroundConfig &config)
{
    TRect r(0, 0, 40, 8);
    r.move((TProgram::deskTop->size.x - r.b.x) / 2, (TProgram::deskTop->size.y - r.b.y) / 2);
    auto *dlg = new TDialog(r, "Background Options");
    r = dlg->getExtent(); r.grow(-2, -1);
    auto *view = new TEnhancedColorGridView(r, config);
    dlg->insert(view);
    ushort result = TProgram::deskTop->execView(dlg);
    if (result == cmOK) {
        config = view->config;
    }
    TObject::destroy(dlg);
    return result;
}

static ushort runBgPaletteDialog(int &index)
{
    TRect r(0, 0, 40, 8);
    r.move((TProgram::deskTop->size.x - r.b.x) / 2, (TProgram::deskTop->size.y - r.b.y) / 2);
    auto *dlg = new TDialog(r, "Background Color");
    r = dlg->getExtent(); r.grow(-2, -1);
    dlg->insert(new TColorGridView(r, index));
    ushort result = TProgram::deskTop->execView(dlg);
    if (result == cmOK) {
        auto *grid = (TColorGridView*)dlg->firstThat([](TView *p, void*) -> Boolean {
            return dynamic_cast<TColorGridView*>(p) != nullptr;
        }, nullptr);
        if (grid) index = grid->selected;
    }
    TObject::destroy(dlg);
    return result;
}
} // namespace

void FrameFilePlayerView::setBackgroundConfig(const TBackgroundConfig& config)
{
    bgConfig = config;
    drawView();
}

void FrameFilePlayerView::setBackgroundIndex(int idx)
{
    if (idx < 0) idx = 0; if (idx > 15) idx = 15;
    bgConfig.type = TBackgroundType::Solid;
    bgConfig.solidColorIndex = idx;
    drawView();
}

bool FrameFilePlayerView::openBackgroundDialog()
{
    TBackgroundConfig config = bgConfig;
    if (runEnhancedBgDialog(config) == cmCancel)
        return false;
    setBackgroundConfig(config);
    return true;
}

void TTextFileView::setBackgroundConfig(const TBackgroundConfig& config)
{
    bgConfig = config;
    drawView();
}

void TTextFileView::setBackgroundIndex(int idx)
{
    if (idx < 0) idx = 0; if (idx > 15) idx = 15;
    bgConfig.type = TBackgroundType::Solid;
    bgConfig.solidColorIndex = idx;
    drawView();
}

bool TTextFileView::openBackgroundDialog()
{
    TBackgroundConfig config = bgConfig;
    if (runEnhancedBgDialog(config) == cmCancel)
        return false;
    setBackgroundConfig(config);
    return true;
}
