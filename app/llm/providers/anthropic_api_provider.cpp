/*---------------------------------------------------------*/
/*                                                         */
/*   anthropic_api_provider_simple.cpp - Simple Version   */
/*                                                         */
/*---------------------------------------------------------*/

#include "anthropic_api_provider.h"
#include "../base/llm_provider_factory.h"

#include <cstdio>
#include <cstdlib>
#include <memory>
#include <sstream>
#include <chrono>
#include <fstream>
#include <algorithm>
#include <fcntl.h>
#include <unistd.h>

// Register this provider with the factory
REGISTER_LLM_PROVIDER("anthropic_api", AnthropicAPIProvider);

AnthropicAPIProvider::AnthropicAPIProvider() {
    endpoint = "https://api.anthropic.com/v1/messages";
    model = "claude-haiku-4-5";
    maxTokens = 4096;
    temperature = 1.0;
}

AnthropicAPIProvider::~AnthropicAPIProvider() {
    cancel();
}

bool AnthropicAPIProvider::sendQuery(const LLMRequest& request, ResponseCallback callback) {
    if (busy || request.message.empty()) {
        return false;
    }
    
    clearError();
    busy = true;

    if (!isAvailable()) {
        busy = false;
        LLMResponse response;
        response.provider_name = getProviderName();
        response.model_used = model;
        response.is_error = true;
        response.error_message = "API key not configured";
        if (callback) callback(response);
        return false;
    }

    // Build JSON request payload.
    const std::string jsonRequest = buildSimpleRequestJson(request);

    // Create a unique temp file for payload (avoid collisions across concurrent runs).
    char tmpTemplate[] = "/tmp/anthropic_simple_XXXXXX";
    int tmpFd = mkstemp(tmpTemplate);
    if (tmpFd == -1) {
        busy = false;
        LLMResponse response;
        response.provider_name = getProviderName();
        response.model_used = model;
        response.is_error = true;
        response.error_message = "Failed to create temp file for payload";
        setError(response.error_message);
        if (callback) callback(response);
        return false;
    }

    activeTempFile = tmpTemplate;
    ssize_t written = write(tmpFd, jsonRequest.data(), jsonRequest.size());
    close(tmpFd);
    if (written < 0 || static_cast<size_t>(written) != jsonRequest.size()) {
        unlink(activeTempFile.c_str());
        activeTempFile.clear();
        busy = false;
        LLMResponse response;
        response.provider_name = getProviderName();
        response.model_used = model;
        response.is_error = true;
        response.error_message = "Failed to write payload to temp file";
        setError(response.error_message);
        if (callback) callback(response);
        return false;
    }

    // Build curl command.
    std::string curlCmd = "curl -sS --max-time 30 ";
    curlCmd += "-H \"Content-Type: application/json\" ";
    curlCmd += "-H \"x-api-key: " + apiKey + "\" ";
    curlCmd += "-H \"anthropic-version: 2023-06-01\" ";
    curlCmd += "-X POST ";
    curlCmd += "\"" + endpoint + "\" ";
    curlCmd += "--data @" + activeTempFile;

    // Log without leaking the API key.
    const std::string maskedKey = apiKey.size() > 16 ? apiKey.substr(0, 16) + "****" : "****";
    fprintf(stderr, "DEBUG: Anthropic API call (async): POST %s (key: %s, payload: %s)\n",
            endpoint.c_str(), maskedKey.c_str(), activeTempFile.c_str());

    // Start async execution (non-blocking read in poll()).
    activePipe = popen(curlCmd.c_str(), "r");
    if (!activePipe) {
        unlink(activeTempFile.c_str());
        activeTempFile.clear();
        busy = false;
        LLMResponse response;
        response.provider_name = getProviderName();
        response.model_used = model;
        response.is_error = true;
        response.error_message = "Failed to execute curl";
        setError(response.error_message);
        if (callback) callback(response);
        return false;
    }

    // Set non-blocking mode on pipe.
    int fd = fileno(activePipe);
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);

    pendingCallback = callback;
    pendingRequest = request;
    outputBuffer.clear();
    requestStart = std::chrono::high_resolution_clock::now();

    return true;
}

bool AnthropicAPIProvider::isAvailable() const {
    return !apiKey.empty();
}

bool AnthropicAPIProvider::isBusy() const {
    return busy;
}

void AnthropicAPIProvider::cancel() {
    if (!busy) return;

    busy = false;

    if (activePipe) {
        pclose(activePipe);
        activePipe = nullptr;
    }

    if (!activeTempFile.empty()) {
        unlink(activeTempFile.c_str());
        activeTempFile.clear();
    }

    outputBuffer.clear();

    if (pendingCallback) {
        LLMResponse response;
        response.provider_name = getProviderName();
        response.model_used = model;
        response.is_error = true;
        response.error_message = "Request cancelled by user";
        pendingCallback(response);
        pendingCallback = nullptr;
    }
}

