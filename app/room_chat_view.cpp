/*---------------------------------------------------------*/
/*                                                         */
/*   room_chat_view.cpp — Multi-user PartyKit room chat   */
/*                                                         */
/*---------------------------------------------------------*/

#include "room_chat_view.h"

#define Uses_TKeys
#define Uses_TDrawBuffer
#define Uses_TColorAttr
#define Uses_TWindow
#define Uses_TFrame
#define Uses_TScrollBar
#define Uses_TScroller
#define Uses_TProgram
#define Uses_TDeskTop
#define Uses_TGroup
#include <tvision/tv.h>

#include <ctime>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cstdlib>

// ── Global window tracker ──────────────────────────────────────────────────
static TRoomChatWindow* g_roomChatWindow = nullptr;

TRoomChatWindow* getRoomChatWindow() { return g_roomChatWindow; }

// ── Colours ────────────────────────────────────────────────────────────────
// Sender colours — hashed by name so strip and chat always agree.
// "me" and any name tagged " (me)" share a fixed self-colour so both
// views stay consistent regardless of the local user's animal name.

static const TColorRGB kSelfColor(120, 220, 140);  // soft green — always self
static const TColorRGB kBgColor(20, 20, 30);
static const std::string kMeSuffix(" (me)");

static TColorAttr senderColor(const std::string& sender) {
    // Self: "me" label in chat, or strip entry tagged with " (me)"
    if (sender == "me") return TColorAttr(kSelfColor, kBgColor);
    if (sender.size() >= kMeSuffix.size() &&
        sender.compare(sender.size() - kMeSuffix.size(),
                       kMeSuffix.size(), kMeSuffix) == 0)
        return TColorAttr(kSelfColor, kBgColor);

    // Others: strip " (me)" if present, then hash the base name
    std::string key = sender;
    if (key.size() >= kMeSuffix.size() &&
        key.compare(key.size() - kMeSuffix.size(),
                    kMeSuffix.size(), kMeSuffix) == 0)
        key.erase(key.size() - kMeSuffix.size());

    int h = 7;
    for (unsigned char c : key) h = h * 31 + c;
    static const TColorRGB palette[5] = {
        TColorRGB(100, 180, 255),  // soft blue
        TColorRGB(255, 180,  80),  // amber
        TColorRGB(220, 110, 220),  // lavender
        TColorRGB(100, 220, 210),  // teal
        TColorRGB(255, 140, 120),  // coral
    };
    return TColorAttr(palette[std::abs(h) % 5], kBgColor);
}

static TColorAttr textColor() {
    return TColorAttr(TColorRGB(200, 200, 210), TColorRGB(20, 20, 30));
}

static TColorAttr dimColor() {
    return TColorAttr(TColorRGB(100, 100, 120), TColorRGB(20, 20, 30));
}

static TColorAttr inputBgColor() {
    return TColorAttr(TColorRGB(220, 220, 230), TColorRGB(30, 30, 45));
}

static std::string nowHHMM() {
    std::time_t t = std::time(nullptr);
    std::tm* tm = std::localtime(&t);
    std::ostringstream o;
    o << std::setw(2) << std::setfill('0') << tm->tm_hour
      << ":" << std::setw(2) << std::setfill('0') << tm->tm_min;
    return o.str();
}

std::string normaliseMsgTs(const std::string& ts) {
    if (ts.empty()) return "";

    const bool allDigits = std::all_of(ts.begin(), ts.end(), [](unsigned char c) {
        return c >= '0' && c <= '9';
    });
    if (!allDigits || ts.size() < 10) return ts;

    char* end = nullptr;
    unsigned long long raw = std::strtoull(ts.c_str(), &end, 10);
    if (end == nullptr || *end != '\0') return ts;

    if (raw > 1000000000000ULL) raw /= 1000ULL;

    std::time_t t = static_cast<std::time_t>(raw);
    std::tm* tm = std::localtime(&t);
    if (!tm) return ts;

    char buf[6] = {0};
    if (std::strftime(buf, sizeof(buf), "%H:%M", tm) == 0) return ts;
    return std::string(buf);
}

// ── TRoomParticipantStrip ──────────────────────────────────────────────────

