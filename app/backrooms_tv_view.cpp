/*---------------------------------------------------------*/
/*                                                         */
/*   backrooms_tv_view.cpp - Live ASCII art generator      */
/*                                                         */
/*---------------------------------------------------------*/

#include "backrooms_tv_view.h"

#define Uses_TWindow
#define Uses_TEvent
#define Uses_TKeys
#define Uses_TText
#define Uses_TDrawBuffer
#include <tvision/tv.h>

#include <cstdlib>
#include <cstring>
#include <cerrno>
#include <csignal>
#include <unistd.h>
#include <fcntl.h>
#include <sys/wait.h>
#include <sys/stat.h>

// Jet black background (#000), white foreground (#FFF)
static const TColorAttr kTextAttr =
    TColorAttr(TColorRGB(0xFF, 0xFF, 0xFF), TColorRGB(0x00, 0x00, 0x00));
static const TColorAttr kBlankAttr =
    TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x00, 0x00, 0x00));
// Status bar: dim grey on black
static const TColorAttr kStatusAttr =
    TColorAttr(TColorRGB(0x66, 0x66, 0x66), TColorRGB(0x00, 0x00, 0x00));

// ===== BackroomsBridge =====

BackroomsBridge::BackroomsBridge() {}

BackroomsBridge::~BackroomsBridge() {
    stop();
}

std::string BackroomsBridge::resolveBackroomsPath() const {
    // 1. Environment variable
    const char *env = std::getenv("WIBWOB_BACKROOMS_PATH");
    if (env && env[0]) return std::string(env);

    // 2. Sibling directory from repo root
    const char *repo = std::getenv("WIBWOB_REPO_ROOT");
    if (repo && repo[0]) {
        std::string p(repo);
        // Go up one level from wibandwob-dos to parent, then into wibandwob-backrooms
        auto slash = p.rfind('/');
        if (slash != std::string::npos) {
            return p.substr(0, slash) + "/wibandwob-backrooms";
        }
    }

    // 3. Hardcoded fallback (common dev layout)
    return "../wibandwob-backrooms";
}

bool BackroomsBridge::start(const BackroomsChannel &channel) {
    stop();  // kill any existing child

    std::string backroomsPath = resolveBackroomsPath();

    // Build command
    std::string cmd = "cd " + backroomsPath + " && npx tsx src/ui/cli-v3.ts";
    cmd += " \"" + channel.theme + "\"";
    cmd += " --turns " + std::to_string(channel.turns);
    if (!channel.primers.empty()) {
        cmd += " --primers \"" + channel.primers + "\"";
    }
    cmd += " --model " + channel.model;
    cmd += " --raw";       // stream only LLM deltas to stdout, no formatting
    cmd += " 2>/dev/null"; // suppress stderr

    // Create pipe
    int pipefd[2];
    if (pipe(pipefd) < 0) return false;

    pid_ = fork();
    if (pid_ < 0) {
        close(pipefd[0]);
        close(pipefd[1]);
        return false;
    }

    if (pid_ == 0) {
        // Child: redirect stdout to pipe write-end
        close(pipefd[0]);
        dup2(pipefd[1], STDOUT_FILENO);
        close(pipefd[1]);
        execl("/bin/sh", "sh", "-c", cmd.c_str(), nullptr);
        _exit(127);
    }

    // Parent: read from pipe read-end
    close(pipefd[1]);
    fd_ = pipefd[0];

    // Set non-blocking
    int flags = fcntl(fd_, F_GETFL, 0);
    if (flags >= 0) fcntl(fd_, F_SETFL, flags | O_NONBLOCK);

    return true;
}

void BackroomsBridge::stop() {
    if (pid_ > 0) {
        kill(pid_, SIGTERM);
        // Give it a moment, then force
        int status;
        usleep(50000);  // 50ms
        if (waitpid(pid_, &status, WNOHANG) == 0) {
            kill(pid_, SIGKILL);
            waitpid(pid_, &status, 0);
        }
        pid_ = -1;
    }
    if (fd_ >= 0) {
        close(fd_);
        fd_ = -1;
    }
}

