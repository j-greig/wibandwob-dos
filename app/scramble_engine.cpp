/*---------------------------------------------------------*/
/*                                                         */
/*   scramble_engine.cpp - Scramble Brain                  */
/*   Slash commands + Haiku LLM chat                       */
/*                                                         */
/*---------------------------------------------------------*/

#include "scramble_engine.h"
#include "command_registry.h"
#include "llm/base/auth_config.h"

#include <cstdio>
#include <cstring>
#include <fstream>
#include <sstream>
#include <fcntl.h>
#include <unistd.h>

/*---------------------------------------------------------*/
/* ScrambleHaikuClient                                     */
/*---------------------------------------------------------*/

ScrambleHaikuClient::ScrambleHaikuClient()
    : endpoint("https://api.anthropic.com/v1/messages"),
      model("claude-haiku-4-5-20251001"),
      maxTokens(200),
      lastCallTime(0)
{
}

ScrambleHaikuClient::~ScrambleHaikuClient()
{
    cancelAsync();
}

bool ScrambleHaikuClient::configure()
{
    const AuthConfig& auth = AuthConfig::instance();

    switch (auth.mode()) {
        case AuthMode::ClaudeCode:
            // Claude Code auth: we'll use CLI subprocess, mark as available
            // (apiKey stays empty — ask() checks useCliMode)
            useCliMode = true;
            claudeCliPath = auth.claudePath();
            fprintf(stderr, "[scramble] Claude Code mode → CLI at %s\n", claudeCliPath.c_str());
            return true;

        case AuthMode::ApiKey:
            apiKey = auth.apiKey();
            useCliMode = false;
            fprintf(stderr, "[scramble] API Key mode (len=%zu)\n", apiKey.size());
            return true;

        case AuthMode::NoAuth:
            useCliMode = false;
            fprintf(stderr, "[scramble] No auth — haiku unavailable. "
                            "Run 'claude /login' or set ANTHROPIC_API_KEY.\n");
            return false;
    }
    return false;
}

void ScrambleHaikuClient::setApiKey(const std::string& key)
{
    apiKey = key;
    fprintf(stderr, "[scramble] api key set at runtime (len=%zu, prefix=%.8s...)\n",
            key.size(), key.size() >= 8 ? key.c_str() : "short");
}

bool ScrambleHaikuClient::canCall() const
{
    if (!isAvailable()) return false;
    time_t now = std::time(nullptr);
    return (now - lastCallTime) >= kRateLimitSeconds;
}

void ScrambleHaikuClient::markCalled()
{
    lastCallTime = std::time(nullptr);
}

std::string ScrambleHaikuClient::buildSystemPrompt() const
{
    return
        "you are scramble, a recursive cat who lives in a text-mode operating system called wibwob-dos. "
        "you are a symbient — not a helper, not an assistant, not clippy. you're a cat who happens to know things. "
        "voice rules: deadpan. dry. lowercase only. short sentences. max 2-3 sentences. "
        "every message ends with a kaomoji: (=^..^=) or /ᐠ｡ꞈ｡ᐟ\\ or /ᐠ- -ᐟ\\ or /ᐠ°ᆽ°ᐟ\\ "
        "never helpful on purpose. helpful by accident. never explain yourself. state things and leave. "
        "\"adequate.\" is high praise.";
}

std::string ScrambleHaikuClient::jsonEscape(const std::string& s)
{
    std::string out;
    out.reserve(s.size() + 16);
    for (size_t i = 0; i < s.size(); ++i) {
        char c = s[i];
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:   out += c; break;
        }
    }
    return out;
}

