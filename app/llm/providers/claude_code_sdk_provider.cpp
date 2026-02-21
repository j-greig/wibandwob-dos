/*---------------------------------------------------------*/
/*                                                         */
/*   claude_code_sdk_provider.cpp - Claude Code SDK Provider*/
/*   Streaming mode with customSystemPrompt support       */
/*                                                         */
/*---------------------------------------------------------*/

#include "claude_code_sdk_provider.h"
#include "claude_code_provider.h" // Fallback
#include "../base/llm_provider_factory.h"
#include "../base/path_search.h"

#include <cstdio>
#include <cstdlib>
#include <memory>
#include <sstream>
#include <algorithm>
#include <chrono>
#include <iomanip>
#include <unistd.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <signal.h>
#include <iostream>

// Register this provider with the factory
REGISTER_LLM_PROVIDER("claude_code_sdk", ClaudeCodeSDKProvider);

// Helper: escape string for JSON embedding
static std::string escapeJsonString(const std::string& s) {
    std::ostringstream out;
    for (char c : s) {
        switch (c) {
            case '"':  out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    // Control char: output as \uXXXX
                    out << "\\u" << std::hex << std::setfill('0')
                        << std::setw(4) << static_cast<int>(c);
                } else {
                    out << c;
                }
        }
    }
    return out.str();
}

// Minimal JSON string extractor for our bridge responses (handles common escapes)
static std::string extractJsonStringField(const std::string& json, const std::string& key) {
    const std::string pattern = "\"" + key + "\":\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos)
        return "";
    pos += pattern.size();
    std::string out;
    bool escape = false;
    for (size_t i = pos; i < json.size(); ++i) {
        char c = json[i];
        if (escape) {
            switch (c) {
                case '\\': out.push_back('\\'); break;
                case '"':  out.push_back('"'); break;
                case 'n':  out.push_back('\n'); break;
                case 'r':  out.push_back('\r'); break;
                case 't':  out.push_back('\t'); break;
                default:   out.push_back(c); break;
            }
            escape = false;
            continue;
        }
        if (c == '\\') {
            escape = true;
            continue;
        }
        if (c == '"') {
            break; // end of field
        }
        out.push_back(c);
    }
    return out;
}

// Node.js bridge process management
struct ClaudeCodeSDKProvider::NodeBridge {
    FILE* input = nullptr;
    FILE* output = nullptr;
    pid_t pid = -1;
    std::string scriptPath;
    bool active = false;
    
    ~NodeBridge() {
        shutdown();
    }
    
    bool start(const std::string& script) {
        if (active) return true;
        
        scriptPath = script;
        
        // Create pipes for communication
        int inputPipe[2], outputPipe[2];
        if (pipe(inputPipe) == -1 || pipe(outputPipe) == -1) {
            return false;
        }
        
        pid = fork();
        if (pid == -1) {
            close(inputPipe[0]); close(inputPipe[1]);
            close(outputPipe[0]); close(outputPipe[1]);
            return false;
        }
        
        if (pid == 0) {
            // Child process
            close(inputPipe[1]);   // Close write end of input
            close(outputPipe[0]);  // Close read end of output
            
            dup2(inputPipe[0], STDIN_FILENO);
            dup2(outputPipe[1], STDOUT_FILENO);
            
            close(inputPipe[0]);
            close(outputPipe[1]);
            
            // Execute Node.js bridge
            execl("/usr/bin/env", "env", "node", scriptPath.c_str(), nullptr);
            _exit(1); // execl failed
        } else {
            // Parent process
            close(inputPipe[0]);   // Close read end of input
            close(outputPipe[1]);  // Close write end of output
            
            input = fdopen(inputPipe[1], "w");
            output = fdopen(outputPipe[0], "r");
            
            if (!input || !output) {
                shutdown();
                return false;
            }
            
            // Set non-blocking mode on output
            int flags = fcntl(fileno(output), F_GETFL, 0);
            fcntl(fileno(output), F_SETFL, flags | O_NONBLOCK);
            
            active = true;
            return true;
        }
    }
    
    void shutdown() {
        if (!active) return;
        
        if (input) {
            fclose(input);
            input = nullptr;
        }
        
        if (output) {
            fclose(output);
            output = nullptr;
        }
        
        if (pid > 0) {
            kill(pid, SIGTERM);
            int status;
            waitpid(pid, &status, WNOHANG);
            pid = -1;
        }
        
        active = false;
    }
    
