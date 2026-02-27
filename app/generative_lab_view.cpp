#include "generative_lab_view.h"

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

// ── GenerativeBridge ─────────────────────────────────────

GenerativeBridge::~GenerativeBridge() { stop(); }

std::string GenerativeBridge::resolveScriptPath() {
    const char* root = std::getenv("WIBWOB_REPO_ROOT");
    if (root) return std::string(root) + "/tools/generative_stream.py";

    char exePath[4096];
    uint32_t sz = sizeof(exePath);
    if (_NSGetExecutablePath(exePath, &sz) == 0) {
        std::string dir(exePath);
        auto pos = dir.rfind('/');
        if (pos != std::string::npos) dir = dir.substr(0, pos);
        pos = dir.rfind('/');
        if (pos != std::string::npos) dir = dir.substr(0, pos);
        pos = dir.rfind('/');
        if (pos != std::string::npos) dir = dir.substr(0, pos);
        std::string candidate = dir + "/tools/generative_stream.py";
        if (access(candidate.c_str(), F_OK) == 0) return candidate;
    }

    return "tools/generative_stream.py";
}

bool GenerativeBridge::start(int width, int height, int seed,
                              const std::string& preset, int maxTicks,
                              const std::string& snapshotPath) {
    stop();
    paused_ = false;

    std::string script = resolveScriptPath();
    std::string cmd = "python3 " + script;
    cmd += " --width " + std::to_string(width);
    cmd += " --height " + std::to_string(height);
    cmd += " --seed " + std::to_string(seed);
    cmd += " --preset " + preset;
    cmd += " --max-ticks " + std::to_string(maxTicks);
    if (!snapshotPath.empty())
        cmd += " --snapshot \"" + snapshotPath + "\"";
    cmd += " 2>/tmp/generative_bridge_err.log";

    fprintf(stderr, "[gen-lab] cmd: %s\n", cmd.c_str());

    int pipefd[2];
    if (pipe(pipefd) < 0) return false;

    pid_ = fork();
    if (pid_ < 0) {
        close(pipefd[0]); close(pipefd[1]);
        return false;
    }

    if (pid_ == 0) {
        setpgid(0, 0);
        close(pipefd[0]);
        dup2(pipefd[1], STDOUT_FILENO);
        close(pipefd[1]);
        execl("/bin/sh", "sh", "-c", cmd.c_str(), nullptr);
        _exit(127);
    }

    setpgid(pid_, pid_);
    close(pipefd[1]);
    pipeFd_ = pipefd[0];
    fcntl(pipeFd_, F_SETFL, fcntl(pipeFd_, F_GETFL) | O_NONBLOCK);
    return true;
}

void GenerativeBridge::pause() {
    if (pid_ > 0 && !paused_) {
        kill(-pid_, SIGSTOP);
        paused_ = true;
    }
}

void GenerativeBridge::resume() {
    if (pid_ > 0 && paused_) {
        kill(-pid_, SIGCONT);
        paused_ = false;
    }
}

void GenerativeBridge::stop() {
    if (pid_ > 0) {
        kill(-pid_, SIGTERM);
        usleep(50000);
        int status;
        if (waitpid(pid_, &status, WNOHANG) == 0) {
            kill(-pid_, SIGKILL);
            waitpid(pid_, &status, 0);
        }
        pid_ = -1;
    }
    if (pipeFd_ >= 0) {
        close(pipeFd_);
        pipeFd_ = -1;
    }
}

// ── TGenerativeLabView ──────────────────────────────────

TGenerativeLabView::TGenerativeLabView(const TRect& bounds, TScrollBar* vsb)
    : TScroller(bounds, nullptr, vsb)
{
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evBroadcast | evKeyboard | evMouse;

    srand((unsigned)time(nullptr));
    seed_ = rand() % 100000;
}

TGenerativeLabView::~TGenerativeLabView() {
    stopTimer();
    bridge_.stop();
}

std::string TGenerativeLabView::presetName() const {
    if (presetIdx_ >= 0 && presetIdx_ < kGenPresetCount)
        return kGenPresetNames[presetIdx_];
    return "random";
}

void TGenerativeLabView::startTimer() {
    if (timerId_ == 0)
        timerId_ = setTimer(periodMs_, (int)periodMs_);
}

