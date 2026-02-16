# View Templates

Replace `{name}`, `{PascalName}`, `{UPPER_NAME}`, `{title}`.

## Header (all types)

```cpp
/*---------------------------------------------------------*/
/*   {name}_view.h - {title}                              */
/*---------------------------------------------------------*/
#ifndef {UPPER_NAME}_VIEW_H
#define {UPPER_NAME}_VIEW_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>

class T{PascalName}View : public TView {
public:
    explicit T{PascalName}View(const TRect &bounds);
    virtual ~T{PascalName}View();
    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
private:
};

class TWindow; TWindow* create{PascalName}Window(const TRect &bounds);
#endif
```

For `animation-like`, add to class:
```cpp
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;
    void setSpeed(unsigned periodMs_);
private:
    unsigned periodMs {42};
    TTimerId timerId {0};
    int phase {0};
    void startTimer();
    void stopTimer();
    void advance();
```

## Implementation (view-only / window+view)

```cpp
/*---------------------------------------------------------*/
/*   {name}_view.cpp - {title}                            */
/*---------------------------------------------------------*/
#include "{name}_view.h"
#define Uses_TWindow
#define Uses_TEvent
#include <tvision/tv.h>

T{PascalName}View::T{PascalName}View(const TRect &bounds)
    : TView(bounds)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable;
}

T{PascalName}View::~T{PascalName}View() {}

void T{PascalName}View::draw()
{
    TDrawBuffer b;
    for (int y = 0; y < size.y; ++y) {
        for (int x = 0; x < size.x; ++x) {
            b.putChar(x, ' ');
            b.putAttribute(x, TColorAttr(0x07));
        }
        writeLine(0, y, size.x, 1, b);
    }
}

void T{PascalName}View::handleEvent(TEvent &ev) { TView::handleEvent(ev); }

TWindow* create{PascalName}Window(const TRect &bounds)
{
    auto *w = new TWindow(bounds, "{title}", wnNoNumber);
    w->options |= ofTileable;
    TRect c = w->getExtent();
    c.grow(-1, -1);
    w->insert(new T{PascalName}View(c));
    return w;
}
```

For `animation-like`, constructor also adds `eventMask |= evBroadcast;`, destructor calls `stopTimer()`, and add timer methods per `app/animated_blocks_view.cpp`.

For `browser-like`, `draw()` includes:
```cpp
    // Pipeline: source -> ANSI parse -> cells(glyph,fg,bg) -> TV draw
    // WARNING: Never write raw ANSI escape sequences to TDrawBuffer
```

## handleEvent case (test_pattern_app.cpp)

```cpp
case cm{PascalName}: {
    TRect r = deskTop->getExtent();
    r.grow(-2, -1);
    deskTop->insert(create{PascalName}Window(r));
    clearEvent(event);
    break;
}
```

## Registry entry (command_registry.cpp)

```cpp
// capability:
{"open_{name}", "Open {title} window", false},
// dispatch:
if (name == "open_{name}") { /* wire to app factory */ return "ok"; }
```