    bool sendCommand(const std::string& command) {
        if (!active || !input) return false;
        
        fprintf(input, "%s\n", command.c_str());
        fflush(input);
        return true;
    }
    
    std::string readResponse() {
        if (!active || !output) return "";
        
        char buffer[4096];
        if (fgets(buffer, sizeof(buffer), output)) {
            std::string result(buffer);
            if (!result.empty() && result.back() == '\n') {
                result.pop_back();
            }
            return result;
        }
        return "";
    }
};

ClaudeCodeSDKProvider::ClaudeCodeSDKProvider() 
    : nodeBridge(std::make_unique<NodeBridge>()) {
    
    // Default script path - will be overridden by configuration
    nodeScriptPath = "llm/sdk_bridge/claude_sdk_bridge.js";
    
    // Initialize fallback provider
    initializeFallback();
}

ClaudeCodeSDKProvider::~ClaudeCodeSDKProvider() {
    cancel();
    shutdownSDK();
}

bool ClaudeCodeSDKProvider::isAvailable() const {
    // Check if Node.js is available
    int result = system("which node > /dev/null 2>&1");
    if (result != 0) {
        fprintf(stderr, "DEBUG: Node.js not available\n");
        return false;
    }
    
    // Check if bridge script exists (search upward so this works from repo root or build/app).
    const std::string resolvedScriptPath = ww_find_first_existing_upwards({nodeScriptPath}, 6);
    if (resolvedScriptPath.empty()) {
        fprintf(stderr, "DEBUG: Bridge script not found (searched upwards). Configured path: %s\n", nodeScriptPath.c_str());
        return false;
    }
    
    fprintf(stderr, "DEBUG: claude_code_sdk provider is available\n");
    return true;
}

bool ClaudeCodeSDKProvider::sendQuery(const LLMRequest& request, ResponseCallback callback) {
    if (busy.load()) {
        return false;
    }
    
    clearError();
    
    // Try SDK approach first
    if (isAvailable() && !useFallback) {
        if (!streamingActive) {
            // Start session with current system prompt
            if (!startStreamingSession(request.system_prompt)) {
                // Fall back to legacy provider
                return tryFallback(request, callback);
            }
        }
        
        // Store callback for completion
        activeFallbackCallback = callback;
        
        // Create streaming callback that buffers for final response
        std::string* responseBuffer = new std::string();
        auto streamCallback = [this, callback, responseBuffer](const StreamChunk& chunk) {
            if (chunk.type == StreamChunk::CONTENT_DELTA) {
                *responseBuffer += chunk.content;
            } else if (chunk.type == StreamChunk::MESSAGE_COMPLETE) {
                // Convert to LLMResponse format
                LLMResponse response;
                response.provider_name = getProviderName();
                if (!chunk.content.empty() && responseBuffer->empty()) {
                    *responseBuffer = chunk.content;
                }
                response.result = *responseBuffer;
                response.session_id = chunk.session_id;
                response.is_error = false;
                
                if (callback) callback(response);
                delete responseBuffer;
                
                activeFallbackCallback = nullptr;
            } else if (chunk.type == StreamChunk::ERROR_OCCURRED) {
                LLMResponse response;
                response.provider_name = getProviderName();
                response.is_error = true;
                response.error_message = chunk.error_message;
                
                if (callback) callback(response);
                delete responseBuffer;
                
                activeFallbackCallback = nullptr;
            }
        };
        
        return sendStreamingQuery(request.message, streamCallback);
    }
    
    // Fallback to legacy provider
    return tryFallback(request, callback);
}

bool ClaudeCodeSDKProvider::tryFallback(const LLMRequest& request, ResponseCallback callback) {
    if (!fallbackProvider) {
        LLMResponse response;
        response.provider_name = getProviderName();
        response.is_error = true;
        response.error_message = "SDK unavailable and no fallback provider";
        if (callback) callback(response);
        return false;
    }
    
    useFallback = true;
    return fallbackProvider->sendQuery(request, callback);
}

