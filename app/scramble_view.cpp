/*---------------------------------------------------------*/
/*                                                         */
/*   scramble_view.cpp - Scramble the Symbient Cat         */
/*   ASCII cat presence with speech bubbles                */
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
/* Word wrap                                               */
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

/*---------------------------------------------------------*/
/* TScrambleWindow                                         */
/*---------------------------------------------------------*/

TScrambleWindow::TScrambleWindow(const TRect& bounds)
    : TWindow(bounds, "", wnNoNumber),
      TWindowInit(&TScrambleWindow::initFrame)
{
    flags = 0;  // No close/zoom/resize frame buttons
    options &= ~ofSelectable;  // Don't steal focus from other windows

    TRect interior = getExtent();
    interior.grow(-1, -1);

    scrambleView = new TScrambleView(interior);
    insert(scrambleView);
}

void TScrambleWindow::changeBounds(const TRect& bounds)
{
    TWindow::changeBounds(bounds);
    if (scrambleView) {
        scrambleView->drawView();
    }
}

TFrame* TScrambleWindow::initFrame(TRect r)
{
    return new TFrame(r);
}

/*---------------------------------------------------------*/
/* Factory                                                 */
/*---------------------------------------------------------*/

TWindow* createScrambleWindow(const TRect& bounds)
{
    return new TScrambleWindow(bounds);
}
