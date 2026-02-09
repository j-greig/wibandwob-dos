/*---------------------------------------------------------*/
/*                                                         */
/*   generative_verse_view.cpp - Verse Field (Generative) */
/*                                                         */
/*   Full-window evolving generative field using layered   */
/*   trigonometric fields and gradient palettes.          */
/*                                                         */
/*---------------------------------------------------------*/

#include "generative_verse_view.h"
#include "notitle_frame.h"

#define Uses_TWindow
#define Uses_TFrame
#include <tvision/tv.h>

#include <vector>
#include <string>
#include <cmath>
#include <algorithm>

namespace {

static inline float fract(float x) { return x - std::floor(x); }
static inline float mixf(float a, float b, float t) { return a + (b - a) * t; }
static inline float clampf(float x, float a=0.f, float b=1.f) { return std::max(a, std::min(b, x)); }

struct RGB { float r,g,b; };
static inline RGB mix(const RGB &a, const RGB &b, float t){ return { mixf(a.r,b.r,t), mixf(a.g,b.g,t), mixf(a.b,b.b,t) }; }

// A few artist-leaning palettes (muted→neon gradients)
static const RGB kPalettes[][5] = {
    { {0.05f,0.06f,0.08f}, {0.18f,0.19f,0.22f}, {0.42f,0.28f,0.36f}, {0.82f,0.58f,0.35f}, {0.98f,0.87f,0.65f} }, // dusk to sand
    { {0.02f,0.05f,0.02f}, {0.06f,0.24f,0.15f}, {0.16f,0.45f,0.44f}, {0.44f,0.70f,0.86f}, {0.95f,0.96f,0.98f} }, // forest to sky
    { {0.03f,0.03f,0.07f}, {0.20f,0.10f,0.35f}, {0.55f,0.20f,0.70f}, {0.95f,0.40f,0.80f}, {1.00f,0.95f,1.00f} }, // violet bloom
};

static inline RGB paletteSample(int paletteIndex, float t)
{
    const int n = (int)(sizeof(kPalettes[0])/sizeof(kPalettes[0][0]));
    const RGB *p = kPalettes[ paletteIndex % (int)(sizeof(kPalettes)/sizeof(kPalettes[0])) ];
    t = clampf(t);
    float x = t * (n - 1);
    int i = (int)std::floor(x);
    int j = std::min(n - 1, i + 1);
    float f = x - i;
    return mix(p[i], p[j], f);
}

// Shades from light to dense.
static const char* kShades = " .:-=+*#%@"; // length 10

static inline char shadeFor(float t)
{
    t = clampf(t);
    int idx = std::min(9, std::max(0, (int)std::floor(t * 9.999f)));
    return kShades[idx];
}

// Hash-y noise (cheap): repeatable, no tables.
static inline float hash2(int x, int y)
{
    uint32_t h = (uint32_t)(x * 374761393 + y * 668265263); // large primes
    h = (h ^ (h >> 13)) * 1274126177u;
    return ((h ^ (h >> 16)) & 0xFFFFFF) / float(0xFFFFFF); // [0..1)
}

// Smooth-ish pseudo noise via bilinear of hash2 at cell corners.
static inline float valueNoise(float x, float y)
{
    int xi = (int)std::floor(x), yi = (int)std::floor(y);
    float xf = x - xi, yf = y - yi;
    float v00 = hash2(xi, yi), v10 = hash2(xi+1, yi);
    float v01 = hash2(xi, yi+1), v11 = hash2(xi+1, yi+1);
    float vx0 = mixf(v00, v10, xf);
    float vx1 = mixf(v01, v11, xf);
    return mixf(vx0, vx1, yf);
}

// Multi-octave noise
static inline float fbm(float x, float y, int oct=4)
{
    float a = 0.5f, f = 1.8f, amp = 0.5f, sum = 0.f;
    for (int i=0;i<oct;++i) { sum += valueNoise(x*f, y*f) * amp; f *= 1.9f; amp *= a; }
    return sum;
}

} // namespace

TGenerativeVerseView::TGenerativeVerseView(const TRect &bounds, unsigned periodMs)
    : TView(bounds), periodMs(periodMs)
{
    options |= ofSelectable;
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evBroadcast;
    eventMask |= evKeyboard;
}

TGenerativeVerseView::~TGenerativeVerseView() { stopTimer(); }

void TGenerativeVerseView::setSpeed(unsigned periodMs_) {
    periodMs = periodMs_ ? periodMs_ : 1;
    if (timerId) { stopTimer(); startTimer(); }
}

void TGenerativeVerseView::startTimer(){ if (!timerId) timerId = setTimer(periodMs, (int)periodMs); }
void TGenerativeVerseView::stopTimer(){ if (timerId){ killTimer(timerId); timerId = 0; } }
void TGenerativeVerseView::advance(){ ++frame; }

