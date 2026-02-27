#include "contour_map_view.h"

#include <cstdlib>
#include <cstring>
#include <ctime>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <sys/wait.h>
#include <algorithm>

// ── ContourBridge ────────────────────────────────────────

ContourBridge::~ContourBridge() { stop(); }

std::string ContourBridge::resolveScriptPath() {
    // Look for tools/contour_stream.py relative to WIBWOB_REPO_ROOT or cwd
    const char* root = std::getenv("WIBWOB_REPO_ROOT");
    if (root) return std::string(root) + "/tools/contour_stream.py";
    return "tools/contour_stream.py";
}

bool ContourBridge::start(int width, int height, int seed, int terrainIdx,
                          int levels, bool grow, bool triptych) {
    stop();

    std::string script = resolveScriptPath();
    std::string cmd = "python3 " + script;
    cmd += " --width " + std::to_string(width);
    cmd += " --height " + std::to_string(height);
    cmd += " --seed " + std::to_string(seed);
    cmd += " --terrain " + std::string(kTerrainNames[terrainIdx]);
    cmd += " --levels " + std::to_string(levels);
    if (grow) cmd += " --grow";
    if (triptych) cmd += " --triptych";
    cmd += " 2>/dev/null";

    int pipefd[2];
    if (pipe(pipefd) < 0) return false;

    pid_ = fork();
    if (pid_ < 0) {
        close(pipefd[0]); close(pipefd[1]);
        return false;
    }

    if (pid_ == 0) {
        close(pipefd[0]);
        dup2(pipefd[1], STDOUT_FILENO);
        close(pipefd[1]);
        execl("/bin/sh", "sh", "-c", cmd.c_str(), nullptr);
        _exit(127);
    }

    close(pipefd[1]);
    pipeFd_ = pipefd[0];
    fcntl(pipeFd_, F_SETFL, fcntl(pipeFd_, F_GETFL) | O_NONBLOCK);
    return true;
}

void ContourBridge::stop() {
    if (pid_ > 0) {
        kill(pid_, SIGTERM);
        usleep(50000);
        int status;
        if (waitpid(pid_, &status, WNOHANG) == 0) {
            kill(pid_, SIGKILL);
            waitpid(pid_, &status, 0);
        }
        pid_ = -1;
    }
    if (pipeFd_ >= 0) {
        close(pipeFd_);
        pipeFd_ = -1;
    }
}

// ── TContourMapView ──────────────────────────────────────

TContourMapView::TContourMapView(const TRect& bounds, TScrollBar* vsb)
    : TScroller(bounds, nullptr, vsb)
{
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evBroadcast | evKeyboard;

    // Random initial seed
    srand((unsigned)time(nullptr));
    seed_ = rand() % 100000;
}

TContourMapView::~TContourMapView() {
    stopTimer();
    bridge_.stop();
}

void TContourMapView::startTimer() {
    if (timerId_ == 0)
        timerId_ = setTimer(periodMs_, (int)periodMs_);
}

void TContourMapView::stopTimer() {
    if (timerId_ != 0) { killTimer(timerId_); timerId_ = 0; }
    if (resizeTimerId_ != 0) { killTimer(resizeTimerId_); resizeTimerId_ = 0; }
}

void TContourMapView::launch(int seed, int terrainIdx, int levels, bool grow, bool triptych) {
    seed_ = seed;
    terrainIdx_ = terrainIdx;
    levels_ = levels;
    grow_ = grow;
    triptych_ = triptych;
    lines_.clear();
    nextFrame_.clear();
    partial_.clear();
    statusLine_.clear();
    autoScroll_ = true;
    scrollTo(0, 0);
    setLimit(0, 0);

    // Content area size (inside padding)
    int contentW = size.x - 2;  // 1 char padding each side
    int contentH = size.y - 2;  // 1 row padding top + 1 row status bar bottom
    if (contentW < 5) contentW = 5;
    if (contentH < 5) contentH = 5;

    bridge_.start(contentW, contentH, seed_, terrainIdx_, levels_, grow_, triptych_);
    startTimer();
    drawView();
}

void TContourMapView::relaunch() {
    launch(seed_, terrainIdx_, levels_, grow_, triptych_);
}

void TContourMapView::debounceRelaunch() {
    if (resizeTimerId_ != 0) killTimer(resizeTimerId_);
    resizeTimerId_ = setTimer(200, 200);  // 200ms debounce
}

