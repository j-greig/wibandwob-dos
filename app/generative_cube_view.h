/*---------------------------------------------------------*/
/*                                                         */
/*   generative_cube_view.h - Cube Spinner (Generative)   */
/*                                                         */
/*   Wireframe rotating cube with perspective projection, */
/*   per-edge colouring by depth.                         */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GENERATIVE_CUBE_VIEW_H
#define GENERATIVE_CUBE_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

class TGenerativeCubeView : public TView {
public:
    explicit TGenerativeCubeView(const TRect &bounds, unsigned periodMs = 45);
    virtual ~TGenerativeCubeView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

private:
    void startTimer();
    void stopTimer();
    void advance();

    unsigned periodMs;
    TTimerId timerId {0};
    int frame {0};
    int paletteIndex {0};
    float a {0.f}, b {0.f}, c {0.f};
    float scale {0.25f};
};

class TWindow; TWindow* createGenerativeCubeWindow(const TRect &bounds);

#endif // GENERATIVE_CUBE_VIEW_H