TRoomParticipantStrip::TRoomParticipantStrip(const TRect& bounds)
    : TView(bounds)
{
    growMode = gfGrowHiY;
    options  |= ofFramed;
}

void TRoomParticipantStrip::setParticipants(const std::vector<RoomParticipant>& p) {
    participants_ = p;
    drawView();
}

void TRoomParticipantStrip::draw() {
    TDrawBuffer b;
    TColorAttr bg    = textColor();
    TColorAttr faint = dimColor();

    for (int row = 0; row < size.y; row++) {
        b.moveChar(0, ' ', bg, size.x);

        if (row < (int)participants_.size()) {
            const auto& p = participants_[row];
            std::string line = "\x07 " + p.name; // bullet char
            if ((int)line.size() > size.x) line = line.substr(0, size.x);
            b.moveStr(0, line.c_str(), senderColor(p.id));
        } else if (row == size.y - 1) {
            // Bottom row: count
            int n = (int)participants_.size();
            std::string cnt = std::to_string(n) + (n == 1 ? " in room" : " in room");
            if ((int)cnt.size() > size.x) cnt = cnt.substr(0, size.x);
            b.moveStr(0, cnt.c_str(), faint);
        }

        writeLine(0, row, size.x, 1, b);
    }
}

// ── TRoomMessageView ───────────────────────────────────────────────────────

TRoomMessageView::TRoomMessageView(const TRect& bounds, TScrollBar* vScroll)
    : TScroller(bounds, nullptr, vScroll)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options  |= ofSelectable;
}

void TRoomMessageView::changeBounds(const TRect& bounds) {
    TScroller::changeBounds(bounds);
    rebuild();
}

void TRoomMessageView::addMessage(const RoomChatMessage& msg) {
    messages_.push_back(msg);
    rebuild();
    scrollToBottom();
    drawView();
}

void TRoomMessageView::scrollToBottom() {
    int maxY = std::max(0, limit.y - size.y);
    scrollTo(0, maxY);
}

void TRoomMessageView::rebuild() {
    lines_.clear();
    int w = std::max(1, size.x);

    for (const auto& msg : messages_) {
        // Header line: "[HH:MM] sender"
        std::string header = "[" + msg.ts + "] " + msg.sender;
        WrappedRoomLine hl;
        hl.text        = header;
        hl.isSenderLine = true;
        hl.sender       = msg.sender;
        lines_.push_back(hl);

        // Body — word-wrap text into w columns with 2-space indent
        std::string indent = "  ";
        std::string remaining = msg.text;
        while (!remaining.empty()) {
            int available = w - (int)indent.size();
            if (available <= 0) available = 1;
            std::string chunk;
            if ((int)remaining.size() <= available) {
                chunk = remaining;
                remaining.clear();
            } else {
                // Break at last space within available
                int cut = available;
                size_t sp = remaining.rfind(' ', available - 1);
                if (sp != std::string::npos) cut = (int)sp + 1;
                chunk = remaining.substr(0, cut);
                remaining = remaining.substr(cut);
                // Trim leading spaces on continuation
                while (!remaining.empty() && remaining[0] == ' ') remaining = remaining.substr(1);
            }
            WrappedRoomLine bl;
            bl.text        = indent + chunk;
            bl.isSenderLine = false;
            bl.sender       = msg.sender;
            lines_.push_back(bl);
        }
    }

    setLimit(w, (int)lines_.size());
}

void TRoomMessageView::draw() {
    TDrawBuffer b;
    int total = (int)lines_.size();

    for (int row = 0; row < size.y; row++) {
        b.moveChar(0, ' ', textColor(), size.x);

        int idx = delta.y + row;
        if (idx >= 0 && idx < total) {
            const auto& line = lines_[idx];
            TColorAttr attr = line.isSenderLine
                ? senderColor(line.sender)
                : textColor();
            std::string display = line.text;
            if ((int)display.size() > size.x) display = display.substr(0, size.x);
            b.moveStr(0, display.c_str(), attr);
        }

        writeLine(0, row, size.x, 1, b);
    }
}

// ── TRoomInputView — inline input line ────────────────────────────────────
// Simple TView that draws "> buf_" and routes keypresses back to the window.

class TRoomInputView : public TView {
public:
    std::string buf;

