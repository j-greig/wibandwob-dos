/*---------------------------------------------------------*/
/*                                                         */
/*   paint_status.cpp - Status view for paint canvas       */
/*                                                         */
/*---------------------------------------------------------*/

#include "paint_status.h"
#include "paint_canvas.h"

void TPaintStatusView::draw()
{
    TDrawBuffer b;
    TColorAttr a{0x07}; // light gray on black default
    b.moveChar(0, ' ', a, size.x);
    if (canvas) {
        char buf[128];
        const char *mode;
        switch (canvas->getPixelMode()) {
            case PixelMode::Full:   mode = "F"; break;
            case PixelMode::HalfY:  mode = canvas->getYSub() ? "HY:L" : "HY:U"; break;
            case PixelMode::HalfX:  mode = canvas->getXSub() ? "HX:R" : "HX:L"; break;
            case PixelMode::Quarter: {
                static char m[8];
                snprintf(m, sizeof(m), "Q:%d%d", canvas->getXSub(), canvas->getYSub());
                mode = m; break;
            }
            case PixelMode::Text:   mode = "TXT"; break;
        }
        int x = canvas->getX();
        int y = canvas->getY();
        int fg = canvas->getFg();
        int bg = canvas->getBg();
        const char *tool = "P";
        if (canvas->getContext()) {
            switch (canvas->getContext()->tool) {
                case PaintContext::Pencil: tool = "P"; break;
                case PaintContext::Eraser: tool = "E"; break;
                case PaintContext::Line:   tool = "L"; break;
                case PaintContext::Rect:   tool = "R"; break;
                case PaintContext::Text:   tool = "T"; break;
            }
        }
        snprintf(buf, sizeof(buf), "x:%d y:%d mode:%s tool:%s FG:%d BG:%d", x, y, mode, tool, fg, bg);
        b.moveStr(1, buf, a);
    }
    writeLine(0, 0, size.x, 1, b);
}
