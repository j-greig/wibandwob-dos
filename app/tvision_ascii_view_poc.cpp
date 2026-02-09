/*
Turbo Vision ASCII Image Viewer — Proof of Concept (single-file package)
======================================================================

Purpose
-------
A minimal yet well-structured proof of concept that turns a bitmap image into a grid of
(text glyph, foreground color, background color) cells and renders it inside a Turbo Vision
(T-Vision) `TView`. The renderer is independent from UI, so it can also dump to stdout
when Turbo Vision is not present.

This file is intentionally single-file and self-contained:
- A tiny image loader via stb_image (assumed available in include path).
- A compact ASCII rasterizer with ordered dithering and a 16-color palette.
- An optional Turbo Vision front-end (`TAsciiImageView`) that paints via `TDrawBuffer`.
- A fallback CLI demo that prints to stdout if Turbo Vision is not available.

How to build
------------
1) With Turbo Vision available in this repo (via CMake target):
   - `cmake -S test-tui -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --target tv_ascii_view`
   - Run: `./build/tv_ascii_view path/to/image.png`

2) Without Turbo Vision (stdout fallback):
   - `cmake --build build --target ascii_dump`
   - Run: `./build/ascii_dump path/to/image.png`

Notes
-----
- The glyph selection uses a luminance ramp (fast). Swap a glyph atlas later.
- Dithering: ordered Bayer 4x4. Error diffusion can be added later.
- Colors: maps to ANSI 16-color set. Turbo Vision attribute mapping is provided.
- Aspect ratio: character cells are assumed non-square. Tunable pixel aspect.
*/

// -----------------------------------------------------------------------------
// [1] Forward declarations and small helpers
// -----------------------------------------------------------------------------
#include <algorithm>
#include <array>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <functional>
#include <iostream>
#include <memory>
#include <string>
#include <tuple>
#include <vector>
#include <cmath>
#include <locale.h>
#include <unistd.h>
#include <sys/ioctl.h>

// Optional Turbo Vision front-end
#ifdef TVISION_AVAILABLE
  #define Uses_TApplication
  #define Uses_TEvent
  #define Uses_TRect
  #define Uses_TMenuBar
  #define Uses_TStatusLine
  #define Uses_TDeskTop
  #define Uses_TView
  #define Uses_TDrawBuffer
  #define Uses_MsgBox
  #include <tvision/tv.h>
#endif

// Clamp helper
static inline float clampf(float x, float a, float b) { return x < a ? a : (x > b ? b : x); }
static inline int clampi(int x, int a, int b) { return x < a ? a : (x > b ? b : x); }

// RAII unique_ptr for arrays
template <typename T>
using uptr = std::unique_ptr<T, void(*)(T*)>;

// -----------------------------------------------------------------------------
// [2] Minimal stb_image loader (assumes stb_image.h is available)
// -----------------------------------------------------------------------------
#define STB_IMAGE_IMPLEMENTATION
#define STBI_NO_THREAD_LOCALS
#define STBI_ONLY_PNG
#define STBI_ONLY_JPEG
#include <stdint.h>
extern "C" {
#include "stb_image.h"
}

struct Image {
    int w=0, h=0, comp=0; // comp == 3 or 4
    std::vector<uint8_t> pixels; // RGBA
};

static Image loadImageRGBA(const std::string &path) {
    Image img;
    int w,h,n;
    stbi_uc *data = stbi_load(path.c_str(), &w, &h, &n, 4);
    if (!data) {
        const char *reason = stbi_failure_reason();
        std::string msg = "Failed to load image: "+path;
        if (reason) { msg += " ("; msg += reason; msg += ")"; }
        throw std::runtime_error(msg);
    }
    img.w=w; img.h=h; img.comp=4; img.pixels.assign(data, data + (size_t)w*h*4);
    stbi_image_free(data);
    return img;
}

// -----------------------------------------------------------------------------
// [3] Core types: Cell, Grid, Palette
// -----------------------------------------------------------------------------
struct Cell {
    char32_t ch;    // glyph
    uint8_t  fg;    // 0..15 (ANSI 16-color index)
    uint8_t  bg;    // 0..15
};

