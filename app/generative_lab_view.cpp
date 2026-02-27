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
#include <dirent.h>
#include <algorithm>
#include <set>

#define Uses_TDialog
#define Uses_TButton
#define Uses_TStaticText
#define Uses_TLabel
#define Uses_TListBox
#define Uses_TStringList
#define Uses_TCollection
#define Uses_TStringCollection
#define Uses_TListViewer
#define Uses_TInputLine
#define Uses_TCheckBoxes
#define Uses_TSItem
#define Uses_TRadioButtons
#include <tvision/tv.h>

// Primer directory finder (defined in wwdos_app.cpp)
extern std::string findPrimerDir();

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
                              const std::string& snapshotPath,
                              const std::vector<GenStamp>& stamps,
                              bool canvasMode) {
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

    // Add stamp args
    for (const auto& st : stamps) {
        if (!st.path.empty()) {
            cmd += " --stamp \"" + st.path + ":"
                + std::to_string(st.x) + ":" + std::to_string(st.y) + ":"
                + (st.locked ? "locked" : "seeded") + "\"";
        }
    }

    if (canvasMode)
        cmd += " --canvas";

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

    bridge_.start(contentW, contentH, seed_, presetName(), maxTicks_, snapPath,
                  stamps_, canvasMode_);
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

// ── Stamp picker dialog ──────────────────────────────────

static const ushort cmStampAdd    = 1100;
static const ushort cmStampRemove = 1101;
static const ushort cmStampGo     = 1102;
static const ushort cmStampRnd3   = 1103;
static const ushort cmStampClear  = 1104;
static const ushort cmStampFocus  = 1105;

// Scan primer dirs, return (stem, full-path) pairs, sorted, deduped
static void scanGenPrimers(std::vector<std::string>& names,
                           std::vector<std::string>& fullPaths) {
    names.clear();
    fullPaths.clear();
    std::set<std::string> seen;

    auto scanDir = [&](const std::string& dir) {
        DIR* d = opendir(dir.c_str());
        if (!d) return;
        struct dirent* entry;
        while ((entry = readdir(d)) != nullptr) {
            std::string fname(entry->d_name);
            if (fname.size() > 4 && fname.substr(fname.size() - 4) == ".txt") {
                std::string stem = fname.substr(0, fname.size() - 4);
                if (seen.insert(stem).second) {
                    names.push_back(stem);
                    fullPaths.push_back(dir + "/" + fname);
                }
            }
        }
        closedir(d);
    };

    scanDir("modules-private/wibwob-primers/primers");
    scanDir("modules/example-primers/primers");
    std::string pd = findPrimerDir();
    if (!pd.empty()) scanDir(pd);

    // Sort both arrays together
    std::vector<size_t> idx(names.size());
    for (size_t i = 0; i < idx.size(); ++i) idx[i] = i;
    std::sort(idx.begin(), idx.end(), [&](size_t a, size_t b) {
        return names[a] < names[b];
    });
    std::vector<std::string> sn, sp;
    for (auto i : idx) { sn.push_back(names[i]); sp.push_back(fullPaths[i]); }
    names = sn;
    fullPaths = sp;
}

static TStringCollection* makeStrCol(const std::vector<std::string>& items) {
    auto* col = new TStringCollection(std::max((int)items.size(), 1), 10);
    for (auto& s : items)
        col->insert(newStr(s.c_str()));
    return col;
}

// Read primer file, skip # comment lines, return dimensions
static void primerDimensions(const std::string& path, int& outW, int& outH) {
    outW = 0; outH = 0;
    FILE* f = fopen(path.c_str(), "r");
    if (!f) return;
    char line[1024];
    while (fgets(line, sizeof(line), f)) {
        const char* p = line;
        while (*p == ' ' || *p == '\t') ++p;
        if (*p == '#') continue;
        int len = (int)strlen(line);
        if (len > 0 && line[len-1] == '\n') len--;
        if (len > outW) outW = len;
        outH++;
    }
    fclose(f);
}

// Preview: TScroller that displays primer file content (skipping # lines)
class TStampPreview : public TScroller {
public:
    TStampPreview(const TRect& bounds, TScrollBar* vsb)
        : TScroller(bounds, nullptr, vsb) {
        growMode = gfGrowHiX | gfGrowHiY;
    }

    void loadFile(const std::string& path) {
        lines_.clear();
        FILE* f = fopen(path.c_str(), "r");
        if (!f) return;
        char buf[1024];
        while (fgets(buf, sizeof(buf), f)) {
            const char* p = buf;
            while (*p == ' ' || *p == '\t') ++p;
            if (*p == '#') continue;
            int len = (int)strlen(buf);
            if (len > 0 && buf[len-1] == '\n') buf[len-1] = '\0';
            lines_.push_back(buf);
        }
        fclose(f);
        setLimit(0, std::max(0, (int)lines_.size() - size.y));
        scrollTo(0, 0);
        drawView();
    }

    void clear() { lines_.clear(); drawView(); }

    virtual void draw() override {
        TDrawBuffer b;
        static const TColorAttr kPrev =
            TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xFF, 0xFF, 0xFF));
        for (int row = 0; row < size.y; ++row) {
            b.moveChar(0, ' ', kPrev, size.x);
            int idx = delta.y + row;
            if (idx >= 0 && idx < (int)lines_.size())
                b.moveStr(0, TStringView(lines_[idx]), kPrev);
            writeLine(0, row, size.x, 1, b);
        }
    }
