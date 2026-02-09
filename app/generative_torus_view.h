/*---------------------------------------------------------*/
/*                                                         */
/*   generative_torus_view.h - Torus Field (Generative)   */
/*                                                         */
/*   Classic ASCII donut rendered with z-buffer shading,  */
/*   animated rotation and palette colouring.             */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GENERATIVE_TORUS_VIEW_H
#define GENERATIVE_TORUS_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

class TGenerativeTorusView : public TView {
public:
    explicit TGenerativeTorusView(const TRect &bounds, unsigned periodMs = 40);
    virtual ~TGenerativeTorusView();

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
    float aRot {0.f}, bRot {0.f}; // rotation angles
    float scale {0.1625f}; // projection scale factor
    float yStretch {1.25f}; // vertical stretch to counter terminal aspect
};

class TWindow; TWindow* createGenerativeTorusWindow(const TRect &bounds);

#endif // GENERATIVE_TORUS_VIEW_H
