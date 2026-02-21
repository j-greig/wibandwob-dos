/*---------------------------------------------------------*/
/*                                                         */
/*   wibwob_view.cpp - Wib&Wob AI Chat Interface          */
/*   Split Architecture: MessageView + InputView           */
/*                                                         */
/*---------------------------------------------------------*/

#include "wibwob_view.h"
#include "wibwob_engine.h"
#include "llm/providers/claude_code_sdk_provider.h"  // For SDK streaming
#include "llm/providers/claude_code_provider.h"      // For CLI streaming
#include "llm/base/path_search.h"

#define Uses_TKeys
#define Uses_TDrawBuffer
#define Uses_TColorAttr
#define Uses_TTimerEvent
#define Uses_MsgBox
#define Uses_TWindow
#define Uses_TFrame
#include <tvision/tv.h>

#include <ctime>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <fstream>
#include <random>
#include <sys/stat.h>
#include <iterator>
#include <thread>
#include <thread>

/*---------------------------------------------------------*/
/*  TWibWobMessageView Implementation                      */
/*---------------------------------------------------------*/

TWibWobMessageView::TWibWobMessageView(const TRect& bounds, TScrollBar* hScroll, TScrollBar* vScroll)
    : TScroller(bounds, hScroll, vScroll)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable;
}

void TWibWobMessageView::draw() {
    TDrawBuffer buf;
    TColorAttr normalColor = getColor(1);
    TColorAttr errorColor = getColor(4);

    int totalLines = static_cast<int>(wrappedLines.size());

    for (int y = 0; y < size.y; y++) {
        int lineIdx = delta.y + y;

        buf.moveChar(0, ' ', normalColor, size.x);

        if (lineIdx >= 0 && lineIdx < totalLines) {
            const auto& wl = wrappedLines[lineIdx];
            TColorAttr msgColor = wl.is_error ? errorColor : normalColor;
            buf.moveStr(0, wl.text.c_str(), msgColor);
        }

        writeLine(0, y, size.x, 1, buf);
    }
}

void TWibWobMessageView::changeBounds(const TRect& bounds) {
    TScroller::changeBounds(bounds);
    rebuildWrappedLines();
}

void TWibWobMessageView::addMessage(const std::string& sender, const std::string& content, bool is_error) {
    ChatMessage msg;
    msg.sender = sender;
    msg.content = content;
    msg.is_error = is_error;

    // Get timestamp
    std::time_t now = std::time(nullptr);
    std::tm* local = std::localtime(&now);
    std::ostringstream oss;
    oss << std::put_time(local, "%H:%M:%S");
    msg.timestamp = oss.str();

    messages.push_back(msg);
    rebuildWrappedLines();
    scrollToBottom();
    drawView();
}

void TWibWobMessageView::clear() {
    messages.clear();
    wrappedLines.clear();
    scrollTo(0, 0);
    setLimit(size.x, 0);
    drawView();
}

void TWibWobMessageView::scrollToBottom() {
    int maxY = std::max(0, limit.y - size.y);
    scrollTo(0, maxY);
}

void TWibWobMessageView::scrollToTop() {
    scrollTo(0, 0);
}

void TWibWobMessageView::scrollLineUp() {
    int newY = std::max(0, delta.y - 1);
    scrollTo(delta.x, newY);
}

void TWibWobMessageView::scrollLineDown() {
    int maxY = std::max(0, limit.y - size.y);
    int newY = std::min(maxY, delta.y + 1);
    scrollTo(delta.x, newY);
}

void TWibWobMessageView::scrollPageUp() {
    int newY = std::max(0, delta.y - size.y);
    scrollTo(delta.x, newY);
}

void TWibWobMessageView::scrollPageDown() {
    int maxY = std::max(0, limit.y - size.y);
    int newY = std::min(maxY, delta.y + size.y);
    scrollTo(delta.x, newY);
}

// Streaming message methods
void TWibWobMessageView::startStreamingMessage(const std::string& sender) {
    if (isReceivingStream) {
        finishStreamingMessage(); // Finish any existing stream
    }

    ChatMessage msg;
    msg.sender = sender;
    msg.content = "";
    msg.is_error = false;
    msg.is_streaming = true;
    msg.is_complete = false;

    // Get timestamp
    std::time_t now = std::time(nullptr);
    std::tm* local = std::localtime(&now);
    std::ostringstream oss;
    oss << std::put_time(local, "%H:%M:%S");
    msg.timestamp = oss.str();

    messages.push_back(msg);
    streamingMessageIndex = messages.size() - 1;
    isReceivingStream = true;
    lastStreamUpdate = std::chrono::steady_clock::now();

    // Auto-scroll to show new message
    scrollToBottom();
}