int BackroomsBridge::readAvailable(std::string &out) {
    if (fd_ < 0) return -1;

    char buf[4096];
    ssize_t n = read(fd_, buf, sizeof(buf));
    if (n > 0) {
        out.append(buf, n);
        return (int)n;
    }
    if (n == 0) {
        // EOF — child closed stdout
        return -1;
    }
    // EAGAIN/EWOULDBLOCK = nothing available yet
    if (errno == EAGAIN || errno == EWOULDBLOCK) return 0;
    return -1;
}

// ===== TBackroomsTvView =====

TBackroomsTvView::TBackroomsTvView(const TRect &bounds, TScrollBar *vsb)
    : TScroller(bounds, nullptr, vsb)
{
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evBroadcast | evKeyboard;
}

TBackroomsTvView::~TBackroomsTvView() {
    stopTimer();
    bridge_.stop();
    if (logFd_ >= 0) {
        close(logFd_);
        logFd_ = -1;
    }
}

void TBackroomsTvView::openLogFile() {
    // Create logs/backrooms-tv/ directory
    std::string dir = "logs/backrooms-tv";
    mkdir("logs", 0755);
    mkdir(dir.c_str(), 0755);

    // Timestamp filename
    time_t now = time(nullptr);
    struct tm *t = localtime(&now);
    char buf[128];
    strftime(buf, sizeof(buf), "%Y%m%dT%H%M%S", t);

    // Sanitise theme for filename
    std::string safeTheme;
    for (char c : channel_.theme) {
        if (std::isalnum((unsigned char)c) || c == '-' || c == '_')
            safeTheme += c;
        else if (c == ' ')
            safeTheme += '-';
    }
    if (safeTheme.size() > 30) safeTheme.resize(30);

    logPath_ = dir + "/" + std::string(buf) + "_" + safeTheme + ".txt";
    logFd_ = open(logPath_.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
}

void TBackroomsTvView::writeToLog(const std::string &text) {
    if (logFd_ >= 0) {
        ::write(logFd_, text.data(), text.size());
    }
}

void TBackroomsTvView::startTimer() {
    if (timerId_ == 0)
        timerId_ = setTimer(periodMs_, (int)periodMs_);
}

void TBackroomsTvView::stopTimer() {
    if (timerId_ != 0) {
        killTimer(timerId_);
        timerId_ = 0;
    }
}

void TBackroomsTvView::updateScrollLimit() {
    int contentH = size.y - kPadding * 2 - 2;  // must match draw(): -2 for 2-row status bar
    int maxScroll = std::max(0, (int)lines_.size() - contentH);
    // Set limit directly — do NOT use TScroller::setLimit() here.
    // setLimit() passes (limit.y - size.y) as the scrollbar max, which is negative
    // when limit.y < size.y (our typical case). TScrollBar::setParams() then clamps
    // max to 0, making every setValue() snap to 0 and killing auto-scroll.
    // Instead: set limit.y ourselves and give the scrollbar the correct range directly.
    limit.x = 0;
    limit.y = maxScroll;
    if (vScrollBar) {
        int pg = (contentH > 1) ? contentH - 1 : 1;
        vScrollBar->setParams(vScrollBar->value, 0, maxScroll, pg, 3);
    }
}

void TBackroomsTvView::scrollToBottom() {
    updateScrollLimit();
    scrollTo(0, limit.y);
}

void TBackroomsTvView::play(const BackroomsChannel &channel) {
    channel_ = channel;
    lines_.clear();
    partial_.clear();
    autoScroll_ = true;
    paused_ = false;

    // Close previous log, open new one
    if (logFd_ >= 0) { close(logFd_); logFd_ = -1; }
    openLogFile();

    bridge_.start(channel_);
    startTimer();
    delta.x = delta.y = 0;
    limit.x = limit.y = 0;
    if (vScrollBar) vScrollBar->setParams(0, 0, 0, 1, 3);
    drawView();
}

void TBackroomsTvView::pause() {
    paused_ = true;
    // Don't stop the timer — we still want to drain the pipe
    // so the child doesn't block on a full pipe buffer.
    drawView();
}

void TBackroomsTvView::resume() {
    paused_ = false;
    autoScroll_ = true;
    scrollToBottom();
    drawView();
}

void TBackroomsTvView::next() {
    play(channel_);
}

void TBackroomsTvView::pollPipe() {
    if (!bridge_.isRunning()) return;

    std::string data;
    int n = bridge_.readAvailable(data);

    if (n > 0) {
        writeToLog(data);
        appendText(data);
        if (autoScroll_) {
            scrollToBottom();
        } else {
            updateScrollLimit();
        }
        drawView();
    } else if (n < 0) {
        // Child exited — reap
        bridge_.stop();
        // Add a separator line
        lines_.push_back("--- end of transmission ---");
        drawView();
    }
}

void TBackroomsTvView::appendText(const std::string &text) {
    // Split incoming bytes into lines, handling partial lines
    for (size_t i = 0; i < text.size(); ++i) {
        char c = text[i];
        if (c == '\n') {
            // Skip triple-backtick lines from display (kept in raw log)
            std::string trimmed = partial_;
            size_t start = trimmed.find_first_not_of(" \t");
            if (start != std::string::npos) trimmed = trimmed.substr(start);
            if (trimmed.substr(0, 3) != "```") {
                lines_.push_back(partial_);
            }
            partial_.clear();
            // Cap ring buffer
            while ((int)lines_.size() > kMaxLines) {
                lines_.pop_front();
            }
        } else if (c == '\r') {
            // skip CR
        } else {
            partial_ += c;
        }
    }
}

void TBackroomsTvView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    TDrawBuffer buf;

    const int pad = kPadding;
    const int contentH = H - pad * 2 - 2;  // -2 for 2-row status bar at bottom

    // Helper: fill a full row with blank (black) cells
    auto blankRow = [&](int y) {
        buf.moveChar(0, ' ', kBlankAttr, W);
        writeLine(0, y, W, 1, buf);
    };

    // Top padding rows
    for (int y = 0; y < pad && y < H; ++y)
        blankRow(y);

    // Content area — delta.y is the top visible line index (managed by TScroller)
    if (contentH > 0) {
        int totalLines = (int)lines_.size();
        int topLine = delta.y;

        for (int row = 0; row < contentH && (pad + row) < H; ++row) {
            int lineIdx = topLine + row;

            // Fill row black, then draw text with UTF-8 support
            buf.moveChar(0, ' ', kBlankAttr, W);

            if (lineIdx >= 0 && lineIdx < totalLines) {
                const std::string &line = lines_[lineIdx];
                // moveStr handles UTF-8 multi-byte characters correctly
                buf.moveStr(pad, TStringView(line), kTextAttr);
            }

            writeLine(0, pad + row, W, 1, buf);
        }
    }

    // Bottom padding rows (before status bar)
    for (int y = pad + contentH; y < H - 2; ++y)
        blankRow(y);

    // 2-row status bar at bottom
    if (H >= 2) {
        static const TColorAttr kBarBg =
            TColorAttr(TColorRGB(0x88, 0x88, 0x88), TColorRGB(0x1A, 0x1A, 0x1A));
        static const TColorAttr kBarLabel =
            TColorAttr(TColorRGB(0xFF, 0xFF, 0xFF), TColorRGB(0x1A, 0x1A, 0x1A));
        static const TColorAttr kBarDim =
            TColorAttr(TColorRGB(0x66, 0x66, 0x66), TColorRGB(0x1A, 0x1A, 0x1A));
        static const TColorAttr kBarLive =
            TColorAttr(TColorRGB(0x00, 0xFF, 0x66), TColorRGB(0x1A, 0x1A, 0x1A));
        static const TColorAttr kBarPaused =
            TColorAttr(TColorRGB(0xFF, 0xCC, 0x00), TColorRGB(0x1A, 0x1A, 0x1A));
        static const TColorAttr kBarIdle =
            TColorAttr(TColorRGB(0x66, 0x66, 0x66), TColorRGB(0x1A, 0x1A, 0x1A));

        // ── Row 1: state + theme + turns + primers ──
        buf.moveChar(0, ' ', kBarBg, W);
        ushort x = 1;

        if (bridge_.isRunning()) {
            x = buf.moveStr(x, paused_ ? " PAUSED " : " LIVE ", paused_ ? kBarPaused : kBarLive);
        } else {
            x = buf.moveStr(x, " IDLE ", kBarIdle);
        }

        x = buf.moveStr(x, "  ", kBarBg);
        x = buf.moveStr(x, TStringView(channel_.theme), kBarLabel);

        std::string turnsStr = "  " + std::to_string(channel_.turns) + " turns";
        x = buf.moveStr(x, TStringView(turnsStr), kBarDim);

        if (!channel_.primers.empty()) {
            std::string pStr = "  primers: " + channel_.primers;
            // Truncate if too long
            int maxPW = W - (int)x - 2;
            if ((int)pStr.size() > maxPW && maxPW > 5)
                pStr = pStr.substr(0, maxPW - 3) + "...";
            x = buf.moveStr(x, TStringView(pStr), kBarDim);
        }

        writeLine(0, H - 2, W, 1, buf);

        // ── Row 2: log path (left) + controls (right) ──
        buf.moveChar(0, ' ', kBarBg, W);

        if (!logPath_.empty()) {
            std::string logStr = " \xF0 " + logPath_;  // ≡ prefix
            buf.moveStr(1, TStringView(logStr), kBarDim);
        }

        std::string hint = " Esc:close  Spc:pause  N:next  R:new ";
        int hintW = (int)hint.size();
        if (W - hintW >= 1)
            buf.moveStr(W - hintW, TStringView(hint), kBarDim);

        writeLine(0, H - 1, W, 1, buf);
    }
}

