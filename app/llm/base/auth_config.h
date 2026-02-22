/*---------------------------------------------------------*/
/*                                                         */
/*   auth_config.h - Unified Auth Configuration            */
/*                                                         */
/*   Single auth mode for all LLM consumers.               */
/*   Detect once at startup, read everywhere.              */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef AUTH_CONFIG_H
#define AUTH_CONFIG_H

#include <string>

enum class AuthMode {
    ClaudeCode,   // claude CLI logged in → SDK + CLI subprocess
    ApiKey,       // ANTHROPIC_API_KEY set → direct curl fallback
    NoAuth        // Nothing available → disabled
};

class AuthConfig {
public:
    // Singleton access
    static AuthConfig& instance();

    // Detect auth mode (call once at startup)
    void detect();

    // Accessors
    AuthMode mode() const { return currentMode; }
    const std::string& apiKey() const { return cachedApiKey; }
    const std::string& claudePath() const { return cachedClaudePath; }

    // Human-readable mode name
    const char* modeName() const;

    // Convenience checks
    bool hasAuth() const { return currentMode != AuthMode::NoAuth; }
    bool isClaudeCode() const { return currentMode == AuthMode::ClaudeCode; }
    bool isApiKey() const { return currentMode == AuthMode::ApiKey; }

private:
    AuthConfig() = default;
    ~AuthConfig() = default;
    AuthConfig(const AuthConfig&) = delete;
    AuthConfig& operator=(const AuthConfig&) = delete;

    AuthMode currentMode = AuthMode::NoAuth;
    std::string cachedApiKey;
    std::string cachedClaudePath;

    // Detection helpers
    bool detectClaudeCli();
    bool detectApiKey();
};

#endif // AUTH_CONFIG_H