void TWibWobMessageView::appendToStreamingMessage(const std::string& content) {
    if (!isReceivingStream || streamingMessageIndex >= messages.size()) {
        return;
    }

    messages[streamingMessageIndex].content += content;
    lastStreamUpdate = std::chrono::steady_clock::now();

    // Trigger incremental redraw
    rebuildWrappedLines();
    scrollToBottom();
    drawView();
}

void TWibWobMessageView::finishStreamingMessage() {
    if (!isReceivingStream || streamingMessageIndex >= messages.size()) {
        return;
    }

    messages[streamingMessageIndex].is_streaming = false;
    messages[streamingMessageIndex].is_complete = true;

    isReceivingStream = false;
    rebuildWrappedLines();
    drawView();
}

void TWibWobMessageView::cancelStreamingMessage() {
    if (!isReceivingStream || streamingMessageIndex >= messages.size()) {
        return;
    }

    // Remove the incomplete streaming message
    messages.erase(messages.begin() + streamingMessageIndex);
    isReceivingStream = false;
    rebuildWrappedLines();
    drawView();
}

void TWibWobMessageView::rebuildWrappedLines() {
    wrappedLines.clear();

    for (const auto& msg : messages) {
        std::string displayText = msg.sender + ": " + msg.content;
        auto wrapped = wrapText(displayText, size.x > 0 ? size.x : 80);
        for (const auto& line : wrapped) {
            wrappedLines.push_back({line, msg.sender, msg.is_error});
        }
    }

    setLimit(size.x, static_cast<int>(wrappedLines.size()));

    // Force scrollbar to redraw with new limits
    if (vScrollBar)
        vScrollBar->drawView();
}

std::vector<std::string> TWibWobMessageView::wrapText(const std::string& text, int width) const {
    std::vector<std::string> lines;
    if (width <= 0) {
        lines.emplace_back("");
        return lines;
    }

    size_t lineStart = 0;
    const size_t length = text.size();

    while (lineStart <= length) {
        size_t newlinePos = text.find('\n', lineStart);
        std::string segment;
        if (newlinePos == std::string::npos) {
            segment = text.substr(lineStart);
        } else {
            segment = text.substr(lineStart, newlinePos - lineStart);
        }

        if (!segment.empty() && segment.back() == '\r') {
            segment.pop_back();
        }

        if (segment.empty()) {
            lines.emplace_back("");
        } else {
            size_t pos = 0;
            while (pos < segment.size()) {
                size_t remaining = segment.size() - pos;
                size_t slice = remaining > static_cast<size_t>(width) ? static_cast<size_t>(width) : remaining;
                bool trimmedSpace = false;

                if (remaining > static_cast<size_t>(width)) {
                    size_t breakPos = segment.find_last_of(" \t", pos + width - 1);
                    if (breakPos != std::string::npos && breakPos >= pos) {
                        size_t candidate = breakPos - pos;
                        if (candidate > 0) {
                            slice = candidate;
                            trimmedSpace = true;
                        }
                    }
                }

                lines.push_back(segment.substr(pos, slice));
                pos += slice;

                if (trimmedSpace) {
                    while (pos < segment.size() && segment[pos] == ' ') {
                        ++pos;
                    }
                }
            }
        }

        if (newlinePos == std::string::npos) {
            break;
        }

        lineStart = newlinePos + 1;
        if (lineStart == length) {
            lines.emplace_back("");
            break;
        }
    }

    if (lines.empty()) {
        lines.emplace_back("");
    }

    return lines;
}

/*---------------------------------------------------------*/
/*  TWibWobInputView Implementation                        */
/*---------------------------------------------------------*/

TWibWobInputView::TWibWobInputView(const TRect& bounds)
    : TView(bounds)
{
    options |= ofSelectable;
    growMode = gfGrowHiX | gfGrowLoY;  // Stick to bottom
    eventMask |= evKeyDown | evBroadcast;
    statusText = "Type a message and press Enter";

    // Prompt starts visible; timer is started on focus.
    promptVisible = true;
}

TWibWobInputView::~TWibWobInputView() {
    stopSpinner();
    if (promptTimerId) {
        killTimer(promptTimerId);
        promptTimerId = nullptr;
    }
}

void TWibWobInputView::draw() {
    drawStatus();
    drawInputLine();
}

