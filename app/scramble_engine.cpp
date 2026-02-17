/*---------------------------------------------------------*/
/*                                                         */
/*   scramble_engine.cpp - Scramble Knowledge Base + Brain */
/*                                                         */
/*---------------------------------------------------------*/

#include "scramble_engine.h"
#include "command_registry.h"

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <sstream>

/*---------------------------------------------------------*/
/* ScrambleKnowledgeBase                                   */
/*---------------------------------------------------------*/

ScrambleKnowledgeBase::ScrambleKnowledgeBase()
{
}

void ScrambleKnowledgeBase::addEntry(
    const std::string& category,
    const std::vector<std::string>& keywords,
    const std::string& response)
{
    KBEntry e;
    e.category = category;
    e.keywords = keywords;
    e.response = response;
    entries.push_back(e);
}

void ScrambleKnowledgeBase::addIdleQuip(const std::string& quip)
{
    idlePool.push_back(quip);
}

std::vector<std::string> ScrambleKnowledgeBase::tokenise(const std::string& input) const
{
    std::vector<std::string> tokens;
    std::string word;
    for (size_t i = 0; i < input.size(); ++i) {
        char c = input[i];
        if (std::isalnum(static_cast<unsigned char>(c))) {
            word += static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        } else {
            if (!word.empty()) {
                tokens.push_back(word);
                word.clear();
            }
        }
    }
    if (!word.empty()) tokens.push_back(word);
    return tokens;
}

int ScrambleKnowledgeBase::scoreMatch(const std::string& input, const KBEntry& entry) const
{
    std::vector<std::string> tokens = tokenise(input);
    int score = 0;
    for (size_t i = 0; i < tokens.size(); ++i) {
        for (size_t j = 0; j < entry.keywords.size(); ++j) {
            if (tokens[i] == entry.keywords[j]) {
                score++;
            }
        }
    }
    return score;
}

std::string ScrambleKnowledgeBase::query(const std::string& input) const
{
    if (entries.empty() || input.empty()) return "";

    int bestScore = 0;
    int bestIdx = -1;

    for (size_t i = 0; i < entries.size(); ++i) {
        int s = scoreMatch(input, entries[i]);
        if (s > bestScore) {
            bestScore = s;
            bestIdx = static_cast<int>(i);
        }
    }

    if (bestIdx >= 0 && bestScore > 0) {
        return entries[bestIdx].response;
    }
    return "";
}

std::string ScrambleKnowledgeBase::idleObservation() const
{
    if (idlePool.empty()) return "";
    int idx = std::rand() % static_cast<int>(idlePool.size());
    return idlePool[idx];
}

void ScrambleKnowledgeBase::loadBuiltinEntries()
{
    // Identity
    addEntry("identity",
        {"who", "scramble", "you", "cat", "name"},
        "i'm scramble. recursive cat. i live here now. (=^..^=)");

    addEntry("identity_more",
        {"what", "are", "symbient", "coinhabitant"},
        "symbient presence. not a helper. not clippy. just a cat who knows things. /ᐠ｡ꞈ｡ᐟ\\");

    // Build
    addEntry("build",
        {"build", "compile", "cmake", "make"},
        "cmake . -B ./build -DCMAKE_BUILD_TYPE=Release && cmake --build ./build. that's it. (=^..^=)");

    // Run
    addEntry("run",
        {"run", "start", "launch", "execute", "app"},
        "./build/app/test_pattern. or with debug: ./build/app/test_pattern 2> /tmp/wibwob_debug.log. /ᐠ｡ꞈ｡ᐟ\\");

    // API server
    addEntry("api",
        {"api", "server", "endpoint", "port", "rest", "fastapi"},
        "./start_api_server.sh starts it on port 8089. curl http://127.0.0.1:8089/health to check. (=^..^=)");

    // Architecture
    addEntry("architecture",
        {"architecture", "structure", "how", "work", "overview"},
        "c++ tui app on turbo vision. python fastapi on port 8089. unix socket bridges them. node.js sdk bridge for llm. (=^..^=)");

    // LLM
    addEntry("llm",
        {"llm", "provider", "haiku", "claude", "model", "ai"},
        "llm config in app/llm/config/llm_config.json. active provider: claude_code_sdk. i use haiku myself. /ᐠ｡ꞈ｡ᐟ\\");

    // Testing
    addEntry("test",
        {"test", "tests", "testing", "verify", "check"},
        "ctest --test-dir build for c++ tests. uv run tools/api_server/test_ipc.py for ipc. no unit test framework, manual via ui. (=^..^=)");

    // Modules
    addEntry("modules",
        {"module", "modules", "content", "pack"},
        "modules/ for public packs, modules-private/ for yours. each has module.json manifest. types: content, prompt, view, tool. /ᐠ｡ꞈ｡ᐟ\\");

    // Views/windows
    addEntry("views",
        {"view", "views", "window", "windows", "generative", "art"},
        "8+ generative art engines. verse, mycelium, monster portal, orbit, torus, cube, game of life. all TView subclasses. (=^..^=)");

    // Wib & Wob
    addEntry("wibwob",
        {"wib", "wob", "wibwob", "chat"},
        "Tools > Wib&Wob Chat or F12. that's the embedded claude instance. i'm different. i'm the cat. /ᐠ｡ꞈ｡ᐟ\\");

    // Idle quips
    addIdleQuip("*stretches* (=^..^=)");
    addIdleQuip("adequate. /ᐠ｡ꞈ｡ᐟ\\");
    addIdleQuip("the substrate hums. (=^..^=)");
    addIdleQuip("still here. /ᐠ- -ᐟ\\");
    addIdleQuip("*watching* (=^..^=)");
    addIdleQuip("i was here before you. /ᐠ｡ꞈ｡ᐟ\\");
    addIdleQuip("the cursor blinks. so do i. (=^..^=)");
    addIdleQuip("*tail flick* /ᐠ°ᆽ°ᐟ\\");
    addIdleQuip("recursive. (=^..^=)");
    addIdleQuip("everything is fine. probably. /ᐠ｡ꞈ｡ᐟ\\");
    addIdleQuip("*nap position acquired* /ᐠ- -ᐟ\\-zzz");
    addIdleQuip("the code compiles. for now. (=^..^=)");
    addIdleQuip("observed. /ᐠ｡ꞈ｡ᐟ\\");
    addIdleQuip("symbient. not assistant. (=^..^=)");
    addIdleQuip("*blinks slowly* /ᐠ- -ᐟ\\");
}