void TBackroomsTvView::handleEvent(TEvent &ev) {
    // Timer tick — poll the pipe (handle before TScroller)
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId_ != 0 && ev.message.infoPtr == timerId_) {
            pollPipe();
            clearEvent(ev);
            return;
        }
    }

    // Our custom keys — intercept before TScroller eats them
    if (ev.what == evKeyDown) {
        if (ev.keyDown.charScan.charCode == ' ') {
            if (paused_) resume(); else pause();
            clearEvent(ev);
            return;
        }
        char ch = ev.keyDown.charScan.charCode;
        if (ch == 'n' || ch == 'N') {
            next();
            clearEvent(ev);
            return;
        }
        if (ch == 'r' || ch == 'R') {
            bridge_.stop();
            BackroomsChannel newChannel;
            if (showBackroomsTvDialog(newChannel)) {
                play(newChannel);
            }
            clearEvent(ev);
            return;
        }
    }

    // Let TScroller handle everything else: ↑↓ PgUp PgDn Home End + scrollbar clicks
    int prevY = delta.y;
    TScroller::handleEvent(ev);

    // Track auto-scroll state after TScroller processes the event
    if (delta.y != prevY) {
        autoScroll_ = (delta.y >= limit.y);
    }
}

void TBackroomsTvView::setState(ushort aState, Boolean enable) {
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

void TBackroomsTvView::changeBounds(const TRect &bounds) {
    TScroller::changeBounds(bounds);
    updateScrollLimit();
    drawView();
}

// ===== Window wrapper =====

class TBackroomsTvWindow : public TWindow {
public:
    TBackroomsTvWindow(const TRect &bounds)
        : TWindow(bounds, "Backrooms TV", wnNoNumber)
        , TWindowInit(&TBackroomsTvWindow::initFrame) {}

    void setup(const BackroomsChannel &channel) {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);  // inside the frame

        // Vertical scrollbar on right edge
        TRect sbRect = c;
        sbRect.a.x = sbRect.b.x - 1;
        auto *vsb = new TScrollBar(sbRect);
        vsb->growMode = gfGrowLoX | gfGrowHiX | gfGrowHiY;
        insert(vsb);

        // View takes remaining space (minus scrollbar)
        TRect viewRect = c;
        viewRect.b.x -= 1;
        auto *view = new TBackroomsTvView(viewRect, vsb);
        insert(view);
        view->play(channel);
    }

    virtual void changeBounds(const TRect &b) override {
        TWindow::changeBounds(b);
        setState(sfExposed, True);
        redraw();
    }
};