void TWibWobInputView::drawStatus() {
    TDrawBuffer buf;
    TColorAttr statusColor = getColor(5);

    buf.moveChar(0, ' ', statusColor, size.x);

    std::string status;
    if (showSpinner) {
        const char spinnerChars[] = {'|', '/', '-', '\\'};
        char spinnerChar = spinnerChars[spinnerFrame % 4];
        status = "[" + statusText + " " + spinnerChar + "]";
    } else {
        status = "[" + statusText + "]";
    }

    if (status.length() > (size_t)size.x) {
        status = status.substr(0, size.x - 3) + "...";
    }
    buf.moveStr(0, status.c_str(), statusColor);
    writeLine(0, 0, size.x, 1, buf);  // Status on line 0
}

void TWibWobInputView::drawInputLine() {
    TDrawBuffer buf;
    TColorAttr inputColor = (state & sfFocused) ? getColor(6) : getColor(1);

    buf.moveChar(0, ' ', inputColor, size.x);

    // Blink a double-arrow prompt for better visibility when focused.
    std::string prompt = promptVisible ? ">> " : "   ";
    std::string display = prompt + currentInput;

    if (display.length() > (size_t)size.x) {
        display = display.substr(display.length() - size.x);
    }

    buf.moveStr(0, display.c_str(), inputColor);

    // Show cursor if focused and input enabled
    if ((state & sfFocused) && inputEnabled) {
        int cursorPos = std::min((int)display.length(), size.x - 1);
        if (cursorPos < (int)display.length()) {
            buf.moveChar(cursorPos, display[cursorPos], inputColor | 0x80, 1);
        }
    }

    writeLine(0, 1, size.x, 1, buf);  // Input on line 1
}

void TWibWobInputView::handleEvent(TEvent& event) {
    TView::handleEvent(event);

    // Allow scrolling the message view even while the input owns focus.
    if (event.what == evKeyDown) {
        if (auto* chatWin = dynamic_cast<TWibWobWindow*>(owner)) {
            if (auto* msgView = chatWin->getMessageView()) {
                switch (event.keyDown.keyCode) {
                    case kbUp:
                        msgView->scrollLineUp();
                        clearEvent(event);
                        return;
                    case kbDown:
                        msgView->scrollLineDown();
                        clearEvent(event);
                        return;
                    case kbPgUp:
                        msgView->scrollPageUp();
                        clearEvent(event);
                        return;
                    case kbPgDn:
                        msgView->scrollPageDown();
                        clearEvent(event);
                        return;
                    case kbHome:
                        msgView->scrollToTop();
                        clearEvent(event);
                        return;
                    case kbEnd:
                        msgView->scrollToBottom();
                        clearEvent(event);
                        return;
                    default:
                        break;
                }
            }
        }
    }

    if (event.what == evKeyDown && inputEnabled) {
        switch (event.keyDown.keyCode) {
            case kbEnter:
                if (!currentInput.empty() && onSubmit) {
                    std::string input = currentInput;
                    currentInput.clear();
                    onSubmit(input);
                }
                clearEvent(event);
                drawView();
                break;

            case kbBack:
                if (!currentInput.empty()) {
                    currentInput.pop_back();
                    drawView();
                }
                clearEvent(event);
                break;

            case kbEsc:
                // ESC handled by window for cancel
                break;

            default:
                if (event.keyDown.charScan.charCode >= 32 &&
                    event.keyDown.charScan.charCode < 127) {
                    currentInput += (char)event.keyDown.charScan.charCode;
                    drawView();
                    clearEvent(event);
                }
                break;
        }
    } else if (event.what == evBroadcast && event.message.command == cmTimerExpired) {
        if (event.message.infoPtr == spinnerTimerId) {
            updateSpinner();
            clearEvent(event);
        } else if (event.message.infoPtr == promptTimerId) {
            if (state & sfFocused) {
                promptVisible = !promptVisible;
            } else {
                // If we lost focus but timer still exists, stop blinking and reset.
                promptVisible = true;
                killTimer(promptTimerId);
                promptTimerId = nullptr;
            }
            drawView();
            clearEvent(event);
        }
    }
}

void TWibWobInputView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if (aState & sfFocused) {
        // Always reset prompt visible on focus transitions, then redraw.
        promptVisible = true;
        if (enable) {
            if (!promptTimerId) {
                // Start the prompt timer only after the view is owned/inserted.
                promptTimerId = setTimer(500, 500);
            }
        } else {
            if (promptTimerId) {
                killTimer(promptTimerId);
                promptTimerId = nullptr;
            }
        }
        drawView();
    }
}

void TWibWobInputView::setStatus(const std::string& status) {
    statusText = status;
    drawView();
}

void TWibWobInputView::startSpinner() {
    // Spinner disabled (synchronous request path).
}

