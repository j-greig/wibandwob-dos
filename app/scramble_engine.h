/*---------------------------------------------------------*/
/*                                                         */
/*   scramble_engine.h - Scramble Knowledge Base + Brain   */
/*   F02: keyword KB from local docs                       */
/*   F03: Haiku LLM for open questions                     */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef SCRAMBLE_ENGINE_H
#define SCRAMBLE_ENGINE_H

#include <string>
#include <vector>
#include <map>
#include <ctime>
#include <cstdlib>

/*---------------------------------------------------------*/
/* ScrambleKnowledgeBase - keyword-to-response index       */
/*---------------------------------------------------------*/

struct KBEntry {
    std::string category;
    std::vector<std::string> keywords;
    std::string response;  // pre-formatted in Scramble voice
};

class ScrambleKnowledgeBase {
public:
    ScrambleKnowledgeBase();

    // Load docs from filesystem. Call once at startup.
    // projectRoot is the repo root (where README.md lives).
    void loadDocs(const std::string& projectRoot);

    // Load command capabilities from the registry.
    void loadCommands(const std::vector<std::string>& commandNames);

    // Query: returns best-match response, or empty if no match.
    std::string query(const std::string& input) const;

    // Get a random idle observation (for unprompted speech).
    std::string idleObservation() const;

    // Check if KB has any entries loaded.
    bool isLoaded() const { return !entries.empty(); }
    int entryCount() const { return static_cast<int>(entries.size()); }

private:
    std::vector<KBEntry> entries;
    std::vector<std::string> idlePool;  // pool of idle quips

    void addEntry(const std::string& category,
                  const std::vector<std::string>& keywords,
                  const std::string& response);
    void addIdleQuip(const std::string& quip);
    void loadBuiltinEntries();

    // Score a query against an entry's keywords. Higher = better match.
    int scoreMatch(const std::string& input, const KBEntry& entry) const;
    // Tokenise input into lowercase words.
    std::vector<std::string> tokenise(const std::string& input) const;
};

/*---------------------------------------------------------*/
/* ScrambleHaikuClient - curl-based Haiku LLM calls        */
/*---------------------------------------------------------*/

class ScrambleHaikuClient {
public:
    ScrambleHaikuClient();

    // Configure from environment. Returns true if API key found.
    bool configure();

    // Send a question to Haiku. Returns response text, or empty on failure.
    // Blocks until curl completes (typically 1-3 seconds).
    std::string ask(const std::string& question) const;

    // Check if client has API key and is usable.
    bool isAvailable() const { return !apiKey.empty(); }

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
    static const int kRateLimitSeconds = 30;

    // Scramble system prompt (personality + context).
    std::string buildSystemPrompt() const;

    // JSON helpers.
    static std::string jsonEscape(const std::string& s);
};

/*---------------------------------------------------------*/
/* ScrambleEngine - orchestrator (KB + Haiku + voice)      */
/*---------------------------------------------------------*/

class ScrambleEngine {
public:
    ScrambleEngine();

    // Initialise: load KB docs, configure Haiku client.
    void init(const std::string& projectRoot);

    // Ask Scramble a question. Tries KB first, falls through to Haiku.
    // Returns response in Scramble voice, or empty if nothing to say.
    std::string ask(const std::string& question);

    // Get an idle observation (for unprompted speech).
    std::string idleObservation();

    // Access sub-components (for testing).
    const ScrambleKnowledgeBase& kb() const { return knowledgeBase; }
    const ScrambleHaikuClient& haiku() const { return haikuClient; }

private:
    ScrambleKnowledgeBase knowledgeBase;
    ScrambleHaikuClient haikuClient;

    // Apply Scramble voice filter to a response.
    std::string voiceFilter(const std::string& text) const;

    // Pick a random kaomoji signoff.
    std::string randomKaomoji() const;
};

#endif // SCRAMBLE_ENGINE_H
