#pragma once

#define Uses_TWindow
#define Uses_TMenuBar
#define Uses_TSubMenu
#define Uses_TMenuItem
#define Uses_TRect
#define Uses_TEvent
#include <tvision/tv.h>

#include "mech_grid.h"
#include "mech_config.h"

// Menu commands
const int
    cmMechRefresh = 1001,
    cmMechConfig = 1002,
    cmMechStyleSingle = 1003,
    cmMechStyleDouble = 1004,
    cmMechStyleRound = 1005,
    cmMechStyleFat = 1006,
    cmMechGrid1x1 = 1010,
    cmMechGrid2x2 = 1011,
    cmMechGrid3x3 = 1012,
    cmMechGrid4x4 = 1013,
    cmMechGrid5x5 = 1014,
    cmMechGrid6x6 = 1015;

class TMechWindow : public TWindow {
public:
    TMechWindow(const TRect& bounds, const char* title, int windowNumber);
    ~TMechWindow();
    
    virtual void handleEvent(TEvent& event) override;
    
    // Grid access
    TMechGrid* getGrid() const { return grid_; }
    
private:
    TMechGrid* grid_;
    
    void setupGrid();
    void showConfigDialog();
    void handleStyleChange(BorderStyle style);
    void handleGridSizeChange(int rows, int cols);
};