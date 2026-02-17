/*---------------------------------------------------------*/
/*                                                         */
/*   anthropic_api_provider.h - Anthropic API Provider    */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef ANTHROPIC_API_PROVIDER_H
#define ANTHROPIC_API_PROVIDER_H

#include "../base/illm_provider.h"
#include <string>
#include <memory>

class AnthropicAPIProvider : public ILLMProvider {
public:
    AnthropicAPIProvider();
    virtual ~AnthropicAPIProvider();
    
    // ILLMProvider implementation
    bool sendQuery(const LLMRequest& request, ResponseCallback callback) override;
    bool isAvailable() const override;
    bool isBusy() const override;
    void cancel() override;
    void poll() override;
    
    // Provider info
    std::string getProviderName() const override { return "anthropic_api"; }
    std::string getVersion() const override { return "1.0"; }
    std::vector<std::string> getSupportedModels() const override;
    
    // Configuration
    bool configure(const std::string& config) override;
    std::string getLastError() const override { return lastError; }
    
    // Session management
    void resetSession() override;

    // Runtime API key injection
    void setApiKey(const std::string& key) override;
    bool needsApiKey() const override { return apiKey.empty(); }
    
    // Tool support (disabled for now to avoid tool_use path on simple sync client)
    bool supportsTools() const override { return false; }
    void registerTool(const Tool& tool) override;
    void clearTools() override;

private:
    bool busy = false;
    std::string endpoint = "https://api.anthropic.com/v1/messages";
    std::string model = "claude-3-5-haiku-latest";
    std::string apiKey;
    std::string lastError;
    
    int maxTokens = 4096;
    double temperature = 0.7;
    
    std::vector<std::pair<std::string, std::string>> conversationHistory;
    
    // Tool support
    std::vector<Tool> registeredTools;
    
    // Simple synchronous execution
    
    // API communication
    LLMResponse makeSimpleAPIRequest(const LLMRequest& request);
    std::string buildSimpleRequestJson(const LLMRequest& request) const;
    LLMResponse parseSimpleResponse(const std::string& response) const;
    
    // Utilities
    
    // Error handling
    void setError(const std::string& error);
    void clearError();

    // (No state kept between calls for tool_use; conversationHistory stores text only.)
};

#endif // ANTHROPIC_API_PROVIDER_H