void TWibWobInputView::stopSpinner() {
    // Spinner disabled (synchronous request path).
}

void TWibWobInputView::updateSpinner() {
    // Spinner disabled (synchronous request path).
}

/*---------------------------------------------------------*/
/*  TWibWobWindow Implementation                           */
/*---------------------------------------------------------*/

TWibWobWindow::TWibWobWindow(const TRect& bounds, const std::string& title)
    : TWindow(bounds, title.c_str(), wnNoNumber)
    , TWindowInit(&TWibWobWindow::initFrame)
    , baseTitle(title)
{
    options |= ofTileable;
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evKeyDown | evBroadcast;

    TRect client = getExtent();
    client.grow(-1, -1);

    // Split: message pane on top, input at bottom
    TRect msgPaneRect = client;
    msgPaneRect.b.y -= 2;  // Leave 2 rows for input

    messagePane = new TGroup(msgPaneRect);
    messagePane->growMode = gfGrowHiX | gfGrowHiY;
    insert(messagePane);

    // Input view: 2 lines at bottom (status + input)
    TRect inputRect = client;
    inputRect.a.y = inputRect.b.y - 2;
    inputView = new TWibWobInputView(inputRect);
    inputView->growMode = gfGrowHiX | gfGrowLoY | gfGrowHiY;
    insert(inputView);

    // Inside the message pane: dedicated scrollbar and scroller
    TRect paneBounds = messagePane->getExtent();
    paneBounds.move(-paneBounds.a.x, -paneBounds.a.y);

    TRect sbRect = paneBounds;
    sbRect.a.x = sbRect.b.x - 1;
    vScrollBar = new TScrollBar(sbRect);
    vScrollBar->options |= ofPostProcess; // Allow keyboard to reach the bar (sbHandleKeyboard equivalent)
    vScrollBar->growMode = gfGrowLoX | gfGrowHiX | gfGrowHiY;
    messagePane->insert(vScrollBar);

    TRect msgRect = paneBounds;
    msgRect.b.x -= 1;
    messageView = new TWibWobMessageView(msgRect, nullptr, vScrollBar);
    messageView->growMode = gfGrowHiX | gfGrowHiY;
    messagePane->insert(messageView);

    // Set up input callback
    inputView->onSubmit = [this](const std::string& input) {
        processUserInput(input);
    };

    // Focus the input view by default
    inputView->select();
}

TWibWobWindow::~TWibWobWindow() {
    // Mark dead FIRST so any in-flight stream callback bails out immediately
    // rather than touching child views that may be mid-teardown.
    windowAlive_.store(false);
    if (pollTimerId) {
        killTimer(pollTimerId);
        pollTimerId = nullptr;
    }
    delete engine;
}

void TWibWobWindow::handleEvent(TEvent& event) {
    TWindow::handleEvent(event);

    // Handle ESC for cancel
    if (event.what == evKeyDown && event.keyDown.keyCode == kbEsc) {
        ensureEngineInitialized();
        if (engine && engine->isBusy()) {
            engine->cancel();
            inputView->setStatus("Request cancelled - Type a message and press Enter");
            inputView->setInputEnabled(true);
            inputView->stopSpinner();
            clearEvent(event);
        }
    }

    // Poll engine on timer broadcasts
    if (event.what == evBroadcast && event.message.command == cmTimerExpired) {
        if (event.message.infoPtr == pollTimerId && engineInitialized && engine) {
            engine->poll();
        }
    }
}

