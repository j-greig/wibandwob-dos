#ifndef TVTERM_VIEW_H
#define TVTERM_VIEW_H

#define Uses_TWindow
#define Uses_TRect
#define Uses_TPoint
#include <tvision/tv.h>

#include <tvterm/termwnd.h>
#include <tvterm/consts.h>

#include <string>

class TWibWobTerminalWindow : public tvterm::BasicTerminalWindow
{
public:
    static const tvterm::TVTermConstants termConsts;

    TWibWobTerminalWindow(const TRect &bounds, tvterm::TerminalController &termCtrl) noexcept;

    void handleEvent(TEvent &ev) override;
    void sizeLimits(TPoint &min, TPoint &max) override;

    // Send text as keyboard input to this terminal.
    // Each byte is injected as a KeyDown event through the terminal controller.
    void sendText(const std::string &text);

private:
    using Super = tvterm::BasicTerminalWindow;
};

TWindow* createTerminalWindow(const TRect &bounds);

#endif // TVTERM_VIEW_H
