/*---------------------------------------------------------*/
/*                                                         */
/*   generative_cube_view.cpp - Cube Spinner (Generative) */
/*                                                         */
/*   Wireframe rotating cube in perspective.              */
/*                                                         */
/*---------------------------------------------------------*/

#include "generative_cube_view.h"
#include "notitle_frame.h"

#define Uses_TWindow
#define Uses_TFrame
#include <tvision/tv.h>

#include <vector>
#include <cmath>
#include <algorithm>
#include <tuple>

namespace {
struct RGB{ float r,g,b; };
static inline float clampf(float x,float a=0.f,float b=1.f){ return std::max(a,std::min(b,x)); }
static inline float mixf(float a,float b,float t){ return a + (b-a)*t; }
static inline RGB mix(const RGB&a,const RGB&b,float t){ return {mixf(a.r,b.r,t),mixf(a.g,b.g,t),mixf(a.b,b.b,t)}; }

static const RGB kPal[][5]={{ {0.04f,0.05f,0.07f},{0.18f,0.22f,0.28f},{0.42f,0.55f,0.70f},{0.78f,0.88f,0.96f},{0.98f,0.99f,1.00f} },
                            { {0.05f,0.03f,0.02f},{0.30f,0.14f,0.06f},{0.70f,0.28f,0.10f},{0.95f,0.60f,0.25f},{1.00f,0.92f,0.70f} },
                            { {0.02f,0.04f,0.02f},{0.08f,0.20f,0.10f},{0.20f,0.46f,0.30f},{0.60f,0.80f,0.65f},{0.95f,0.98f,0.96f} } };
static inline RGB pal(int idx,float t){ int n=5; t=clampf(t); float x=t*(n-1); int i=(int)std::floor(x); int j=std::min(n-1,i+1); float f=x-i; return mix(kPal[idx%3][i], kPal[idx%3][j], f);} 

struct Vec3{ float x,y,z; };
struct Vec2{ int x,y; };

static inline Vec3 rotateXYZ(const Vec3&v, float a, float b, float c){
    float ca=std::cos(a), sa=std::sin(a);
    float cb=std::cos(b), sb=std::sin(b);
    float cc=std::cos(c), sc=std::sin(c);
    // Rz * Ry * Rx
    float x=v.x, y=v.y, z=v.z;
    // Rx
    float y1 = ca*y - sa*z;
    float z1 = sa*y + ca*z;
    // Ry
    float x2 = cb*x + sb*z1;
    float z2 = -sb*x + cb*z1;
    // Rz
    float x3 = cc*x2 - sc*y1;
    float y3 = sc*x2 + cc*y1;
    return {x3,y3,z2};
}

static inline void plot(std::vector<TScreenCell>&buf,int W,int H,int x,int y,float depth,const TColorAttr &attr,std::vector<float>&zbuf){
    if(x<0||x>=W||y<0||y>=H) return; size_t idx=(size_t)y*W+(size_t)x; if(depth>zbuf[idx]){ zbuf[idx]=depth; ::setCell(buf[idx], '\xDB', attr); }
}

static inline void line3D(std::vector<TScreenCell>&buf,int W,int H, Vec3 a3, Vec3 b3, float K1, float K2, float yStretch, const TColorAttr &attr, std::vector<float>&zbuf){
    auto proj=[&](const Vec3&p){ float ooz=1.f/(p.z+K2); int x=(int)(W/2 + K1*ooz*p.x); int y=(int)(H/2 + K1*ooz*p.y*yStretch); float d=ooz; return std::tuple<int,int,float>(x,y,d); };
    int x0,y0,x1,y1; float d0,d1; std::tie(x0,y0,d0)=proj(a3); std::tie(x1,y1,d1)=proj(b3);
    int dx=std::abs(x1-x0), dy=std::abs(y1-y0); int steps=std::max(dx,dy); if(steps==0){ plot(buf,W,H,x0,y0,(d0+d1)*0.5f,attr,zbuf); return; }
    for(int i=0;i<=steps;++i){ float t=i/(float)steps; int x=(int)std::round(x0 + (x1-x0)*t); int y=(int)std::round(y0 + (y1-y0)*t); float d=d0*(1-t)+d1*t; plot(buf,W,H,x,y,d,attr,zbuf);}    
}

} // namespace

TGenerativeCubeView::TGenerativeCubeView(const TRect &b,unsigned ms):TView(b),periodMs(ms){ options|=ofSelectable; growMode=gfGrowAll; eventMask|=evBroadcast|evKeyboard; }
TGenerativeCubeView::~TGenerativeCubeView(){ stopTimer(); }
void TGenerativeCubeView::startTimer(){ if(!timerId) timerId=setTimer(periodMs,(int)periodMs);}    
void TGenerativeCubeView::stopTimer(){ if(timerId){ killTimer(timerId); timerId=0; }}
void TGenerativeCubeView::advance(){ ++frame; a+=0.035f; b+=0.041f; c+=0.027f; }