private:
    std::vector<std::string> lines_;
};

// Listbox that broadcasts focus changes for live preview + mouse wheel scroll
class TStampListBox : public TListBox {
public:
    TStampListBox(const TRect& bounds, ushort cols, TScrollBar* sb)
        : TListBox(bounds, cols, sb) {
        eventMask |= evMouseWheel;
    }
    virtual void handleEvent(TEvent& ev) override {
        // Mouse wheel scroll
        if (ev.what == evMouseWheel) {
            int delta = (ev.mouse.wheel == mwUp) ? -3 : 3;
            focusItem(std::max(0, std::min((int)range - 1, focused + delta)));
            message(owner, evBroadcast, cmStampFocus, this);
            clearEvent(ev);
            return;
        }
        // Enter key = add to selected
        if (ev.what == evKeyDown && ev.keyDown.keyCode == kbEnter) {
            message(owner, evCommand, cmStampAdd, this);
            clearEvent(ev);
            return;
        }
        // Double-click = add to selected
        if (ev.what == evMouseDown && (ev.mouse.eventFlags & meDoubleClick)) {
            TListBox::handleEvent(ev);  // let it focus the clicked item
            message(owner, evCommand, cmStampAdd, this);
            clearEvent(ev);
            return;
        }
        int prev = focused;
        TListBox::handleEvent(ev);
        if (focused != prev)
            message(owner, evBroadcast, cmStampFocus, this);
    }
};

class TStampDialog : public TDialog {
public:
    // Force gray dialog palette for dark/neutral look
    virtual TPalette& getPalette() const override {
        static TPalette pal(cpGrayDialog, sizeof(cpGrayDialog) - 1);
        return pal;
    }

    TStampListBox*   availList;
    TListBox*        selectedList;
    TStampPreview*   preview;
    TScrollBar*      availSB;
    TScrollBar*      selectedSB;
    TScrollBar*      previewSB;
    TRadioButtons*   modeRadio;
    TRadioButtons*   posRadio;
    TInputLine*      xInput;
    TInputLine*      yInput;

    std::vector<std::string> availNames;
    std::vector<std::string> availPaths;
    std::vector<std::string> selNames;
    std::vector<std::string> selPaths;

