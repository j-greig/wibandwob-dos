/*---------------------------------------------------------*/
/*                                                         */
/*   paint_palette.h - Color palette view (MVP)            */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TVISION_PAINT_PALETTE_H
#define TVISION_PAINT_PALETTE_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TRect
#include <tvision/tv.h>

#include "paint_canvas.h"

class TPaintPaletteView : public TView {
public:
    TPaintPaletteView(const TRect &r, TPaintCanvasView *canvas)
        : TView(r), canvas(canvas) {
        options |= ofFramed | ofPreProcess | ofSelectable;
        growMode = gfGrowLoX | gfGrowHiX | gfGrowHiY;
        eventMask |= evMouseDown | evKeyboard;
    }

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void sizeLimits(TPoint &min, TPoint &max) override {
        TView::sizeLimits(min, max);
        min.x = 18; min.y = 16;
    }

    void setCanvas(TPaintCanvasView *c) { canvas = c; }

private:
    TPaintCanvasView *canvas;
    // Layout for 16-color grid.
    static constexpr int cols = 4;
    static constexpr int rows = 4;
    static constexpr int cellW = 4; // columns per swatch
    static constexpr int cellH = 2; // rows per swatch

    TColorAttr swatchAttr(uint8_t idx) const;
    bool hitTest(TPoint p, uint8_t &idx) const;
};

#endif

