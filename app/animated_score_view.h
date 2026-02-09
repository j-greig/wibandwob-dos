/*---------------------------------------------------------*/
/*                                                         */
/*   animated_score_view.h - Animated ASCII “Score” View  */
/*                                                         */
/*   A timer-driven view that renders a multi-line         */
/*   Unicode ASCII score with subtle, musical-like         */
/*   animation: phase shifts, breathing, drift, and        */
/*   cyclic glyph changes.                                 */
/*                                                         */
/*   Implementation borrows patterns from                   */
/*   animated_blocks_view and animated_gradient_view:      */
/*   - UI-thread timer via setTimer/killTimer              */
/*   - cmTimerExpired broadcast handling                   */
/*   - draw() composes each frame based on phase           */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef ANIMATED_SCORE_VIEW_H
#define ANIMATED_SCORE_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

class TAnimatedScoreView : public TView {
public:
    explicit TAnimatedScoreView(const TRect &bounds, unsigned periodMs = 120);
    virtual ~TAnimatedScoreView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

    void setSpeed(unsigned periodMs_);

    // Optional external control: set foreground/background colors.
    // If not called, defaults to light gray on black.
    void setTextColors(const TColorAttr &attr) { textAttr = attr; drawView(); }
    void setBackgroundRGB(uchar r, uchar g, uchar b);
    void cycleBackground(int delta = 1);
    void setBackgroundIndex(int idx);
    int backgroundIndex() const { return bgIndex; }
    bool openBackgroundPaletteDialog();

private:
    void startTimer();
    void stopTimer();
    void advance();

    unsigned periodMs;
    TTimerId timerId {0};
    int phase {0};

    // Rendering colors (normal + highlighted are the same for this view).
    TColorAttr textAttr { TColorAttr{0x07} }; // default BIOS 0x07 (light gray on black)
    int bgIndex {0}; // index into built-in ANSI-like BG palette
};

class TWindow; TWindow* createAnimatedScoreWindow(const TRect &bounds);

#endif // ANIMATED_SCORE_VIEW_H
