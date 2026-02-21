#define Uses_TEvent
#define Uses_TRect
#define Uses_TPoint
#define Uses_TWindow
#define Uses_TKeys
#define Uses_MsgBox
#define Uses_TScreenCell
#include <tvision/tv.h>

#include "tvterm_view.h"
#include <tvterm/termctrl.h>
#include <tvterm/termview.h>
#include <tvterm/vtermemu.h>
#include <tvterm/termemu.h>
#include <cstring>

// Command IDs for tvterm integration — must not collide with existing app commands.
// These are wired through TVTermConstants so tvterm-core uses our IDs.
enum : ushort
{
    cmTvTermCheckUpdates = 500,
    cmTvTermUpdated      = 501,
    cmTvTermGrabInput    = 502,
    cmTvTermReleaseInput = 503,
    hcTvTermInputGrabbed = 504,
};

const tvterm::TVTermConstants TWibWobTerminalWindow::termConsts =
{
    cmTvTermCheckUpdates,
    cmTvTermUpdated,
    cmTvTermGrabInput,
    cmTvTermReleaseInput,
    hcTvTermInputGrabbed,
};

TWibWobTerminalWindow::TWibWobTerminalWindow(
    const TRect &bounds,
    tvterm::TerminalController &termCtrl
) noexcept :
    TWindowInit(&initFrame),
    Super(bounds, termCtrl, termConsts)
{
    options |= ofTileable;
    growMode = gfGrowAll | gfGrowRel;
}

void TWibWobTerminalWindow::handleEvent(TEvent &ev)
{
    if (ev.what == evKeyDown && isDisconnected() &&
        !(state & (sfDragging | sfModal)))
    {
        close();
        return;
    }
    Super::handleEvent(ev);
}

void TWibWobTerminalWindow::sizeLimits(TPoint &min, TPoint &max)
{
    Super::sizeLimits(min, max);
    if (owner)
    {
        max = owner->size;
        max.x += 2;
        max.y += 1;
    }
}

void TWibWobTerminalWindow::sendText(const std::string &text)
{
    // Find the TerminalView child to access its controller.
    tvterm::TerminalView *termView = nullptr;
    TView *start = first();
    if (start) {
        TView *v = start;
        do {
            if (auto *tv = dynamic_cast<tvterm::TerminalView*>(v)) {
                termView = tv;
                break;
            }
            v = v->next;
        } while (v != start);
    }
    if (!termView) return;

    // Send each byte as a KeyDown event through the terminal controller.
    for (unsigned char ch : text) {
        tvterm::TerminalEvent termEvent;
        termEvent.type = tvterm::TerminalEventType::KeyDown;
        memset(&termEvent.keyDown, 0, sizeof(termEvent.keyDown));

        if (ch == '\n' || ch == '\r') {
            // Enter key: send \r with proper kbEnter scancode (0x1c0d)
            termEvent.keyDown.charScan.charCode = '\r';
            termEvent.keyDown.keyCode = 0x1c0d; // kbEnter
            termEvent.keyDown.text[0] = '\r';
        } else {
            termEvent.keyDown.charScan.charCode = ch;
            termEvent.keyDown.keyCode = ch;
            termEvent.keyDown.text[0] = static_cast<char>(ch);
        }
        termEvent.keyDown.textLength = 1;
        termView->termCtrl.sendEvent(termEvent);
    }
}

std::string TWibWobTerminalWindow::getOutputText() const
{
    // Find the TerminalView child to access its controller.
    tvterm::TerminalView *termView = nullptr;
    TView *start = const_cast<TWibWobTerminalWindow*>(this)->first();
    if (start) {
        TView *v = start;
        do {
            if (auto *tv = dynamic_cast<tvterm::TerminalView*>(v)) {
                termView = tv;
                break;
            }
            v = v->next;
        } while (v != start);
    }
    if (!termView) return "";

    std::string result;
    termView->termCtrl.lockState([&](tvterm::TerminalState &state) {
        int rows = state.surface.size.y;
        int cols  = state.surface.size.x;
        for (int y = 0; y < rows; ++y) {
            std::string row;
            row.reserve(cols);
            for (int x = 0; x < cols; ++x) {
                const TScreenCell &cell = state.surface.at(y, x);
                const TCellChar   &ch   = cell._ch;
                if (!ch.isWideCharTrail()) {
                    TStringView sv = ch.getText();
                    row.append(sv.data(), sv.size());
                }
            }
            // Strip trailing whitespace per row
            size_t last = row.find_last_not_of(" \t");
            if (last != std::string::npos)
                row.erase(last + 1);
            else
                row.clear();
            result += row;
            result += '\n';
        }
    });
    return result;
}

static void onTermError(const char *reason)
{
    messageBox(mfError | mfOKButton, "Cannot create terminal: %s.", reason);
}

TWindow* createTerminalWindow(const TRect &bounds)
{
    using namespace tvterm;
    VTermEmulatorFactory factory;
    TPoint viewSize = BasicTerminalWindow::viewSize(bounds);
    auto *termCtrl = TerminalController::create(viewSize, factory, onTermError);
    if (!termCtrl)
        return nullptr;
    return new TWibWobTerminalWindow(bounds, *termCtrl);
}
