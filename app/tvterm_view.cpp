#define Uses_TEvent
#define Uses_TRect
#define Uses_TPoint
#define Uses_TWindow
#define Uses_MsgBox
#include <tvision/tv.h>

#include "tvterm_view.h"
#include <tvterm/termctrl.h>
#include <tvterm/vtermemu.h>

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