struct Grid {
    int cols=0, rows=0;
    std::vector<Cell> cells; // size == cols*rows
};

struct RGB { float r,g,b; };

// ANSI 16-color palette (approximate sRGB). Index order matches common ANSI indices.
static const std::array<RGB,16> ANSI16 = { RGB{0,0,0},        // 0 black
    RGB{0.8f,0,0},          // 1 red
    RGB{0,0.8f,0},          // 2 green
    RGB{0.8f,0.8f,0},       // 3 yellow
    RGB{0,0,0.8f},          // 4 blue
    RGB{0.8f,0,0.8f},       // 5 magenta
    RGB{0,0.8f,0.8f},       // 6 cyan
    RGB{0.75f,0.75f,0.75f}, // 7 white (light gray)
    RGB{0.4f,0.4f,0.4f},    // 8 bright black (dark gray)
    RGB{1,0.3f,0.3f},       // 9 bright red
    RGB{0.3f,1,0.3f},       // 10 bright green
    RGB{1,1,0.3f},          // 11 bright yellow
    RGB{0.3f,0.3f,1},       // 12 bright blue
    RGB{1,0.3f,1},          // 13 bright magenta
    RGB{0.3f,1,1},          // 14 bright cyan
    RGB{1,1,1}              // 15 bright white
};

static inline float luma(float r, float g, float b) {
    // Rec. 709 luma
    return 0.2126f*r + 0.7152f*g + 0.0722f*b;
}

// -----------------------------------------------------------------------------
// [4] Dithering utilities (Bayer 4x4)
// -----------------------------------------------------------------------------
static const int BAYER4[4][4] = {
    { 0,  8,  2, 10},
    {12,  4, 14,  6},
    { 3, 11,  1,  9},
    {15,  7, 13,  5}
};

static inline float bayerThreshold4x4(int x, int y) {
    // Normalize to [0,1). Add 0.5 to center thresholds.
    return (BAYER4[y & 3][x & 3] + 0.5f) / 16.0f;
}

// -----------------------------------------------------------------------------
// [5] Quantization (RGB → closest ANSI16 index)
// -----------------------------------------------------------------------------
static inline int closestAnsi16(float r, float g, float b) {
    int idx = 0; float best = 1e9f;
    for (int i=0;i<16;++i) {
        float dr = r - ANSI16[i].r;
        float dg = g - ANSI16[i].g;
        float db = b - ANSI16[i].b;
        float d2 = dr*dr + dg*dg + db*db;
        if (d2 < best) { best = d2; idx = i; }
    }
    return idx;
}

// -----------------------------------------------------------------------------
// [6] Glyph mapping (luma → glyph)
// -----------------------------------------------------------------------------
// Unicode-friendly ramp (light → dark). Keep ASCII-only option.
static const char32_t RAMP_UNI[] =
    U" .'`^,:;Il!i~+_-?][}{1)(|\\/"
    U"tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
static const char32_t RAMP_BLOCKS[] = U" ░▒▓█"; // spaced for lighter start
static const char32_t RAMP_ASCII[] = U" .:-=+*#%@";
constexpr size_t LEN_UNI    = sizeof(RAMP_UNI   )/sizeof(char32_t) - 1;
constexpr size_t LEN_BLOCKS = sizeof(RAMP_BLOCKS)/sizeof(char32_t) - 1;
constexpr size_t LEN_ASCII  = sizeof(RAMP_ASCII )/sizeof(char32_t) - 1;

struct GlyphConfig {
    enum class Mode { Blocks, Unicode, Ascii };
    Mode mode = Mode::Blocks;
};

static char32_t glyphForLuma(float y, const GlyphConfig &cfg) {
    const char32_t *ramp = nullptr; size_t N = 0;
    switch (cfg.mode) {
        case GlyphConfig::Mode::Blocks:   ramp = RAMP_BLOCKS; N = LEN_BLOCKS; break;
        case GlyphConfig::Mode::Unicode:  ramp = RAMP_UNI;    N = LEN_UNI;    break;
        case GlyphConfig::Mode::Ascii:    ramp = RAMP_ASCII;  N = LEN_ASCII;  break;
    }
    float t = clampf(y, 0.f, 1.f);
    size_t i = (size_t) std::lround(t * (N - 1));
    return ramp[i];
}

