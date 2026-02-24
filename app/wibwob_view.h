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

#include <atomic>
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

    // Chat history (role-mapped, JSON-exportable for get_chat_history IPC)
    std::string getHistoryJson() const;

private:
    struct HistoryEntry {
        std::string role;     // "user" | "assistant" | "system"
        std::string content;
    };
    std::vector<HistoryEntry> chatHistory_;
    void recordHistoryMessage(const std::string& sender, const std::string& content, bool is_error);
    static std::string mapSenderToRole(const std::string& sender, bool is_error);
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

    // API: queue a user message to be processed when the engine is idle
    void injectUserMessage(const std::string& text) { pendingAsk_ = text; }

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
    // Set to false at the start of destruction before deleting engine.
    // Stream callbacks check this before touching any child views.
    std::atomic<bool> windowAlive_{true};

    // Logging
    std::string sessionId;
    std::string pendingAsk_;  // queued self-prompt, drained when engine idle
    bool speakNextUserMessage_ = false;  // TTS the self-prompted user message
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

    // TTS — incremental line-by-line speech during streaming
    void speakResponse(const std::string& text);         // legacy: speak full response at once
    void speakLine(const std::string& voice, const std::string& text);  // queue one line
    void ttsFlushPending();                               // flush partial line at end of turn
    void ttsAccumulateChunk(const std::string& delta);    // call during CONTENT_DELTA
    void ttsReset();                                      // call at start of new turn
    std::string filterTextForSpeech(const std::string& text);

    // TTS state for incremental speech
    std::string ttsAccumulator_;      // accumulates streamed text until newline
    std::string ttsActiveVoice_;      // current detected voice (Wib/Wob)

    // Export
    bool exportChat(const std::string& filename = "") const;
};

TWindow* createWibWobWindow(const TRect& bounds, const std::string& title);

#endif // WIBWOB_VIEW_H
