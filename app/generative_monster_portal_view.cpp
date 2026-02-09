/*---------------------------------------------------------*/
/*                                                         */
/*   generative_monster_portal_view.cpp - Monster Portal  */
/*                                                         */
/*   Tiles emoji from the 'monster-death-flyer-portal'    */
/*   primer on a black background. Brick offset per row.   */
/*   Pattern decomposes over time (glitch drift + swaps).  */
/*                                                         */
/*   Controls:                                             */
/*     Space: pause/resume                                 */
/*     g/G  : increase/decrease glitch speed               */
/*     r    : reset glitch                                 */
/*                                                         */
/*---------------------------------------------------------*/

#include "generative_monster_portal_view.h"
#include "notitle_frame.h"

#define Uses_TWindow
#define Uses_TFrame
#define Uses_TColorAttr
#include <tvision/tv.h>

#include <vector>
#include <string>
#include <cmath>
#include <cstdlib>

namespace {

// Emoji palette extracted from primer.
static const char* kMoji[] = {
    u8"🕳️", u8"👁️", u8"💀", u8"👂", u8"👃", u8"👅", u8"💧",
    u8"🦴", u8"🕸️", u8"🦇", u8"🔥", u8"⚡", u8"👻"
};
static const int kMojiCount = (int)(sizeof(kMoji)/sizeof(kMoji[0]));

// Structural glyphs used as noise during decomposition.
static const char* kNoise[] = { u8"∿", u8"◊", u8"╱", u8"╲", u8"═", u8"│", u8"▼", u8"╲", u8"╱" };
static const int kNoiseCount = (int)(sizeof(kNoise)/sizeof(kNoise[0]));

static inline int wrapi(int x, int n) { int m = n? x % n : 0; return m < 0 ? m + n : m; }

// Simple LCG for deterministic pseudorandom per-frame jitters.
static inline uint32_t lcg(uint32_t &s){ s = s*1664525u + 1013904223u; return s; }

// Lightweight value noise + fbm for field-driven patterning.
static inline float hash2i(int x,int y){ uint32_t h = (uint32_t)x*374761393u + (uint32_t)y*668265263u; h = (h^(h>>13))*1274126177u; return ((h^(h>>16))&0xFFFFFF)/float(0xFFFFFF); }
static inline float vnoise(float x,float y){ int xi=(int)std::floor(x), yi=(int)std::floor(y); float xf=x-xi, yf=y-yi; float v00=hash2i(xi,yi), v10=hash2i(xi+1,yi), v01=hash2i(xi,yi+1), v11=hash2i(xi+1,yi+1); float vx0=v00 + (v10-v00)*xf; float vx1=v01 + (v11-v01)*xf; return vx0 + (vx1-vx0)*yf; }
static inline float fbm2(float x,float y,int oct=4){ float a=0.5f,f=1.7f,amp=0.5f,sum=0.f; for(int i=0;i<oct;++i){ sum += vnoise(x*f,y*f)*amp; f*=1.9f; amp*=a;} return sum; }

}

TGenerativeMonsterPortalView::TGenerativeMonsterPortalView(const TRect &bounds, unsigned periodMs)
    : TView(bounds), periodMs(periodMs)
{
    options |= ofSelectable;
    growMode = gfGrowAll;
    eventMask |= evBroadcast | evKeyboard;
}

TGenerativeMonsterPortalView::~TGenerativeMonsterPortalView(){ stopTimer(); }
void TGenerativeMonsterPortalView::startTimer(){ if (!timerId) timerId = setTimer(periodMs, (int)periodMs); }
void TGenerativeMonsterPortalView::stopTimer(){ if (timerId){ killTimer(timerId); timerId = 0; } }
void TGenerativeMonsterPortalView::advance(){
    ++frame;
    time += timeSpeed;
    // Slightly slower glitch progression; modulated by a breathe wave for smoothness
    float breathe = 0.5f + 0.5f*std::sin(time*0.8f);
    glitch = std::fmin(1.f, glitch + glitchSpeed * (0.4f + 0.6f*breathe));
    // Convert time into a very slow scroll phase (integer used for lattice wrap)
    scroll = (int)std::floor(time * 4.0f) % 4096;
    // Episode cycling
    ++epFrame;
    if (epFrame >= epDuration){ epFrame = 0; episode = (Episode)(((int)episode + 1) & 3); }
}

