#ifndef MICROPOLIS_ASCII_VIEW_H
#define MICROPOLIS_ASCII_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include <string>
#include "micropolis/micropolis_bridge.h"

class TMicropolisAsciiView : public TView {
public:
    explicit TMicropolisAsciiView(const TRect &bounds);
    virtual ~TMicropolisAsciiView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    int activeTool() const { return activeTool_; }
    std::string lastResult() const { return lastResult_; }
    int lastResultTick() const { return lastResultTick_; }
    int simSpeed() const { return simSpeed_; }
    MicropolisSnapshot snapshot() const { return bridge_.snapshot(); }

private:
    void startTimer();
    void stopTimer();
    void advanceSim();
    void clampCamera();
    void clampCursor();
    void applyActiveTool();
    void autopanTowardCursor();

    MicropolisBridge bridge_;
    int camX_ {0};
    int camY_ {0};
    int curX_ {60};           // cursor world coord
    int curY_ {50};
    int activeTool_ {5};      // TOOL_QUERY=5 — no engine header needed in view
    int simSpeed_ {1};        // 0=pause 1=slow 2=medium 3=fast 4=ultra
    int seed_ {1337};
    TTimerId timerId_ {0};
    std::string lastResult_;
    int lastResultTick_ {0};  // ticks remaining to show lastResult_
};

class TWindow;
TWindow* createMicropolisAsciiWindow(const TRect &bounds);

#endif // MICROPOLIS_ASCII_VIEW_H
