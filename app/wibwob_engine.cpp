/*---------------------------------------------------------*/
/*                                                         */
/*   wibwob_engine.cpp - LLM Provider Integration Engine  */
/*                                                         */
/*---------------------------------------------------------*/

#include "wibwob_engine.h"
#include "llm/base/llm_provider_factory.h"
#include "llm/base/path_search.h"

#include <cstdio>
#include <cstdlib>
#include <memory>
#include <sstream>
#include <algorithm>
#include <chrono>

WibWobEngine::WibWobEngine() {
    // Default system prompt for wib&wob
    systemPrompt = "You are wib&wob, a helpful AI assistant integrated into a Turbo Vision TUI application.";
    
    // Initialize built-in tools
    initializeBuiltinTools();
    
    // Defer configuration loading until first use
}

WibWobEngine::~WibWobEngine() {
    // Cancel any pending request
    cancel();
}

bool WibWobEngine::sendQuery(const std::string& query, ResponseCallback callback) {
    // Load configuration on first use
    if (!currentProvider) {
        loadConfiguration();
    }
    
    if (!currentProvider || query.empty()) {
        if (callback) {
            LLMResponse response;
            response.is_error = true;
            response.error_message = "No provider available or empty query";
            callback(response);
        }
        return false;
    }
    
    // Build the request
    LLMRequest request;
    request.message = query;
    request.system_prompt = systemPrompt;
    
    // Add available tools to request
    if (currentProvider->supportsTools()) {
        request.tools = ToolRegistry::instance().getAllTools();
    }
    
    // Create wrapper callback to handle tool execution
    auto wrappedCallback = [this, callback](const LLMResponse& response) {
        fprintf(stderr, "DEBUG: Wrapper callback - needs_tool_execution=%d, tool_calls=%zu\n", 
                response.needs_tool_execution, response.tool_calls.size());
                
        if (response.needs_tool_execution && !response.tool_calls.empty()) {
            fprintf(stderr, "DEBUG: Executing %zu tool calls\n", response.tool_calls.size());
            
            // Execute all tool calls
            LLMRequest followUpRequest;
            followUpRequest.system_prompt = systemPrompt;
            followUpRequest.message = "Please continue with the tool results.";
            
            for (const auto& toolCall : response.tool_calls) {
                fprintf(stderr, "DEBUG: Executing tool: %s (id: %s)\n", toolCall.name.c_str(), toolCall.id.c_str());
                ToolResult result = ToolRegistry::instance().execute(toolCall);
                
                if (result.is_error) {
                    fprintf(stderr, "DEBUG: Tool execution failed: %s\n", result.error_message.c_str());
                } else {
                    fprintf(stderr, "DEBUG: Tool result: %s\n", result.content.c_str());
                }
                
                followUpRequest.tool_results.push_back(result);
            }
            
            // Add tools again for follow-up
            if (currentProvider->supportsTools()) {
                followUpRequest.tools = ToolRegistry::instance().getAllTools();
            }
            
            fprintf(stderr, "DEBUG: Sending follow-up request with %zu tool results\n", followUpRequest.tool_results.size());
            
            // Send follow-up request with tool results
            currentProvider->sendQuery(followUpRequest, callback);
        } else {
            fprintf(stderr, "DEBUG: No tool execution needed - returning response directly\n");
            // No tools needed, return response directly
            if (callback) callback(response);
        }
    };
    
    // Send to current provider (synchronous or provider-managed async)
    return currentProvider->sendQuery(request, wrappedCallback);
}

void WibWobEngine::poll() {
    if (currentProvider) {
        currentProvider->poll();
    }
}

void WibWobEngine::cancel() {
    if (currentProvider) {
        currentProvider->cancel();
    }
}

bool WibWobEngine::isClaudeAvailable() const {
    // Load configuration on first check
    if (!currentProvider) {
        const_cast<WibWobEngine*>(this)->loadConfiguration();
    }
    return currentProvider && currentProvider->isAvailable();
}

void WibWobEngine::setSystemPrompt(const std::string& prompt) {
    systemPrompt = prompt;
}

void WibWobEngine::setClaudePath(const std::string& path) {
    // Legacy compatibility - update claude_code provider configuration if active
    claudePath = path;
    
    if (currentProvider && currentProvider->getProviderName() == "claude_code") {
        // Would need to reconfigure the provider - for now just store the path
        // In production, this would update the provider's configuration
    }
}

bool WibWobEngine::switchProvider(const std::string& providerName) {
    return initializeProvider(providerName);
}

std::string WibWobEngine::getCurrentProvider() const {
    // Load configuration on first check
    if (!currentProvider) {
        const_cast<WibWobEngine*>(this)->loadConfiguration();
    }
    if (currentProvider) {
        return currentProvider->getProviderName();
    }
    return "none";
}

