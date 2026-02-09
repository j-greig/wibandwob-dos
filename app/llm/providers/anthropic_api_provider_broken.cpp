/*---------------------------------------------------------*/
/*                                                         */
/*   anthropic_api_provider.cpp - Anthropic API Provider  */
/*                                                         */
/*---------------------------------------------------------*/

#include "anthropic_api_provider.h"
#include "../base/llm_provider_factory.h"
#include "../../api_config_temp.h"  // TEMP: Hardcoded API key

#include <cstdio>
#include <cstdlib>
#include <memory>
#include <sstream>
#include <chrono>
#include <fcntl.h>
#include <unistd.h>
#include <fstream>

// Register this provider with the factory
REGISTER_LLM_PROVIDER("anthropic_api", AnthropicAPIProvider);

AnthropicAPIProvider::AnthropicAPIProvider() {
    // Default configuration will be overridden by configure()
}

AnthropicAPIProvider::~AnthropicAPIProvider() {
    cancel(); // Cleanup any active request
}

bool AnthropicAPIProvider::sendQuery(const LLMRequest& request, ResponseCallback callback) {
    if (busy || request.message.empty()) {
        return false;
    }
    
    clearError();
    
    // Start async API request
    return startAsyncAPIRequest(request, callback);
}

bool AnthropicAPIProvider::isAvailable() const {
    // Check if we have an API key
    return !apiKey.empty();
}

bool AnthropicAPIProvider::isBusy() const {
    return busy;
}

void AnthropicAPIProvider::cancel() {
    if (busy && activePipe) {
        pclose(activePipe);
        activePipe = nullptr;
        busy = false;
        
        if (pendingCallback) {
            LLMResponse response;
            response.provider_name = getProviderName();
            response.is_error = true;
            response.error_message = "Request cancelled by user";
            pendingCallback(response);
            pendingCallback = nullptr;
        }
        
        outputBuffer.clear();
    }
}

void AnthropicAPIProvider::poll() {
    pollAsyncRequest();
}

std::vector<std::string> AnthropicAPIProvider::getSupportedModels() const {
    return {
        "claude-3-5-haiku-latest",
        "claude-sonnet-4-20250514",
        "claude-opus-4-20250514", 
        "claude-opus-4-1-20250805",
        "claude-3-5-sonnet-latest",
        "claude-3-haiku-20240307",
        "claude-3-sonnet-20240229",
        "claude-3-opus-20240229"
    };
}

bool AnthropicAPIProvider::configure(const std::string& config) {
    // Parse configuration JSON
    // Look for endpoint
    size_t endpointPos = config.find("\"endpoint\"");
    if (endpointPos != std::string::npos) {
        size_t start = config.find("\"", endpointPos + 10);
        if (start != std::string::npos) {
            start++; // Skip opening quote
            size_t end = config.find("\"", start);
            if (end != std::string::npos) {
                endpoint = config.substr(start, end - start);
            }
        }
    }
    
    // Look for model
    size_t modelPos = config.find("\"model\"");
    if (modelPos != std::string::npos) {
        size_t start = config.find("\"", modelPos + 7);
        if (start != std::string::npos) {
            start++; // Skip opening quote
            size_t end = config.find("\"", start);
            if (end != std::string::npos) {
                model = config.substr(start, end - start);
            }
        }
    }
    
    // Look for API key environment variable
    size_t apiKeyEnvPos = config.find("\"apiKeyEnv\"");
    if (apiKeyEnvPos != std::string::npos) {
        size_t start = config.find("\"", apiKeyEnvPos + 11);
        if (start != std::string::npos) {
            start++; // Skip opening quote
            size_t end = config.find("\"", start);
            if (end != std::string::npos) {
                // TEMP: Use environment/fallback API key helper
                apiKey = ApiConfig::anthropicApiKey();
                fprintf(stderr, "DEBUG: Using runtime API key: %.20s...\n", apiKey.c_str());
            }
        }
    }
    
    // Look for maxTokens
    size_t maxTokensPos = config.find("\"maxTokens\"");
    if (maxTokensPos != std::string::npos) {
        size_t start = config.find("\"", maxTokensPos + 11);
        if (start != std::string::npos) {
            start++; // Skip opening quote
            size_t end = config.find("\"", start);
            if (end != std::string::npos) {
                std::string value = config.substr(start, end - start);
                try {
                    maxTokens = std::stoi(value);
                } catch (...) {
                    maxTokens = 4096; // Default
                }
            }
        }
    }
    
    // Look for temperature
    size_t tempPos = config.find("\"temperature\"");
    if (tempPos != std::string::npos) {
        size_t start = config.find("\"", tempPos + 13);
        if (start != std::string::npos) {
            start++; // Skip opening quote
            size_t end = config.find("\"", start);
            if (end != std::string::npos) {
                std::string value = config.substr(start, end - start);
                try {
                    temperature = std::stod(value);
                } catch (...) {
                    temperature = 0.7; // Default
                }
            }
        }
    }
    
    return !apiKey.empty();
}