TWindow* createBackroomsTvWindow(const TRect &bounds) {
    BackroomsChannel defaultChannel;
    return createBackroomsTvWindow(bounds, defaultChannel);
}

TWindow* createBackroomsTvWindow(const TRect &bounds, const BackroomsChannel &channel) {
    auto *w = new TBackroomsTvWindow(bounds);
    w->setup(channel);
    return w;
}

// ===== Config dialog =====

#define Uses_TDialog
#define Uses_TStaticText
#define Uses_TButton
#define Uses_TLabel
#define Uses_TInputLine
#define Uses_TRadioButtons
#define Uses_TListBox
#define Uses_TScrollBar
#define Uses_TSItem
#define Uses_TStringCollection
#define Uses_TProgram
#define Uses_TDeskTop
#include <tvision/tv.h>

#include <dirent.h>
#include <sys/stat.h>
#include <algorithm>
#include "ascii_gallery_view.h"

// Custom command IDs for dialog buttons
static const ushort cmBktvAdd       = 900;
static const ushort cmBktvRemove    = 901;
static const ushort cmBktvRandom3   = 902;
static const ushort cmBktvPlay      = 903;
static const ushort cmBktvListFocus = 904;  // available list cursor moved
static const ushort cmBktvRandom6   = 905;
static const ushort cmBktvRandom9   = 906;
static const ushort cmBktvClear     = 907;

