/*---------------------------------------------------------*/
/*                                                         */
/*   token_tracker_view.cpp - Token Fast-Tracker View     */
/*                                                         */
/*   Visual style: columns, row numbers, moving playhead.  */
/*   Data: cycles through a seed token sequence; predicts  */
/*   next tokens via tiny heuristic mapping; kaomoji show  */
/*   the token “mood/umwelt”.                              */
/*                                                         */
/*---------------------------------------------------------*/

#include "token_tracker_view.h"

#define Uses_TWindow
#define Uses_TFrame
#include <tvision/tv.h>

#include <algorithm>
#include <cstring>

namespace {
static TColorAttr colNormal(0x07);
static TColorAttr colAltRow(0x08);
static TColorAttr colBeat(0x0F);
static TColorAttr colPlayhead(0x70); // inverted
// Monochrome control theme
static TColorAttr colCtrlBg(0x07);
static TColorAttr colCtrlFrame(0x07);
static TColorAttr colBtn(0x07);
static TColorAttr colBtnHot(0x07);
static TColorAttr colBtnWarn(0x07);
static TColorAttr colBtnMute(0x07);
static TColorAttr colBtnOff(0x08); // dimmer

static std::vector<std::string> defaultSeq() {
    // Base chant; repeated to fill pattern length
    return {
        "humans","just","predict","the","next","token",
        "humans","just","predict","the","next","token"
    };
}

static bool ieq(const std::string &a, const std::string &b) {
    if (a.size() != b.size()) return false;
    for (size_t i = 0; i < a.size(); ++i) {
        char ca = (char)std::tolower((unsigned char)a[i]);
        char cb = (char)std::tolower((unsigned char)b[i]);
        if (ca != cb) return false;
    }
    return true;
}
}

TTokenTrackerView::TTokenTrackerView(const TRect &bounds)
    : TView(bounds), cfg(Config()), periodMs(cfg.periodMs()), seq(defaultSeq())
{
    options |= ofSelectable;
    growMode = gfGrowAll;
    eventMask |= evBroadcast;
    eventMask |= evKeyboard;

    // Normalize loop length to multiple of sequence size.
    if (totalSteps < (int)seq.size()) totalSteps = (int)seq.size();
    int mul = (totalSteps + (int)seq.size() - 1) / (int)seq.size();
    totalSteps = std::max(16, (int)seq.size() * mul);
}

TTokenTrackerView::TTokenTrackerView(const TRect &bounds, const Config &cfg)
    : TView(bounds), cfg(cfg), periodMs(cfg.periodMs()), seq(defaultSeq())
{
    options |= ofSelectable;
    growMode = gfGrowAll;
    eventMask |= evBroadcast;
    eventMask |= evKeyboard;

    // Normalize loop length to multiple of sequence size.
    if (totalSteps < (int)seq.size()) totalSteps = (int)seq.size();
    int mul = (totalSteps + (int)seq.size() - 1) / (int)seq.size();
    totalSteps = std::max(16, (int)seq.size() * mul);
}

TTokenTrackerView::~TTokenTrackerView() {
    stopTimer();
}

void TTokenTrackerView::setConfig(const Config &c) {
    cfg = c;
    unsigned p = cfg.periodMs();
    periodMs = p ? p : 1;
    if (timerId) {
        stopTimer();
        startTimer();
    }
}

void TTokenTrackerView::startTimer() {
    if (!timerId)
        timerId = setTimer(periodMs, (int)periodMs);
}

void TTokenTrackerView::stopTimer() {
    if (timerId) {
        killTimer(timerId);
        timerId = 0;
    }
}

void TTokenTrackerView::advance() {
    if (!paused) {
        step = (step + 1) % totalSteps;
        ++spinner;
    }
}

void TTokenTrackerView::rebuildLayout() {
    // Currently static; placeholder for dynamic column resize if wanted.
}

std::string TTokenTrackerView::currentToken(int idx) const {
    int n = (int)seq.size();
    if (n == 0) return std::string();
    int i = idx % n; if (i < 0) i += n;
    return seq[(size_t)i];
}

