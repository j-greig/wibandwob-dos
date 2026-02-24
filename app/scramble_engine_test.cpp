/*---------------------------------------------------------*/
/*   scramble_engine_test.cpp - ctest for engine           */
/*---------------------------------------------------------*/

#include "scramble_engine.h"
#include "command_registry.h"

#include <iostream>
#include <string>
#include <cstdlib>

// Stubs for command_registry.cpp link dependencies
class TWwdosApp {};
void api_cascade(TWwdosApp&) {}
void api_tile(TWwdosApp&) {}
void api_close_all(TWwdosApp&) {}
void api_save_workspace(TWwdosApp&) {}
bool api_open_workspace_path(TWwdosApp&, const std::string&) { return true; }
void api_screenshot(TWwdosApp&) {}
void api_set_pattern_mode(TWwdosApp&, const std::string&) {}
std::string api_set_theme_mode(TWwdosApp&, const std::string&) { return "ok"; }
std::string api_set_theme_variant(TWwdosApp&, const std::string&) { return "ok"; }
std::string api_reset_theme(TWwdosApp&) { return "ok"; }
void api_toggle_scramble(TWwdosApp&) {}
void api_expand_scramble(TWwdosApp&) {}
std::string api_scramble_say(TWwdosApp&, const std::string&) { return "ok"; }
std::string api_scramble_pet(TWwdosApp&) { return "ok"; }
class TRect;
void api_spawn_paint(TWwdosApp&, const TRect*) {}
void api_spawn_micropolis_ascii(TWwdosApp&, const TRect*) {}
void api_spawn_quadra(TWwdosApp&, const TRect*) {}
void api_spawn_snake(TWwdosApp&, const TRect*) {}
void api_spawn_rogue(TWwdosApp&, const TRect*) {}
void api_spawn_deep_signal(TWwdosApp&, const TRect*) {}
void api_spawn_app_launcher(TWwdosApp&, const TRect*) {}
void api_spawn_terminal(TWwdosApp&, const TRect*) {}
std::string api_terminal_write(TWwdosApp&, const std::string&, const std::string&) { return "ok"; }
std::string api_terminal_read(TWwdosApp&, const std::string&) { return ""; }
std::string api_chat_receive(TWwdosApp&, const std::string&, const std::string&) { return "ok"; }
std::string api_wibwob_ask(TWwdosApp&, const std::string&) { return "ok"; }
std::string api_paint_cell(TWwdosApp&, const std::string&, int, int, uint8_t, uint8_t) { return "ok"; }
std::string api_paint_text(TWwdosApp&, const std::string&, int, int, const std::string&, uint8_t, uint8_t) { return "ok"; }
std::string api_paint_line(TWwdosApp&, const std::string&, int, int, int, int, bool) { return "ok"; }
std::string api_paint_rect(TWwdosApp&, const std::string&, int, int, int, int, bool) { return "ok"; }
std::string api_paint_clear(TWwdosApp&, const std::string&) { return "ok"; }
std::string api_paint_export(TWwdosApp&, const std::string&) { return "ok"; }

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
