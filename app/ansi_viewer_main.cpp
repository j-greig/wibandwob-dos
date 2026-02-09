/*---------------------------------------------------------*/
/*                                                         */
/*   ansi_viewer_main.cpp - Minimal ANSI viewer app       */
/*                                                         */
/*---------------------------------------------------------*/

#define Uses_TApplication
#define Uses_TWindow
#define Uses_TRect
#define Uses_TFrame
#define Uses_TDeskTop
#define Uses_TMenuBar
#define Uses_TMenu
#define Uses_TSubMenu
#define Uses_TMenuItem
#define Uses_TStatusLine
#define Uses_TStatusDef
#define Uses_TStatusItem
#define Uses_TKeys
#define Uses_TFileDialog
#include <tvision/tv.h>

#include <cstring>
#include <string>

#include "ansi_view.h"

class AnsiApp : public TApplication {
public:
    AnsiApp() : TProgInit(&AnsiApp::initStatusLine, &AnsiApp::initMenuBar, &AnsiApp::initDeskTop) {}

    static TStatusLine *initStatusLine(TRect r) {
        r.a.y = r.b.y - 1;
        return new TStatusLine(r,
            *new TStatusDef(0, 0xFFFF) +
            *new TStatusItem("~F10~ Menu", kbF10, cmMenu) +
            *new TStatusItem("~Alt-X~ Exit", kbAltX, cmQuit)
        );
    }
    static TMenuBar *initMenuBar(TRect r) {
        r.b.y = r.a.y + 1;
        return new TMenuBar(r,
            *new TSubMenu("~F~ile", kbAltF) +
                *new TMenuItem("~O~pen ANSI...", cmFileOpen, kbCtrlO) +
                *new TMenuItem("E~x~it", cmQuit, kbAltX, hcNoContext, "Alt-X")
        );
    }
    static TDeskTop *initDeskTop(TRect r) { return new TDeskTop(r); }
};

static const char *getArg(int argc, char **argv, const char *key) {
    for (int i = 1; i < argc; ++i) {
        if (std::strcmp(argv[i], key) == 0 && i + 1 < argc)
            return argv[i + 1];
        if (std::strncmp(argv[i], "--file=", 7) == 0)
            return argv[i] + 7;
    }
    return nullptr;
}

int main(int argc, char **argv) {
    AnsiApp app;

    std::string path;
    if (const char *p = getArg(argc, argv, "--file")) path = p;
    if (path.empty()) {
        TFileDialog *dlg = new TFileDialog("test-tui/ansi/*.ans", "Open ANSI Art", "~N~ame", fdOpenButton, 101);
        ushort res = TProgram::deskTop->execView(dlg);
        char sel[260] = {};
        if (res != cmCancel) { dlg->getData(sel); path = sel; }
        TObject::destroy(dlg);
        if (path.empty()) return 0;
    }

    // Create window and load
    TRect r(2, 1, 82, 26);
    TAnsiMiniWindow *w = new TAnsiMiniWindow(r, "ANSI Art", path);
    TProgram::deskTop->insert(w);
    app.run();
    return 0;
}