    explicit TRoomInputView(const TRect& bounds) : TView(bounds) {
        growMode = gfGrowLoY | gfGrowHiX | gfGrowHiY;
        options  |= ofSelectable | ofFirstClick;
        eventMask |= evKeyboard | evBroadcast;
        blinkTimer = setTimer(500, 500);
    }

    virtual void draw() override {
        TDrawBuffer b;
        TColorAttr attr = inputBgColor();
        TColorAttr cursorAttr = TColorAttr(TColorRGB(25, 25, 35), TColorRGB(220, 220, 230));
        b.moveChar(0, ' ', attr, size.x);
        std::string prompt = "> " + buf;
        if ((int)prompt.size() > size.x - 1) prompt = prompt.substr(0, size.x - 1);
        b.moveStr(0, prompt.c_str(), attr);
        // Blinking block cursor
        if (cursorVisible && (state & sfFocused)) {
            int cx = (int)prompt.size();
            if (cx < size.x)
                b.moveStr(cx, " ", cursorAttr);
        }
        writeLine(0, 0, size.x, 1, b);
    }

    virtual ~TRoomInputView() {
        if (blinkTimer) {
            killTimer(blinkTimer);
            blinkTimer = nullptr;
        }
    }

private:
    bool cursorVisible = true;
    void* blinkTimer = nullptr;

    virtual void handleEvent(TEvent& event) override {
        if (event.what == evKeyboard) {
            ushort key = event.keyDown.keyCode;
            char ch    = event.keyDown.charScan.charCode;

            if (key == kbEnter) {
                if (!buf.empty()) {
                    // Pass the text up to the window via a command event
                    TEvent send;
                    send.what            = evCommand;
                    send.message.command = cmRoomChatSend;
                    // Heap-allocate so the window can take ownership
                    send.message.infoPtr = new std::string(buf);
                    buf.clear();
                    drawView();
                    putEvent(send);
                }
                clearEvent(event);
            } else if (key == kbBack) {
                if (!buf.empty()) buf.pop_back();
                drawView();
                clearEvent(event);
            } else if (ch >= 32 && ch < 127) {
                buf += ch;
                drawView();
                clearEvent(event);
            }
        }
        TView::handleEvent(event);

        if (event.what == evBroadcast && event.message.command == cmTimerExpired) {
            if (blinkTimer && event.message.infoPtr == blinkTimer) {
                cursorVisible = !cursorVisible;
                drawView();
                clearEvent(event);
            }
        }
    }
};

// ── TRoomChatWindow ────────────────────────────────────────────────────────

TRoomChatWindow::TRoomChatWindow(const TRect& bounds, const char* title, int num)
    : TWindow(bounds, title, num)
    , TWindowInit(&TRoomChatWindow::initFrame)
{
    g_roomChatWindow = this;
    options  |= ofTileable;
    growMode  = gfGrowHiX | gfGrowHiY;

    TRect inner = getClipRect();
    inner.grow(-1, -1);  // inside frame

    // Strip is left 18 cols — wide enough for "• quick-swift" (13 chars) + margin
    int stripW = 18;
    TRect stripBounds(inner.a.x, inner.a.y,
                      inner.a.x + stripW, inner.b.y - 1);

    // Input row is the last row of the inner rect
    TRect inputBounds(inner.a.x + stripW + 1, inner.b.y - 1,
                      inner.b.x, inner.b.y);

    // Message view fills remaining space
    TRect msgBounds(inner.a.x + stripW + 1, inner.a.y,
                    inner.b.x, inner.b.y - 1);

    // Scrollbar on right edge of message view
    TScrollBar* vScroll = new TScrollBar(
        TRect(inner.b.x - 1, inner.a.y, inner.b.x, inner.b.y - 1));

    strip_   = new TRoomParticipantStrip(stripBounds);
    msgView_ = new TRoomMessageView(msgBounds, vScroll);
    auto* input = new TRoomInputView(inputBounds);
    inputView_ = input;

    insert(vScroll);
    insert(strip_);
    insert(msgView_);
    insert(input);

    // Give focus to the input so keypresses reach it immediately
    input->select();

    // Seed with a system welcome line
    RoomChatMessage welcome;
    welcome.sender = "system";
    welcome.text   = "Room chat connected. Type /help for commands, /rename <name> to set your name.";
    welcome.ts     = nowHHMM();
    msgView_->addMessage(welcome);
}

