/*---------------------------------------------------------*/
/*                                                         */
/*   generative_orbit_view.h - Orbit Field (Generative)   */
/*                                                         */
/*   Radial interference from rotating attractors;        */
/*   evolving colour bands and ripples.                   */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GENERATIVE_ORBIT_VIEW_H
#define GENERATIVE_ORBIT_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

class TGenerativeOrbitView : public TView {
public:
    explicit TGenerativeOrbitView(const TRect &bounds, unsigned periodMs = 50);
    virtual ~TGenerativeOrbitView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

private:
    void startTimer();
    void stopTimer();
    void advance();
    void nextPalette(int dir);

    unsigned periodMs;
    TTimerId timerId {0};
    int frame {0};
    int paletteIndex {0};
};

class TWindow; TWindow* createGenerativeOrbitWindow(const TRect &bounds);

#endif // GENERATIVE_ORBIT_VIEW_H

