#ifndef MICROPOLIS_TOOL_PALETTE_H
#define MICROPOLIS_TOOL_PALETTE_H

#define Uses_TView
#define Uses_TRect
#define Uses_TEvent
#include <tvision/tv.h>

class TMicropolisAsciiView;

class TMicropolisToolPalette : public TView {
public:
    TMicropolisToolPalette(const TRect &bounds, TMicropolisAsciiView *mapView);
    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;

private:
    TMicropolisAsciiView *map_;
};

#endif // MICROPOLIS_TOOL_PALETTE_H