void TGenerativeMonsterPortalView::draw(){
    int W = size.x, H = size.y; if (W<=0||H<=0) return;
    // Black background with neutral FG (emoji are colored by terminal generally).
    TColorAttr attr(TColorRGB(220,220,220), TColorRGB(0,0,0));

    // Build each row as a string, with brick offset on odd tile rows. Overlay rules:
    //   1) Head motif (top ╱╲╱╲... ; blank ; 👁️  ═══  👁️) placed sparsely via hashed coarse grid.
    //   2) Arms/legs diagonals: oriented bands of ╱ and ╲ based on (x±y) stripes.
    //   3) Base emoji tile with gradual decomposition.
    for (int y=0; y<H; ++y){
        std::string line;
        line.reserve((size_t)W*4);

        // Tile coordinates and brick offset.
        int tileRow = y / tileH;
        int rowShift = (tileRow % 2) ? (tileW/2) : 0; // 50% tile offset

        // Deterministic per-row seed so pattern is stable but evolves with frame.
        uint32_t seed = 0xA5C3u ^ (uint32_t)(y*131 + frame*17 + (scroll*3));
        // Row caps for loud accents
        int capFire=2, capBolt=2, capBat=2; int usedFire=0, usedBolt=0, usedBat=0;
        for (int x=0; x<W; ++x){
            const char* out = nullptr;

            // Tile-local coords for motif placement
            int tileY = y % tileH;
            int tileX = (x + rowShift) % tileW;

            // 1) HEAD MOTIF overlay (strict centering within tile)
            // head rows: 0 = crown, 1 = blank, 2 = eyes
            // Center eyes positions within tileW
            int headW = std::min(16, tileW - 2);
            int cx = tileW/2;
            int eyeL = std::max(0, cx - headW/2 + 2);
            int eyeR = std::min(tileW-1, cx + headW/2 - 3);
            int barL = cx - 2, barR = cx + 2;
            // Sparse placement: use hashed tile block to enable/disable head for this tile
            uint32_t hseed = (uint32_t)((x/ tileW)*7349u) ^ (uint32_t)((y/ tileH)*9157u) ^ 0xC001D00Du;
            float hprob = ((lcg(hseed)>>8)&0xFFFF)/65535.f;
            bool headOn = hprob < 0.65f; // most tiles show head
            if (headOn){
                if (tileY == 0){
                    // Crown with minor wiggle depending on breathe and crownRigidity
                    float breathe = 0.5f + 0.5f*std::sin(frame*0.08f);
                    bool wiggle = ((lcg(hseed)>>24)&255) < (int)((1.f-crownRigidity)*255*breathe);
                    int phase = wiggle ? (frame/6) : 0;
                    out = ((tileX + phase) % 2 == 0) ? u8"╱" : u8"╲";
                } else if (tileY == 1) {
                    out = " ";
                } else if (tileY == 2){
                    if (tileX == eyeL) out = u8"👁️";
                    else if (tileX >= barL && tileX <= barR) out = u8"═";
                    else if (tileX == eyeR) out = u8"👁️";
                    else out = " ";
                }
            }

            // 2) ARMS/LEGS diagonals if not occupied by head (smooth sine stripes)
            if (!out) {
                float phase = time * 0.6f;
                float kx = 0.22f, ky = 0.22f; // spatial frequency
                float s1f = std::fabs(std::sin(( (x+rowShift)*kx + y*ky) + phase));
                float s2f = std::fabs(std::sin(( (x+rowShift)*kx - y*ky) - phase*0.8f));
                float hold = 1.f - std::min(1.f, glitch*0.7f);
                float thr = 0.06f + 0.06f*(1.0f-hold); // more glitch => wider bands fade
                bool band1 = s1f < thr;
                bool band2 = s2f < thr;
                if (band1 && band2){ out = (((lcg(seed)>>20)&1) ? u8"🕸️" : u8"🦴"); }
                else if (band1) out = u8"╱";
                else if (band2) out = u8"╲";
            }

            // Field-driven base selection using fbm for mixture of whitespace, punctuation, geom, emoji.
            float t = frame * 0.03f;
            float u = (x + rowShift) / float(std::max(1,tileW)) - 0.5f;
            float v = y / float(std::max(1,tileH)) - 0.5f;
            float fval = fbm2(u*3.f + t*0.3f, v*3.f - t*0.27f, 4);
            // Normalize to 0..1
            float val = std::max(0.f, std::min(1.f, fval));
            const char* glyph = " ";
            // Thresholds: whitespace -> punctuation -> geometric -> emoji
            float ws = whitespaceBias;                    // spaces / very light
            float punct = ws + 0.20f;                    // '.', ',', '`', '·'
            float geom  = punct + 0.28f;                 // '∿', '◊', '│', '─', '═', '╱','╲'
            // Clamp
            geom = std::min(0.95f, geom);

            if (val < ws) {
                // Mostly spaces, sometimes '.'
                glyph = (((lcg(seed)>>24)&255) < 40) ? "." : " ";
            } else if (val < punct) {
                static const char* kP[] = {".", ",", "`", "·"};
                glyph = kP[(lcg(seed)>>20) % 4];
            } else if (val < geom) {
                static const char* kG[] = {u8"∿", u8"◊", u8"│", u8"─", u8"═", u8"╱", u8"╲"};
                glyph = kG[(lcg(seed)>>18) % 7];
            } else {
                // Emoji cluster, but limited by global density
                int base = wrapi((x + scroll/8) + (y*7), kMojiCount);
                glyph = kMoji[base];
            }

            // Decomposition driven by smooth noise instead of per-cell RNG
            float dec = fbm2(u*5.2f + time*0.35f, v*5.2f - time*0.33f, 3);
            if (dec < glitch * 0.45f) {
                // Smooth-field swap between noise/emoji
                if (dec < glitch * 0.25f) {
                    glyph = kNoise[ ((int)std::floor((dec*10000 + x + y) ) ) % kNoiseCount ];
                } else {
                    glyph = kMoji[ ((int)std::floor((dec*10000 + x*7 + y*13)) ) % kMojiCount ];
                }
            }
            // Rare dropouts (holes) as glitch increases (also noise-based)
            float hole = fbm2(u*7.1f - time*0.2f, v*7.1f + time*0.21f, 2);
            if (hole < glitch * 0.03f) glyph = " ";

            // Episode-based accents with row caps (smoothed with noise fields)
            if (!out){
                float epi = fbm2(u*4.3f + time*0.12f, v*4.3f - time*0.10f, 2);
                switch (episode){
                    case EP_HAUNT:
                        if (epi < 0.04f && usedBat < capBat) { out = u8"👻"; ++usedBat; }
                        break;
                    case EP_FLAME:
                        if (epi < 0.06f && usedFire < capFire) { out = u8"🔥"; ++usedFire; }
                        break;
                    default: break;
                }
            }

            // Compose priority: head > arms/legs > base emoji
            // Global density cap: occasionally drop base glyph to keep negative space
            if (!out){
                float dmask = ((lcg(seed)>>8)&0xFFFF)/65535.f;
                if (dmask > density) glyph = " ";
            }
            if (out) line += out; else line += glyph;
        }
        // Clip/pad to width; write with black BG
        TDrawBuffer b; b.moveCStr(0, line.c_str(), TAttrPair{attr,attr}, W);
        // Fill to end to force black BG
        ushort written = std::min<ushort>(W, (ushort)line.size());
        if (written < (ushort)W) b.moveChar(written, ' ', attr, (ushort)(W - written));
        writeLine(0, y, W, 1, b);
    }
}