std::string WibWobEngine::getCurrentModel() const {
    if (!config) return "unknown";

    std::string provider = getCurrentProvider();
    if (provider == "none") return "unknown";

    ProviderConfig providerConfig = config->getProviderConfig(provider);

    // For claude_code and claude_code_sdk, return appropriate model name
    if (provider == "claude_code") {
        return "Claude Code";
    } else if (provider == "claude_code_sdk") {
        return "sonnet";  // Show the actual alias we send to Claude Code
    }

    return providerConfig.model.empty() ? "unknown" : providerConfig.model;
}

std::vector<std::string> WibWobEngine::getAvailableProviders() const {
    return LLMProviderFactory::getInstance().getAvailableProviders();
}

ILLMProvider* WibWobEngine::getCurrentProviderPtr() const {
    if (!currentProvider) {
        const_cast<WibWobEngine*>(this)->loadConfiguration();
    }
    return currentProvider.get();
}

bool WibWobEngine::isBusy() const {
    return currentProvider && currentProvider->isBusy();
}

std::string WibWobEngine::getLastError() const {
    if (currentProvider) {
        return currentProvider->getLastError();
    }
    return "No provider initialized";
}

std::string WibWobEngine::getSessionId() const {
    if (currentProvider) {
        return currentProvider->getSessionId();
    }
    return "";
}

void WibWobEngine::setApiKey(const std::string& key) {
    if (!config) {
        loadConfiguration();
    }
    // Create anthropic_api provider directly, bypassing the isAvailable() gate.
    // Key must be set BEFORE availability check — initializeProvider() checks
    // isAvailable() which requires apiKey to be non-empty.
    auto provider = LLMProviderFactory::getInstance().createProvider("anthropic_api");
    if (!provider) {
        fprintf(stderr, "ERROR: Failed to create anthropic_api provider\n");
        return;
    }
    // Configure endpoint/model from config (if loaded)
    if (config) {
        ProviderConfig pc = config->getProviderConfig("anthropic_api");
        std::string configJson = generateProviderConfigJson(pc);
        provider->configure(configJson);
    }
    // Inject key BEFORE availability check
    provider->setApiKey(key);
    if (provider->isAvailable()) {
        currentProvider = std::move(provider);
        fprintf(stderr, "DEBUG: anthropic_api provider active with runtime key (len=%zu)\n", key.size());
    } else {
        fprintf(stderr, "ERROR: anthropic_api provider still not available after key injection\n");
    }
}

bool WibWobEngine::needsApiKey() const {
    if (!currentProvider) {
        const_cast<WibWobEngine*>(this)->loadConfiguration();
    }
    if (!currentProvider) return true;
    return currentProvider->needsApiKey();
}

void WibWobEngine::loadConfiguration() {
    config = std::make_unique<LLMConfig>();
    
    // Config file path - app is commonly launched from either repo root OR build/app.
    const std::vector<std::string> cfgCandidates = {
        "app/llm/config/llm_config.json",
        "llm/config/llm_config.json"
    };
    bool loadResult = false;
    std::string usedPath;
    usedPath = ww_find_first_existing_upwards(cfgCandidates, 6);
    if (!usedPath.empty()) {
        loadResult = config->loadFromFile(usedPath);
    }

    fprintf(stderr, "DEBUG: Config file load result: %s%s\n",
            loadResult ? "SUCCESS " : "FAILED",
            loadResult ? ("(" + usedPath + ")").c_str() : "");

    // Pick desired provider based on env/config
    // Only override if ANTHROPIC_API_KEY is set and anthropic_api is configured
    auto hasAnthropicKey = []() -> bool {
        const char* v = std::getenv("ANTHROPIC_API_KEY");
        return v && *v;
    };
    std::string desiredProvider = config->getActiveProvider();
    fprintf(stderr, "DEBUG: Config activeProvider: %s\n", desiredProvider.c_str());

    // Respect configured provider selection.
    // Only pick a provider automatically when no active provider is configured.
    if (desiredProvider.empty()) {
        if (hasAnthropicKey() && config->hasProvider("anthropic_api")) {
            desiredProvider = "anthropic_api";
            fprintf(stderr, "DEBUG: Auto-selecting anthropic_api (no active provider + API key present)\n");
        } else if (config->hasProvider("claude_code")) {
            desiredProvider = "claude_code";
            fprintf(stderr, "DEBUG: Falling back to claude_code (no provider configured)\n");
        }
    }
    if (!desiredProvider.empty())
        config->setActiveProvider(desiredProvider);

    if (loadResult) {
        fprintf(stderr, "DEBUG: Config loaded successfully, active provider: %s\n", desiredProvider.c_str());
    } else {
        // Config file missing or invalid - create default but DON'T overwrite existing file
        fprintf(stderr, "ERROR: Failed to load llm/config/llm_config.json\n");
        fprintf(stderr, "DEBUG: Using default config with activeProvider: %s\n", desiredProvider.c_str());
        
        // Check validation errors
        auto errors = config->getValidationErrors();
        for (const auto& error : errors) {
            fprintf(stderr, "Config error: %s\n", error.c_str());
        }
        std::string defaultJson = LLMConfig::getDefaultConfigJson();
        config->loadFromString(defaultJson);
        
        // Only save if file doesn't exist at all
        FILE* check = fopen("llm/config/llm_config.json", "r");
        if (!check) {
            config->saveToFile("llm/config/llm_config.json");
        } else {
            fclose(check);
        }
        
        // Try the default active provider
        std::string defaultProvider = desiredProvider.empty() ? config->getActiveProvider() : desiredProvider;
        if (!initializeProvider(defaultProvider)) {
            // If default provider fails, try any available provider
            auto availableProviders = config->getAvailableProviders();
            for (const auto& provider : availableProviders) {
                if (initializeProvider(provider)) {
                    fprintf(stderr, "Fallback: Using provider '%s' instead of '%s'\n", provider.c_str(), defaultProvider.c_str());
                    break;
                }
            }
        }
    }

    // Initialize desired provider with fallback sequence: desired first, then the rest.
    std::vector<std::string> candidates;
    if (!desiredProvider.empty())
        candidates.push_back(desiredProvider);
    auto available = config->getAvailableProviders();
    for (const auto& p : available) {
        if (std::find(candidates.begin(), candidates.end(), p) == candidates.end())
            candidates.push_back(p);
    }
    for (const auto& name : candidates) {
        if (initializeProvider(name)) {
            fprintf(stderr, "DEBUG: Successfully initialized provider: %s\n", name.c_str());
            break;
        } else {
            fprintf(stderr, "ERROR: Failed to initialize provider: %s\n", name.c_str());
        }
    }
}