    TStampDialog(const TRect& bounds,
                 const std::vector<std::string>& names,
                 const std::vector<std::string>& paths)
        : TDialog(bounds, "Stamp Primers")
        , TWindowInit(&TStampDialog::initFrame)
        , availNames(names)
        , availPaths(paths)
    {
        const int W = bounds.b.x - bounds.a.x;
        const int H = bounds.b.y - bounds.a.y;

        // 3-column layout: Available | Preview | Selected
        const int listTop = 2;
        // Reserve: buttons(2) + gap(1) + position(3) + gap(1) + mode(1) + gap(1) + go(2) + pad(1) = 12
        const int listH   = std::max(6, H - 15);
        const int colW    = std::max(15, (W - 6) / 4);
        const int prevX1  = 3 + colW + 1;
        const int prevX2  = W - 3 - colW - 1;

        // Available (left)
        insert(new TLabel(TRect(3, listTop - 1, 3 + colW, listTop), "~A~vailable", nullptr));
        availSB = new TScrollBar(TRect(2 + colW, listTop, 3 + colW, listTop + listH));
        insert(availSB);
        availList = new TStampListBox(TRect(3, listTop, 2 + colW, listTop + listH), 1, availSB);
        insert(availList);

        // Preview (centre)
        insert(new TLabel(TRect(prevX1, listTop - 1, prevX2, listTop), "Preview", nullptr));
        previewSB = new TScrollBar(TRect(prevX2 - 1, listTop, prevX2, listTop + listH));
        insert(previewSB);
        preview = new TStampPreview(TRect(prevX1, listTop, prevX2 - 1, listTop + listH), previewSB);
        insert(preview);

        // Selected (right)
        insert(new TLabel(TRect(prevX2 + 1, listTop - 1, W - 3, listTop), "~S~elected", nullptr));
        selectedSB = new TScrollBar(TRect(W - 4, listTop, W - 3, listTop + listH));
        insert(selectedSB);
        selectedList = new TListBox(TRect(prevX2 + 1, listTop, W - 4, listTop + listH), 1, selectedSB);
        insert(selectedList);

        // Buttons below lists
        int btnY = listTop + listH + 1;
        insert(new TButton(TRect(3,  btnY, 14, btnY + 2), "~A~dd ->",    cmStampAdd,    bfNormal));
        insert(new TButton(TRect(15, btnY, 28, btnY + 2), "<- ~R~emove", cmStampRemove, bfNormal));
        insert(new TButton(TRect(29, btnY, 42, btnY + 2), "+~3~ random", cmStampRnd3,   bfNormal));
        insert(new TButton(TRect(43, btnY, 54, btnY + 2), "C~l~ear",     cmStampClear,  bfNormal));

        // Position + mode row
        int optY = btnY + 3;
        insert(new TLabel(TRect(3, optY, 12, optY + 1), "Position:", nullptr));
        posRadio = new TRadioButtons(TRect(12, optY, W - 14, optY + 3),
            new TSItem("~C~entre",
            new TSItem("Rando~m~",
            new TSItem("~T~op-left",
            new TSItem("Top-ri~g~ht",
            new TSItem("~B~ottom-right",
            new TSItem("Bottom-le~f~t",
            new TSItem("C~u~stom X,Y", nullptr))))))));
        ushort posVal = 0;
        posRadio->setData(&posVal);
        insert(posRadio);

        // Custom X,Y inputs (to the right of the radio)
        int xyX = W - 13;
        insert(new TLabel(TRect(xyX, optY, xyX + 2, optY + 1), "X:", nullptr));
        xInput = new TInputLine(TRect(xyX + 2, optY, xyX + 8, optY + 1), 6);
        char xd[] = "0";
        xInput->setData(xd);
        insert(xInput);
        insert(new TLabel(TRect(xyX, optY + 1, xyX + 2, optY + 2), "Y:", nullptr));
        yInput = new TInputLine(TRect(xyX + 2, optY + 1, xyX + 8, optY + 2), 6);
        char yd[] = "0";
        yInput->setData(yd);
        insert(yInput);

        // Mode row
        int optY2 = optY + 4;
        modeRadio = new TRadioButtons(TRect(3, optY2, W - 3, optY2 + 1),
            new TSItem("~L~ocked (immune to rules)",
            new TSItem("Se~e~ded (rules can modify)",
            new TSItem("Can~v~as (primer IS the grid — art evolves)", nullptr))));
        ushort modeVal = 0;
        modeRadio->setData(&modeVal);
        insert(modeRadio);

        // Stamp! / Cancel
        int goY = optY2 + 2;
        insert(new TButton(TRect(W/2 - 12, goY, W/2 - 2, goY + 2),
                           " Stamp! ", cmStampGo, bfDefault));
        insert(new TButton(TRect(W/2 + 2, goY, W/2 + 12, goY + 2),
                           "Cancel", cmCancel, bfNormal));

        rebuildLists();
        if (!availNames.empty()) updatePreview();
    }

    void updatePreview() {
        int idx = availList->focused;
        if (idx < 0 || idx >= (int)availPaths.size()) { preview->clear(); return; }
        preview->loadFile(availPaths[idx]);
    }