void TGenerativeVerseView::draw()
{
    int W = size.x, H = size.y; if (W<=0||H<=0) return;
    std::vector<TScreenCell> line; line.resize((size_t)W);

    // Time parameters
    float t = frame * 0.035f;
    float t2 = frame * 0.021f;
    float cx = (W - 1) * 0.5f, cy = (H - 1) * 0.5f;
    float invW = W ? 1.f / W : 1.f, invH = H ? 1.f / H : 1.f;

    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            // Normalised coords around centre
            float u = (x - cx) * invW * 2.f;
            float v = (y - cy) * invH * 2.f;
            float r = std::sqrt(u*u + v*v) + 1e-6f;
            float ang = std::atan2(v, u);

            // Base fields per mode
            float f=0.f;
            switch (mode) {
                case mdFlow:
                    f = 0.55f + 0.45f * std::sin( (u*3.1f + std::sin(v*2.3f + t)) * 1.2f + t );
                    f += 0.25f * std::sin( (v*4.2f + std::cos(u*1.7f - t*1.3f)) * 1.1f - t2 );
                    break;
                case mdSwirl:
                    f = 0.5f + 0.5f * std::sin( (ang*3.5f + r*5.0f) - t*2.0f );
                    f = 0.7f * f + 0.3f * std::sin( r*8.0f - t*1.5f );
                    break;
                case mdWeave:
                    f = 0.5f + 0.5f * ( std::sin(u*6.0f + t*1.8f) * std::cos(v*6.0f - t*1.2f) );
                    f = 0.6f * f + 0.4f * std::sin((u+v)*4.0f + t);
                    break;
            }

            // Add soft noise detail
            float n = fbm(u*3.0f + t*0.6f, v*3.0f - t*0.5f, 3);
            float val = clampf( f*0.75f + n*0.35f );

            // Palette: rotate index slowly
            float hueT = fract(val + std::sin(t*0.23f + r*0.7f)*0.15f + paletteIndex*0.11f);
            RGB c = paletteSample(paletteIndex, hueT);

            // Luma for glyph selection; slight bias to improve contrast
            float luma = clampf( 0.2126f*c.r + 0.7152f*c.g + 0.0722f*c.b );
            char ch = shadeFor( (val*0.6f + luma*0.4f) );

            // Map color to TColorRGB 0..255
            auto to8 = [](float x)->uchar{ int v = (int)std::round(clampf(x)*255.f); return (uchar)std::max(0,std::min(255,v)); };
            TColorRGB fg(to8(c.r), to8(c.g), to8(c.b));
            // Dark background to let colour glow; slight vignette by radius
            float bgk = clampf(0.05f + 0.25f * (r*0.5f));
            TColorRGB bg(to8(bgk), to8(bgk*0.95f), to8(bgk*0.9f));

            ::setCell(line[(size_t)x], ch, TColorAttr(fg, bg));
        }
        writeLine(0, y, W, 1, line.data());
    }
}

void TGenerativeVerseView::handleEvent(TEvent &ev)
{
    TView::handleEvent(ev);
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId != 0 && ev.message.infoPtr == timerId) { advance(); drawView(); clearEvent(ev); }
    } else if (ev.what == evKeyDown) {
        char ch = ev.keyDown.charScan.charCode; bool handled=false;
        switch (ch) {
            case 'p': case 'P': paletteIndex = (paletteIndex + 1) % 3; handled = true; break;
            case 'o': case 'O': paletteIndex = (paletteIndex + 2) % 3; handled = true; break;
            case 'm': case 'M': mode = (Mode)(((int)mode + 1) % 3); handled = true; break;
            case ' ': if (timerId) stopTimer(); else startTimer(); handled = true; break;
            default: break;
        }
        if (handled) { drawView(); clearEvent(ev); }
    }
}

void TGenerativeVerseView::setState(ushort aState, Boolean enable)
{
    TView::setState(aState, enable);
    if ((aState & sfExposed) != 0) {
        if (enable) { frame = 0; startTimer(); drawView(); }
        else stopTimer();
    }
}

void TGenerativeVerseView::changeBounds(const TRect& bounds) { TView::changeBounds(bounds); drawView(); }

// Wrapper window
class TGenerativeVerseWindow : public TWindow {
public:
    explicit TGenerativeVerseWindow(const TRect &bounds)
        : TWindow(bounds, "", wnNoNumber)
        , TWindowInit(&TGenerativeVerseWindow::initFrame) {}
    void setup(unsigned periodMs) { options |= ofTileable; TRect c=getExtent(); c.grow(-1,-1); insert(new TGenerativeVerseView(c, periodMs)); }
    virtual void changeBounds(const TRect& b) override { TWindow::changeBounds(b); setState(sfExposed, True); redraw(); }
private: 
    static TFrame* initFrame(TRect r) { 
        // Use the same custom frame that handles empty titles properly
        return new TNoTitleFrame(r); 
    }
};

TWindow* createGenerativeVerseWindow(const TRect &bounds) { auto *w = new TGenerativeVerseWindow(bounds); w->setup(/*periodMs=*/50); return w; }

