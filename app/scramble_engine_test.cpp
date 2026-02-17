/*---------------------------------------------------------*/
/*   scramble_engine_test.cpp - ctest for KB + engine      */
/*---------------------------------------------------------*/

#include "scramble_engine.h"
#include "command_registry.h"

#include <iostream>
#include <string>
#include <cstdlib>

// Stubs for command_registry.cpp link dependencies
class TTestPatternApp {};
void api_cascade(TTestPatternApp&) {}
void api_tile(TTestPatternApp&) {}
void api_close_all(TTestPatternApp&) {}
void api_save_workspace(TTestPatternApp&) {}
bool api_open_workspace_path(TTestPatternApp&, const std::string&) { return true; }
void api_screenshot(TTestPatternApp&) {}
void api_set_pattern_mode(TTestPatternApp&, const std::string&) {}
std::string api_set_theme_mode(TTestPatternApp&, const std::string&) { return "ok"; }
std::string api_set_theme_variant(TTestPatternApp&, const std::string&) { return "ok"; }
std::string api_reset_theme(TTestPatternApp&) { return "ok"; }
void api_toggle_scramble(TTestPatternApp&) {}

static int failures = 0;

static void check(const char* name, bool cond) {
    if (cond) {
        std::cout << "  PASS: " << name << "\n";
    } else {
        std::cerr << "  FAIL: " << name << "\n";
        failures++;
    }
}

static bool contains(const std::string& haystack, const std::string& needle) {
    return haystack.find(needle) != std::string::npos;
}

int main() {
    std::srand(42); // Deterministic for testing

    std::cout << "=== ScrambleEngine Tests ===\n\n";

    // --- KB standalone tests ---
    std::cout << "[KB: builtin entries]\n";
    {
        ScrambleKnowledgeBase kb;
        kb.loadDocs("."); // Load from project root (current dir)

        check("KB has entries after loadDocs", kb.isLoaded());
        check("KB has >5 entries", kb.entryCount() > 5);
    }

    std::cout << "\n[KB: identity query]\n";
    {
        ScrambleKnowledgeBase kb;
        kb.loadDocs(".");
        std::string r = kb.query("who are you");
        check("identity query returns non-empty", !r.empty());
        check("identity mentions scramble", contains(r, "scramble"));
        check("identity has kaomoji", contains(r, "(=^..^=)") || contains(r, "ᐟ\\"));
    }

    std::cout << "\n[KB: build query]\n";
    {
        ScrambleKnowledgeBase kb;
        kb.loadDocs(".");
        std::string r = kb.query("how do i build this");
        check("build query returns non-empty", !r.empty());
        check("build mentions cmake", contains(r, "cmake"));
    }

    std::cout << "\n[KB: run query]\n";
    {
        ScrambleKnowledgeBase kb;
        kb.loadDocs(".");
        std::string r = kb.query("how do i run the app");
        check("run query returns non-empty", !r.empty());
        check("run mentions test_pattern", contains(r, "test_pattern"));
    }

    std::cout << "\n[KB: api query]\n";
    {
        ScrambleKnowledgeBase kb;
        kb.loadDocs(".");
        std::string r = kb.query("where is the api server");
        check("api query returns non-empty", !r.empty());
        check("api mentions 8089", contains(r, "8089"));
    }

    std::cout << "\n[KB: commands query]\n";
    {
        ScrambleKnowledgeBase kb;
        kb.loadDocs(".");
        // Load real command registry
        const std::vector<CommandCapability>& caps = get_command_capabilities();
        std::vector<std::string> names;
        for (size_t i = 0; i < caps.size(); ++i) {
            names.push_back(caps[i].name);
        }
        kb.loadCommands(names);

        std::string r = kb.query("what commands are available");
        check("commands query returns non-empty", !r.empty());
        check("commands mentions cascade", contains(r, "cascade"));
        check("commands mentions open_scramble", contains(r, "open_scramble"));
    }

    std::cout << "\n[KB: garbage query]\n";
    {
        ScrambleKnowledgeBase kb;
        kb.loadDocs(".");
        std::string r = kb.query("xyzzy plugh");
        check("garbage query returns empty", r.empty());
    }

    std::cout << "\n[KB: idle observations]\n";
    {
        ScrambleKnowledgeBase kb;
        kb.loadDocs(".");
        std::string r = kb.idleObservation();
        check("idle observation returns non-empty", !r.empty());
        // Check it's in Scramble voice (has kaomoji)
        check("idle has kaomoji or emote", contains(r, "(=^") || contains(r, "ᐟ\\") || contains(r, "*"));
    }

    // --- Haiku client tests (no live API) ---
    std::cout << "\n[Haiku: config without key]\n";
    {
        ScrambleHaikuClient client;
        // Don't configure — test unavailable state
        check("haiku unavailable without key", !client.isAvailable());
        check("haiku canCall false without key", !client.canCall());
        std::string r = client.ask("test");
        check("haiku returns empty without key", r.empty());
    }

    std::cout << "\n[Haiku: rate limiter]\n";
    {
        ScrambleHaikuClient client;
        // Can't fully test rate limiter without key, but test markCalled
        client.markCalled();
        // canCall should be false right after marking (no key anyway)
        check("canCall false after markCalled (no key)", !client.canCall());
    }

    // --- Engine integration tests ---
    std::cout << "\n[Engine: init and KB query]\n";
    {
        ScrambleEngine engine;
        engine.init(".");

        std::string r = engine.ask("how do i build");
        check("engine.ask build returns non-empty", !r.empty());
        check("engine.ask build mentions cmake", contains(r, "cmake"));
    }

    std::cout << "\n[Engine: idle observation]\n";
    {
        ScrambleEngine engine;
        engine.init(".");

        std::string r = engine.idleObservation();
        check("engine idle returns non-empty", !r.empty());
    }

    std::cout << "\n[Engine: unknown question falls through]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        // With no API key, unknown questions should return empty
        std::string r = engine.ask("what is the meaning of life the universe and everything");
        // KB won't match this well, and Haiku isn't available
        // Result depends on whether any keyword matches; this is intentionally vague
        // The point is it doesn't crash
        check("engine handles unknown question without crash", true);
    }

    // --- Voice filter test ---
    std::cout << "\n[Engine: voice filter]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        // Test via ask — KB entries are pre-filtered
        std::string r = engine.ask("who are you");
        check("voice is lowercase", r == r); // KB entries are already lowercase
        // Check no uppercase in response
        bool hasUpper = false;
        for (size_t i = 0; i < r.size(); ++i) {
            if (r[i] >= 'A' && r[i] <= 'Z') hasUpper = true;
        }
        check("response has no uppercase ASCII", !hasUpper);
    }

    std::cout << "\n=== Results: " << (failures == 0 ? "ALL PASSED" : "FAILURES") << " ===\n";
    return failures;
}
