#ifndef CONTOUR_MAP_VIEW_H
#define CONTOUR_MAP_VIEW_H

#define Uses_TView
#define Uses_TScroller
#define Uses_TScrollBar
#define Uses_TWindow
#define Uses_TDrawBuffer
#define Uses_TRect
#define Uses_TEvent
#define Uses_TDialog
#define Uses_TKeys
#include <tvision/tv.h>

#include <string>
#include <vector>
#include <deque>

// ── Terrain names (must match Python TERRAINS order) ─────
static const char* kTerrainNames[] = {
    "archipelago", "saddle pass", "ridge valley", "caldera",
    "lone peak", "meadow", "twin peaks"
};
static const int kTerrainCount = 7;

// ── Bridge: fork/pipe to contour_stream.py ───────────────

class ContourBridge {
public:
    ContourBridge() = default;
    ~ContourBridge();

    bool start(int width, int height, int seed, int terrainIdx,
               int levels, bool grow, bool triptych,
               int mode = 0, float orderRatio = 0.5);
    void stop();
    void pause();    // SIGSTOP (process group)
    void resume();   // SIGCONT (process group)
    bool isRunning() const { return pid_ > 0; }
    bool isPaused() const { return paused_; }
    int pipeFd() const { return pipeFd_; }

private:
    pid_t pid_ = -1;
    int pipeFd_ = -1;
    bool paused_ = false;

    std::string resolveScriptPath();
};

// ── View ─────────────────────────────────────────────────

class TContourMapView : public TScroller {
public:
    TContourMapView(const TRect& bounds, TScrollBar* vsb);
    virtual ~TContourMapView();

    virtual void draw() override;
    virtual void handleEvent(TEvent& ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

    void launch(int seed, int terrainIdx, int levels, bool grow, bool triptych);
    void deferLaunch(int seed, int terrainIdx, int levels, bool grow, bool triptych);

    int seed() const { return seed_; }
    int terrainIdx() const { return terrainIdx_; }
    int levels() const { return levels_; }
    bool isGrow() const { return grow_; }

private:
    void startTimer();
    void stopTimer();
    void pollPipe();
    void processData(const std::string& data);
    void updateScrollLimit();
    void scrollToBottom();
    void relaunch();
    void debounceRelaunch();
    void saveToFile();
    void drawButtonBar(int y);

    ContourBridge bridge_;

    // Current params
    int seed_ = 0;
    int terrainIdx_ = 5;  // meadow
    int levels_ = 5;
    bool grow_ = false;
    bool triptych_ = false;
    int mode_ = 0;           // 0=chaos, 1=order:pop, 2=order:spread, 3=hybrid
    float orderRatio_ = 0.5; // hybrid blend: 0.0=all contours, 1.0=all grids

    // Display state
    std::vector<std::string> lines_;     // current displayed frame
    std::vector<std::string> nextFrame_; // grow mode: accumulating next frame
    std::string statusLine_;             // parsed from STATUS: header
    std::string partial_;                // incomplete line accumulator
    bool autoScroll_ = true;

    bool pendingLaunch_ = false;         // deferred first launch
    std::string flashMsg_;               // temporary status flash
    time_t flashTime_ = 0;               // when flash was set

    unsigned periodMs_ = 50;
    TTimerId timerId_ = 0;
    TTimerId resizeTimerId_ = 0;         // debounce resize
};

// ── Window + factory ─────────────────────────────────────

TWindow* createContourMapWindow(const TRect& bounds,
                                 int seed, int terrainIdx, int levels,
                                 bool grow, bool triptych);

void api_spawn_contour_map(class TWwdosApp& app, const TRect* bounds);

#endif // CONTOUR_MAP_VIEW_H
