/*---------------------------------------------------------*/
/*                                                         */
/*   generative_monster_verse_view.cpp - Monster Verse    */
/*                                                         */
/*   Smooth Verse fields (flow/swirl/weave + fbm) mapped  */
/*   to whitespace/punct/geom + portal emoji, with sparse */
/*   crown+eyes and diagonal limb hints.                   */
/*                                                         */
/*---------------------------------------------------------*/

#include "generative_monster_verse_view.h"
#include "notitle_frame.h"

#define Uses_TWindow
#define Uses_TFrame
#include <tvision/tv.h>

#include <vector>
#include <string>
#include <cmath>
#include <algorithm>

namespace {

static inline float clampf(float x, float a=0.f, float b=1.f){ return std::max(a, std::min(b, x)); }
static inline float mixf(float a,float b,float t){ return a + (b-a)*t; }
static inline float fract(float x){ return x - std::floor(x); }

struct RGB { float r,g,b; };
static inline RGB mix(const RGB &a, const RGB &b, float t){ return { mixf(a.r,b.r,t), mixf(a.g,b.g,t), mixf(a.b,b.b,t) }; }

// Palettes reused from Verse
static const RGB kPalettes[][5] = {
    { {0.05f,0.06f,0.08f}, {0.18f,0.19f,0.22f}, {0.42f,0.28f,0.36f}, {0.82f,0.58f,0.35f}, {0.98f,0.87f,0.65f} },
    { {0.02f,0.05f,0.02f}, {0.06f,0.24f,0.15f}, {0.16f,0.45f,0.44f}, {0.44f,0.70f,0.86f}, {0.95f,0.96f,0.98f} },
    { {0.03f,0.03f,0.07f}, {0.20f,0.10f,0.35f}, {0.55f,0.20f,0.70f}, {0.95f,0.40f,0.80f}, {1.00f,0.95f,1.00f} },
};
static inline RGB paletteSample(int paletteIndex, float t){
    const int n = (int)(sizeof(kPalettes[0])/sizeof(kPalettes[0][0]));
    const RGB *p = kPalettes[ paletteIndex % (int)(sizeof(kPalettes)/sizeof(kPalettes[0])) ];
    t = clampf(t); float x = t*(n-1); int i=(int)std::floor(x); int j=std::min(n-1,i+1); float f=x-i; return mix(p[i],p[j],f);
}

// Cheap fbm like Verse
static inline float hash2(int x,int y){ uint32_t h = (uint32_t)(x*374761393 + y*668265263); h = (h^(h>>13))*1274126177u; return ((h^(h>>16)) & 0xFFFFFF)/float(0xFFFFFF); }
static inline float valueNoise(float x,float y){ int xi=(int)std::floor(x), yi=(int)std::floor(y); float xf=x-xi,yf=y-yi; float v00=hash2(xi,yi), v10=hash2(xi+1,yi), v01=hash2(xi,yi+1), v11=hash2(xi+1,yi+1); float vx0=v00 + (v10-v00)*xf; float vx1=v01 + (v11-v01)*xf; return vx0 + (vx1-vx0)*yf; }
static inline float fbm(float x,float y,int oct=4){ float a=0.5f,f=1.8f,amp=0.5f,sum=0.f; for(int i=0;i<oct;++i){ sum+=valueNoise(x*f,y*f)*amp; f*=1.9f; amp*=a;} return sum; }

// Emoji set (subset) and geom/punct
static const char* kMoji[] = { u8"🕳️", u8"👁️", u8"💀", u8"🦴", u8"🕸️", u8"🦇", u8"🔥", u8"⚡" };
static const int kMojiCount = (int)(sizeof(kMoji)/sizeof(kMoji[0]));
static const char* kPunct[] = { ".", ",", "`", "·" };
static const char* kGeom[]  = { u8"∿", u8"◊", u8"│", u8"─", u8"═", u8"╱", u8"╲" };

} // namespace

TGenerativeMonsterVerseView::TGenerativeMonsterVerseView(const TRect &bounds, unsigned periodMs)
    : TView(bounds), periodMs(periodMs)
{
    options |= ofSelectable;
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evBroadcast | evKeyboard;
}

