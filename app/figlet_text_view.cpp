#include "figlet_text_view.h"
#include "figlet_utils.h"
#include "ui/ui_helpers.h"

#define Uses_TProgram
#define Uses_TDeskTop
#define Uses_TGroup
#define Uses_TDialog
#define Uses_TInputLine
#define Uses_TLabel
#define Uses_TButton
#define Uses_TListBox
#define Uses_TScrollBar
#define Uses_TStringCollection
#define Uses_MsgBox
#include <tvision/tv.h>

#include <cstdio>
#include <cstring>
#include <algorithm>

// Context menu commands — must match wwdos_app.cpp values
static const ushort cmCtxToggleShadow  = 250;
static const ushort cmCtxClearTitle    = 251;
static const ushort cmCtxToggleFrame   = 252;
static const ushort cmCtxGalleryToggle = 253;

/*---------------------------------------------------------*/
/* TFigletTextView implementation                          */
/*---------------------------------------------------------*/

TFigletTextView::TFigletTextView(const TRect& bounds, const std::string& text,
                                 const std::string& font)
    : TView(bounds),
      text_(text),
      font_(font),
      fgColor_(0xFF, 0xFF, 0xFF),
      bgColor_(0x00, 0x00, 0x00)
{
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evMouseDown;
    rerender();
}

void TFigletTextView::rerender() {
    int cols = size.x;
    renderedLines_ = figlet::renderLines(text_, font_, cols);
    // If figlet not available, show plain text as fallback
    if (renderedLines_.empty() && !text_.empty()) {
        renderedLines_.push_back("[ " + text_ + " ]");
        renderedLines_.push_back("(figlet not available)");
    }
}

void TFigletTextView::draw() {
    TColorAttr attr = TColorAttr(fgColor_, bgColor_);
    TDrawBuffer b;

    for (int y = 0; y < size.y; y++) {
        b.moveChar(0, ' ', attr, size.x);
        if (y < (int)renderedLines_.size()) {
            const std::string& line = renderedLines_[y];
            int len = std::min((int)line.size(), (int)size.x);
            b.moveStr(0, line.substr(0, len).c_str(), attr);
        }
        writeLine(0, y, size.x, 1, b);
    }
}

void TFigletTextView::showEditTextDialog() {
    // Build a small input dialog
    TDialog* dlg = new TDialog(TRect(0, 0, 50, 8), "Edit FIGlet Text");
    dlg->options |= ofCentered;

    TInputLine* input = new TInputLine(TRect(3, 3, 47, 4), 255);
    // Pre-fill with current text
    input->setData((void*)text_.c_str());
    dlg->insert(input);
    dlg->insert(new TLabel(TRect(3, 2, 20, 3), "~T~ext:", input));
    dlg->insert(new TButton(TRect(18, 5, 30, 7), "~O~K", cmOK, bfDefault));
    dlg->insert(new TButton(TRect(32, 5, 44, 7), "Cancel", cmCancel, bfNormal));

    ushort result = TProgram::application->execView(dlg);
    if (result == cmOK) {
        char buf[256] = {};
        input->getData(buf);
        std::string newText(buf);
        if (!newText.empty() && newText != text_) {
            setText(newText);
            // Update window title to match
            if (owner) {
                TWindow* win = dynamic_cast<TWindow*>(owner);
                if (win) {
                    delete[] (char*)win->title;
                    win->title = newStr(newText);
                    if (win->frame) win->frame->drawView();
                }
            }
        }
    }
    TObject::destroy(dlg);
}

void TFigletTextView::showCombinedMenu(TPoint where) {
    // Combined menu: Edit Text + Font + chrome toggles (for frameless mode)
    TFigletTextWindow* parentWin = dynamic_cast<TFigletTextWindow*>(owner);
    bool hasShadow = parentWin ? (parentWin->getState(sfShadow) != 0) : false;

    // Chrome items at the bottom
    TMenuItem* chromeItems =
        new TMenuItem("Show ~F~rame", cmCtxToggleFrame, kbNoKey, hcNoContext, nullptr,
        new TMenuItem(hasShadow ? "Shadow ~O~ff" : "Shadow ~O~n",
            cmCtxToggleShadow, kbNoKey, hcNoContext, nullptr,
        new TMenuItem("~G~allery Mode",
            cmCtxGalleryToggle, kbNoKey, hcNoContext, nullptr,
        nullptr)));

    TMenu* popup = new TMenu(
        *new TMenuItem("Edit ~T~ext...", cmFigletEditText, kbNoKey, hcNoContext, nullptr,
        chromeItems));

    TRect ob = owner ? owner->getExtent() : getExtent();
    TRect r(where.x, where.y, ob.b.x, ob.b.y);

    TMenuBox* box = new TMenuBox(r, popup, nullptr);
    ushort cmd = owner ? owner->execView(box) : 0;
    destroy(box);

    if (cmd == cmFigletEditText) {
        showEditTextDialog();
    } else if (cmd == cmCtxToggleFrame || cmd == cmCtxToggleShadow || cmd == cmCtxGalleryToggle) {
        // Forward chrome commands to the parent window
        TEvent fwd = {};
        fwd.what = evCommand;
        fwd.message.command = cmd;
        if (parentWin) parentWin->handleEvent(fwd);
    }
}

