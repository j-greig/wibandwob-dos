#pragma once

#define Uses_TView
#define Uses_TRect
#define Uses_TEvent
#define Uses_TDrawBuffer
#define Uses_TPalette
#include <tvision/tv.h>

#include "mech.h"
#include <vector>

class TMechGrid : public TView {
public:
    TMechGrid(const TRect& bounds, int rows = 3, int cols = 3);
    
    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;
    virtual TPalette& getPalette() const override;
    virtual TColorAttr mapColor(uchar index) noexcept override;
    
    // Grid configuration
    void setGridSize(int rows, int cols);
    void setBorderStyle(BorderStyle style);
    
    // Mech management
    void generateAllMechs();
    void regenerateMechs();
    
    // Getters
    int getRows() const { return rows_; }
    int getCols() const { return cols_; }
    BorderStyle getBorderStyle() const { return borderStyle_; }
    
private:
    int rows_;
    int cols_;
    BorderStyle borderStyle_;
    std::vector<TMech> mechs_;
    
    // Layout helpers
    void calculateLayout();
    TRect getMechBounds(int row, int col) const;
    void drawMech(TDrawBuffer& buffer, const TMech& mech, int startCol, int bufferWidth);
    
    // Grid dimensions
    int mechWidth_;
    int mechHeight_;
    int gridSpacing_;
};