/*---------------------------------------------------------*/
/*                                                         */
/*   wibwob_engine.h - LLM Provider Integration Engine    */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef WIBWOB_ENGINE_H
#define WIBWOB_ENGINE_H

#include "llm/base/illm_provider.h"
#include "llm/base/llm_config.h"
#include "llm/base/itool.h"
#include <string>
#include <functional>
#include <memory>

// Legacy compatibility alias
using ClaudeResponse = LLMResponse;

class WibWobEngine {
public:
    WibWobEngine();
    ~WibWobEngine();
    
    // Callback for response handling
    using ResponseCallback = std::function<void(const LLMResponse&)>;
    
    // Send a query to current LLM provider (non-blocking)
    bool sendQuery(const std::string& query, ResponseCallback callback);
    
    // Poll for completion of async request (placeholder for compatibility)
    void poll();
    
    // Cancel current request
    void cancel();
    
    // Check if current provider is available
    bool isClaudeAvailable() const;
    
    // Configuration
    void setSystemPrompt(const std::string& prompt);
    const std::string& getSystemPrompt() const { return systemPrompt; }
    void setClaudePath(const std::string& path);  // Legacy compatibility
    
    // Provider management
    bool switchProvider(const std::string& providerName);
    std::string getCurrentProvider() const;
    std::string getCurrentModel() const;
    std::vector<std::string> getAvailableProviders() const;
    ILLMProvider* getCurrentProviderPtr() const;
    
    // Status
    bool isBusy() const;
    std::string getLastError() const;
    std::string getSessionId() const;  // Get current session ID (empty if provider doesn't support it)

    // Runtime API key management (for browser mode)
    void setApiKey(const std::string& key);
    bool needsApiKey() const;

    // Tool support
    void initializeBuiltinTools();
    void registerTool(const Tool& tool);
    void clearTools();

private:
    // Configuration / provider
    std::unique_ptr<LLMConfig> config;
    std::unique_ptr<ILLMProvider> currentProvider;
    std::string systemPrompt;
    
    // Legacy compatibility
    std::string claudePath = "claude";
    
    // Provider management
    bool initializeProvider(const std::string& providerName);
    void loadConfiguration();
    
    // Configuration helpers
    std::string generateProviderConfigJson(const ProviderConfig& config) const;
};

#endif // WIBWOB_ENGINE_H
