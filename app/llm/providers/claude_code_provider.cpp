/*---------------------------------------------------------*/
/*                                                         */
/*   claude_code_provider.cpp - Claude Code CLI Provider  */
/*                                                         */
/*---------------------------------------------------------*/

#include "claude_code_provider.h"
#include "../base/llm_provider_factory.h"

#include <cstdio>
#include <cstdlib>
#include <memory>
#include <sstream>
#include <algorithm>
#include <chrono>
#include <fcntl.h>
#include <unistd.h>

// Register this provider with the factory
REGISTER_LLM_PROVIDER("claude_code", ClaudeCodeProvider);

ClaudeCodeProvider::ClaudeCodeProvider() {
    commandArgs = {"-p"};  // Default args
}

ClaudeCodeProvider::~ClaudeCodeProvider() {
    cancel(); // Cleanup any active request
}

bool ClaudeCodeProvider::sendQuery(const LLMRequest& request, ResponseCallback callback) {
    if (busy || request.message.empty()) {
        return false;
    }
    
    clearError();
    
    // Start async Claude command
    return startAsyncCommand(request, callback);
}

bool ClaudeCodeProvider::isAvailable() const {
    // Fast, non-blocking check: verify executable is present and executable.
    // 1) If claudePath is an explicit path (contains '/'), check it directly.
    // 2) Otherwise, scan PATH for an executable named claudePath.
    auto isExec = [](const std::string &p) -> bool {
        return access(p.c_str(), X_OK) == 0;
    };

    if (claudePath.find('/') != std::string::npos) {
        return isExec(claudePath);
    }

    const char *pathEnv = std::getenv("PATH");
    if (!pathEnv) return false;
    std::string paths(pathEnv);

    size_t start = 0;
    while (start <= paths.size()) {
        size_t end = paths.find(':', start);
        std::string dir = (end == std::string::npos) ? paths.substr(start)
                                                     : paths.substr(start, end - start);
        if (!dir.empty()) {
            std::string cand = dir + "/" + claudePath;
            if (isExec(cand)) return true;
        }
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return false;
}

bool ClaudeCodeProvider::isBusy() const {
    return busy;
}

void ClaudeCodeProvider::cancel() {
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

void ClaudeCodeProvider::poll() {
    pollAsyncExecution();
}

std::string ClaudeCodeProvider::getVersion() const {
    std::string command = claudePath + " --version 2>/dev/null";
    
    FILE* pipe = popen(command.c_str(), "r");
    if (!pipe) {
        return "unknown";
    }
    
    char buffer[256];
    std::string result;
    if (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result = buffer;
        // Remove newline
        if (!result.empty() && result.back() == '\n') {
            result.pop_back();
        }
    }
    
    pclose(pipe);
    return result.empty() ? "unknown" : result;
}

std::vector<std::string> ClaudeCodeProvider::getSupportedModels() const {
    // Claude Code CLI model aliases
    return {"claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"};
}

bool ClaudeCodeProvider::configure(const std::string& config) {
    // Parse configuration to extract command and args
    // For now, keep it simple - in production would parse JSON properly

    // Look for command path
    size_t cmdPos = config.find("\"command\"");
    if (cmdPos != std::string::npos) {
        size_t start = config.find("\"", cmdPos + 9);
        if (start != std::string::npos) {
            start++; // Skip opening quote
            size_t end = config.find("\"", start);
            if (end != std::string::npos) {
                claudePath = config.substr(start, end - start);
            }
        }
    }

    // Parse args array
    size_t argsPos = config.find("\"args\"");
    if (argsPos != std::string::npos) {
        size_t arrayStart = config.find("[", argsPos);
        size_t arrayEnd = config.find("]", argsPos);
        if (arrayStart != std::string::npos && arrayEnd != std::string::npos) {
            commandArgs.clear();
            std::string argsStr = config.substr(arrayStart + 1, arrayEnd - arrayStart - 1);

            // Simple arg extraction (handles quoted strings)
            size_t pos = 0;
            while (pos < argsStr.length()) {
                size_t quoteStart = argsStr.find("\"", pos);
                if (quoteStart == std::string::npos) break;
                size_t quoteEnd = argsStr.find("\"", quoteStart + 1);
                if (quoteEnd == std::string::npos) break;

                std::string arg = argsStr.substr(quoteStart + 1, quoteEnd - quoteStart - 1);
                if (!arg.empty()) {
                    commandArgs.push_back(arg);
                }
                pos = quoteEnd + 1;
            }
        }
    }

    fprintf(stderr, "DEBUG: ClaudeCodeProvider configured: command=%s, args=%zu\n",
            claudePath.c_str(), commandArgs.size());

    return true;
}

void ClaudeCodeProvider::resetSession() {
    currentSessionId.clear();
}

bool ClaudeCodeProvider::startAsyncCommand(const LLMRequest& request, ResponseCallback callback) {
    if (!isAvailable()) {
        LLMResponse response;
        response.provider_name = getProviderName();
        response.is_error = true;
        response.error_message = "Claude Code binary not found at: " + claudePath;
        setError(response.error_message);
        if (callback) callback(response);
        return false;
    }
    
    // Build the command
    std::string command = buildClaudeCommand(request);
    
    // Start async execution
    activePipe = popen(command.c_str(), "r");
    if (!activePipe) {
        LLMResponse response;
        response.provider_name = getProviderName();
        response.is_error = true;
        response.error_message = "Failed to execute Claude command";
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
    
    return true;
}

// pollAsyncExecution is in the streaming section at end of file

LLMResponse ClaudeCodeProvider::executeClaudeCommand(const LLMRequest& request) {
    LLMResponse response;
    response.provider_name = getProviderName();
    
    auto startTime = std::chrono::high_resolution_clock::now();
    
    if (!isAvailable()) {
        response.is_error = true;
        response.error_message = "Claude Code binary not found at: " + claudePath;
        setError(response.error_message);
        return response;
    }
    
    // Build the command
    std::string command = buildClaudeCommand(request);
    
    // Execute the command
    FILE* pipe = popen(command.c_str(), "r");
    if (!pipe) {
        response.is_error = true;
        response.error_message = "Failed to execute Claude command";
        setError(response.error_message);
        return response;
    }
    
    // Read the output
    std::string output;
    char buffer[4096];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        output += buffer;
    }
    
    int exitCode = pclose(pipe);
    
    auto endTime = std::chrono::high_resolution_clock::now();
    response.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    
    if (exitCode != 0) {
        response.is_error = true;
        response.error_message = "Claude command failed with exit code " + std::to_string(exitCode);
        if (!output.empty()) {
            response.error_message += ": " + output;
        }
        setError(response.error_message);
        return response;
    }
    
    // Parse the JSON response
    response = parseClaudeResponse(output);
    response.provider_name = getProviderName();
    response.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    
    // Update session ID if we got one
    if (!response.session_id.empty()) {
        currentSessionId = response.session_id;
    }
    
    return response;
}

std::string ClaudeCodeProvider::buildClaudeCommand(const LLMRequest& request) const {
    std::ostringstream cmd;

    cmd << claudePath;

    // Add configured args (they already include -p, --mcp-config, etc.)
    for (const std::string& arg : commandArgs) {
        // Skip --output-format if already in args (we'll add it explicitly)
        if (arg.find("--output-format") != std::string::npos) continue;
        cmd << " " << arg;
    }

    // Always ensure JSON output
    cmd << " --output-format json";

    // Session management: use --resume with session ID if available
    if (!currentSessionId.empty()) {
        cmd << " --resume " << currentSessionId;
        fprintf(stderr, "DEBUG: Using session resume with ID: %s\n", currentSessionId.c_str());
    } else {
        fprintf(stderr, "DEBUG: Starting new session (no session ID)\n");
    }

    // System prompt: prefer file over inline
    FILE* promptCheck = fopen("wibandwob.prompt.md", "r");
    if (promptCheck) {
        fclose(promptCheck);
        cmd << " --system-prompt-file wibandwob.prompt.md";
    } else if (!request.system_prompt.empty()) {
        // Fallback to inline system prompt
        cmd << " --append-system-prompt \"";
        for (char c : request.system_prompt) {
            if (c == '"' || c == '\\' || c == '$' || c == '`') {
                cmd << '\\';
            }
            cmd << c;
        }
        cmd << "\"";
    }

    // Escape the query for shell
    cmd << " \"";
    for (char c : request.message) {
        if (c == '"' || c == '\\' || c == '$' || c == '`') {
            cmd << '\\';
        }
        cmd << c;
    }
    cmd << "\"";

    cmd << " 2>&1";  // Capture stderr too

    fprintf(stderr, "DEBUG: Claude command: %s\n", cmd.str().c_str());

    return cmd.str();
}

// JSON parsing methods (copied from wibwob_engine.cpp)
LLMResponse ClaudeCodeProvider::parseClaudeResponse(const std::string& json) const {
    LLMResponse response;
    
    if (json.empty()) {
        response.is_error = true;
        response.error_message = "Empty response from Claude";
        return response;
    }
    
    // Simple JSON parsing (for POC - production would use a proper JSON library)
    response.result = extractJsonField(json, "result");
    response.session_id = extractJsonField(json, "session_id");
    response.cost = extractJsonNumber(json, "total_cost_usd");
    response.duration_ms = (int)extractJsonNumber(json, "duration_ms");
    response.is_error = extractJsonBool(json, "is_error");
    
    // If marked as error in JSON, extract error details
    if (response.is_error) {
        std::string errorField = extractJsonField(json, "error");
        if (!errorField.empty()) {
            response.error_message = errorField;
        } else {
            response.error_message = "Claude returned an error";
        }
    }
    
    // If we couldn't parse result, treat as error
    if (response.result.empty() && !response.is_error) {
        response.is_error = true;
        response.error_message = "Could not parse Claude response: " + json.substr(0, 200);
    }
    
    return response;
}

std::string ClaudeCodeProvider::extractJsonField(const std::string& json, const std::string& field) const {
    std::string pattern = "\"" + field + "\":\"";
    size_t start = json.find(pattern);
    if (start == std::string::npos) {
        return "";
    }
    
    start += pattern.length();
    size_t end = start;
    
    // Find the end of the string value, handling escaped quotes
    while (end < json.length()) {
        if (json[end] == '"' && (end == start || json[end-1] != '\\')) {
            break;
        }
        end++;
    }
    
    if (end >= json.length()) {
        return "";
    }
    
    std::string result = json.substr(start, end - start);
    
    // Unescape basic escaped characters
    size_t pos = 0;
    // Handle \\n first (escaped backslash followed by n)
    while ((pos = result.find("\\\\n", pos)) != std::string::npos) {
        result.replace(pos, 3, "\\n");
        pos += 2;
    }
    // Handle \n (actual newlines)
    pos = 0;
    while ((pos = result.find("\\n", pos)) != std::string::npos) {
        result.replace(pos, 2, "\n");
        pos += 1;
    }
    // Handle \r (carriage returns)
    pos = 0;
    while ((pos = result.find("\\r", pos)) != std::string::npos) {
        result.replace(pos, 2, "\r");
        pos += 1;
    }
    // Handle \t (tabs)
    pos = 0;
    while ((pos = result.find("\\t", pos)) != std::string::npos) {
        result.replace(pos, 2, "\t");
        pos += 1;
    }
    // Handle \" (quotes)
    pos = 0;
    while ((pos = result.find("\\\"", pos)) != std::string::npos) {
        result.replace(pos, 2, "\"");
        pos += 1;
    }
    // Handle \\ (backslashes) - do this last
    pos = 0;
    while ((pos = result.find("\\\\", pos)) != std::string::npos) {
        result.replace(pos, 2, "\\");
        pos += 1;
    }
    
    return result;
}

bool ClaudeCodeProvider::extractJsonBool(const std::string& json, const std::string& field) const {
    std::string pattern = "\"" + field + "\":";
    size_t start = json.find(pattern);
    if (start == std::string::npos) {
        return false;
    }
    
    start += pattern.length();
    
    // Skip whitespace
    while (start < json.length() && (json[start] == ' ' || json[start] == '\t')) {
        start++;
    }
    
    if (start + 4 <= json.length() && json.substr(start, 4) == "true") {
        return true;
    }
    
    return false;
}

double ClaudeCodeProvider::extractJsonNumber(const std::string& json, const std::string& field) const {
    std::string pattern = "\"" + field + "\":";
    size_t start = json.find(pattern);
    if (start == std::string::npos) {
        return 0.0;
    }
    
    start += pattern.length();
    
    // Skip whitespace
    while (start < json.length() && (json[start] == ' ' || json[start] == '\t')) {
        start++;
    }
    
    size_t end = start;
    while (end < json.length() && 
           (std::isdigit(json[end]) || json[end] == '.' || json[end] == '-' || json[end] == '+' || json[end] == 'e' || json[end] == 'E')) {
        end++;
    }
    
    if (end > start) {
        std::string numStr = json.substr(start, end - start);
        try {
            return std::stod(numStr);
        } catch (...) {
            return 0.0;
        }
    }
    
    return 0.0;
}

void ClaudeCodeProvider::setError(const std::string& error) {
    lastError = error;
}

void ClaudeCodeProvider::clearError() {
    lastError.clear();
}

// Tool support methods
void ClaudeCodeProvider::registerTool(const Tool& tool) {
    registeredTools.push_back(tool);
}

void ClaudeCodeProvider::clearTools() {
    registeredTools.clear();
}

// ============================================================================
// Streaming Support (using --output-format stream-json)
// ============================================================================

bool ClaudeCodeProvider::sendStreamingQuery(const std::string& query, StreamingCallback streamCallback) {
    if (busy || query.empty()) {
        return false;
    }

    clearError();
    streamingMode = true;
    streamingActive = true;
    activeStreamCallback = streamCallback;
    lineBuffer.clear();

    // Build streaming command
    std::ostringstream cmd;
    cmd << claudePath;

    // Add configured args
    for (const std::string& arg : commandArgs) {
        if (arg.find("--output-format") != std::string::npos) continue;
        cmd << " " << arg;
    }

    // Use stream-json for streaming output
    cmd << " --output-format stream-json";

    // Session management
    if (!currentSessionId.empty()) {
        cmd << " --resume " << currentSessionId;
        fprintf(stderr, "DEBUG: [streaming] Using session: %s\n", currentSessionId.c_str());
    }

    // System prompt file
    FILE* promptCheck = fopen("app/wibandwob.prompt.md", "r");
    if (promptCheck) {
        fclose(promptCheck);
        cmd << " --system-prompt-file app/wibandwob.prompt.md";
    }

    // Escape the query
    cmd << " \"";
    for (char c : query) {
        if (c == '"' || c == '\\' || c == '$' || c == '`') {
            cmd << '\\';
        }
        cmd << c;
    }
    cmd << "\" 2>&1";

    fprintf(stderr, "DEBUG: [streaming] Command: %s\n", cmd.str().c_str());

    // Start async execution
    activePipe = popen(cmd.str().c_str(), "r");
    if (!activePipe) {
        streamingMode = false;
        streamingActive = false;
        StreamChunk chunk;
        chunk.type = StreamChunk::ERROR_OCCURRED;
        chunk.error_message = "Failed to execute streaming command";
        if (activeStreamCallback) activeStreamCallback(chunk);
        return false;
    }

    // Set non-blocking
    int fd = fileno(activePipe);
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);

    busy = true;
    outputBuffer.clear();

    return true;
}

void ClaudeCodeProvider::pollAsyncExecution() {
    if (!busy || !activePipe) {
        return;
    }

    // Read available data from pipe (non-blocking)
    char buffer[4096];
    clearerr(activePipe);
    size_t bytesRead = fread(buffer, 1, sizeof(buffer) - 1, activePipe);

    if (bytesRead > 0) {
        buffer[bytesRead] = '\0';

        if (streamingMode) {
            // Streaming: accumulate and process JSONL lines
            lineBuffer += buffer;

            // Process complete lines
            size_t pos;
            while ((pos = lineBuffer.find('\n')) != std::string::npos) {
                std::string line = lineBuffer.substr(0, pos);
                lineBuffer = lineBuffer.substr(pos + 1);

                if (line.empty()) continue;

                // Parse the JSON line
                processStreamLine(line);
            }
        } else {
            // Non-streaming: just accumulate
            outputBuffer += buffer;
        }
    }

    // Check if process is done
    if (feof(activePipe)) {
        int exitCode = pclose(activePipe);
        activePipe = nullptr;
        busy = false;

        if (streamingMode) {
            // Process any remaining data in lineBuffer
            if (!lineBuffer.empty()) {
                processStreamLine(lineBuffer);
                lineBuffer.clear();
            }

            // Send completion chunk
            StreamChunk chunk;
            chunk.type = StreamChunk::MESSAGE_COMPLETE;
            chunk.is_final = true;
            if (activeStreamCallback) activeStreamCallback(chunk);

            streamingMode = false;
            streamingActive = false;
            activeStreamCallback = nullptr;
        } else {
            // Non-streaming: parse and callback
            LLMResponse response;
            response.provider_name = getProviderName();

            if (exitCode == 0) {
                fprintf(stderr, "DEBUG: Raw Claude JSON response:\n%s\n", outputBuffer.c_str());
                response = parseClaudeResponse(outputBuffer);
                response.provider_name = getProviderName();

                if (!response.session_id.empty()) {
                    currentSessionId = response.session_id;
                }
            } else {
                response.is_error = true;
                response.error_message = "Claude command failed with exit code " + std::to_string(exitCode);
                if (!outputBuffer.empty()) {
                    response.error_message += ": " + outputBuffer.substr(0, 200);
                }
            }

            if (pendingCallback) {
                pendingCallback(response);
                pendingCallback = nullptr;
            }
        }

        outputBuffer.clear();
    }
}

void ClaudeCodeProvider::processStreamLine(const std::string& line) {
    // Parse JSONL line from stream-json output
    // Format: {"type":"assistant","message":{"content":"..."},...}

    std::string type = extractJsonField(line, "type");

    if (type == "assistant") {
        // Extract content from nested message object
        size_t msgPos = line.find("\"message\":");
        if (msgPos != std::string::npos) {
            std::string msgPart = line.substr(msgPos);
            std::string content = extractJsonField(msgPart, "content");

            if (!content.empty()) {
                StreamChunk chunk;
                chunk.type = StreamChunk::CONTENT_DELTA;
                chunk.content = content;
                if (activeStreamCallback) activeStreamCallback(chunk);
            }
        }
    } else if (type == "result") {
        // End of conversation turn
        std::string sessionId = extractJsonField(line, "session_id");
        if (!sessionId.empty()) {
            currentSessionId = sessionId;
        }
        // MESSAGE_COMPLETE is sent when pipe closes
    } else if (type == "error") {
        StreamChunk chunk;
        chunk.type = StreamChunk::ERROR_OCCURRED;
        chunk.error_message = extractJsonField(line, "error");
        if (activeStreamCallback) activeStreamCallback(chunk);
    }

    // Debug: log all stream lines
    fprintf(stderr, "DEBUG: [stream] type=%s line=%s\n", type.c_str(), line.substr(0, 100).c_str());
}
