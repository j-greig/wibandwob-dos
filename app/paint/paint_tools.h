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
    TPaintToolPanel(const TRect &r, PaintContext *ctx) : TView(r), ctx(ctx) {
        options |= ofFramed | ofPreProcess | ofSelectable;
        eventMask |= evMouseDown | evMouseMove | evKeyboard;
    }

    virtual void draw() override {
        TDrawBuffer b;
        TColorAttr cFrame{0x07};
        b.moveChar(0, ' ', cFrame, size.x);
        b.moveStr(1, "Tools", cFrame);
        writeLine(0, 0, size.x, 1, b);
        const char* items[4] = {"P Pencil", "E Eraser", "L Line", "R Rect"};
        for (int i = 0; i < 4; ++i) {
            b.moveChar(0, ' ', cFrame, size.x);
            bool sel = ctx && ((ctx->tool == PaintContext::Pencil && i==0) ||
                               (ctx->tool == PaintContext::Eraser && i==1) ||
                               (ctx->tool == PaintContext::Line   && i==2) ||
                               (ctx->tool == PaintContext::Rect   && i==3));
            TColorAttr col = sel ? reverseAttribute(cFrame) : cFrame;
            b.moveStr(1, items[i], col);
            writeLine(0, i+1, size.x, 1, b);
        }
        // Hints
        b.moveChar(0, ' ', cFrame, size.x);
        b.moveStr(1, "[Tab] Y-sub, [,] X-sub", cFrame);
        writeLine(0, 5, size.x, 1, b);
    }

    virtual void handleEvent(TEvent &ev) override {
        TView::handleEvent(ev);
        if (!ctx) return;
        if (ev.what == evMouseDown) {
            TPoint p = makeLocal(ev.mouse.where);
            int row = p.y - 1;
            if (row >= 0 && row < 4) {
                switch (row) {
                    case 0: ctx->tool = PaintContext::Pencil; break;
                    case 1: ctx->tool = PaintContext::Eraser; break;
                    case 2: ctx->tool = PaintContext::Line; break;
                    case 3: ctx->tool = PaintContext::Rect; break;
                }
                drawView();
            }
            clearEvent(ev);
        } else if (ev.what == evKeyDown) {
            int ch = ev.keyDown.charScan.charCode;
            if (ch=='p' || ch=='P') ctx->tool = PaintContext::Pencil;
            else if (ch=='e' || ch=='E') ctx->tool = PaintContext::Eraser;
            else if (ch=='l' || ch=='L') ctx->tool = PaintContext::Line;
            else if (ch=='r' || ch=='R') ctx->tool = PaintContext::Rect;
            else return;
            drawView();
            clearEvent(ev);
        }
    }

    virtual void sizeLimits(TPoint &min, TPoint &max) override {
        TView::sizeLimits(min, max);
        min.x = 12; min.y = 6;
    }

private:
    PaintContext *ctx;
};

#endif
