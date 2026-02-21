#include "command_registry.h"

#include <iostream>
#include <string>

// Test stubs for symbols referenced by command_registry.cpp dispatch function.
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
std::string api_paint_cell(TTestPatternApp&, const std::string&, int, int, uint8_t, uint8_t) { return "ok"; }
std::string api_paint_text(TTestPatternApp&, const std::string&, int, int, const std::string&, uint8_t, uint8_t) { return "ok"; }
std::string api_paint_line(TTestPatternApp&, const std::string&, int, int, int, int, bool) { return "ok"; }
std::string api_paint_rect(TTestPatternApp&, const std::string&, int, int, int, int, bool) { return "ok"; }
std::string api_paint_clear(TTestPatternApp&, const std::string&) { return "ok"; }
std::string api_paint_export(TTestPatternApp&, const std::string&) { return "ok"; }

int main() {
    const std::string payload = get_command_capabilities_json();

    const char* required[] = {
        "\"name\":\"cascade\"",
        "\"name\":\"tile\"",
        "\"name\":\"close_all\"",
        "\"name\":\"save_workspace\"",
        "\"name\":\"open_workspace\"",
        "\"name\":\"screenshot\"",
        "\"name\":\"pattern_mode\"",
        "\"name\":\"set_theme_mode\"",
        "\"name\":\"set_theme_variant\"",
        "\"name\":\"reset_theme\"",
        "\"name\":\"open_scramble\"",
        "\"name\":\"scramble_expand\"",
        "\"name\":\"scramble_say\"",
        "\"name\":\"scramble_pet\"",
        "\"name\":\"new_paint_canvas\"",
        "\"name\":\"open_micropolis_ascii\"",
        "\"name\":\"open_quadra\"",
        "\"name\":\"open_snake\"",
        "\"name\":\"open_rogue\"",
        "\"name\":\"open_deep_signal\"",
        "\"name\":\"open_apps\"",
        "\"name\":\"open_terminal\"",
        "\"name\":\"terminal_write\"",
        "\"name\":\"chat_receive\"",
        "\"name\":\"paint_cell\"",
        "\"name\":\"paint_text\"",
        "\"name\":\"paint_line\"",
        "\"name\":\"paint_rect\"",
        "\"name\":\"paint_clear\"",
        "\"name\":\"paint_export\"",
    };

    for (const char* token : required) {
        if (payload.find(token) == std::string::npos) {
            std::cerr << "missing capability token: " << token << "\n";
            return 1;
        }
    }
    return 0;
}
