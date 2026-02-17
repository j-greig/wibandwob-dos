/*---------------------------------------------------------*/
/*                                                         */
/*   scramble_view.h - Scramble the Symbient Cat           */
/*   ASCII cat presence with speech bubbles                */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef SCRAMBLE_VIEW_H
#define SCRAMBLE_VIEW_H

#define Uses_TRect
#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TWindow
#define Uses_TFrame
#define Uses_TKeys
#define Uses_TProgram
#define Uses_TDeskTop
#define Uses_TBackground
#include <tvision/tv.h>

#include <string>
#include <vector>

/*---------------------------------------------------------*/
/* ScramblePose - cat pose states                          */
/*---------------------------------------------------------*/

enum ScramblePose {
    spDefault  = 0,
    spSleeping = 1,
    spCurious  = 2,
    spCount    = 3
};

/*---------------------------------------------------------*/
/* TScrambleView - ASCII cat + speech bubble renderer      */
/*---------------------------------------------------------*/

class TScrambleView : public TView
{
public:
    TScrambleView(const TRect& bounds);
    virtual ~TScrambleView();

    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;
    virtual void setState(ushort aState, Boolean enable) override;

    // Public interface
    void say(const std::string& text);
    void setPose(ScramblePose pose);
    void toggleVisible();
    ScramblePose getPose() const { return currentPose; }

private:
    // Cat state
    ScramblePose currentPose;

    // Speech bubble state
    std::string bubbleText;
    bool bubbleVisible;
    int bubbleFadeTicks;      // countdown ticks until bubble fades
    static const int kBubbleFadeMs = 5000;  // 5 sec bubble display

    // Idle pose timer
    int idleCounter;          // incremented per timer tick
    int idleThreshold;        // randomised target for pose change

    // Timer
    void* timerId;
    static const int kTimerPeriodMs = 100;  // 10hz tick
    void startTimer();
    void stopTimer();

    // Helpers
    std::vector<std::string> wordWrap(const std::string& text, int width) const;
    void resetIdleTimer();

    // Cat art data
    static const std::vector<std::string>& getCatArt(ScramblePose pose);

    // Layout constants
    static const int kCatWidth  = 12;
    static const int kCatHeight = 8;
    static const int kBubbleMaxWidth = 24;
    static const int kBubbleX = 0;    // bubble starts at left col
    static const int kCatX = 2;       // cat art left offset
};

/*---------------------------------------------------------*/
/* TScrambleWindow - minimal-chrome wrapper                */
/*---------------------------------------------------------*/

class TScrambleWindow : public TWindow
{
public:
    TScrambleWindow(const TRect& bounds);

    TScrambleView* getView() { return scrambleView; }
    virtual void changeBounds(const TRect& bounds) override;

private:
    TScrambleView* scrambleView;
    static TFrame* initFrame(TRect r);
};

/*---------------------------------------------------------*/
/* Factory                                                 */
/*---------------------------------------------------------*/

TWindow* createScrambleWindow(const TRect& bounds);

#endif // SCRAMBLE_VIEW_H