void TWibWobWindow::ensureEngineInitialized() {
    if (!engineInitialized) {
        // Initialize logging first
        if (logFilePath.empty()) {
            initializeLogging();
        }

        engine = new WibWobEngine();

        // Ensure we poll providers frequently (some providers rely on poll() to read subprocess output).
        if (!pollTimerId) {
            pollTimerId = setTimer(50, 50);
        }

        // Inject runtime API key only when anthropic_api is the active provider.
        // Do not switch providers implicitly here: chat MCP tool execution relies
        // on claude_code_sdk/claude_code paths.
        {
            extern std::string getAppRuntimeApiKey();
            std::string rtKey = getAppRuntimeApiKey();
            if (!rtKey.empty()) {
                std::string activeProvider = engine->getCurrentProvider();
                if (activeProvider == "anthropic_api") {
                    engine->setApiKey(rtKey);
                    fprintf(stderr, "DEBUG: Injected runtime API key into anthropic_api provider\n");
                } else {
                    fprintf(stderr, "DEBUG: Runtime API key present; keeping active provider '%s'\n",
                            activeProvider.c_str());
                }
            }
        }

        // Load system prompt from file.
        // Important: app is commonly launched from either repo root OR build/app; search upward.
        const std::vector<std::string> promptCandidates = {
            "modules-private/wibwob-prompts/wibandwob.prompt.md",
            "modules/wibwob-prompts/wibandwob.prompt.md",
            "wibandwob.prompt.md",
            "app/wibandwob.prompt.md",
            "test-tui/wibandwob.prompt.md",
            "app/test-tui/wibandwob.prompt.md",
        };

        const std::string loadedPath = ww_find_first_existing_upwards(promptCandidates, 6);
        std::ifstream promptFile;
        if (!loadedPath.empty()) {
            promptFile.open(loadedPath);
        }

        if (promptFile.is_open() && !loadedPath.empty()) {
            std::string customPrompt((std::istreambuf_iterator<char>(promptFile)),
                                   std::istreambuf_iterator<char>());
            promptFile.close();

            engine->setSystemPrompt(customPrompt);
            messageView->addMessage("System", "Step into WibWobWorld, human.");
            logMessage("System", "Loaded custom prompt from " + loadedPath);
        } else {
            engine->setSystemPrompt(
                "You are wib&wob, a dual-minded artist/scientist AI assistant integrated into a Turbo Vision TUI application. "
                "Respond as both Wib (chaotic, artistic) and Wob (precise, scientific). "
                "Help with TVision framework, C++ development, and creative projects. "
                "Use British English and maintain your distinctive personalities."
            );
            messageView->addMessage("Wib", "Wotcher! I'm wib&wob, your AI assistant for this TVision app. (Note: wibandwob.prompt.md not found - using fallback prompt)");
        }

        inputView->setStatus("Ready - Type a message and press Enter");
        logMessage("System", "Chat engine initialized (provider loads on first send)");

        engineInitialized = true;
    }
}

