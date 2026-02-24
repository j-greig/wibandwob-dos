#include "frame_animation_window.h"

#include "frame_file_player_view.h"
#include "notitle_frame.h"

// Keep these IDs aligned with wwdos_app.cpp context-menu commands.
static const ushort cmCtxToggleShadow = 250;
static const ushort cmCtxClearTitle = 251;
static const ushort cmCtxToggleFrame = 252;
static const ushort cmCtxGalleryToggle = 253;

TFrameAnimationWindow::TFrameAnimationWindow(const TRect& bounds, const char* aTitle,
                                             const std::string& filePath,
                                             bool frameless, bool shadowless) :
    TWindow(bounds, aTitle, wnNoNumber),
    TWindowInit(frameless ? &TFrameAnimationWindow::initFrameless
                          : &TFrameAnimationWindow::initFrame),
    filePath_(filePath),
    frameless_(frameless)
{
    options |= ofTileable;

    if (shadowless)
        state &= ~sfShadow;

    TRect interior = getExtent();
    if (!frameless)
        interior.grow(-1, -1);

    if (hasFrameDelimiters(filePath)) {
        FrameFilePlayerView* animView = new FrameFilePlayerView(interior, filePath);
        insert(animView);
    } else {
        TTextFileView* textView = new TTextFileView(interior, filePath);
        insert(textView);
    }
}

void TFrameAnimationWindow::changeBounds(const TRect& bounds)
{
    TWindow::changeBounds(bounds);

    setState(sfExposed, True);

    forEach([](TView* view, void*) {
        if (auto* textView = dynamic_cast<TTextFileView*>(view))
            textView->drawView();
    }, nullptr);

    redraw();
}

TFrame* TFrameAnimationWindow::initFrame(TRect r)
{
    return new TNoTitleFrame(r);
}

TFrame* TFrameAnimationWindow::initFrameless(TRect r)
{
    return new TGhostFrame(r);
}

void TFrameAnimationWindow::handleEvent(TEvent& event)
{
    if (event.what == evMouseDown && event.mouse.buttons == mbRightButton) {
        bool hasShadow = (state & sfShadow) != 0;
        TMenu* popup = new TMenu(
            *new TMenuItem(hasShadow ? "Shadow ~O~ff" : "Shadow ~O~n",
                cmCtxToggleShadow, kbNoKey, hcNoContext, nullptr,
            new TMenuItem((title && title[0]) ? "Clear ~T~itle" : "Restore ~T~itle",
                cmCtxClearTitle, kbNoKey, hcNoContext, nullptr,
            new TMenuItem(frameless_ ? "Show ~F~rame" : "Hide ~F~rame",
                cmCtxToggleFrame, kbNoKey, hcNoContext, nullptr,
            new TMenuItem("~G~allery Mode",
                cmCtxGalleryToggle, kbNoKey, hcNoContext, nullptr
            )))));

        TRect deskExt = owner->getExtent();
        TRect r(event.mouse.where.x, event.mouse.where.y,
                deskExt.b.x, deskExt.b.y);

        TMenuBox* box = new TMenuBox(r, popup, nullptr);
        ushort cmd = owner->execView(box);
        destroy(box);

        switch (cmd) {
            case cmCtxToggleShadow:
                setState(sfShadow, !hasShadow);
                if (owner) owner->drawView();
                break;
            case cmCtxClearTitle: {
                if (title && title[0]) {
                    savedTitle_ = title;
                    delete[] (char*)title;
                    title = nullptr;
                } else if (!savedTitle_.empty()) {
                    delete[] (char*)title;
                    title = newStr(savedTitle_);
                }
                if (frame) frame->drawView();
                break;
            }
            case cmCtxToggleFrame: {
                if (!frame) break;
                TRect fBounds = frame->getBounds();
                remove(frame);
                destroy(frame);
                if (frameless_) {
                    frame = initFrame(fBounds);
                    frameless_ = false;
                } else {
                    frame = initFrameless(fBounds);
                    frameless_ = true;
                }
                insertBefore(frame, nullptr);
                if (owner) owner->drawView();
                else drawView();
                break;
            }
            case cmCtxGalleryToggle: {
                TEvent galEvt = {};
                galEvt.what = evCommand;
                galEvt.message.command = cmCtxGalleryToggle;
                putEvent(galEvt);
                break;
            }
        }
        clearEvent(event);
        return;
    }
    TWindow::handleEvent(event);
}
