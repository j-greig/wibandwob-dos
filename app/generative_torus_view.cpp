/*---------------------------------------------------------*/
/*                                                         */
/*   generative_torus_view.cpp - Torus Field (Generative) */
/*                                                         */
/*   Animated ASCII donut with z-buffer shading and       */
/*   palette colouring. Inspired by a1k0n donut math.     */
/*                                                         */
/*---------------------------------------------------------*/

#include "generative_torus_view.h"
#include "notitle_frame.h"

#define Uses_TWindow
#define Uses_TFrame
#include <tvision/tv.h>

#include <vector>
#include <cmath>
#include <algorithm>

namespace {
static const char* kShade = ".,-~:;=!*#$@"; // 12 levels
struct RGB{ float r,g,b; };
static inline float clampf(float x,float a=0.f,float b=1.f){ return std::max(a,std::min(b,x)); }
static inline float mixf(float a,float b,float t){ return a + (b-a)*t; }
static inline RGB mix(const RGB&a,const RGB&b,float t){ return {mixf(a.r,b.r,t),mixf(a.g,b.g,t),mixf(a.b,b.b,t)}; }

static const RGB kPal[][5] = {
    { {0.03f,0.04f,0.06f},{0.12f,0.18f,0.28f},{0.24f,0.42f,0.64f},{0.70f,0.84f,0.95f},{0.98f,0.99f,1.00f} }, // deep blue to ice
    { {0.06f,0.03f,0.02f},{0.30f,0.14f,0.06f},{0.70f,0.28f,0.10f},{0.95f,0.60f,0.25f},{1.00f,0.92f,0.70f} }, // amber
    { {0.02f,0.04f,0.02f},{0.08f,0.20f,0.10f},{0.20f,0.46f,0.30f},{0.60f,0.80f,0.65f},{0.95f,0.98f,0.96f} }, // teal green
};

static inline RGB pal(int idx, float t){ int n=5; t=clampf(t); float x=t*(n-1); int i=(int)std::floor(x); int j=std::min(n-1,i+1); float f=x-i; return mix(kPal[idx%3][i], kPal[idx%3][j], f);} 

} // namespace

TGenerativeTorusView::TGenerativeTorusView(const TRect &b,unsigned ms):TView(b),periodMs(ms){ options|=ofSelectable; growMode=gfGrowAll; eventMask|=evBroadcast|evKeyboard; }
TGenerativeTorusView::~TGenerativeTorusView(){ stopTimer(); }
void TGenerativeTorusView::startTimer(){ if(!timerId) timerId=setTimer(periodMs,(int)periodMs);}    
void TGenerativeTorusView::stopTimer(){ if(timerId){ killTimer(timerId); timerId=0; }}
void TGenerativeTorusView::advance(){ ++frame; aRot += 0.06f; bRot += 0.035f; }

