/*---------------------------------------------------------*/
/*                                                         */
/*   claude_code_sdk_provider.h - Claude Code SDK Provider*/
/*   Streaming mode with customSystemPrompt support       */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef CLAUDE_CODE_SDK_PROVIDER_H
#define CLAUDE_CODE_SDK_PROVIDER_H

#include "../base/illm_provider.h"
#include <string>
#include <memory>
#include <functional>
#include <thread>
#include <atomic>
#include <queue>
#include <mutex>
#include <condition_variable>

// Forward declarations for Node.js bridge
struct uv_loop_s;
struct uv_async_s;

// StreamChunk and StreamingCallback now in illm_provider.h

class ClaudeCodeSDKProvider : public ILLMProvider {
public:
    ClaudeCodeSDKProvider();
    virtual ~ClaudeCodeSDKProvider();
    
    // ILLMProvider implementation
    bool sendQuery(const LLMRequest& request, ResponseCallback callback) override;
    bool isAvailable() const override;
    bool isBusy() const override;
    void cancel() override;
    void poll() override;
    
    // Provider info
    std::string getProviderName() const override { return "claude_code_sdk"; }
    std::string getVersion() const override;
    std::vector<std::string> getSupportedModels() const override;
    
    // Configuration
    bool configure(const std::string& config) override;
    std::string getLastError() const override { return lastError; }
    
    // Session management
    void resetSession() override;
    
    // Tool support
    bool supportsTools() const override { return true; }
    void registerTool(const Tool& tool) override;
    void clearTools() override;

    // SDK-specific features
    bool startStreamingSession(const std::string& customSystemPrompt = "");
    bool sendStreamingQuery(const std::string& query, StreamingCallback streamCallback,
                            const std::string& systemPrompt = "");
    void endStreamingSession();
    bool hasActiveSession() const;
    
    // Real-time prompt modification
    bool updateSystemPrompt(const std::string& customSystemPrompt);
    std::string getCurrentSystemPrompt() const;
    
    // Session state
    std::string getSessionId() const override { return currentSessionId; }
    bool isStreamingActive() const { return streamingActive; }

private:
    // Session state
    bool streamingActive = false;
    bool sessionStarted = false;
    std::string currentSessionId;
    std::string currentSystemPrompt;
    std::string configuredModel = "haiku";  // Default to haiku
    std::string lastError;
    
    // Tool support
    std::vector<Tool> registeredTools;
    
    // Streaming state
    std::atomic<bool> busy{false};
    std::atomic<bool> shouldCancel{false};
    
    // Node.js bridge for SDK integration
    struct NodeBridge;
    std::unique_ptr<NodeBridge> nodeBridge;
    
    // Message queue for streaming
    std::queue<StreamChunk> streamQueue;
    std::mutex queueMutex;
    std::condition_variable queueCondition;
    
    // Background processing
    std::unique_ptr<std::thread> processingThread;
    std::atomic<bool> processingActive{false};
    
    // Callbacks
    StreamingCallback activeStreamCallback;
    ResponseCallback activeFallbackCallback;
    
    // SDK Integration
    bool initializeSDK();
    void shutdownSDK();
    bool createStreamingSession(const std::string& customSystemPrompt);
    bool sendToStreamingSession(const std::string& query);
    
    // Node.js bridge methods
    bool startNodeBridge();
    void stopNodeBridge();
    bool sendToNode(const std::string& command, const std::string& data);
    
    // Message processing
    void processStreamingThread();
    void handleStreamChunk(const StreamChunk& chunk);
    void processQueuedMessages();
    
    // Configuration
    std::string nodeScriptPath;
    std::vector<std::string> allowedTools;
    int maxTurns = 50;
    int sessionTimeout = 3600; // 1 hour
    
    // Error handling
    void setError(const std::string& error);
    void clearError();
    
    // Fallback to legacy provider
    std::unique_ptr<ILLMProvider> fallbackProvider;
    bool useFallback = false;
    bool initializeFallback();
    bool tryFallback(const LLMRequest& request, ResponseCallback callback);
};

#endif // CLAUDE_CODE_SDK_PROVIDER_H