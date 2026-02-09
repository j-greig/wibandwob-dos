/*---------------------------------------------------------*/
/*                                                         */
/*   animated_blocks_view.h - Zigzag Block Animation View  */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef ANIMATED_BLOCKS_VIEW_H
#define ANIMATED_BLOCKS_VIEW_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
#include <vector>

// Simple animated view that renders colored block characters. On each
// timer tick, rows shift one cell horizontally; even rows move right,
// odd rows move left. Colors repeat across columns.
class TAnimatedBlocksView : public TView {
public:
    explicit TAnimatedBlocksView(const TRect &bounds, unsigned periodMs = 42);
    virtual ~TAnimatedBlocksView();

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
    int phase {0};
    std::vector<TScreenCell> lineBuf;
};

// Factory helper used by the app to avoid direct dependency on the view type.
class TWindow; TWindow* createAnimatedBlocksWindow(const TRect &bounds);
class TWindow; TWindow* createAnimatedBlocksWindow(const TRect &bounds, unsigned periodMs);

#endif // ANIMATED_BLOCKS_VIEW_H