void TFigletTextView::handleEvent(TEvent& event) {
    TView::handleEvent(event);

    // Double-click → edit text dialog
    if (event.what == evMouseDown && (event.mouse.buttons & mbLeftButton)
        && (event.mouse.eventFlags & meDoubleClick)) {
        showEditTextDialog();
        clearEvent(event);
        return;
    }

    if (event.what == evMouseDown && (event.mouse.buttons & mbRightButton)) {
        // Check if parent window is frameless — if so, include chrome toggles
        // since the window's own right-click handler can't fire (view covers all)
        TFigletTextWindow* parentWin = dynamic_cast<TFigletTextWindow*>(owner);
        if (parentWin && parentWin->isFrameless()) {
            showCombinedMenu(event.mouse.where);
        } else {
            showFontMenu(event.mouse.where);
        }
        clearEvent(event);
    }
}

void TFigletTextView::changeBounds(const TRect& bounds) {
    TView::changeBounds(bounds);
    rerender();
    drawView();
}

void TFigletTextView::setText(const std::string& text) {
    text_ = text;
    rerender();
    drawView();
}

void TFigletTextView::setFont(const std::string& font) {
    font_ = font;
    rerender();
    drawView();
}

void TFigletTextView::setFgColor(TColorRGB color) {
    fgColor_ = color;
    drawView();
}

void TFigletTextView::setBgColor(TColorRGB color) {
    bgColor_ = color;
    drawView();
}

void TFigletTextView::showFontMenu(TPoint where) {
    const auto& cat = figlet::catalogue();

    // Build category submenus (in reverse for correct linked-list order)
    TMenuItem* fontMenuTail = nullptr;

    // "More Fonts..." at bottom
    fontMenuTail = new TMenuItem("~M~ore Fonts...", cmFigletMoreFonts,
                                  kbNoKey, hcNoContext, nullptr, fontMenuTail);
    // Separator before "More Fonts..."
    TMenuItem* sep = &newLine();
    sep->next = fontMenuTail;
    fontMenuTail = sep;

    // Category submenus (reverse order so first category is at top)
    for (int c = (int)cat.categories.size() - 1; c >= 0; c--) {
        TMenuItem* catItems = figlet::buildCategoryMenuItems(
            cat.categories[c], cmFigletCatFontBase, font_);
        if (!catItems) continue;
        TMenu* catSub = new TMenu(*catItems);
        // Copy name for menu label
        std::string label = cat.categories[c].name;
        char* str = new char[label.size() + 1];
        std::strcpy(str, label.c_str());
        fontMenuTail = new TMenuItem(str, kbNoKey, catSub, hcNoContext, fontMenuTail);
    }

    TMenu* fontSub = fontMenuTail ? new TMenu(*fontMenuTail) : nullptr;

    // Top-level popup: Edit Text + Font submenu
    TMenuItem* top = nullptr;
    if (fontSub)
        top = new TMenuItem("~F~ont", kbNoKey, fontSub, hcNoContext, nullptr);
    top = new TMenuItem("Edit ~T~ext...", cmFigletEditText, kbNoKey, hcNoContext, nullptr, top);

    TMenu* popup = new TMenu(*top);

    // Position popup at mouse location
    TRect ob = owner ? owner->getExtent() : getExtent();
    TRect r(where.x, where.y, ob.b.x, ob.b.y);

    TMenuBox* box = new TMenuBox(r, popup, nullptr);
    ushort cmd = owner ? owner->execView(box) : 0;
    destroy(box);

    // Dispatch
    if (cmd == cmFigletEditText) {
        showEditTextDialog();
    } else if (cmd == cmFigletMoreFonts) {
        showFontListDialog();
    } else if (cmd >= cmFigletCatFontBase) {
        const std::string& fname = figlet::fontByIndex(cmd - cmFigletCatFontBase);
        if (!fname.empty()) setFont(fname);
    }
}

