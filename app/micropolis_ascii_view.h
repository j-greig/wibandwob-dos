#ifndef MICROPOLIS_ASCII_VIEW_H
#define MICROPOLIS_ASCII_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include "micropolis/micropolis_bridge.h"

class TMicropolisAsciiView : public TView {
public:
    explicit TMicropolisAsciiView(const TRect &bounds);
    virtual ~TMicropolisAsciiView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;

private:
    void startTimer();
    void stopTimer();
    void advanceSim();
    void clampCamera();

    MicropolisBridge bridge_;
    int camX_ {0};
    int camY_ {0};
    int seed_ {1337};
    TTimerId timerId_ {0};
};

class TWindow;
TWindow* createMicropolisAsciiWindow(const TRect &bounds);

#endif // MICROPOLIS_ASCII_VIEW_H
