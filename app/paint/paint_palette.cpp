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

void TPaintPaletteView::draw()
{
    TDrawBuffer b;
    TColorAttr frame{0x07};
    // Header
    b.moveChar(0, ' ', frame, size.x);
    b.moveStr(1, "Palette", frame);
    writeLine(0, 0, size.x, 1, b);

    // FG/BG color chip (Photoshop-style overlapping squares)
    // FG chip: rows 1-3, cols 1-3 (3x3). BG chip: rows 2-4, cols 3-5 (3x3).
    // Overlap at rows 2-3 col 3 — FG wins (FG is on top).
    {
        uint8_t cFg = canvas ? canvas->getFg() : 15;
        uint8_t cBg = canvas ? canvas->getBg() : 0;
        TColorAttr aFg{(uint8_t)((cFg << 4) | (cFg < 8 ? 0x0F : 0x00))};
        TColorAttr aBg{(uint8_t)((cBg << 4) | (cBg < 8 ? 0x0F : 0x00))};

        // Row 1: FG top row + "FG" label
        b.moveChar(0, ' ', frame, size.x);
        b.moveChar(1, ' ', aFg, 3);
        b.moveStr(5, "FG", frame);
        writeLine(0, 1, size.x, 1, b);

        // Row 2: FG (cols 1-3 incl overlap), BG (cols 4-5)
        b.moveChar(0, ' ', frame, size.x);
        b.moveChar(1, ' ', aFg, 3);
        b.moveChar(4, ' ', aBg, 2);
        writeLine(0, 2, size.x, 1, b);

        // Row 3: same as row 2
        b.moveChar(0, ' ', frame, size.x);
        b.moveChar(1, ' ', aFg, 3);
        b.moveChar(4, ' ', aBg, 2);
        writeLine(0, 3, size.x, 1, b);

        // Row 4: BG bottom row (cols 3-5) + "BG" label
        b.moveChar(0, ' ', frame, size.x);
        b.moveChar(3, ' ', aBg, 3);
        b.moveStr(7, "BG", frame);
        writeLine(0, 4, size.x, 1, b);

        // Row 5: blank separator
        b.moveChar(0, ' ', frame, size.x);
        writeLine(0, 5, size.x, 1, b);
    }

    // Grid origin
    int ox = 1;
    int oy = 6;
    // Draw grid: build full row buffer, write once per screen row
    for (int r = 0; r < rows; ++r) {
        // Each swatch is cellH rows tall
        for (int subRow = 0; subRow < cellH; ++subRow) {
            b.moveChar(0, ' ', frame, size.x);
            for (int c = 0; c < cols; ++c) {
                uint8_t idx = r * cols + c;
                TColorAttr a = swatchAttr(idx);
                b.moveChar(ox + c * cellW, ' ', a, cellW);
            }
            writeLine(0, oy + r * cellH + subRow, size.x, 1, b);
        }
    }

    // Show hint below grid if space allows
    int infoY = oy + rows * cellH + 1;
    if (infoY < size.y) {
        b.moveChar(0, ' ', frame, size.x);
        b.moveStr(1, "Left:FG Right:BG", frame);
        writeLine(0, infoY, size.x, 1, b);
    }

    // Clear remaining rows
    for (int y = infoY + 1; y < size.y; ++y) {
        b.moveChar(0, ' ', frame, size.x);
        writeLine(0, y, size.x, 1, b);
    }
}

bool TPaintPaletteView::hitTest(TPoint p, uint8_t &idx) const
{
    int ox = 1, oy = 6;
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
