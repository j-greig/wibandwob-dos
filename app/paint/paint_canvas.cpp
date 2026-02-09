/*---------------------------------------------------------*/
/*                                                         */
/*   paint_canvas.cpp - Simple paint canvas view (MVP)     */
/*                                                         */
/*---------------------------------------------------------*/

#include "paint_canvas.h"

TPaintCanvasView::TPaintCanvasView(const TRect &bounds, int cols, int rows, PaintContext *ctx)
    : TView(bounds), cols(cols), rows(rows), ctx(ctx), buffer(cols * rows)
{
    options |= ofFramed | ofSelectable;
    growMode = gfGrowAll;
    eventMask |= evKeyboard | evMouseDown | evMouseAuto | evMouseMove;
    clear();
}

void TPaintCanvasView::clear()
{
    for (auto &c : buffer) { c.uOn = false; c.lOn = false; c.uFg = fg; c.lFg = fg; c.qMask = 0; c.qFg = fg; }
    drawView();
}

PaintCell &TPaintCanvasView::cell(int x, int y)
{
    if (x < 0) x = 0; if (x >= cols) x = cols - 1;
    if (y < 0) y = 0; if (y >= rows) y = rows - 1;
    return buffer[y * cols + x];
}

void TPaintCanvasView::put(int x, int y, bool on)
{
    if (x < 0 || x >= cols || y < 0 || y >= rows) return;
    auto &c = buffer[y * cols + x];
    switch (pixelMode) {
        case PixelMode::Full:
            c.uOn = on; c.lOn = on; c.uFg = fg; c.lFg = fg; break;
        case PixelMode::HalfY:
            if (ySub == 0) { c.uOn = on; c.uFg = fg; }
            else           { c.lOn = on; c.lFg = fg; }
            break;
        case PixelMode::HalfX: {
            uint8_t bitL = 0x1 | 0x4; // TL|BL
            uint8_t bitR = 0x2 | 0x8; // TR|BR
            if (on) c.qFg = fg;
            if (xSub == 0) { if (on) c.qMask |= bitL; else c.qMask &= ~bitL; }
            else           { if (on) c.qMask |= bitR; else c.qMask &= ~bitR; }
            break;
        }
        case PixelMode::Quarter: {
            uint8_t bit = (ySub ? 0x4 : 0x1) << xSub; // TL(1),TR(2),BL(4),BR(8)
            if (on) { c.qMask |= bit; c.qFg = fg; }
            else    { c.qMask &= ~bit; }
            break;
        }
    }
}

static inline void mapHalfCell(const PaintCell &c, bool useHalf, uint8_t bg,
                               const char* &glyph, uint8_t &outFg, uint8_t &outBg)
{
    if (!useHalf) {
        if (c.uOn) { glyph = "\xDB"; outFg = c.uFg; outBg = bg; }
        else       { glyph = " ";    outFg = 7;     outBg = bg; }
        return;
    }
    bool u = c.uOn, l = c.lOn;
    if (!u && !l) { glyph = " "; outFg = 7; outBg = bg; return; }
    if (u && !l)  { glyph = "\xDF"; outFg = c.uFg; outBg = bg; return; } // upper half
    if (!u && l)  { glyph = "\xDC"; outFg = c.lFg; outBg = bg; return; } // lower half
    if (c.uFg == c.lFg) { glyph = "\xDB"; outFg = c.uFg; outBg = bg; return; }
    glyph = "\xDF"; outFg = c.uFg; outBg = c.lFg; // upper fg, lower bg
}

