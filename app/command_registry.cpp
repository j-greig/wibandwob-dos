#include "command_registry.h"

#include "api_ipc.h"

#include <sstream>

extern void api_cascade(TTestPatternApp& app);
extern void api_toggle_scramble(TTestPatternApp& app);
extern void api_expand_scramble(TTestPatternApp& app);
extern std::string api_scramble_say(TTestPatternApp& app, const std::string& text);
extern std::string api_scramble_pet(TTestPatternApp& app);
extern std::string api_chat_receive(TTestPatternApp& app, const std::string& sender, const std::string& text);
extern void api_tile(TTestPatternApp& app);
extern void api_close_all(TTestPatternApp& app);
extern void api_save_workspace(TTestPatternApp& app);
extern bool api_open_workspace_path(TTestPatternApp& app, const std::string& path);
extern void api_screenshot(TTestPatternApp& app);
extern void api_set_pattern_mode(TTestPatternApp& app, const std::string& mode);
extern std::string api_set_theme_mode(TTestPatternApp& app, const std::string& mode);
extern std::string api_set_theme_variant(TTestPatternApp& app, const std::string& variant);
extern std::string api_reset_theme(TTestPatternApp& app);
class TRect;
extern void api_spawn_paint(TTestPatternApp& app, const TRect* bounds);
extern void api_spawn_micropolis_ascii(TTestPatternApp& app, const TRect* bounds);
extern void api_spawn_quadra(TTestPatternApp& app, const TRect* bounds);
extern void api_spawn_snake(TTestPatternApp& app, const TRect* bounds);
extern void api_spawn_terminal(TTestPatternApp& app, const TRect* bounds);
extern std::string api_terminal_write(TTestPatternApp& app, const std::string& text);

const std::vector<CommandCapability>& get_command_capabilities() {
    static const std::vector<CommandCapability> capabilities = {
        {"cascade", "Cascade all windows on desktop", false},
        {"tile", "Tile all windows on desktop", false},
        {"close_all", "Close all windows", false},
        {"save_workspace", "Save current workspace", false},
        {"open_workspace", "Open workspace from a path", true},
        {"screenshot", "Capture screen to a text snapshot", false},
        {"pattern_mode", "Set pattern mode: continuous or tiled", false},
        {"set_theme_mode", "Set theme mode: light or dark", true},
        {"set_theme_variant", "Set theme variant: monochrome or dark_pastel", true},
        {"reset_theme", "Reset theme to default (monochrome + light)", false},
        {"open_scramble", "Toggle Scramble cat overlay", false},
        {"scramble_expand", "Toggle Scramble between smol and tall mode", false},
        {"scramble_say", "Send a message to Scramble chat (requires text param)", true},
        {"scramble_pet", "Pet the cat. She allows it.", false},
        {"new_paint_canvas", "Open a new paint canvas window", false},
        {"open_micropolis_ascii", "Open Micropolis ASCII MVP window", false},
        {"open_quadra", "Open Quadra falling blocks game", false},
        {"open_snake", "Open Snake game", false},
        {"open_terminal", "Open a terminal emulator window", false},
        {"terminal_write", "Send text input to the terminal emulator (requires text param)", true},
        {"chat_receive", "Display a remote chat message in Scramble (sender + text params)", true},
    };
    return capabilities;
}

static std::string json_escape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char ch : s) {
        switch (ch) {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out += ch; break;
        }
    }
    return out;
}

std::string get_command_capabilities_json() {
    std::ostringstream os;
    os << "{\"version\":\"v1\",\"commands\":[";
    const auto& caps = get_command_capabilities();
    for (size_t i = 0; i < caps.size(); ++i) {
        const auto& cap = caps[i];
        if (i > 0)
            os << ",";
        os << "{"
           << "\"name\":\"" << json_escape(cap.name) << "\","
           << "\"description\":\"" << json_escape(cap.description) << "\","
           << "\"requires_path\":" << (cap.requires_path ? "true" : "false")
           << "}";
    }
    os << "]}";
    return os.str();
}

std::string exec_registry_command(
    TTestPatternApp& app,
    const std::string& name,
    const std::map<std::string, std::string>& kv) {
    if (name == "cascade") {
        api_cascade(app);
        return "ok";
    }
    if (name == "tile") {
        api_tile(app);
        return "ok";
    }
    if (name == "close_all") {
        api_close_all(app);
        return "ok";
    }
    if (name == "save_workspace") {
        api_save_workspace(app);
        return "ok";
    }
    if (name == "open_workspace") {
        auto it = kv.find("path");
        if (it == kv.end() || it->second.empty())
            return "err missing path";
        return api_open_workspace_path(app, it->second) ? "ok" : "err open workspace failed";
    }
    if (name == "screenshot") {
        api_screenshot(app);
        return "ok";
    }
    if (name == "pattern_mode") {
        auto it = kv.find("mode");
        std::string mode = (it == kv.end() || it->second.empty()) ? "continuous" : it->second;
        api_set_pattern_mode(app, mode);
        return "ok";
    }
    if (name == "set_theme_mode") {
        auto it = kv.find("mode");
        if (it == kv.end() || it->second.empty())
            return "err missing mode";
        return api_set_theme_mode(app, it->second);
    }
    if (name == "set_theme_variant") {
        auto it = kv.find("variant");
        if (it == kv.end() || it->second.empty())
            return "err missing variant";
        return api_set_theme_variant(app, it->second);
    }
    if (name == "reset_theme") {
        return api_reset_theme(app);
    }
    if (name == "open_scramble") {
        api_toggle_scramble(app);
        return "ok";
    }
    if (name == "scramble_expand") {
        api_expand_scramble(app);
        return "ok";
    }
    if (name == "scramble_say") {
        auto it = kv.find("text");
        if (it == kv.end() || it->second.empty())
            return "err missing text";
        return api_scramble_say(app, it->second);
    }
    if (name == "scramble_pet") {
        return api_scramble_pet(app);
    }
    if (name == "new_paint_canvas") {
        api_spawn_paint(app, nullptr);
        return "ok";
    }
    if (name == "open_micropolis_ascii") {
        api_spawn_micropolis_ascii(app, nullptr);
        return "ok";
    }
    if (name == "open_quadra") {
        api_spawn_quadra(app, nullptr);
        return "ok";
    }
    if (name == "open_snake") {
        api_spawn_snake(app, nullptr);
        return "ok";
    }
    if (name == "open_terminal") {
        api_spawn_terminal(app, nullptr);
        return "ok";
    }
    if (name == "terminal_write") {
        auto it = kv.find("text");
        if (it == kv.end() || it->second.empty())
            return "err missing text";
        return api_terminal_write(app, it->second);
    }
    if (name == "chat_receive") {
        auto itSender = kv.find("sender");
        auto itText = kv.find("text");
        if (itText == kv.end() || itText->second.empty())
            return "err missing text";
        std::string sender = (itSender != kv.end()) ? itSender->second : "remote";
        return api_chat_receive(app, sender, itText->second);
    }
    return "err unknown command";
}
