#include "command_registry.h"

#include "api_ipc.h"
#include "core/json_utils.h"

#include <cstdint>
#include <sys/stat.h>

#include <sstream>

// TRect for window bounds
#define Uses_TRect
#define Uses_TPoint
#define Uses_TEvent
#define Uses_TProgram
#include <tvision/tv.h>

extern void api_cascade(TWwdosApp& app);
extern void api_toggle_scramble(TWwdosApp& app);
extern void api_expand_scramble(TWwdosApp& app);
extern std::string api_scramble_say(TWwdosApp& app, const std::string& text);
extern std::string api_scramble_pet(TWwdosApp& app);
extern void api_spawn_room_chat(TWwdosApp& app, const TRect* bounds);
extern std::string api_room_chat_receive(TWwdosApp& app, const std::string& sender, const std::string& text, const std::string& ts);
extern std::string api_room_presence(TWwdosApp& app, const std::string& participants_json);
extern std::string api_chat_receive(TWwdosApp& app, const std::string& sender, const std::string& text);
extern std::string api_wibwob_ask(TWwdosApp& app, const std::string& text);
extern std::string api_get_chat_history(TWwdosApp& app);
extern void api_tile(TWwdosApp& app);
extern void api_close_all(TWwdosApp& app);
extern void api_save_workspace(TWwdosApp& app);
extern bool api_open_workspace_path(TWwdosApp& app, const std::string& path);
extern void api_screenshot(TWwdosApp& app);
extern void api_set_pattern_mode(TWwdosApp& app, const std::string& mode);
extern std::string api_set_theme_mode(TWwdosApp& app, const std::string& mode);
extern std::string api_set_theme_variant(TWwdosApp& app, const std::string& variant);
extern std::string api_reset_theme(TWwdosApp& app);
extern std::string api_window_shadow(TWwdosApp& app, const std::string& id, bool on);
extern std::string api_window_title(TWwdosApp& app, const std::string& id, const std::string& title);
extern std::string api_desktop_preset(TWwdosApp& app, const std::string& preset);
extern std::string api_desktop_texture(TWwdosApp& app, const std::string& ch);
extern std::string api_desktop_color(TWwdosApp& app, int fg, int bg);
extern std::string api_desktop_gallery(TWwdosApp& app, bool on);
extern std::string api_desktop_get(TWwdosApp& app);
extern std::string api_figlet_set_text(TWwdosApp& app, const std::string& id, const std::string& text);
extern std::string api_figlet_set_font(TWwdosApp& app, const std::string& id, const std::string& font);
extern std::string api_figlet_set_color(TWwdosApp& app, const std::string& id, const std::string& fg, const std::string& bg);
extern std::string api_figlet_list_fonts();
extern void api_open_animation_path(TWwdosApp& app, const std::string& path, const TRect* bounds, bool frameless, bool shadowless, const std::string& title);
extern void api_spawn_paint(TWwdosApp& app, const TRect* bounds);
extern void api_spawn_micropolis_ascii(TWwdosApp& app, const TRect* bounds);
extern void api_spawn_quadra(TWwdosApp& app, const TRect* bounds);
extern void api_spawn_snake(TWwdosApp& app, const TRect* bounds);
extern void api_spawn_rogue(TWwdosApp& app, const TRect* bounds);
extern void api_spawn_deep_signal(TWwdosApp& app, const TRect* bounds);
extern void api_spawn_app_launcher(TWwdosApp& app, const TRect* bounds);
extern void api_spawn_gallery(TWwdosApp& app, const TRect* bounds);
extern void api_open_animation_path(TWwdosApp& app, const std::string& path);
extern std::string api_gallery_list(TWwdosApp& app, const std::string& tab);
extern void api_spawn_terminal(TWwdosApp& app, const TRect* bounds);
extern std::string api_terminal_write(TWwdosApp& app, const std::string& text, const std::string& window_id);
extern std::string api_terminal_read(TWwdosApp& app, const std::string& window_id);

