/*---------------------------------------------------------*/
/*                                                         */
/*   browser_view.h - TUI Browser Window                   */
/*   Fetches URLs via Python API, renders markdown text    */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef BROWSER_VIEW_H
#define BROWSER_VIEW_H

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

// Async fetch lifecycle
enum FetchState { Idle, Fetching, Ready, Error };

/*---------------------------------------------------------*/
/*  TBrowserContentView - Scrollable content pane          */
/*  Renders wrapped text lines with scroll offset          */
/*---------------------------------------------------------*/
class TBrowserContentView : public TScroller {
public:
    TBrowserContentView(const TRect& bounds, TScrollBar* hScroll, TScrollBar* vScroll);

    virtual void draw() override;
    virtual void changeBounds(const TRect& bounds) override;

    // Content management
    void setContent(const std::vector<std::string>& newLines);
    void clear();

    // Scrolling
    void scrollToTop();
    void scrollLineUp();
    void scrollLineDown();
    void scrollPageUp();
    void scrollPageDown();

private:
    struct WrappedLine {
        std::string text;
    };

    std::vector<std::string> sourceLines;
    std::vector<WrappedLine> wrappedLines;

    void rebuildWrappedLines();
    std::vector<std::string> wrapText(const std::string& text, int width) const;
};

/*---------------------------------------------------------*/
/*  TBrowserWindow - Composes URL bar, content, status     */
/*  Handles keybindings and async fetch lifecycle          */
/*---------------------------------------------------------*/
class TBrowserWindow : public TWindow {
public:
    TBrowserWindow(const TRect& bounds);
    virtual ~TBrowserWindow();

    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;
    virtual void changeBounds(const TRect& bounds) override;

    // External API: trigger a fetch
    void fetchUrl(const std::string& url);

    // Poll async fetch (called from timer)
    void pollFetch();

    // Accessors
    const std::string& getCurrentUrl() const { return currentUrl; }
    FetchState getState() const { return fetchState; }
    const std::string& getImageMode() const { return imageMode; }

private:
    static TFrame* initFrame(TRect r);
    void layoutChildren();

    // Sub-views (owned by TGroup, not deleted manually)
    TBrowserContentView* contentView = nullptr;
    TScrollBar* vScrollBar = nullptr;

    // Fetch state
    FetchState fetchState = Idle;
    std::string currentUrl;
    std::string pageTitle;
    std::string errorMessage;

    // Async fetch via popen
    FILE* fetchPipe = nullptr;
    std::string fetchBuffer;
    TTimerId pollTimerId {0};

    void startFetch(const std::string& url);
    void finishFetch();
    void cancelFetch();
    void startPollTimer();
    void stopPollTimer();

    // History
    std::vector<std::string> urlHistory;
    int historyIndex = -1;
    void navigateBack();
    void navigateForward();
    void pushHistory(const std::string& url);

    // URL input dialog
    void promptForUrl();
    void cycleImageMode();

    // JSON parsing (reuses extractJsonStringField pattern)
    static std::string extractJsonStringField(const std::string& json, const std::string& key);

    // Draw helpers
    void drawUrlBar();
    void drawStatusBar();
    void drawKeyHints();

    // Render mode state
    std::string imageMode {"key-inline"};
};

// Factory function
TWindow* createBrowserWindow(const TRect& bounds);

#endif // BROWSER_VIEW_H
