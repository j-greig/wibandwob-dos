/*---------------------------------------------------------*/
/*                                                         */
/*   frame_file_player_main.cpp - Minimal TV app          */
/*   Plays ASCII frames from --file <path>                */
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
#define Uses_MsgBox
#include <tvision/tv.h>

#include <string>
#include <cstring>
#include <cstdlib>

#include "frame_file_player_view.h"

class AnimWindow : public TWindow {
public:
    AnimWindow(const TRect &bounds, const char *title, const std::string &path, unsigned periodMs)
        : TWindow(bounds, title, wnNoNumber), TWindowInit(&AnimWindow::initFrame) {
        options |= ofTileable;
        TRect client = getExtent();
        client.grow(-1, -1);
        view = new FrameFilePlayerView(client, path, periodMs);
        insert(view);
    }
private:
    static TFrame *initFrame(TRect r) { return new TFrame(r); }
    FrameFilePlayerView *view {nullptr};
};

class AnimApp : public TApplication {
public:
    AnimApp() : TProgInit(&AnimApp::initStatusLine, &AnimApp::initMenuBar, &AnimApp::initDeskTop) {}

    static TStatusLine *initStatusLine(TRect r) {
        r.a.y = r.b.y - 1;
        return new TStatusLine(r,
            *new TStatusDef(0, 0xFFFF) +
            *new TStatusItem("~Alt-X~ Exit", kbAltX, cmQuit) +
            *new TStatusItem("~F10~ Menu", kbF10, cmMenu)
        );
    }
    static TMenuBar *initMenuBar(TRect r) {
        r.b.y = r.a.y + 1;
        return new TMenuBar(r,
            *new TSubMenu("~F~ile", kbAltF) +
                *new TMenuItem("E~x~it", cmQuit, kbAltX, hcNoContext, "Alt-X")
        );
    }
    static TDeskTop *initDeskTop(TRect r) {
        // Full-screen desktop, no menu/status lines
        return new TDeskTop(r);
    }
};

static const char *getArg(int argc, char **argv, const char *key) {
    for (int i = 1; i < argc; ++i) {
        if (std::strcmp(argv[i], key) == 0 && i + 1 < argc)
            return argv[i + 1];
        if (std::strncmp(argv[i], "--file=", 8) == 0)
            return argv[i] + 8;
    }
    return nullptr;
}

static int getFpsArg(int argc, char **argv) {
    for (int i = 1; i < argc; ++i) {
        if (std::strcmp(argv[i], "--fps") == 0 && i + 1 < argc)
            return std::atoi(argv[i + 1]);
        if (std::strncmp(argv[i], "--fps=", 7) == 0)
            return std::atoi(argv[i] + 7);
    }
    return 0;
}

int main(int argc, char **argv) {
    const char *path = getArg(argc, argv, "--file");
    if (!path || std::strlen(path) == 0) {
        // Avoid UI before app init; print to stderr
        fprintf(stderr, "Usage: frame_file_player --file <path>\n");
        return 2;
    }

    AnimApp app;

    // Create window around ~80x25 client area
    TRect r(2, 1, 82, 26); // will adapt to terminal size
    int fps = getFpsArg(argc, argv);
    unsigned periodMs = 300;
    if (fps > 0) {
        periodMs = (unsigned)(1000 / fps);
        if (periodMs == 0) periodMs = 1;
    }
    AnimWindow *w = new AnimWindow(r, "Animation", path, periodMs);

    // Validate load status before entering modal loop
    // The view is the first (and only) subview in the window
    FrameFilePlayerView *view = nullptr;
    for (TView *v = w->first(); v; v = v->next) {
        view = dynamic_cast<FrameFilePlayerView *>(v);
        if (view) break;
    }

    if (!view || !view->ok()) {
        std::string msg = view ? view->error() : std::string("Failed to initialize view");
        messageBox(msg.c_str(), mfError | mfOKButton);
        delete w;
        return 1;
    }

    // Insert window and run the app so menubar/status line are active.
    // Using run() instead of execView() avoids blocking menu event handling
    // and enables F10 (open menu) and Alt-X (cmQuit) shortcuts.
    app.deskTop->insert(w);
    app.run();
    return 0;
}
