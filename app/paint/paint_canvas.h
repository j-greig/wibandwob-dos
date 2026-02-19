/*---------------------------------------------------------*/
/*                                                         */
/*   paint_canvas.h - Simple paint canvas view (MVP)       */
/*                                                         */
/*   TL;DR                                                 */
/*   - TPaintCanvasView is a TView that owns a 2D cell     */
/*     buffer {ch, fg, bg} and draws it row-wise using     */
/*     TDrawBuffer + writeLine.                            */
/*   - Keyboard: arrows move cursor, Space draws,          */
/*     Shift+arrows draws while moving.                    */
/*   - Colors: 16-color BIOS indices for fg/bg.            */
/*   - Intended for MVP; extend with tools later.          */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TVISION_PAINT_CANVAS_H
#define TVISION_PAINT_CANVAS_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#define Uses_TKeys
#include <tvision/tv.h>

#include <string>
#include <vector>

struct PaintContext {
    enum Tool { Pencil, Eraser, Line, Rect, Text } tool = Pencil;
};

enum class PixelMode { Full, HalfY, HalfX, Quarter, Text };

struct PaintCell {
    // HalfY data (supports two-color mix via FG/BG trick)
    bool uOn; uint8_t uFg; // upper half
    bool lOn; uint8_t lFg; // lower half
    // Quarter/HalfX data (single ink color for all subpixels)
    uint8_t qMask;  // bit 0=TL, 1=TR, 2=BL, 3=BR
    uint8_t qFg;    // ink color when drawing quarter/halfx
    // Text mode data
    char textChar;     // 0 = empty/transparent
    uint8_t textFg;    // text foreground color
    uint8_t textBg;    // text background color
};

class TPaintCanvasView : public TView {
public:
    TPaintCanvasView(const TRect &bounds, int cols, int rows, PaintContext *ctx);

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void changeBounds(const TRect &bounds) override;
    virtual void sizeLimits(TPoint &min, TPoint &max) override;
    virtual void setState(ushort aState, Boolean enable) override;

    void clear();
    void setPixelMode(PixelMode m);
    PixelMode getPixelMode() const { return pixelMode; }
    void setHalfMode(bool on) { setPixelMode(on ? PixelMode::HalfY : PixelMode::Full); }
    bool isHalfMode() const { return pixelMode == PixelMode::HalfY; }
    void toggleSubpixelY();
    void toggleSubpixelX();
    void setFg(uint8_t c) { fg = (c & 0x0F); }
    void setBg(uint8_t c) { bg = (c & 0x0F); }
    uint8_t getFg() const { return fg; }
    uint8_t getBg() const { return bg; }
    int getX() const { return curX; }
    int getY() const { return curY; }
    int getYSub() const { return ySub; }
    int getXSub() const { return xSub; }
    PaintContext* getContext() const { return ctx; }
    void setTool(PaintContext::Tool t) { if (ctx) ctx->tool = t; }
    void setStatusView(TView *v) { statusView = v; }
    void refreshStatus() { if (statusView) statusView->drawView(); }

    // Public API for IPC control
    void putCell(int x, int y, uint8_t fgColor, uint8_t bgColor);
    void putText(int x, int y, const std::string& text, uint8_t fgColor, uint8_t bgColor);
    void putLine(int x0, int y0, int x1, int y1, bool erase = false);
    void putRect(int x0, int y0, int x1, int y1, bool erase = false);
    std::string exportText() const;
    int getCols() const { return cols; }
    int getRows() const { return rows; }

private:
    int cols, rows;
    PaintContext *ctx;
    std::vector<PaintCell> buffer;
    int curX = 0, curY = 0;
    int ySub = 0; // 0=upper, 1=lower for HalfY/Quarter
    int xSub = 0; // 0=left,  1=right for HalfX/Quarter
    PixelMode pixelMode = PixelMode::Full;
    uint8_t fg = 15; // white ink
    uint8_t bg = 0;  // black background (empty)
    TView *statusView = nullptr;

    void put(int x, int y, bool on);
    PaintCell &cell(int x, int y);
    void moveCursor(int dx, int dy, bool drawWhileMoving);
    void toggleDraw();
    void mapCellToDraw(int x, int y, const char* &glyph, uint8_t &outFg, uint8_t &outBg) const;

    // Tool helpers
    bool dragging = false; int ax = 0, ay = 0; bool eraseDrag = false;
    void commitLine(int x0, int y0, int x1, int y1, bool on);
    void commitRect(int x0, int y0, int x1, int y1, bool on);
};

#endif