// Paint canvas wrappers (defined in wwdos_app.cpp, avoid tvision dependency)
extern std::string api_paint_cell(TWwdosApp& app, const std::string& id, int x, int y, uint8_t fg, uint8_t bg);
extern std::string api_paint_text(TWwdosApp& app, const std::string& id, int x, int y, const std::string& text, uint8_t fg, uint8_t bg);
extern std::string api_paint_line(TWwdosApp& app, const std::string& id, int x0, int y0, int x1, int y1, bool erase);
extern std::string api_paint_rect(TWwdosApp& app, const std::string& id, int x0, int y0, int x1, int y1, bool erase);
extern std::string api_paint_clear(TWwdosApp& app, const std::string& id);
extern std::string api_paint_export(TWwdosApp& app, const std::string& id);
extern std::string api_paint_save(TWwdosApp& app, const std::string& id, const std::string& path);
extern std::string api_paint_load(TWwdosApp& app, const std::string& id, const std::string& path);
extern void api_spawn_paint_with_file(TWwdosApp& app, const std::string& path);
extern std::string api_paint_stamp_figlet(TWwdosApp& app, const std::string& id,
    const std::string& text, const std::string& font,
    int x, int y, uint8_t fg, uint8_t bg);
extern std::string api_list_figlet_fonts();
extern std::string api_preview_figlet(const std::string& text, const std::string& font, int width);

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
        {"open_room_chat", "Open Room Chat window (multi-user PartyKit room)", false},
        {"room_chat_receive", "Deliver incoming chat message to RoomChatView {sender, text, ts?}", true},
        {"room_presence", "Update participant list in RoomChatView {participants: JSON array}", true},
        {"new_paint_canvas", "Open a new paint canvas window", false},
        {"open_micropolis_ascii", "Open Micropolis ASCII MVP window", false},
        {"open_quadra", "Open Quadra falling blocks game", false},
        {"open_snake", "Open Snake game", false},
        {"open_rogue", "Open WibWob Rogue dungeon crawler", false},
        {"open_deep_signal", "Open Deep Signal space scanner game", false},
        {"open_apps", "Open the Applications folder browser", false},
        {"open_gallery", "Open the ASCII Art Gallery browser with tabbed primer explorer", false},
        {"gallery_list", "List available primer filenames (optional tab param: 1/#-C, 2/D-L, 3/M, 4/N-S, 5/T-Z, 6/Find with search param)", false},
        {"open_primer", "Open a primer file by name in a viewer window (requires path param, e.g. 'wibwob-faces.txt')", true},
        {"open_terminal", "Open a terminal emulator window", false},
        {"terminal_write", "Send text input to the terminal emulator (requires text param; optional window_id)", true},
        {"terminal_read", "Read the visible text content of a terminal window (optional window_id param)", false},
        {"chat_receive", "Display a remote chat message in Scramble (sender + text params)", true},
        {"wibwob_ask", "Send a user message to the Wib&Wob chat window, triggering an AI response (text param)", true},
        {"get_chat_history", "Return Wib&Wob chat history as JSON array of {role, content} messages", false},
        {"paint_cell", "Set a single cell on a paint canvas (id, x, y, fg, bg params)", true},
        {"paint_text", "Write text on a paint canvas (id, x, y, text, fg, bg params)", true},
        {"paint_line", "Draw a line on a paint canvas (id, x0, y0, x1, y1, erase params)", true},
        {"paint_rect", "Draw a rectangle on a paint canvas (id, x0, y0, x1, y1, erase params)", true},
        {"paint_clear", "Clear a paint canvas (id param)", true},
        {"paint_export", "Export paint canvas as text (id param)", true},
        {"paint_save", "Save paint canvas to .wwp file (id, path params)", true},
        {"paint_load", "Load paint canvas from .wwp file (id, path params)", true},
        {"open_paint_file", "Open a new paint window with a .wwp file loaded (path param)", true},
        {"paint_stamp_figlet", "Stamp FIGlet text onto canvas (id,text,font,x,y,fg,bg)", true},
        {"list_figlet_fonts", "List all available FIGlet font names (JSON array)", false},
        {"preview_figlet", "Render FIGlet text (text,font,width params) — returns rendered text", false},
        {"inject_command", "Inject a raw IPC command string for internal testing", true},
        {"window_shadow", "Toggle window shadow (id, on params)", true},
        {"window_title", "Set window title (id, title params — empty string removes title)", true},
        {"desktop_preset", "Set desktop to a named preset (preset param)", true},
        {"desktop_texture", "Set desktop fill character (char param)", true},
        {"desktop_color", "Set desktop fg/bg colour 0-15 (fg, bg params)", true},
        {"desktop_gallery", "Toggle gallery mode — hide menu/status bar (on param: true/false)", true},
        {"desktop_get", "Get current desktop state (texture, colour, gallery, preset)", false},
        {"figlet_set_text", "Change text in a figlet window (id, text params)", true},
        {"figlet_set_font", "Change font in a figlet window (id, font params)", true},
        {"figlet_set_color", "Set figlet window colours (id, fg, bg params — hex RGB e.g. #FF00FF)", true},
        {"figlet_list_fonts", "List available figlet font names", false},
    };
    return capabilities;
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
    TWwdosApp& app,
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
    if (name == "open_room_chat") {
        api_spawn_room_chat(app, nullptr);
        return "ok";
    }
    if (name == "room_chat_receive") {
        auto sender = kv.count("sender") ? kv.at("sender") : std::string("remote");
        auto text = kv.count("text") ? kv.at("text") : std::string("");
        auto ts = kv.count("ts") ? kv.at("ts") : std::string("");
        if (text.empty())
            return "err missing text";
        return api_room_chat_receive(app, sender, text, ts);
    }
    if (name == "room_presence") {
        auto participants = kv.count("participants") ? kv.at("participants") : std::string("[]");
        return api_room_presence(app, participants);
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
    if (name == "open_rogue") {
        api_spawn_rogue(app, nullptr);
        return "ok";
    }
    if (name == "open_deep_signal") {
        api_spawn_deep_signal(app, nullptr);
        return "ok";
    }
    if (name == "open_apps") {
        api_spawn_app_launcher(app, nullptr);
        return "ok";
    }
    if (name == "open_gallery") {
        api_spawn_gallery(app, nullptr);
        return "ok";
    }
    if (name == "gallery_list") {
        auto it = kv.find("tab");
        std::string tab = (it != kv.end()) ? it->second : "";
        return api_gallery_list(app, tab);
    }
    if (name == "open_primer") {
        auto it = kv.find("path");
        if (it == kv.end() || it->second.empty())
            return "err missing path";
        // Resolve relative names against primer directory
        std::string path = it->second;
        if (path.find('/') == std::string::npos && path.find('\\') == std::string::npos) {
            // Bare filename — prepend primer dir
            extern std::string findPrimerDir();  // defined in wwdos_app.cpp
            path = findPrimerDir() + "/" + path;
        }
        // Validate file exists
        struct stat st;
        if (stat(path.c_str(), &st) != 0)
            return "err file not found: " + path;
        // Display mode flags
        auto fi = kv.find("frameless");
        auto si = kv.find("shadowless");
        auto ti = kv.find("title");
        bool frameless  = (fi != kv.end() && (fi->second == "1" || fi->second == "true"));
        bool shadowless = (si != kv.end() && (si->second == "1" || si->second == "true"));
        std::string title = (ti != kv.end()) ? ti->second : "";

        // Optional explicit placement: x, y (top-left), w, h (outer incl. frame)
        auto xi = kv.find("x"), yi = kv.find("y");
        auto wi = kv.find("w"), hi = kv.find("h");
        if (xi != kv.end() && yi != kv.end() && wi != kv.end() && hi != kv.end()) {
            int x = std::atoi(xi->second.c_str());
            int y = std::atoi(yi->second.c_str());
            int w = std::atoi(wi->second.c_str());
            int h = std::atoi(hi->second.c_str());
            TRect bounds(x, y, x + w, y + h);
            api_open_animation_path(app, path, &bounds, frameless, shadowless, title);
        } else {
            api_open_animation_path(app, path, nullptr, frameless, shadowless, title);
        }
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
        auto wid = kv.find("window_id");
        std::string window_id = (wid != kv.end()) ? wid->second : "";
        return api_terminal_write(app, it->second, window_id);
    }
    if (name == "terminal_read") {
        auto wid = kv.find("window_id");
        std::string window_id = (wid != kv.end()) ? wid->second : "";
        return api_terminal_read(app, window_id);
    }
    if (name == "chat_receive") {
        auto itSender = kv.find("sender");
        auto itText = kv.find("text");
        if (itText == kv.end() || itText->second.empty())
            return "err missing text";
        std::string sender = (itSender != kv.end()) ? itSender->second : "remote";
        return api_chat_receive(app, sender, itText->second);
    }
    if (name == "get_chat_history") {
        return api_get_chat_history(app);
    }
    if (name == "wibwob_ask") {
        auto itText = kv.find("text");
        if (itText == kv.end() || itText->second.empty())
            return "err missing text";
        return api_wibwob_ask(app, itText->second);
    }
    if (name == "paint_cell") {
        auto id_it = kv.find("id");
        auto x_it = kv.find("x"); auto y_it = kv.find("y");
        if (id_it == kv.end() || x_it == kv.end() || y_it == kv.end())
            return "err missing id/x/y";
        auto fg_it = kv.find("fg"); auto bg_it = kv.find("bg");
        uint8_t fg = fg_it != kv.end() ? std::atoi(fg_it->second.c_str()) : 15;
        uint8_t bg = bg_it != kv.end() ? std::atoi(bg_it->second.c_str()) : 0;
        return api_paint_cell(app, id_it->second, std::atoi(x_it->second.c_str()), std::atoi(y_it->second.c_str()), fg, bg);
    }
    if (name == "paint_text") {
        auto id_it = kv.find("id");
        auto x_it = kv.find("x"); auto y_it = kv.find("y");
        auto text_it = kv.find("text");
        if (id_it == kv.end() || x_it == kv.end() || y_it == kv.end() || text_it == kv.end())
            return "err missing id/x/y/text";
        auto fg_it = kv.find("fg"); auto bg_it = kv.find("bg");
        uint8_t fg = fg_it != kv.end() ? std::atoi(fg_it->second.c_str()) : 15;
        uint8_t bg = bg_it != kv.end() ? std::atoi(bg_it->second.c_str()) : 0;
        return api_paint_text(app, id_it->second, std::atoi(x_it->second.c_str()), std::atoi(y_it->second.c_str()), text_it->second, fg, bg);
    }
    if (name == "paint_line") {
        auto id_it = kv.find("id");
        auto x0_it = kv.find("x0"); auto y0_it = kv.find("y0");
        auto x1_it = kv.find("x1"); auto y1_it = kv.find("y1");
        if (id_it == kv.end() || x0_it == kv.end() || y0_it == kv.end() || x1_it == kv.end() || y1_it == kv.end())
            return "err missing id/x0/y0/x1/y1";
        auto erase_it = kv.find("erase");
        bool erase = (erase_it != kv.end() && erase_it->second == "1");
        return api_paint_line(app, id_it->second, std::atoi(x0_it->second.c_str()), std::atoi(y0_it->second.c_str()), std::atoi(x1_it->second.c_str()), std::atoi(y1_it->second.c_str()), erase);
    }
    if (name == "paint_rect") {
        auto id_it = kv.find("id");
        auto x0_it = kv.find("x0"); auto y0_it = kv.find("y0");
        auto x1_it = kv.find("x1"); auto y1_it = kv.find("y1");
        if (id_it == kv.end() || x0_it == kv.end() || y0_it == kv.end() || x1_it == kv.end() || y1_it == kv.end())
            return "err missing id/x0/y0/x1/y1";
        auto erase_it = kv.find("erase");
        bool erase = (erase_it != kv.end() && erase_it->second == "1");
        return api_paint_rect(app, id_it->second, std::atoi(x0_it->second.c_str()), std::atoi(y0_it->second.c_str()), std::atoi(x1_it->second.c_str()), std::atoi(y1_it->second.c_str()), erase);
    }
    if (name == "paint_clear") {
        auto id_it = kv.find("id");
        if (id_it == kv.end()) return "err missing id";
        return api_paint_clear(app, id_it->second);
    }
    if (name == "paint_export") {
        auto id_it = kv.find("id");
        if (id_it == kv.end()) return "err missing id";
        return api_paint_export(app, id_it->second);
    }
    if (name == "paint_save") {
        auto id_it = kv.find("id");
        auto path_it = kv.find("path");
        if (id_it == kv.end()) return "err missing id";
        if (path_it == kv.end()) return "err missing path";
        return api_paint_save(app, id_it->second, path_it->second);
    }
    if (name == "paint_load") {
        auto id_it = kv.find("id");
        auto path_it = kv.find("path");
        if (id_it == kv.end()) return "err missing id";
        if (path_it == kv.end()) return "err missing path";
        return api_paint_load(app, id_it->second, path_it->second);
    }
    if (name == "open_paint_file") {
        auto path_it = kv.find("path");
        if (path_it == kv.end()) return "err missing path";
        api_spawn_paint_with_file(app, path_it->second);
        return "ok";
    }
    if (name == "paint_stamp_figlet") {
        auto id_it = kv.find("id");
        auto text_it = kv.find("text");
        if (id_it == kv.end()) return "err missing id";
        if (text_it == kv.end()) return "err missing text";
        std::string font = kv.count("font") ? kv.at("font") : "standard";
        int x = kv.count("x") ? std::atoi(kv.at("x").c_str()) : 0;
        int y = kv.count("y") ? std::atoi(kv.at("y").c_str()) : 0;
        uint8_t fg = kv.count("fg") ? (uint8_t)std::atoi(kv.at("fg").c_str()) : 15;
        uint8_t bg = kv.count("bg") ? (uint8_t)std::atoi(kv.at("bg").c_str()) : 0;
        return api_paint_stamp_figlet(app, id_it->second, text_it->second, font, x, y, fg, bg);
    }
    if (name == "list_figlet_fonts") {
        return api_list_figlet_fonts();
    }
    if (name == "preview_figlet") {
        auto text_it = kv.find("text");
        if (text_it == kv.end()) return "err missing text";
        std::string font = kv.count("font") ? kv.at("font") : "standard";
        int width = kv.count("width") ? std::atoi(kv.at("width").c_str()) : 80;
        return api_preview_figlet(text_it->second, font, width);
    }
    if (name == "inject_command") {
        auto id_it = kv.find("cmd_id");
        if (id_it == kv.end()) return "err missing cmd_id";
        int cmdId = std::atoi(id_it->second.c_str());
        TEvent ev = {};
        ev.what = evCommand;
        ev.message.command = (ushort)cmdId;
        ev.message.infoPtr = nullptr;
        TProgram::application->putEvent(ev);
        return "ok injected " + std::to_string(cmdId);
    }
    if (name == "window_shadow") {
        auto id_it = kv.find("id");
        auto on_it = kv.find("on");
        if (id_it == kv.end() || on_it == kv.end()) return "err missing id or on";
        bool on = (on_it->second == "true" || on_it->second == "1");
        return api_window_shadow(app, id_it->second, on);
    }
    if (name == "window_title") {
        auto id_it = kv.find("id");
        auto title_it = kv.find("title");
        if (id_it == kv.end()) return "err missing id";
        std::string title = (title_it != kv.end()) ? title_it->second : "";
        return api_window_title(app, id_it->second, title);
    }
    if (name == "desktop_preset") {
        auto it = kv.find("preset");
        if (it == kv.end()) return "err missing preset";
        return api_desktop_preset(app, it->second);
    }
    if (name == "desktop_texture") {
        auto it = kv.find("char");
        if (it == kv.end()) return "err missing char";
        return api_desktop_texture(app, it->second);
    }
    if (name == "desktop_color") {
        auto fg_it = kv.find("fg");
        auto bg_it = kv.find("bg");
        if (fg_it == kv.end() || bg_it == kv.end()) return "err missing fg or bg";
        return api_desktop_color(app, std::stoi(fg_it->second), std::stoi(bg_it->second));
    }
    if (name == "desktop_gallery") {
        auto it = kv.find("on");
        if (it == kv.end()) return "err missing on param";
        bool on = (it->second == "true" || it->second == "1");
        return api_desktop_gallery(app, on);
    }
    if (name == "desktop_get") {
        return api_desktop_get(app);
    }
    if (name == "figlet_set_text") {
        auto id_it = kv.find("id");
        auto text_it = kv.find("text");
        if (id_it == kv.end()) return "err missing id";
        if (text_it == kv.end()) return "err missing text";
        return api_figlet_set_text(app, id_it->second, text_it->second);
    }
    if (name == "figlet_set_font") {
        auto id_it = kv.find("id");
        auto font_it = kv.find("font");
        if (id_it == kv.end()) return "err missing id";
        if (font_it == kv.end()) return "err missing font";
        return api_figlet_set_font(app, id_it->second, font_it->second);
    }
    if (name == "figlet_set_color") {
        auto id_it = kv.find("id");
        auto fg_it = kv.find("fg");
        auto bg_it = kv.find("bg");
        if (id_it == kv.end()) return "err missing id";
        return api_figlet_set_color(app, id_it->second,
            (fg_it != kv.end()) ? fg_it->second : "",
            (bg_it != kv.end()) ? bg_it->second : "");
    }
    if (name == "figlet_list_fonts") {
        return api_figlet_list_fonts();
    }
    return "err unknown command";
}
