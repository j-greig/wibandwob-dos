/*---------------------------------------------------------*/
/*                                                         */
/*   backrooms_tv_view.cpp - Live ASCII art generator      */
/*                                                         */
/*---------------------------------------------------------*/

#include "backrooms_tv_view.h"

#define Uses_TWindow
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include <cstdlib>
#include <cstring>
#include <cerrno>
#include <csignal>
#include <unistd.h>
#include <fcntl.h>
#include <sys/wait.h>

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

TBackroomsTvView::TBackroomsTvView(const TRect &bounds)
    : TView(bounds)
{
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evBroadcast | evKeyboard;
}

TBackroomsTvView::~TBackroomsTvView() {
    stopTimer();
    bridge_.stop();
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

void TBackroomsTvView::play(const BackroomsChannel &channel) {
    channel_ = channel;
    lines_.clear();
    partial_.clear();
    scrollOffset_ = 0;
    paused_ = false;
    bridge_.start(channel_);
    startTimer();
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
    scrollOffset_ = 0;  // snap back to bottom
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
        appendText(data);
        if (!paused_) {
            scrollOffset_ = 0;  // auto-scroll to bottom
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
            lines_.push_back(partial_);
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

    if ((int)lineBuf_.size() < W)
        lineBuf_.resize(W);

    const int pad = kPadding;
    const int contentW = W - pad * 2;  // usable text width
    const int contentH = H - pad * 2 - 1;  // -1 for status bar at bottom

    // Helper: fill a full row with blank (black) cells
    auto blankRow = [&](int y) {
        for (int x = 0; x < W; ++x)
            setCell(lineBuf_[x], ' ', kBlankAttr);
        writeLine(0, y, W, 1, lineBuf_.data());
    };

    // Top padding rows
    for (int y = 0; y < pad && y < H; ++y)
        blankRow(y);

    // Content area
    if (contentW > 0 && contentH > 0) {
        int totalLines = (int)lines_.size();
        // Which line in our buffer corresponds to the bottom of the view?
        int bottomLine = totalLines - 1 - scrollOffset_;
        int topLine = bottomLine - contentH + 1;

        for (int row = 0; row < contentH && (pad + row) < H; ++row) {
            int lineIdx = topLine + row;

            // Fill entire row black first
            for (int x = 0; x < W; ++x)
                setCell(lineBuf_[x], ' ', kBlankAttr);

            // Write text content with padding offset
            if (lineIdx >= 0 && lineIdx < totalLines) {
                const std::string &line = lines_[lineIdx];
                for (int x = 0; x < contentW && x < (int)line.size(); ++x) {
                    setCell(lineBuf_[pad + x], line[x], kTextAttr);
                }
            }

            writeLine(0, pad + row, W, 1, lineBuf_.data());
        }
    }

    // Bottom padding rows (before status bar)
    for (int y = pad + contentH; y < H - 1; ++y)
        blankRow(y);

    // Status bar (last row)
    if (H > 0) {
        for (int x = 0; x < W; ++x)
            setCell(lineBuf_[x], ' ', kBlankAttr);

        std::string status;
        if (bridge_.isRunning()) {
            status = paused_ ? " [PAUSED]" : " [LIVE]";
        } else {
            status = " [IDLE]";
        }
        status += "  " + channel_.theme;
        status += "  " + std::to_string(channel_.turns) + " turns";
        if (!channel_.primers.empty())
            status += "  primers: " + channel_.primers;

        // Write status with padding
        for (int x = 0; x < (int)status.size() && (pad + x) < W; ++x)
            setCell(lineBuf_[pad + x], status[x], kStatusAttr);

        writeLine(0, H - 1, W, 1, lineBuf_.data());
    }
}

void TBackroomsTvView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);

    // Timer tick — poll the pipe
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId_ != 0 && ev.message.infoPtr == timerId_) {
            pollPipe();
            clearEvent(ev);
            return;
        }
    }

    // Keyboard
    if (ev.what == evKeyDown) {
        // Space: check charCode since kbSpace doesn't exist in TV
        if (ev.keyDown.charScan.charCode == ' ') {
            if (paused_) resume(); else pause();
            clearEvent(ev);
            return;
        }
        switch (ev.keyDown.keyCode) {
            case kbEsc:
                // Escape: kill subprocess and close the window
                bridge_.stop();
                // Send close command to parent window
                {
                    TEvent closeEv;
                    closeEv.what = evCommand;
                    closeEv.message.command = cmClose;
                    putEvent(closeEv);
                }
                clearEvent(ev);
                return;

            case 'n':
            case 'N':
                next();
                clearEvent(ev);
                return;

            case kbUp:
                // Scroll up (back in history)
                if (scrollOffset_ < (int)lines_.size() - 1) {
                    ++scrollOffset_;
                    drawView();
                }
                clearEvent(ev);
                return;

            case kbDown:
                // Scroll down (towards live)
                if (scrollOffset_ > 0) {
                    --scrollOffset_;
                    drawView();
                }
                clearEvent(ev);
                return;

            case kbHome:
                // Jump to top of buffer
                scrollOffset_ = (int)lines_.size() - 1;
                drawView();
                clearEvent(ev);
                return;

            case kbEnd:
                // Snap to live (bottom)
                scrollOffset_ = 0;
                drawView();
                clearEvent(ev);
                return;
        }
    }
}