void AnthropicAPIProvider::resetSession() {
    conversationHistory.clear();
}

bool AnthropicAPIProvider::startAsyncAPIRequest(const LLMRequest& request, ResponseCallback callback) {
    if (!isAvailable()) {
        LLMResponse response;
        response.provider_name = getProviderName();
        response.is_error = true;
        response.error_message = "Anthropic API key not configured";
        setError(response.error_message);
        if (callback) callback(response);
        return false;
    }
    
    // Debug: check API key
    // fprintf(stderr, "API key configured: %s\n", apiKey.empty() ? "NO" : "YES");
    
    // Build the request JSON
    std::string requestJson = buildRequestJson(request);
    
    // Build headers (without \\r\\n - curl will add proper line endings)
    std::string headers = 
        "Content-Type: application/json\n"
        "x-api-key: " + apiKey + "\n"
        "anthropic-version: 2023-06-01\n";
    
    // Build the curl command for async execution with timeout and verbose error output
    std::string command = "curl --max-time 30 --connect-timeout 10 -X POST '" + endpoint + "' ";
    
    // Add headers
    std::istringstream headerStream(headers);
    std::string line;
    while (std::getline(headerStream, line)) {
        if (!line.empty() && line.back() == '\r') {
            line.pop_back(); // Remove \\r
        }
        if (!line.empty()) {
            command += "-H \"" + line + "\" ";
        }
    }
    
    // Use temp file for payload to avoid escaping issues
    std::string tempFile = "/tmp/anthropic_payload.json";
    std::ofstream payloadFile(tempFile);
    payloadFile << requestJson;
    payloadFile.close();
    
    // JSON payload will be logged in parseAPIResponse via session_id
    
    command += "--data @" + tempFile + " -S 2>&1";
    
    // Curl command will be logged in parseAPIResponse via session_id
    
    // Start async execution
    activePipe = popen(command.c_str(), "r");
    if (!activePipe) {
        LLMResponse response;
        response.provider_name = getProviderName();
        response.is_error = true;
        response.error_message = "Failed to execute curl command";
        setError(response.error_message);
        if (callback) callback(response);
        return false;
    }
    
    // Set non-blocking mode on pipe
    int fd = fileno(activePipe);
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);
    
    busy = true;
    pendingCallback = callback;
    pendingRequest = request;
    outputBuffer.clear();
    
    // Store request JSON for debug logging
    pendingRequestJson = requestJson;
    
    return true;
}

