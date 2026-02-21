/*---------------------------------------------------------*/
/*   scramble_engine_test.cpp - ctest for engine           */
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
void api_expand_scramble(TTestPatternApp&) {}
std::string api_scramble_say(TTestPatternApp&, const std::string&) { return "ok"; }
std::string api_scramble_pet(TTestPatternApp&) { return "ok"; }
class TRect;
void api_spawn_paint(TTestPatternApp&, const TRect*) {}
void api_spawn_micropolis_ascii(TTestPatternApp&, const TRect*) {}
void api_spawn_quadra(TTestPatternApp&, const TRect*) {}
void api_spawn_snake(TTestPatternApp&, const TRect*) {}
void api_spawn_rogue(TTestPatternApp&, const TRect*) {}
void api_spawn_deep_signal(TTestPatternApp&, const TRect*) {}
void api_spawn_app_launcher(TTestPatternApp&, const TRect*) {}
void api_spawn_terminal(TTestPatternApp&, const TRect*) {}
std::string api_terminal_write(TTestPatternApp&, const std::string&, const std::string&) { return "ok"; }
std::string api_terminal_read(TTestPatternApp&, const std::string&) { return ""; }
std::string api_chat_receive(TTestPatternApp&, const std::string&, const std::string&) { return "ok"; }
std::string api_wibwob_ask(TTestPatternApp&, const std::string&) { return "ok"; }

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
    std::srand(42);

    std::cout << "=== ScrambleEngine Tests ===\n\n";

    // --- Slash command tests ---
    std::cout << "[Slash: /help]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        std::string r = engine.ask("/help");
        check("/help returns non-empty", !r.empty());
        check("/help mentions /who", contains(r, "/who"));
        check("/help mentions /cmds", contains(r, "/cmds"));
        check("/help has kaomoji", contains(r, "(=^..^=)") || contains(r, "ᐟ\\"));
    }

    std::cout << "\n[Slash: /who]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        std::string r = engine.ask("/who");
        check("/who returns non-empty", !r.empty());
        check("/who mentions scramble", contains(r, "scramble"));
        check("/who has kaomoji", contains(r, "(=^..^=)") || contains(r, "ᐟ\\"));
    }

    std::cout << "\n[Slash: /cmds]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        std::string r = engine.ask("/cmds");
        check("/cmds returns non-empty", !r.empty());
        check("/cmds mentions cascade", contains(r, "cascade"));
        check("/cmds mentions open_scramble", contains(r, "open_scramble"));
        check("/cmds mentions scramble_pet", contains(r, "scramble_pet"));
        check("/cmds has kaomoji", contains(r, "(=^..^=)") || contains(r, "ᐟ\\"));
    }

    std::cout << "\n[Slash: unknown command]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        std::string r = engine.ask("/nope");
        check("unknown slash returns non-empty", !r.empty());
        check("unknown slash mentions /help", contains(r, "/help"));
    }

    std::cout << "\n[Slash: aliases]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        std::string help1 = engine.ask("/help");
        std::string help2 = engine.ask("/h");
        std::string help3 = engine.ask("/?");
        check("/h same as /help", help1 == help2);
        check("/? same as /help", help1 == help3);

        std::string cmds1 = engine.ask("/cmds");
        std::string cmds2 = engine.ask("/commands");
        check("/commands same as /cmds", cmds1 == cmds2);
    }

    // --- Free text without Haiku key ---
    std::cout << "\n[LLM: no key fallback]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        // No API key set in test environment
        if (!engine.hasLLM()) {
            std::string r = engine.ask("hello cat");
            check("no-key returns non-empty fallback", !r.empty());
            check("no-key fallback has kaomoji", contains(r, "(=^..^=)") || contains(r, "ᐟ\\"));
        } else {
            check("haiku available (skip no-key test)", true);
        }
    }

    // --- Haiku client unit tests ---
    std::cout << "\n[Haiku: unavailable without key]\n";
    {
        ScrambleHaikuClient client;
        check("unavailable without configure()", !client.isAvailable());
        check("canCall false without key", !client.canCall());
        check("ask returns empty without key", client.ask("test").empty());
    }

    std::cout << "\n[Haiku: rate limiter]\n";
    {
        ScrambleHaikuClient client;
        client.markCalled();
        check("canCall false after markCalled (no key)", !client.canCall());
    }

    // --- Idle observations ---
    std::cout << "\n[Engine: idle observations]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        std::string r = engine.idleObservation();
        check("idle returns non-empty", !r.empty());
        check("idle has kaomoji or emote", contains(r, "(=^") || contains(r, "ᐟ\\") || contains(r, "*"));
    }

    // --- Voice filter (applied to Haiku output) ---
    std::cout << "\n[Engine: voice filter]\n";
    {
        ScrambleEngine engine;
        engine.init(".");
        // Slash commands are pre-filtered; test idle (which is pre-lowercase already)
        std::string r = engine.ask("/who");
        bool hasUpper = false;
        for (size_t i = 0; i < r.size() && r[i] >= 0; ++i) {
            if (r[i] >= 'A' && r[i] <= 'Z') hasUpper = true;
        }
        check("/who response has no uppercase ASCII", !hasUpper);
    }

    std::cout << "\n=== Results: " << (failures == 0 ? "ALL PASSED" : "FAILURES") << " ===\n";
    return failures;
}
