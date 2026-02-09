/*---------------------------------------------------------*/
/*                                                         */
/*   token_tracker_view.h - Token Fast-Tracker View       */
/*                                                         */
/*   A vertical-scrolling tracker that advances a playhead */
/*   at BPM/rows-per-beat, rendering:                      */
/*     - token stream (CH1)                                */
/*     - predicted next tokens (CH2/CH3)                   */
/*     - kaomoji reflecting token “umwelt”                 */
/*     - simple meters/waves                               */
/*                                                         */
/*   Timer pattern matches other animated views.           */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TOKEN_TRACKER_VIEW_H
#define TOKEN_TRACKER_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

#include <string>
#include <vector>
struct TRect;

class TTokenTrackerView : public TView {
public:
    struct Config {
        int bpm = 120;          // beats per minute
        int rowsPerBeat = 4;    // rows per beat (speed)
        unsigned periodMs() const {
            int denom = bpm * rowsPerBeat;
            if (denom <= 0) return 125; // fallback
            unsigned p = (unsigned)(60000 / denom);
            return p ? p : 1;
        }
    };

    explicit TTokenTrackerView(const TRect &bounds);
    explicit TTokenTrackerView(const TRect &bounds, const Config &cfg);
    virtual ~TTokenTrackerView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

    void setConfig(const Config &cfg);

private:
    void startTimer();
    void stopTimer();
    void advance();
    void rebuildLayout();

    // Model helpers
    std::string currentToken(int idx) const;
    std::vector<std::string> predictNext(const std::string &t1, const std::string &t2) const;
    std::string umweltFace(const std::string &tok, int phase) const;
    std::string wave(int phase) const;
    std::string meter(int phase) const;
    std::string rowEmoji(bool kck, bool snr, bool hat, const std::string &tok, const std::vector<std::string>& preds, int phase) const;
    void applySpeedFromCfg();
    
    // Layout helpers
    int sidebarWidth(int totalW) const { return std::max(18, std::min(28, totalW / 4)); }
    
    // UI controls (top bar)
    struct Btn { int id; TRect r; std::string label; };
    void buildButtons(int width);
    int hitButton(int x, int y) const; // returns id or 0

    Config cfg;
    unsigned periodMs;
    TTimerId timerId {0};
    int step {0};         // absolute step counter (wraps visually)
    int totalSteps {64};  // loop length
    std::vector<std::string> seq; // base token sequence
    bool paused {false};
    bool shadeRows {true};
    bool mutes[8] = {false,false,false,false,false,false,false,false};
    std::vector<Btn> buttons;
    int pressedId {0};
    int pressedTick {-1};
    bool soloMode {false};
    int soloIndex {-1}; // 0..7 for KCK..P2
    bool loopFlag {true};
    int spinner {0};
};

class TWindow; TWindow* createTokenTrackerWindow(const TRect &bounds);

#endif // TOKEN_TRACKER_VIEW_H
