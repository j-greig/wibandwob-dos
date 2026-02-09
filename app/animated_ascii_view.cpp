/*---------------------------------------------------------*/
/*                                                         */
/*   animated_ascii_view.cpp - Multi-Layer ASCII Animation*/
/*                                                         */
/*---------------------------------------------------------*/

#include "animated_ascii_view.h"

#define Uses_TWindow
#define Uses_TEvent
#include <tvision/tv.h>
#include <cmath>

// Static ASCII art data - the original text split into lines
const std::vector<std::string> TAnimatedAsciiView::asciiArtLines = {
    "              ▝▝▗▗▝▝▗▗                   ≋≋≋≋≋            ",
    "                                                      ░░░░░░░         ",
    "    ▓▓▓▓▓                        ▒▒▒▒▒▒▒▒                            ",
    "              つ◑‿◐༽つ                        ⊖        ⊖       ",
    "                         ∿                                  ∿∿∿",
    "                              ≋≋≋≋≋≋≋≋≋≋≋                       ",
    "▗▗▝▝▗▗▝▝              ⊕                    ⊕                ⊕       ",
    "                                                                  ",
    "         ░░░                      ▓▓▓▓▓▓▓▓                    ",
    "                  (╯°□°)╯                        ↝↝↝            ",
    "                              ∿∿∿                     ░░░░     ",
    "    ∿∿∿∿                           ▒▒▒▒▒▒                      ",
    "            ⊖         ⊖                   ⊖            ▗▗▗▗    ",
    "                                                              ",
    "       ▓▓▓              つ._.)づ                 ▝▝▝▝          ",
    "                  ≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋                         ",
    "                                          ⊕         ⊕          ",
    "    ⊖                                                     ⊖    ",
    "              ▗▗▗▗▗▗            ▝▝▝▝▝▝                        ",
    "                      ░░░░░░░░░░░░░░░            ▓▓▓          ",
    "                                                              ",
    "         (づ｡◕‿‿◕｡)づ                    ∿∿∿∿∿∿∿              ",
    "                         ⊕                            ⊕        ",
    "    ≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋         ",
    "              ▒▒▒▒                    ░░░░░░                  ",
    "                    ⊖                         ⊖                ",
    "                              (⊙﹏⊙)                    ∿∿∿    ",
    "         ▓▓▓▓▓▓▓▓▓▓                    ▝▝▝▝▝▝▝▝▝▝           ",
    "                         ≋≋≋                      ≋≋≋≋        ",
    "    ⊕                         ⊕                         ⊕      ",
    "              ░░░░                    ▒▒▒▒▒▒▒▒              ",
    "                    つ▀▄▀༽つ                      ⊖            ",
    "                              ∿∿∿∿∿∿∿∿∿∿∿∿∿∿                ",
    "         ▗▗▗▗▗▗▗▗                              ▝▝▝▝▝▝"
};

TAnimatedAsciiView::TAnimatedAsciiView(const TRect &bounds, unsigned periodMs)
    : TView(bounds), periodMs(periodMs)
{
    // Anchor to top-left and grow to the right and bottom like other views.
    growMode = gfGrowHiX | gfGrowHiY;
    // Receive timer expirations via broadcast events (cmTimerExpired)
    eventMask |= evBroadcast;
    
    initializeArt();
}

TAnimatedAsciiView::~TAnimatedAsciiView() {
    stopTimer();
}

void TAnimatedAsciiView::setSpeed(unsigned periodMs_) {
    periodMs = periodMs_ ? periodMs_ : 1;
    if (timerId) {
        stopTimer();
        startTimer();
    }
}

void TAnimatedAsciiView::startTimer() {
    if (timerId == 0)
        timerId = setTimer(periodMs, (int)periodMs);
}

void TAnimatedAsciiView::stopTimer() {
    if (timerId != 0) {
        killTimer(timerId);
        timerId = 0;
    }
}

int TAnimatedAsciiView::getLineAnimationLayer(const std::string& line) const {
    // Classify entire lines based on their content
    // This preserves Unicode sequences properly
    
    // Check for kaomoji patterns (faces)
    if (line.find("つ") != std::string::npos || 
        line.find("(") != std::string::npos ||
        line.find(")") != std::string::npos ||
        line.find("◑") != std::string::npos ||
        line.find("◐") != std::string::npos ||
        line.find("°") != std::string::npos ||
        line.find("□") != std::string::npos) {
        return LAYER_KAOMOJI;
    }
    
    // Check for wave patterns  
    if (line.find("≋") != std::string::npos) {
        return LAYER_WAVES;
    }
    
    // Check for circle patterns
    if (line.find("⊖") != std::string::npos || line.find("⊕") != std::string::npos) {
        return LAYER_CIRCLES;  
    }
    
    // Check for squiggle patterns
    if (line.find("∿") != std::string::npos) {
        return LAYER_SQUIGGLES;
    }
    
    // Check for block patterns
    if (line.find("▓") != std::string::npos || 
        line.find("▒") != std::string::npos || 
        line.find("░") != std::string::npos) {
        return LAYER_BLOCKS;
    }
    
    // Check for triangle patterns
    if (line.find("▝") != std::string::npos || line.find("▗") != std::string::npos) {
        return LAYER_TRIANGLES;
    }
    
    // Check for arrow patterns
    if (line.find("↝") != std::string::npos) {
        return LAYER_ARROWS;
    }
    
    // Everything else is static
    return LAYER_STATIC;
}