void TWibWobWindow::processUserInput(const std::string& input) {
    ensureEngineInitialized();

    if (input.empty() || engine->isBusy()) {
        return;
    }

    // Handle slash commands
    if (input == "/clear") {
        messageView->clear();
        messageView->addMessage("System", "Chat cleared");
        return;
    }

    if (input == "/model") {
        std::string providerInfo = "Provider: " + engine->getCurrentProvider() +
                                   "\nModel: " + engine->getCurrentModel();
        messageView->addMessage("System", providerInfo);
        return;
    }

    if (input == "/help") {
        std::string helpText = "Available commands:\n"
                              "/clear - Clear chat history\n"
                              "/model - Show current provider and model\n"
                              "/export [filename] - Export chat to text file\n"
                              "/help - Show this help message";
        messageView->addMessage("System", helpText);
        return;
    }

    // Handle /export command with optional filename
    if (input == "/export" || input.substr(0, 8) == "/export ") {
        std::string filename;
        if (input.length() > 8) {
            filename = input.substr(8);
            // Trim leading/trailing whitespace
            size_t start = filename.find_first_not_of(" \t");
            size_t end = filename.find_last_not_of(" \t");
            if (start != std::string::npos) {
                filename = filename.substr(start, end - start + 1);
            }
        }
        exportChat(filename);
        return;
    }

    // Add user message
    messageView->addMessage("User", input);
    logMessage("User", input);

    // Set status and start spinner
    static const char* statusOptions[] = {
        "Wibbling ...", "Wobbling ...", "Scrambling ...",
        "Reticulating ...", "Whizzing ...", "Puttering ..."
    };
    std::string statusMsg = statusOptions[rand() % (sizeof(statusOptions) / sizeof(statusOptions[0]))];
    inputView->setStatus(statusMsg);
    inputView->setInputEnabled(false);

    // Log provider info
    // If anthropic_api provider is active and has no key, prompt user
    if (engine->getCurrentProvider() == "anthropic_api" && engine->needsApiKey()) {
        messageView->addMessage("System",
            "No API key set. Use Tools > API Key to enter your Anthropic key.");
        inputView->setStatus("API key required - see Tools menu");
        return;
    }

    logMessage("System", "Using provider: " + engine->getCurrentProvider() + ", model: " + engine->getCurrentModel());

    auto start = std::chrono::steady_clock::now();

    // Streaming callback - shared between SDK and CLI providers
    auto streamCallback = [this, start](const StreamChunk& chunk) {
        // Guard: if the window is being destroyed, bail immediately.
        // The streaming thread may still be running when ~TWibWobWindow fires;
        // touching child views after they are deleted causes use-after-free crashes.
        if (!windowAlive_.load()) return;

        // Log all chunks for debugging
        std::string chunkType;
        switch (chunk.type) {
            case StreamChunk::CONTENT_DELTA: chunkType = "CONTENT_DELTA"; break;
            case StreamChunk::MESSAGE_COMPLETE: chunkType = "MESSAGE_COMPLETE"; break;
            case StreamChunk::ERROR_OCCURRED: chunkType = "ERROR_OCCURRED"; break;
            case StreamChunk::SESSION_UPDATE: chunkType = "SESSION_UPDATE"; break;
            default: chunkType = "UNKNOWN"; break;
        }
        logMessage("Stream", "[chunk] type=" + chunkType +
                  " content_len=" + std::to_string(chunk.content.length()) +
                  (chunk.content.empty() ? "" : " content=" + chunk.content) +
                  (chunk.error_message.empty() ? "" : " err=" + chunk.error_message));

        if (chunk.type == StreamChunk::CONTENT_DELTA) {
            messageView->appendToStreamingMessage(chunk.content);
            inputView->setStatus("Streaming...");

        } else if (chunk.type == StreamChunk::MESSAGE_COMPLETE) {
            auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now() - start);

            messageView->finishStreamingMessage();
            speakResponse(chunk.content);
            inputView->setInputEnabled(true);
            inputView->setStatus("Ready (" + std::to_string(duration.count()) +
                                "ms) - Type a message and press Enter");
            logMessage("Wib&Wob", "[streaming complete]");
            select();

        } else if (chunk.type == StreamChunk::ERROR_OCCURRED) {
            messageView->cancelStreamingMessage();
            messageView->addMessage("System", "Error: " + chunk.error_message, true);
            logMessage("System", "Streaming error: " + chunk.error_message, true);
            inputView->setInputEnabled(true);
            inputView->setStatus("Error - Try again");
            select();
        }
    };

    // Try providers in order: SDK (needs API key) → CLI (uses OAuth) → fallback
    ILLMProvider* provider = engine->getCurrentProviderPtr();
    bool streamingStarted = false;

    // Try SDK provider first (if API key present)
    auto* sdkProvider = dynamic_cast<ClaudeCodeSDKProvider*>(provider);
    if (sdkProvider && sdkProvider->isAvailable()) {
        logMessage("Stream", "[streaming] Trying SDK provider...");
        messageView->startStreamingMessage("Wib&Wob");
        // Pass system prompt for auto-session-start
        streamingStarted = sdkProvider->sendStreamingQuery(input, streamCallback, engine->getSystemPrompt());
        logMessage("Stream", "[streaming] SDK sendStreamingQuery: " + std::string(streamingStarted ? "started" : "failed"));
    }

    // Try CLI provider (uses OAuth, no API key needed)
    if (!streamingStarted) {
        auto* cliProvider = dynamic_cast<ClaudeCodeProvider*>(provider);
        if (cliProvider && cliProvider->isAvailable()) {
            logMessage("Stream", "[streaming] Trying CLI provider...");
            if (!sdkProvider) {  // Only start message if SDK didn't already
                messageView->startStreamingMessage("Wib&Wob");
            }
            streamingStarted = cliProvider->sendStreamingQuery(input, streamCallback, engine->getSystemPrompt());
            logMessage("Stream", "[streaming] CLI sendStreamingQuery: " + std::string(streamingStarted ? "started" : "failed"));
        }
    }

    // Fall back to non-streaming if neither worked
    if (!streamingStarted) {
        logMessage("Stream", "[streaming] No streaming provider available, using fallback");
        messageView->cancelStreamingMessage();
        fallbackToRegularQuery(input, start);
    }
}

void TWibWobWindow::fallbackToRegularQuery(const std::string& input,
                                           std::chrono::steady_clock::time_point start) {
    engine->sendQuery(input, [this, start](const ClaudeResponse& response) {
        auto end = std::chrono::steady_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);

        inputView->setInputEnabled(true);

        if (response.is_error) {
            messageView->addMessage("System", "Error (" + std::to_string(duration.count()) + "ms): " + response.error_message, true);
            logMessage("System", "Error: " + response.error_message, true);
            inputView->setStatus("Error - Try again");
        } else {
            logMessage("Debug", "Response length: " + std::to_string(response.result.length()) + " chars");
            logMessage("Debug", "Provider: " + response.provider_name + ", Model: " + response.model_used);

            messageView->addMessage("Wib&Wob", response.result);
            logMessage("Wib&Wob", response.result);
            inputView->setStatus("Ready (" + std::to_string(duration.count()) + "ms) - Type a message and press Enter");
        }

        // Bring window back to front after response
        select();
    });
}