void TFigletTextView::showFontListDialog() {
    // Build a scrollable TListBox dialog with all fonts
    const auto& fonts = figlet::allFontsSorted();
    if (fonts.empty()) return;

    // Find current font index for initial selection
    int currentIdx = figlet::fontIndex(font_);
    if (currentIdx < 0) currentIdx = 0;

    // Create dialog
    int dlgW = 40, dlgH = 20;
    TDialog* dlg = new TDialog(TRect(0, 0, dlgW, dlgH), "All Fonts");
    dlg->options |= ofCentered;

    // Scrollbar
    TScrollBar* sb = new TScrollBar(TRect(dlgW - 4, 2, dlgW - 3, dlgH - 4));
    dlg->insert(sb);

    // List box
    TListBox* lb = new TListBox(TRect(3, 2, dlgW - 4, dlgH - 4), 1, sb);
    dlg->insert(lb);

    // Populate with a string collection
    TStringCollection* col = makeStringCollection(fonts);
    lb->newList(col);
    lb->focusItem(currentIdx);

    // Buttons
    dlg->insert(new TButton(TRect(3, dlgH - 3, 15, dlgH - 1), "~O~K", cmOK, bfDefault));
    dlg->insert(new TButton(TRect(17, dlgH - 3, 29, dlgH - 1), "Cancel", cmCancel, bfNormal));

    ushort result = TProgram::application->execView(dlg);
    if (result == cmOK) {
        int sel = lb->focused;
        if (sel >= 0 && sel < (int)fonts.size()) {
            setFont(fonts[sel]);
        }
    }
    TObject::destroy(dlg);
}

/*---------------------------------------------------------*/
/* TFigletTextWindow implementation                        */
/*---------------------------------------------------------*/

TFigletTextWindow::TFigletTextWindow(const TRect& bounds, const std::string& text,
                                     const std::string& font,
                                     bool frameless, bool shadowless)
    : TWindow(bounds, text.c_str(), wnNoNumber),
      TWindowInit(frameless ? &TFigletTextWindow::initFrameless
                            : &TFigletTextWindow::initFrame),
      figletView_(nullptr),
      frameless_(frameless)
{
    flags = wfMove | wfGrow | wfClose | wfZoom;
    options |= ofTileable;

    if (shadowless)
        state &= ~sfShadow;

    TRect interior = getExtent();
    if (!frameless) interior.grow(-1, -1);

    figletView_ = new TFigletTextView(interior, text, font);
    insert(figletView_);
}

void TFigletTextWindow::handleEvent(TEvent& event) {
    // Right-click context menu on the window frame area
    if (event.what == evMouseDown && event.mouse.buttons == mbRightButton) {
        // Check if click is in the frame area (not the view interior)
        TPoint local = makeLocal(event.mouse.where);
        TRect interior = getExtent();
        if (!frameless_) interior.grow(-1, -1);

        if (!interior.contains(local) || frameless_) {
            // Build window chrome context menu
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

            TRect deskExt = owner ? owner->getExtent() : getExtent();
            TRect r(event.mouse.where.x, event.mouse.where.y,
                    deskExt.b.x, deskExt.b.y);

            TMenuBox* box = new TMenuBox(r, popup, nullptr);
            ushort cmd = owner ? owner->execView(box) : 0;
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
                    // Keep the frame as the last child (topmost), matching TWindow ctor order.
                    insertBefore(frame, nullptr);
                    // Reposition the figlet view for new frame state
                    if (figletView_) {
                        TRect viewR = getExtent();
                        if (!frameless_) viewR.grow(-1, -1);
                        figletView_->changeBounds(viewR);
                    }
                    // Force full repaint (owner redraws all children, clearing ghost artifacts)
                    if (owner) owner->drawView();
                    else drawView();
                    break;
                }
                case cmCtxGalleryToggle: {
                    TEvent galEvt;
                    galEvt.what = evCommand;
                    galEvt.message.command = cmCtxGalleryToggle;
                    putEvent(galEvt);
                    break;
                }
            }
            clearEvent(event);
            return;
        }
        // If click was in interior, let it fall through to the view's handler
    }
    TWindow::handleEvent(event);
}

void TFigletTextWindow::changeBounds(const TRect& bounds) {
    TWindow::changeBounds(bounds);

    // Reposition the figlet view and trigger re-render
    if (figletView_) {
        TRect interior = getExtent();
        if (!frameless_) interior.grow(-1, -1);
        figletView_->changeBounds(interior);
    }

    setState(sfExposed, True);
    redraw();
}