void AnthropicAPIProvider::poll() {
    if (!busy || !activePipe) {
        return;
    }

    // Read available output (non-blocking).
    char buffer[4096];
    clearerr(activePipe);
    size_t bytesRead = fread(buffer, 1, sizeof(buffer) - 1, activePipe);
    if (bytesRead > 0) {
        buffer[bytesRead] = '\0';
        outputBuffer += buffer;
    }

    // Check for completion.
    if (feof(activePipe)) {
        int exitCode = pclose(activePipe);
        activePipe = nullptr;
        busy = false;

        auto endTime = std::chrono::high_resolution_clock::now();
        const int durationMs = (int)std::chrono::duration_cast<std::chrono::milliseconds>(
            endTime - requestStart).count();

        LLMResponse response;
        response.provider_name = getProviderName();
        response.model_used = model;
        response.duration_ms = durationMs;

        if (exitCode != 0 || outputBuffer.empty()) {
            response.is_error = true;
            response.error_message = "Curl failed or empty response. Exit code: " + std::to_string(exitCode);
            response.session_id = "CURL_ERROR: " + outputBuffer;
            setError(response.error_message);
        } else {
            response = parseSimpleResponse(outputBuffer);
            response.provider_name = getProviderName();
            response.model_used = model;
            response.duration_ms = durationMs;

            // Add tool count debug info (parity with previous synchronous path).
            std::vector<Tool> allTools = registeredTools;
            allTools.insert(allTools.end(), pendingRequest.tools.begin(), pendingRequest.tools.end());
            response.session_id += " TOOLS_SENT: " + std::to_string(allTools.size());

            // Add to conversation history if successful.
            if (!response.is_error) {
                if (!pendingRequest.message.empty()) {
                    conversationHistory.push_back(std::make_pair("user", pendingRequest.message));
                }
                if (!response.result.empty()) {
                    conversationHistory.push_back(std::make_pair("assistant", response.result));
                }
            }
        }

        if (!activeTempFile.empty()) {
            unlink(activeTempFile.c_str());
            activeTempFile.clear();
        }

        outputBuffer.clear();
        pendingRequest = LLMRequest{};

        if (pendingCallback) {
            pendingCallback(response);
            pendingCallback = nullptr;
        }
    }
}

std::vector<std::string> AnthropicAPIProvider::getSupportedModels() const {
    return {
        "claude-haiku-4-5",
        "claude-sonnet-4-5"
    };
}

bool AnthropicAPIProvider::configure(const std::string& config) {
    // Pull API key from the configured env var (apiKeyEnv), then fallback helper.
    std::string keyEnv = "ANTHROPIC_API_KEY";
    auto parseStringField = [](const std::string& src, const std::string& field) -> std::string {
        std::string pat = "\"" + field + "\"";
        size_t pos = src.find(pat);
        if (pos == std::string::npos) return {};
        size_t start = src.find("\"", pos + pat.size());
        if (start == std::string::npos) return {};
        start++;
        size_t end = src.find("\"", start);
        if (end == std::string::npos) return {};
        return src.substr(start, end - start);
    };

    std::string cfgModel     = parseStringField(config, "model");
    std::string cfgEndpoint  = parseStringField(config, "endpoint");
    std::string cfgApiKeyEnv = parseStringField(config, "apiKeyEnv");

    if (!cfgModel.empty()) {
        model = cfgModel;
    }
    if (!cfgEndpoint.empty()) {
        endpoint = cfgEndpoint;
    }
    if (!cfgApiKeyEnv.empty()) {
        keyEnv = cfgApiKeyEnv;
    }

    const char* envVal = std::getenv(keyEnv.c_str());
    if (envVal) {
        apiKey = envVal;
    }
    // API key sourced from environment variable (or injected at runtime via setApiKey)

    if (apiKey.empty()) {
        fprintf(stderr, "INFO: Anthropic API key not in env (%s) — can be set at runtime via setApiKey()\n", keyEnv.c_str());
    } else {
        fprintf(stderr, "DEBUG: Anthropic API key loaded from %s (len=%zu)\n", keyEnv.c_str(), apiKey.size());
    }

    // Return true even without key — key can be injected at runtime via setApiKey()
    return true;
}

void AnthropicAPIProvider::resetSession() {
    conversationHistory.clear();
}

void AnthropicAPIProvider::setApiKey(const std::string& key) {
    apiKey = key;
    std::string masked = key.size() > 16 ? key.substr(0, 16) + "****" : "****";
    fprintf(stderr, "DEBUG: API key set at runtime (%s, len=%zu)\n", masked.c_str(), apiKey.size());
}

