/*---------------------------------------------------------*/
/*                                                         */
/*   paint_status.h - Status view for paint canvas         */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TVISION_PAINT_STATUS_H
#define TVISION_PAINT_STATUS_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>

class TPaintCanvasView;

class TPaintStatusView : public TView {
public:
    TPaintStatusView(const TRect &r, TPaintCanvasView *canvas) : TView(r), canvas(canvas) {
        options |= ofPreProcess;
        growMode = gfGrowHiX | gfGrowLoY | gfGrowHiY;
    }
    virtual void draw() override;
    void setCanvas(TPaintCanvasView *c) { canvas = c; }
private:
    TPaintCanvasView *canvas;
};

#endif
