/*---------------------------------------------------------*/
/*                                                         */
/*   illm_provider.h - Abstract LLM Provider Interface    */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef ILLM_PROVIDER_H
#define ILLM_PROVIDER_H

#include <string>
#include <functional>
#include <memory>
#include <vector>
#include "itool.h"

struct LLMResponse {
    std::string result;
    std::string session_id;
    double cost = 0.0;
    int duration_ms = 0;
    bool is_error = false;
    std::string error_message;
    
    // Additional metadata
    std::string model_used;
    std::string provider_name;
    
    // Tool calling support
    std::vector<ToolCall> tool_calls;
    bool needs_tool_execution = false;
};

struct LLMRequest {
    std::string message;
    std::string system_prompt;
    std::string session_id;

    // Provider-specific options
    double temperature = 0.7;
    int max_tokens = 4096;
    bool stream = false;

    // Tool support
    std::vector<Tool> tools;
    std::vector<ToolResult> tool_results;
};

// Streaming response chunk (for providers that support streaming)
struct StreamChunk {
    enum Type {
        CONTENT_DELTA,      // Partial content update
        MESSAGE_COMPLETE,   // Message finished
        ERROR_OCCURRED,     // Error in stream
        SESSION_UPDATE      // Session state change
    };

    Type type;
    std::string content;
    std::string session_id;
    std::string error_message;
    bool is_final = false;
};

// Streaming callback for real-time updates
using StreamingCallback = std::function<void(const StreamChunk&)>;

class ILLMProvider {
public:
    virtual ~ILLMProvider() = default;
    
    // Callback for async response handling
    using ResponseCallback = std::function<void(const LLMResponse&)>;
    
    // Core interface
    virtual bool sendQuery(const LLMRequest& request, ResponseCallback callback) = 0;
    virtual bool isAvailable() const = 0;
    virtual bool isBusy() const = 0;
    virtual void cancel() = 0;
    virtual void poll() {} // Optional polling for async providers
    
    // Provider info
    virtual std::string getProviderName() const = 0;
    virtual std::string getVersion() const = 0;
    virtual std::vector<std::string> getSupportedModels() const = 0;
    
    // Configuration
    virtual bool configure(const std::string& config) = 0;
    virtual std::string getLastError() const = 0;
    
    // Session management
    virtual void resetSession() = 0;
    virtual std::string getSessionId() const { return ""; }  // Optional, returns empty if not applicable

    // Runtime API key injection (for providers that support it)
    virtual void setApiKey(const std::string& /*key*/) {}
    virtual bool needsApiKey() const { return false; }

    // Tool support
    virtual bool supportsTools() const = 0;
    virtual void registerTool(const Tool& tool) = 0;
    virtual void clearTools() = 0;
};

#endif // ILLM_PROVIDER_H