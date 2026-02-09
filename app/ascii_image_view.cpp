#include "ascii_image_view.h"

#define Uses_TRect
#define Uses_TWindow
#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_MsgBox
#include <tvision/tv.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

// stb_image loader
#define STB_IMAGE_IMPLEMENTATION
#define STBI_NO_THREAD_LOCALS
#define STBI_ONLY_PNG
#define STBI_ONLY_JPEG
extern "C" { 
#include "stb_image.h"
}

struct Image { int w=0,h=0,comp=0; std::vector<uint8_t> pixels; };
static inline float clampf(float x, float a, float b){ return x<a?a:(x>b?b:x); }
static inline int clampi(int x, int a, int b){ return x<a?a:(x>b?b:x); }

static Image loadImageRGBA(const std::string &path){
    Image img; int w,h,n;
    stbi_uc *data = stbi_load(path.c_str(), &w, &h, &n, 4);
    if (!data) {
        const char* reason = stbi_failure_reason();
        std::string msg = "Failed to load image: "+path;
        if (reason){ msg += " ("; msg += reason; msg += ")"; }
        throw std::runtime_error(msg);
    }
    img.w=w; img.h=h; img.comp=4; img.pixels.assign(data, data+(size_t)w*h*4); stbi_image_free(data);
    return img;
}

struct Cell { char32_t ch; uint8_t fg, bg; };
struct Grid { int cols=0, rows=0; std::vector<Cell> cells; };
struct RGB{ float r,g,b; };
static constexpr std::array<RGB,16> ANSI16 = { RGB{0,0,0}, RGB{0.8f,0,0}, RGB{0,0.8f,0}, RGB{0.8f,0.8f,0},
    RGB{0,0,0.8f}, RGB{0.8f,0,0.8f}, RGB{0,0.8f,0.8f}, RGB{0.75f,0.75f,0.75f},
    RGB{0.4f,0.4f,0.4f}, RGB{1,0.3f,0.3f}, RGB{0.3f,1,0.3f}, RGB{1,1,0.3f},
    RGB{0.3f,0.3f,1}, RGB{1,0.3f,1}, RGB{0.3f,1,1}, RGB{1,1,1} };
static inline float luma(float r,float g,float b){ return 0.2126f*r+0.7152f*g+0.0722f*b; }
static inline int closestAnsi16(float r,float g,float b){ int idx=0; float best=1e9f; for(int i=0;i<16;++i){ float dr=r-ANSI16[i].r, dg=g-ANSI16[i].g, db=b-ANSI16[i].b; float d2=dr*dr+dg*dg+db*db; if(d2<best){best=d2; idx=i;} } return idx; }
static const int BAYER4[4][4]={{0,8,2,10},{12,4,14,6},{3,11,1,9},{15,7,13,5}};
static inline float bayerThreshold4x4(int x,int y){ return (BAYER4[y&3][x&3]+0.5f)/16.f; }

struct GlyphConfig{ enum class Mode{Blocks,Unicode,Ascii}; Mode mode=Mode::Blocks; };
static const char32_t RAMP_UNI[]=
    U" .'`^,:;Il!i~+_-?][}{1)(|\\/"
    U"tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
static const char32_t RAMP_BLOCKS[]=U" ░▒▓█";
static const char32_t RAMP_ASCII[] =U" .:-=+*#%@";
constexpr size_t LEN_UNI=sizeof(RAMP_UNI)/sizeof(char32_t)-1;
constexpr size_t LEN_BLOCKS=sizeof(RAMP_BLOCKS)/sizeof(char32_t)-1;
constexpr size_t LEN_ASCII=sizeof(RAMP_ASCII)/sizeof(char32_t)-1;
static char32_t glyphForLuma(float y,const GlyphConfig&cfg){ const char32_t*r=nullptr; size_t N=0; switch(cfg.mode){case GlyphConfig::Mode::Blocks:r=RAMP_BLOCKS;N=LEN_BLOCKS;break;case GlyphConfig::Mode::Unicode:r=RAMP_UNI;N=LEN_UNI;break;case GlyphConfig::Mode::Ascii:r=RAMP_ASCII;N=LEN_ASCII;break;} float t=clampf(y,0.f,1.f); size_t i=(size_t)std::lround(t*(N-1)); return r[i]; }

struct RenderParams{ int cols=80, rows=24; bool orderedDither=true; float cellAspectW=1.f, cellAspectH=2.f; GlyphConfig glyphCfg; };

static Grid rasterizeToGrid(const Image &img,const RenderParams&rp){ Grid g; g.cols=rp.cols; g.rows=rp.rows; g.cells.resize((size_t)g.cols*g.rows); if(img.w==0||img.h==0) return g; float cellAspect=rp.cellAspectH/std::max(1.f,rp.cellAspectW); float effRows=rp.rows*cellAspect; float sx_full=(float)img.w/std::max(1,rp.cols); float sy_full=(float)img.h/std::max(1.f,effRows); float s=std::min(sx_full,sy_full); float vw=rp.cols*s, vh=effRows*s; float xOff=((float)img.w-vw)*0.5f, yOff=((float)img.h-vh)*0.5f; float cellW=vw/std::max(1,rp.cols), cellH=vh/std::max(1,rp.rows);
    for(int cy=0; cy<g.rows; ++cy){ for(int cx=0; cx<g.cols; ++cx){ float x0=xOff+cx*cellW, y0=yOff+cy*cellH, x1=xOff+(cx+1)*cellW, y1=yOff+(cy+1)*cellH; int ix0=clampi((int)std::floor(x0),0,img.w), iy0=clampi((int)std::floor(y0),0,img.h), ix1=clampi((int)std::ceil(x1),0,img.w), iy1=clampi((int)std::ceil(y1),0,img.h); if(ix1<=ix0) ix1=std::min(ix0+1,img.w); if(iy1<=iy0) iy1=std::min(iy0+1,img.h); double sr=0,sg=0,sb=0; int cnt=0; for(int y=iy0;y<iy1;++y){ const uint8_t*row=&img.pixels[(size_t)y*img.w*4]; for(int x=ix0;x<ix1;++x){ const uint8_t*p=&row[x*4]; float a=p[3]/255.f; float r=(p[0]/255.f)*a, g2=(p[1]/255.f)*a, b=(p[2]/255.f)*a; sr+=r; sg+=g2; sb+=b; ++cnt; }} float r=(float)(sr/std::max(1,cnt)), g2=(float)(sg/std::max(1,cnt)), b=(float)(sb/std::max(1,cnt)); float y=luma(r,g2,b); if(rp.orderedDither){ float th=bayerThreshold4x4(cx,cy)-0.5f; y=clampf(y+th*0.12f,0.f,1.f);} char32_t ch=glyphForLuma(y,rp.glyphCfg); int fg=closestAnsi16(r,g2,b); int bg=0; g.cells[(size_t)cy*g.cols+cx]=Cell{ch,(uint8_t)fg,(uint8_t)bg}; }} return g; }

