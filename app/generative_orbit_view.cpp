/*---------------------------------------------------------*/
/*                                                         */
/*   generative_orbit_view.cpp - Orbit Field (Generative) */
/*                                                         */
/*   Radial interference patterns from rotating sources.  */
/*   Full-window evolving colour bands and ripples.       */
/*                                                         */
/*---------------------------------------------------------*/

#include "generative_orbit_view.h"
#include "notitle_frame.h"

#define Uses_TWindow
#define Uses_TFrame
#include <tvision/tv.h>

#include <vector>
#include <cmath>
#include <algorithm>

namespace {
struct RGB { float r,g,b; };
static inline float clampf(float x, float a=0.f, float b=1.f){ return std::max(a, std::min(b, x)); }
static inline float mixf(float a,float b,float t){ return a + (b-a)*t; }
static inline RGB mix(const RGB &a, const RGB &b, float t){ return {mixf(a.r,b.r,t), mixf(a.g,b.g,t), mixf(a.b,b.b,t)}; }
static inline float fract(float x){ return x - std::floor(x); }

// Palettes (warm/cold/mono)
static const RGB kP[][5] = {
    { {0.05f,0.03f,0.02f}, {0.35f,0.15f,0.05f}, {0.80f,0.30f,0.10f}, {0.98f,0.65f,0.25f}, {1.00f,0.92f,0.70f} },
    { {0.01f,0.03f,0.05f}, {0.08f,0.20f,0.35f}, {0.15f,0.45f,0.70f}, {0.50f,0.80f,0.95f}, {0.92f,0.98f,1.00f} },
    { {0.04f,0.04f,0.04f}, {0.20f,0.20f,0.22f}, {0.45f,0.45f,0.50f}, {0.75f,0.75f,0.78f}, {0.95f,0.95f,0.96f} },
};

static inline RGB samplePal(int idx, float t){
    int n = 5; t = clampf(t); float x = t*(n-1); int i=(int)std::floor(x); int j=std::min(n-1,i+1); float f=x-i;
    const RGB *p = kP[idx%3]; return mix(p[i], p[j], f);
}

static const char* kSh = " .:-=+*#%@";
static inline char sh(float v){ v = clampf(v); int i = std::min(9, std::max(0, (int)std::floor(v*9.999f))); return kSh[i]; }

} // namespace

TGenerativeOrbitView::TGenerativeOrbitView(const TRect &bounds, unsigned periodMs)
    : TView(bounds), periodMs(periodMs)
{
    options |= ofSelectable;
    growMode = gfGrowAll;
    eventMask |= evBroadcast | evKeyboard;
}

TGenerativeOrbitView::~TGenerativeOrbitView(){ stopTimer(); }
void TGenerativeOrbitView::startTimer(){ if (!timerId) timerId = setTimer(periodMs, (int)periodMs); }
void TGenerativeOrbitView::stopTimer(){ if (timerId){ killTimer(timerId); timerId = 0; } }
void TGenerativeOrbitView::advance(){ ++frame; }
void TGenerativeOrbitView::nextPalette(int dir){ paletteIndex = (paletteIndex + (dir>0?1:2)) % 3; }