LLMResponse AnthropicAPIProvider::makeSimpleAPIRequest(const LLMRequest& request) {
    LLMResponse response;
    response.provider_name = getProviderName();
    response.model_used = model;
    
    auto startTime = std::chrono::high_resolution_clock::now();
    
    if (!isAvailable()) {
        response.is_error = true;
        response.error_message = "API key not configured";
        return response;
    }
    
    // Build simple JSON request
    std::string jsonRequest = buildSimpleRequestJson(request);
    
    // Create temp file for JSON payload
    std::string tempFile = "/tmp/anthropic_simple.json";
    std::ofstream outFile(tempFile);
    outFile << jsonRequest;
    outFile.close();
    
    // Build curl command
    std::string curlCmd = "curl -sS --max-time 30 ";
    curlCmd += "-H \"Content-Type: application/json\" ";
    curlCmd += "-H \"x-api-key: " + apiKey + "\" ";  // Key passed to curl, not logged
    curlCmd += "-H \"anthropic-version: 2023-06-01\" ";
    curlCmd += "-X POST ";
    curlCmd += "\"" + endpoint + "\" ";
    curlCmd += "--data @" + tempFile;

    // Log curl command with masked API key
    std::string maskedKey = apiKey.size() > 16
        ? apiKey.substr(0, 16) + "****"
        : "****";
    fprintf(stderr, "DEBUG: Anthropic API call: POST %s (key: %s, payload: %s)\n",
            endpoint.c_str(), maskedKey.c_str(), tempFile.c_str());

    // Execute curl and capture output
    FILE* pipe = popen(curlCmd.c_str(), "r");
    if (!pipe) {
        response.is_error = true;
        response.error_message = "Failed to execute curl";
        return response;
    }
    
    std::string apiResponse;
    char buffer[4096];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        apiResponse += buffer;
    }
    
    int exitCode = pclose(pipe);
    
    auto endTime = std::chrono::high_resolution_clock::now();
    response.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    
    if (exitCode != 0 || apiResponse.empty()) {
        response.is_error = true;
        response.error_message = "Curl failed or empty response. Exit code: " + std::to_string(exitCode);
        response.session_id = "CURL_ERROR: " + apiResponse;
        return response;
    }
    
    // Parse response
    response = parseSimpleResponse(apiResponse);
    response.provider_name = getProviderName();
    response.model_used = model;
    response.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    
    // Add tool count debug info
    std::vector<Tool> allTools = registeredTools;
    allTools.insert(allTools.end(), request.tools.begin(), request.tools.end());
    response.session_id += " TOOLS_SENT: " + std::to_string(allTools.size());
    
    // Add to conversation history if successful
    if (!response.is_error) {
        if (!request.message.empty()) {
            conversationHistory.push_back(std::make_pair("user", request.message));
        }
        if (!response.result.empty()) {
            conversationHistory.push_back(std::make_pair("assistant", response.result));
        }
    }
    
    return response;
}

std::string AnthropicAPIProvider::buildSimpleRequestJson(const LLMRequest& request) const {
    std::ostringstream json;

    json << "{\n";
    json << "  \"model\": \"" << model << "\",\n";
    json << "  \"max_tokens\": " << maxTokens << ",\n";

    // Add system prompt if provided
    if (!request.system_prompt.empty()) {
        json << "  \"system\": \"";
        // Simple escape
        for (char c : request.system_prompt) {
            if (c == '"') json << "\\\"";
            else if (c == '\\') json << "\\\\";
            else if (c == '\n') json << "\\n";
            else json << c;
        }
        json << "\",\n";
    }

    // Add tools if any are registered
    std::vector<Tool> allTools = registeredTools;
    allTools.insert(allTools.end(), request.tools.begin(), request.tools.end());
    
    // Debug: will be shown in response parsing
    
    if (!allTools.empty()) {
        json << "  \"tools\": [\n";
        for (size_t i = 0; i < allTools.size(); ++i) {
            if (i > 0) json << ",\n";
            json << "    {\n";
            json << "      \"name\": \"" << allTools[i].name << "\",\n";
            json << "      \"description\": \"" << allTools[i].description << "\",\n";
            json << "      \"input_schema\": " << allTools[i].input_schema << "\n";
            json << "    }";
        }
        json << "\n  ],\n";
    }
    
    // Add conversation history
    json << "  \"messages\": [\n";
    
    bool first = true;
    
    // Add history
    for (const auto& msg : conversationHistory) {
        if (!msg.second.empty()) {
            if (!first) json << ",\n";
            first = false;
            json << "    {\"role\": \"" << msg.first << "\", \"content\": \"";
            // Simple escape
            for (char c : msg.second) {
                if (c == '"') json << "\\\"";
                else if (c == '\\') json << "\\\\";
                else if (c == '\n') json << "\\n";
                else json << c;
            }
            json << "\"}";
        }
    }
    
    // Add tool results if any
    for (const auto& result : request.tool_results) {
        if (!first) json << ",\n";
        first = false;
        
        json << "    {\n";
        json << "      \"role\": \"user\",\n";
        json << "      \"content\": [\n";
        json << "        {\n";
        json << "          \"type\": \"tool_result\",\n";
        json << "          \"tool_use_id\": \"" << result.tool_use_id << "\",\n";
        if (result.is_error) {
            json << "          \"is_error\": true,\n";
            json << "          \"content\": \"" << result.error_message << "\"\n";
        } else {
            json << "          \"content\": \"" << result.content << "\"\n";
        }
        json << "        }\n";
        json << "      ]\n";
        json << "    }";
    }
    
    // Add current message
    if (!first) json << ",\n";
    json << "    {\"role\": \"user\", \"content\": \"";
    // Simple escape
    for (char c : request.message) {
        if (c == '"') json << "\\\"";
        else if (c == '\\') json << "\\\\"; 
        else if (c == '\n') json << "\\n";
        else json << c;
    }
    json << "\"}\n";
    
    json << "  ]\n";
    json << "}\n";
    
    return json.str();
}