void TWibWobWindow::changeBounds(const TRect& bounds) {
    TWindow::changeBounds(bounds);

    TRect client = getExtent();
    client.grow(-1, -1);

    if (messagePane) {
        TRect msgPaneRect = client;
        msgPaneRect.b.y -= 2;
        messagePane->changeBounds(msgPaneRect);
        layoutMessagePaneChildren();
    }

    if (inputView) {
        TRect inputRect = client;
        inputRect.a.y = inputRect.b.y - 2;  // Bottom 2 rows
        inputView->changeBounds(inputRect);
    }

    redraw();
}

void TWibWobWindow::updateTitleWithSession(const std::string& sessId) {
    if (!sessId.empty()) {
        std::string shortId = sessId.length() > 8 ? sessId.substr(0, 8) : sessId;
        std::string newTitle = baseTitle + " [" + shortId + "]";

        if (frame) {
            delete[] (char*)title;
            title = newStr(newTitle.c_str());
            frame->drawView();
        }
    }
}

void TWibWobWindow::initializeLogging() {
    sessionId = generateSessionId();

    mkdir("logs", 0755);

    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    std::ostringstream ss;
    ss << "logs/chat_" << std::put_time(std::localtime(&time_t), "%Y%m%d_%H%M%S")
       << "_" << sessionId << ".log";
    logFilePath = ss.str();

    std::ofstream logFile(logFilePath, std::ios::app);
    if (logFile.is_open()) {
        logFile << "=== WibWob Chat Session ===" << std::endl;
        logFile << "Session ID: " << sessionId << std::endl;
        logFile << "Started: " << getTimestamp() << std::endl;
        logFile << "Provider: [To be determined]" << std::endl;
        logFile << "============================" << std::endl;
        logFile.close();
    }
}

void TWibWobWindow::logMessage(const std::string& sender, const std::string& content, bool is_error) {
    if (logFilePath.empty()) return;

    std::ofstream logFile(logFilePath, std::ios::app);
    if (logFile.is_open()) {
        std::string timestamp = getTimestamp();
        std::string status = is_error ? " [ERROR]" : "";

        logFile << "[" << timestamp << "] " << sender << status << ": " << content << std::endl;

        if (is_error) {
            logFile << "    ^^ Error occurred during message processing" << std::endl;
        }

        logFile.close();
    }
}

std::string TWibWobWindow::generateSessionId() const {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(100000, 999999);
    return std::to_string(dis(gen));
}

std::string TWibWobWindow::getTimestamp() const {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()) % 1000;

    std::ostringstream ss;
    ss << std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S");
    ss << "." << std::setfill('0') << std::setw(3) << ms.count();
    return ss.str();
}

std::string TWibWobWindow::getCurrentTime() const {
    std::time_t now = std::time(nullptr);
    std::tm* local = std::localtime(&now);

    std::ostringstream oss;
    oss << std::put_time(local, "%H:%M:%S");
    return oss.str();
}

// ---------- TTS helpers ----------
namespace {
    const bool kTtsEnabled = true;
    const int kTtsRate = 205; // 0 = default rate
    const char* kVoiceWib = "Sandy";
    const char* kVoiceWob = "Grandpa";

    std::string escapeForShell(const std::string& text) {
        // Escape single quotes for sh: 'foo' -> 'foo'\''bar'
        std::string out;
        out.reserve(text.size() + 8);
        for (char c : text) {
            if (c == '\'') {
                out += "'\"'\"'";
            } else {
                out.push_back(c);
            }
        }
        return out;
    }
}

std::string TWibWobWindow::filterTextForSpeech(const std::string& text) {
    std::istringstream iss(text);
    std::string line;
    std::ostringstream out;
    bool inFence = false;

    while (std::getline(iss, line)) {
        std::string trimmed = line;
        while (!trimmed.empty() && std::isspace((unsigned char)trimmed.front())) trimmed.erase(trimmed.begin());
        while (!trimmed.empty() && std::isspace((unsigned char)trimmed.back())) trimmed.pop_back();

        if (trimmed.rfind("```", 0) == 0 || trimmed.rfind("---", 0) == 0) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        if (line.size() > 120) continue;
        int alphaNum = 0;
        for (char c : line) {
            if (std::isalnum((unsigned char)c)) alphaNum++;
        }
        if (!line.empty() && (alphaNum < (int)(line.size() * 0.3))) continue;

        if (!line.empty()) {
            out << line << "\n";
        }
    }
    return out.str();
}

