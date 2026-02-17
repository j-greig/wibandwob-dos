/*---------------------------------------------------------*/
/*                                                         */
/*   scramble_view.cpp - Scramble the Symbient Cat         */
/*   ASCII cat presence with speech bubbles                */
/*   + expand states: smol / tall with message history     */
/*                                                         */
/*---------------------------------------------------------*/

#include "scramble_view.h"
#include "scramble_engine.h"
#include <algorithm>
#include <cstdlib>
#include <ctime>

/*---------------------------------------------------------*/
/* Cat Art - static string art per pose                    */
/*---------------------------------------------------------*/

static const std::vector<std::string> catDefault = {
    "   /\\_/\\   ",
    "  ( o.o )  ",
    "   > ^ <   ",
    "  /|   |\\  ",
    " (_|   |_) ",
    "    | |    ",
    "   (___)   ",
    "           "
};

static const std::vector<std::string> catSleeping = {
    "           ",
    "   /\\_/\\   ",
    "  ( -.- )  ",
    "   /   \\   ",
    "  | zzZ |  ",
    "   \\___/   ",
    "  ~~~~~~~  ",
    "           "
};

static const std::vector<std::string> catCurious = {
    "     ?     ",
    "   /\\_/\\   ",
    "  ( O.O )  ",
    "  =( Y )=  ",
    "   /   \\   ",
    "  |  |  |  ",
    "  (_/ \\_)  ",
    "           "
};

const std::vector<std::string>& TScrambleView::getCatArt(ScramblePose pose)
{
    switch (pose) {
        case spSleeping: return catSleeping;
        case spCurious:  return catCurious;
        default:         return catDefault;
    }
}

/*---------------------------------------------------------*/
/* TScrambleView Implementation                            */
/*---------------------------------------------------------*/

TScrambleView::TScrambleView(const TRect& bounds)
    : TView(bounds),
      scrambleEngine(nullptr),
      currentPose(spDefault),
      bubbleVisible(false),
      bubbleFadeTicks(0),
      idleCounter(0),
      idleThreshold(0),
      timerId(0)
{
    growMode = gfGrowAll;
    eventMask |= evBroadcast;

    resetIdleTimer();
    say("mrrp! (=^..^=)");
}

TScrambleView::~TScrambleView()
{
    stopTimer();
}

void TScrambleView::startTimer()
{
    if (timerId == 0)
        timerId = setTimer(kTimerPeriodMs, kTimerPeriodMs);
}

void TScrambleView::stopTimer()
{
    if (timerId != 0) {
        killTimer(timerId);
        timerId = 0;
    }
}