    void rebuildLists() {
        availList->newList(makeStrCol(availNames));
        // Selected list shows name + position mode
        ushort posMode = 0;
        posRadio->getData(&posMode);
        std::vector<std::string> selDisplay;
        for (auto& n : selNames) {
            selDisplay.push_back(n + " " + posModeName(posMode));
        }
        selectedList->newList(makeStrCol(selDisplay));
    }

    void addSelected() {
        int idx = availList->focused;
        if (idx < 0 || idx >= (int)availNames.size()) return;
        selNames.push_back(availNames[idx]);
        selPaths.push_back(availPaths[idx]);
        rebuildLists();
    }

    void removeSelected() {
        int idx = selectedList->focused;
        if (idx < 0 || idx >= (int)selNames.size()) return;
        selNames.erase(selNames.begin() + idx);
        selPaths.erase(selPaths.begin() + idx);
        rebuildLists();
    }

    void randomAdd(int n) {
        int pool = (int)availNames.size();
        if (pool == 0) return;
        for (int i = 0; i < n; ++i) {
            int r = std::rand() % pool;
            selNames.push_back(availNames[r]);
            selPaths.push_back(availPaths[r]);
        }
        rebuildLists();
    }

    void clearSelected() {
        selNames.clear();
        selPaths.clear();
        rebuildLists();
    }

    virtual void handleEvent(TEvent& ev) override {
        TDialog::handleEvent(ev);
        if (ev.what == evCommand) {
            switch (ev.message.command) {
                case cmStampAdd:    addSelected();    clearEvent(ev); break;
                case cmStampRemove: removeSelected(); clearEvent(ev); break;
                case cmStampRnd3:   randomAdd(3);     clearEvent(ev); break;
                case cmStampClear:  clearSelected();  clearEvent(ev); break;
                case cmStampGo:
                    // Auto-add focused available item if selected list is empty
                    if (selPaths.empty() && !availPaths.empty()) {
                        int idx = availList->focused;
                        if (idx >= 0 && idx < (int)availNames.size()) {
                            selNames.push_back(availNames[idx]);
                            selPaths.push_back(availPaths[idx]);
                        }
                    }
                    if (!selPaths.empty()) {
                        endModal(cmStampGo);
                    } else {
                        // Nothing selected — flash or beep
                    }
                    clearEvent(ev);
                    break;
            }
        }
        if (ev.what == evBroadcast &&
            ev.message.command == cmStampFocus &&
            ev.message.infoPtr == availList) {
            updatePreview();
            clearEvent(ev);
        }
    }

    // Position mode names for display in selected list
    static const char* posModeName(ushort mode) {
        switch (mode) {
            case 0: return "@C";   // centre
            case 1: return "@?";   // random
            case 2: return "@TL";  // top-left
            case 3: return "@TR";  // top-right
            case 4: return "@BR";  // bottom-right
            case 5: return "@BL";  // bottom-left
            case 6: return "@XY";  // custom
        }
        return "@C";
    }

    bool isCanvasMode() const {
        ushort lockMode = 0;
        modeRadio->getData(&lockMode);
        return lockMode == 2;
    }

    std::vector<GenStamp> getStamps(int canvasW, int canvasH) const {
        std::vector<GenStamp> stamps;
        ushort posMode = 0;
        posRadio->getData(&posMode);
        ushort lockMode = 0;
        modeRadio->getData(&lockMode);
        bool locked = (lockMode == 0);
        // Canvas mode: force seeded (not locked), ignore position
        if (lockMode == 2) locked = false;

        char xbuf[8] = {}, ybuf[8] = {};
        xInput->getData(xbuf);
        yInput->getData(ybuf);
        int customX = std::atoi(xbuf);
        int customY = std::atoi(ybuf);

        for (size_t i = 0; i < selPaths.size(); ++i) {
            GenStamp st;
            st.path = selPaths[i];
            st.locked = locked;

            int pw = 0, ph = 0;
            primerDimensions(st.path, pw, ph);

            switch (posMode) {
                case 0: // Centre
                    st.x = std::max(0, (canvasW - pw) / 2);
                    st.y = std::max(0, (canvasH - ph) / 2);
                    break;
                case 1: // Random
                    st.x = std::rand() % std::max(1, canvasW - pw);
                    st.y = std::rand() % std::max(1, canvasH - ph);
                    break;
                case 2: // Top-left
                    st.x = 0;
                    st.y = 0;
                    break;
                case 3: // Top-right
                    st.x = std::max(0, canvasW - pw);
                    st.y = 0;
                    break;
                case 4: // Bottom-right
                    st.x = std::max(0, canvasW - pw);
                    st.y = std::max(0, canvasH - ph);
                    break;
                case 5: // Bottom-left
                    st.x = 0;
                    st.y = std::max(0, canvasH - ph);
                    break;
                case 6: // Custom
                    st.x = customX;
                    st.y = customY;
                    break;
            }

            stamps.push_back(st);
        }
        return stamps;
    }
};