void TWibWobWindow::speakResponse(const std::string& text) {
    if (!kTtsEnabled) return;
    std::string filtered = filterTextForSpeech(text);
    if (filtered.empty()) return;

    const std::string wibTag = "つ◕‿◕‿⚆༽つ";
    const std::string wobTag = "つ⚆‿◕‿◕༽つ";

    std::istringstream iss(filtered);
    std::string line;
    std::vector<std::pair<std::string, std::string>> segments;

    while (std::getline(iss, line)) {
        std::string voice = kVoiceWob;
        std::string content = line;
        if (line.find(wibTag) != std::string::npos) {
            voice = kVoiceWib;
            auto pos = content.find(wibTag);
            if (pos != std::string::npos) content.erase(pos, wibTag.size());
        } else if (line.find(wobTag) != std::string::npos) {
            voice = kVoiceWob;
            auto pos = content.find(wobTag);
            if (pos != std::string::npos) content.erase(pos, wobTag.size());
        }
        while (!content.empty() && std::isspace((unsigned char)content.front())) content.erase(content.begin());
        while (!content.empty() && std::isspace((unsigned char)content.back())) content.pop_back();
        if (!content.empty()) {
            segments.push_back({voice, content});
        }
    }

    if (segments.empty()) return;

    std::thread([segments]() {
        for (const auto& seg : segments) {
            std::string escaped = escapeForShell(seg.second);
            std::ostringstream cmd;
            cmd << "say -v \"" << seg.first << "\" ";
            if (kTtsRate > 0) cmd << "-r " << kTtsRate << " ";
            cmd << "-- '" << escaped << "'";
            // Run sequentially inside this background thread (no overlap between Wib/Wob lines)
            std::system(cmd.str().c_str());
            // Small gap between lines to avoid rushing
            std::this_thread::sleep_for(std::chrono::milliseconds(150));
        }
    }).detach();
}

TFrame* TWibWobWindow::initFrame(TRect r) {
    return new TFrame(r);
}

void TWibWobWindow::layoutMessagePaneChildren() {
    if (!messagePane)
        return;

    TRect paneBounds = messagePane->getExtent();
    paneBounds.move(-paneBounds.a.x, -paneBounds.a.y);

    if (vScrollBar) {
        TRect sbRect = paneBounds;
        sbRect.a.x = sbRect.b.x - 1;
        vScrollBar->changeBounds(sbRect);
    }

    if (messageView) {
        TRect msgRect = paneBounds;
        msgRect.b.x -= 1;
        messageView->changeBounds(msgRect);
    }
}

bool TWibWobWindow::exportChat(const std::string& filename) const {
    if (!messageView) {
        return false;
    }

    const auto& messages = messageView->getMessages();
    if (messages.empty()) {
        const_cast<TWibWobMessageView*>(messageView)->addMessage("System", "Nothing to export - chat is empty");
        return false;
    }

    // Generate filename if not provided
    std::string outPath = filename;
    if (outPath.empty()) {
        mkdir("exports", 0755);
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        std::ostringstream ss;
        ss << "exports/chat_" << std::put_time(std::localtime(&time_t), "%Y%m%d_%H%M%S") << ".txt";
        outPath = ss.str();
    }

    std::ofstream outFile(outPath);
    if (!outFile.is_open()) {
        const_cast<TWibWobMessageView*>(messageView)->addMessage("System", "Failed to create file: " + outPath, true);
        return false;
    }

    // Write header
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    outFile << "=== Wib&Wob Chat Export ===" << std::endl;
    outFile << "Exported: " << std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S") << std::endl;
    outFile << "Messages: " << messages.size() << std::endl;
    outFile << "===========================" << std::endl << std::endl;

    // Write each message in clean format
    for (const auto& msg : messages) {
        // Skip streaming messages that never completed
        if (msg.is_streaming && !msg.is_complete) {
            continue;
        }

        outFile << "[" << msg.timestamp << "] " << msg.sender << ":";

        // Handle multi-line content - indent continuation lines
        std::istringstream contentStream(msg.content);
        std::string line;
        bool firstLine = true;
        while (std::getline(contentStream, line)) {
            if (firstLine) {
                outFile << " " << line << std::endl;
                firstLine = false;
            } else {
                outFile << "    " << line << std::endl;
            }
        }
        if (firstLine) {
            outFile << std::endl;
        }
        outFile << std::endl;
    }

    outFile.close();

    const_cast<TWibWobMessageView*>(messageView)->addMessage("System", "Chat exported to: " + outPath);
    return true;
}

TWindow* createWibWobWindow(const TRect& bounds, const std::string& title) {
    return new TWibWobWindow(bounds, title);
}