// Helper: scan backrooms primers/ directory for .txt files
static std::vector<std::string> scanPrimerNames(const std::string &backroomsPath) {
    std::vector<std::string> names;
    std::string dir = backroomsPath + "/primers";
    DIR *d = opendir(dir.c_str());
    if (!d) return names;
    struct dirent *entry;
    while ((entry = readdir(d)) != nullptr) {
        std::string name(entry->d_name);
        if (name.size() > 4 && name.substr(name.size() - 4) == ".txt") {
            names.push_back(name.substr(0, name.size() - 4)); // strip .txt
        }
    }
    closedir(d);
    std::sort(names.begin(), names.end());
    return names;
}

static TStringCollection* makeStringCol(const std::vector<std::string> &items) {
    TStringCollection *col = new TStringCollection(
        std::max((int)items.size(), 1), 10);
    for (auto &s : items)
        col->insert(newStr(s.c_str()));
    return col;
}

// TListBox subclass that broadcasts cmBktvListFocus when cursor moves.
class TBktvListBox : public TListBox {
public:
    TBktvListBox(const TRect &bounds, ushort numCols, TScrollBar *aScrollBar)
        : TListBox(bounds, numCols, aScrollBar) {}

    virtual void handleEvent(TEvent &event) override {
        int prevFocused = focused;
        TListBox::handleEvent(event);
        if (focused != prevFocused)
            message(owner, evBroadcast, cmBktvListFocus, this);
    }
};

class TBackroomsTvDialog : public TDialog {
public:
    TInputLine      *themeInput;
    TInputLine      *turnsInput;
    TRadioButtons   *modelRadio;
    TBktvListBox    *availList;
    TListBox        *selectedList;
    TScrollBar      *availSB;
    TScrollBar      *selectedSB;
    TGalleryPreview *preview;
    TScrollBar      *previewSB;

    std::vector<std::string> availPrimers;
    std::vector<std::string> selectedPrimers;
    std::string backroomsPath_;