void TGenerativeTorusView::draw()
{
    int W=size.x, H=size.y; if (W<=0||H<=0) return;
    std::vector<TScreenCell> screen; screen.resize((size_t)W*(size_t)H);
    std::vector<float> zbuf; zbuf.assign((size_t)W*(size_t)H, -1e9f);

    // Pre-clear: dark background
    for (int y=0;y<H;++y){
        for (int x=0;x<W;++x){
            TColorRGB bg(5,5,6); // very dark
            TColorRGB fg(180,180,190);
            ::setCell(screen[(size_t)y*W + x], ' ', TColorAttr(fg,bg));
        }
    }

    // Donut parameters
    float R1 = 1.0f;   // tube radius
    float R2 = 2.0f;   // center radius
    float K2 = 5.0f;   // distance from viewer

    // Derived projection constant (fit to window height)
    // Global projection scale from member (live-adjustable).
    float K1 = (float)W * K2 * 0.5f * scale;

    // Rotation angles
    float A = aRot, B = bRot;
    float cosA=std::cos(A), sinA=std::sin(A);
    float cosB=std::cos(B), sinB=std::sin(B);

    // Step sizes tuned for speed/quality. Increase for denser donut.
    for (float theta = 0.f; theta < 6.28318f; theta += 0.07f) { // around tube
        float cost = std::cos(theta), sint = std::sin(theta);
        for (float phi = 0.f; phi < 6.28318f; phi += 0.02f) {  // around center
            float cosp = std::cos(phi), sinp = std::sin(phi);

            // 3D coordinates after rotation
            float circlex = R2 + R1 * cost;
            float circley = R1 * sint;

            // Final 3D point (x,y,z)
            float x = circlex * (cosB * cosp + sinA * sinB * sinp) - circley * cosA * sinB;
            float y = circlex * (sinB * cosp - sinA * cosB * sinp) + circley * cosA * cosB;
            float z = cosA * circlex * sinp + circley * sinA;

            float ooz = 1.0f / (z + K2); // 1/z
            int xp = (int)(W / 2 + K1 * ooz * x);
            int yp = (int)(H / 2 + K1 * ooz * y * yStretch);
            if (xp < 0 || xp >= W || yp < 0 || yp >= H) continue;

            // Compute luminance (surface normal dot light)
            float nx = cosp * cost - cosp; // approximate normal components
            float ny = sinp * cost - sinp;
            float nz = sint;
            float L = nx * 0.0f + ny * 1.0f + nz * 0.5f; // light direction biased to y/z
            L = (L + 1.0f) * 0.5f; // map to 0..1
            L = clampf(L);

            size_t idx = (size_t)yp * W + xp;
            if (ooz > zbuf[idx]) {
                zbuf[idx] = ooz;
                int shadeIdx = std::min(11, std::max(0, (int)std::floor(L * 11.999f)));
                char ch = kShade[shadeIdx];

                // Colour by angle and luminance via palette
                float hueT = std::fmod((theta * 0.08f + phi * 0.05f + L * 0.2f), 1.0f);
                if (hueT < 0) hueT += 1.0f;
                RGB c = pal(paletteIndex, hueT);
                auto to8=[&](float v)->uchar{ int q=(int)std::round(clampf(v)*255.f); return (uchar)std::max(0,std::min(255,q)); };
                TColorRGB fg(to8(c.r), to8(c.g), to8(c.b));
                // Background darker for depth
                TColorRGB bg( (uchar)8, (uchar)8, (uchar)10 );
                ::setCell(screen[idx], ch, TColorAttr(fg,bg));
            }
        }
    }

    // Write screen buffer rows
    for (int y=0;y<H;++y) writeLine(0,y,W,1,&screen[(size_t)y*W]);
}

void TGenerativeTorusView::handleEvent(TEvent &ev){
    TView::handleEvent(ev);
    if(ev.what==evBroadcast && ev.message.command==cmTimerExpired){ if(timerId && ev.message.infoPtr==timerId){ advance(); drawView(); clearEvent(ev);} }
    else if(ev.what==evKeyDown){ char ch=ev.keyDown.charScan.charCode; bool handled=false; switch(ch){
        case ' ': if(timerId) stopTimer(); else startTimer(); handled=true; break;
        case 'p': case 'P': paletteIndex=(paletteIndex+1)%3; handled=true; break;
        case 'o': case 'O': paletteIndex=(paletteIndex+2)%3; handled=true; break;
        // Size presets 1..4
        case '1': scale = 0.10f; handled=true; break;
        case '2': scale = 0.135f; handled=true; break;
        case '3': scale = 0.1625f; handled=true; break;
        case '4': scale = 0.21f; handled=true; break;
        // Fine tuning with [ and ]
        case '[': scale *= 0.9f; handled=true; break;
        case ']': scale *= 1.1f; handled=true; break;
        // Vertical stretch adjust: { and }
        case '{': yStretch = std::max(0.6f, yStretch - 0.05f); handled=true; break;
        case '}': yStretch = std::min(2.0f, yStretch + 0.05f); handled=true; break;
        default: break; }
        if(handled){ drawView(); clearEvent(ev);} }
}

void TGenerativeTorusView::setState(ushort s, Boolean en){ TView::setState(s,en); if((s&sfExposed)!=0){ if(en){ frame=0; aRot=0.f; bRot=0.f; startTimer(); drawView(); } else stopTimer(); }}
void TGenerativeTorusView::changeBounds(const TRect& b){ TView::changeBounds(b); drawView(); }

class TGenerativeTorusWindow : public TWindow{
public:
    explicit TGenerativeTorusWindow(const TRect &r):TWindow(r,"",wnNoNumber),TWindowInit(&TGenerativeTorusWindow::initFrame){}
    void setup(unsigned ms){ options|=ofTileable; TRect c=getExtent(); c.grow(-1,-1); view = new TGenerativeTorusView(c,ms); insert(view); }
    virtual void changeBounds(const TRect& b) override {
        TWindow::changeBounds(b);
        // Explicitly resize the child to the new client area.
        if (view) { TRect c = getExtent(); c.grow(-1,-1); view->locate(c); view->drawView(); }
        setState(sfExposed, True); redraw();
    }
private:
    static TFrame* initFrame(TRect r){ return new TNoTitleFrame(r);} 
    TGenerativeTorusView* view {nullptr};
};

TWindow* createGenerativeTorusWindow(const TRect &bounds){ auto *w=new TGenerativeTorusWindow(bounds); w->setup(40); return w; }