std::vector<std::string> TRoomChatWindow::drainPending() {
    std::vector<std::string> out;
    std::swap(out, pendingOutbound);
    return out;
}

bool TRoomChatWindow::handleSlashCommand(const std::string& text) {
    if (text.empty() || text[0] != '/') return false;

    RoomChatMessage sys;
    sys.sender = "system";
    sys.ts     = nowHHMM();

    if (text == "/help") {
        sys.text = "Commands: /help  /rename <name>  /name";
        if (msgView_) msgView_->addMessage(sys);
        sys.text = "/rename <name> — set display name (a-z, 0-9, hyphens)";
        if (msgView_) msgView_->addMessage(sys);
        sys.text = "/name — show your current name";
        if (msgView_) msgView_->addMessage(sys);
        return true;
    }

    if (text == "/name") {
        sys.text = displayName_.empty()
            ? "Using default name (assigned by room)"
            : "Display name: " + displayName_;
        if (msgView_) msgView_->addMessage(sys);
        return true;
    }

    if (text.substr(0, 8) == "/rename ") {
        std::string name = text.substr(8);
        // Trim
        while (!name.empty() && name.front() == ' ') name.erase(name.begin());
        while (!name.empty() && name.back() == ' ')  name.pop_back();
        // Validate: alphanumeric + hyphens, 1-20 chars
        bool valid = !name.empty() && name.size() <= 20;
        for (char c : name) {
            if (!std::isalnum(static_cast<unsigned char>(c)) && c != '-') { valid = false; break; }
        }
        if (valid) {
            displayName_ = name;
            sys.text = "Display name set to: " + name;
            if (msgView_) msgView_->addMessage(sys);
        } else {
            sys.text = "Invalid name. Use 1-20 chars: a-z, 0-9, hyphens.";
            if (msgView_) msgView_->addMessage(sys);
        }
        return true;
    }

    // All paths above returned — if we get here, it's an unrecognised /command
    sys.text = "Unknown command. Type /help for commands.";
    if (msgView_) msgView_->addMessage(sys);
    return true;
}

TRoomChatWindow::~TRoomChatWindow() {
    if (g_roomChatWindow == this) g_roomChatWindow = nullptr;
}

void TRoomChatWindow::handleEvent(TEvent& event) {
    if (event.what == evCommand) {
        switch (event.message.command) {

            case cmRoomChatReceive: {
                auto* msg = static_cast<RoomChatMessage*>(event.message.infoPtr);
                if (msg) {
                    receiveMessage(*msg);
                    delete msg;
                }
                clearEvent(event);
                return;
            }

            case cmRoomPresence: {
                auto* participants =
                    static_cast<std::vector<RoomParticipant>*>(event.message.infoPtr);
                if (participants) {
                    updatePresence(*participants);
                    delete participants;
                }
                clearEvent(event);
                return;
            }

            case cmRoomChatSend: {
                auto* text = static_cast<std::string*>(event.message.infoPtr);
                if (text && !text->empty()) {
                    if (!handleSlashCommand(*text)) {
                        // Show locally as "me" immediately
                        RoomChatMessage msg;
                        msg.sender = "me";
                        msg.text   = *text;
                        msg.ts     = nowHHMM();
                        if (msgView_) msgView_->addMessage(msg);
                        // Queue for bridge to pick up
                        pendingOutbound.push_back(*text);
                    }
                    delete text;
                }
                clearEvent(event);
                return;
            }

            default:
                break;
        }
    }
    TWindow::handleEvent(event);
}

void TRoomChatWindow::receiveMessage(const RoomChatMessage& msg) {
    if (msgView_) {
        msgView_->addMessage(msg);
    }
}

void TRoomChatWindow::updatePresence(const std::vector<RoomParticipant>& participants) {
    if (strip_) {
        strip_->setParticipants(participants);
    }
}

// ── Factory ────────────────────────────────────────────────────────────────

TWindow* createRoomChatWindow(const TRect& bounds) {
    static int num = 0;
    return new TRoomChatWindow(bounds, "Room Chat", ++num);
}
