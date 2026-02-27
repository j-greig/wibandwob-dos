#ifndef GENERATIVE_LAB_VIEW_H
#define GENERATIVE_LAB_VIEW_H

#define Uses_TView
#define Uses_TScroller
#define Uses_TScrollBar
#define Uses_TWindow
#define Uses_TDrawBuffer
#define Uses_TRect
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include <string>
#include <vector>
#include <map>

// ── Stamp: ASCII art placed on canvas before generation ──

struct GenStamp {
    std::string path;    // file path (empty if inline text)
    std::string text;    // inline text (empty if file)
    int x = 0;
    int y = 0;
    bool locked = true;  // true = immune to rules
};

// ── Preset names (must match Python PRESET_LIST order) ───
static const char* kGenPresetNames[] = {
    "game-of-life", "corners-bleed", "eno-bloom", "coral-reef",
    "mycelium", "crystal", "tidal", "erosion", "aurora", "spiral-life"
};
static const int kGenPresetCount = 10;

static const char* kGenPresetLabels[] = {
    "Life", "Corners", "Bloom", "Coral",
    "Mycelium", "Crystal", "Tidal", "Erosion", "Aurora", "Spiral"
};

// ── Bridge: fork/pipe to generative_stream.py ────────────

class GenerativeBridge {
public:
    GenerativeBridge() = default;
    ~GenerativeBridge();

    bool start(int width, int height, int seed,
               const std::string& preset, int maxTicks,
               const std::string& snapshotPath = "",
               const std::vector<GenStamp>& stamps = {},
               bool canvasMode = false);
    void stop();
    void pause();
    void resume();
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

class TGenerativeLabView : public TScroller {
public:
    TGenerativeLabView(const TRect& bounds, TScrollBar* vsb);
    virtual ~TGenerativeLabView();

    virtual void draw() override;
    virtual void handleEvent(TEvent& ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

    void launch();
    void deferLaunch();

    int seed() const { return seed_; }
    int presetIdx() const { return presetIdx_; }
    std::string presetName() const;

    // API/IPC control surface — returns JSON response string
    std::string handleApiAction(const std::string& action,
                                const std::map<std::string, std::string>& params);

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
    void openStampPicker();
    void clearStamps();

    GenerativeBridge bridge_;

    // Current params
    int seed_ = 0;
    int presetIdx_ = 0;   // 0-9 = named presets, 10 = random
    int maxTicks_ = 2000;
    std::vector<GenStamp> stamps_;  // primers stamped before generation
    bool canvasMode_ = false;      // primer IS the grid, rules operate on art

    // Display state
    std::vector<std::string> lines_;
    std::vector<std::string> nextFrame_;
    std::string statusLine_;
    std::string partial_;
    bool autoScroll_ = true;

    bool pendingLaunch_ = false;
    std::string flashMsg_;
    time_t flashTime_ = 0;

    unsigned periodMs_ = 50;
    TTimerId timerId_ = 0;
    TTimerId resizeTimerId_ = 0;
};

// ── Window + factory ─────────────────────────────────────

class TGenerativeLabWindow : public TWindow {
public:
    TGenerativeLabWindow(const TRect& bounds);
    void setup();
    virtual void changeBounds(const TRect& b) override;
};

TWindow* createGenerativeLabWindow(const TRect& bounds);

void api_spawn_generative_lab(class TWwdosApp& app, const TRect* bounds);

#endif // GENERATIVE_LAB_VIEW_H
