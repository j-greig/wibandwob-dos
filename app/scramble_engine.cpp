/*---------------------------------------------------------*/
/*                                                         */
/*   scramble_engine.cpp - Scramble Brain                  */
/*   Slash commands + Haiku LLM chat                       */
/*                                                         */
/*---------------------------------------------------------*/

#include "scramble_engine.h"
#include "command_registry.h"

#include <cstdio>
#include <cstring>
#include <fstream>
#include <sstream>

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

bool ScrambleHaikuClient::configure()
{
    const char* key = std::getenv("ANTHROPIC_API_KEY");
    if (key && key[0] != '\0') {
        apiKey = key;
        fprintf(stderr, "[scramble] api key loaded from env ANTHROPIC_API_KEY (len=%zu)\n",
                apiKey.size());
        return true;
    }
    fprintf(stderr, "[scramble] ANTHROPIC_API_KEY not set — haiku unavailable\n");
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

std::string ScrambleHaikuClient::ask(const std::string& question) const
{
    if (!isAvailable()) return "";

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
        return "... (no api key) /ᐠ- -ᐟ\\";
    }

    // Rate-limited.
    return "... /ᐠ- -ᐟ\\";
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