void AnthropicAPIProvider::pollAsyncRequest() {
    if (!busy || !activePipe) {
        return;
    }
    
    // Read available data from pipe (non-blocking)
    char buffer[4096];
    clearerr(activePipe); // Clear any previous error flags
    size_t bytesRead = fread(buffer, 1, sizeof(buffer) - 1, activePipe);
    
    if (bytesRead > 0) {
        buffer[bytesRead] = '\0';
        outputBuffer += buffer;
    }
    
    // Check if process is done (only check EOF, not errors for non-blocking)
    if (feof(activePipe)) {
        int exitCode = pclose(activePipe);
        activePipe = nullptr;
        busy = false;
        
        // Debug output goes to chat log via session_id
        
        // Add curl debug to response for chat log
        std::string curlDebug = "CURL_EXIT_CODE: " + std::to_string(exitCode) + ", OUTPUT_LENGTH: " + std::to_string(outputBuffer.length());
        
        // Parse response and call callback
        LLMResponse response;
        response.provider_name = getProviderName();
        response.model_used = model;
        
        if (exitCode == 0) {
            response = parseAPIResponse(outputBuffer);
            response.provider_name = getProviderName();
            response.model_used = model;
            
            // Add curl debug to session_id for chat log visibility
            response.session_id = curlDebug + "\n" + response.session_id;
            
            // Add to conversation history if successful
            if (!response.is_error) {
                if (!pendingRequest.message.empty())
                    conversationHistory.push_back(std::make_pair("user", pendingRequest.message));
                if (!response.result.empty())
                    conversationHistory.push_back(std::make_pair("assistant", response.result));
            }
        } else {
            response.is_error = true;
            response.error_message = "Curl command failed with exit code " + std::to_string(exitCode);
            if (!outputBuffer.empty()) {
                response.error_message += ": " + outputBuffer;
            }
            setError(response.error_message);
            
            // Add curl debug to session_id for chat log visibility  
            response.session_id = curlDebug + " ERROR: " + response.error_message;
        }
        
        // Call the callback
        if (pendingCallback) {
            pendingCallback(response);
            pendingCallback = nullptr;
        }
        
        outputBuffer.clear();
    }
}

LLMResponse AnthropicAPIProvider::makeAPIRequest(const LLMRequest& request) {
    LLMResponse response;
    response.provider_name = getProviderName();
    response.model_used = model;
    
    auto startTime = std::chrono::high_resolution_clock::now();
    
    if (!isAvailable()) {
        response.is_error = true;
        response.error_message = "Anthropic API key not configured";
        setError(response.error_message);
        return response;
    }
    
    // Build the request JSON
    std::string requestJson = buildRequestJson(request);
    
    // Build headers
    std::string headers = 
        "Content-Type: application/json\r\n"
        "x-api-key: " + apiKey + "\r\n"
        "anthropic-version: 2023-06-01\r\n";
    
    // Make the HTTP request
    std::string apiResponse = performHttpRequest(endpoint, headers, requestJson);
    
    auto endTime = std::chrono::high_resolution_clock::now();
    response.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    
    if (apiResponse.empty()) {
        response.is_error = true;
        response.error_message = "Empty response from Anthropic API";
        setError(response.error_message);
        return response;
    }
    
    // Parse the response
    response = parseAPIResponse(apiResponse);
    response.provider_name = getProviderName();
    response.model_used = model;
    response.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    
    // Add to conversation history if successful (only non-empty content)
    if (!response.is_error) {
        if (!request.message.empty())
            conversationHistory.push_back(std::make_pair("user", request.message));
        if (!response.result.empty())
            conversationHistory.push_back(std::make_pair("assistant", response.result));
    }
    
    return response;
}