TGenerativeMonsterVerseView::~TGenerativeMonsterVerseView(){ stopTimer(); }
void TGenerativeMonsterVerseView::startTimer(){ if (!timerId) timerId = setTimer(periodMs, (int)periodMs); }
void TGenerativeMonsterVerseView::stopTimer(){ if (timerId){ killTimer(timerId); timerId = 0; } }
void TGenerativeMonsterVerseView::advance(){ ++frame; }

void TGenerativeMonsterVerseView::draw(){
    int W=size.x,H=size.y; if (W<=0||H<=0) return;
    // We build UTF-8 lines and render with moveCStr so emoji display correctly.

    // Verse-like timing
    float t = frame * 0.028f; // slightly slower than Verse
    float t2 = frame * 0.017f;
    float cx=(W-1)*0.5f, cy=(H-1)*0.5f; float invW=W?1.f/W:1.f, invH=H?1.f/H:1.f;

    for(int y=0;y<H;++y){
        // Column-accurate emitter: decide on a stable 1-col grid (x), emit at running column (col).
        TDrawBuffer b; TAttrPair ap{TColorAttr(TColorRGB(210,210,210), TColorRGB(10,10,12)), TColorAttr(TColorRGB(210,210,210), TColorRGB(10,10,12))};
        int col = 0;
        for (int x = 0; x < W && col < W; ++x){
            float u=(x-cx)*invW*2.f, v=(y-cy)*invH*2.f; float r=std::sqrt(u*u+v*v)+1e-6f; float ang=std::atan2(v,u);

            float f=0.f;
            switch(mode){
                case mdFlow:
                    f = 0.55f + 0.45f * std::sin( (u*3.0f + std::sin(v*2.2f + t)) * 1.15f + t );
                    f += 0.25f * std::sin( (v*4.0f + std::cos(u*1.6f - t*1.2f)) * 1.05f - t2 );
                    break;
                case mdSwirl:
                    f = 0.5f + 0.5f * std::sin( (ang*3.3f + r*4.7f) - t*1.8f );
                    f = 0.7f*f + 0.3f*std::sin(r*7.5f - t*1.3f);
                    break;
                case mdWeave:
                    f = 0.5f + 0.5f * ( std::sin(u*5.6f + t*1.6f) * std::cos(v*5.6f - t*1.1f) );
                    f = 0.6f*f + 0.4f*std::sin((u+v)*3.6f + t*0.9f);
                    break;
            }

            float n = fbm(u*2.6f + t*0.5f, v*2.6f - t*0.45f, 3);
            float val = clampf(f*0.75f + n*0.35f);

            // Palette & color
            float hueT = fract(val + std::sin(t*0.2f + r*0.6f)*0.12f + paletteIndex*0.11f);
            RGB c = paletteSample(paletteIndex, hueT);
            auto to8=[](float x)->uchar{ int v=(int)std::round(clampf(x)*255.f); return (uchar)std::max(0,std::min(255,v)); };
            TColorRGB fg(to8(c.r),to8(c.g),to8(c.b));
            // Keep darker background like Verse
            float bgk = clampf(0.06f + 0.22f*(r*0.5f));
            TColorRGB bg(to8(bgk), to8(bgk*0.95f), to8(bgk*0.9f));

            // Class mapping: whitespace → punct → geom → emoji
            const char* out = " ";
            float ws = whitespaceBias;         // airy base
            float punct = ws + 0.18f;          // punctuation band
            float geom  = punct + 0.30f;       // geometric band

            if (val < ws){
                out = ( (fbm(u*7+1,v*7-2,2) < 0.15f) ? "." : " " );
            } else if (val < punct){
                int idx = (int)std::floor(fract(u*11+v*13+t*0.3f)*4) % 4;
                out = kPunct[idx];
            } else if (val < geom){
                int idx = (int)std::floor(fract(u*9-v*9+t*0.25f)*7) % 7;
                out = kGeom[idx];
            } else {
                // Emoji accent region
                float ebias = (val - geom) / (1.0f - geom);
                float pick = fract(u*5+v*7+t*0.18f);
                if (emojiFlood) {
                    // Flood mode: heavy emoji above whitespace threshold
                    if (val > whitespaceBias*0.6f) {
                        int idx = (int)std::floor(pick*kMojiCount) % kMojiCount;
                        out = kMoji[idx];
                    } else {
                        out = (pick < 0.5f) ? kPunct[(int)std::floor(fract(u*11+v*13+t*0.3f)*4)%4] : " ";
                    }
                } else {
                    if (ebias > (1.0f - emojiBias)) {
                        int idx = (int)std::floor(pick*kMojiCount) % kMojiCount;
                        out = kMoji[idx];
                    } else {
                        out = kGeom[(int)std::floor(fract(u*9+v*9-t*0.2f)*7) % 7];
                    }
                }
            }

            // Sparse crown/eyes overlay aligned to a loose grid, fades with field
            int tileW = 28, tileH = 10;
            int gx = (x / tileW), gy = (y / tileH);
            int tx = x % tileW, ty = y % tileH;
            // Original crown/eyes (kept sparse)
            if ((gy % headDensity)==0) {
                if (ty == 0 && fract(std::sin((gx+gy)*12.34f)) > 0.2f)
                    out = ((tx + frame/8) % 2 == 0) ? u8"╱" : u8"╲";
                if (ty == 2) { int cx2=tileW/2; if (tx==cx2-5) out=u8"👁️"; else if (tx>=cx2-2 && tx<=cx2+2) out=u8"═"; else if (tx==cx2+5) out=u8"👁️"; }
            }
            // Dynamic eyes that follow dark spots and move
            {
                // Sample multiple positions in tile to find darkest spot
                float minVal = 2.0f;
                int bestOffsetX = 0, bestOffsetY = 0;
                
                // Search in 5x3 grid within tile for darkest point
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -2; dx <= 2; dx++) {
                        int xS = gx*tileW + tileW/2 + dx*3;
                        int yS = gy*tileH + tileH/2 + dy*2;
                        if (xS >= 0 && xS < W && yS >= 0 && yS < H) {
                            float uS = (xS - cx) * invW * 2.f;
                            float vS = (yS - cy) * invH * 2.f;
                            float fS=0.f;
                            switch(mode){
                                case mdFlow:
                                    fS = 0.55f + 0.45f * std::sin( (uS*3.0f + std::sin(vS*2.2f + t)) * 1.15f + t );
                                    fS += 0.25f * std::sin( (vS*4.0f + std::cos(uS*1.6f - t*1.2f)) * 1.05f - t2 );
                                    break;
                                case mdSwirl:
                                    { float rS=std::sqrt(uS*uS+vS*vS)+1e-6f; float angS=std::atan2(vS,uS);
                                      fS = 0.5f + 0.5f * std::sin( (angS*3.3f + rS*4.7f) - t*1.8f );
                                      fS = 0.7f*fS + 0.3f*std::sin(rS*7.5f - t*1.3f); }
                                    break;
                                case mdWeave:
                                    fS = 0.5f + 0.5f * ( std::sin(uS*5.6f + t*1.6f) * std::cos(vS*5.6f - t*1.1f) );
                                    fS = 0.6f*fS + 0.4f*std::sin((uS+vS)*3.6f + t*0.9f);
                                    break;
                            }
                            float nS = fbm(uS*2.6f + t*0.5f, vS*2.6f - t*0.45f, 3);
                            float valS = clampf(fS*0.75f + nS*0.35f);
                            if (valS < minVal) {
                                minVal = valS;
                                bestOffsetX = dx*3;
                                bestOffsetY = dy*2;
                            }
                        }
                    }
                }
                
                // Place eyes only if we found a sufficiently dark spot
                if (minVal < whitespaceBias + 0.12f) {
                    // Add gentle oscillation to eye position
                    float eyeWobble = std::sin(t*1.3f + gx*2.1f + gy*1.7f) * 1.5f;
                    int eyeCenterX = tileW/2 + bestOffsetX + (int)eyeWobble;
                    int eyeCenterY = tileH/2 + bestOffsetY;
                    
                    // Only render if we're in the right row
                    if (ty == eyeCenterY) {
                        // Eye pattern with slight asymmetry for more organic feel
                        int leftEyeX = eyeCenterX - 5;
                        int rightEyeX = eyeCenterX + 5 + (int)(std::sin(t*0.8f + gx*1.1f) * 0.7f);
                        
                        if (tx == leftEyeX) out = u8"👁️";
                        else if (tx >= eyeCenterX-2 && tx <= eyeCenterX+2) out = u8"═";
                        else if (tx == rightEyeX) out = u8"👁️";
                    }
                }
            }

            // Limb diagonals hinted by signed stripes blended with flow
            float stripes1 = std::fabs(std::sin((x+y)*0.08f + t*0.15f));
            float stripes2 = std::fabs(std::sin((x-y)*0.08f - t*0.12f));
            if (stripes1 < 0.04f && val > punct && val < geom) out = u8"╱";
            if (stripes2 < 0.04f && val > punct && val < geom) out = u8"╲";

            // Emit respecting glyph width
            ushort w = b.moveCStr(col, out, ap, W - col);
            col += (w>0 ? w : 1);
        }
        if (col < W) b.moveChar(col, ' ', TColorAttr(TColorRGB(210,210,210), TColorRGB(10,10,12)), (ushort)(W - col));
        writeLine(0, y, W, 1, b);
    }
}