void TBackroomsTvView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
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
    TView::changeBounds(bounds);
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
        auto *view = new TBackroomsTvView(c);
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

// Custom command IDs for dialog buttons
static const ushort cmBktvAdd     = 900;
static const ushort cmBktvRemove  = 901;
static const ushort cmBktvRandom  = 902;
static const ushort cmBktvPlay    = 903;

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

class TBackroomsTvDialog : public TDialog {
public:
    TInputLine      *themeInput;
    TInputLine      *turnsInput;
    TRadioButtons   *modelRadio;
    TListBox        *availList;
    TListBox        *selectedList;
    TScrollBar      *availSB;
    TScrollBar      *selectedSB;

    std::vector<std::string> availPrimers;
    std::vector<std::string> selectedPrimers;

    TBackroomsTvDialog(const TRect &bounds, const std::vector<std::string> &primers)
        : TDialog(bounds, "Backrooms TV")
        , TWindowInit(&TBackroomsTvDialog::initFrame)
        , availPrimers(primers)
    {
        const int W = bounds.b.x - bounds.a.x;

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

        // Primer lists
        const int listTop = 10;
        const int listH = 10;
        const int listMid = W / 2;

        insert(new TLabel(TRect(3, listTop - 1, listMid - 2, listTop), "A~v~ailable", nullptr));
        availSB = new TScrollBar(TRect(listMid - 3, listTop, listMid - 2, listTop + listH));
        insert(availSB);
        availList = new TListBox(TRect(3, listTop, listMid - 3, listTop + listH), 1, availSB);
        insert(availList);

        insert(new TLabel(TRect(listMid + 1, listTop - 1, W - 3, listTop), "~S~elected", nullptr));
        selectedSB = new TScrollBar(TRect(W - 4, listTop, W - 3, listTop + listH));
        insert(selectedSB);
        selectedList = new TListBox(TRect(listMid + 1, listTop, W - 4, listTop + listH), 1, selectedSB);
        insert(selectedList);

        // Buttons between lists
        int btnY = listTop + listH + 1;
        insert(new TButton(TRect(3,           btnY, 14,          btnY + 2), "~A~dd →",   cmBktvAdd,    bfNormal));
        insert(new TButton(TRect(15,          btnY, 28,          btnY + 2), "← ~R~emove",cmBktvRemove, bfNormal));
        insert(new TButton(TRect(29,          btnY, 44,          btnY + 2), "Ran~d~om 3", cmBktvRandom, bfNormal));

        // Play / Cancel
        int playY = btnY + 3;
        insert(new TButton(TRect(W/2 - 14, playY, W/2 - 2, playY + 2), " \x10 ~P~lay", cmBktvPlay, bfDefault));
        insert(new TButton(TRect(W/2 + 2,  playY, W/2 + 14, playY + 2), "Cancel",       cmCancel,   bfNormal));

        // Set defaults
        char defaultTheme[] = "liminal spaces";
        themeInput->setData(defaultTheme);
        char defaultTurns[] = "3";
        turnsInput->setData(defaultTurns);
        modelRadio->press(1); // Sonnet

        rebuildLists();
    }

    void rebuildLists() {
        availList->newList(makeStringCol(availPrimers));
        selectedList->newList(makeStringCol(selectedPrimers));
    }

    void addSelected() {
        int idx = availList->focused;
        if (idx < 0 || idx >= (int)availPrimers.size()) return;
        std::string name = availPrimers[idx];
        // Don't add duplicates
        for (auto &s : selectedPrimers)
            if (s == name) return;
        selectedPrimers.push_back(name);
        rebuildLists();
    }

    void removeSelected() {
        int idx = selectedList->focused;
        if (idx < 0 || idx >= (int)selectedPrimers.size()) return;
        selectedPrimers.erase(selectedPrimers.begin() + idx);
        rebuildLists();
    }

    void randomThree() {
        selectedPrimers.clear();
        if (availPrimers.size() <= 3) {
            selectedPrimers = availPrimers;
        } else {
            // Fisher-Yates partial shuffle for 3 picks
            std::vector<int> indices(availPrimers.size());
            for (int i = 0; i < (int)indices.size(); ++i) indices[i] = i;
            for (int i = 0; i < 3; ++i) {
                int j = i + (std::rand() % (indices.size() - i));
                std::swap(indices[i], indices[j]);
                selectedPrimers.push_back(availPrimers[indices[i]]);
            }
        }
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
                case cmBktvRandom:
                    randomThree();
                    clearEvent(event);
                    break;
                case cmBktvPlay:
                    endModal(cmBktvPlay);
                    clearEvent(event);
                    break;
            }
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

    int dlgW = 60;
    int dlgH = 28;
    TRect r(0, 0, dlgW, dlgH);
    r.move((TProgram::deskTop->size.x - dlgW) / 2,
           (TProgram::deskTop->size.y - dlgH) / 2);

    auto *dlg = new TBackroomsTvDialog(r, primers);
    ushort result = TProgram::deskTop->execView(dlg);

    if (result == cmBktvPlay) {
        outChannel = dlg->getChannel();
        TObject::destroy(dlg);
        return true;
    }

    TObject::destroy(dlg);
    return false;
}