void TGenerativeMonsterPortalView::handleEvent(TEvent &ev){
    TView::handleEvent(ev);
    if (ev.what==evBroadcast && ev.message.command==cmTimerExpired){ if (timerId && ev.message.infoPtr==timerId){ advance(); drawView(); clearEvent(ev);} }
    else if (ev.what==evKeyDown){ char ch=ev.keyDown.charScan.charCode; bool handled=false; switch(ch){
        case ' ': if (timerId) stopTimer(); else startTimer(); handled=true; break;
        case 'g': glitchSpeed = std::min(0.02f, glitchSpeed * 1.25f); handled=true; break;
        case 'G': glitchSpeed = std::max(0.0002f, glitchSpeed * 0.8f); handled=true; break;
        case 'r': glitch = 0.f; handled=true; break;
        case 'w': whitespaceBias = std::min(0.8f, whitespaceBias + 0.05f); handled=true; break;
        case 'W': whitespaceBias = std::max(0.05f, whitespaceBias - 0.05f); handled=true; break;
        case 'd': density = std::min(1.f, density + 0.05f); handled=true; break;
        case 'D': density = std::max(0.f, density - 0.05f); handled=true; break;
        case 'c': crownRigidity = std::min(1.f, crownRigidity + 0.05f); handled=true; break;
        case 'C': crownRigidity = std::max(0.f, crownRigidity - 0.05f); handled=true; break;
        case 'e': epDuration = std::max(120, epDuration - 60); handled=true; break;
        case 'E': epDuration = std::min(2400, epDuration + 60); handled=true; break;
        default: break; }
        if (handled){ drawView(); clearEvent(ev);} }
}

void TGenerativeMonsterPortalView::setState(ushort s, Boolean en){ TView::setState(s,en); if ((s&sfExposed)!=0){ if (en){ frame=0; glitch=0.f; startTimer(); drawView(); } else stopTimer(); }}
void TGenerativeMonsterPortalView::changeBounds(const TRect& b){ TView::changeBounds(b); drawView(); }

class TGenerativeMonsterPortalWindow : public TWindow{
public:
    explicit TGenerativeMonsterPortalWindow(const TRect &r):TWindow(r,"",wnNoNumber),TWindowInit(&TGenerativeMonsterPortalWindow::initFrame){}
    void setup(unsigned ms){ options|=ofTileable; TRect c=getExtent(); c.grow(-1,-1); view = new TGenerativeMonsterPortalView(c,ms); insert(view); }
    virtual void changeBounds(const TRect& b) override { TWindow::changeBounds(b); if (view){ TRect c=getExtent(); c.grow(-1,-1); view->locate(c); view->drawView(); } setState(sfExposed, True); redraw(); }
private:
    static TFrame* initFrame(TRect r){ return new TNoTitleFrame(r);} 
    TGenerativeMonsterPortalView* view {nullptr};
};

TWindow* createGenerativeMonsterPortalWindow(const TRect &bounds){ auto *w=new TGenerativeMonsterPortalWindow(bounds); w->setup(90); return w; }