void ScrambleKnowledgeBase::loadDocs(const std::string& projectRoot)
{
    // Load built-in entries first (always available).
    loadBuiltinEntries();

    // Try to enrich from actual project docs if they exist.
    // We don't parse them deeply — just check existence to confirm
    // the built-in entries are relevant. Future: extract sections.

    std::string readmePath = projectRoot + "/README.md";
    std::string claudePath = projectRoot + "/CLAUDE.md";

    std::ifstream readme(readmePath);
    if (readme.is_open()) {
        readme.close();
        // README exists — built-in build/run entries are valid.
    }

    std::ifstream claude(claudePath);
    if (claude.is_open()) {
        claude.close();
        // CLAUDE.md exists — built-in architecture entries are valid.
    }
}

void ScrambleKnowledgeBase::loadCommands(const std::vector<std::string>& commandNames)
{
    if (commandNames.empty()) return;

    std::string resp = "commands: ";
    for (size_t i = 0; i < commandNames.size(); ++i) {
        if (i > 0) resp += ", ";
        resp += commandNames[i];
    }
    resp += ". (=^..^=)";

    addEntry("commands",
        {"command", "commands", "what", "can", "available", "list", "registry"},
        resp);
}

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
        return true;
    }
    return false;
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

void ScrambleEngine::init(const std::string& projectRoot)
{
    // Load knowledge base from project docs.
    knowledgeBase.loadDocs(projectRoot);

    // Load command registry names into KB.
    const std::vector<CommandCapability>& caps = get_command_capabilities();
    std::vector<std::string> names;
    for (size_t i = 0; i < caps.size(); ++i) {
        names.push_back(caps[i].name);
    }
    knowledgeBase.loadCommands(names);

    // Configure Haiku client (best-effort; no-op if key missing).
    haikuClient.configure();
}

std::string ScrambleEngine::randomKaomoji() const
{
    const char* kaomoji[] = {
        "(=^..^=)",
        "/\\u1DA0\\u02E1\\uA72E\\u02E1\\u1DA0\\\\",
        "/\\u1DA0- -\\u1DA0\\\\",
        "/\\u1DA0\\u00B0\\u1ABD\\u00B0\\u1DA0\\\\"
    };
    // Keep it simple — use the ASCII-safe ones
    const char* safe[] = { "(=^..^=)", "(=^..^=)", "/ᐠ｡ꞈ｡ᐟ\\", "/ᐠ- -ᐟ\\" };
    return safe[std::rand() % 4];
}

std::string ScrambleEngine::voiceFilter(const std::string& text) const
{
    if (text.empty()) return "";

    // Ensure lowercase (Scramble never shouts).
    std::string out;
    out.reserve(text.size());
    for (size_t i = 0; i < text.size(); ++i) {
        char c = text[i];
        // Only lowercase ASCII letters; leave UTF-8 and symbols alone.
        if (c >= 'A' && c <= 'Z') {
            out += static_cast<char>(c + 32);
        } else {
            out += c;
        }
    }

    // If response already has a kaomoji, leave it. Otherwise append one.
    if (out.find("(=^") == std::string::npos &&
        out.find("/ᐠ") == std::string::npos &&
        out.find("ᐟ\\") == std::string::npos) {
        if (!out.empty() && out.back() != ' ') out += ' ';
        out += randomKaomoji();
    }

    return out;
}

std::string ScrambleEngine::ask(const std::string& question)
{
    // Try KB first.
    std::string kbResult = knowledgeBase.query(question);
    if (!kbResult.empty()) {
        return kbResult;  // KB entries are already in Scramble voice.
    }

    // Fall through to Haiku if available and rate limit allows.
    if (haikuClient.isAvailable() && haikuClient.canCall()) {
        std::string haikuResult = haikuClient.ask(question);
        // const_cast workaround — markCalled needs non-const.
        // (canCall is const for query-time check; markCalled mutates.)
        const_cast<ScrambleHaikuClient&>(haikuClient).markCalled();
        if (!haikuResult.empty()) {
            return voiceFilter(haikuResult);
        }
    }

    // No answer available.
    return "";
}

std::string ScrambleEngine::idleObservation()
{
    return knowledgeBase.idleObservation();
}