void TAnimatedAsciiView::initializeArt() {
    animatedLines.clear();
    
    // Create animated lines from the ASCII art
    for (int y = 0; y < (int)asciiArtLines.size(); ++y) {
        const std::string& line = asciiArtLines[y];
        
        AnimatedLine animLine;
        animLine.text = line;
        animLine.originalY = y;
        animLine.currentY = y;
        animLine.offsetX = 0;
        animLine.layer = getLineAnimationLayer(line);
        
        animatedLines.push_back(animLine);
    }
}

void TAnimatedAsciiView::updateLinePosition(AnimatedLine& animLine) {
    // Update line position based on its animation layer
    switch (animLine.layer) {
        case LAYER_KAOMOJI:
            // Kaomoji lines bob up and down gently
            animLine.currentY = animLine.originalY + (int)(1.0f * std::sin((phase + animLine.originalY * 2) * 0.12f));
            break;
            
        case LAYER_WAVES:
            // Wave lines flow horizontally left to right
            animLine.offsetX = (phase / 3) % (size.x + 20) - 10;
            break;
            
        case LAYER_CIRCLES:
            // Circle lines drift slowly in gentle patterns
            animLine.offsetX = (int)(2.0f * std::sin((phase + animLine.originalY * 3) * 0.08f));
            animLine.currentY = animLine.originalY + (int)(0.5f * std::cos((phase + animLine.originalY * 2) * 0.1f));
            break;
            
        case LAYER_SQUIGGLES:
            // Squiggle lines wiggle in place
            animLine.offsetX = (int)(1.5f * std::sin((phase + animLine.originalY * 4) * 0.15f));
            animLine.currentY = animLine.originalY + (int)(0.3f * std::cos((phase + animLine.originalY * 3) * 0.18f));
            break;
            
        case LAYER_BLOCKS:
            // Block lines slide horizontally at different speeds
            animLine.offsetX = (phase / (3 + animLine.originalY % 2)) % (size.x + 15) - 8;
            break;
            
        case LAYER_TRIANGLES:
            // Triangle lines bounce up and down
            animLine.currentY = animLine.originalY + (int)(1.5f * std::abs(std::sin((phase + animLine.originalY * 5) * 0.1f)));
            break;
            
        case LAYER_ARROWS:
            // Arrow lines flow rapidly in their direction
            animLine.offsetX = (phase / 2) % (size.x + 25) - 12;
            break;
            
        case LAYER_STATIC:
        default:
            // Static lines don't move
            animLine.currentY = animLine.originalY;
            animLine.offsetX = 0;
            break;
    }
}

void TAnimatedAsciiView::advance() {
    // Update all line positions
    for (auto& animLine : animatedLines) {
        updateLinePosition(animLine);
    }
    ++phase;
}

void TAnimatedAsciiView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    // Clear the screen with light grey background
    TDrawBuffer buf;
    for (int y = 0; y < H; ++y) {
        buf.moveChar(0, ' ', TColorAttr(0x70), W); // Light grey background (white on black reversed)
        writeLine(0, y, W, 1, buf);
    }
    
    // Draw all animated lines at their current positions
    for (const auto& animLine : animatedLines) {
        int y = animLine.currentY;
        
        // Only draw if Y position is within bounds
        if (y >= 0 && y < H) {
            // Monochrome: black text on light grey background for all content
            TColorAttr attr = TColorAttr(0x07); // Black on light grey (0x07 = light grey bg, black fg)
            
            // Apply horizontal offset and draw the line
            int startX = animLine.offsetX;
            std::string displayText = animLine.text;
            
            // Handle wrapping/clipping
            if (startX < 0) {
                // Text starts off-screen to the left
                if (-startX < (int)displayText.length()) {
                    displayText = displayText.substr(-startX);
                    startX = 0;
                } else {
                    continue; // Completely off-screen
                }
            }
            
            // Clip text that goes past right edge
            if (startX < W) {
                int availableWidth = W - startX;
                if ((int)displayText.length() > availableWidth) {
                    displayText = displayText.substr(0, availableWidth);
                }
                
                // Draw the text using TDrawBuffer to preserve Unicode
                buf.moveStr(0, displayText.c_str(), attr);
                writeLine(startX, y, std::min((int)displayText.length(), availableWidth), 1, buf);
            }
        }
    }
}

void TAnimatedAsciiView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId != 0 && ev.message.infoPtr == timerId) {
            advance();
            drawView();
            clearEvent(ev);
        }
    }
}

void TAnimatedAsciiView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if ((aState & sfExposed) != 0) {
        if (enable) {
            startTimer();
            drawView();
        } else {
            stopTimer();
        }
    }
}

void TAnimatedAsciiView::changeBounds(const TRect& bounds)
{
    TView::changeBounds(bounds);
    // Re-render immediately to cover any newly exposed area.
    drawView();
}

// A wrapper window to ensure proper redraws on resize/tile.
class TAnimatedAsciiWindow : public TWindow {
public:
    explicit TAnimatedAsciiWindow(const TRect &bounds)
        : TWindow(bounds, "Animated ASCII Art", wnNoNumber)
        , TWindowInit(&TAnimatedAsciiWindow::initFrame) {}

    void setup()
    {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TAnimatedAsciiView(c, /*periodMs=*/120)); // 8.3 FPS
    }

    virtual void changeBounds(const TRect& b) override
    {
        TWindow::changeBounds(b);
        // Force a full redraw after tiling/resizing operations
        setState(sfExposed, True);
        redraw();
    }
};

// Factory helper; creates a tileable window hosting the animated ASCII view.
TWindow* createAnimatedAsciiWindow(const TRect &bounds)
{
    auto *w = new TAnimatedAsciiWindow(bounds);
    w->setup();
    return w;
}