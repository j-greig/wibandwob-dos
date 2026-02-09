/*---------------------------------------------------------*/
/*                                                         */
/*   ascii_grid_view.cpp - Fixed Cell ASCII Grid View     */
/*                                                         */
/*---------------------------------------------------------*/

#include "ascii_grid_view.h"
#define Uses_TWindow
#define Uses_TText
#include <tvision/tv.h>

TAsciiGridView::TAsciiGridView(const TRect &bounds, int gridW, int gridH)
    : TView(bounds), gw(gridW), gh(gridH)
{
    options |= ofSelectable;
    growMode = gfGrowAll;
    resizeGrid(gridW, gridH);
}

void TAsciiGridView::resizeGrid(int gridW, int gridH)
{
    gw = std::max(1, gridW);
    gh = std::max(1, gridH);
    glyphs.assign(gw * gh, std::string(1, ' '));
    flags.assign(gw * gh, 0);
    attrs.assign(gw * gh, TColorAttr(0x07));
}

void TAsciiGridView::clear(TColorAttr attr, char ch)
{
    for (auto &g : glyphs) g.assign(1, ch);
    std::fill(flags.begin(), flags.end(), 0);
    std::fill(attrs.begin(), attrs.end(), attr);
}

void TAsciiGridView::putChar(int x, int y, char ch, TColorAttr attr)
{
    if (x < 0 || y < 0 || x >= gw || y >= gh)
        return;
    size_t i = (size_t)y * gw + x;
    glyphs[i].assign(1, ch);
    flags[i] = 0;
    attrs[i] = attr;
}

void TAsciiGridView::putGlyph(int x, int y, const std::string &utf8, TColorAttr attr)
{
    if (x < 0 || y < 0 || x >= gw || y >= gh)
        return;
    size_t i = (size_t)y * gw + x;
    glyphs[i] = utf8;
    attrs[i] = attr;
    flags[i] = 0;
    // Determine display width. If it's 2, mark the trail cell to be skipped.
    size_t w = TText::width(TStringView(utf8.c_str(), utf8.size()));
    if (w > 1 && x + 1 < gw) {
        flags[i + 1] = 1; // trail marker
        glyphs[i + 1].clear();
        attrs[i + 1] = attr;
    }
}

void TAsciiGridView::draw()
{
    TDrawBuffer b;
    int W = std::min<int>(size.x, gw);
    int H = std::min<int>(size.y, gh);
    for (int y = 0; y < H; ++y) {
        // Fill line from grid
        for (int x = 0; x < W; ++x) {
            const size_t i = (size_t)y * gw + x;
            if (flags[i])
                continue; // skip trail cells
            const auto &g = glyphs[i];
            if (!g.empty())
                b.moveStr(x, TStringView(g.c_str(), g.size()), attrs[i]);
            else {
                b.putChar(x, ' ');
                b.putAttribute(x, attrs[i]);
            }
        }
        // Pad remainder if view wider than grid
        for (int x = W; x < size.x; ++x) {
            b.putChar(x, ' ');
            b.putAttribute(x, TColorAttr(0x07));
        }
        writeLine(0, y, size.x, 1, b);
    }
    // Pad remaining rows if view taller than grid
    for (int y = H; y < size.y; ++y) {
        for (int x = 0; x < size.x; ++x) {
            b.putChar(x, ' ');
            b.putAttribute(x, TColorAttr(0x07));
        }
        writeLine(0, y, size.x, 1, b);
    }
}

// Factory helper used by the app to avoid direct dependency on the view type.
TWindow* createAsciiGridDemoWindow(const TRect &bounds)
{
    auto *w = new TWindow(bounds, "ASCII Grid Demo", wnNoNumber);
    w->options |= ofTileable;
    TRect c = w->getExtent();
    c.grow(-1, -1);
    int gw = std::max(10, c.b.x - c.a.x);
    int gh = std::max(5, c.b.y - c.a.y);
    auto *grid = new TAsciiGridView(c, gw, gh);
    grid->clear(TColorAttr(0x07), ' ');
    // Draw provided ASCII/emoji art, character by character.
    const char *art[] = {
        "    ,=''=.   ",
        "  ,'     ',  ",
        " /  👁  👁 \\ ",
        "(     ∆     )",
        " \\   ___   / ",
        "  '. ___ .'  ",
        "    '.,.'    ",
    };
    int lines = sizeof(art)/sizeof(art[0]);
    int startY = std::max(0, (gh - lines) / 2);
    for (int li = 0; li < lines && startY + li < gh; ++li) {
        std::string line = art[li];
        int x = std::max(0, (gw - (int)line.size()) / 2); // rough center; width calc happens per glyph
        size_t p = 0;
        while (p < line.size() && x < gw) {
            size_t len = TText::next(TStringView(line.c_str() + p, line.size() - p));
            if (len == 0) break;
            std::string g = line.substr(p, len);
            grid->putGlyph(x, startY + li, g, TColorAttr(0x07));
            size_t wcols = TText::width(TStringView(g.c_str(), g.size()));
            x += (int)std::max<size_t>(1, wcols);
            p += len;
        }
    }
    w->insert(grid);
    return w;
}