bool ClaudeCodeSDKProvider::startStreamingSession(const std::string& customSystemPrompt) {
    fprintf(stderr, "[SDK] startStreamingSession called, prompt=%zu chars\n", customSystemPrompt.size());

    if (streamingActive) {
        fprintf(stderr, "[SDK] Session already active, reusing\n");
        return true;
    }

    if (!initializeSDK()) {
        fprintf(stderr, "[SDK] ERROR: initializeSDK failed\n");
        setError("Failed to initialize Claude Code SDK");
        return false;
    }
    fprintf(stderr, "[SDK] SDK initialized OK\n");

    // Send session start command (escape prompt for JSON)
    std::string escapedPrompt = escapeJsonString(customSystemPrompt);
    fprintf(stderr, "[SDK] Escaped prompt: %zu chars -> %zu chars\n",
            customSystemPrompt.size(), escapedPrompt.size());

    std::ostringstream command;
    // Only send base SDK tools here — MCP tool names are auto-derived
    // by the bridge from mcpServer.tools (see claude_sdk_bridge.js).
    command << R"({"type":"START_SESSION","data":{"customSystemPrompt":")"
            << escapedPrompt << R"(","maxTurns":)" << maxTurns
            << R"(,"allowedTools":["Read","Write","Grep","WebSearch","WebFetch"],"model":")"
            << configuredModel << R"("}})";

    std::string cmdStr = command.str();
    fprintf(stderr, "[SDK] Sending START_SESSION: %zu bytes\n", cmdStr.size());

    if (!nodeBridge->sendCommand(cmdStr)) {
        fprintf(stderr, "[SDK] ERROR: sendCommand failed\n");
        setError("Failed to send session start command");
        return false;
    }
    fprintf(stderr, "[SDK] Command sent, waiting for SESSION_STARTED...\n");

    // Wait for session confirmation.
    // The bridge sends BRIDGE_READY first (immediate), then does async work
    // (capabilities fetch with retries can take ~6s), then SESSION_STARTED.
    // We need a generous timeout to accommodate the capabilities retry loop.
    for (int i = 0; i < 150; ++i) { // 15 second timeout
        std::string response = nodeBridge->readResponse();
        if (!response.empty()) {
            fprintf(stderr, "[SDK] Got response: %.80s%s\n",
                    response.c_str(), response.size() > 80 ? "..." : "");

            // Parse JSON response (simplified)
            if (response.find("SESSION_STARTED") != std::string::npos) {
                fprintf(stderr, "[SDK] Session started OK!\n");
                streamingActive = true;
                sessionStarted = true;
                currentSystemPrompt = customSystemPrompt;
                
                // Extract session ID (simplified JSON parsing)
                size_t idPos = response.find("\"sessionId\":\"");
                if (idPos != std::string::npos) {
                    idPos += 13; // Length of "sessionId":"
                    size_t endPos = response.find("\"", idPos);
                    if (endPos != std::string::npos) {
                        currentSessionId = response.substr(idPos, endPos - idPos);
                    }
                }
                
                return true;
            } else if (response.find("BRIDGE_READY") != std::string::npos) {
                // Bridge is alive, capabilities fetch + SDK init in progress.
                // Keep waiting for SESSION_STARTED.
                fprintf(stderr, "[SDK] Bridge ready, waiting for session...\n");
                continue;
            } else if (response.find("ERROR") != std::string::npos) {
                setError("Session start failed: " + response);
                return false;
            }
        }
        usleep(100000); // 100ms delay
    }
    
    setError("Session start timeout");
    return false;
}

bool ClaudeCodeSDKProvider::sendStreamingQuery(const std::string& query, StreamingCallback streamCallback,
                                                const std::string& systemPrompt) {
    fprintf(stderr, "[SDK] sendStreamingQuery: %.60s%s\n",
            query.c_str(), query.size() > 60 ? "..." : "");

    // Auto-start session if not active
    if (!streamingActive || !nodeBridge || !nodeBridge->active) {
        fprintf(stderr, "[SDK] Session not active, auto-starting...\n");
        std::string promptToUse = systemPrompt.empty() ? currentSystemPrompt : systemPrompt;
        if (promptToUse.empty()) {
            promptToUse = "You are a helpful AI assistant.";  // Fallback
        }
        if (!startStreamingSession(promptToUse)) {
            fprintf(stderr, "[SDK] ERROR: Failed to auto-start session\n");
            return false;
        }
        fprintf(stderr, "[SDK] Session auto-started OK\n");
    }

    busy.store(true);
    activeStreamCallback = streamCallback;

    // Send query command (escape user input for JSON)
    std::ostringstream command;
    command << R"({"type":"SEND_QUERY","data":{"query":")" << escapeJsonString(query) << R"("}})";
    std::string cmdStr = command.str();
    fprintf(stderr, "[SDK] Sending SEND_QUERY: %zu bytes\n", cmdStr.size());

    if (!nodeBridge->sendCommand(cmdStr)) {
        fprintf(stderr, "[SDK] ERROR: sendCommand failed for query\n");
        setError("Failed to send query command");
        busy.store(false);
        return false;
    }
    fprintf(stderr, "[SDK] Query sent, starting processing thread\n");

    // Start processing thread; always join any previous one to avoid std::terminate on destruction.
    if (processingThread && processingThread->joinable()) {
        processingActive.store(false);
        processingThread->join();
        processingThread.reset();
    }
    processingActive.store(true);
    processingThread = std::make_unique<std::thread>(&ClaudeCodeSDKProvider::processStreamingThread, this);

    return true;
}

