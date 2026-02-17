/*---------------------------------------------------------*/
/*                                                         */
/*   generative_mycelium_view.cpp - Mycelium Field (Gen)  */
/*                                                         */
/*   Curl-noise flow field with branching ASCII motifs.   */
/*                                                         */
/*---------------------------------------------------------*/

#include "generative_mycelium_view.h"
#include "notitle_frame.h"

#define Uses_TWindow
#define Uses_TFrame
#include <tvision/tv.h>

#include <vector>
#include <cmath>
#include <algorithm>
#include <cstring>

namespace {
struct RGB{ float r,g,b; };
static inline float clampf(float x,float a=0.f,float b=1.f){ return std::max(a,std::min(b,x)); }
static inline float mixf(float a,float b,float t){ return a + (b-a)*t; }
static inline RGB mix(const RGB&a,const RGB&b,float t){ return {mixf(a.r,b.r,t),mixf(a.g,b.g,t),mixf(a.b,b.b,t)}; }
static inline float fract(float x){ return x - std::floor(x); }

static const RGB kP[][5]={
    { {0.02f,0.03f,0.02f},{0.05f,0.12f,0.07f},{0.12f,0.30f,0.18f},{0.36f,0.62f,0.45f},{0.82f,0.95f,0.86f} }, // moss
    { {0.03f,0.02f,0.03f},{0.15f,0.06f,0.20f},{0.35f,0.12f,0.45f},{0.70f,0.35f,0.80f},{0.96f,0.85f,0.99f} }, // spores violet
    { {0.04f,0.04f,0.04f},{0.12f,0.12f,0.14f},{0.28f,0.30f,0.32f},{0.62f,0.64f,0.68f},{0.92f,0.94f,0.96f} }, // mono
};
static inline RGB pal(int idx,float t){ int n=5; t=clampf(t); float x=t*(n-1); int i=(int)std::floor(x); int j=std::min(n-1,i+1); float f=x-i; return mix(kP[idx%3][i], kP[idx%3][j], f);}    
static const char* kGlyphs = " .,:;'`-~^*+/|\\\\x#%@@"; // variety; backslash escaped
static inline char gFor(float a){ a=clampf(a); int n= (int)std::strlen(kGlyphs); int i= std::min(n-1, std::max(0,(int)std::floor(a*(n-1)))); return kGlyphs[i]; }

// Basic value noise
static inline float h2(int x,int y){ unsigned int h=x*374761393u + y*668265263u; h=(h^(h>>13))*1274126177u; return ((h^(h>>16))&0xFFFFFF)/float(0xFFFFFF); }
static inline float vnoise(float x,float y){ int xi=(int)std::floor(x), yi=(int)std::floor(y); float xf=x-xi,yf=y-yi; float v00=h2(xi,yi), v10=h2(xi+1,yi), v01=h2(xi,yi+1), v11=h2(xi+1,yi+1); float vx0=mixf(v00,v10,xf), vx1=mixf(v01,v11,xf); return mixf(vx0,vx1,yf);}    

// Curl-like vector field via perpendicular gradients of noise
static inline void curl(float x,float y,float t,float &ux,float &uy){
    float e=0.01f;
    float n1=vnoise(x+e, y+t) - vnoise(x-e, y+t);
    float n2=vnoise(x, y+e+t) - vnoise(x, y-e+t);
    ux =  n2; // swap for perpendicular
    uy = -n1;
}

} // namespace

TGenerativeMyceliumView::TGenerativeMyceliumView(const TRect &b,unsigned ms):TView(b),periodMs(ms){ options|=ofSelectable; growMode=gfGrowAll; eventMask|=evBroadcast|evKeyboard; }
TGenerativeMyceliumView::~TGenerativeMyceliumView(){ stopTimer(); }
void TGenerativeMyceliumView::startTimer(){ if(!timerId) timerId=setTimer(periodMs,(int)periodMs);}    
void TGenerativeMyceliumView::stopTimer(){ if(timerId){ killTimer(timerId); timerId=0; }}
void TGenerativeMyceliumView::advance(){ ++frame; }

