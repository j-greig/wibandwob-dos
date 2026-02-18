/*---------------------------------------------------------*/
/*                                                         */
/*   wibwob_view.h - Wib&Wob AI Chat Interface            */
/*   Split Architecture: MessageView + InputView           */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef WIBWOB_VIEW_H
#define WIBWOB_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TEvent
#define Uses_TKeys
#define Uses_TDrawBuffer
#define Uses_TWindow
#define Uses_TFrame
#define Uses_TScrollBar
#define Uses_TScroller
#define Uses_TGroup
#include <tvision/tv.h>

#include <string>
#include <vector>
#include <functional>
#include <chrono>

// Forward declarations
class WibWobEngine;
class TWibWobWindow;

struct ChatMessage {
    std::string sender;  // "User" or "Wib"
    std::string content;
    std::string timestamp;
    bool is_error = false;
    bool is_streaming = false;
    bool is_complete = true;
};

/*---------------------------------------------------------*/
/*  TWibWobMessageView - Scrollable message display        */
/*  Extends TScroller for proper scroll handling           */
/*---------------------------------------------------------*/
class TWibWobMessageView : public TScroller {
public:
    TWibWobMessageView(const TRect& bounds, TScrollBar* hScroll, TScrollBar* vScroll);

    virtual void draw() override;
    virtual void changeBounds(const TRect& bounds) override;

    // Message operations
    void addMessage(const std::string& sender, const std::string& content, bool is_error = false);
    void clear();
    void scrollToBottom();
    void scrollToTop();
    void scrollLineUp();
    void scrollLineDown();
    void scrollPageUp();
    void scrollPageDown();

    // Streaming operations
    void startStreamingMessage(const std::string& sender);
    void appendToStreamingMessage(const std::string& content);
    void finishStreamingMessage();
    void cancelStreamingMessage();

    // Access for window
    const std::vector<ChatMessage>& getMessages() const { return messages; }

private:
    struct WrappedLine {
        std::string text;
        std::string sender;
        bool is_error;
    };

    std::vector<ChatMessage> messages;
    std::vector<WrappedLine> wrappedLines;

    // Streaming state
    bool isReceivingStream = false;
    size_t streamingMessageIndex = 0;
    std::chrono::steady_clock::time_point lastStreamUpdate;

    void rebuildWrappedLines();
    std::vector<std::string> wrapText(const std::string& text, int width) const;
};

/*---------------------------------------------------------*/
/*  TWibWobInputView - Fixed input area at bottom          */
/*  Simple TView for status + input line                   */
/*---------------------------------------------------------*/
class TWibWobInputView : public TView {
public:
    TWibWobInputView(const TRect& bounds);
    virtual ~TWibWobInputView();

    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;
    virtual void setState(ushort aState, Boolean enable) override;

    // Input operations
    void setStatus(const std::string& status);
    std::string getCurrentInput() const { return currentInput; }
    void clearInput() { currentInput.clear(); }
    void setInputEnabled(bool enabled) { inputEnabled = enabled; }

    // Spinner control
    void startSpinner();
    void stopSpinner();

    // Callback when user submits input
    std::function<void(const std::string&)> onSubmit;

private:
    std::string currentInput;
    std::string statusText;
    bool inputEnabled = true;

    // Spinner animation
    bool showSpinner = false;
    int spinnerFrame = 0;
    void* spinnerTimerId = nullptr;

    // Prompt blink
    bool promptVisible = true;
    void* promptTimerId = nullptr;

    void drawStatus();
    void drawInputLine();
    void updateSpinner();
};

/*---------------------------------------------------------*/
/*  TWibWobWindow - Coordinates message + input views      */
/*  Owns the engine and logging                            */
/*---------------------------------------------------------*/
class TWibWobWindow : public TWindow {
public:
    TWibWobWindow(const TRect& bounds, const std::string& title);
    virtual ~TWibWobWindow();

    virtual void changeBounds(const TRect& bounds) override;
    virtual void handleEvent(TEvent& event) override;
    void updateTitleWithSession(const std::string& sessionId);

    // Public access to views for external control
    TWibWobMessageView* getMessageView() { return messageView; }
    TWibWobInputView* getInputView() { return inputView; }

private:
    static TFrame* initFrame(TRect r);

    TGroup* messagePane = nullptr;
    TWibWobMessageView* messageView = nullptr;
    TWibWobInputView* inputView = nullptr;
    TScrollBar* vScrollBar = nullptr;
    std::string baseTitle;

    // Engine
    WibWobEngine* engine = nullptr;
    bool engineInitialized = false;
    void* pollTimerId = nullptr;

    // Logging
    std::string sessionId;
    std::string logFilePath;

    void ensureEngineInitialized();
    void processUserInput(const std::string& input);
    void fallbackToRegularQuery(const std::string& input,
                                std::chrono::steady_clock::time_point start);
    void layoutMessagePaneChildren();

    // Logging
    void initializeLogging();
    void logMessage(const std::string& sender, const std::string& content, bool is_error = false);
    std::string generateSessionId() const;
    std::string getTimestamp() const;
    std::string getCurrentTime() const;

    // TTS
    void speakResponse(const std::string& text);
    std::string filterTextForSpeech(const std::string& text);

    // Export
    bool exportChat(const std::string& filename = "") const;
};

TWindow* createWibWobWindow(const TRect& bounds, const std::string& title);

#endif // WIBWOB_VIEW_H