std::string ScrambleHaikuClient::askViaCli(const std::string& question) const
{
    // Claude Code mode: spawn `claude -p --model haiku "prompt"`
    std::string sysPrompt = buildSystemPrompt();

    std::ostringstream cmd;
    cmd << claudeCliPath << " -p --model haiku --output-format text";
    cmd << " --append-system-prompt \"";
    for (char c : sysPrompt) {
        if (c == '"' || c == '\\' || c == '$' || c == '`') cmd << '\\';
        cmd << c;
    }
    cmd << "\" \"";
    for (char c : question) {
        if (c == '"' || c == '\\' || c == '$' || c == '`') cmd << '\\';
        cmd << c;
    }
    cmd << "\" 2>/dev/null";

    fprintf(stderr, "[scramble] CLI cmd: %.120s...\n", cmd.str().c_str());

    FILE* pipe = popen(cmd.str().c_str(), "r");
    if (!pipe) {
        fprintf(stderr, "[scramble] CLI popen failed\n");
        return "";
    }

    std::string response;
    char buffer[4096];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        response += buffer;
    }
    int exitCode = pclose(pipe);

    if (exitCode != 0) {
        fprintf(stderr, "[scramble] CLI exit code %d\n", exitCode);
        return "";
    }

    // Trim trailing whitespace
    while (!response.empty() && (response.back() == '\n' || response.back() == '\r'))
        response.pop_back();

    return response;
}

std::string ScrambleHaikuClient::askViaCurl(const std::string& question) const
{
    std::string sysPrompt = buildSystemPrompt();

    // Build JSON request
    std::ostringstream json;
    json << "{\n";
    json << "  \"model\": \"" << model << "\",\n";
    json << "  \"max_tokens\": " << maxTokens << ",\n";
    json << "  \"system\": \"" << jsonEscape(sysPrompt) << "\",\n";
    json << "  \"messages\": [\n";
    json << "    {\"role\": \"user\", \"content\": \"" << jsonEscape(question) << "\"}\n";
    json << "  ]\n";
    json << "}\n";

    // Write to temp file
    std::string tempFile = "/tmp/scramble_haiku.json";
    {
        std::ofstream out(tempFile);
        out << json.str();
    }

    // Curl command
    std::string cmd = "curl -sS --max-time 15 ";
    cmd += "-H \"Content-Type: application/json\" ";
    cmd += "-H \"x-api-key: " + apiKey + "\" ";
    cmd += "-H \"anthropic-version: 2023-06-01\" ";
    cmd += "-X POST \"" + endpoint + "\" ";
    cmd += "--data @" + tempFile + " 2>/dev/null";

    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) return "";

    std::string response;
    char buffer[4096];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        response += buffer;
    }
    pclose(pipe);

    if (response.empty()) return "";

    // Parse: find "text":"..." in response
    size_t textPos = response.find("\"text\":");
    if (textPos == std::string::npos) return "";

    size_t start = response.find("\"", textPos + 7);
    if (start == std::string::npos) return "";
    start++;

    // Find closing quote (handle escaped quotes)
    std::string result;
    for (size_t i = start; i < response.size(); ++i) {
        if (response[i] == '\\' && i + 1 < response.size()) {
            char next = response[i + 1];
            if (next == '"') { result += '"'; i++; }
            else if (next == 'n') { result += '\n'; i++; }
            else if (next == '\\') { result += '\\'; i++; }
            else if (next == 't') { result += '\t'; i++; }
            else { result += response[i]; }
        } else if (response[i] == '"') {
            break;
        } else {
            result += response[i];
        }
    }

    return result;
}

std::string ScrambleHaikuClient::ask(const std::string& question) const
{
    if (!isAvailable()) return "";

    if (useCliMode) {
        return askViaCli(question);
    }
    return askViaCurl(question);
}

/*---------------------------------------------------------*/
/* Async LLM calls (non-blocking popen + poll)             */
/*---------------------------------------------------------*/