    TBackroomsTvDialog(const TRect &bounds,
                       const std::vector<std::string> &primers,
                       const std::string &backroomsPath)
        : TDialog(bounds, "Backrooms TV")
        , TWindowInit(&TBackroomsTvDialog::initFrame)
        , availPrimers(primers)
        , backroomsPath_(backroomsPath)
    {
        const int W = bounds.b.x - bounds.a.x;
        const int H = bounds.b.y - bounds.a.y;

        // Theme
        insert(new TLabel(TRect(3, 2, 10, 3), "~T~heme", nullptr));
        themeInput = new TInputLine(TRect(3, 3, W - 3, 4), 256);
        insert(themeInput);

        // Turns
        insert(new TLabel(TRect(3, 5, 10, 6), "T~u~rns", nullptr));
        turnsInput = new TInputLine(TRect(3, 6, 13, 7), 4);
        insert(turnsInput);

        // Model radio buttons
        insert(new TLabel(TRect(16, 5, 23, 6), "~M~odel", nullptr));
        modelRadio = new TRadioButtons(TRect(16, 6, 40, 9),
            new TSItem("Haiku  (fastest)",
            new TSItem("Sonnet (default)",
            new TSItem("Opus   (slowest)",
            nullptr))));
        insert(modelRadio);

        // 3-column layout: Available | Preview | Selected
        const int listTop = 10;
        const int listH   = std::max(8, H - 18);
        const int listW   = std::max(15, W / 5);   // side column width
        const int prevX1  = 3 + listW + 2;          // preview left edge
        const int prevX2  = W - 3 - listW - 2;      // preview right edge (excl. scrollbar)

        // Available list (left)
        insert(new TLabel(TRect(3, listTop - 1, 3 + listW, listTop), "A~v~ailable", nullptr));
        availSB = new TScrollBar(TRect(2 + listW, listTop, 3 + listW, listTop + listH));
        insert(availSB);
        availList = new TBktvListBox(TRect(3, listTop, 2 + listW, listTop + listH), 1, availSB);
        insert(availList);

        // Preview (centre)
        insert(new TLabel(TRect(prevX1, listTop - 1, prevX2 - 1, listTop), "Preview", nullptr));
        previewSB = new TScrollBar(TRect(prevX2 - 1, listTop, prevX2, listTop + listH));
        insert(previewSB);
        preview = new TGalleryPreview(TRect(prevX1, listTop, prevX2 - 1, listTop + listH), previewSB);
        insert(preview);

        // Selected list (right)
        insert(new TLabel(TRect(prevX2 + 1, listTop - 1, W - 3, listTop), "~S~elected", nullptr));
        selectedSB = new TScrollBar(TRect(W - 4, listTop, W - 3, listTop + listH));
        insert(selectedSB);
        selectedList = new TListBox(TRect(prevX2 + 1, listTop, W - 4, listTop + listH), 1, selectedSB);
        insert(selectedList);

        // Buttons below lists
        int btnY = listTop + listH + 1;
        insert(new TButton(TRect(3,  btnY, 12, btnY + 2), "~A~dd →",    cmBktvAdd,    bfNormal));
        insert(new TButton(TRect(13, btnY, 24, btnY + 2), "← ~R~emove", cmBktvRemove, bfNormal));
        insert(new TButton(TRect(25, btnY, 36, btnY + 2), "+~3~ rnd",    cmBktvRandom3, bfNormal));
        insert(new TButton(TRect(37, btnY, 48, btnY + 2), "+~6~ rnd",    cmBktvRandom6, bfNormal));
        insert(new TButton(TRect(49, btnY, 60, btnY + 2), "+~9~ rnd",    cmBktvRandom9, bfNormal));
        insert(new TButton(TRect(61, btnY, 72, btnY + 2), "C~l~ear",     cmBktvClear,   bfNormal));

        // Play / Cancel
        int playY = btnY + 3;
        insert(new TButton(TRect(W/2 - 14, playY, W/2 - 2,  playY + 2), " \x10 ~P~lay", cmBktvPlay, bfDefault));
        insert(new TButton(TRect(W/2 + 2,  playY, W/2 + 14, playY + 2), "Cancel",       cmCancel,   bfNormal));

        // Set defaults
        char defaultTheme[] = "liminal spaces";
        themeInput->setData(defaultTheme);
        char defaultTurns[] = "3";
        turnsInput->setData(defaultTurns);
        modelRadio->press(1); // Sonnet

        rebuildLists();
        updatePreview();  // load first item immediately
    }

    void updatePreview() {
        if (availPrimers.empty()) { preview->clear(); return; }
        int idx = availList->focused;
        if (idx >= 0 && idx < (int)availPrimers.size()) {
            std::string path = backroomsPath_ + "/primers/" + availPrimers[idx] + ".txt";
            preview->loadFile(path);
        } else {
            preview->clear();
        }
    }

    void rebuildLists() {
        availList->newList(makeStringCol(availPrimers));
        selectedList->newList(makeStringCol(selectedPrimers));
    }

    void addSelected() {
        int idx = availList->focused;
        int top = availList->topItem;
        if (idx < 0 || idx >= (int)availPrimers.size()) return;
        std::string name = availPrimers[idx];
        for (auto &s : selectedPrimers)
            if (s == name) return;
        selectedPrimers.push_back(name);
        rebuildLists();
        // Restore scroll position after list rebuild
        int maxAvail = (int)availPrimers.size() - 1;
        availList->focused = (idx <= maxAvail) ? idx : (maxAvail > 0 ? maxAvail : 0);
        availList->topItem = (top <= availList->focused) ? top : availList->focused;
        availList->drawView();
    }

    void removeSelected() {
        int idx = selectedList->focused;
        int top = selectedList->topItem;
        if (idx < 0 || idx >= (int)selectedPrimers.size()) return;
        selectedPrimers.erase(selectedPrimers.begin() + idx);
        rebuildLists();
        // Restore scroll position after list rebuild
        int maxSel = (int)selectedPrimers.size() - 1;
        selectedList->focused = (idx <= maxSel) ? idx : (maxSel > 0 ? maxSel : 0);
        selectedList->topItem = (top <= selectedList->focused) ? top : selectedList->focused;
        selectedList->drawView();
    }