void TGenerativeCubeView::draw(){
    int W=size.x,H=size.y; if(W<=0||H<=0) return; std::vector<TScreenCell> buf; buf.resize((size_t)W*(size_t)H);
    std::vector<float> zbuf; zbuf.assign((size_t)W*(size_t)H, -1e9f);
    // clear
    TColorRGB bg(6,6,7), fg(180,180,190); for(int y=0;y<H;++y) for(int x=0;x<W;++x) ::setCell(buf[(size_t)y*W+x],' ',TColorAttr(fg,bg));

    float yStretch=1.25f; float K2=5.0f; float K1=(float)W*K2*0.5f*scale;

    // cube vertices (-1..1)
    std::vector<Vec3> v={{-1,-1,-1},{1,-1,-1},{1,1,-1},{-1,1,-1},{-1,-1,1},{1,-1,1},{1,1,1},{-1,1,1}};
    for(auto &p:v){ p=rotateXYZ(p,a,b,c); }
    // scale down to fit
    for(auto &p:v){ p.x*=1.0f; p.y*=1.0f; p.z*=1.0f; }

    // edges
    int E[][2]={{0,1},{1,2},{2,3},{3,0},{4,5},{5,6},{6,7},{7,4},{0,4},{1,5},{2,6},{3,7}};
    int nE=12;

    for(int i=0;i<nE;++i){
        Vec3 a3=v[E[i][0]], b3=v[E[i][1]];
        float depth = ((a3.z+b3.z)*0.5f + 2.f)*0.5f; depth=clampf((depth+1.f)*0.5f);
        RGB c = pal(paletteIndex, depth);
        auto to8=[&](float q)->uchar{ int z=(int)std::round(clampf(q)*255.f); return (uchar)std::max(0,std::min(255,z)); };
        TColorAttr attr(TColorRGB(to8(c.r),to8(c.g),to8(c.b)), bg);
        line3D(buf,W,H,a3,b3,K1,K2,yStretch,attr,zbuf);
    }

    // flush
    for(int y=0;y<H;++y) writeLine(0,y,W,1,&buf[(size_t)y*W]);
}

void TGenerativeCubeView::handleEvent(TEvent &ev){
    TView::handleEvent(ev);
    if(ev.what==evBroadcast && ev.message.command==cmTimerExpired){ if(timerId && ev.message.infoPtr==timerId){ advance(); drawView(); clearEvent(ev);} }
    else if(ev.what==evKeyDown){ char ch=ev.keyDown.charScan.charCode; bool handled=false; switch(ch){
        case ' ': if(timerId) stopTimer(); else startTimer(); handled=true; break;
        case 'p': case 'P': paletteIndex=(paletteIndex+1)%3; handled=true; break;
        case 'o': case 'O': paletteIndex=(paletteIndex+2)%3; handled=true; break;
        case '[': scale = std::max(0.05f, scale*0.9f); handled=true; break;
        case ']': scale = std::min(0.6f, scale*1.1f); handled=true; break;
        default: break; }
        if(handled){ drawView(); clearEvent(ev);} }
}

void TGenerativeCubeView::setState(ushort s, Boolean en){ TView::setState(s,en); if((s&sfExposed)!=0){ if(en){ frame=0; startTimer(); drawView(); } else stopTimer(); }}
void TGenerativeCubeView::changeBounds(const TRect& b){ TView::changeBounds(b); drawView(); }

class TGenerativeCubeWindow : public TWindow{
public:
    explicit TGenerativeCubeWindow(const TRect &r):TWindow(r,"",wnNoNumber),TWindowInit(&TGenerativeCubeWindow::initFrame){}
    void setup(unsigned ms){ options|=ofTileable; TRect c=getExtent(); c.grow(-1,-1); view = new TGenerativeCubeView(c,ms); insert(view); }
    virtual void changeBounds(const TRect& b) override { 
        TWindow::changeBounds(b);
        if (view) { TRect c = getExtent(); c.grow(-1,-1); view->locate(c); view->drawView(); }
        setState(sfExposed, True); redraw(); 
    }
private: 
    static TFrame* initFrame(TRect r){ return new TNoTitleFrame(r);} 
    TGenerativeCubeView* view {nullptr};
};

TWindow* createGenerativeCubeWindow(const TRect &bounds){ auto *w=new TGenerativeCubeWindow(bounds); w->setup(45); return w; }