std::string AnthropicAPIProvider::buildRequestJson(const LLMRequest& request) const {
    std::ostringstream json;
    
    json << "{\n";
    json << "  \"model\": \"" << model << "\",\n";
    json << "  \"max_tokens\": " << maxTokens << ",\n";
    json << "  \"temperature\": " << temperature << ",\n";
    
    // System prompt
    auto esc = [](const std::string &s){ std::ostringstream o; for(char c: s){ switch(c){ case '"': o<<"\\\""; break; case '\\': o<<"\\\\"; break; case '\n': o<<"\\n"; break; case '\r': o<<"\\r"; break; case '\t': o<<"\\t"; break; default: o<<c; } } return o.str(); };
    if (!request.system_prompt.empty()) {
        json << "  \"system\": \"" << esc(request.system_prompt) << "\",\n";
    }
    
    // Add tools if any are registered or provided in request
    std::vector<Tool> allTools = registeredTools;
    allTools.insert(allTools.end(), request.tools.begin(), request.tools.end());
    
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
    
    json << "  \"messages\": [\n";
    
    // Add conversation history (skip empty assistant/user messages to satisfy API constraint)
    bool first = true;
    for (const auto& msg : conversationHistory) {
        if (!msg.second.empty()) {
            if (!first) json << ",\n";
            first = false;
            json << "    {\n";
            json << "      \"role\": \"" << msg.first << "\",\n";
            json << "      \"content\": \"" << esc(msg.second) << "\"\n";
            json << "    }";
        }
    }
    
    // (No assistant tool_use injection here; relying on Anthropic to thread context.)

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
            json << "          \"content\": \"";
            for (char c : result.error_message) { if (c=='"') json << "\\\""; else if (c=='\\') json << "\\\\"; else if (c=='\n') json << "\\n"; else if (c=='\r') json << "\\r"; else if (c=='\t') json << "\\t"; else json << c; }
            json << "\"\n";
        } else {
            json << "          \"content\": \"";
            for (char c : result.content) { if (c=='"') json << "\\\""; else if (c=='\\') json << "\\\\"; else if (c=='\n') json << "\\n"; else if (c=='\r') json << "\\r"; else if (c=='\t') json << "\\t"; else json << c; }
            json << "\"\n";
        }
        json << "        }\n";
        json << "      ]\n";
        json << "    }";
    }
    
    // Add current message
    if (!first) json << ",\n";
    json << "    {\n";
    json << "      \"role\": \"user\",\n";
    json << "      \"content\": \"" << esc(request.message) << "\"\n";
    json << "    }\n";
    
    json << "  ]\n";
    json << "}\n";
    
    return json.str();
}