void TGenerativeMonsterVerseView::handleEvent(TEvent &ev){
    TView::handleEvent(ev);
    if (ev.what==evBroadcast && ev.message.command==cmTimerExpired){ if (timerId && ev.message.infoPtr==timerId){ advance(); drawView(); clearEvent(ev);} }
    else if (ev.what==evKeyDown){ char ch=ev.keyDown.charScan.charCode; bool handled=false; switch(ch){
        case 'p': case 'P': paletteIndex = (paletteIndex+1)%3; handled=true; break;
        case 'o': case 'O': paletteIndex = (paletteIndex+2)%3; handled=true; break;
        case 'm': case 'M': mode = (Mode)(((int)mode+1)%3); handled=true; break;
        case '+': case '=': if (periodMs<200){ periodMs+=4; stopTimer(); startTimer(); } handled=true; break;
        case '-': case '_': if (periodMs>20){ periodMs-=4; stopTimer(); startTimer(); } handled=true; break;
        case 'j': emojiBias = std::min(0.95f, emojiBias + 0.05f); handled=true; break;
        case 'J': emojiBias = std::max(0.05f, emojiBias - 0.05f); handled=true; break;
        case 'x': case 'X': emojiFlood = !emojiFlood; handled=true; break;
        default: break; }
        if (handled){ drawView(); clearEvent(ev);} }
}

void TGenerativeMonsterVerseView::setState(ushort s, Boolean en){ TView::setState(s,en); if ((s&sfExposed)!=0){ if (en){ frame=0; startTimer(); drawView(); } else stopTimer(); }}
void TGenerativeMonsterVerseView::changeBounds(const TRect& b){ TView::changeBounds(b); drawView(); }

class TGenerativeMonsterVerseWindow : public TWindow{
public:
    explicit TGenerativeMonsterVerseWindow(const TRect &r):TWindow(r, "", wnNoNumber), TWindowInit(&TGenerativeMonsterVerseWindow::initFrame){}
    void setup(unsigned ms){ options|=ofTileable; TRect c=getExtent(); c.grow(-1,-1); insert(new TGenerativeMonsterVerseView(c,ms)); }
    virtual void changeBounds(const TRect& b) override { TWindow::changeBounds(b); setState(sfExposed, True); redraw(); }
private: static TFrame* initFrame(TRect r){ return new TNoTitleFrame(r);} };

TWindow* createGenerativeMonsterVerseWindow(const TRect &bounds){ auto *w=new TGenerativeMonsterVerseWindow(bounds); w->setup(60); return w; }
