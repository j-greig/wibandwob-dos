/*---------------------------------------------------------*/
/*                                                         */
/*   paint_window.cpp - Paint canvas TWindow wrapper       */
/*                                                         */
/*---------------------------------------------------------*/

#include "paint_window.h"
#include "paint_canvas.h"
#include "paint_tools.h"
#include "paint_palette.h"
#include "paint_status.h"

#include <algorithm>

TPaintWindow::TPaintWindow(const TRect &bounds)
    : TWindow(bounds, "Paint", wnNoNumber), TWindowInit(&TPaintWindow::initFrame)
{
    options |= ofTileable;

    TRect client = getExtent();
    client.grow(-1, -1);

    // Layout: tools (left, w=16) | canvas (center) | palette (right, w=20) | status (bottom, h=1)
    int toolsW = 16;
    int palW = 20;

    TRect toolsRect(client.a.x, client.a.y,
                     std::min(client.a.x + toolsW, client.b.x), client.b.y - 1);
    auto *toolPanel = new TPaintToolPanel(toolsRect, &ctx);
    insert(toolPanel);

    TRect palRect(std::max(client.b.x - palW, toolsRect.b.x), client.a.y,
                   client.b.x, client.b.y - 1);

    // Canvas occupies center
    TRect canvasRect(toolsRect.b.x, client.a.y, palRect.a.x, client.b.y - 1);
    int cw = canvasRect.b.x - canvasRect.a.x;
    int ch = canvasRect.b.y - canvasRect.a.y;
    canvas = new TPaintCanvasView(canvasRect, cw, ch, &ctx);
    insert(canvas);

    insert(new TPaintPaletteView(palRect, canvas));

    auto *status = new TPaintStatusView(
        TRect(client.a.x, client.b.y - 1, client.b.x, client.b.y), canvas);
    insert(status);

    canvas->select();
}

TWindow* createPaintWindow(const TRect &bounds)
{
    return new TPaintWindow(bounds);
}