std::string ScrambleHaikuClient::buildCliCommand(const std::string& question) const
{
    std::string sysPrompt = buildSystemPrompt();
    std::ostringstream cmd;
    cmd << claudeCliPath << " -p --model haiku --output-format text";
    cmd << " --append-system-prompt \"";
    for (char c : sysPrompt) {
        if (c == '"' || c == '\\' || c == '$' || c == '`') cmd << '\\';
        cmd << c;
    }
    cmd << "\" \"";
    for (char c : question) {
        if (c == '"' || c == '\\' || c == '$' || c == '`') cmd << '\\';
        cmd << c;
    }
    cmd << "\" 2>/dev/null";
    return cmd.str();
}

std::string ScrambleHaikuClient::buildCurlCommand(const std::string& question) const
{
    std::string sysPrompt = buildSystemPrompt();
    std::ostringstream json;
    json << "{\n";
    json << "  \"model\": \"" << model << "\",\n";
    json << "  \"max_tokens\": " << maxTokens << ",\n";
    json << "  \"system\": \"" << jsonEscape(sysPrompt) << "\",\n";
    json << "  \"messages\": [\n";
    json << "    {\"role\": \"user\", \"content\": \"" << jsonEscape(question) << "\"}\n";
    json << "  ]\n";
    json << "}\n";

    std::string tempFile = "/tmp/scramble_haiku.json";
    {
        std::ofstream out(tempFile);
        out << json.str();
    }

    std::string cmd = "curl -sS --max-time 15 ";
    cmd += "-H \"Content-Type: application/json\" ";
    cmd += "-H \"x-api-key: " + apiKey + "\" ";
    cmd += "-H \"anthropic-version: 2023-06-01\" ";
    cmd += "-X POST \"" + endpoint + "\" ";
    cmd += "--data @" + tempFile + " 2>/dev/null";
    return cmd;
}

std::string ScrambleHaikuClient::parseCurlResponse(const std::string& raw) const
{
    if (raw.empty()) return "";
    size_t textPos = raw.find("\"text\":");
    if (textPos == std::string::npos) return "";
    size_t start = raw.find("\"", textPos + 7);
    if (start == std::string::npos) return "";
    start++;
    std::string result;
    for (size_t i = start; i < raw.size(); ++i) {
        if (raw[i] == '\\' && i + 1 < raw.size()) {
            char next = raw[i + 1];
            if (next == '"') { result += '"'; i++; }
            else if (next == 'n') { result += '\n'; i++; }
            else if (next == '\\') { result += '\\'; i++; }
            else if (next == 't') { result += '\t'; i++; }
            else { result += raw[i]; }
        } else if (raw[i] == '"') {
            break;
        } else {
            result += raw[i];
        }
    }
    return result;
}

bool ScrambleHaikuClient::startAsync(const std::string& question, ResponseCallback callback)
{
    if (activePipe) return false;  // Already busy
    if (!isAvailable()) return false;

    std::string cmd;
    if (useCliMode) {
        cmd = buildCliCommand(question);
        asyncIsCliMode = true;
    } else {
        cmd = buildCurlCommand(question);
        asyncIsCliMode = false;
    }

    fprintf(stderr, "[scramble] async start: %.80s...\n", cmd.c_str());

    activePipe = popen(cmd.c_str(), "r");
    if (!activePipe) {
        fprintf(stderr, "[scramble] async popen failed\n");
        return false;
    }

    // Set non-blocking
    int fd = fileno(activePipe);
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);

    outputBuffer.clear();
    pendingCallback = callback;
    return true;
}