LLMResponse AnthropicAPIProvider::parseAPIResponse(const std::string& response) const {
    LLMResponse result;
    
    // Store debug info in result for chat log
    result.model_used = "claude-3-5-haiku-latest";
    result.provider_name = "anthropic_api";
    
    // Store raw response for debugging (first 500 chars)
    std::string debugResponse = response.length() > 500 ? response.substr(0, 500) + "..." : response;
    result.session_id = "RAW_API_RESPONSE: " + debugResponse;
    
    // Add parsing debug info to session_id
    result.session_id += "\nPARSE_DEBUG: Starting tool_use parsing...";
    
    // Simple JSON parsing - look for error first
    if (response.find("\"error\"") != std::string::npos) {
        result.is_error = true;
        
        // Extract error message
        size_t msgStart = response.find("\"message\"");
        if (msgStart != std::string::npos) {
            size_t start = response.find("\"", msgStart + 9);
            if (start != std::string::npos) {
                start++; // Skip opening quote
                size_t end = response.find("\"", start);
                if (end != std::string::npos) {
                    result.error_message = response.substr(start, end - start);
                }
            }
        }
        
        if (result.error_message.empty()) {
            result.error_message = "API request failed";
        }
        
        return result;
    }
    
    // Look for tool_use blocks first (allow both spaced and non-spaced variants)
    size_t toolUsePos = response.find("\"type\":\"tool_use\"");
    if (toolUsePos == std::string::npos)
        toolUsePos = response.find("\"type\": \"tool_use\"");
    if (toolUsePos != std::string::npos) {
        result.needs_tool_execution = true;
        result.session_id += "\nPARSE_DEBUG: Found tool_use pattern at pos " + std::to_string(toolUsePos);
        
        // Find the content array to properly parse tool_use blocks
        size_t contentStart = response.find("\"content\":[");
        if (contentStart == std::string::npos)
            contentStart = response.find("\"content\": [");
        if (contentStart != std::string::npos) {
            result.session_id += "\nPARSE_DEBUG: Found content array at pos " + std::to_string(contentStart);
            
            // Extract all tool_use blocks within the content array
            size_t searchPos = contentStart;
            while (true) {
                size_t posA = response.find("\"type\":\"tool_use\"", searchPos);
                size_t posB = response.find("\"type\": \"tool_use\"", searchPos);
                toolUsePos = (posA == std::string::npos) ? posB : ((posB == std::string::npos) ? posA : std::min(posA, posB));
                if (toolUsePos == std::string::npos) break;
                ToolCall call;
                fprintf(stderr, "DEBUG: Processing tool_use block at position %zu\n", toolUsePos);
                
                // Find the tool_use object boundaries more carefully
                // Look backwards for the nearest opening brace of this tool_use object
                size_t blockStart = toolUsePos;
                while (blockStart > 0 && response[blockStart] != '{') {
                    blockStart--;
                }
                
                // Find the matching closing brace by counting braces
                size_t blockEnd = toolUsePos;
                int braceCount = 0;
                bool foundStart = false;
                
                while (blockEnd < response.length()) {
                    if (response[blockEnd] == '{') {
                        braceCount++;
                        foundStart = true;
                    } else if (response[blockEnd] == '}') {
                        braceCount--;
                        if (foundStart && braceCount == 0) {
                            break;
                        }
                    }
                    blockEnd++;
                }
                
                if (blockStart < toolUsePos && blockEnd > toolUsePos) {
                    std::string block = response.substr(blockStart, blockEnd - blockStart + 1);
                    fprintf(stderr, "DEBUG: Extracted tool block: %.100s...\n", block.c_str());
                    
                    // Extract id - allow optional spaces
                    size_t idPattern = block.find("\"id\":\"");
                    if (idPattern == std::string::npos) idPattern = block.find("\"id\": \"");
                    if (idPattern != std::string::npos) {
                        size_t idStart = idPattern + 7;
                        size_t idEnd = block.find("\"", idStart);
                        if (idEnd != std::string::npos) {
                            call.id = block.substr(idStart, idEnd - idStart);
                            fprintf(stderr, "DEBUG: Extracted tool id: %s\n", call.id.c_str());
                        }
                    }
                    
                    // Extract name - allow optional spaces
                    size_t namePattern = block.find("\"name\":\"");
                    if (namePattern == std::string::npos) namePattern = block.find("\"name\": \"");
                    if (namePattern != std::string::npos) {
                        size_t nameStart = namePattern + 9;
                        size_t nameEnd = block.find("\"", nameStart);
                        if (nameEnd != std::string::npos) {
                            call.name = block.substr(nameStart, nameEnd - nameStart);
                            fprintf(stderr, "DEBUG: Extracted tool name: %s\n", call.name.c_str());
                        }
                    }
                    
                    // Extract input - look for "input":{...} or "input":"..."
                    size_t inputPattern = block.find("\"input\":{");
                    if (inputPattern == std::string::npos) inputPattern = block.find("\"input\": {");
                    if (inputPattern != std::string::npos) {
                        // JSON object input
                        call.input = "{}";  // Most tools have empty input
                        fprintf(stderr, "DEBUG: Tool input: {} (object)\n");
                    } else {
                        size_t inputStringPattern = block.find("\"input\":\"");
                        if (inputStringPattern == std::string::npos) inputStringPattern = block.find("\"input\": \"");
                        if (inputStringPattern != std::string::npos) {
                            // String input
                            size_t inputStart = inputStringPattern + 10;
                            size_t inputEnd = block.find("\"", inputStart);
                            if (inputEnd != std::string::npos) {
                                call.input = block.substr(inputStart, inputEnd - inputStart);
                                fprintf(stderr, "DEBUG: Tool input: %s (string)\n", call.input.c_str());
                            }
                        }
                    }
                    
                    if (!call.id.empty() && !call.name.empty()) {
                        result.tool_calls.push_back(call);
                        result.session_id += "\nPARSE_DEBUG: Added tool call: " + call.name + " (" + call.id + ")";
                    } else {
                        result.session_id += "\nPARSE_DEBUG: Skipping incomplete tool call";
                    }
                }
                
                searchPos = toolUsePos + 1;
            }
            
            result.session_id += "\nPARSE_DEBUG: Total tool calls extracted: " + std::to_string(result.tool_calls.size());
        } else {
            result.session_id += "\nPARSE_DEBUG: Content array not found";
        }
    } else {
        result.session_id += "\nPARSE_DEBUG: No tool_use pattern found";
    }
    
    // Look for regular text content
    size_t contentPos = response.find("\"content\"");
    if (contentPos != std::string::npos) {
        // Find the actual text field (not the type field)
        size_t textFieldPos = response.find("\"text\":", contentPos);
        if (textFieldPos != std::string::npos) {
            size_t start = response.find("\"", textFieldPos + 7);
            if (start != std::string::npos) {
                start++; // Skip opening quote
                size_t end = start;
                
                // Find the end of the string value, handling escaped quotes
                while (end < response.length()) {
                    if (response[end] == '"' && (end == start || response[end-1] != '\\')) {
                        break;
                    }
                    end++;
                }
                
                if (end < response.length()) {
                    result.result = response.substr(start, end - start);
                    
                    // Unescape basic JSON escape sequences
                    size_t pos = 0;
                    while ((pos = result.result.find("\\n", pos)) != std::string::npos) {
                        result.result.replace(pos, 2, "\n");
                        pos += 1;
                    }
                    pos = 0;
                    while ((pos = result.result.find("\\r", pos)) != std::string::npos) {
                        result.result.replace(pos, 2, "\r");
                        pos += 1;
                    }
                    pos = 0;
                    while ((pos = result.result.find("\\t", pos)) != std::string::npos) {
                        result.result.replace(pos, 2, "\t");
                        pos += 1;
                    }
                    pos = 0;
                    while ((pos = result.result.find("\\\"", pos)) != std::string::npos) {
                        result.result.replace(pos, 2, "\"");
                        pos += 1;
                    }
                    pos = 0;
                    while ((pos = result.result.find("\\\\", pos)) != std::string::npos) {
                        result.result.replace(pos, 2, "\\");
                        pos += 1;
                    }
                }
            }
        }
    }
    
    // Success if we have either text content OR tool calls
    if (result.result.empty() && result.tool_calls.empty()) {
        result.is_error = true;
        result.error_message = "Parser failed - no text or tools found. Check raw response in session_id field";
    }

    // (No cross-call state for tool_use; rely on stateless history.)
    
    // Final debug info
    result.session_id += "\nPARSE_RESULT: text=" + std::to_string(result.result.length()) + " chars, tools=" + std::to_string(result.tool_calls.size()) + ", needs_execution=" + (result.needs_tool_execution ? "true" : "false");
    
    return result;
}