LLMResponse AnthropicAPIProvider::parseSimpleResponse(const std::string& response) const {
    LLMResponse result;
    
    // Store raw response for debug - show more for tool debugging
    result.session_id = "RAW_RESPONSE: " + (response.length() > 800 ? response.substr(0, 800) + "..." : response);
    
    // Check for tool_use first
    if (response.find("\"tool_use\"") != std::string::npos) {
        result.needs_tool_execution = true;
        result.session_id += " [TOOL_USE_DETECTED]";
        
        // Simple tool extraction - look for name and id
        size_t namePos = response.find("\"name\":");
        size_t idPos = response.find("\"id\":");
        
        if (namePos != std::string::npos && idPos != std::string::npos) {
            // Extract tool name
            size_t nameStart = response.find("\"", namePos + 7);
            if (nameStart != std::string::npos) {
                nameStart++;
                size_t nameEnd = response.find("\"", nameStart);
                if (nameEnd != std::string::npos) {
                    ToolCall call;
                    call.name = response.substr(nameStart, nameEnd - nameStart);
                    
                    // Extract tool id  
                    size_t idStart = response.find("\"", idPos + 5);
                    if (idStart != std::string::npos) {
                        idStart++;
                        size_t idEnd = response.find("\"", idStart);
                        if (idEnd != std::string::npos) {
                            call.id = response.substr(idStart, idEnd - idStart);
                            call.input = "{}"; // Simple default
                            result.tool_calls.push_back(call);
                        }
                    }
                }
            }
        }
        
        // If we found tools, return for execution (no text response yet)
        if (!result.tool_calls.empty()) {
            result.result = ""; // Empty result - tool execution will provide real response
            result.session_id = "TOOL_TRIGGER: " + result.tool_calls[0].name; 
            return result;
        } else if (result.needs_tool_execution) {
            result.result = "Tool use detected but extraction failed - check parser";
            return result;
        }
    }
    
    // Simple JSON parsing - look for "content":[{"text":"..."}] 
    size_t contentPos = response.find("\"content\"");
    if (contentPos == std::string::npos) {
        result.is_error = true;
        result.error_message = "No content found in response. Raw: " + result.session_id;
        return result;
    }
    
    // Find the text field
    size_t textPos = response.find("\"text\":", contentPos);
    if (textPos == std::string::npos) {
        // No text field - might be tool_use only response
        if (result.needs_tool_execution) {
            return result; // Valid tool_use response
        }
        result.is_error = true; 
        result.error_message = "No text field found. Raw: " + result.session_id;
        return result;
    }
    
    // Find the text value
    size_t start = response.find("\"", textPos + 7);
    if (start == std::string::npos) {
        result.is_error = true;
        result.error_message = "Malformed text field";
        return result;
    }
    start++; // Skip opening quote
    
    // Find end quote (simple - doesn't handle escaped quotes properly)
    size_t end = response.find("\"", start);
    if (end == std::string::npos) {
        result.is_error = true;
        result.error_message = "Unclosed text field";
        return result;
    }
    
    result.result = response.substr(start, end - start);
    
    // Simple unescape
    size_t pos = 0;
    while ((pos = result.result.find("\\n", pos)) != std::string::npos) {
        result.result.replace(pos, 2, "\n");
        pos += 1;
    }
    
    return result;
}

void AnthropicAPIProvider::setError(const std::string& error) {
    lastError = error;
}

void AnthropicAPIProvider::clearError() {
    lastError.clear();
}

// Tool support - minimal for now
void AnthropicAPIProvider::registerTool(const Tool& tool) {
    registeredTools.push_back(tool);
}

void AnthropicAPIProvider::clearTools() {
    registeredTools.clear();
}