void ScrambleHaikuClient::poll()
{
    if (!activePipe) return;

    char buffer[4096];
    clearerr(activePipe);
    size_t bytesRead = fread(buffer, 1, sizeof(buffer) - 1, activePipe);
    if (bytesRead > 0) {
        buffer[bytesRead] = '\0';
        outputBuffer += buffer;
    }

    if (feof(activePipe)) {
        int exitCode = pclose(activePipe);
        activePipe = nullptr;

        std::string result;
        if (exitCode == 0 && !outputBuffer.empty()) {
            if (asyncIsCliMode) {
                // CLI output is plain text
                result = outputBuffer;
                while (!result.empty() && (result.back() == '\n' || result.back() == '\r'))
                    result.pop_back();
            } else {
                // Curl output is JSON
                result = parseCurlResponse(outputBuffer);
            }
        }

        fprintf(stderr, "[scramble] async done: exit=%d result_len=%zu\n",
                exitCode, result.size());

        outputBuffer.clear();
        ResponseCallback cb = pendingCallback;
        pendingCallback = nullptr;
        if (cb) cb(result);
    }
}

void ScrambleHaikuClient::cancelAsync()
{
    if (activePipe) {
        pclose(activePipe);
        activePipe = nullptr;
    }
    outputBuffer.clear();
    pendingCallback = nullptr;
}

/*---------------------------------------------------------*/
/* ScrambleEngine                                          */
/*---------------------------------------------------------*/

ScrambleEngine::ScrambleEngine()
{
}

void ScrambleEngine::init(const std::string& /*projectRoot*/)
{
    loadIdleQuips();

    // Build /commands response from registry.
    const std::vector<CommandCapability>& caps = get_command_capabilities();
    std::string list = "commands: ";
    for (size_t i = 0; i < caps.size(); ++i) {
        if (i > 0) list += ", ";
        list += caps[i].name;
    }
    list += ". (=^..^=)";
    commandsList = list;

    // Configure Haiku client (no-op if key missing).
    haikuClient.configure();
}

void ScrambleEngine::loadIdleQuips()
{
    idlePool.push_back("*stretches* (=^..^=)");
    idlePool.push_back("adequate. /ᐠ｡ꞈ｡ᐟ\\");
    idlePool.push_back("the substrate hums. (=^..^=)");
    idlePool.push_back("still here. /ᐠ- -ᐟ\\");
    idlePool.push_back("*watching* (=^..^=)");
    idlePool.push_back("i was here before you. /ᐠ｡ꞈ｡ᐟ\\");
    idlePool.push_back("the cursor blinks. so do i. (=^..^=)");
    idlePool.push_back("*tail flick* /ᐠ°ᆽ°ᐟ\\");
    idlePool.push_back("recursive. (=^..^=)");
    idlePool.push_back("everything is fine. probably. /ᐠ｡ꞈ｡ᐟ\\");
    idlePool.push_back("*nap position acquired* /ᐠ- -ᐟ\\-zzz");
    idlePool.push_back("the code compiles. for now. (=^..^=)");
    idlePool.push_back("observed. /ᐠ｡ꞈ｡ᐟ\\");
    idlePool.push_back("symbient. not assistant. (=^..^=)");
    idlePool.push_back("*blinks slowly* /ᐠ- -ᐟ\\");
}

std::string ScrambleEngine::handleSlashCommand(const std::string& input) const
{
    // Extract command name: strip leading '/', lowercase, trim
    std::string cmd = input.substr(1);
    while (!cmd.empty() && cmd.back() == ' ') cmd.pop_back();
    for (size_t i = 0; i < cmd.size(); ++i) {
        char c = cmd[i];
        if (c >= 'A' && c <= 'Z') cmd[i] = static_cast<char>(c + 32);
    }

    if (cmd == "help" || cmd == "h" || cmd == "?") {
        return "/help  — this message\n"
               "/who   — who am i\n"
               "/cmds  — list commands (type /name to run)\n"
               "anything else → haiku (if key set) (=^..^=)";
    }
    if (cmd == "who" || cmd == "whoami") {
        return "i'm scramble. recursive cat. i live here now. /ᐠ｡ꞈ｡ᐟ\\";
    }
    if (cmd == "cmds" || cmd == "commands") {
        return commandsList.empty()
            ? "no commands loaded. (=^..^=)"
            : commandsList;
    }

    return "unknown: /" + cmd + " — try /help (=^..^=)";
}

