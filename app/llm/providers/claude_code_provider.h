/*---------------------------------------------------------*/
/*                                                         */
/*   claude_code_provider.h - Claude Code CLI Provider    */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef CLAUDE_CODE_PROVIDER_H
#define CLAUDE_CODE_PROVIDER_H

#include "../base/illm_provider.h"
#include <string>
#include <memory>

class ClaudeCodeProvider : public ILLMProvider {
public:
    ClaudeCodeProvider();
    virtual ~ClaudeCodeProvider();
    
    // ILLMProvider implementation
    bool sendQuery(const LLMRequest& request, ResponseCallback callback) override;
    bool isAvailable() const override;
    bool isBusy() const override;
    void cancel() override;
    void poll() override;
    
    // Provider info
    std::string getProviderName() const override { return "claude_code"; }
    std::string getVersion() const override;
    std::vector<std::string> getSupportedModels() const override;
    
    // Configuration
    bool configure(const std::string& config) override;
    std::string getLastError() const override { return lastError; }
    
    // Session management
    void resetSession() override;
    std::string getSessionId() const override { return currentSessionId; }

    // Tool support
    bool supportsTools() const override { return true; }
    void registerTool(const Tool& tool) override;
    void clearTools() override;

    // Streaming support (uses --output-format stream-json)
    bool sendStreamingQuery(const std::string& query, StreamingCallback streamCallback);
    bool isStreamingActive() const { return streamingActive; }

private:
    bool busy = false;
    std::string claudePath = "claude";
    std::string lastError;
    std::string currentSessionId;
    
    // Tool support
    std::vector<Tool> registeredTools;
    
    // Async execution state
    FILE* activePipe = nullptr;
    std::string outputBuffer;
    ResponseCallback pendingCallback;
    LLMRequest pendingRequest;

    // Streaming state
    bool streamingActive = false;
    bool streamingMode = false;
    StreamingCallback activeStreamCallback;
    std::string lineBuffer;  // For accumulating partial JSONL lines
    
    // Claude Code execution
    LLMResponse executeClaudeCommand(const LLMRequest& request);
    bool startAsyncCommand(const LLMRequest& request, ResponseCallback callback);
    void pollAsyncExecution();
    std::string buildClaudeCommand(const LLMRequest& request) const;
    
    // JSON parsing (from existing wibwob_engine.cpp)
    LLMResponse parseClaudeResponse(const std::string& json) const;
    std::string extractJsonField(const std::string& json, const std::string& field) const;
    bool extractJsonBool(const std::string& json, const std::string& field) const;
    double extractJsonNumber(const std::string& json, const std::string& field) const;

    // Streaming JSONL parsing
    void processStreamLine(const std::string& line);
    
    // Error handling
    void setError(const std::string& error);
    void clearError();
    
    // Configuration
    std::vector<std::string> commandArgs;
};

#endif // CLAUDE_CODE_PROVIDER_H