// -----------------------------------------------------------------------------
// [7] Rasterizer (image → CellGrid)
// -----------------------------------------------------------------------------
struct RenderParams {
    int cols = 80;
    int rows = 24;
    bool orderedDither = true;
    // Approximate aspect ratio correction. Each text cell represents cw × ch source pixels.
    float cellAspectW = 1.0f;
    float cellAspectH = 2.0f;
    GlyphConfig glyphCfg;
};

static Grid rasterizeToGrid(const Image &img, const RenderParams &rp) {
    Grid g; g.cols = rp.cols; g.rows = rp.rows; g.cells.resize((size_t)g.cols*g.rows);

    if (img.w == 0 || img.h == 0) return g;

    // Effective cell aspect correction: treat a text cell as (W:H) = (cellAspectW:cellAspectH)
    float cellAspect = rp.cellAspectH / std::max(1.0f, rp.cellAspectW);
    float effRows = rp.rows * cellAspect;

    // Fit entire image into (cols, effRows) while preserving aspect (letterbox/pillarbox)
    float sx_full = (float)img.w / std::max(1, rp.cols);
    float sy_full = (float)img.h / std::max(1.0f, effRows);
    float s = std::min(sx_full, sy_full);
    float vw = rp.cols * s;      // viewport width in source pixels
    float vh = effRows * s;      // viewport height in source pixels
    float xOff = ((float)img.w - vw) * 0.5f;
    float yOff = ((float)img.h - vh) * 0.5f;

    // Size of one cell in source pixels
    float cellW = vw / std::max(1, rp.cols);
    float cellH = vh / std::max(1, rp.rows);

    for (int cy=0; cy<g.rows; ++cy) {
        for (int cx=0; cx<g.cols; ++cx) {
            // Source region for this cell (letterboxed, half-open intervals)
            float x0 = xOff + cx * cellW;
            float y0 = yOff + cy * cellH;
            float x1 = xOff + (cx+1) * cellW;
            float y1 = yOff + (cy+1) * cellH;

            int ix0 = clampi((int)std::floor(x0), 0, img.w);
            int iy0 = clampi((int)std::floor(y0), 0, img.h);
            int ix1 = clampi((int)std::ceil (x1), 0, img.w);
            int iy1 = clampi((int)std::ceil (y1), 0, img.h);
            if (ix1 <= ix0) ix1 = std::min(ix0+1, img.w);
            if (iy1 <= iy0) iy1 = std::min(iy0+1, img.h);

            // Average RGB over the tile (blend over black)
            double sr=0, sg=0, sb=0; int count=0;
            for (int y=iy0; y<iy1; ++y) {
                const uint8_t *row = &img.pixels[(size_t)y*img.w*4];
                for (int x=ix0; x<ix1; ++x) {
                    const uint8_t *p = &row[x*4];
                    float a = p[3] / 255.0f;
                    float r = (p[0]/255.0f)*a; // over black
                    float g2= (p[1]/255.0f)*a;
                    float b = (p[2]/255.0f)*a;
                    sr += r; sg += g2; sb += b; ++count;
                }
            }
            float r = (float)(sr / std::max(1,count));
            float g2= (float)(sg / std::max(1,count));
            float b = (float)(sb / std::max(1,count));

            // Ordered dither on luma
            float y = luma(r,g2,b);
            if (rp.orderedDither) {
                float th = bayerThreshold4x4(cx, cy) - 0.5f; // center around 0
                y = clampf(y + th * 0.12f, 0.f, 1.f); // small push
            }

            // Pick glyph from luma
            char32_t ch = glyphForLuma(y, rp.glyphCfg);

            // Quantize color (foreground to tile average, background dark)
            int fg = closestAnsi16(r,g2,b);
            int bg = 0; // black background by default

            g.cells[(size_t)cy*g.cols + cx] = Cell{ ch, (uint8_t)fg, (uint8_t)bg };
        }
    }
    return g;
}

