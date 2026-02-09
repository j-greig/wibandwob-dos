/*---------------------------------------------------------*/
/*                                                         */
/*   paint_palette.cpp - Color palette view (MVP)          */
/*                                                         */
/*---------------------------------------------------------*/

#include "paint_palette.h"

TColorAttr TPaintPaletteView::swatchAttr(uint8_t idx) const
{
    // Solid swatch using background color idx; foreground same or contrasting
    uint8_t fg = (idx == 0 || idx == 1 || idx == 2 || idx == 4 || idx == 6 || idx == 8)
        ? 0x0F : 0x00; // choose white fg for dark backgrounds, black otherwise
    uint8_t attr = (idx << 4) | (fg & 0x0F);
    return TColorAttr{attr};
}

void TPaintPaletteView::drawSwatch(TDrawBuffer &b, int x, int y, uint8_t idx)
{
    // Two rows tall, fill with spaces in background color
    TColorAttr a = swatchAttr(idx);
    b.moveChar(x, ' ', a, cellW);
    writeLine(0, y, size.x, 1, b);
    b.moveChar(x, ' ', a, cellW);
    writeLine(0, y+1, size.x, 1, b);
}

void TPaintPaletteView::draw()
{
    TDrawBuffer b;
    TColorAttr frame{0x07};
    // Header
    b.moveChar(0, ' ', frame, size.x);
    b.moveStr(1, "Palette", frame);
    writeLine(0, 0, size.x, 1, b);

    // Grid origin
    int ox = 1;
    int oy = 2;
    // Draw grid lines row by row
    for (int r = 0; r < rows; ++r) {
        for (int c = 0; c < cols; ++c) {
            uint8_t idx = r*cols + c;
            // Prepare line buffer
            b.moveChar(0, ' ', frame, size.x);
            drawSwatch(b, ox + c*cellW, oy + r*cellH, idx);
        }
    }

    // Show indices below if space allows
    int infoY = oy + rows*cellH + 1;
    if (infoY < size.y) {
        b.moveChar(0, ' ', frame, size.x);
        b.moveStr(1, "Left:FG Right:BG", frame);
        writeLine(0, infoY, size.x, 1, b);
    }
}

bool TPaintPaletteView::hitTest(TPoint p, uint8_t &idx) const
{
    int ox = 1, oy = 2;
    int gx = p.x - ox;
    int gy = p.y - oy;
    if (gx < 0 || gy < 0) return false;
    int c = gx / cellW;
    int r = gy / cellH;
    if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
    idx = r*cols + c;
    return true;
}

void TPaintPaletteView::handleEvent(TEvent &ev)
{
    TView::handleEvent(ev);
    if (!canvas) return;
    if (ev.what == evMouseDown) {
        TPoint p = makeLocal(ev.mouse.where);
        uint8_t idx;
        if (hitTest(p, idx)) {
            if (ev.mouse.buttons & mbRightButton)
                canvas->setBg(idx);
            else
                canvas->setFg(idx);
            canvas->drawView();
            drawView();
        }
        clearEvent(ev);
    }
}

