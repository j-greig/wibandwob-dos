/*---------------------------------------------------------*/
/*                                                         */
/*   llm_config.cpp - LLM Configuration Management        */
/*                                                         */
/*---------------------------------------------------------*/

#include "llm_config.h"
#include <fstream>
#include <sstream>
#include <cstdlib>
#include <algorithm>

std::string ProviderConfig::getParameter(const std::string& key, const std::string& defaultValue) const {
    auto it = parameters.find(key);
    return it != parameters.end() ? it->second : defaultValue;
}

int ProviderConfig::getParameterInt(const std::string& key, int defaultValue) const {
    std::string value = getParameter(key);
    if (value.empty()) return defaultValue;
    try {
        return std::stoi(value);
    } catch (...) {
        return defaultValue;
    }
}

double ProviderConfig::getParameterDouble(const std::string& key, double defaultValue) const {
    std::string value = getParameter(key);
    if (value.empty()) return defaultValue;
    try {
        return std::stod(value);
    } catch (...) {
        return defaultValue;
    }
}

bool ProviderConfig::getParameterBool(const std::string& key, bool defaultValue) const {
    std::string value = getParameter(key);
    if (value.empty()) return defaultValue;
    std::transform(value.begin(), value.end(), value.begin(), ::tolower);
    return value == "true" || value == "1" || value == "yes";
}

LLMConfig::LLMConfig() {
    // Load .env files to set environment variables; try multiple relative paths.
    const char* envPaths[] = {
        ".env",        // repo root if run from root
        "../.env",     // common when run from build/app
        "../../.env"   // fallback if deeper
    };
    for (const auto& p : envPaths) {
        loadDotEnv(p);
    }

    // Set up default configuration
    loadFromString(getDefaultConfigJson());
}

bool LLMConfig::loadFromFile(const std::string& configPath) {
    std::ifstream file(configPath);
    if (!file.is_open()) {
        validationErrors.push_back("Could not open config file: " + configPath);
        return false;
    }
    
    std::stringstream buffer;
    buffer << file.rdbuf();
    
    return loadFromString(buffer.str());
}

bool LLMConfig::loadFromString(const std::string& jsonConfig) {
    validationErrors.clear();
    bool result = parseJson(jsonConfig);

    // Config loading complete - activeProvider set from JSON or default config
    fprintf(stderr, "DEBUG: Config loaded, activeProvider: %s\n", activeProvider.c_str());

    return result;
}

bool LLMConfig::saveToFile(const std::string& configPath) const {
    std::ofstream file(configPath);
    if (!file.is_open()) {
        return false;
    }
    
    file << generateJson();
    return file.good();
}

ProviderConfig LLMConfig::getProviderConfig(const std::string& provider) const {
    auto it = providers.find(provider);
    return it != providers.end() ? it->second : ProviderConfig{};
}

void LLMConfig::setProviderConfig(const std::string& provider, const ProviderConfig& config) {
    providers[provider] = config;
}

std::vector<std::string> LLMConfig::getAvailableProviders() const {
    std::vector<std::string> result;
    for (const auto& pair : providers) {
        if (pair.second.enabled) {
            result.push_back(pair.first);
        }
    }
    return result;
}

bool LLMConfig::hasProvider(const std::string& provider) const {
    auto it = providers.find(provider);
    return it != providers.end() && it->second.enabled;
}

std::string LLMConfig::resolveApiKey(const std::string& envVar) const {
    if (envVar.empty()) return "";
    const char* value = std::getenv(envVar.c_str());
    return value ? std::string(value) : std::string();
}

bool LLMConfig::isValid() const {
    validationErrors.clear();
    const_cast<LLMConfig*>(this)->validateConfiguration();
    return validationErrors.empty();
}

std::vector<std::string> LLMConfig::getValidationErrors() const {
    return validationErrors;
}

// Simple JSON parsing for basic configuration (production would use proper JSON library)
bool LLMConfig::parseJson(const std::string& json) {
    // Parse activeProvider
    size_t pos = json.find("\"activeProvider\"");
    if (pos != std::string::npos) {
        size_t start = json.find("\"", pos + 16);
        if (start != std::string::npos) {
            start++;
            size_t end = json.find("\"", start);
            if (end != std::string::npos) {
                activeProvider = json.substr(start, end - start);
            }
        }
    }
    
    providers.clear(); // Clear any existing providers
    
    // Parse providers section - find the "providers" object
    size_t providersPos = json.find("\"providers\"");
    if (providersPos == std::string::npos) {
        validationErrors.push_back("No providers section found in config");
        return false;
    }
    
    // Find opening brace of providers object
    size_t providersStart = json.find("{", providersPos);
    if (providersStart == std::string::npos) return false;
    
    // Parse each provider
    parseProvider(json, "claude_code_sdk");
    parseProvider(json, "anthropic_api");
    
    validateConfiguration();
    return validationErrors.empty();
}