void TGenerativeLabView::openStampPicker() {
    std::vector<std::string> names, paths;
    scanGenPrimers(names, paths);

    if (names.empty()) {
        flashMsg_ = "No primer files found";
        flashTime_ = time(nullptr);
        drawView();
        return;
    }

    // Dialog at 90% of view size
    int dlgW = std::max(70, size.x * 9 / 10);
    int dlgH = std::max(28, size.y * 9 / 10);
    TRect dr(0, 0, dlgW, dlgH);
    dr.move((size.x - dlgW) / 2, (size.y - dlgH) / 2);

    auto* dlg = new TStampDialog(dr, names, paths);
    dlg->selectNext(False);

    ushort result = owner->execView(dlg);
    if (result == cmStampGo) {
        // Compute canvas size for positioning
        int canvasW = size.x - 2;
        int canvasH = size.y - 3;
        // Binary substrate uses half-size grid
        int gw = canvasW / 2;
        int gh = canvasH / 2;

        bool isCanvas = dlg->isCanvasMode();
        auto newStamps = dlg->getStamps(isCanvas ? canvasW : gw,
                                         isCanvas ? canvasH : gh);
        if (!newStamps.empty()) {
            if (isCanvas) {
                // Canvas mode: replace all stamps with just the first
                stamps_.clear();
                stamps_.push_back(newStamps[0]);
                canvasMode_ = true;
                flashMsg_ = "Canvas: " + dlg->selNames[0] + " (art evolves)";
            } else {
                canvasMode_ = false;
                for (auto& s : newStamps)
                    stamps_.push_back(s);
                flashMsg_ = "Stamped " + std::to_string(newStamps.size())
                    + " primer" + (newStamps.size() > 1 ? "s" : "");
            }
            flashTime_ = time(nullptr);
            relaunch();
        }
    }

    TObject::destroy(dlg);
}

