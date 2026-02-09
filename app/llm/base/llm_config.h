/*---------------------------------------------------------*/
/*                                                         */
/*   llm_config.h - LLM Configuration Management          */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef LLM_CONFIG_H
#define LLM_CONFIG_H

#include <string>
#include <map>
#include <vector>

struct ProviderConfig {
    bool enabled = true;
    std::string model;
    std::string endpoint;
    std::string apiKeyEnv;
    std::string command;
    std::vector<std::string> args;
    
    // Generic key-value parameters
    std::map<std::string, std::string> parameters;
    
    // Helper methods
    std::string getParameter(const std::string& key, const std::string& defaultValue = "") const;
    int getParameterInt(const std::string& key, int defaultValue = 0) const;
    double getParameterDouble(const std::string& key, double defaultValue = 0.0) const;
    bool getParameterBool(const std::string& key, bool defaultValue = false) const;
};

class LLMConfig {
public:
    LLMConfig();
    
    // Configuration loading
    bool loadFromFile(const std::string& configPath);
    bool loadFromString(const std::string& jsonConfig);
    bool saveToFile(const std::string& configPath) const;
    
    // Provider management
    std::string getActiveProvider() const { return activeProvider; }
    void setActiveProvider(const std::string& provider) { activeProvider = provider; }
    
    ProviderConfig getProviderConfig(const std::string& provider) const;
    void setProviderConfig(const std::string& provider, const ProviderConfig& config);
    
    std::vector<std::string> getAvailableProviders() const;
    bool hasProvider(const std::string& provider) const;
    
    // Environment variable resolution
    std::string resolveApiKey(const std::string& envVar) const;
    
    // Validation
    bool isValid() const;
    std::vector<std::string> getValidationErrors() const;
    
    // Default configuration
    static std::string getDefaultConfigJson();

private:
    std::string activeProvider = "claude_code_sdk";
    std::map<std::string, ProviderConfig> providers;
    mutable std::vector<std::string> validationErrors;
    
    // JSON parsing helpers
    bool parseJson(const std::string& json);
    void parseProvider(const std::string& json, const std::string& providerName);
    std::string parseJsonString(const std::string& json, const std::string& key) const;
    bool parseJsonBool(const std::string& json, const std::string& key, bool defaultValue = false) const;
    std::string generateJson() const;
    void validateConfiguration();
    
    // Environment variable helpers
    void loadDotEnv(const std::string& envPath = ".env");
};

#endif // LLM_CONFIG_H