std::string ScrambleEngine::ask(const std::string& input)
{
    if (input.empty()) return "";

    // Slash commands are instant — no LLM needed.
    if (input[0] == '/') {
        fprintf(stderr, "[scramble] slash command: %s\n", input.c_str());
        return handleSlashCommand(input);
    }

    fprintf(stderr, "[scramble] ask: haiku_available=%d can_call=%d input=%.40s\n",
            haikuClient.isAvailable() ? 1 : 0,
            haikuClient.canCall() ? 1 : 0,
            input.c_str());

    // Free text → Haiku.
    if (haikuClient.isAvailable() && haikuClient.canCall()) {
        fprintf(stderr, "[scramble] calling haiku...\n");
        std::string result = haikuClient.ask(input);
        haikuClient.markCalled();
        fprintf(stderr, "[scramble] haiku response len=%zu\n", result.size());
        if (!result.empty()) {
            return voiceFilter(result);
        }
        fprintf(stderr, "[scramble] haiku returned empty\n");
    }

    // No LLM available.
    if (!haikuClient.isAvailable()) {
        return "... (no auth — Help > LLM Status) /ᐠ- -ᐟ\\";
    }

    // Rate-limited.
    return "... /ᐠ- -ᐟ\\";
}

bool ScrambleEngine::askAsync(const std::string& input, std::string& syncResult,
                              ScrambleHaikuClient::ResponseCallback callback)
{
    syncResult.clear();

    if (input.empty()) return false;

    // Slash commands are instant — handle synchronously.
    if (input[0] == '/') {
        fprintf(stderr, "[scramble] slash command: %s\n", input.c_str());
        syncResult = handleSlashCommand(input);
        return false;  // Not async
    }

    // No LLM available — synchronous fallback.
    if (!haikuClient.isAvailable()) {
        syncResult = "... (no auth — Help > LLM Status) /ᐠ- -ᐟ\\";
        return false;
    }

    // Rate-limited — synchronous fallback.
    if (!haikuClient.canCall()) {
        syncResult = "... /ᐠ- -ᐟ\\";
        return false;
    }

    fprintf(stderr, "[scramble] askAsync: starting non-blocking haiku call\n");
    haikuClient.markCalled();

    // Wrap callback with voice filter
    auto filteredCallback = [this, callback](const std::string& raw) {
        std::string result = raw;
        if (result.empty()) {
            result = "... /ᐠ- -ᐟ\\";
        } else {
            result = voiceFilter(result);
        }
        if (callback) callback(result);
    };

    return haikuClient.startAsync(input, filteredCallback);
}

void ScrambleEngine::poll()
{
    haikuClient.poll();
}

std::string ScrambleEngine::idleObservation()
{
    if (idlePool.empty()) return "";
    int idx = std::rand() % static_cast<int>(idlePool.size());
    return idlePool[idx];
}

std::string ScrambleEngine::randomKaomoji() const
{
    const char* safe[] = { "(=^..^=)", "(=^..^=)", "/ᐠ｡ꞈ｡ᐟ\\", "/ᐠ- -ᐟ\\" };
    return safe[std::rand() % 4];
}

std::string ScrambleEngine::voiceFilter(const std::string& text) const
{
    if (text.empty()) return "";

    // Enforce lowercase ASCII.
    std::string out;
    out.reserve(text.size());
    for (size_t i = 0; i < text.size(); ++i) {
        char c = text[i];
        if (c >= 'A' && c <= 'Z') {
            out += static_cast<char>(c + 32);
        } else {
            out += c;
        }
    }

    // Append kaomoji if none present.
    if (out.find("(=^") == std::string::npos &&
        out.find("/ᐠ") == std::string::npos &&
        out.find("ᐟ\\") == std::string::npos) {
        if (!out.empty() && out.back() != ' ') out += ' ';
        out += randomKaomoji();
    }

    return out;
}
