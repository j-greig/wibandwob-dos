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

namespace {

size_t skipWhitespace(const std::string& text, size_t pos) {
    while (pos < text.size() && (text[pos] == ' ' || text[pos] == '\n' ||
                                 text[pos] == '\r' || text[pos] == '\t')) {
        ++pos;
    }
    return pos;
}

size_t findMatchingBracket(const std::string& text, size_t openPos, char openCh, char closeCh) {
    bool inString = false;
    bool escaped = false;
    int depth = 0;

    for (size_t pos = openPos; pos < text.size(); ++pos) {
        const char ch = text[pos];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch == '\\') {
                escaped = true;
            } else if (ch == '"') {
                inString = false;
            }
            continue;
        }

        if (ch == '"') {
            inString = true;
            continue;
        }

        if (ch == openCh) {
            ++depth;
        } else if (ch == closeCh) {
            --depth;
            if (depth == 0) {
                return pos;
            }
        }
    }

    return std::string::npos;
}

std::string extractQuotedString(const std::string& text, size_t quotePos) {
    if (quotePos == std::string::npos || quotePos >= text.size() || text[quotePos] != '"') {
        return "";
    }

    std::string value;
    bool escaped = false;
    for (size_t pos = quotePos + 1; pos < text.size(); ++pos) {
        const char ch = text[pos];
        if (escaped) {
            switch (ch) {
                case '"': value.push_back('"'); break;
                case '\\': value.push_back('\\'); break;
                case 'n': value.push_back('\n'); break;
                case 'r': value.push_back('\r'); break;
                case 't': value.push_back('\t'); break;
                default: value.push_back(ch); break;
            }
            escaped = false;
            continue;
        }
        if (ch == '\\') {
            escaped = true;
            continue;
        }
        if (ch == '"') {
            return value;
        }
        value.push_back(ch);
    }

    return "";
}

bool findKeyValueStart(const std::string& objectJson, const std::string& key, size_t& valueStart) {
    const std::string pattern = "\"" + key + "\"";
    size_t pos = objectJson.find(pattern);
    while (pos != std::string::npos) {
        const size_t colonPos = objectJson.find(':', pos + pattern.size());
        if (colonPos != std::string::npos) {
            valueStart = skipWhitespace(objectJson, colonPos + 1);
            return true;
        }
        pos = objectJson.find(pattern, pos + pattern.size());
    }
    return false;
}

std::string parseStringField(const std::string& objectJson, const std::string& key,
                             const std::string& defaultValue = "") {
    size_t valueStart = 0;
    if (!findKeyValueStart(objectJson, key, valueStart)) {
        return defaultValue;
    }
    if (valueStart >= objectJson.size() || objectJson[valueStart] != '"') {
        return defaultValue;
    }
    return extractQuotedString(objectJson, valueStart);
}

std::string parseScalarField(const std::string& objectJson, const std::string& key,
                             const std::string& defaultValue = "") {
    size_t valueStart = 0;
    if (!findKeyValueStart(objectJson, key, valueStart)) {
        return defaultValue;
    }
    if (valueStart < objectJson.size() && objectJson[valueStart] == '"') {
        return extractQuotedString(objectJson, valueStart);
    }

    size_t valueEnd = valueStart;
    while (valueEnd < objectJson.size() && objectJson[valueEnd] != ',' && objectJson[valueEnd] != '}') {
        ++valueEnd;
    }
    const size_t trimmedEnd = objectJson.find_last_not_of(" \n\r\t", valueEnd == 0 ? 0 : valueEnd - 1);
    if (trimmedEnd == std::string::npos || trimmedEnd < valueStart) {
        return defaultValue;
    }
    return objectJson.substr(valueStart, trimmedEnd - valueStart + 1);
}

bool parseBoolField(const std::string& objectJson, const std::string& key, bool defaultValue) {
    const std::string value = parseScalarField(objectJson, key, defaultValue ? "true" : "false");
    return value == "true" || value == "1";
}

std::vector<std::string> parseStringArrayField(const std::string& objectJson, const std::string& key) {
    std::vector<std::string> values;
    size_t valueStart = 0;
    if (!findKeyValueStart(objectJson, key, valueStart) ||
        valueStart >= objectJson.size() || objectJson[valueStart] != '[') {
        return values;
    }

    const size_t arrayEnd = findMatchingBracket(objectJson, valueStart, '[', ']');
    if (arrayEnd == std::string::npos) {
        return values;
    }

    size_t pos = valueStart + 1;
    while (pos < arrayEnd) {
        pos = skipWhitespace(objectJson, pos);
        if (pos >= arrayEnd) {
            break;
        }
        if (objectJson[pos] == '"') {
            values.push_back(extractQuotedString(objectJson, pos));
            pos = objectJson.find('"', pos + 1);
            if (pos == std::string::npos) {
                break;
            }
            ++pos;
            while (pos < arrayEnd && objectJson[pos] != ',') {
                ++pos;
            }
        }
        if (pos < arrayEnd && objectJson[pos] == ',') {
            ++pos;
        }
    }

    return values;
}