std::vector<std::string> TTokenTrackerView::predictNext(const std::string &t1, const std::string &t2) const {
    // Minimal heuristics: a few hand-coded transitions + fallbacks.
    // Returns up to 2 suggestions [top1, top2].
    auto nxt = [&](const std::string &a, const std::string &b) -> std::vector<std::string> {
        if (ieq(a,"humans") && ieq(b,"just")) return {"predict","think"};
        if (ieq(a,"just") && ieq(b,"predict")) return {"the","next"};
        if (ieq(a,"predict") && ieq(b,"the")) return {"next","future"};
        if (ieq(a,"the") && ieq(b,"next")) return {"token","word"};
        if (ieq(a,"next") && ieq(b,"token")) return {"humans","again"};
        // default: cycle through seq
        return {b, a};
    };
    auto v = nxt(t1, t2);
    if (v.size() < 2) v.push_back("...");
    return v;
}

std::string TTokenTrackerView::umweltFace(const std::string &tok, int ph) const {
    // Simple affect mapping
    if (tok.find("human") != std::string::npos) return (ph%2)?"(◕‿◕)":"(づ｡◕‿‿◕｡)づ";
    if (ieq(tok,"predict")) return (ph%3)?"(◔_◔)":"(⊙_⊙)";
    if (ieq(tok,"next") || ieq(tok,"token")) return (ph%2)?"(◉_◉)":"(●_●)";
    if (ieq(tok,"the")) return (ph%2)?"(¬_¬)":"(•_•)";
    if (ieq(tok,"just")) return (ph%2)?"(＾_＾)":"(￣‿￣)";
    return (ph%2)?"(ಠ_ಠ)":"(ಥ_ಥ)";
}

std::string TTokenTrackerView::wave(int ph) const {
    const char* g = (ph%2)==0 ? u8"≈" : u8"∿";
    std::string s; for (int i=0;i<3;++i) s+=g; return s;
}

std::string TTokenTrackerView::meter(int ph) const {
    switch ((ph/2)%3) { case 0: return u8"░░"; case 1: return u8"▒▒"; default: return u8"▓▓"; }
}

void TTokenTrackerView::applySpeedFromCfg() {
    unsigned p = cfg.periodMs();
    periodMs = p ? p : 1;
    if (timerId) {
        stopTimer();
        startTimer();
    }
}

std::string TTokenTrackerView::rowEmoji(bool kck, bool snr, bool hat, const std::string &tok, const std::vector<std::string>& preds, int phase) const {
    int score = 0;
    if (kck) score += 3;
    if (snr) score += 2;
    if (hat) score += 1;
    auto addTok = [&](const std::string &t){
        if (t.find("human") != std::string::npos) score += 2;
        else if (ieq(t, "predict")) score += 1;
        else if (ieq(t, "next") || ieq(t, "token")) score += 1;
        else if (ieq(t, "just")) score += 1;
        else score += 0;
    };
    addTok(tok);
    if (!preds.empty()) addTok(preds[0]);
    if (preds.size()>1) addTok(preds[1]);
    // Map score to emoji set and animate eyes by phase
    static const char* facesA[] = {u8"(・_・)", u8"(•‿•)", u8"(◕‿◕)", u8"(ᵔ‿ᵔ)", u8"(✧‿✧)", u8"(⚆_⚆)", u8"(ಥ_ಥ)"};
    static const char* facesB[] = {u8"(._.)", u8"(＾_＾)", u8"(◉‿◉)", u8"(≧‿≦)", u8"(☆‿☆)", u8"(⊙_⊙)", u8"(T_T)"};
    int idx;
    if (score <= 1) idx = 0; else if (score <= 3) idx = 1; else if (score <= 5) idx = 2;
    else if (score <= 7) idx = 3; else if (score <= 9) idx = 4; else if (score <= 11) idx = 5; else idx = 6;
    return (phase%2==0) ? facesA[idx] : facesB[idx];
}

static std::string sliderBar(const char* label, int value, int minV, int maxV, int width)
{
    width = std::max(4, width);
    if (maxV <= minV) maxV = minV + 1;
    double t = double(value - minV) / double(maxV - minV);
    if (t < 0) t = 0; if (t > 1) t = 1;
    int fill = (int)std::round(t * width);
    if (fill > width) fill = width; if (fill < 0) fill = 0;
    std::string s;
    s += label; s += "[";
    for (int i=0;i<fill;++i) s += '#';
    for (int i=fill;i<width;++i) s += ' ';
    s += "] ";
    return s;
}

