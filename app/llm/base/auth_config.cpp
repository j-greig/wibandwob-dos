/*---------------------------------------------------------*/
/*                                                         */
/*   auth_config.cpp - Unified Auth Configuration          */
/*                                                         */
/*---------------------------------------------------------*/

#include "auth_config.h"
#include <cstdlib>
#include <cstdio>
#include <unistd.h>
#include <string>
#include <sstream>

AuthConfig& AuthConfig::instance() {
    static AuthConfig singleton;
    return singleton;
}

void AuthConfig::detect() {
    // Priority 1: Claude CLI present AND logged in → Claude Code Auth
    if (detectClaudeCli() && probeClaudeAuth()) {
        currentMode = AuthMode::ClaudeCode;
        fprintf(stderr, "[auth] mode: ClaudeCode (cli=%s, email=%s, method=%s)\n",
                cachedClaudePath.c_str(), cachedClaudeEmail.c_str(),
                cachedClaudeAuthMethod.c_str());
        return;
    }

    // Priority 2: ANTHROPIC_API_KEY → API Key mode (fallback)
    if (detectApiKey()) {
        currentMode = AuthMode::ApiKey;
        fprintf(stderr, "[auth] mode: ApiKey (ANTHROPIC_API_KEY len=%zu)\n", cachedApiKey.size());
        return;
    }

    // Priority 3: Nothing available
    currentMode = AuthMode::NoAuth;
    if (!cachedClaudePath.empty()) {
        fprintf(stderr, "[auth] mode: NoAuth — claude CLI found but not logged in. "
                        "Run 'claude /login'.\n");
    } else {
        fprintf(stderr, "[auth] mode: NoAuth — no claude CLI, no ANTHROPIC_API_KEY\n");
    }
}

const char* AuthConfig::modeName() const {
    switch (currentMode) {
        case AuthMode::ClaudeCode: return "LLM AUTH";
        case AuthMode::ApiKey:     return "LLM KEY";
        case AuthMode::NoAuth:     return "LLM OFF";
    }
    return "LLM ???";
}

std::string AuthConfig::statusSummary() const {
    std::ostringstream ss;

    ss << "LLM Authentication Status\n";
    ss << "=========================\n\n";

    // Current mode
    ss << "Mode: " << modeName() << "\n\n";

    // Claude Code status
    ss << "Claude Code CLI\n";
    if (cachedClaudePath.empty()) {
        ss << "  Binary:  not found on PATH\n";
        ss << "  Status:  unavailable\n";
    } else {
        ss << "  Binary:  " << cachedClaudePath << "\n";
        if (!cachedClaudeEmail.empty()) {
            ss << "  Logged in: yes\n";
            ss << "  Account:   " << cachedClaudeEmail << "\n";
            ss << "  Auth via:  " << cachedClaudeAuthMethod << "\n";
        } else {
            ss << "  Logged in: no\n";
            ss << "  Fix: run 'claude /login'\n";
        }
    }

    ss << "\n";

    // API key status
    ss << "Anthropic API Key\n";
    if (!cachedApiKey.empty()) {
        std::string masked = cachedApiKey.substr(0, 8) + "..." +
            cachedApiKey.substr(cachedApiKey.size() > 4 ? cachedApiKey.size() - 4 : 0);
        ss << "  ANTHROPIC_API_KEY: set (" << masked << ")\n";
    } else {
        ss << "  ANTHROPIC_API_KEY: not set\n";
    }

    ss << "\n";

    // Active consumer mapping
    ss << "Active Configuration\n";
    switch (currentMode) {
        case AuthMode::ClaudeCode:
            ss << "  Wib&Wob Chat: claude_code_sdk (Agent SDK)\n";
            ss << "  Scramble Cat: claude -p --model haiku\n";
            break;
        case AuthMode::ApiKey:
            ss << "  Wib&Wob Chat: anthropic_api (direct HTTP)\n";
            ss << "  Scramble Cat: curl to Messages API\n";
            break;
        case AuthMode::NoAuth:
            ss << "  Wib&Wob Chat: disabled\n";
            ss << "  Scramble Cat: disabled (quips only)\n";
            break;
    }

    return ss.str();
}

bool AuthConfig::detectClaudeCli() {
    // Scan PATH for an executable named "claude"
    const char* pathEnv = std::getenv("PATH");
    if (!pathEnv) return false;

    std::string paths(pathEnv);
    size_t start = 0;
    while (start <= paths.size()) {
        size_t end = paths.find(':', start);
        std::string dir = (end == std::string::npos)
            ? paths.substr(start)
            : paths.substr(start, end - start);
        if (!dir.empty()) {
            std::string candidate = dir + "/claude";
            if (access(candidate.c_str(), X_OK) == 0) {
                cachedClaudePath = candidate;
                return true;
            }
        }
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return false;
}

bool AuthConfig::detectApiKey() {
    const char* key = std::getenv("ANTHROPIC_API_KEY");
    if (key && key[0] != '\0') {
        cachedApiKey = key;
        return true;
    }
    return false;
}

bool AuthConfig::probeClaudeAuth() {
    if (cachedClaudePath.empty()) return false;

    // Run `claude auth status` and parse JSON output
    std::string cmd = cachedClaudePath + " auth status 2>/dev/null";
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) return false;

    std::string output;
    char buffer[1024];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        output += buffer;
    }
    int exitCode = pclose(pipe);

    if (exitCode != 0 || output.empty()) {
        fprintf(stderr, "[auth] claude auth status failed (exit=%d)\n", exitCode);
        return false;
    }

    // Simple JSON parsing — look for "loggedIn": true
    if (output.find("\"loggedIn\": true") == std::string::npos &&
        output.find("\"loggedIn\":true") == std::string::npos) {
        fprintf(stderr, "[auth] claude auth status: not logged in\n");
        return false;
    }

    // Extract email
    auto extractField = [&output](const std::string& key) -> std::string {
        std::string pattern = "\"" + key + "\": \"";
        size_t pos = output.find(pattern);
        if (pos == std::string::npos) {
            // Try without space after colon
            pattern = "\"" + key + "\":\"";
            pos = output.find(pattern);
        }
        if (pos == std::string::npos) return "";
        pos += pattern.size();
        size_t end = output.find("\"", pos);
        if (end == std::string::npos) return "";
        return output.substr(pos, end - pos);
    };

    cachedClaudeEmail = extractField("email");
    cachedClaudeAuthMethod = extractField("authMethod");

    return true;
}