void TGenerativeLabView::stopTimer() {
    if (timerId_ != 0) { killTimer(timerId_); timerId_ = 0; }
    if (resizeTimerId_ != 0) { killTimer(resizeTimerId_); resizeTimerId_ = 0; }
}

void TGenerativeLabView::launch() {
    lines_.clear();
    nextFrame_.clear();
    partial_.clear();
    statusLine_.clear();
    autoScroll_ = true;
    scrollTo(0, 0);
    setLimit(0, 0);

    int contentW = size.x - 2;
    int contentH = size.y - 3;  // top pad + button bar + status bar
    if (contentW < 5) contentW = 5;
    if (contentH < 5) contentH = 5;

    // Build snapshot path for auto-save
    time_t now = time(nullptr);
    struct tm* t = localtime(&now);
    char ts[64];
    strftime(ts, sizeof(ts), "%Y%m%dT%H%M%S", t);
    std::string snapDir = "exports/generative";
    mkdir("exports", 0755);
    mkdir(snapDir.c_str(), 0755);
    std::string snapPath = snapDir + "/" + std::string(ts)
        + "_" + presetName() + "_s" + std::to_string(seed_) + ".yml";

    bridge_.start(contentW, contentH, seed_, presetName(), maxTicks_, snapPath);
    startTimer();
    drawView();
}

void TGenerativeLabView::deferLaunch() {
    pendingLaunch_ = true;
}

void TGenerativeLabView::relaunch() {
    launch();
}

void TGenerativeLabView::saveToFile() {
    if (lines_.empty()) return;

    mkdir("exports", 0755);
    mkdir("exports/generative", 0755);

    time_t now = time(nullptr);
    struct tm* t = localtime(&now);
    char ts[64];
    strftime(ts, sizeof(ts), "%Y%m%dT%H%M%S", t);

    std::string fname = std::string("exports/generative/") + ts
        + "_" + presetName() + "_s" + std::to_string(seed_) + ".txt";
    int fd = open(fname.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) return;

    std::string hdr = "Generative Lab -- " + presetName()
        + " -- seed " + std::to_string(seed_) + "\n\n";
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

void TGenerativeLabView::debounceRelaunch() {
    if (resizeTimerId_ != 0) killTimer(resizeTimerId_);
    resizeTimerId_ = setTimer(200, 200);
}

void TGenerativeLabView::updateScrollLimit() {
    int contentH = size.y - 3;
    int maxScroll = std::max(0, (int)lines_.size() - contentH);
    setLimit(0, maxScroll);
}

void TGenerativeLabView::scrollToBottom() {
    updateScrollLimit();
    scrollTo(0, limit.y);
}

void TGenerativeLabView::pollPipe() {
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
        bridge_.stop();
        drawView();
    }
}

void TGenerativeLabView::processData(const std::string& data) {
    for (size_t i = 0; i < data.size(); ++i) {
        char c = data[i];

        if (c == '\x1E') {
            // Record separator — swap in completed frame
            if (!partial_.empty()) {
                nextFrame_.push_back(partial_);
                partial_.clear();
            }
            lines_.swap(nextFrame_);
            nextFrame_.clear();
            continue;
        }

        if (c == '\n') {
            if (partial_.size() >= 7 && partial_.substr(0, 7) == "STATUS:") {
                statusLine_ = partial_.substr(7);
                partial_.clear();
                continue;
            }
            nextFrame_.push_back(partial_);
            partial_.clear();
        } else if (c != '\r') {
            partial_ += c;
        }
    }
}