// Small helpers for tracker look
static const char* noteNames[12] = {"C-","C#","D-","D#","E-","F-","F#","G-","G#","A-","A#","B-"};
static std::string noteCell(int n) {
    if (n < 0) return "---"; n %= 96; if (n<0) n+=96; int oct = n/12; int nn = n%12; char buf[4];
    std::snprintf(buf, sizeof(buf), "%s", noteNames[nn]);
    std::string s(buf); s += char('0'+std::min(9, std::max(0, oct))); return s; // e.g. C-3
}

void TTokenTrackerView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 3) return;

    // Channel layout reminiscent of FastTracker
    struct Chan { const char* label; int w; };
    static const Chan chans[] = {
        {"KCK", 10}, {"SNR", 10}, {"HAT", 10}, {"BASS", 10}, {"LEAD", 10}, {"TOK", 12}, {"P1", 10}, {"P2", 10}, {"EMOJI", 10}
    };
    const int N = (int)(sizeof(chans)/sizeof(chans[0]));

    auto pad = [&](const std::string &s, int width) {
        std::string out = s;
        if ((int)out.size() < width) out.append((size_t)(width - (int)out.size()), ' ');
        else if ((int)out.size() > width) out.resize((size_t)width);
        return out;
    };

    auto hdrInfo = [&]() {
        char hdr[128];
        int row = step % 64;
        int pat = (step / 64) % 16;
        int pos = pat; // simple mapping
        std::snprintf(hdr, sizeof(hdr), "SPD %02d  BPM %03d  POS %02X  PAT %02X  ROW %02X   Token Tracker",
                      cfg.rowsPerBeat, cfg.bpm, pos, pat, row);
        return std::string(hdr);
    }();

    // Controls area (no extra border/title; window already provides frame)
    buildButtons(W);
    {
        // Top spacer (blank line for breathing room)
        TDrawBuffer bTop; bTop.moveChar(0, ' ', colCtrlBg, W);
        writeLine(0, 0, W, 1, bTop);

        // Button row A (no side borders)
        TDrawBuffer b; b.moveChar(0, ' ', colCtrlBg, W);
        int x = 0;
        auto putSeg = [&](const std::string &s, TColorAttr ca){
            if (x >= W) return;
            int avail = W - x;
            TAttrPair ap{ca, ca};
            b.moveCStr(x, s.c_str(), ap, avail);
            x += (int)std::min<int>((int)s.size(), avail);
        };
        // Render row A buttons with stateful color
        for (const auto &btn : buttons) if (btn.r.a.y == 1) {
            TColorAttr ca = colBtn;
            bool pressed = (pressedId == btn.id);
            switch (btn.id) {
                case 1: ca = paused ? colBtnHot : colBtnWarn; break; // play=green, pause=amber
                case 16: case 17: ca = colBtn; break;               // prev/next
                case 18: ca = loopFlag ? colBtnHot : colBtnOff; break; // loop
                case 19: ca = colBtn; break;                        // tap
                case 20: ca = colBtn; break;                        // random
                default: break;
            }
            if (pressed)
                ca = colPlayhead; // pressed feedback invert
            putSeg(btn.label, ca);
        }
        writeLine(0, 1, W, 1, b);

        // Button row B (no side borders)
        TDrawBuffer b2; b2.moveChar(0, ' ', colCtrlBg, W);
        x = 0;
        auto putSeg2 = [&](const std::string &s, TColorAttr ca){
            if (x >= W) return;
            int avail = W - x;
            TAttrPair ap{ca, ca};
            b2.moveCStr(x, s.c_str(), ap, avail);
            x += (int)std::min<int>((int)s.size(), avail);
        };
        // Insert sliders before rendering buttons: BPM and SPD
        std::string bpmSlider = sliderBar(" BPM ", cfg.bpm, 30, 300, 16);
        putSeg2(bpmSlider, colBtn);
        // Then render buttons row B
        for (const auto &btn : buttons) if (btn.r.a.y == 2) {
            TColorAttr ca = colBtn;
            bool pressed = (pressedId == btn.id);
            switch (btn.id) {
                case 2: case 3: case 4: case 5: ca = colBtnHot; break;
                case 6: ca = colBtn; break;
                case 7: ca = shadeRows ? colBtnHot : colBtnOff; break;
                case 21: ca = soloMode ? colBtnHot : colBtnOff; break;
                default:
                    if (btn.id >= 8 && btn.id <= 15)
                        ca = mutes[btn.id-8] ? colBtnMute : colBtn;
                    else ca = colBtn;
            }
            if (pressed) ca = colPlayhead;
            putSeg2(btn.label, ca);
        }
        // SPD slider at end
        std::string spdSlider = sliderBar(" SPD ", cfg.rowsPerBeat, 1, 16, 10);
        putSeg2(spdSlider, colBtn);
        writeLine(0, 2, W, 1, b2);

        // Bottom spacer (blank line)
        TDrawBuffer bBot; bBot.moveChar(0, ' ', colCtrlBg, W);
        writeLine(0, 3, W, 1, bBot);
    }

    // Header line 1
    {
        TDrawBuffer b; TAttrPair ap{colNormal, colNormal};
        b.moveCStr(0, hdrInfo.c_str(), ap, W);
        ushort len = (ushort)std::min<int>((int)hdrInfo.size(), W);
        if (len < W) b.moveChar(len, ' ', colNormal, W - len);
        writeLine(0, 4, W, 1, b);
    }

    // Header line 2: channel names
    {
        std::string ch; ch.reserve(W);
        ch += "ROW ";
        for (int i=0;i<N;++i) {
            std::string lab = chans[i].label;
            if (i < 8 && mutes[i]) lab += "*";
            ch += "|"; ch += pad(lab, chans[i].w);
        }
        TDrawBuffer b; TAttrPair ap{colNormal, colNormal};
        b.moveCStr(0, ch.c_str(), ap, W);
        ushort len = (ushort)std::min<int>((int)ch.size(), W);
        if (len < W) b.moveChar(len, ' ', colNormal, W - len);
        writeLine(0, 5, W, 1, b);
    }

    // Ruler row: minor/major beat guides
    {
        std::string r; r.reserve((size_t)W);
        for (int x = 0; x < W; ++x) {
            if (x < 4) { r += ' '; continue; }
            int k = (x - 4);
            if (k % 8 == 0) r += '+'; else if (k % 4 == 0) r += '^'; else r += '-';
        }
        TDrawBuffer b; TAttrPair ap{colNormal, colNormal};
        b.moveCStr(0, r.c_str(), ap, W);
        if ((int)r.size() < W) b.moveChar((ushort)r.size(), ' ', colNormal, W - (int)r.size());
        writeLine(0, 6, W, 1, b);
    }

    int visible = H - 8; // reserve 1 bottom row for footer strip
    int half = visible/2; // center playhead
    int start = step - half;

    auto seqNote = [&](int idx, int base)->std::string{
        // map sequence token to a note index based on hash
        std::string t = currentToken(idx);
        int h=0; for (char c: t) h = (h*131 + (unsigned char)c) & 0x7FFFFFFF;
        int note = base + (h % 12);
        return noteCell(note);
    };

    // Sidebar renderer (overlays right side)
    int SBW = sidebarWidth(W);
    SBW = (W < 60) ? 0 : std::min(std::max(18, W/4), 28);
    auto drawSidebarRow = [&](int y){
        if (SBW <= 0 || y < 4) return;
        int gridW = W - SBW - 1;
        if (gridW <= 0) return;
        int x0 = gridW; // divider position
        // Divider
        TDrawBuffer d; d.moveChar(0, ' ', colNormal, 1);
        d.moveStr(0, u8"║", colCtrlFrame);
        writeLine(x0, y, 1, 1, d);
        // Sidebar content
        int innerW = SBW;
        TDrawBuffer sb; sb.moveChar(0, ' ', colNormal, innerW);
        std::string s;
        if (y == 4) {
            s += "╔"; for (int i=0;i<innerW-2;++i) s += u8"═"; s += "╗";
        } else if (y == (H-1)) {
            s += "╚"; for (int i=0;i<innerW-2;++i) s += u8"═"; s += "╝";
        } else if (y == 5) {
            std::string title = " ORDERS ";
            int pad = std::max(0, innerW - 2 - (int)title.size());
            int left = pad/2, right = pad - left;
            s += "║"; s.append(left, ' '); s += title; s.append(right, ' '); s += "║";
        } else if (y > 5 && y < 18) {
            int item = y - 6;
            int pat = (step / 64) % 16;
            char buf[64];
            bool cur = (item == pat % 12);
            std::snprintf(buf, sizeof(buf), "%02X  PAT %X   ", item, item%16);
            std::string line = buf;
            line += cur ? u8"▶" : " ";
            if ((int)line.size() > innerW-2) line.resize((size_t)innerW-2);
            s += "║"; s += line; s.append(std::max(0, innerW-2 - (int)line.size()), ' '); s += "║";
        } else {
            // VU meters / scopes
            int w = innerW - 2; if (w < 0) w = 0;
            int bars = (int)((step*3 + y*5) % (w+1));
            std::string bar; bar.append(bars, '#'); bar.append(std::max(0,w - bars), ' ');
            s += "║"; s += bar; s += "║";
        }
        sb.moveCStr(0, s.c_str(), TAttrPair{colNormal, colNormal}, innerW);
        writeLine(x0+1, y, innerW, 1, sb);
    };

    for (int i = 0; i < visible; ++i) {
        int idx = start + i;
        int seqIdx = (idx % totalSteps + totalSteps) % totalSteps;

        std::string t0 = currentToken(seqIdx);
        std::string t_1 = currentToken(seqIdx-1);
        std::string t_2 = currentToken(seqIdx-2);
        auto preds = predictNext(t_2, t_1);

        // Per-channel cells
        bool hitK=false, hitS=false, hitH=false;
        auto cellFor = [&](int ch)->std::string {
            int row = seqIdx % 64;
            switch (ch) {
                case 0: { // KCK on beats
                    bool hit = (row % 8 == 0);
                    hitK = hit;
                    if (mutes[0]) hit = false;
                    return hit ? std::string("C-3 01 ..") : std::string("--- .. ..");
                }
                case 1: { // SNR on backbeats
                    bool hit = (row % 16 == 8);
                    hitS = hit;
                    if (mutes[1]) hit = false;
                    return hit ? std::string("D-3 02 ..") : std::string("--- .. ..");
                }
                case 2: { // HAT steady
                    bool hit = (row % 2 == 0);
                    hitH = hit;
                    if (mutes[2]) hit = false;
                    return hit ? std::string("F#4 03 ..") : std::string("--- .. ..");
                }
                case 3: { // BASS pattern
                    int base = 36 + ((row/16)%4)*2; // step through chord
                    if (mutes[3]) return std::string("--- .. ..");
                    return seqNote(seqIdx, base) + " 10 ..";
                }
                case 4: { // LEAD token-mapped melody
                    int base = 60 + ((row/8)%3);
                    if (mutes[4]) return std::string("--- .. ..");
                    return seqNote(seqIdx+3, base) + " 20 ..";
                }
                case 5: { // TOK lane
                    if (mutes[5]) return std::string( ch?"            ":"" );
                    std::string s = "tok:" + t0;
                    return s;
                }
                case 6: { // P1
                    if (mutes[6]) return std::string( ch?"          ":"" );
                    std::string s = "p1:" + preds[0];
                    return s;
                }
                case 7: { // P2
                    if (mutes[7]) return std::string( ch?"          ":"" );
                    std::string s = "p2:" + preds[1];
                    return s;
                }
                case 8: { // EMOJI from row sum
                    std::string e = rowEmoji(hitK, hitS, hitH, t0, preds, idx);
                    return e;
                }
            }
            return std::string();
        };

        char rowHex[8]; std::snprintf(rowHex, sizeof(rowHex), "%02X ", (unsigned)(seqIdx & 0x3F));
        // Construct the line and color segments: playhead priority > beat highlight > shading
        bool isPlayhead = (i == half);
        bool isBeat = ((seqIdx % 8) == 0);
        TColorAttr baseAttr = isPlayhead ? colPlayhead : (isBeat ? colBeat : (shadeRows && (i%2)? colAltRow : colNormal));

        TDrawBuffer b;
        int x = 0;
        // ROW hex
        {
            std::string seg(rowHex);
            TAttrPair ap{baseAttr, baseAttr};
            b.moveCStr(x, seg.c_str(), ap, W - x); x += (int)seg.size();
        }
        // Channels
        for (int c = 0; c < N; ++c) {
            if (x < W) { b.moveChar(x, '|', baseAttr, 1); x += 1; }
            std::string seg = pad(cellFor(c), chans[c].w);
            TAttrPair ap{baseAttr, baseAttr};
            b.moveCStr(x, seg.c_str(), ap, W - x); x += (int)seg.size();
        }
        if (x < W) b.moveChar(x, ' ', baseAttr, W - x);
        writeLine(0, i+7, W, 1, b);
    }

    // Footer strip (monochrome, animated indicators)
    if (H >= 9) {
        int yFooter = H - 1;
        TDrawBuffer fb;
        std::string s;
        // REC indicator blinks on beats; RUN spinner cycles; SYNC dot on 8-step
        bool recOn = !paused && ((step % 8) < 4);
        static const char spin[4] = {'-', '\\', '|', '/'};
        char recChar = recOn ? '*' : 'o';
        char syncChar = ((step % 8) == 0) ? '*' : 'o';
        s += "REC "; s += recChar; s += "  RUN "; s += spin[spinner & 3]; s += "  SYNC "; s += syncChar; s += "  ";
        // CPU/MEM/DISK pseudo meters
        int cpu = (step * 7) % 101;
        int mem = 40 + (step * 3) % 50;
        int dsk = (step * 9) % 100;
        s += sliderBar(" CPU ", cpu, 0, 100, 10);
        s += sliderBar(" MEM ", mem, 0, 100, 10);
        s += sliderBar(" DISK ", dsk, 0, 100, 8);
        // Clip/pad to width
        fb.moveCStr(0, s.c_str(), TAttrPair{colNormal, colNormal}, W);
        ushort len = (ushort)std::min<int>((int)s.size(), W);
        if (len < W) fb.moveChar(len, ' ', colNormal, W - len);
        writeLine(0, yFooter, W, 1, fb);
    }
}