void TContourMapView::updateScrollLimit() {
    int contentH = size.y - 2;
    int maxScroll = std::max(0, (int)lines_.size() - contentH);
    setLimit(0, maxScroll);
}

void TContourMapView::scrollToBottom() {
    updateScrollLimit();
    scrollTo(0, limit.y);
}

void TContourMapView::pollPipe() {
    if (!bridge_.isRunning()) return;

    char buf[4096];
    ssize_t n = ::read(bridge_.pipeFd(), buf, sizeof(buf) - 1);
    if (n > 0) {
        buf[n] = '\0';
        std::string data(buf, n);
        processData(data);
        if (autoScroll_) scrollToBottom();
        else updateScrollLimit();
        drawView();
    } else if (n == 0) {
        // EOF — process exited
        bridge_.stop();
        drawView();
    }
}

void TContourMapView::processData(const std::string& data) {
    // In grow mode, accumulate into nextFrame_ and swap on RS.
    // In static mode, append directly to lines_.
    auto& target = grow_ ? nextFrame_ : lines_;

    for (size_t i = 0; i < data.size(); ++i) {
        char c = data[i];

        if (c == '\x1E') {
            // Record separator — swap in completed frame (grow mode)
            if (!partial_.empty()) {
                target.push_back(partial_);
                partial_.clear();
            }
            if (grow_) {
                lines_.swap(nextFrame_);
                nextFrame_.clear();
            }
            continue;
        }

        if (c == '\n') {
            // Check for STATUS: header
            if (partial_.size() >= 7 && partial_.substr(0, 7) == "STATUS:") {
                statusLine_ = partial_.substr(7);
                partial_.clear();
                continue;
            }
            target.push_back(partial_);
            partial_.clear();
        } else if (c != '\r') {
            partial_ += c;
        }
    }
}

void TContourMapView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    TDrawBuffer buf;

    static const TColorAttr kBg =
        TColorAttr(TColorRGB(0xCC, 0xCC, 0xCC), TColorRGB(0x00, 0x00, 0x00));
    static const TColorAttr kBarBg =
        TColorAttr(TColorRGB(0x88, 0x88, 0x88), TColorRGB(0x1A, 0x1A, 0x1A));
    static const TColorAttr kBarLabel =
        TColorAttr(TColorRGB(0xFF, 0xFF, 0xFF), TColorRGB(0x1A, 0x1A, 0x1A));
    static const TColorAttr kBarDim =
        TColorAttr(TColorRGB(0x66, 0x66, 0x66), TColorRGB(0x1A, 0x1A, 0x1A));

    auto blankRow = [&](int y) {
        buf.moveChar(0, ' ', kBg, W);
        writeLine(0, y, W, 1, buf);
    };

    // Top padding
    blankRow(0);

    // Content area
    int contentH = H - 2;  // -1 top pad, -1 status bar
    int topLine = delta.y;

    for (int row = 0; row < contentH; ++row) {
        buf.moveChar(0, ' ', kBg, W);
        int lineIdx = topLine + row;
        if (lineIdx >= 0 && lineIdx < (int)lines_.size()) {
            const std::string& line = lines_[lineIdx];
            // 1 char left padding
            buf.moveStr(1, TStringView(line), kBg);
        }
        writeLine(0, row + 1, W, 1, buf);
    }

    // Status bar (bottom row)
    buf.moveChar(0, ' ', kBarBg, W);
    ushort x = 1;

    // Terrain name
    std::string tname = (terrainIdx_ >= 0 && terrainIdx_ < kTerrainCount)
        ? kTerrainNames[terrainIdx_] : "?";
    for (auto& c : tname) c = toupper(c);
    x = buf.moveStr(x, TStringView(tname), kBarLabel);

    // Seed
    std::string seedStr = "  seed:" + std::to_string(seed_);
    x = buf.moveStr(x, TStringView(seedStr), kBarDim);

    // Levels
    std::string lvlStr = "  " + std::to_string(levels_) + "lvl";
    x = buf.moveStr(x, TStringView(lvlStr), kBarDim);

    // Mode
    if (grow_) {
        std::string mode = bridge_.isRunning() ? "  GROWING" : "  PAUSED";
        x = buf.moveStr(x, TStringView(mode), kBarDim);
    } else {
        x = buf.moveStr(x, "  STATIC", kBarDim);
    }

    // Controls hint — right-aligned
    std::string hint = " r:new 1-7:terrain +/-:lvl g:grow t:tri ";
    int hintW = (int)hint.size();
    if (W - hintW >= (int)x + 2)
        buf.moveStr(W - hintW, TStringView(hint), kBarDim);

    writeLine(0, H - 1, W, 1, buf);
}

