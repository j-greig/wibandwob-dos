/*---------------------------------------------------------*/
/*                                                         */
/*   generative_mycelium_view.h - Mycelium Field (Gen)    */
/*                                                         */
/*   Curl-noise flow with branching motifs; living weave. */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GENERATIVE_MYCELIUM_VIEW_H
#define GENERATIVE_MYCELIUM_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

class TGenerativeMyceliumView : public TView {
public:
    explicit TGenerativeMyceliumView(const TRect &bounds, unsigned periodMs = 55);
    virtual ~TGenerativeMyceliumView();

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
};

class TWindow; TWindow* createGenerativeMyceliumWindow(const TRect &bounds);

#endif // GENERATIVE_MYCELIUM_VIEW_H