// -----------------------------------------------------------------------------
// [8] Turbo Vision view (guarded by TVISION_AVAILABLE)
// -----------------------------------------------------------------------------
#ifdef TVISION_AVAILABLE

// Map ANSI16 indices to Turbo Vision attributes (fg|bg). Turbo Vision typically
// packs attributes as (background << 4) | foreground for 16-color mode.
static inline uint8_t ansiToTVAttr(uint8_t fg, uint8_t bg) {
    return ((bg & 0x0F) << 4) | (fg & 0x0F);
}

class TAsciiImageView : public TView {
public:
    TAsciiImageView(const Image &img, const RenderParams &params)
    : TView(TRect(1,1,1,1)), original(img), rp(params)
    {
        growMode = gfGrowHiX | gfGrowHiY;
        options  |= ofSelectable;
    }

    virtual void draw() override {
        // Compute columns/rows from current view size (character units)
        TRect r = getExtent();
        int cols = r.b.x - r.a.x; if (cols <= 0) return;
        int rows = r.b.y - r.a.y; if (rows <= 0) return;

        if (dirty || cols != cached.cols || rows != cached.rows) {
            RenderParams rp2 = rp; rp2.cols = cols; rp2.rows = rows;
            cached = rasterizeToGrid(original, rp2);
            dirty = false;
        }

        auto toUtf8=[&](char32_t cp, char out[5]){ memset(out,0,5); uint32_t u=cp; if(u<0x80){out[0]=char(u);} else if(u<0x800){out[0]=char(0xC0|(u>>6)); out[1]=char(0x80|(u&0x3F));} else if(u<0x10000){out[0]=char(0xE0|(u>>12)); out[1]=char(0x80|((u>>6)&0x3F)); out[2]=char(0x80|(u&0x3F));} else {out[0]=char(0xF0|(u>>18)); out[1]=char(0x80|((u>>12)&0x3F)); out[2]=char(0x80|((u>>6)&0x3F)); out[3]=char(0x80|(u&0x3F));} };
        TDrawBuffer buf;
        for (int y=0; y<cached.rows; ++y) {
            buf.moveChar(0, ' ', TColorAttr(ansiToTVAttr(7,0)), cached.cols);
            for (int x=0; x<cached.cols; ++x) {
                const Cell &c = cached.cells[(size_t)y*cached.cols + x];
                char u8[5]; toUtf8(c.ch,u8);
                buf.moveStr(x, TStringView(u8, strlen(u8)), TColorAttr(ansiToTVAttr(c.fg, c.bg)));
            }
            writeLine(0, y, cached.cols, 1, &buf);
        }
    }

    virtual void handleEvent(TEvent &ev) override {
        if (ev.what == evKeyDown) {
            switch (ev.keyDown.keyCode) {
                case '+': case '=':
                    scale(1); clearEvent(ev); return;
                case '-': case '_':
                    scale(-1); clearEvent(ev); return;
                case 'g': case 'G':
                    cycleGlyphMode(); clearEvent(ev); return;
                case 'd': case 'D':
                    rp.orderedDither = !rp.orderedDither; dirty = true; drawView(); clearEvent(ev); return;
            }
        }
        TView::handleEvent(ev);
    }

private:
    Image original;
    RenderParams rp;
    Grid cached;
    bool dirty = true;

    void scale(int dir) {
        float s = (dir > 0) ? 0.9f : 1.1f;
        rp.cellAspectW = clampf(rp.cellAspectW * s, 0.5f, 2.0f);
        rp.cellAspectH = clampf(rp.cellAspectH * s, 1.0f, 3.0f);
        dirty = true; drawView();
    }

    void cycleGlyphMode() {
        using M = GlyphConfig::Mode;
        if      (rp.glyphCfg.mode == M::Blocks)  rp.glyphCfg.mode = M::Unicode;
        else if (rp.glyphCfg.mode == M::Unicode) rp.glyphCfg.mode = M::Ascii;
        else                                     rp.glyphCfg.mode = M::Blocks;
        dirty = true; drawView();
    }
};

