/*---------------------------------------------------------*/
/*                                                         */
/*   paint_tools.h - Side tool palette (MVP)               */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TVISION_PAINT_TOOLS_H
#define TVISION_PAINT_TOOLS_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TRect
#include <tvision/tv.h>

#include "paint_canvas.h"

class TPaintToolPanel : public TView {
public:
    TPaintToolPanel(const TRect &r, PaintContext *ctx, TPaintCanvasView *cv = nullptr)
        : TView(r), ctx(ctx), canvas(cv) {
        options |= ofFramed | ofPreProcess | ofSelectable;
        growMode = gfGrowHiY;
        eventMask |= evMouseDown | evMouseMove | evKeyboard;
    }

    virtual void draw() override {
        TDrawBuffer b;
        TColorAttr cFrame{0x07};
        b.moveChar(0, ' ', cFrame, size.x);
        b.moveStr(1, "Tools", cFrame);
        writeLine(0, 0, size.x, 1, b);
        const char* items[5] = {"P Pencil", "E Eraser", "L Line", "R Rect", "T Text"};
        for (int i = 0; i < 5; ++i) {
            b.moveChar(0, ' ', cFrame, size.x);
            bool sel = ctx && ((ctx->tool == PaintContext::Pencil && i==0) ||
                               (ctx->tool == PaintContext::Eraser && i==1) ||
                               (ctx->tool == PaintContext::Line   && i==2) ||
                               (ctx->tool == PaintContext::Rect   && i==3) ||
                               (ctx->tool == PaintContext::Text   && i==4));
            TColorAttr col = sel ? reverseAttribute(cFrame) : cFrame;
            b.moveStr(1, items[i], col);
            writeLine(0, i+1, size.x, 1, b);
        }
        // Hints
        b.moveChar(0, ' ', cFrame, size.x);
        b.moveStr(1, "[Tab] Y-sub, [,] X-sub", cFrame);
        writeLine(0, 6, size.x, 1, b);
        // Clear remaining rows
        for (int y = 7; y < size.y; ++y) {
            b.moveChar(0, ' ', cFrame, size.x);
            writeLine(0, y, size.x, 1, b);
        }
    }

    virtual void handleEvent(TEvent &ev) override {
        TView::handleEvent(ev);
        if (!ctx) return;
        if (ev.what == evMouseDown) {
            TPoint p = makeLocal(ev.mouse.where);
            int row = p.y - 1;
            if (row >= 0 && row < 5) {
                switch (row) {
                    case 0: ctx->tool = PaintContext::Pencil; break;
                    case 1: ctx->tool = PaintContext::Eraser; break;
                    case 2: ctx->tool = PaintContext::Line; break;
                    case 3: ctx->tool = PaintContext::Rect; break;
                    case 4: ctx->tool = PaintContext::Text; break;
                }
                drawView();
                if (canvas) { canvas->refreshStatus(); canvas->select(); }
            }
            clearEvent(ev);
        } else if (ev.what == evKeyDown) {
            // When Text tool is active, don't intercept printable keys — let them
            // pass through to the canvas for text entry. Only switch tools via
            // keyboard when a non-Text tool is active.
            if (ctx->tool == PaintContext::Text) return;
            int ch = ev.keyDown.charScan.charCode;
            if (ch=='p' || ch=='P') ctx->tool = PaintContext::Pencil;
            else if (ch=='e' || ch=='E') ctx->tool = PaintContext::Eraser;
            else if (ch=='l' || ch=='L') ctx->tool = PaintContext::Line;
            else if (ch=='r' || ch=='R') ctx->tool = PaintContext::Rect;
            else if (ch=='t' || ch=='T') ctx->tool = PaintContext::Text;
            else return;
            drawView();
            if (canvas) canvas->refreshStatus();
            clearEvent(ev);
        }
    }

    virtual void sizeLimits(TPoint &min, TPoint &max) override {
        TView::sizeLimits(min, max);
        min.x = 12; min.y = 6;
    }

private:
    PaintContext *ctx;
    TPaintCanvasView *canvas;
};

#endif