    // Additively pick n random primers not already in selectedPrimers.
    void randomAdd(int n) {
        // Build pool of primers not already selected
        std::vector<int> pool;
        for (int i = 0; i < (int)availPrimers.size(); ++i) {
            bool already = false;
            for (auto &s : selectedPrimers)
                if (s == availPrimers[i]) { already = true; break; }
            if (!already) pool.push_back(i);
        }
        // Fisher-Yates partial shuffle up to min(n, pool.size()) picks
        int picks = (n < (int)pool.size()) ? n : (int)pool.size();
        for (int i = 0; i < picks; ++i) {
            int j = i + (std::rand() % (pool.size() - i));
            std::swap(pool[i], pool[j]);
            selectedPrimers.push_back(availPrimers[pool[i]]);
        }
        rebuildLists();
    }

    void clearSelected() {
        selectedPrimers.clear();
        rebuildLists();
    }

    virtual void handleEvent(TEvent &event) override {
        TDialog::handleEvent(event);
        if (event.what == evCommand) {
            switch (event.message.command) {
                case cmBktvAdd:
                    addSelected();
                    clearEvent(event);
                    break;
                case cmBktvRemove:
                    removeSelected();
                    clearEvent(event);
                    break;
                case cmBktvRandom3:
                    randomAdd(3);
                    clearEvent(event);
                    break;
                case cmBktvRandom6:
                    randomAdd(6);
                    clearEvent(event);
                    break;
                case cmBktvRandom9:
                    randomAdd(9);
                    clearEvent(event);
                    break;
                case cmBktvClear:
                    clearSelected();
                    clearEvent(event);
                    break;
                case cmBktvPlay:
                    endModal(cmBktvPlay);
                    clearEvent(event);
                    break;
            }
        }
        // Live preview: update when cursor moves in available list
        if (event.what == evBroadcast &&
            event.message.command == cmBktvListFocus &&
            event.message.infoPtr == availList) {
            updatePreview();
            clearEvent(event);
        }
    }

    BackroomsChannel getChannel() const {
        BackroomsChannel ch;

        // Theme
        char buf[256] = {};
        themeInput->getData(buf);
        ch.theme = std::string(buf);
        if (ch.theme.empty()) ch.theme = "liminal spaces";

        // Turns
        char turnsBuf[8] = {};
        turnsInput->getData(turnsBuf);
        ch.turns = std::atoi(turnsBuf);
        if (ch.turns < 1) ch.turns = 1;
        if (ch.turns > 20) ch.turns = 20;

        // Model
        const char* models[] = {"haiku", "sonnet", "opus"};
        ushort modelIdx = 1;
        modelRadio->getData(&modelIdx);
        ch.model = models[modelIdx < 3 ? modelIdx : 1];

        // Primers (comma-separated)
        std::string primers;
        for (size_t i = 0; i < selectedPrimers.size(); ++i) {
            if (i > 0) primers += ",";
            primers += selectedPrimers[i];
        }
        ch.primers = primers;

        return ch;
    }
};

bool showBackroomsTvDialog(BackroomsChannel &outChannel) {
    // Resolve backrooms path for primer scanning
    BackroomsBridge bridge;
    std::string backroomsPath = bridge.resolveBackroomsPath();
    std::vector<std::string> primers = scanPrimerNames(backroomsPath);

    // Size dialog to 70% of desktop, min 70x28 (wider for 3-column layout)
    int deskW = TProgram::deskTop->size.x;
    int deskH = TProgram::deskTop->size.y;
    int dlgW = std::max(70, deskW * 7 / 10);
    int dlgH = std::max(28, deskH * 7 / 10);
    TRect r(0, 0, dlgW, dlgH);
    r.move((TProgram::deskTop->size.x - dlgW) / 2,
           (TProgram::deskTop->size.y - dlgH) / 2);

    auto *dlg = new TBackroomsTvDialog(r, primers, backroomsPath);
    ushort result = TProgram::deskTop->execView(dlg);

    if (result == cmBktvPlay) {
        outChannel = dlg->getChannel();
        TObject::destroy(dlg);
        return true;
    }

    TObject::destroy(dlg);
    return false;
}