void ClaudeCodeSDKProvider::processStreamingThread() {
    while (processingActive.load() && !shouldCancel.load()) {
        std::string response = nodeBridge->readResponse();
        
        if (!response.empty()) {
            StreamChunk chunk;
            
            // Parse response (lightweight JSON parsing)
            if (response.find("CONTENT_DELTA") != std::string::npos) {
                chunk.type = StreamChunk::CONTENT_DELTA;
                chunk.content = extractJsonStringField(response, "content");

                if (activeStreamCallback) {
                    activeStreamCallback(chunk);
                }

            } else if (response.find("MESSAGE_COMPLETE") != std::string::npos) {
                chunk.type = StreamChunk::MESSAGE_COMPLETE;
                chunk.session_id = currentSessionId;
                chunk.content = extractJsonStringField(response, "fullResponse");

                if (activeStreamCallback) {
                    activeStreamCallback(chunk);
                }

                busy.store(false);
                activeStreamCallback = nullptr;
                break;

            } else if (response.find("ERROR") != std::string::npos) {
                chunk.type = StreamChunk::ERROR_OCCURRED;
                chunk.error_message = extractJsonStringField(response, "message");
                if (chunk.error_message.empty())
                    chunk.error_message = response;

                if (activeStreamCallback) {
                    activeStreamCallback(chunk);
                }

                busy.store(false);
                activeStreamCallback = nullptr;
                break;
            }
        }
        
        usleep(50000); // 50ms polling
    }
    
    processingActive.store(false);
}

bool ClaudeCodeSDKProvider::isBusy() const {
    if (useFallback && fallbackProvider) {
        return fallbackProvider->isBusy();
    }
    return busy.load();
}

void ClaudeCodeSDKProvider::cancel() {
    if (useFallback && fallbackProvider) {
        fallbackProvider->cancel();
        return;
    }
    
    shouldCancel.store(true);
    busy.store(false);
    
    if (processingThread && processingThread->joinable()) {
        processingThread->join();
        processingThread.reset();
    }
    
    if (activeStreamCallback) {
        StreamChunk chunk;
        chunk.type = StreamChunk::ERROR_OCCURRED;
        chunk.error_message = "Request cancelled by user";
        activeStreamCallback(chunk);
        activeStreamCallback = nullptr;
    }
    
    shouldCancel.store(false);
}

void ClaudeCodeSDKProvider::poll() {
    if (useFallback && fallbackProvider) {
        fallbackProvider->poll();
    }
    // SDK version doesn't need polling - uses threads
}

bool ClaudeCodeSDKProvider::initializeSDK() {
    if (nodeBridge->active) {
        return true;
    }
    
    return nodeBridge->start(nodeScriptPath);
}

void ClaudeCodeSDKProvider::shutdownSDK() {
    if (processingThread && processingThread->joinable()) {
        processingActive.store(false);
        processingThread->join();
        processingThread.reset();
    }
    
    nodeBridge->shutdown();
    streamingActive = false;
    sessionStarted = false;
}

std::string ClaudeCodeSDKProvider::getVersion() const {
    return "SDK v1.0.0";
}

std::vector<std::string> ClaudeCodeSDKProvider::getSupportedModels() const {
    return {"claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"};
}