static inline const char* mapQuarterGlyph(uint8_t mask)
{
    // mask bits: 1=TL,2=TR,4=BL,8=BR
    switch (mask & 0x0F) {
        case 0x0: return " ";
        case 0x1: return "\xE2\x96\x98"; // ▘ UL
        case 0x2: return "\xE2\x96\x9D"; // ▝ UR
        case 0x4: return "\xE2\x96\x96"; // ▖ BL
        case 0x8: return "\xE2\x96\x97"; // ▗ BR
        case 0x3: return "\xE2\x96\x80"; // ▀ upper half (UL|UR)
        case 0xC: return "\xE2\x96\x84"; // ▄ lower half (BL|BR)
        case 0x5: return "\xE2\x96\x9E"; // ▞ UL|BL (left diag)? fallback to quarter combos
        case 0xA: return "\xE2\x96\x9A"; // ▚ UR|BR (right diag)
        case 0x6: return "\xE2\x96\x9A"; // ▚ UR|BL (diag)
        case 0x9: return "\xE2\x96\x9E"; // ▞ UL|BR (diag)
        case 0x7: return "\xE2\x96\x9B"; // ▛ UL|UR|BL
        case 0xB: return "\xE2\x96\x9C"; // ▜ UL|UR|BR
        case 0xD: return "\xE2\x96\x99"; // ▙ UL|BL|BR
        case 0xE: return "\xE2\x96\x9F"; // ▟ UR|BL|BR
        case 0xF: return "\xE2\x96\x88"; // █ full block
    }
    return " ";
}

static inline const char* mapHalfXGlyph(uint8_t mask)
{
    // left pair: 0x5 (TL|BL), right pair: 0xA (TR|BR)
    mask &= 0x0F;
    if (mask == 0x0) return " ";
    if (mask == 0x5) return "\xE2\x96\x8C"; // ▌ left half block
    if (mask == 0xA) return "\xE2\x96\x90"; // ▐ right half block
    if (mask == 0xF) return "\xE2\x96\x88"; // █ full
    // single quarters or mixed: delegate to quarter mapping
    return mapQuarterGlyph(mask);
}

void TPaintCanvasView::draw()
{
    TDrawBuffer b;
    const int W = size.x;
    const int H = size.y;

    for (int y = 0; y < H; ++y) {
        int by = y;
        if (by >= rows) {
            b.moveChar(0, ' ', TColorAttr{0x07}, W);
            writeLine(0, y, W, 1, b);
            continue;
        }
        int filled = 0;
        while (filled < W) {
            int x = filled;
            if (x >= cols) {
                b.moveChar(filled, ' ', TColorAttr{0x07}, W - filled);
                break;
            }
            const auto &c = cell(x, by);
            const char* glyph; uint8_t fgc, bgc;
            if (pixelMode == PixelMode::Quarter) {
                glyph = mapQuarterGlyph(c.qMask);
                fgc = c.qFg; bgc = bg;
            } else if (pixelMode == PixelMode::HalfX) {
                glyph = mapHalfXGlyph(c.qMask);
                fgc = c.qFg; bgc = bg;
            } else {
                mapHalfCell(c, pixelMode == PixelMode::HalfY, bg, glyph, fgc, bgc);
            }
            uint8_t attr = (bgc << 4) | (fgc & 0x0F);
            TColorAttr a{attr};
            if ((state & sfFocused) && x == curX && by == curY)
                a = reverseAttribute(a);
            // Write glyph (may be multibyte UTF-8, width 1)
            b.moveStr(filled, TStringView(glyph), a);
            ++filled;
        }
        writeLine(0, y, W, 1, b);
    }
}

void TPaintCanvasView::moveCursor(int dx, int dy, bool drawWhileMoving)
{
    int nx = curX + dx;
    int ny = curY + dy;
    if (nx < 0) nx = 0; if (nx >= cols) nx = cols - 1;
    if (ny < 0) ny = 0; if (ny >= rows) ny = rows - 1;
    if (drawWhileMoving && (!ctx || ctx->tool == PaintContext::Pencil))
        put(nx, ny, true);
    curX = nx; curY = ny;
    drawView();
}

void TPaintCanvasView::toggleDraw()
{
    auto &c = cell(curX, curY);
    switch (pixelMode) {
        case PixelMode::Full: {
            bool now = !(c.uOn && c.lOn);
            c.uOn = now; c.lOn = now; c.uFg = fg; c.lFg = fg;
            break;
        }
        case PixelMode::HalfY: {
            if (ySub == 0) { c.uOn = !c.uOn; c.uFg = fg; }
            else           { c.lOn = !c.lOn; c.lFg = fg; }
            break;
        }
        case PixelMode::HalfX: {
            uint8_t bit = (xSub==0) ? (0x1|0x4) : (0x2|0x8);
            if (c.qMask & bit) c.qMask &= ~bit; else { c.qMask |= bit; c.qFg = fg; }
            break;
        }
        case PixelMode::Quarter: {
            uint8_t bit = (ySub ? 0x4 : 0x1) << xSub;
            if (c.qMask & bit) c.qMask &= ~bit; else { c.qMask |= bit; c.qFg = fg; }
            break;
        }
    }
    drawView();
}

