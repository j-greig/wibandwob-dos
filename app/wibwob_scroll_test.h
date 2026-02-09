/*---------------------------------------------------------*/
/*                                                         */
/*   wibwob_scroll_test.h - Scrollbar Fix Prototypes       */
/*                                                         */
/*   Two test implementations:                             */
/*   A) standardScrollBar() fix (minimal change)           */
/*   B) TScroller-based refactor (proper TV pattern)       */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef WIBWOB_SCROLL_TEST_H
#define WIBWOB_SCROLL_TEST_H

#define Uses_TView
#define Uses_TRect
#define Uses_TEvent
#define Uses_TKeys
#define Uses_TDrawBuffer
#define Uses_TWindow
#define Uses_TFrame
#define Uses_TScrollBar
#define Uses_TScroller
#include <tvision/tv.h>

#include <string>
#include <vector>

//=============================================================================
// Shared test content
//=============================================================================

struct TestMessage {
    std::string sender;
    std::string content;
};

// Returns vector of prefilled test messages with ASCII art
std::vector<TestMessage> getTestChatContent();

//=============================================================================
// OPTION A: standardScrollBar() fix (extends TView)
//=============================================================================

class TWibWobTestViewA : public TView {
public:
    TWibWobTestViewA(const TRect& bounds, TScrollBar* vScroll);
    virtual ~TWibWobTestViewA() = default;

    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;
    virtual void changeBounds(const TRect& bounds) override;

    void loadTestContent();
    void updateScrollBar();

private:
    std::vector<TestMessage> messages;
    TScrollBar* vScrollBar;
    int scrollOffset = 0;

    int getMessageAreaHeight() const;
    std::vector<std::string> wrapText(const std::string& text, int width) const;
    int calculateTotalLines() const;
};

class TWibWobTestWindowA : public TWindow {
public:
    TWibWobTestWindowA(const TRect& bounds, const std::string& title);

    virtual void changeBounds(const TRect& bounds) override;

private:
    static TFrame* initFrame(TRect r);
    TWibWobTestViewA* contentView {nullptr};
    TScrollBar* vScrollBar {nullptr};
};

TWindow* createWibWobTestWindowA(const TRect& bounds, const std::string& title);

//=============================================================================
// OPTION B: TScroller-based (proper TV pattern)
//=============================================================================

class TWibWobTestViewB : public TScroller {
public:
    TWibWobTestViewB(const TRect& bounds, TScrollBar* hScroll, TScrollBar* vScroll);
    virtual ~TWibWobTestViewB() = default;

    virtual void draw() override;
    virtual void scrollDraw() override;
    virtual void handleEvent(TEvent& event) override;

    void loadTestContent();

private:
    std::vector<TestMessage> messages;

    // Pre-computed wrapped lines for efficient drawing
    struct WrappedLine {
        std::string text;
        std::string sender;  // For color coding
    };
    std::vector<WrappedLine> wrappedLines;
    int maxLineWidth = 0;

    void rebuildWrappedLines();
    std::vector<std::string> wrapText(const std::string& text, int width) const;
};

class TWibWobTestWindowB : public TWindow {
public:
    TWibWobTestWindowB(const TRect& bounds, const std::string& title);

private:
    static TFrame* initFrame(TRect r);
    TWibWobTestViewB* contentView {nullptr};
};

TWindow* createWibWobTestWindowB(const TRect& bounds, const std::string& title);

//=============================================================================
// OPTION C: Split View Architecture (MessageView + InputView)
// Tests the actual production architecture with prepopulated content
//=============================================================================

TWindow* createWibWobTestWindowC(const TRect& bounds, const std::string& title);

#endif // WIBWOB_SCROLL_TEST_H