std::string extractObjectForKey(const std::string& objectJson, const std::string& key) {
    size_t valueStart = 0;
    if (!findKeyValueStart(objectJson, key, valueStart) ||
        valueStart >= objectJson.size() || objectJson[valueStart] != '{') {
        return "";
    }

    const size_t objectEnd = findMatchingBracket(objectJson, valueStart, '{', '}');
    if (objectEnd == std::string::npos) {
        return "";
    }
    return objectJson.substr(valueStart, objectEnd - valueStart + 1);
}

std::string escapeJsonString(const std::string& value) {
    std::ostringstream out;
    for (const char ch : value) {
        switch (ch) {
            case '\\': out << "\\\\"; break;
            case '"': out << "\\\""; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default: out << ch; break;
        }
    }
    return out.str();
}

} // namespace

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

LLMConfig::LLMConfig() = default;

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
    return parseJson(jsonConfig);
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

bool LLMConfig::parseJson(const std::string& jsonConfig) {
    providers.clear();
    activeProvider = parseStringField(jsonConfig, "activeProvider", "claude_code_sdk");

    const std::string providersJson = extractObjectForKey(jsonConfig, "providers");
    if (providersJson.empty()) {
        validationErrors.push_back("No providers section found in config");
        return false;
    }

    const std::vector<std::string> knownProviders = {"claude_code_sdk", "anthropic_api"};
    for (const std::string& providerName : knownProviders) {
        const std::string providerJson = extractObjectForKey(providersJson, providerName);
        if (providerJson.empty()) {
            continue;
        }

        ProviderConfig config;
        config.enabled = parseBoolField(providerJson, "enabled", true);
        config.model = parseStringField(providerJson, "model");
        config.endpoint = parseStringField(providerJson, "endpoint");
        config.apiKeyEnv = parseStringField(providerJson, "apiKeyEnv");
        config.command = parseStringField(providerJson, "command");
        config.args = parseStringArrayField(providerJson, "args");
        config.allowedTools = parseStringArrayField(providerJson, "allowedTools");

        const std::vector<std::string> parameterKeys = {
            "maxTokens", "temperature", "maxTurns", "nodeScriptPath", "sessionTimeout"
        };
        for (const std::string& key : parameterKeys) {
            const std::string value = parseScalarField(providerJson, key);
            if (!value.empty()) {
                config.parameters[key] = value;
            }
        }

        providers[providerName] = config;
    }

    validateConfiguration();
    return validationErrors.empty();
}

std::string LLMConfig::generateJson() const {
    std::ostringstream json;
    json << "{\n";
    json << "  \"activeProvider\": \"" << escapeJsonString(activeProvider) << "\",\n";
    json << "  \"providers\": {\n";

    bool firstProvider = true;
    for (const auto& pair : providers) {
        if (!firstProvider) {
            json << ",\n";
        }
        firstProvider = false;

        const std::string& name = pair.first;
        const ProviderConfig& config = pair.second;
        json << "    \"" << escapeJsonString(name) << "\": {\n";
        json << "      \"enabled\": " << (config.enabled ? "true" : "false");

        auto appendStringField = [&json](const std::string& key, const std::string& value) {
            if (!value.empty()) {
                json << ",\n"
                     << "      \"" << escapeJsonString(key) << "\": \"" << escapeJsonString(value) << "\"";
            }
        };
        auto appendArrayField = [&json](const std::string& key, const std::vector<std::string>& values) {
            if (!values.empty()) {
                json << ",\n"
                     << "      \"" << escapeJsonString(key) << "\": [";
                for (size_t i = 0; i < values.size(); ++i) {
                    if (i > 0) {
                        json << ", ";
                    }
                    json << "\"" << escapeJsonString(values[i]) << "\"";
                }
                json << "]";
            }
        };

        appendStringField("model", config.model);
        appendStringField("endpoint", config.endpoint);
        appendStringField("apiKeyEnv", config.apiKeyEnv);
        appendStringField("command", config.command);
        appendArrayField("args", config.args);
        appendArrayField("allowedTools", config.allowedTools);

        for (const auto& param : config.parameters) {
            appendStringField(param.first, param.second);
        }

        json << "\n    }";
    }

    json << "\n  }\n";
    json << "}\n";
    return json.str();
}

void LLMConfig::validateConfiguration() {
    if (activeProvider.empty()) {
        validationErrors.push_back("No active provider specified");
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
        }
        
        // (No command-based provider validation needed — claude_code removed)
    }
}

std::string LLMConfig::getDefaultConfigJson() {
    return R"({
  "activeProvider": "claude_code_sdk",
  "providers": {
    "claude_code_sdk": {
      "enabled": true,
      "model": "claude-sonnet-4-6",
      "maxTurns": 50,
      "allowedTools": ["Read", "Write", "Grep", "Bash", "LS", "WebSearch", "WebFetch"],
      "nodeScriptPath": "app/llm/sdk_bridge/claude_sdk_bridge.js",
      "sessionTimeout": 3600
    },
    "anthropic_api": {
      "enabled": true,
      "model": "claude-sonnet-4-6",
      "endpoint": "https://api.anthropic.com/v1/messages",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "maxTokens": "4096",
      "temperature": "0.7"
    }
  }
})";
}
