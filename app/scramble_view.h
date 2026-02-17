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
#include <functional>

// Command constants for Scramble subsystem
const ushort cmScrambleToggle = 180;   // Toggle scramble visibility

// Forward declare — engine lives in scramble_engine.h (no tvision dependency)
class ScrambleEngine;

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
/* ScrambleDisplayState - window size states                */
/*---------------------------------------------------------*/

enum ScrambleDisplayState {
    sdsHidden = 0,
    sdsSmol   = 1,
    sdsTall   = 2
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
    void setEngine(ScrambleEngine* engine) { scrambleEngine = engine; }
    ScramblePose getPose() const { return currentPose; }

private:
    ScrambleEngine* scrambleEngine;
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
/* TScrambleMessageView - minimal message history          */
/*---------------------------------------------------------*/

struct ScrambleMessage {
    std::string sender;  // "you" or "scramble"
    std::string text;
};

class TScrambleMessageView : public TView
{
public:
    TScrambleMessageView(const TRect& bounds);

    virtual void draw() override;

    void addMessage(const std::string& sender, const std::string& text);
    void clear();
    const std::vector<ScrambleMessage>& getMessages() const { return messages; }

private:
    std::vector<ScrambleMessage> messages;

    struct WrappedLine {
        std::string text;
        bool isSenderLine;
    };
    std::vector<WrappedLine> wrappedLines;

    void rebuildWrappedLines();
    std::vector<std::string> wrapText(const std::string& text, int width) const;
};

/*---------------------------------------------------------*/
/* TScrambleInputView - minimal single-line input          */
/*---------------------------------------------------------*/

class TScrambleInputView : public TView
{
public:
    TScrambleInputView(const TRect& bounds);
    virtual ~TScrambleInputView();

    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;
    virtual void setState(ushort aState, Boolean enable) override;

    std::string getCurrentInput() const { return currentInput; }
    void clearInput();

    // Callback when user presses Enter
    std::function<void(const std::string&)> onSubmit;

private:
    std::string currentInput;
    int cursorPos;

    // Cursor blink
    bool cursorVisible;
    void* cursorTimerId;
    void startCursorBlink();
    void stopCursorBlink();
};

/*---------------------------------------------------------*/
/* TScrambleWindow - minimal-chrome wrapper                */
/*---------------------------------------------------------*/

class TScrambleWindow : public TWindow
{
public:
    TScrambleWindow(const TRect& bounds, ScrambleDisplayState initialState = sdsSmol);

    TScrambleView* getView() { return scrambleView; }
    TScrambleMessageView* getMessageView() { return messageView; }
    TScrambleInputView* getInputView() { return inputView; }
    ScrambleDisplayState getDisplayState() const { return displayState; }

    void setDisplayState(ScrambleDisplayState state);
    void focusInput();
    virtual void changeBounds(const TRect& bounds) override;
    virtual void handleEvent(TEvent& event) override;
    virtual void setState(ushort aState, Boolean enable) override;

private:
    ScrambleDisplayState displayState;
    TScrambleView* scrambleView;
    TScrambleMessageView* messageView;
    TScrambleInputView* inputView;

    void layoutChildren();
    static TFrame* initFrame(TRect r);
};

/*---------------------------------------------------------*/
/* Factory                                                 */
/*---------------------------------------------------------*/

TWindow* createScrambleWindow(const TRect& bounds, ScrambleDisplayState state = sdsSmol);

#endif // SCRAMBLE_VIEW_H
