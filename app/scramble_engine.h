/*---------------------------------------------------------*/
/*                                                         */
/*   scramble_engine.h - Scramble Brain                    */
/*   Slash commands + Haiku LLM chat                       */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef SCRAMBLE_ENGINE_H
#define SCRAMBLE_ENGINE_H

#include <string>
#include <vector>
#include <ctime>
#include <cstdlib>

/*---------------------------------------------------------*/
/* ScrambleHaikuClient - curl-based Haiku LLM calls        */
/*---------------------------------------------------------*/

class ScrambleHaikuClient {
public:
    ScrambleHaikuClient();

    // Configure from environment. Returns true if API key found.
    bool configure();

    // Set key directly at runtime (e.g. from Tools > API Key dialog).
    void setApiKey(const std::string& key);

    // Send a question to Haiku. Returns response text, or empty on failure.
    // Blocks until curl completes (typically 1-3 seconds).
    std::string ask(const std::string& question) const;

    // Check if client is usable (API key or CLI mode).
    bool isAvailable() const { return !apiKey.empty() || useCliMode; }

    // Rate limiting: returns true if enough time has passed since last call.
    bool canCall() const;

    // Mark that a call was just made (updates rate limit timer).
    void markCalled();

private:
    std::string apiKey;
    std::string endpoint;
    std::string model;
    int maxTokens;
    mutable time_t lastCallTime;
    static const int kRateLimitSeconds = 3;  // min gap between Haiku calls

    // Claude Code CLI mode (when logged in via `claude /login`)
    bool useCliMode = false;
    std::string claudeCliPath;

    // Scramble system prompt (personality + context).
    std::string buildSystemPrompt() const;

    // Backend-specific ask implementations.
    std::string askViaCli(const std::string& question) const;
    std::string askViaCurl(const std::string& question) const;

    // JSON helpers.
    static std::string jsonEscape(const std::string& s);
};

/*---------------------------------------------------------*/
/* ScrambleEngine - slash commands + Haiku chat + voice    */
/*---------------------------------------------------------*/

class ScrambleEngine {
public:
    ScrambleEngine();

    // Initialise: load command list, configure Haiku client.
    void init(const std::string& projectRoot);

    // Process user input.
    // - Starts with '/'  → slash command (instant, preset response)
    // - Everything else  → Haiku API (or fallback if no key)
    std::string ask(const std::string& input);

    // Get an idle observation (for unprompted speech).
    std::string idleObservation();

    // Access Haiku client (for testing).
    const ScrambleHaikuClient& haiku() const { return haikuClient; }

    // Check if Haiku is available.
    bool hasLLM() const { return haikuClient.isAvailable(); }

    // Set API key at runtime (called when user sets key via Tools menu).
    void setApiKey(const std::string& key) { haikuClient.setApiKey(key); }

private:
    ScrambleHaikuClient haikuClient;
    std::vector<std::string> idlePool;
    std::string commandsList;   // populated from command registry for /commands

    // Handle a slash command. Input must start with '/'.
    std::string handleSlashCommand(const std::string& input) const;

    // Apply Scramble voice filter: enforce lowercase, append kaomoji if missing.
    std::string voiceFilter(const std::string& text) const;

    // Pick a random kaomoji.
    std::string randomKaomoji() const;

    void loadIdleQuips();
};

#endif // SCRAMBLE_ENGINE_H