void TGenerativeMyceliumView::draw(){
    int W=size.x,H=size.y; if(W<=0||H<=0) return; std::vector<TScreenCell> row; row.resize((size_t)W);
    float t = frame*0.028f; float cx=(W-1)*0.5f, cy=(H-1)*0.5f; float invW=W?1.f/W:1.f, invH=H?1.f/H:1.f;
    for(int y=0;y<H;++y){
        for(int x=0;x<W;++x){
            float u=(x-cx)*invW*2.f, v=(y-cy)*invH*2.f; float r2=u*u+v*v; float r=std::sqrt(r2)+1e-6f;
            float ux,uy; curl(u*2.0f, v*2.0f, t, ux, uy);
            // advect sample point slightly along flow
            float uu=u + ux*0.3f, vv=v + uy*0.3f;
            float band = 0.5f + 0.5f*std::sin((uu*7.0f + vv*9.0f) - t*1.5f);
            float fil = 0.5f + 0.5f*std::cos((uu - vv)*6.0f + t*1.2f);
            float weave = band*0.6f + fil*0.4f;
            float val = clampf( weave*0.7f + std::exp(-2.2f*r2)*0.6f );
            // colour selection with slow morph
            float hueT = fract(val*0.4f + std::sin(t*0.19f + r*1.1f)*0.2f);
            RGB c = pal(paletteIndex, hueT);
            // glyph favours flow direction: choose slash/backslash/pipe depending on angle
            float ang = std::atan2(uy, ux);
            float dir = (std::sin(ang*2.f)+1.f)*0.5f; // 0..1 across orientation
            char ch; {
                if (dir < 0.33f) ch = '/';
                else if (dir < 0.66f) ch = '\\';
                else ch = '|';
                // blend with density glyphs to add texture
                float dens = clampf(val*0.8f + 0.2f*std::sin((u+v+ t)*5.0f));
                if (dens > 0.7f) ch = '*'; else if (dens < 0.15f) ch = '.';
            }
            auto to8=[&](float x)->uchar{ int v=(int)std::round(clampf(x)*255.f); return (uchar)std::max(0,std::min(255,v)); };
            TColorRGB fg(to8(c.r),to8(c.g),to8(c.b)); float bgk=0.05f + 0.2f*r;
            TColorRGB bg(to8(bgk),to8(bgk*0.96f),to8(bgk*0.92f));
            ::setCell(row[(size_t)x], ch, TColorAttr(fg,bg));
        }
        writeLine(0,y,W,1,row.data());
    }
}

void TGenerativeMyceliumView::handleEvent(TEvent &ev){
    TView::handleEvent(ev);
    if(ev.what==evBroadcast && ev.message.command==cmTimerExpired){ if(timerId && ev.message.infoPtr==timerId){ advance(); drawView(); clearEvent(ev);} }
    else if(ev.what==evKeyDown){ char ch=ev.keyDown.charScan.charCode; bool handled=false; switch(ch){
        case ' ': if(timerId) stopTimer(); else startTimer(); handled=true; break;
        case 'p': case 'P': paletteIndex=(paletteIndex+1)%3; handled=true; break;
        case 'o': case 'O': paletteIndex=(paletteIndex+2)%3; handled=true; break;
        default: break; }
        if(handled){ drawView(); clearEvent(ev);} }
}

void TGenerativeMyceliumView::setState(ushort s, Boolean en){ TView::setState(s,en); if((s&sfExposed)!=0){ if(en){ frame=0; startTimer(); drawView(); } else stopTimer(); }}
void TGenerativeMyceliumView::changeBounds(const TRect& b){ TView::changeBounds(b); drawView(); }

class TGenerativeMyceliumWindow : public TWindow{
public:
    explicit TGenerativeMyceliumWindow(const TRect &r):TWindow(r,"",wnNoNumber),TWindowInit(&TGenerativeMyceliumWindow::initFrame){}
    void setup(unsigned ms){ options|=ofTileable; TRect c=getExtent(); c.grow(-1,-1); insert(new TGenerativeMyceliumView(c,ms)); }
    virtual void changeBounds(const TRect& b) override { TWindow::changeBounds(b); setState(sfExposed, True); redraw(); }
private: static TFrame* initFrame(TRect r){ return new TNoTitleFrame(r);} };

TWindow* createGenerativeMyceliumWindow(const TRect &bounds){ auto *w=new TGenerativeMyceliumWindow(bounds); w->setup(55); return w; }

