/*---------------------------------------------------------*/
/*                                                         */
/*   paint_app.cpp - Minimal TVision paint app (MVP)       */
/*                                                         */
/*---------------------------------------------------------*/

#define Uses_TApplication
#define Uses_TWindow
#define Uses_TRect
#define Uses_TFrame
#define Uses_TDeskTop
#define Uses_TMenuBar
#define Uses_TMenu
#define Uses_TSubMenu
#define Uses_TMenuItem
#define Uses_TStatusLine
#define Uses_TStatusDef
#define Uses_TStatusItem
#define Uses_TKeys
#define Uses_MsgBox
#define Uses_TDialog
#define Uses_TInputLine
#define Uses_TLabel
#define Uses_TButton
#include <tvision/tv.h>

#include "paint_canvas.h"
#include "paint_status.h"
#include "paint_tools.h"
#include "paint_palette.h"

class PaintWindow : public TWindow {
public:
    PaintWindow(const TRect &bounds, const char *title)
        : TWindow(bounds, title, wnNoNumber), TWindowInit(&PaintWindow::initFrame)
    {
        options |= ofTileable;
        TRect client = getExtent(); client.grow(-1, -1);
        // Side tools panel and right palette
        int toolsW = 16;
        int palW = 20;
        TRect toolsRect(client.a.x, client.a.y, std::min(client.a.x+toolsW, client.b.x), client.b.y-1);
        auto toolPanel = new TPaintToolPanel(toolsRect, &ctx);
        insert(toolPanel);
        TRect palRect(std::max(client.b.x - palW, toolsRect.b.x), client.a.y, client.b.x, client.b.y-1);
        // Canvas occupies center
        TRect canvasRect(toolsRect.b.x, client.a.y, palRect.a.x, client.b.y-1);
        TPaintCanvasView *canvas = new TPaintCanvasView(canvasRect, canvasRect.b.x - canvasRect.a.x, canvasRect.b.y - canvasRect.a.y, &ctx);
        insert(canvas);
        insert(new TPaintPaletteView(palRect, canvas));
        TPaintStatusView *status = new TPaintStatusView(TRect(client.a.x, client.b.y-1, client.b.x, client.b.y), canvas);
        insert(status);
        canvas->select();
    }
private:
    static TFrame *initFrame(TRect r) { return new TFrame(r); }
    PaintContext ctx;
};

class PaintApp : public TApplication {
public:
    PaintApp() : TProgInit(&PaintApp::initStatusLine, &PaintApp::initMenuBar, &PaintApp::initDeskTop) {}

    static TStatusLine *initStatusLine(TRect r) {
        r.a.y = r.b.y - 1;
        return new TStatusLine(r,
            *new TStatusDef(0, 0xFFFF) +
            *new TStatusItem("~F10~ Menu", kbF10, cmMenu) +
            *new TStatusItem("~Alt-X~ Exit", kbAltX, cmQuit)
        );
    }
    static TMenuBar *initMenuBar(TRect r) {
        r.b.y = r.a.y + 1;
        return new TMenuBar(r,
            *new TSubMenu("~F~ile", kbAltF) +
                *new TMenuItem("~N~ew", cmNew, kbCtrlN) +
                *new TMenuItem("E~x~it", cmQuit, kbAltX, hcNoContext, "Alt-X")
            + *new TSubMenu("~T~ools", kbAltT)
                + *new TMenuItem("Tool: ~P~encil", 2201, kbCtrlP)
                + *new TMenuItem("Tool: ~E~raser", 2202, kbCtrlE)
                + *new TMenuItem("Tool: ~L~ine", 2203, kbCtrlL)
                + *new TMenuItem("Tool: ~R~ect", 2204, kbCtrlR)
                + *new TMenuItem("Mode: ~F~ull", 2301, kbNoKey)
                + *new TMenuItem("Mode: Half ~Y~", 2302, kbNoKey)
                + *new TMenuItem("Mode: Half ~X~", 2303, kbNoKey)
                + *new TMenuItem("Mode: ~Q~uarter", 2304, kbNoKey)
                + *new TMenuItem("Toggle Subpixel ~Y~ (Tab)", 2311, kbTab)
                + *new TMenuItem("Toggle Subpixel ~X~ (,)\t,", 2312, kbNoKey)
            + *new TSubMenu("~C~olor", kbAltC)
                + *new TMenuItem("Set ~F~oreground", 2101, kbNoKey)
                + *new TMenuItem("Set ~B~ackground", 2102, kbNoKey)
                + *new TMenuItem("S~w~ap FG/BG", 2103, kbNoKey)
        );
    }
    static TDeskTop *initDeskTop(TRect r) { return new TDeskTop(r); }

