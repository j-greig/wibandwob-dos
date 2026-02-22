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

AuthConfig& AuthConfig::instance() {
    static AuthConfig singleton;
    return singleton;
}

void AuthConfig::detect() {
    // Priority 1: Claude CLI logged in → Claude Code Auth (richest path)
    if (detectClaudeCli()) {
        currentMode = AuthMode::ClaudeCode;
        fprintf(stderr, "[auth] mode: ClaudeCode (claude CLI at: %s)\n", cachedClaudePath.c_str());
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
    fprintf(stderr, "[auth] mode: NoAuth — no claude CLI, no ANTHROPIC_API_KEY\n");
}

const char* AuthConfig::modeName() const {
    switch (currentMode) {
        case AuthMode::ClaudeCode: return "ClaudeCode";
        case AuthMode::ApiKey:     return "ApiKey";
        case AuthMode::NoAuth:     return "NoAuth";
    }
    return "Unknown";
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