std::string AnthropicAPIProvider::performHttpRequest(const std::string& url, const std::string& headers, const std::string& payload) const {
    // Use curl to make the HTTP request
    std::string command = "curl -s -X POST '" + url + "' ";
    
    // Add headers
    std::istringstream headerStream(headers);
    std::string line;
    while (std::getline(headerStream, line)) {
        if (!line.empty() && line.back() == '\r') {
            line.pop_back(); // Remove \r
        }
        if (!line.empty()) {
            command += "-H '" + line + "' ";
        }
    }
    
    // Use temp file for payload to avoid escaping issues
    std::string tempFile2 = "/tmp/anthropic_payload2.json";
    std::ofstream payloadFile2(tempFile2);
    payloadFile2 << payload;
    payloadFile2.close();
    
    command += "--data @" + tempFile2;
    
    // Execute the command
    FILE* pipe = popen(command.c_str(), "r");
    if (!pipe) {
        return "";
    }
    
    std::string result;
    char buffer[4096];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result += buffer;
    }
    
    pclose(pipe);
    
    return result;
}

void AnthropicAPIProvider::setError(const std::string& error) {
    lastError = error;
}

void AnthropicAPIProvider::clearError() {
    lastError.clear();
}

// Tool support methods
void AnthropicAPIProvider::registerTool(const Tool& tool) {
    registeredTools.push_back(tool);
}

void AnthropicAPIProvider::clearTools() {
    registeredTools.clear();
}
