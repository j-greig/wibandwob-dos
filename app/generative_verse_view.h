/*---------------------------------------------------------*/
/*                                                         */
/*   generative_verse_view.h - Verse Field (Generative)   */
/*                                                         */
/*   Full-window evolving generative field with layered    */
/*   waves, flow, and palettes. Inspired by Verse-like     */
/*   minimal, living abstractions.                         */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GENERATIVE_VERSE_VIEW_H
#define GENERATIVE_VERSE_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

class TGenerativeVerseView : public TView {
public:
    enum Mode { mdFlow = 0, mdSwirl = 1, mdWeave = 2 };

    explicit TGenerativeVerseView(const TRect &bounds, unsigned periodMs = 50);
    virtual ~TGenerativeVerseView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

    void setSpeed(unsigned periodMs_);

private:
    void startTimer();
    void stopTimer();
    void advance();

    unsigned periodMs;
    TTimerId timerId {0};
    int frame {0};
    int paletteIndex {0};
    Mode mode {mdFlow};
};

class TWindow; TWindow* createGenerativeVerseWindow(const TRect &bounds);

#endif // GENERATIVE_VERSE_VIEW_H