void TPaintCanvasView::setPixelMode(PixelMode m)
{
    pixelMode = m;
    drawView();
}

void TPaintCanvasView::toggleSubpixelY() { ySub = 1 - ySub; drawView(); }
void TPaintCanvasView::toggleSubpixelX() { xSub = 1 - xSub; drawView(); }

void TPaintCanvasView::handleEvent(TEvent &ev)
{
    TView::handleEvent(ev);
    if (ev.what == evKeyDown) {
        bool shift = (ev.keyDown.controlKeyState & 0x03) != 0; // kbShift
        switch (ev.keyDown.keyCode) {
            case kbLeft:  moveCursor(-1, 0, shift); clearEvent(ev); break;
            case kbRight: moveCursor( 1, 0, shift); clearEvent(ev); break;
            case kbUp:    moveCursor( 0,-1, shift); clearEvent(ev); break;
            case kbDown:  moveCursor( 0, 1, shift); clearEvent(ev); break;
            default:
                if (ev.keyDown.charScan.charCode == ' ') { toggleDraw(); clearEvent(ev); }
                else if (ev.keyDown.keyCode == kbTab) { toggleSubpixelY(); clearEvent(ev); }
                else if (ev.keyDown.charScan.charCode == ',') { toggleSubpixelX(); clearEvent(ev); }
                break;
        }
    }
    else if (ev.what == evMouseDown) {
        TPoint m = makeLocal(ev.mouse.where);
        bool shift = (ev.mouse.eventFlags & (kbShift)) != 0;
        curX = std::max(0, std::min(cols - 1, m.x));
        curY = std::max(0, std::min(rows - 1, m.y));
        if (!ctx) {
            if (shift || (ev.mouse.buttons & mbLeftButton))
                put(curX, curY, true);
            else if (ev.mouse.buttons & mbRightButton)
                put(curX, curY, false);
        } else {
            auto tool = ctx->tool;
            if (tool == PaintContext::Pencil || tool == PaintContext::Eraser) {
                bool on = (tool == PaintContext::Pencil);
                if (ev.mouse.buttons & mbRightButton) on = false;
                if (shift || (ev.mouse.buttons & (mbLeftButton|mbRightButton)))
                    put(curX, curY, on);
            } else if (tool == PaintContext::Line || tool == PaintContext::Rect) {
                dragging = true; ax = curX; ay = curY; eraseDrag = (ev.mouse.buttons & mbRightButton);
            }
        }
        drawView();
        clearEvent(ev);
    }
    else if (ev.what == evMouseUp) {
        if (ctx && dragging) {
            bool on = !eraseDrag;
            if (ctx->tool == PaintContext::Line)
                commitLine(ax, ay, curX, curY, on);
            else if (ctx->tool == PaintContext::Rect)
                commitRect(ax, ay, curX, curY, on);
            dragging = false; drawView();
        }
        clearEvent(ev);
    }
}

void TPaintCanvasView::sizeLimits(TPoint &min, TPoint &max)
{
    TView::sizeLimits(min, max);
    min.x = 16; min.y = 6;
}

void TPaintCanvasView::setState(ushort aState, Boolean enable)
{
    TView::setState(aState, enable);
    if (aState & (sfFocused | sfActive))
        drawView();
}

void TPaintCanvasView::commitLine(int x0, int y0, int x1, int y1, bool on)
{
    int dx = abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    int dy = -abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    int err = dx + dy;
    while (true) {
        put(x0, y0, on);
        if (x0 == x1 && y0 == y1) break;
        int e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}

void TPaintCanvasView::commitRect(int x0, int y0, int x1, int y1, bool on)
{
    if (x0 > x1) std::swap(x0, x1);
    if (y0 > y1) std::swap(y0, y1);
    for (int x = x0; x <= x1; ++x) { put(x, y0, on); put(x, y1, on); }
    for (int y = y0; y <= y1; ++y) { put(x0, y, on); put(x1, y, on); }
}