void TGenerativeOrbitView::draw()
{
    int W=size.x, H=size.y; if (W<=0||H<=0) return;
    std::vector<TScreenCell> row; row.resize((size_t)W);
    float t = frame * 0.03f;
    float cx = (W-1)*0.5f, cy=(H-1)*0.5f; float invW = W? 1.f/W:1.f, invH = H? 1.f/H:1.f;

    // Three rotating sources
    float R = 0.6f; // normalised radius in view-space
    float a0 = t*0.7f, a1 = t*1.1f + 2.1f, a2 = -t*0.9f + 4.2f;
    float sx0 = std::cos(a0)*R, sy0 = std::sin(a0)*R;
    float sx1 = std::cos(a1)*R*0.7f, sy1 = std::sin(a1)*R*0.7f;
    float sx2 = std::cos(a2)*R*1.2f, sy2 = std::sin(a2)*R*1.2f;

    for (int y=0;y<H;++y){
        for (int x=0;x<W;++x){
            float u = (x - cx)*invW*2.f, v=(y - cy)*invH*2.f;
            float d0 = std::sqrt((u-sx0)*(u-sx0) + (v-sy0)*(v-sy0));
            float d1 = std::sqrt((u-sx1)*(u-sx1) + (v-sy1)*(v-sy1));
            float d2 = std::sqrt((u-sx2)*(u-sx2) + (v-sy2)*(v-sy2));

            // Interference banding + soft radial falloff
            float f = 0.5f + 0.5f*std::sin(10.0f*d0 - t*2.0f)
                    + 0.35f*std::sin(12.0f*d1 + t*1.7f)
                    + 0.25f*std::sin(14.0f*d2 - t*1.2f);
            f = f/1.1f; // normalise
            float fall = std::exp(-2.5f*(u*u+v*v));
            float val = clampf( f*0.6f + fall*0.6f );

            float hueT = fract(val*0.5f + std::sin(t*0.21f + (u*u+v*v)*1.6f)*0.15f);
            RGB c = samplePal(paletteIndex, hueT);
            float luma = clampf(0.2126f*c.r + 0.7152f*c.g + 0.0722f*c.b);
            char ch = sh( val*0.65f + luma*0.35f );

            auto to8=[&](float x)->uchar{ int v=(int)std::round(clampf(x)*255.f); return (uchar)std::max(0,std::min(255,v)); };
            TColorRGB fg(to8(c.r), to8(c.g), to8(c.b));
            float bgk = 0.06f + 0.18f*(u*u+v*v);
            TColorRGB bg(to8(bgk), to8(bgk*0.95f), to8(bgk*0.9f));
            ::setCell(row[(size_t)x], ch, TColorAttr(fg,bg));
        }
        writeLine(0,y,W,1,row.data());
    }
}

void TGenerativeOrbitView::handleEvent(TEvent &ev)
{
    TView::handleEvent(ev);
    if (ev.what==evBroadcast && ev.message.command==cmTimerExpired){
        if (timerId!=0 && ev.message.infoPtr==timerId){ advance(); drawView(); clearEvent(ev);} }
    else if (ev.what==evKeyDown){
        char ch=ev.keyDown.charScan.charCode; bool handled=false;
        switch(ch){
            case ' ': if (timerId) stopTimer(); else startTimer(); handled=true; break;
            case 'p': case 'P': nextPalette(+1); handled=true; break;
            case 'o': case 'O': nextPalette(-1); handled=true; break;
            default: break;
        }
        if (handled){ drawView(); clearEvent(ev);}    
    }
}

void TGenerativeOrbitView::setState(ushort aState, Boolean enable){
    TView::setState(aState, enable);
    if ((aState & sfExposed)!=0){ if (enable){ frame=0; startTimer(); drawView(); } else stopTimer(); }
}

void TGenerativeOrbitView::changeBounds(const TRect& b){ TView::changeBounds(b); drawView(); }

class TGenerativeOrbitWindow : public TWindow {
public:
    explicit TGenerativeOrbitWindow(const TRect &r)
        : TWindow(r, "", wnNoNumber)
        , TWindowInit(&TGenerativeOrbitWindow::initFrame) {}
    void setup(unsigned ms){ options |= ofTileable; TRect c=getExtent(); c.grow(-1,-1); insert(new TGenerativeOrbitView(c, ms)); }
    virtual void changeBounds(const TRect& b) override { TWindow::changeBounds(b); setState(sfExposed, True); redraw(); }
private: static TFrame* initFrame(TRect r){ return new TNoTitleFrame(r);} };

TWindow* createGenerativeOrbitWindow(const TRect &bounds){ auto *w=new TGenerativeOrbitWindow(bounds); w->setup(50); return w; }