bool WibWobEngine::initializeProvider(const std::string& providerName) {
    fprintf(stderr, "DEBUG: Attempting to initialize provider: %s\n", providerName.c_str());
    
    // Create new provider instance
    auto provider = LLMProviderFactory::getInstance().createProvider(providerName);
    if (!provider) {
        fprintf(stderr, "DEBUG: Failed to create provider: %s\n", providerName.c_str());
        return false;
    }
    
    // Get configuration for this provider
    if (config) {
        ProviderConfig providerConfig = config->getProviderConfig(providerName);
        if (providerConfig.enabled) {
            // Convert ProviderConfig to JSON string for provider configuration
            std::string configJson = generateProviderConfigJson(providerConfig);
            if (!provider->configure(configJson)) {
                return false;
            }
        }
    }
    
    // Check if provider is available
    if (!provider->isAvailable()) {
        fprintf(stderr, "DEBUG: Provider %s is not available\n", providerName.c_str());
        return false;
    }
    fprintf(stderr, "DEBUG: Provider %s is available and configured\n", providerName.c_str());
    
    // Switch to new provider
    currentProvider = std::move(provider);
    
    // Update active provider in config (but don't save - respect user's file)
    if (config) {
        config->setActiveProvider(providerName);
        // Don't auto-save to avoid overwriting user's manual edits
    }
    
    return true;
}

std::string WibWobEngine::generateProviderConfigJson(const ProviderConfig& config) const {
    std::ostringstream json;
    json << "{";
    
    if (!config.model.empty()) {
        json << "\"model\":\"" << config.model << "\",";
    }
    if (!config.endpoint.empty()) {
        json << "\"endpoint\":\"" << config.endpoint << "\",";
    }
    if (!config.apiKeyEnv.empty()) {
        json << "\"apiKeyEnv\":\"" << config.apiKeyEnv << "\",";
    }
    if (!config.command.empty()) {
        json << "\"command\":\"" << config.command << "\",";
    }
    
    // Add generic parameters
    for (const auto& param : config.parameters) {
        json << "\"" << param.first << "\":\"" << param.second << "\",";
    }
    
    std::string result = json.str();
    if (result.back() == ',') {
        result.pop_back(); // Remove trailing comma
    }
    result += "}";
    
    return result;
}

// Tool support methods
void WibWobEngine::initializeBuiltinTools() {
    // Tools are auto-registered via static initializers in tool files
    // This method ensures the tool files are linked
}

void WibWobEngine::registerTool(const Tool& tool) {
    if (currentProvider && currentProvider->supportsTools()) {
        currentProvider->registerTool(tool);
    }
}

void WibWobEngine::clearTools() {
    if (currentProvider && currentProvider->supportsTools()) {
        currentProvider->clearTools();
    }
}
