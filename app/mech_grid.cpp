#include "mech_grid.h"

#define Uses_TKeys
#define Uses_TDrawBuffer
#include <tvision/tv.h>
#include <algorithm>

TMechGrid::TMechGrid(const TRect& bounds, int rows, int cols) : 
    TView(bounds), 
    rows_(rows), 
    cols_(cols),
    borderStyle_(BorderStyle::SINGLE),
    mechWidth_(TMech::CANVAS_WIDTH),
    mechHeight_(TMech::CANVAS_HEIGHT),
    gridSpacing_(2)
{
    options |= ofSelectable;
    eventMask |= evKeyboard;
    
    calculateLayout();
    mechs_.resize(rows_ * cols_);
    generateAllMechs();
}

void TMechGrid::draw() {
    TDrawBuffer buffer;
    ushort normalColor = getColor(1);
    
    for (int y = 0; y < size.y; ++y) {
        buffer.moveChar(0, ' ', normalColor, size.x);
        
        // Calculate which mechs are visible in this row
        for (int gridRow = 0; gridRow < rows_; ++gridRow) {
            int mechStartY = gridRow * (mechHeight_ + gridSpacing_);
            int mechEndY = mechStartY + mechHeight_;
            
            if (y >= mechStartY && y < mechEndY) {
                int mechLineY = y - mechStartY;
                
                for (int gridCol = 0; gridCol < cols_; ++gridCol) {
                    int mechIndex = gridRow * cols_ + gridCol;
                    if (mechIndex >= mechs_.size()) continue;
                    
                    int mechStartX = gridCol * (mechWidth_ + gridSpacing_);
                    
                    // Check bounds
                    if (mechStartX >= size.x) continue;
                    
                    const TMech& mech = mechs_[mechIndex];
                    const std::string& mechLine = mech.getLine(mechLineY);
                    
                    // Draw mech line into buffer
                    int drawWidth = std::min((int)mechLine.length(), size.x - mechStartX);
                    for (int i = 0; i < drawWidth; ++i) {
                        if (mechStartX + i < size.x) {
                            buffer.putChar(mechStartX + i, mechLine[i]);
                        }
                    }
                }
            }
        }
        
        writeLine(0, y, size.x, 1, buffer);
    }
}

void TMechGrid::handleEvent(TEvent& event) {
    TView::handleEvent(event);
    
    if (event.what == evKeyDown) {
        switch (event.keyDown.keyCode) {
            case kbF5:
                regenerateMechs();
                clearEvent(event);
                break;
                
            case kbF6:
                // Send config command to parent window
                {
                    TEvent configEvent;
                    configEvent.what = evCommand;
                    configEvent.message.command = cmMechConfig;
                    putEvent(configEvent);
                }
                clearEvent(event);
                break;
                
            case 's':
            case 'S':
                // Cycle border styles
                {
                    int currentStyle = static_cast<int>(borderStyle_);
                    currentStyle = (currentStyle + 1) % 5; // 5 border styles
                    setBorderStyle(static_cast<BorderStyle>(currentStyle));
                    clearEvent(event);
                }
                break;
                
            case 'r':
            case 'R':
                regenerateMechs();
                clearEvent(event);
                break;
        }
    }
}

TPalette& TMechGrid::getPalette() const {
    // Use same pattern as other fixed components - simple gray palette
    static TPalette palette(cpGrayDialog, sizeof(cpGrayDialog) - 1);
    return palette;
}

TColorAttr TMechGrid::mapColor(uchar index) noexcept {
    // Override color mapping to use RGB colors, bypassing terminal palette interpretation
    // This fixes the pink background issue by using true black/white instead of ANSI colors
    TColorRGB trueBlack(0, 0, 0);
    TColorRGB trueWhite(255, 255, 255);
    
    // Map to WHITE ON BLACK (white text, black background) for proper mech display
    return TColorAttr(trueWhite, trueBlack);
}

void TMechGrid::setGridSize(int rows, int cols) {
    if (rows < 1) rows = 1;
    if (cols < 1) cols = 1;
    if (rows > 6) rows = 6;
    if (cols > 6) cols = 6;
    
    rows_ = rows;
    cols_ = cols;
    
    calculateLayout();
    mechs_.resize(rows_ * cols_);
    generateAllMechs();
    drawView();
}

void TMechGrid::setBorderStyle(BorderStyle style) {
    borderStyle_ = style;
    
    // Apply style to all existing mechs
    for (auto& mech : mechs_) {
        mech.applyBorderStyle(style);
    }
    
    drawView();
}

void TMechGrid::generateAllMechs() {
    for (auto& mech : mechs_) {
        mech.generate();
        mech.applyBorderStyle(borderStyle_);
    }
    drawView();
}

void TMechGrid::regenerateMechs() {
    generateAllMechs();
}

void TMechGrid::calculateLayout() {
    // Calculate optimal spacing based on view size and grid dimensions
    int availableWidth = size.x - (cols_ - 1) * gridSpacing_;
    int availableHeight = size.y - (rows_ - 1) * gridSpacing_;
    
    // Use standard mech dimensions for now
    // Could scale in future if needed
    mechWidth_ = TMech::CANVAS_WIDTH;
    mechHeight_ = TMech::CANVAS_HEIGHT;
    
    // Adjust spacing if grid doesn't fit
    int totalWidth = cols_ * mechWidth_ + (cols_ - 1) * gridSpacing_;
    int totalHeight = rows_ * mechHeight_ + (rows_ - 1) * gridSpacing_;
    
    if (totalWidth > size.x && cols_ > 1) {
        gridSpacing_ = std::max(1, (size.x - cols_ * mechWidth_) / (cols_ - 1));
    }
    
    if (totalHeight > size.y && rows_ > 1) {
        // Might need to reduce spacing or scale mechs in future
        gridSpacing_ = std::max(0, (size.y - rows_ * mechHeight_) / (rows_ - 1));
    }
}

TRect TMechGrid::getMechBounds(int row, int col) const {
    int x = col * (mechWidth_ + gridSpacing_);
    int y = row * (mechHeight_ + gridSpacing_);
    return TRect(x, y, x + mechWidth_, y + mechHeight_);
}