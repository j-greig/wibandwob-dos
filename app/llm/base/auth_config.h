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

    // Claude auth detail (populated when mode == ClaudeCode)
    const std::string& claudeEmail() const { return cachedClaudeEmail; }
    const std::string& claudeAuthMethod() const { return cachedClaudeAuthMethod; }

    // Human-readable mode name (for status bar)
    const char* modeName() const;

    // Human-readable status summary (for Help > LLM Status dialog)
    std::string statusSummary() const;

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
    std::string cachedClaudeEmail;
    std::string cachedClaudeAuthMethod;

    // Detection helpers
    bool detectClaudeCli();
    bool detectApiKey();

    // Probe claude auth status (runs `claude auth status`)
    bool probeClaudeAuth();
};

#endif // AUTH_CONFIG_H