void TContourMapView::handleEvent(TEvent& ev) {
    // Timer ticks
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId_ != 0 && ev.message.infoPtr == timerId_) {
            pollPipe();
            clearEvent(ev);
            return;
        }
        if (resizeTimerId_ != 0 && ev.message.infoPtr == resizeTimerId_) {
            killTimer(resizeTimerId_);
            resizeTimerId_ = 0;
            relaunch();
            clearEvent(ev);
            return;
        }
    }

    // Custom keys
    if (ev.what == evKeyDown) {
        char ch = ev.keyDown.charScan.charCode;

        // r — random seed
        if (ch == 'r' || ch == 'R') {
            seed_ = rand() % 100000;
            relaunch();
            clearEvent(ev); return;
        }

        // 1-7 — terrain type
        if (ch >= '1' && ch <= '7') {
            terrainIdx_ = ch - '1';
            seed_ = rand() % 100000;
            relaunch();
            clearEvent(ev); return;
        }

        // +/= — more levels
        if (ch == '+' || ch == '=') {
            levels_ = std::min(12, levels_ + 1);
            relaunch();
            clearEvent(ev); return;
        }

        // - — fewer levels
        if (ch == '-' || ch == '_') {
            levels_ = std::max(2, levels_ - 1);
            relaunch();
            clearEvent(ev); return;
        }

        // g — toggle grow mode
        if (ch == 'g' || ch == 'G') {
            grow_ = !grow_;
            relaunch();
            clearEvent(ev); return;
        }

        // t — toggle triptych
        if (ch == 't' || ch == 'T') {
            triptych_ = !triptych_;
            relaunch();
            clearEvent(ev); return;
        }

        // Space — pause/resume grow mode
        if (ch == ' ' && grow_) {
            if (bridge_.isRunning()) {
                // Pause: kill subprocess, keep current frame
                bridge_.stop();
                stopTimer();
            } else {
                // Resume: relaunch
                relaunch();
            }
            drawView();
            clearEvent(ev); return;
        }

        // TAB — cycle terrain
        if (ev.keyDown.keyCode == kbTab) {
            terrainIdx_ = (terrainIdx_ + 1) % kTerrainCount;
            seed_ = rand() % 100000;
            relaunch();
            clearEvent(ev); return;
        }
    }

    // Let TScroller handle scroll keys + scrollbar clicks
    int prevY = delta.y;
    TScroller::handleEvent(ev);
    if (delta.y != prevY) {
        autoScroll_ = (delta.y >= limit.y);
    }
}

void TContourMapView::setState(ushort aState, Boolean enable) {
    TScroller::setState(aState, enable);
    if ((aState & sfExposed) != 0) {
        if (enable) {
            startTimer();
            drawView();
        } else {
            stopTimer();
        }
    }
}

void TContourMapView::changeBounds(const TRect& bounds) {
    TScroller::changeBounds(bounds);
    // Debounce — don't relaunch on every pixel of a drag-resize
    if (bridge_.isRunning()) {
        debounceRelaunch();
    }
}

// ── Window ───────────────────────────────────────────────

class TContourMapWindow : public TWindow {
public:
    TContourMapWindow(const TRect& bounds)
        : TWindow(bounds, "Contour Studio", wnNoNumber)
        , TWindowInit(&TContourMapWindow::initFrame) {}

    void setup(int seed, int terrainIdx, int levels, bool grow, bool triptych) {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);

        // Vertical scrollbar
        TRect sbRect = c;
        sbRect.a.x = sbRect.b.x - 1;
        auto* vsb = new TScrollBar(sbRect);
        vsb->growMode = gfGrowLoX | gfGrowHiX | gfGrowHiY;
        insert(vsb);

        // View
        TRect viewRect = c;
        viewRect.b.x -= 1;
        auto* view = new TContourMapView(viewRect, vsb);
        insert(view);
        view->launch(seed, terrainIdx, levels, grow, triptych);
    }

    virtual void changeBounds(const TRect& b) override {
        TWindow::changeBounds(b);
        setState(sfExposed, True);
        redraw();
    }
};

// ── Factory ──────────────────────────────────────────────

TWindow* createContourMapWindow(const TRect& bounds,
                                 int seed, int terrainIdx, int levels,
                                 bool grow, bool triptych) {
    auto* w = new TContourMapWindow(bounds);
    w->setup(seed, terrainIdx, levels, grow, triptych);
    return w;
}