void TTokenTrackerView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId != 0 && ev.message.infoPtr == timerId) {
            advance();
            drawView();
            clearEvent(ev);
        }
    }
    else if (ev.what == evKeyDown) {
        // Character keys for control
        char ch = ev.keyDown.charScan.charCode;
        bool handled = false;
        switch (ch) {
            case '+': cfg.bpm = std::min(300, cfg.bpm + 5); applySpeedFromCfg(); handled = true; break;
            case '-': cfg.bpm = std::max(30, cfg.bpm - 5); applySpeedFromCfg(); handled = true; break;
            case ']': cfg.rowsPerBeat = std::min(16, cfg.rowsPerBeat + 1); applySpeedFromCfg(); handled = true; break;
            case '[': cfg.rowsPerBeat = std::max(1,  cfg.rowsPerBeat - 1); applySpeedFromCfg(); handled = true; break;
            case ' ': paused = !paused; handled = true; break;
            case 'l': case 'L': totalSteps = (totalSteps==64)?128:64; handled = true; break;
            case 'h': case 'H': shadeRows = !shadeRows; handled = true; break;
            case '1': mutes[0] = !mutes[0]; handled = true; break;
            case '2': mutes[1] = !mutes[1]; handled = true; break;
            case '3': mutes[2] = !mutes[2]; handled = true; break;
            case '4': mutes[3] = !mutes[3]; handled = true; break;
            case '5': mutes[4] = !mutes[4]; handled = true; break;
            case '6': mutes[5] = !mutes[5]; handled = true; break;
            case '7': mutes[6] = !mutes[6]; handled = true; break;
            case '8': mutes[7] = !mutes[7]; handled = true; break;
            default: break;
        }
        if (handled) {
            drawView();
            clearEvent(ev);
        }
    }
    else if (ev.what == evMouseDown) {
        TPoint p = ev.mouse.where; makeLocal(p);
        int id = hitButton(p.x, p.y);
        bool handled = false;
        if (id) { pressedId = id; drawView(); }
        if (id == 1) { paused = !paused; handled = true; }
        else if (id == 16) { step = (step - 4 + totalSteps) % totalSteps; handled = true; }
        else if (id == 17) { step = (step + 4) % totalSteps; handled = true; }
        else if (id == 18) { loopFlag = !loopFlag; handled = true; }
        else if (id == 19) { /* TAP tempo placeholder */ handled = true; }
        else if (id == 20) { /* Randomize seed pattern placeholder */ handled = true; }
        else if (id == 2) { cfg.bpm = std::max(30, cfg.bpm - 5); applySpeedFromCfg(); handled = true; }
        else if (id == 3) { cfg.bpm = std::min(300, cfg.bpm + 5); applySpeedFromCfg(); handled = true; }
        else if (id == 4) { cfg.rowsPerBeat = std::max(1, cfg.rowsPerBeat - 1); applySpeedFromCfg(); handled = true; }
        else if (id == 5) { cfg.rowsPerBeat = std::min(16, cfg.rowsPerBeat + 1); applySpeedFromCfg(); handled = true; }
        else if (id == 6) { totalSteps = (totalSteps==64)?128:64; handled = true; }
        else if (id == 7) { shadeRows = !shadeRows; handled = true; }
        else if (id == 21) { soloMode = !soloMode; handled = true; }
        else if (id >= 8 && id <= 15) { int ch = id - 8; mutes[ch] = !mutes[ch]; handled = true; }
        if (handled) { drawView(); clearEvent(ev); }
        pressedId = 0;
    }
}