class TAsciiApp : public TApplication {
public:
    TAsciiApp(const Image &img)
    : TProgInit(&TAsciiApp::initStatusLine, &TAsciiApp::initMenuBar, &TAsciiApp::initDeskTop)
    {
        RenderParams rp; rp.cols = 80; rp.rows = 24; rp.glyphCfg.mode = GlyphConfig::Mode::Blocks;
        view = new TAsciiImageView(img, rp);
        TRect r = deskTop->getExtent();
        insert(view);
        view->locate(r);
        view->select();
        messageBox("Keys: +/- zoom  |  d toggle dither  |  g cycle glyph set", mfInformation | mfOKButton);
    }
    static TMenuBar* initMenuBar(TRect) { return 0; }
    static TStatusLine* initStatusLine(TRect) { return 0; }
private:
    TAsciiImageView *view{};
};

#endif // TVISION_AVAILABLE

// -----------------------------------------------------------------------------
// [9] CLI fallback main
// -----------------------------------------------------------------------------
static void dumpGridToStdout(const Grid &g) {
    auto setfg = [](int idx){ std::printf("\x1b[%dm", (idx<8?30+idx:90+(idx-8))); };
    auto reset = [](){ std::printf("\x1b[0m"); };

    for (int y=0; y<g.rows; ++y) {
        for (int x=0; x<g.cols; ++x) {
            const Cell &c = g.cells[(size_t)y*g.cols + x];
            setfg(c.fg);
            char buf[5] = {0};
            uint32_t cp = (uint32_t)c.ch;
            if (cp < 0x80) { buf[0]=char(cp); }
            else if (cp < 0x800) { buf[0]=char(0xC0|(cp>>6)); buf[1]=char(0x80|(cp&0x3F)); }
            else if (cp < 0x10000) { buf[0]=char(0xE0|(cp>>12)); buf[1]=char(0x80|((cp>>6)&0x3F)); buf[2]=char(0x80|(cp&0x3F)); }
            else { buf[0]=char(0xF0|(cp>>18)); buf[1]=char(0x80|((cp>>12)&0x3F)); buf[2]=char(0x80|((cp>>6)&0x3F)); buf[3]=char(0x80|(cp&0x3F)); }
            std::fputs(buf, stdout);
        }
        reset(); std::fputc('\n', stdout);
    }
    reset();
}

int main(int argc, char** argv) {
    setlocale(LC_ALL, "");
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <image.(png|jpg)> [cols rows]\n";
        return 1;
    }
    std::string path = argv[1];

    int cols = 80, rows = 24;
    if (argc >= 4) {
        cols = std::max(8, std::atoi(argv[2]));
        rows = std::max(4, std::atoi(argv[3]));
    } else {
        // Try env vars first
        if (const char* ec = getenv("COLUMNS")) cols = std::max(8, atoi(ec));
        if (const char* er = getenv("LINES"))   rows = std::max(4, atoi(er));
        // If still attached to a TTY, query actual size
        if (isatty(STDOUT_FILENO)) {
            struct winsize ws; if (ioctl(STDOUT_FILENO, TIOCGWINSZ, &ws) != -1) {
                if (ws.ws_col > 0) cols = ws.ws_col;
                if (ws.ws_row > 0) rows = ws.ws_row;
            }
        }
    }

    try {
        Image img = loadImageRGBA(path);

        RenderParams rp; rp.cols = cols; rp.rows = rows; rp.glyphCfg.mode = GlyphConfig::Mode::Blocks;
        Grid g = rasterizeToGrid(img, rp);

    #ifdef TVISION_AVAILABLE
        // Launch Turbo Vision UI
        TAsciiApp app(img);
        app.run();
        return 0;
    #else
        // Fallback: dump to stdout
        dumpGridToStdout(g);
        return 0;
    #endif
    }
    catch (const std::exception &e) {
        std::cerr << "Error: " << e.what() << "\n";
        return 1;
    }
}
