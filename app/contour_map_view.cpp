#include "contour_map_view.h"

#include <cstdlib>
#include <cstring>
#include <mach-o/dyld.h>
#include <ctime>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <algorithm>

// ── ContourBridge ────────────────────────────────────────

ContourBridge::~ContourBridge() { stop(); }

std::string ContourBridge::resolveScriptPath() {
    // 1. Explicit env var
    const char* root = std::getenv("WIBWOB_REPO_ROOT");
    if (root) return std::string(root) + "/tools/contour_stream.py";

    // 2. Relative to executable (build/app/wwdos → ../../tools/)
    char exePath[4096];
    uint32_t sz = sizeof(exePath);
    if (_NSGetExecutablePath(exePath, &sz) == 0) {
        std::string dir(exePath);
        // Strip binary name, then go up two dirs (build/app/ → repo root)
        auto pos = dir.rfind('/');
        if (pos != std::string::npos) dir = dir.substr(0, pos);
        pos = dir.rfind('/');
        if (pos != std::string::npos) dir = dir.substr(0, pos);
        pos = dir.rfind('/');
        if (pos != std::string::npos) dir = dir.substr(0, pos);
        std::string candidate = dir + "/tools/contour_stream.py";
        if (access(candidate.c_str(), F_OK) == 0) return candidate;
    }

    // 3. Fallback: cwd-relative
    return "tools/contour_stream.py";
}

