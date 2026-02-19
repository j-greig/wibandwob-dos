/*---------------------------------------------------------*/
/*                                                         */
/*   paint_window.h - Paint canvas TWindow wrapper         */
/*                                                         */
/*   Embeds TPaintCanvasView + tools + palette + status    */
/*   as a framed, moveable, tileable window for the main   */
/*   WibWob-DOS app.                                       */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TVISION_PAINT_WINDOW_H
#define TVISION_PAINT_WINDOW_H

#define Uses_TWindow
#define Uses_TRect
#define Uses_TFrame
#include <tvision/tv.h>

#include "paint_canvas.h"

class TPaintCanvasView;

class TPaintWindow : public TWindow {
public:
    TPaintWindow(const TRect &bounds);

    TPaintCanvasView* getCanvas() const { return canvas; }

private:
    static TFrame *initFrame(TRect r) { return new TFrame(r); }
    PaintContext ctx;
    TPaintCanvasView *canvas = nullptr;
};

TWindow* createPaintWindow(const TRect &bounds);

#endif