static inline uint8_t ansiToTVAttr(uint8_t fg,uint8_t bg){ return ((bg&0x0F)<<4)|(fg&0x0F); }

class TAsciiImageView : public TView{
public:
    TAsciiImageView(const Image &img,const RenderParams &params):TView(TRect(1,1,1,1)),original(img),rp(params){ growMode=gfGrowHiX|gfGrowHiY; options|=ofSelectable; }
    virtual void draw() override{
        TRect r=getExtent(); int cols=r.b.x-r.a.x; if(cols<=0) return; int rows=r.b.y-r.a.y; if(rows<=0) return; if(dirty||cols!=cached.cols||rows!=cached.rows){ RenderParams rp2=rp; rp2.cols=cols; rp2.rows=rows; cached=rasterizeToGrid(original,rp2); dirty=false; }
        auto toUtf8=[&](char32_t cp, char out[5]){ memset(out,0,5); uint32_t u=cp; if(u<0x80){out[0]=char(u);} else if(u<0x800){out[0]=char(0xC0|(u>>6)); out[1]=char(0x80|(u&0x3F));} else if(u<0x10000){out[0]=char(0xE0|(u>>12)); out[1]=char(0x80|((u>>6)&0x3F)); out[2]=char(0x80|(u&0x3F));} else {out[0]=char(0xF0|(u>>18)); out[1]=char(0x80|((u>>12)&0x3F)); out[2]=char(0x80|((u>>6)&0x3F)); out[3]=char(0x80|(u&0x3F));} };
        TDrawBuffer buf; for(int y=0;y<cached.rows;++y){ buf.moveChar(0,' ',TColorAttr(ansiToTVAttr(7,0)),cached.cols); for(int x=0;x<cached.cols;++x){ const Cell &c=cached.cells[(size_t)y*cached.cols+x]; char u8[5]; toUtf8(c.ch,u8); buf.moveStr(x, TStringView(u8, strlen(u8)), TColorAttr(ansiToTVAttr(c.fg,c.bg))); } writeLine(0,y,cached.cols,1,&buf);} }
    virtual void handleEvent(TEvent &ev) override{ if(ev.what==evKeyDown){ switch(ev.keyDown.keyCode){ case '+': case '=': scale(1); clearEvent(ev); return; case '-': case '_': scale(-1); clearEvent(ev); return; case 'g': case 'G': cycleGlyphMode(); clearEvent(ev); return; case 'd': case 'D': rp.orderedDither=!rp.orderedDither; dirty=true; drawView(); clearEvent(ev); return; } } TView::handleEvent(ev); }
private:
    Image original; RenderParams rp; Grid cached; bool dirty=true;
    void scale(int dir){ float s=(dir>0)?0.9f:1.1f; rp.cellAspectW=clampf(rp.cellAspectW*s,0.5f,2.0f); rp.cellAspectH=clampf(rp.cellAspectH*s,1.0f,3.0f); dirty=true; drawView(); }
    void cycleGlyphMode(){ using M=GlyphConfig::Mode; if(rp.glyphCfg.mode==M::Blocks) rp.glyphCfg.mode=M::Unicode; else if(rp.glyphCfg.mode==M::Unicode) rp.glyphCfg.mode=M::Ascii; else rp.glyphCfg.mode=M::Blocks; dirty=true; drawView(); }
};

class TAsciiImageWindow : public TWindow{
public:
    explicit TAsciiImageWindow(const TRect &bounds):TWindow(bounds,"ASCII Image", wnNoNumber), TWindowInit(&TAsciiImageWindow::initFrame){ options|=ofTileable; }
    void setView(TAsciiImageView* v){ view=v; insert(v); }
    virtual void changeBounds(const TRect& b) override{ TWindow::changeBounds(b); setState(sfExposed, True); redraw(); }
private: TAsciiImageView *view{}; };

TWindow* createAsciiImageWindowFromFile(const TRect &bounds, const std::string &path){
    try{
        Image img=loadImageRGBA(path);
        RenderParams rp; rp.cols=80; rp.rows=24; rp.glyphCfg.mode=GlyphConfig::Mode::Blocks;
        auto *w=new TAsciiImageWindow(bounds);
        // fit client area
        TRect c=bounds; c.grow(-1,-1);
        auto *v=new TAsciiImageView(img,rp);
        w->setView(v);
        return w;
    }catch(const std::exception &e){
        messageBox(e.what(), mfError | mfOKButton);
        return nullptr;
    }
}
