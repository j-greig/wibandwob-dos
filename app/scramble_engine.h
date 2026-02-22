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
#include <functional>
#include <ctime>
#include <cstdlib>
#include <cstdio>

/*---------------------------------------------------------*/
/* ScrambleHaikuClient - curl/CLI Haiku LLM calls          */
/*---------------------------------------------------------*/

class ScrambleHaikuClient {
public:
    ScrambleHaikuClient();
    ~ScrambleHaikuClient();

    // Configure from AuthConfig singleton. Returns true if auth available.
    bool configure();

    // Set key directly at runtime (e.g. from Tools > API Key dialog).
    void setApiKey(const std::string& key);

    // Synchronous ask (BLOCKS — only use from tests or background threads).
    std::string ask(const std::string& question) const;

    // Async ask: starts subprocess, returns immediately. Call poll() from event loop.
    using ResponseCallback = std::function<void(const std::string&)>;
    bool startAsync(const std::string& question, ResponseCallback callback);
    void poll();       // Non-blocking check for completion
    bool isBusy() const { return activePipe != nullptr; }
    void cancelAsync();

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

    // Async state
    FILE* activePipe = nullptr;
    std::string outputBuffer;
    ResponseCallback pendingCallback;
    bool asyncIsCliMode = false;  // Which backend the active pipe uses

    // Scramble system prompt (personality + context).
    std::string buildSystemPrompt() const;

    // Backend-specific command builders (return the popen command string).
    std::string buildCliCommand(const std::string& question) const;
    std::string buildCurlCommand(const std::string& question) const;

    // Synchronous implementations (kept for tests).
    std::string askViaCli(const std::string& question) const;
    std::string askViaCurl(const std::string& question) const;

    // Parse curl JSON response → text.
    std::string parseCurlResponse(const std::string& raw) const;

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

    // Synchronous process user input (blocks on LLM — use askAsync instead).
    std::string ask(const std::string& input);

    // Async ask: starts LLM call, returns "" for slash commands handled inline,
    // or starts async and returns empty. Callback fires when done.
    // Returns true if async started, false if handled synchronously (check syncResult).
    bool askAsync(const std::string& input, std::string& syncResult,
                  ScrambleHaikuClient::ResponseCallback callback);

    // Poll async completion. Call from timer/idle loop.
    void poll();

    // Is the engine waiting for an async LLM response?
    bool isBusy() const { return haikuClient.isBusy(); }

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