// Helper method to parse individual provider configurations
void LLMConfig::parseProvider(const std::string& json, const std::string& providerName) {
    std::string pattern = "\"" + providerName + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return;
    
    size_t objStart = json.find("{", pos);
    if (objStart == std::string::npos) return;
    
    // Find the end of this provider object
    int braceCount = 1;
    size_t objEnd = objStart + 1;
    while (objEnd < json.length() && braceCount > 0) {
        if (json[objEnd] == '{') braceCount++;
        else if (json[objEnd] == '}') braceCount--;
        objEnd++;
    }
    
    std::string providerJson = json.substr(objStart, objEnd - objStart);
    
    ProviderConfig config;
    config.enabled = parseJsonBool(providerJson, "enabled", true);
    config.model = parseJsonString(providerJson, "model");
    config.endpoint = parseJsonString(providerJson, "endpoint");
    config.apiKeyEnv = parseJsonString(providerJson, "apiKeyEnv");
    config.command = parseJsonString(providerJson, "command");
    
    // Parse common parameters
    std::string maxTokens = parseJsonString(providerJson, "maxTokens");
    std::string temperature = parseJsonString(providerJson, "temperature");
    if (!maxTokens.empty()) config.parameters["maxTokens"] = maxTokens;
    if (!temperature.empty()) config.parameters["temperature"] = temperature;
    
    // Parse claude_code_sdk specific parameters
    if (providerName == "claude_code_sdk") {
        std::string maxTurns = parseJsonString(providerJson, "maxTurns");
        std::string nodeScriptPath = parseJsonString(providerJson, "nodeScriptPath");
        std::string sessionTimeout = parseJsonString(providerJson, "sessionTimeout");
        std::string allowedTools = parseJsonString(providerJson, "allowedTools");
        
        if (!maxTurns.empty()) config.parameters["maxTurns"] = maxTurns;
        if (!nodeScriptPath.empty()) config.parameters["nodeScriptPath"] = nodeScriptPath;
        if (!sessionTimeout.empty()) config.parameters["sessionTimeout"] = sessionTimeout;
        if (!allowedTools.empty()) config.parameters["allowedTools"] = allowedTools;
    }
    
    providers[providerName] = config;
}

std::string LLMConfig::generateJson() const {
    std::ostringstream json;
    json << "{\n";
    json << "  \"activeProvider\": \"" << activeProvider << "\",\n";
    json << "  \"providers\": {\n";
    
    bool first = true;
    for (const auto& pair : providers) {
        if (!first) json << ",\n";
        first = false;
        
        const std::string& name = pair.first;
        const ProviderConfig& config = pair.second;
        
        json << "    \"" << name << "\": {\n";
        json << "      \"enabled\": " << (config.enabled ? "true" : "false") << ",\n";
        
        if (!config.model.empty()) {
            json << "      \"model\": \"" << config.model << "\",\n";
        }
        if (!config.endpoint.empty()) {
            json << "      \"endpoint\": \"" << config.endpoint << "\",\n";
        }
        if (!config.apiKeyEnv.empty()) {
            json << "      \"apiKeyEnv\": \"" << config.apiKeyEnv << "\",\n";
        }
        if (!config.command.empty()) {
            json << "      \"command\": \"" << config.command << "\",\n";
            if (!config.args.empty()) {
                json << "      \"args\": [";
                for (size_t i = 0; i < config.args.size(); ++i) {
                    if (i > 0) json << ", ";
                    json << "\"" << config.args[i] << "\"";
                }
                json << "],\n";
            }
        }
        
        // Add parameters
        for (const auto& param : config.parameters) {
            json << "      \"" << param.first << "\": \"" << param.second << "\",\n";
        }
        
        // Remove trailing comma
        std::string line = json.str();
        if (line.back() == '\n' && line[line.size()-2] == ',') {
            json.seekp(-2, std::ios_base::cur);
            json << "\n";
        }
        
        json << "    }";
    }
    
    json << "\n  }\n";
    json << "}\n";
    
    return json.str();
}