void TScrambleView::setState(ushort aState, Boolean enable)
{
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

void TScrambleView::resetIdleTimer()
{
    idleCounter = 0;
    // 100-200 ticks at 10hz = 10-20 sec (centred on ~15s)
    idleThreshold = 100 + (std::rand() % 101);
}

void TScrambleView::say(const std::string& text)
{
    bubbleText = text;
    bubbleVisible = true;
    bubbleFadeTicks = kBubbleFadeMs / kTimerPeriodMs; // convert ms to ticks
    drawView();
}

void TScrambleView::setPose(ScramblePose pose)
{
    if (pose != currentPose) {
        currentPose = pose;
        drawView();
    }
}

void TScrambleView::toggleVisible()
{
    if (state & sfVisible) {
        hide();
    } else {
        show();
        say("mrrp! (=^..^=)");
    }
}

/*---------------------------------------------------------*/
/* Word wrap (shared helper)                               */
/*---------------------------------------------------------*/

std::vector<std::string> TScrambleView::wordWrap(const std::string& text, int width) const
{
    std::vector<std::string> lines;
    if (text.empty() || width <= 0) return lines;

    std::string current;
    std::string word;

    for (size_t i = 0; i <= text.size(); ++i) {
        char ch = (i < text.size()) ? text[i] : ' ';
        if (ch == ' ' || ch == '\n' || i == text.size()) {
            if (!word.empty()) {
                if (current.empty()) {
                    current = word;
                } else if (static_cast<int>(current.size() + 1 + word.size()) <= width) {
                    current += ' ';
                    current += word;
                } else {
                    lines.push_back(current);
                    current = word;
                }
                word.clear();
            }
            if (ch == '\n' && !current.empty()) {
                lines.push_back(current);
                current.clear();
            }
        } else {
            word += ch;
        }
    }
    if (!current.empty()) {
        lines.push_back(current);
    }
    return lines;
}

/*---------------------------------------------------------*/
/* draw()                                                  */
/*---------------------------------------------------------*/

void TScrambleView::draw()
{
    TDrawBuffer b;

    // Get desktop background for fake transparency
    TColorAttr bgAttr;
    char bgChar = ' ';
    if (TProgram::deskTop && TProgram::deskTop->background) {
        TBackground* bg = TProgram::deskTop->background;
        bgAttr = bg->getColor(0x01);
        bgChar = bg->pattern;
    } else {
        TColorDesired defaultFg = {};
        TColorDesired defaultBg = {};
        bgAttr = TColorAttr(defaultFg, defaultBg);
    }

    // Cat uses desktop bg colour so it blends
    TColorAttr catAttr = bgAttr;

    // Bubble colours: warm text on dark bg
    TColorAttr bubbleTextAttr = TColorAttr(TColorRGB(240, 240, 200), TColorRGB(40, 40, 50));
    TColorAttr bubbleBorderAttr = TColorAttr(TColorRGB(140, 140, 160), TColorRGB(40, 40, 50));

    // Word-wrap bubble text
    std::vector<std::string> bubbleLines;
    int bubbleHeight = 0;  // total rows: border + content
    int bubbleWidth = 0;
    if (bubbleVisible && !bubbleText.empty()) {
        int maxTextW = kBubbleMaxWidth - 4; // border + padding
        bubbleLines = wordWrap(bubbleText, maxTextW);
        bubbleHeight = static_cast<int>(bubbleLines.size()) + 2; // top+bottom border
        for (size_t i = 0; i < bubbleLines.size(); ++i) {
            int len = static_cast<int>(bubbleLines[i].size());
            if (len > bubbleWidth) bubbleWidth = len;
        }
        bubbleWidth += 4; // border + padding each side
    }

    const std::vector<std::string>& catArt = getCatArt(currentPose);
    int catH = static_cast<int>(catArt.size());

    // Anchor cat to bottom of view. Bubble + tail grow upward from above cat.
    int catStartRow = size.y - catH;            // cat always at bottom
    int tailRow = catStartRow - 1;              // tail connector just above cat
    int bubbleStartRow = tailRow - bubbleHeight; // bubble above tail

    for (int row = 0; row < size.y; ++row) {
        // Fill with desktop bg
        b.moveChar(0, bgChar, bgAttr, size.x);

        if (bubbleVisible && row >= bubbleStartRow && row < bubbleStartRow + bubbleHeight) {
            int brow = row - bubbleStartRow; // row within bubble (0 = top border)
            int bx = kBubbleX;
            if (brow == 0) {
                // Top border
                std::string top(1, '\xDA');
                for (int i = 0; i < bubbleWidth - 2; ++i) top += '\xC4';
                top += '\xBF';
                b.moveStr(bx, top.c_str(), bubbleBorderAttr);
            } else if (brow == bubbleHeight - 1) {
                // Bottom border
                std::string bot(1, '\xC0');
                for (int i = 0; i < bubbleWidth - 2; ++i) bot += '\xC4';
                bot += '\xD9';
                b.moveStr(bx, bot.c_str(), bubbleBorderAttr);
            } else {
                // Content row
                int textIdx = brow - 1;
                std::string content(1, '\xB3');
                content += ' ';
                if (textIdx < static_cast<int>(bubbleLines.size())) {
                    content += bubbleLines[textIdx];
                    while (static_cast<int>(content.size()) < bubbleWidth - 1)
                        content += ' ';
                } else {
                    for (int i = 0; i < bubbleWidth - 2; ++i) content += ' ';
                }
                content += '\xB3';
                b.moveStr(bx, content.c_str(), bubbleTextAttr);
                // Redraw border chars with border colour
                b.moveStr(bx, "\xB3", bubbleBorderAttr);
                if (bx + bubbleWidth - 1 < size.x) {
                    b.moveStr(bx + bubbleWidth - 1, "\xB3", bubbleBorderAttr);
                }
            }
        } else if (bubbleVisible && row == tailRow) {
            // Tail connector pointing down to cat
            int tailX = kCatX + 4;
            if (tailX < size.x) {
                b.moveStr(tailX, "\\", bubbleBorderAttr);
            }
        } else if (row >= catStartRow) {
            // Cat art — always anchored to bottom
            int catRow = row - catStartRow;
            if (catRow >= 0 && catRow < catH) {
                b.moveStr(kCatX, catArt[catRow].c_str(), catAttr);
            }
        }

        writeLine(0, row, size.x, 1, b);
    }
}

/*---------------------------------------------------------*/
/* handleEvent - timer for bubble fade + idle pose change  */
/*---------------------------------------------------------*/

void TScrambleView::handleEvent(TEvent& event)
{
    TView::handleEvent(event);

    if (event.what == evBroadcast && event.message.command == cmTimerExpired) {
        if (timerId != 0 && event.message.infoPtr == timerId) {
            // Bubble fade countdown
            if (bubbleVisible && bubbleFadeTicks > 0) {
                bubbleFadeTicks--;
                if (bubbleFadeTicks <= 0) {
                    bubbleVisible = false;
                    drawView();
                }
            }

            // Idle pose rotation
            idleCounter++;
            if (idleCounter >= idleThreshold) {
                ScramblePose next = static_cast<ScramblePose>((currentPose + 1) % spCount);
                setPose(next);
                resetIdleTimer();

                // Get observation from engine if available, else fallback
                std::string obs;
                if (scrambleEngine) {
                    obs = scrambleEngine->idleObservation();
                }
                if (obs.empty()) {
                    switch (next) {
                        case spSleeping: obs = "*yawn* zzZ"; break;
                        case spCurious:  obs = "hm? (o.O)"; break;
                        default:         obs = "mrrp!"; break;
                    }
                }
                say(obs);
            }

            clearEvent(event);
        }
    }
}

/*=========================================================*/
/*  TScrambleMessageView - minimal message history         */
/*=========================================================*/

static std::vector<std::string> simpleWordWrap(const std::string& text, int width)
{
    std::vector<std::string> lines;
    if (text.empty() || width <= 0) return lines;

    std::string current;
    std::string word;

    for (size_t i = 0; i <= text.size(); ++i) {
        char ch = (i < text.size()) ? text[i] : ' ';
        if (ch == ' ' || ch == '\n' || i == text.size()) {
            if (!word.empty()) {
                if (current.empty()) {
                    current = word;
                } else if (static_cast<int>(current.size() + 1 + word.size()) <= width) {
                    current += ' ';
                    current += word;
                } else {
                    lines.push_back(current);
                    current = word;
                }
                word.clear();
            }
            if (ch == '\n' && !current.empty()) {
                lines.push_back(current);
                current.clear();
            }
        } else {
            word += ch;
        }
    }
    if (!current.empty()) {
        lines.push_back(current);
    }
    return lines;
}

TScrambleMessageView::TScrambleMessageView(const TRect& bounds)
    : TView(bounds)
{
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask = 0; // passive — no events needed
}

void TScrambleMessageView::addMessage(const std::string& sender, const std::string& text)
{
    ScrambleMessage msg;
    msg.sender = sender;
    msg.text = text;
    messages.push_back(msg);
    rebuildWrappedLines();
    drawView();
}

void TScrambleMessageView::clear()
{
    messages.clear();
    wrappedLines.clear();
    drawView();
}

void TScrambleMessageView::rebuildWrappedLines()
{
    wrappedLines.clear();
    int textWidth = size.x - 2; // 1 char padding each side
    if (textWidth < 4) textWidth = 4;

    for (size_t i = 0; i < messages.size(); ++i) {
        const auto& msg = messages[i];
        // Sender line
        WrappedLine senderLine;
        senderLine.text = msg.sender + ":";
        senderLine.isSenderLine = true;
        wrappedLines.push_back(senderLine);

        // Wrapped content lines
        std::vector<std::string> lines = simpleWordWrap(msg.text, textWidth - 1);
        for (size_t j = 0; j < lines.size(); ++j) {
            WrappedLine wl;
            wl.text = " " + lines[j];
            wl.isSenderLine = false;
            wrappedLines.push_back(wl);
        }
    }
}

void TScrambleMessageView::draw()
{
    TDrawBuffer b;

    // Colours
    TColorAttr bgAttr = TColorAttr(TColorRGB(160, 160, 170), TColorRGB(30, 30, 40));
    TColorAttr senderAttr = TColorAttr(TColorRGB(200, 180, 120), TColorRGB(30, 30, 40));
    TColorAttr textAttr = TColorAttr(TColorRGB(190, 190, 200), TColorRGB(30, 30, 40));

    // Show last N lines that fit in the view
    int totalLines = static_cast<int>(wrappedLines.size());
    int startLine = totalLines - size.y;
    if (startLine < 0) startLine = 0;

    for (int row = 0; row < size.y; ++row) {
        b.moveChar(0, ' ', bgAttr, size.x);

        int lineIdx = startLine + row;
        if (lineIdx < totalLines) {
            const auto& wl = wrappedLines[lineIdx];
            TColorAttr attr = wl.isSenderLine ? senderAttr : textAttr;
            // Pad/truncate to fit
            std::string display = " " + wl.text;
            if (static_cast<int>(display.size()) > size.x)
                display = display.substr(0, size.x);
            b.moveStr(0, display.c_str(), attr);
        }

        writeLine(0, row, size.x, 1, b);
    }
}

std::vector<std::string> TScrambleMessageView::wrapText(const std::string& text, int width) const
{
    return simpleWordWrap(text, width);
}

/*=========================================================*/
/*  TScrambleInputView - minimal single-line input         */
/*=========================================================*/

TScrambleInputView::TScrambleInputView(const TRect& bounds)
    : TView(bounds),
      cursorPos(0),
      cursorVisible(true),
      cursorTimerId(0)
{
    growMode = gfGrowHiX | gfGrowLoY | gfGrowHiY;
    eventMask |= evKeyDown | evBroadcast;
    options |= ofSelectable | ofFirstClick;
}

TScrambleInputView::~TScrambleInputView()
{
    stopCursorBlink();
}

void TScrambleInputView::startCursorBlink()
{
    if (cursorTimerId == 0)
        cursorTimerId = setTimer(500, 500); // 500ms blink
}

void TScrambleInputView::stopCursorBlink()
{
    if (cursorTimerId != 0) {
        killTimer(cursorTimerId);
        cursorTimerId = 0;
    }
}

void TScrambleInputView::setState(ushort aState, Boolean enable)
{
    TView::setState(aState, enable);
    if ((aState & sfFocused) != 0) {
        if (enable) {
            startCursorBlink();
            cursorVisible = true;
        } else {
            stopCursorBlink();
            cursorVisible = false;
        }
        drawView();
    }
}

void TScrambleInputView::clearInput()
{
    currentInput.clear();
    cursorPos = 0;
    drawView();
}

void TScrambleInputView::draw()
{
    TDrawBuffer b;

    // Colours
    TColorAttr promptAttr = TColorAttr(TColorRGB(200, 180, 120), TColorRGB(25, 25, 35));
    TColorAttr inputAttr = TColorAttr(TColorRGB(220, 220, 230), TColorRGB(25, 25, 35));
    TColorAttr cursorAttr = TColorAttr(TColorRGB(25, 25, 35), TColorRGB(220, 220, 230));

    // Separator line on row 0
    TColorAttr sepAttr = TColorAttr(TColorRGB(80, 80, 100), TColorRGB(25, 25, 35));
    b.moveChar(0, '\xC4', sepAttr, size.x);
    writeLine(0, 0, size.x, 1, b);

    // Input line on row 1
    b.moveChar(0, ' ', inputAttr, size.x);
    b.moveStr(0, "> ", promptAttr);

    // Render input text
    int maxTextWidth = size.x - 3; // "> " prefix + 1 for cursor
    int displayStart = 0;
    if (cursorPos > maxTextWidth)
        displayStart = cursorPos - maxTextWidth;
    std::string visible = currentInput.substr(displayStart,
                                              maxTextWidth);
    b.moveStr(2, visible.c_str(), inputAttr);

    // Draw cursor
    if (cursorVisible && (state & sfFocused)) {
        int cursorX = 2 + (cursorPos - displayStart);
        if (cursorX < size.x) {
            char cursorChar = (cursorPos < static_cast<int>(currentInput.size()))
                ? currentInput[cursorPos] : ' ';
            char buf[2] = { cursorChar, 0 };
            b.moveStr(cursorX, buf, cursorAttr);
        }
    }

    writeLine(0, 1, size.x, 1, b);
}

void TScrambleInputView::handleEvent(TEvent& event)
{
    // Handle keyboard events directly — don't pass to TView first
    // (avoids TV's focus-gating on keyboard dispatch)
    if (event.what == evKeyDown) {
        ushort keyCode = event.keyDown.keyCode;
        char ch = event.keyDown.charScan.charCode;

        if (keyCode == kbEnter) {
            if (!currentInput.empty() && onSubmit) {
                std::string input = currentInput;
                clearInput();
                onSubmit(input);
            }
            clearEvent(event);
        } else if (keyCode == kbBack) {
            if (cursorPos > 0) {
                currentInput.erase(cursorPos - 1, 1);
                cursorPos--;
                drawView();
            }
            clearEvent(event);
        } else if (keyCode == kbDel) {
            if (cursorPos < static_cast<int>(currentInput.size())) {
                currentInput.erase(cursorPos, 1);
                drawView();
            }
            clearEvent(event);
        } else if (keyCode == kbLeft) {
            if (cursorPos > 0) {
                cursorPos--;
                drawView();
            }
            clearEvent(event);
        } else if (keyCode == kbRight) {
            if (cursorPos < static_cast<int>(currentInput.size())) {
                cursorPos++;
                drawView();
            }
            clearEvent(event);
        } else if (keyCode == kbHome) {
            cursorPos = 0;
            drawView();
            clearEvent(event);
        } else if (keyCode == kbEnd) {
            cursorPos = static_cast<int>(currentInput.size());
            drawView();
            clearEvent(event);
        } else if (ch >= 32 && ch < 127) {
            // Printable character
            currentInput.insert(currentInput.begin() + cursorPos, ch);
            cursorPos++;
            drawView();
            clearEvent(event);
        }
        return;
    }

    // Let base class handle non-keyboard events (broadcasts, etc.)
    TView::handleEvent(event);

    if (event.what == evBroadcast && event.message.command == cmTimerExpired) {
        if (cursorTimerId != 0 && event.message.infoPtr == cursorTimerId) {
            cursorVisible = !cursorVisible;
            drawView();
            clearEvent(event);
        }
    }
}

/*=========================================================*/
/*  TScrambleWindow                                        */
/*=========================================================*/

// Heights for cat view region (cat art + bubble space)
static const int kCatViewHeight = 12;
// Height for input view (separator + input line)
static const int kInputViewHeight = 2;

TScrambleWindow::TScrambleWindow(const TRect& bounds, ScrambleDisplayState initialState)
    : TWindow(bounds, "", wnNoNumber),
      TWindowInit(&TScrambleWindow::initFrame),
      displayState(initialState),
      scrambleView(nullptr),
      messageView(nullptr),
      inputView(nullptr)
{
    // Smol: no chrome. Tall: close + move + title.
    if (displayState == sdsSmol) {
        flags = 0;
        options &= ~ofSelectable;  // Don't steal focus from other windows
    } else {
        flags = wfClose | wfMove;
        delete[] (char*)title;
        title = newStr("Scramble");
    }

    // Create all subviews — visibility managed by layoutChildren
    TRect interior = getExtent();
    interior.grow(-1, -1);

    // Cat view always exists
    scrambleView = new TScrambleView(interior);
    insert(scrambleView);

    // Message view — created but hidden in smol
    messageView = new TScrambleMessageView(interior);
    insert(messageView);

    // Input view — created but hidden in smol
    TRect inputRect(interior.a.x, interior.b.y - kInputViewHeight,
                    interior.b.x, interior.b.y);
    inputView = new TScrambleInputView(inputRect);
    insert(inputView);

    layoutChildren();
}

void TScrambleWindow::setDisplayState(ScrambleDisplayState state)
{
    if (state == displayState) return;
    displayState = state;

    if (displayState == sdsSmol) {
        flags = 0;
        options &= ~ofSelectable;
        delete[] (char*)title;
        title = newStr("");
    } else if (displayState == sdsTall) {
        flags = wfClose | wfMove;
        options |= ofSelectable;
        delete[] (char*)title;
        title = newStr("Scramble");
    }

    layoutChildren();
}

void TScrambleWindow::layoutChildren()
{
    TRect interior = getExtent();
    interior.grow(-1, -1);
    int h = interior.b.y - interior.a.y;

    if (displayState == sdsSmol) {
        // Smol: cat view fills everything, message + input hidden
        if (messageView) messageView->hide();
        if (inputView) inputView->hide();
        if (scrambleView) {
            scrambleView->changeBounds(interior);
            scrambleView->show();
        }
    } else if (displayState == sdsTall) {
        // Tall layout:
        //   [message view]  top to (bottom - catViewHeight - inputHeight)
        //   [input view]    2 rows above cat
        //   [cat view]      bottom kCatViewHeight rows

        if (h < kInputViewHeight + 4) {
            // Too small for tall layout — hide message/input, show cat only
            if (messageView) messageView->hide();
            if (inputView) inputView->hide();
            if (scrambleView) {
                scrambleView->changeBounds(interior);
                scrambleView->show();
            }
            drawView();
            return;
        }

        int catH = std::min(kCatViewHeight, h);
        int inputH = kInputViewHeight;
        int msgH = h - catH - inputH;
        if (msgH < 2) msgH = 2; // minimum message area

        int msgTop = interior.a.y;
        int msgBot = msgTop + msgH;
        int inputTop = msgBot;
        int inputBot = inputTop + inputH;
        int catTop = inputBot;
        int catBot = interior.b.y;

        if (messageView) {
            TRect msgRect(interior.a.x, msgTop, interior.b.x, msgBot);
            messageView->changeBounds(msgRect);
            messageView->show();
        }
        if (inputView) {
            TRect inputRect(interior.a.x, inputTop, interior.b.x, inputBot);
            inputView->changeBounds(inputRect);
            inputView->show();
        }
        if (scrambleView) {
            TRect catRect(interior.a.x, catTop, interior.b.x, catBot);
            scrambleView->changeBounds(catRect);
            scrambleView->show();
        }
    }

    drawView();
}

void TScrambleWindow::focusInput()
{
    if (displayState == sdsTall && inputView) {
        options |= ofSelectable;
        // select() on TWindow only calls makeFirst() (Z-order) due to ofTopSelect,
        // then resetCurrent() picks the FIRST visible+selectable view from the
        // bottom of the Z-list — which may be a DIFFERENT window.
        // Fix: directly set this window as desktop's current focused view.
        if (owner) {
            makeFirst();
            TGroup* grp = static_cast<TGroup*>(owner);
            grp->setCurrent(this, normalSelect);
        }
        // Then route focus to input view within this window
        inputView->select();
    }
}

void TScrambleWindow::handleEvent(TEvent& event)
{
    // Close button → toggle off via app command (prevents dangling pointer)
    if (event.what == evCommand && event.message.command == cmClose) {
        clearEvent(event);
        TEvent toggle;
        toggle.what = evCommand;
        toggle.message.command = cmScrambleToggle;
        toggle.message.infoPtr = nullptr;
        putEvent(toggle);
        return;
    }

    // In tall mode, forward keyboard to input view.
    // inputView only consumes keys it knows (printable, backspace, arrows, enter).
    // Unconsumed keys fall through to TWindow::handleEvent for normal dispatch.
    if (displayState == sdsTall && inputView && (inputView->state & sfVisible)) {
        if (event.what == evKeyDown) {
            inputView->handleEvent(event);
            if (event.what == evNothing) return;
        }
    }
    TWindow::handleEvent(event);
}

void TScrambleWindow::setState(ushort aState, Boolean enable)
{
    TWindow::setState(aState, enable);
    // When the window gets focused, route to the input view in tall mode
    if ((aState & sfFocused) && enable && displayState == sdsTall && inputView) {
        inputView->select();
    }
}

void TScrambleWindow::changeBounds(const TRect& bounds)
{
    TWindow::changeBounds(bounds);
    layoutChildren();
}

TFrame* TScrambleWindow::initFrame(TRect r)
{
    return new TFrame(r);
}

/*---------------------------------------------------------*/
/* Factory                                                 */
/*---------------------------------------------------------*/

TWindow* createScrambleWindow(const TRect& bounds, ScrambleDisplayState state)
{
    return new TScrambleWindow(bounds, state);
}