void TGenerativeLabView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    if (pendingLaunch_ && size.x > 5 && size.y > 5) {
        pendingLaunch_ = false;
        launch();
    }

    TDrawBuffer buf;

    static const TColorAttr kBg =
        TColorAttr(TColorRGB(0xCC, 0xCC, 0xCC), TColorRGB(0x00, 0x00, 0x00));
    static const TColorAttr kBarBg =
        TColorAttr(TColorRGB(0x88, 0x88, 0x88), TColorRGB(0x1A, 0x1A, 0x1A));
    static const TColorAttr kBarLabel =
        TColorAttr(TColorRGB(0xFF, 0xFF, 0xFF), TColorRGB(0x1A, 0x1A, 0x1A));
    static const TColorAttr kBarDim =
        TColorAttr(TColorRGB(0x99, 0x99, 0x99), TColorRGB(0x1A, 0x1A, 0x1A));
    static const TColorAttr kBtnBg =
        TColorAttr(TColorRGB(0xBB, 0xBB, 0xBB), TColorRGB(0x33, 0x33, 0x33));
    static const TColorAttr kBtnActive =
        TColorAttr(TColorRGB(0xFF, 0xFF, 0x00), TColorRGB(0x33, 0x33, 0x33));
    static const TColorAttr kFlash =
        TColorAttr(TColorRGB(0x00, 0xFF, 0x66), TColorRGB(0x1A, 0x1A, 0x1A));

    auto blankRow = [&](int y) {
        buf.moveChar(0, ' ', kBg, W);
        writeLine(0, y, W, 1, buf);
    };

    // Top padding
    blankRow(0);

    // Content area
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

        std::string bar = " ";
        int activeStart = -1, activeEnd = -1;

        // Preset buttons: [1:Life] [2:Brain] ... [0:???]
        for (int i = 0; i < kGenPresetCount; ++i) {
            if (i == presetIdx_) activeStart = (int)bar.size();
            bar += "[";
            bar += std::to_string((i + 1) % 10);  // 1-9, then 0 for 10th
            bar += ":";
            bar += kGenPresetLabels[i];
            bar += "]";
            if (i == presetIdx_) activeEnd = (int)bar.size();
            bar += " ";
        }

        // Random mode
        int rndStart = (int)bar.size();
        bar += "[0:???]";
        int rndEnd = (int)bar.size();
        bar += " ";

        // Pause
        int pauseStart = (int)bar.size();
        bar += "[Spc:Pause]";
        int pauseEnd = (int)bar.size();
        bar += " ";

        // Mutate
        int mutStart = (int)bar.size();
        bar += "[M:Mutate]";
        int mutEnd = (int)bar.size();
        bar += " ";

        bar += "[R:New] [S:Save] [I:Info]";

        // Truncate if wider than window
        if ((int)bar.size() > W) bar.resize(W);

        buf.moveStr(0, TStringView(bar), kBtnBg);

        // Highlight active preset
        if (activeStart >= 0 && activeStart < W) {
            int end = std::min(activeEnd, W);
            std::string seg = bar.substr(activeStart, end - activeStart);
            buf.moveStr(activeStart, TStringView(seg), kBtnActive);
        }

        // Highlight random if active
        if (presetIdx_ >= kGenPresetCount && rndStart < W) {
            int end = std::min(rndEnd, W);
            std::string seg = bar.substr(rndStart, end - rndStart);
            buf.moveStr(rndStart, TStringView(seg), kBtnActive);
        }

        // Highlight pause if paused
        if (bridge_.isPaused() && pauseStart < W) {
            int end = std::min(pauseEnd, W);
            std::string seg = bar.substr(pauseStart, end - pauseStart);
            buf.moveStr(pauseStart, TStringView(seg), kBtnActive);
        }

        writeLine(0, H - 2, W, 1, buf);
    }

    // ── Status bar (H-1) ──
    {
        buf.moveChar(0, ' ', kBarBg, W);

        std::string pname = presetName();
        for (auto& c : pname) c = toupper((unsigned char)c);

        std::string state;
        if (!bridge_.isRunning()) state = "DONE";
        else if (bridge_.isPaused()) state = "PAUSED";
        else state = "RUNNING";

        std::string status = " " + pname
            + "  seed:" + std::to_string(seed_)
            + "  " + state;

        // Append parsed status info if available
        if (!statusLine_.empty()) {
            status += "  " + statusLine_;
        }

        if ((int)status.size() > W) status.resize(W);
        buf.moveStr(0, TStringView(status), kBarDim);
        buf.moveStr(1, TStringView(pname), kBarLabel);

        // Flash message
        if (!flashMsg_.empty() && (time(nullptr) - flashTime_) < 3) {
            int fx = W - (int)flashMsg_.size() - 2;
            if (fx > (int)status.size() + 2 && fx < W)
                buf.moveStr(fx, TStringView(flashMsg_), kFlash);
        }

        writeLine(0, H - 1, W, 1, buf);
    }
}

