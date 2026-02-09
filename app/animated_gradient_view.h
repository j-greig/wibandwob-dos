/*---------------------------------------------------------*/
/*                                                         */
/*   animated_gradient_view.h - Animated Gradient View    */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef ANIMATED_GRADIENT_VIEW_H
#define ANIMATED_GRADIENT_VIEW_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
#include <vector>

// Animated horizontal gradient view that shifts colors over time.
// Colors flow horizontally (left to right) with configurable speed.
class TAnimatedHGradientView : public TView {
public:
    explicit TAnimatedHGradientView(
        const TRect &bounds, 
        unsigned periodMs = 100,
        TColorRGB startColor = TColorRGB(0x00, 0x00, 0xFF),
        TColorRGB endColor = TColorRGB(0xFF, 0x00, 0xFF)
    );
    virtual ~TAnimatedHGradientView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

    void setSpeed(unsigned periodMs_);
    void setColors(TColorRGB start, TColorRGB end);

private:
    void startTimer();
    void stopTimer();
    void advance();

    // Linear interpolation between two colors
    static TColorRGB interpolate(TColorRGB start, TColorRGB end, float t);

    unsigned periodMs;
    TTimerId timerId {0};
    int phase {0};
    
    TColorRGB startColor;
    TColorRGB endColor;
    std::vector<TScreenCell> lineBuf;
};

// Factory helper used by the app to avoid direct dependency on the view type.
class TWindow; 
TWindow* createAnimatedGradientWindow(const TRect &bounds);

#endif // ANIMATED_GRADIENT_VIEW_H