bool ClaudeCodeSDKProvider::configure(const std::string& config) {
    // Parse configuration (tolerant JSON-ish parsing without throwing)
    fprintf(stderr, "DEBUG: SDK Provider configure() called with: %s\n", config.c_str());

    auto parseIntField = [&config](const std::string& key, int defaultValue) -> int {
        size_t keyPos = config.find(key);
        if (keyPos == std::string::npos) return defaultValue;
        size_t colonPos = config.find(":", keyPos);
        if (colonPos == std::string::npos) return defaultValue;

        // Skip spaces
        size_t valPos = colonPos + 1;
        while (valPos < config.size() && (config[valPos] == ' ' || config[valPos] == '\t')) {
            ++valPos;
        }

        // Extract numeric text, supporting optional quotes
        std::string numStr;
        if (valPos < config.size() && config[valPos] == '"') {
            // Quoted number: "123"
            ++valPos;
            size_t endQuote = config.find('"', valPos);
            if (endQuote == std::string::npos) return defaultValue;
            numStr = config.substr(valPos, endQuote - valPos);
        } else {
            // Unquoted: read digits/sign until delimiter
            size_t endPos = valPos;
            while (endPos < config.size()) {
                char c = config[endPos];
                if ((c >= '0' && c <= '9') || c == '-' || c == '+') {
                    ++endPos;
                } else {
                    break;
                }
            }
            if (endPos == valPos) return defaultValue;
            numStr = config.substr(valPos, endPos - valPos);
        }

        try {
            return std::stoi(numStr);
        } catch (...) {
            return defaultValue;
        }
    };

    auto parseStringField = [&config](const std::string& key, std::string defaultValue) -> std::string {
        size_t keyPos = config.find(key);
        if (keyPos == std::string::npos) return defaultValue;
        size_t colonPos = config.find(":", keyPos);
        if (colonPos == std::string::npos) return defaultValue;
        size_t startQuote = config.find('"', colonPos);
        if (startQuote == std::string::npos) return defaultValue;
        ++startQuote;
        size_t endQuote = config.find('"', startQuote);
        if (endQuote == std::string::npos) return defaultValue;
        return config.substr(startQuote, endQuote - startQuote);
    };

    // maxTurns (quoted or numeric)
    maxTurns = parseIntField("maxTurns", maxTurns);

    // nodeScriptPath (resolve relative path by searching upward from CWD).
    nodeScriptPath = parseStringField("nodeScriptPath", nodeScriptPath);
    {
        const std::string resolved = ww_find_first_existing_upwards({nodeScriptPath}, 6);
        if (!resolved.empty()) {
            nodeScriptPath = resolved;
        }
    }

    // sessionTimeout (quoted or numeric)
    sessionTimeout = parseIntField("sessionTimeout", sessionTimeout);

    // model - map to full 4.5 IDs
    std::string modelStr = parseStringField("model", "claude-haiku-4-5");
    if (modelStr.find("opus") != std::string::npos) {
        configuredModel = "claude-opus-4-5";
    } else if (modelStr.find("sonnet") != std::string::npos) {
        configuredModel = "claude-sonnet-4-5";
    } else {
        configuredModel = "claude-haiku-4-5";  // Default
    }
    fprintf(stderr, "[SDK] Configured model: %s (from %s)\n", configuredModel.c_str(), modelStr.c_str());

    // allowedTools: if present, keep defaults for now
    allowedTools.clear();
    if (config.find("allowedTools") != std::string::npos) {
        allowedTools = {"Read", "Write", "Grep", "Bash", "LS", "WebSearch", "WebFetch"};
    }

    return true;
}

void ClaudeCodeSDKProvider::resetSession() {
    endStreamingSession();
    currentSessionId.clear();
}

void ClaudeCodeSDKProvider::endStreamingSession() {
    if (!streamingActive) return;
    
    if (nodeBridge->active) {
        nodeBridge->sendCommand(R"({"type":"END_SESSION","data":{}})");
    }
    
    streamingActive = false;
    sessionStarted = false;
    currentSessionId.clear();
}

bool ClaudeCodeSDKProvider::updateSystemPrompt(const std::string& customSystemPrompt) {
    if (!streamingActive) {
        currentSystemPrompt = customSystemPrompt;
        return true;
    }
    
    std::ostringstream command;
    command << R"({"type":"UPDATE_PROMPT","data":{"customSystemPrompt":")" 
            << customSystemPrompt << R"("}})";
    
    bool success = nodeBridge->sendCommand(command.str());
    if (success) {
        currentSystemPrompt = customSystemPrompt;
    }
    
    return success;
}

void ClaudeCodeSDKProvider::registerTool(const Tool& tool) {
    registeredTools.push_back(tool);
}

void ClaudeCodeSDKProvider::clearTools() {
    registeredTools.clear();
}

void ClaudeCodeSDKProvider::setError(const std::string& error) {
    lastError = error;
}

void ClaudeCodeSDKProvider::clearError() {
    lastError.clear();
}

bool ClaudeCodeSDKProvider::initializeFallback() {
    try {
        fallbackProvider = std::make_unique<ClaudeCodeProvider>();
        return fallbackProvider->isAvailable();
    } catch (...) {
        fallbackProvider.reset();
        return false;
    }
}