void TTokenTrackerView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if ((aState & sfExposed) != 0) {
        if (enable) {
            step = 0;
            periodMs = cfg.periodMs();
            if (periodMs == 0) periodMs = 1;
            startTimer();
            rebuildLayout();
            drawView();
        } else {
            stopTimer();
        }
    }
}

void TTokenTrackerView::changeBounds(const TRect& bounds) {
    TView::changeBounds(bounds);
    rebuildLayout();
    drawView();
}
void TTokenTrackerView::buildButtons(int width) {
    // Two rows inside framed control box at y=1 and y=2.
    std::vector<Btn> bs;
    auto make = [&](int id, int x, int y, const std::string &label){
        TRect r; r.a.x = x; r.a.y = y; r.b.x = x + (int)label.size(); r.b.y = y+1; bs.push_back(Btn{id, r, label}); return (int)label.size(); };
    // Row A (ASCII-only labels)
    int x = 1;
    x += make(1, x, 1, paused ? "[> PLAY] " : "[|| PAUSE]"); x += 1;
    x += make(16, x, 1, "[<<]"); x += 1;
    x += make(17, x, 1, "[>>]"); x += 2;
    x += make(18, x, 1, loopFlag?"[LOOP]":"[loop]"); x += 2;
    x += make(19, x, 1, "[TAP]"); x += 1;
    x += make(20, x, 1, "[RND]"); x += 2;
    // LEDs and spinner
    static const char spin[4] = {'-', '\\', '|', '/'};
    char led[64]; std::snprintf(led, sizeof(led), " RUN:%c  SYNC:%c  ", spin[spinner&3], ((step%8)==0?'*':'o'));
    x += make(0, x, 1, led);
    // Row B
    x = 1;
    char buf[32];
    std::snprintf(buf, sizeof(buf), "BPM:%3d ", cfg.bpm); x += make(0, x, 2, buf);
    x += make(2, x, 2, "[-]"); x += make(3, x, 2, "[+]"); x += 2;
    std::snprintf(buf, sizeof(buf), "SPD:%2d ", cfg.rowsPerBeat); x += make(0, x, 2, buf);
    x += make(4, x, 2, "[-]"); x += make(5, x, 2, "[+]"); x += 2;
    x += make(6, x, 2, totalSteps==64?"[LEN 64]":"[LEN 128]"); x += 2;
    x += make(7, x, 2, shadeRows?"[SHADE ON]":"[SHADE OFF]"); x += 2;
    x += make(21, x, 2, soloMode?"[SOLO ON]":"[SOLO OFF]"); x += 2;
    const char* labels[8] = {"M1 KCK","M2 SNR","M3 HAT","M4 BAS","M5 LED","M6 TOK","M7 P1 ","M8 P2 "};
    for (int i=0;i<8;++i) {
        std::string lab = "["; lab += labels[i]; lab += mutes[i]?"*] ":"] ";
        x += make(8+i, x, 2, lab);
        if (x > width-6) break;
    }
    buttons.swap(bs);
}

int TTokenTrackerView::hitButton(int x, int y) const {
    for (const auto &b : buttons) {
        if (y >= b.r.a.y && y < b.r.b.y && x >= b.r.a.x && x < b.r.b.x) return b.id;
    }
    return 0;
}

// Wrapper window factory
class TTokenTrackerWindow : public TWindow {
public:
    explicit TTokenTrackerWindow(const TRect &bounds)
        : TWindow(bounds, "Token Tracker", wnNoNumber)
        , TWindowInit(&TTokenTrackerWindow::initFrame) {}

    void setup() {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TTokenTrackerView(c));
    }

private:
    static TFrame* initFrame(TRect r) { return new TFrame(r); }
};

TWindow* createTokenTrackerWindow(const TRect &bounds) {
    auto *w = new TTokenTrackerWindow(bounds);
    w->setup();
    return w;
}