void LLMConfig::validateConfiguration() {
    if (activeProvider.empty()) {
        validationErrors.push_back("No active provider specified");
        return;
    }
    
    if (!hasProvider(activeProvider)) {
        validationErrors.push_back("Active provider '" + activeProvider + "' is not available or disabled");
    }
    
    // Validate provider configurations
    for (const auto& pair : providers) {
        const std::string& name = pair.first;
        const ProviderConfig& config = pair.second;
        
        if (!config.enabled) continue;
        
        // Validate API-based providers
        if (name == "anthropic_api") {
            if (config.endpoint.empty()) {
                validationErrors.push_back("Provider '" + name + "' missing endpoint");
            }
            if (!config.apiKeyEnv.empty()) {
                std::string apiKey = resolveApiKey(config.apiKeyEnv);
                if (apiKey.empty()) {
                    validationErrors.push_back("Provider '" + name + "' API key not found in environment variable '" + config.apiKeyEnv + "'");
                }
            }
        }
        
        // (No command-based provider validation needed — claude_code removed)
    }
}

std::string LLMConfig::parseJsonString(const std::string& json, const std::string& key) const {
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return "";
    
    size_t start = json.find("\"", pos + pattern.length());
    if (start == std::string::npos) return "";
    start++; // Skip opening quote
    
    size_t end = json.find("\"", start);
    if (end == std::string::npos) return "";
    
    return json.substr(start, end - start);
}

bool LLMConfig::parseJsonBool(const std::string& json, const std::string& key, bool defaultValue) const {
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return defaultValue;
    
    size_t valuePos = json.find(":", pos);
    if (valuePos == std::string::npos) return defaultValue;
    valuePos++;
    
    // Skip whitespace
    while (valuePos < json.length() && (json[valuePos] == ' ' || json[valuePos] == '\t')) {
        valuePos++;
    }
    
    return (valuePos + 4 <= json.length() && json.substr(valuePos, 4) == "true");
}

std::string LLMConfig::getDefaultConfigJson() {
    return R"({
  "activeProvider": "claude_code_sdk",
  "providers": {
    "claude_code_sdk": {
      "enabled": true,
      "maxTurns": 50,
      "allowedTools": ["Read", "Write", "Grep", "Bash", "LS", "WebSearch", "WebFetch"],
      "nodeScriptPath": "llm/sdk_bridge/claude_sdk_bridge.js",
      "sessionTimeout": 3600
    },
    "anthropic_api": {
      "enabled": true,
      "model": "claude-haiku-4-5",
      "endpoint": "https://api.anthropic.com/v1/messages",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "maxTokens": "4096",
      "temperature": "0.7"
    }
  }
})";
}

void LLMConfig::loadDotEnv(const std::string& envPath) {
    fprintf(stderr, "DEBUG: Loading .env from: %s\n", envPath.c_str());
    std::ifstream file(envPath);
    if (!file.is_open()) {
        fprintf(stderr, "DEBUG: .env file not found at: %s\n", envPath.c_str());
        return;
    }
    fprintf(stderr, "DEBUG: .env file loaded successfully\n");
    
    std::string line;
    while (std::getline(file, line)) {
        // Skip empty lines and comments
        if (line.empty() || line[0] == '#') {
            continue;
        }
        
        // Find the = separator
        size_t equalPos = line.find('=');
        if (equalPos == std::string::npos) {
            continue;
        }
        
        std::string key = line.substr(0, equalPos);
        std::string value = line.substr(equalPos + 1);
        
        // Trim whitespace
        key.erase(key.find_last_not_of(" \t\r\n") + 1);
        key.erase(0, key.find_first_not_of(" \t\r\n"));
        value.erase(value.find_last_not_of(" \t\r\n") + 1);
        value.erase(0, value.find_first_not_of(" \t\r\n"));
        
        // Remove quotes if present
        if (value.length() >= 2 && 
            ((value[0] == '"' && value[value.length()-1] == '"') ||
             (value[0] == '\'' && value[value.length()-1] == '\''))) {
            value = value.substr(1, value.length() - 2);
        }
        
        // Set environment variable using setenv (POSIX)
        if (!key.empty()) {
            setenv(key.c_str(), value.c_str(), 1); // 1 = overwrite existing
        }
    }
}