bool ContourBridge::start(int width, int height, int seed, int terrainIdx,
                          int levels, bool grow, bool triptych) {
    stop();
    paused_ = false;

    std::string script = resolveScriptPath();
    std::string cmd = "python3 " + script;
    cmd += " --width " + std::to_string(width);
    cmd += " --height " + std::to_string(height);
    cmd += " --seed " + std::to_string(seed);
    cmd += " --terrain \"" + std::string(kTerrainNames[terrainIdx]) + "\"";
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

void ContourBridge::pause() {
    if (pid_ > 0 && !paused_) {
        kill(pid_, SIGSTOP);
        paused_ = true;
    }
}

void ContourBridge::resume() {
    if (pid_ > 0 && paused_) {
        kill(pid_, SIGCONT);
        paused_ = false;
    }
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
    eventMask |= evBroadcast | evKeyboard | evMouse;

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

void TContourMapView::saveToFile() {
    if (lines_.empty()) return;

    // Create export dir
    mkdir("exports", 0755);
    mkdir("exports/contour", 0755);

    // Timestamp
    time_t now = time(nullptr);
    struct tm* t = localtime(&now);
    char ts[64];
    strftime(ts, sizeof(ts), "%Y%m%dT%H%M%S", t);

    std::string tname = (terrainIdx_ >= 0 && terrainIdx_ < kTerrainCount)
        ? kTerrainNames[terrainIdx_] : "unknown";
    // Sanitise
    for (auto& c : tname) if (c == ' ') c = '-';

    std::string fname = std::string("exports/contour/") + ts + "_" + tname + "_s" + std::to_string(seed_) + ".txt";
    int fd = open(fname.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) return;

    // Header
    std::string hdr = "Contour Map — " + std::string(kTerrainNames[terrainIdx_])
        + " — seed " + std::to_string(seed_)
        + " — " + std::to_string(levels_) + " levels"
        + (grow_ ? " — grow" : " — static") + "\n\n";
    ::write(fd, hdr.data(), hdr.size());

    for (auto& ln : lines_) {
        ::write(fd, ln.data(), ln.size());
        ::write(fd, "\n", 1);
    }
    close(fd);

    flashMsg_ = "SAVED: " + fname;
    flashTime_ = time(nullptr);
    drawView();
}

void TContourMapView::debounceRelaunch() {
    if (resizeTimerId_ != 0) killTimer(resizeTimerId_);
    resizeTimerId_ = setTimer(200, 200);  // 200ms debounce
}

void TContourMapView::updateScrollLimit() {
    int contentH = size.y - 3;  // match draw(): -1 top, -2 bottom (buttons + status)
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

    static const TColorAttr kBtnBg =
        TColorAttr(TColorRGB(0xAA, 0xAA, 0xAA), TColorRGB(0x2A, 0x2A, 0x2A));
    static const TColorAttr kBtnActive =
        TColorAttr(TColorRGB(0xFF, 0xFF, 0x00), TColorRGB(0x2A, 0x2A, 0x2A));
    static const TColorAttr kFlash =
        TColorAttr(TColorRGB(0x00, 0xFF, 0x66), TColorRGB(0x1A, 0x1A, 0x1A));

    // Top padding
    blankRow(0);

    // Content area: -1 top pad, -3 bottom (button bar + status bar + flash/padding)
    int contentH = H - 3;
    int topLine = delta.y;

    for (int row = 0; row < contentH; ++row) {
        buf.moveChar(0, ' ', kBg, W);
        int lineIdx = topLine + row;
        if (lineIdx >= 0 && lineIdx < (int)lines_.size()) {
            const std::string& line = lines_[lineIdx];
            buf.moveStr(1, TStringView(line), kBg);
        }
        writeLine(0, row + 1, W, 1, buf);
    }

    // ── Button strip (H-2) ──
    {
        buf.moveChar(0, ' ', kBtnBg, W);
        ushort bx = 1;

        // Terrain number buttons
        for (int i = 0; i < kTerrainCount; ++i) {
            std::string btn = "[" + std::to_string(i + 1) + "]";
            TColorAttr col = (i == terrainIdx_) ? kBtnActive : kBtnBg;
            bx = buf.moveStr(bx, TStringView(btn), col);
        }
        bx = buf.moveStr(bx, " ", kBtnBg);

        // Mode buttons
        {
            TColorAttr gc = grow_ ? kBtnActive : kBtnBg;
            bx = buf.moveStr(bx, "[G:Grow]", gc);
            bx = buf.moveStr(bx, " ", kBtnBg);
        }
        {
            TColorAttr tc = triptych_ ? kBtnActive : kBtnBg;
            bx = buf.moveStr(bx, "[T:Tri]", tc);
            bx = buf.moveStr(bx, " ", kBtnBg);
        }

        // Pause (grow only)
        if (grow_) {
            TColorAttr pc = bridge_.isPaused() ? kBtnActive : kBtnBg;
            bx = buf.moveStr(bx, "[Spc:Pause]", pc);
            bx = buf.moveStr(bx, " ", kBtnBg);
        }

        bx = buf.moveStr(bx, "[R:New]", kBtnBg);
        bx = buf.moveStr(bx, " ", kBtnBg);
        bx = buf.moveStr(bx, "[S:Save]", kBtnBg);
        bx = buf.moveStr(bx, " ", kBtnBg);
        bx = buf.moveStr(bx, "[?:Help]", kBtnBg);

        writeLine(0, H - 2, W, 1, buf);
    }

    // ── Status bar (H-1) ──
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
        if (bridge_.isPaused()) {
            x = buf.moveStr(x, "  PAUSED", kBtnActive);
        } else if (bridge_.isRunning()) {
            x = buf.moveStr(x, "  GROWING", kBarDim);
        } else {
            x = buf.moveStr(x, "  DONE", kBarDim);
        }
    } else {
        x = buf.moveStr(x, "  STATIC", kBarDim);
    }

    // Flash message (overrides right side for 3 seconds)
    if (!flashMsg_.empty() && (time(nullptr) - flashTime_) < 3) {
        int fx = W - (int)flashMsg_.size() - 2;
        if (fx > (int)x + 2)
            buf.moveStr(fx, TStringView(flashMsg_), kFlash);
    }

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

        // Space — pause/resume grow mode (SIGSTOP/SIGCONT)
        if (ch == ' ' && grow_ && bridge_.isRunning()) {
            if (bridge_.isPaused()) {
                bridge_.resume();
                flashMsg_ = "RESUMED"; flashTime_ = time(nullptr);
            } else {
                bridge_.pause();
                flashMsg_ = "PAUSED"; flashTime_ = time(nullptr);
            }
            drawView();
            clearEvent(ev); return;
        }

        // h — help (placeholder)
        if (ch == 'h' || ch == 'H') {
            flashMsg_ = "Help: r=new 1-7=terrain g=grow t=tri s=save +/-=lvl";
            flashTime_ = time(nullptr);
            drawView();
            clearEvent(ev); return;
        }

        // s — save to file
        if (ch == 's' || ch == 'S') {
            saveToFile();
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

    // Mouse click on button bar row (H-2)
    if (ev.what == evMouseDown) {
        TPoint mouse = makeLocal(ev.mouse.where);
        int barY = size.y - 2;
        if (mouse.y == barY) {
            // Decode button by x position — match draw layout
            // [1][2][3][4][5][6][7] [G:Grow] [T:Tri] [Spc:Pause] [R:New] [S:Save] [?:Help]
            // Positions: 1-21 = terrain buttons (3 chars each), then mode buttons
            int bx = mouse.x;
            if (bx >= 1 && bx <= 21) {
                int idx = (bx - 1) / 3;
                if (idx >= 0 && idx < kTerrainCount) {
                    terrainIdx_ = idx;
                    seed_ = rand() % 100000;
                    relaunch();
                }
            } else {
                // Scan for button text matches — crude but works
                // Just trigger common actions based on rough x ranges
                // This is approximate — buttons shift based on grow mode
                if (bx >= 22 && bx <= 30) { grow_ = !grow_; relaunch(); }
                else if (bx >= 31 && bx <= 38) { triptych_ = !triptych_; relaunch(); }
                else {
                    // Check for R:New, S:Save, ?:Help in remaining area
                    // Use flash as feedback for now
                }
            }
            clearEvent(ev);
            return;
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
