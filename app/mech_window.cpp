#include "mech_window.h"

#define Uses_TApplication
#define Uses_TDeskTop
#include <tvision/tv.h>

TMechWindow::TMechWindow(const TRect& bounds, const char* title, int windowNumber) :
    TWindow(bounds, title, windowNumber),
    TWindowInit(&TMechWindow::initFrame),
    grid_(nullptr)
{
    setupGrid();
}

TMechWindow::~TMechWindow() {
    // grid_ will be deleted by TWindow destructor
}

void TMechWindow::setupGrid() {
    // Create grid to fill the client area
    TRect gridBounds = getExtent();
    gridBounds.grow(-1, -1); // Account for window border
    
    grid_ = new TMechGrid(gridBounds, 3, 3); // Default 3x3 grid
    insert(grid_);
}

void TMechWindow::handleEvent(TEvent& event) {
    TWindow::handleEvent(event);
    
    if (event.what == evCommand) {
        switch (event.message.command) {
            case cmMechRefresh:
                if (grid_) {
                    grid_->regenerateMechs();
                }
                clearEvent(event);
                break;
                
            case cmMechConfig:
                showConfigDialog();
                clearEvent(event);
                break;
                
            case cmMechStyleSingle:
                handleStyleChange(BorderStyle::SINGLE);
                clearEvent(event);
                break;
                
            case cmMechStyleDouble:
                handleStyleChange(BorderStyle::DOUBLE);
                clearEvent(event);
                break;
                
            case cmMechStyleRound:
                handleStyleChange(BorderStyle::ROUND);
                clearEvent(event);
                break;
                
            case cmMechStyleFat:
                handleStyleChange(BorderStyle::FAT);
                clearEvent(event);
                break;
                
            case cmMechGrid1x1:
                handleGridSizeChange(1, 1);
                clearEvent(event);
                break;
                
            case cmMechGrid2x2:
                handleGridSizeChange(2, 2);
                clearEvent(event);
                break;
                
            case cmMechGrid3x3:
                handleGridSizeChange(3, 3);
                clearEvent(event);
                break;
                
            case cmMechGrid4x4:
                handleGridSizeChange(4, 4);
                clearEvent(event);
                break;
                
            case cmMechGrid5x5:
                handleGridSizeChange(5, 5);
                clearEvent(event);
                break;
                
            case cmMechGrid6x6:
                handleGridSizeChange(6, 6);
                clearEvent(event);
                break;
        }
    }
}

void TMechWindow::showConfigDialog() {
    if (!grid_) return;
    
    // Create config dialog with current settings
    TMechConfigDialog* dialog = new TMechConfigDialog();
    MechGridConfig config;
    config.rows = grid_->getRows();
    config.cols = grid_->getCols();
    config.borderStyle = grid_->getBorderStyle();
    dialog->setConfig(config);
    
    // Show dialog
    if (deskTop->execView(dialog) == cmOK) {
        // Apply new configuration
        MechGridConfig newConfig = dialog->getConfig();
        grid_->setGridSize(newConfig.rows, newConfig.cols);
        grid_->setBorderStyle(newConfig.borderStyle);
    }
    
    destroy(dialog);
}

void TMechWindow::handleStyleChange(BorderStyle style) {
    if (grid_) {
        grid_->setBorderStyle(style);
    }
}

void TMechWindow::handleGridSizeChange(int rows, int cols) {
    if (grid_) {
        grid_->setGridSize(rows, cols);
    }
}