    virtual void handleEvent(TEvent &ev) override {
        TApplication::handleEvent(ev);
        if (ev.what == evCommand) {
            switch (ev.message.command) {
                case cmNew: {
                    TRect r(2, 1, 82, 26);
                    PaintWindow *w = new PaintWindow(r, "Paint");
                    deskTop->insert(w);
                    clearEvent(ev);
                    break;
                }
                case 2201: // Pencil
                case 2202: // Eraser
                case 2203: // Line
                case 2204: // Rect
                {
                    // Try to set the tool on current canvas
                    if (auto *cv = dynamic_cast<TPaintCanvasView*>(deskTop->current)) {
                        switch (ev.message.command) {
                            case 2201: cv->setTool(PaintContext::Pencil); break;
                            case 2202: cv->setTool(PaintContext::Eraser); break;
                            case 2203: cv->setTool(PaintContext::Line); break;
                            case 2204: cv->setTool(PaintContext::Rect); break;
                        }
                    }
                    clearEvent(ev); break;
                }
                case 2301: case 2302: case 2303: case 2304: {
                    TView *cur = deskTop->current;
                    if (auto *cv = dynamic_cast<TPaintCanvasView*>(cur)) {
                        if (ev.message.command == 2301) cv->setPixelMode(PixelMode::Full);
                        if (ev.message.command == 2302) cv->setPixelMode(PixelMode::HalfY);
                        if (ev.message.command == 2303) cv->setPixelMode(PixelMode::HalfX);
                        if (ev.message.command == 2304) cv->setPixelMode(PixelMode::Quarter);
                    }
                    clearEvent(ev);
                    break;
                }
                case 2311: {
                    if (auto *cv = dynamic_cast<TPaintCanvasView*>(deskTop->current)) cv->toggleSubpixelY();
                    clearEvent(ev); break;
                }
                case 2312: {
                    if (auto *cv = dynamic_cast<TPaintCanvasView*>(deskTop->current)) cv->toggleSubpixelX();
                    clearEvent(ev); break;
                }
                case 2101: 
                case 2102: {
                    TDialog *d = new TDialog(TRect(0,0,30,7), ev.message.command==2101?"Foreground":"Background");
                    d->options |= ofCentered;
                    TInputLine *in = new TInputLine(TRect(3,3,27,4), 3);
                    d->insert(in);
                    d->insert(new TLabel(TRect(3,2,20,3), "Color 0..15:", in));
                    d->insert(new TButton(TRect(6,5,16,6), "~O~K", cmOK, bfDefault));
                    d->insert(new TButton(TRect(18,5,28,6), "Cancel", cmCancel, bfNormal));
                    char buf[4] = {0};
                    ushort res = deskTop->execView(d);
                    if (res != cmCancel) {
                        in->getData(buf);
                        int val = atoi(buf);
                        if (val >= 0 && val <= 15) {
                            if (auto *cv = dynamic_cast<TPaintCanvasView*>(deskTop->current)) {
                                if (ev.message.command==2101) cv->setFg((uint8_t)val); else cv->setBg((uint8_t)val);
                                cv->drawView();
                            }
                        }
                    }
                    destroy(d);
                    clearEvent(ev);
                    break;
                }
                case 2103: {
                    if (auto *cv = dynamic_cast<TPaintCanvasView*>(deskTop->current)) {
                        uint8_t f=cv->getFg(), b=cv->getBg();
                        cv->setFg(b); cv->setBg(f); cv->drawView();
                    }
                    clearEvent(ev);
                    break;
                }
                default: break;
            }
        }
    }
};

int main() {
    PaintApp app;
    // Open initial window
    TRect r(2, 1, 82, 26);
    PaintWindow *w = new PaintWindow(r, "Paint");
    app.deskTop->insert(w);
    app.run();
    return 0;
}