void TGenerativeLabView::handleEvent(TEvent& ev) {
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

    if (ev.what == evKeyDown) {
        char ch = ev.keyDown.charScan.charCode;

        // 1-9 = presets 0-8, 0 = random
        if (ch >= '1' && ch <= '9') {
            int idx = ch - '1';
            if (idx < kGenPresetCount) {
                presetIdx_ = idx;
                seed_ = rand() % 100000;
                relaunch();
                clearEvent(ev); return;
            }
        }
        if (ch == '0') {
            presetIdx_ = kGenPresetCount;  // random
            seed_ = rand() % 100000;
            relaunch();
            clearEvent(ev); return;
        }

        // r — new seed, same preset
        if (ch == 'r' || ch == 'R') {
            seed_ = rand() % 100000;
            relaunch();
            clearEvent(ev); return;
        }

        // Space — pause/resume
        if (ch == ' ' && bridge_.isRunning()) {
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

        // . — step one tick (when paused: briefly resume then re-pause)
        if (ch == '.' && bridge_.isRunning() && bridge_.isPaused()) {
            bridge_.resume();
            usleep(50000);  // let one tick through
            bridge_.pause();
            pollPipe();
            drawView();
            clearEvent(ev); return;
        }

        // m — mutate: new seed for random preset, or reroll random
        if (ch == 'm' || ch == 'M') {
            if (presetIdx_ >= kGenPresetCount) {
                // Random mode: reroll with new seed (new random rules)
                seed_ = rand() % 100000;
            } else {
                // Named preset: re-seed for different initial conditions
                seed_ = rand() % 100000;
            }
            flashMsg_ = "MUTATED seed:" + std::to_string(seed_);
            flashTime_ = time(nullptr);
            relaunch();
            clearEvent(ev); return;
        }

        // s — save
        if (ch == 's' || ch == 'S') {
            saveToFile();
            clearEvent(ev); return;
        }

        // i — info flash
        if (ch == 'i' || ch == 'I') {
            flashMsg_ = "1-9=preset 0=random r=new m=mutate s=save .=step";
            flashTime_ = time(nullptr);
            drawView();
            clearEvent(ev); return;
        }

        // TAB — cycle presets
        if (ev.keyDown.keyCode == kbTab) {
            presetIdx_ = (presetIdx_ + 1) % (kGenPresetCount + 1);
            seed_ = rand() % 100000;
            relaunch();
            clearEvent(ev); return;
        }

        // +/= faster, -/_ slower
        if (ch == '+' || ch == '=') {
            periodMs_ = std::max(10u, periodMs_ - 10);
            stopTimer(); startTimer();
            flashMsg_ = "Speed: " + std::to_string(periodMs_) + "ms";
            flashTime_ = time(nullptr);
            drawView();
            clearEvent(ev); return;
        }
        if (ch == '-' || ch == '_') {
            periodMs_ = std::min(500u, periodMs_ + 10);
            stopTimer(); startTimer();
            flashMsg_ = "Speed: " + std::to_string(periodMs_) + "ms";
            flashTime_ = time(nullptr);
            drawView();
            clearEvent(ev); return;
        }
    }

    // Scroll
    int prevY = delta.y;
    TScroller::handleEvent(ev);
    if (delta.y != prevY) {
        autoScroll_ = (delta.y >= limit.y);
    }
}

void TGenerativeLabView::setState(ushort aState, Boolean enable) {
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

void TGenerativeLabView::changeBounds(const TRect& bounds) {
    TScroller::changeBounds(bounds);
    if (bridge_.isRunning()) {
        debounceRelaunch();
    }
}

// ── Window ───────────────────────────────────────────────

TGenerativeLabWindow::TGenerativeLabWindow(const TRect& bounds)
    : TWindow(bounds, "Generative Lab", wnNoNumber)
    , TWindowInit(&TGenerativeLabWindow::initFrame) {}

void TGenerativeLabWindow::setup() {
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
    auto* view = new TGenerativeLabView(viewRect, vsb);
    insert(view);
    view->deferLaunch();
}

void TGenerativeLabWindow::changeBounds(const TRect& b) {
    TWindow::changeBounds(b);
    setState(sfExposed, True);
    redraw();
}

// ── Factory ──────────────────────────────────────────────

TWindow* createGenerativeLabWindow(const TRect& bounds) {
    auto* w = new TGenerativeLabWindow(bounds);
    w->setup();
    return w;
}
