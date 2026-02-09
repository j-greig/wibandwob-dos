/*---------------------------------------------------------*/
/*                                                         */
/*   ansi_view.h - Minimal ANSI art viewer (MVP)          */
/*                                                         */
/*   TL;DR                                                 */
/*   - What: A tiny, self-contained ANSI art viewer for    */
/*     Turbo Vision. Parses SGR color (ESC[...m), CR/LF,    */
/*     and tabs; renders with TScroller + color runs.       */
/*   - Where: Standalone module + microapp (ansi_viewer).   */
/*   - How to (re)integrate:                               */
/*       1) Add menu item to open an ANSI file:             */
/*            TFileDialog dlg("test-tui/ansi/*.ans", ...);  */
/*            // get selected path into `fileName`          */
/*            TAnsiMiniWindow *w = new TAnsiMiniWindow(     */
/*                bounds, "ANSI Art", fileName);            */
/*            deskTop->insert(w);                           */
/*       2) Link this module: add ansi_view.cpp to your     */
/*          target sources and include "ansi_view.h".       */
/*       3) Optional: Persist window type "ansi_art" with   */
/*          path + h/v scroll + encoding for workspace.     */
/*   - Limits (MVP): No cursor moves, no 256/24-bit color,  */
/*     assumes UTF-8 samples; unescapes C-style \x1b in our  */
/*     repo samples for convenience.                        */
/*                                                         */
/*   This header intentionally has thorough comments to     */
/*   make it easy for another dev/LLM to plug back into     */
/*   test-tui or other apps.                                */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef ANSI_VIEW_H
#define ANSI_VIEW_H

#define Uses_TScroller
#define Uses_TScrollBar
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TColorAttr
#define Uses_TWindow
#define Uses_TFrame
#include <tvision/tv.h>

#include <string>
#include <vector>

struct AnsiSegment {
    std::string text;
    TColorAttr attr;
};

struct AnsiLine {
    std::vector<AnsiSegment> segs;
    int length = 0; // printable length (after tab expand)
};

class TAnsiMiniView : public TScroller {
public:
    TAnsiMiniView(const TRect& bounds, TScrollBar* hScroll, TScrollBar* vScroll);
    bool loadFile(const std::string &path);
    virtual void draw() override;

private:
    std::vector<AnsiLine> lines;
    int docWidth = 0;
    int docHeight = 0;

    // SGR parsing helpers
    struct AttrState { int fg=7; int bg=0; bool bold=false; } state;
    static TColorAttr makeAttr(const AttrState &st);
    void setLimitsFromDoc();
};

class TAnsiMiniWindow : public TWindow {
public:
    TAnsiMiniWindow(const TRect &bounds, const char *title, const std::string &path);
private:
    static TFrame* initFrame(TRect r) { return new TFrame(r); }
};

#endif // ANSI_VIEW_H