void TGenerativeLabView::clearStamps() {
    stamps_.clear();
    canvasMode_ = false;
    flashMsg_ = "Stamps cleared";
    flashTime_ = time(nullptr);
    relaunch();
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

        // Stamp button
        int stampStart = (int)bar.size();
        std::string stampLabel = stamps_.empty()
            ? "[P:Stamp]"
            : "[P:Stamp(" + std::to_string(stamps_.size()) + ")]";
        bar += stampLabel;
        int stampEnd = (int)bar.size();
        bar += " ";

        if (!stamps_.empty()) {
            bar += "[X:Clear] ";
        }

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

        // Highlight stamp if stamps active
        if (!stamps_.empty() && stampStart < W) {
            int end = std::min(stampEnd, W);
            std::string seg = bar.substr(stampStart, end - stampStart);
            buf.moveStr(stampStart, TStringView(seg), kBtnActive);
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

        // p — stamp primer picker
        if (ch == 'p' || ch == 'P') {
            openStampPicker();
            clearEvent(ev); return;
        }

        // x — clear all stamps
        if (ch == 'x' || ch == 'X') {
            clearStamps();
            clearEvent(ev); return;
        }

        // i — info flash
        if (ch == 'i' || ch == 'I') {
            flashMsg_ = "1-9=preset 0=random r=new m=mutate p=stamp x=clear s=save";
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

// ── API / IPC action handler ─────────────────────────────

std::string TGenerativeLabView::handleApiAction(
    const std::string& action,
    const std::map<std::string, std::string>& params) {

    auto getStr = [&](const char* key, const std::string& def = "") -> std::string {
        auto it = params.find(key);
        return (it != params.end()) ? it->second : def;
    };
    auto getInt = [&](const char* key, int def = 0) -> int {
        auto it = params.find(key);
        return (it != params.end()) ? std::atoi(it->second.c_str()) : def;
    };

    // ── get_info: return current state as JSON ──
    if (action == "get_info") {
        std::string json = "{";
        json += "\"preset\":\"" + presetName() + "\"";
        json += ",\"preset_index\":" + std::to_string(presetIdx_);
        json += ",\"seed\":" + std::to_string(seed_);
        json += ",\"speed_ms\":" + std::to_string(periodMs_);
        json += ",\"running\":" + std::string(bridge_.isRunning() ? "true" : "false");
        json += ",\"paused\":" + std::string(bridge_.isPaused() ? "true" : "false");
        json += ",\"canvas_mode\":" + std::string(canvasMode_ ? "true" : "false");
        json += ",\"stamp_count\":" + std::to_string(stamps_.size());
        json += ",\"max_ticks\":" + std::to_string(maxTicks_);
        json += ",\"line_count\":" + std::to_string(lines_.size());
        json += ",\"status\":\"" + statusLine_ + "\"";

        // List stamps
        json += ",\"stamps\":[";
        for (size_t i = 0; i < stamps_.size(); ++i) {
            if (i > 0) json += ",";
            json += "{\"path\":\"" + stamps_[i].path + "\"";
            json += ",\"x\":" + std::to_string(stamps_[i].x);
            json += ",\"y\":" + std::to_string(stamps_[i].y);
            json += ",\"locked\":" + std::string(stamps_[i].locked ? "true" : "false");
            json += "}";
        }
        json += "]";

        // List available presets
        json += ",\"presets\":[";
        for (int i = 0; i < kGenPresetCount; ++i) {
            if (i > 0) json += ",";
            json += "\"";
            json += kGenPresetNames[i];
            json += "\"";
        }
        json += ",\"random\"]";

        json += "}";
        return json;
    }

    // ── set_preset: by name or index ──
    if (action == "set_preset") {
        std::string name = getStr("name");
        int idx = getInt("index", -1);
        if (!name.empty()) {
            if (name == "random") {
                presetIdx_ = kGenPresetCount;
            } else {
                for (int i = 0; i < kGenPresetCount; ++i) {
                    if (name == kGenPresetNames[i]) {
                        presetIdx_ = i;
                        break;
                    }
                }
            }
        } else if (idx >= 0 && idx <= kGenPresetCount) {
            presetIdx_ = idx;
        } else {
            return "{\"ok\":false,\"error\":\"need name or index\"}";
        }
        seed_ = rand() % 100000;
        relaunch();
        return "{\"ok\":true,\"preset\":\"" + presetName() + "\",\"seed\":" + std::to_string(seed_) + "}";
    }

    // ── set_seed ──
    if (action == "set_seed") {
        seed_ = getInt("seed", rand() % 100000);
        relaunch();
        return "{\"ok\":true,\"seed\":" + std::to_string(seed_) + "}";
    }

    // ── new_seed (R key equivalent) ──
    if (action == "new_seed") {
        seed_ = rand() % 100000;
        relaunch();
        return "{\"ok\":true,\"seed\":" + std::to_string(seed_) + "}";
    }

    // ── mutate (M key equivalent) ──
    if (action == "mutate") {
        seed_ = rand() % 100000;
        flashMsg_ = "MUTATED seed:" + std::to_string(seed_);
        flashTime_ = time(nullptr);
        relaunch();
        return "{\"ok\":true,\"seed\":" + std::to_string(seed_) + "}";
    }

    // ── pause ──
    if (action == "pause") {
        if (bridge_.isRunning() && !bridge_.isPaused()) {
            bridge_.pause();
            flashMsg_ = "PAUSED"; flashTime_ = time(nullptr);
            drawView();
        }
        return "{\"ok\":true,\"paused\":true}";
    }

    // ── resume ──
    if (action == "resume") {
        if (bridge_.isRunning() && bridge_.isPaused()) {
            bridge_.resume();
            flashMsg_ = "RESUMED"; flashTime_ = time(nullptr);
            drawView();
        }
        return "{\"ok\":true,\"paused\":false}";
    }

    // ── toggle_pause (Space equivalent) ──
    if (action == "toggle_pause") {
        bool paused = false;
        if (bridge_.isRunning()) {
            if (bridge_.isPaused()) {
                bridge_.resume();
                flashMsg_ = "RESUMED"; flashTime_ = time(nullptr);
            } else {
                bridge_.pause();
                flashMsg_ = "PAUSED"; flashTime_ = time(nullptr);
                paused = true;
            }
            drawView();
        }
        return "{\"ok\":true,\"paused\":" + std::string(paused ? "true" : "false") + "}";
    }

    // ── step (. key equivalent — single tick when paused) ──
    if (action == "step") {
        if (bridge_.isRunning() && bridge_.isPaused()) {
            bridge_.resume();
            usleep(50000);
            bridge_.pause();
            pollPipe();
            drawView();
        }
        return "{\"ok\":true}";
    }

    // ── save (S key equivalent) ──
    if (action == "save") {
        saveToFile();
        return "{\"ok\":true}";
    }

    // ── set_speed ──
    if (action == "set_speed") {
        int ms = getInt("ms", (int)periodMs_);
        periodMs_ = std::max(10, std::min(500, ms));
        stopTimer(); startTimer();
        return "{\"ok\":true,\"speed_ms\":" + std::to_string(periodMs_) + "}";
    }

    // ── set_max_ticks ──
    if (action == "set_max_ticks") {
        maxTicks_ = getInt("ticks", maxTicks_);
        return "{\"ok\":true,\"max_ticks\":" + std::to_string(maxTicks_) + "}";
    }

    // ── stamp: add a primer stamp ──
    if (action == "stamp") {
        std::string path = getStr("path");
        if (path.empty())
            return "{\"ok\":false,\"error\":\"need path\"}";
        std::string mode = getStr("mode", "locked");  // locked|seeded|canvas

        GenStamp st;
        st.path = path;
        st.locked = (mode != "seeded" && mode != "canvas");
        st.x = getInt("x", 0);
        st.y = getInt("y", 0);

        // Position shortcuts
        std::string pos = getStr("position", "custom");
        if (pos == "centre" || pos == "center") {
            int contentW = size.x - 2;
            int contentH = size.y - 3;
            int gw = contentW / 2;
            int gh = contentH / 2;
            int pw = 0, ph = 0;
            primerDimensions(path, pw, ph);
            st.x = std::max(0, (gw - pw) / 2);
            st.y = std::max(0, (gh - ph) / 2);
        } else if (pos == "random") {
            int gw = (size.x - 2) / 2;
            int gh = (size.y - 3) / 2;
            int pw = 0, ph = 0;
            primerDimensions(path, pw, ph);
            st.x = rand() % std::max(1, gw - pw);
            st.y = rand() % std::max(1, gh - ph);
        }

        if (mode == "canvas") {
            stamps_.clear();
            stamps_.push_back(st);
            canvasMode_ = true;
        } else {
            canvasMode_ = false;
            stamps_.push_back(st);
        }

        flashMsg_ = "Stamped: " + path;
        flashTime_ = time(nullptr);
        relaunch();
        return "{\"ok\":true,\"stamp_count\":" + std::to_string(stamps_.size())
            + ",\"canvas_mode\":" + std::string(canvasMode_ ? "true" : "false") + "}";
    }

    // ── clear_stamps (X key equivalent) ──
    if (action == "clear_stamps") {
        clearStamps();
        return "{\"ok\":true,\"stamp_count\":0}";
    }

    // ── cycle_preset (TAB equivalent) ──
    if (action == "cycle_preset") {
        presetIdx_ = (presetIdx_ + 1) % (kGenPresetCount + 1);
        seed_ = rand() % 100000;
        relaunch();
        return "{\"ok\":true,\"preset\":\"" + presetName() + "\",\"seed\":" + std::to_string(seed_) + "}";
    }

    // ── list_primers: return available primer files ──
    if (action == "list_primers") {
        std::vector<std::string> names, paths;
        scanGenPrimers(names, paths);
        std::string json = "{\"ok\":true,\"primers\":[";
        for (size_t i = 0; i < names.size(); ++i) {
            if (i > 0) json += ",";
            json += "{\"name\":\"" + names[i] + "\",\"path\":\"" + paths[i] + "\"}";
        }
        json += "]}";
        return json;
    }

    return "{\"ok\":false,\"error\":\"unknown action: " + action + "\"}";
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
