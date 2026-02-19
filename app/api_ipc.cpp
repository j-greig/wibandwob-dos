#include "api_ipc.h"
#include "command_registry.h"

#ifndef _WIN32
#include <sys/socket.h>
#include <sys/un.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#endif

#include <cstring>
#include <sstream>
#include <map>
#include <vector>
#include <fstream>

// Percent-decode IPC values (%20 -> space, %0A -> newline, etc.)
static std::string percent_decode(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '%' && i + 2 < s.size()) {
            char hi = s[i+1], lo = s[i+2];
            auto hexval = [](char c) -> int {
                if (c >= '0' && c <= '9') return c - '0';
                if (c >= 'a' && c <= 'f') return 10 + c - 'a';
                if (c >= 'A' && c <= 'F') return 10 + c - 'A';
                return -1;
            };
            int h = hexval(hi), l = hexval(lo);
            if (h >= 0 && l >= 0) {
                out += static_cast<char>((h << 4) | l);
                i += 2;
                continue;
            }
        }
        out += s[i];
    }
    return out;
}

// Base64 decoding function
static const std::string base64_chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789+/";

static std::string base64_decode(const std::string& encoded_string) {
    int in_len = encoded_string.size();
    int i = 0, j = 0, in_ = 0;
    unsigned char char_array_4[4], char_array_3[3];
    std::string ret;

    while (in_len-- && (encoded_string[in_] != '=') &&
           (isalnum(encoded_string[in_]) || (encoded_string[in_] == '+') || (encoded_string[in_] == '/'))) {
        char_array_4[i++] = encoded_string[in_]; in_++;
        if (i == 4) {
            for (i = 0; i < 4; i++)
                char_array_4[i] = base64_chars.find(char_array_4[i]);

            char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
            char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
            char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];

            for (i = 0; (i < 3); i++)
                ret += char_array_3[i];
            i = 0;
        }
    }

    if (i) {
        for (j = i; j < 4; j++)
            char_array_4[j] = 0;

        for (j = 0; j < 4; j++)
            char_array_4[j] = base64_chars.find(char_array_4[j]);

        char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
        char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
        char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];

        for (j = 0; (j < i - 1); j++) ret += char_array_3[j];
    }

    return ret;
}

// Include TRect definition
#define Uses_TRect
#define Uses_TWindow
#include <tvision/tv.h>

#include "paint/paint_window.h"

// Forward declarations of helper methods implemented in test_pattern_app.cpp.
extern void api_spawn_test(TTestPatternApp& app);
extern void api_spawn_gradient(TTestPatternApp& app, const std::string& kind);
extern void api_open_animation_path(TTestPatternApp& app, const std::string& path);
extern void api_open_text_view_path(TTestPatternApp& app, const std::string& path, const TRect* bounds);
extern void api_spawn_test(TTestPatternApp& app, const TRect* bounds);
extern void api_spawn_gradient(TTestPatternApp& app, const std::string& kind, const TRect* bounds);
extern void api_open_animation_path(TTestPatternApp& app, const std::string& path, const TRect* bounds);
extern void api_cascade(TTestPatternApp& app);
extern void api_tile(TTestPatternApp& app);
extern void api_close_all(TTestPatternApp& app);
extern void api_set_pattern_mode(TTestPatternApp& app, const std::string& mode);
extern void api_save_workspace(TTestPatternApp& app);
extern bool api_save_workspace_path(TTestPatternApp& app, const std::string& path);
extern bool api_open_workspace_path(TTestPatternApp& app, const std::string& path);
extern void api_screenshot(TTestPatternApp& app);
extern std::string api_get_state(TTestPatternApp& app);
extern std::string api_move_window(TTestPatternApp& app, const std::string& id, int x, int y);
extern std::string api_resize_window(TTestPatternApp& app, const std::string& id, int width, int height);
extern std::string api_focus_window(TTestPatternApp& app, const std::string& id);
extern std::string api_close_window(TTestPatternApp& app, const std::string& id);
extern std::string api_get_canvas_size(TTestPatternApp& app);
extern void api_spawn_text_editor(TTestPatternApp& app, const TRect* bounds);
extern void api_spawn_browser(TTestPatternApp& app, const TRect* bounds);
extern void api_spawn_paint(TTestPatternApp& app, const TRect* bounds);
extern TPaintCanvasView* api_find_paint_canvas(TTestPatternApp& app, const std::string& id);
extern std::string api_browser_fetch(TTestPatternApp& app, const std::string& url);
extern std::string api_send_text(TTestPatternApp& app, const std::string& id, 
                                 const std::string& content, const std::string& mode, 
                                 const std::string& position);
extern std::string api_send_figlet(TTestPatternApp& app, const std::string& id, const std::string& text,
                                   const std::string& font, int width, const std::string& mode);

ApiIpcServer::ApiIpcServer(TTestPatternApp* app) : app_(app) {}

ApiIpcServer::~ApiIpcServer() { stop(); }

bool ApiIpcServer::start(const std::string& path) {
#ifdef _WIN32
    (void)path; return false;
#else
    sock_path_ = path;
    // Clean up any stale socket.
    ::unlink(sock_path_.c_str());
    fd_listen_ = ::socket(AF_UNIX, SOCK_STREAM, 0);
    if (fd_listen_ < 0)
        return false;
    // Non-blocking
    int flags = ::fcntl(fd_listen_, F_GETFL, 0);
    ::fcntl(fd_listen_, F_SETFL, flags | O_NONBLOCK);

    struct sockaddr_un addr;
    std::memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    std::snprintf(addr.sun_path, sizeof(addr.sun_path), "%s", sock_path_.c_str());
    if (::bind(fd_listen_, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        ::close(fd_listen_);
        fd_listen_ = -1;
        return false;
    }
    if (::listen(fd_listen_, 4) < 0) {
        ::close(fd_listen_);
        fd_listen_ = -1;
        return false;
    }
    return true;
#endif
}

void ApiIpcServer::poll() {
#ifdef _WIN32
    return;
#else
    if (fd_listen_ < 0 || !app_) return;
    int fd = ::accept(fd_listen_, nullptr, nullptr);
    if (fd < 0) {
        return; // EAGAIN expected in non-blocking mode
    }
    // Read a single line command.
    char buf[2048];
    ssize_t n = ::read(fd, buf, sizeof(buf)-1);
    if (n <= 0) {
        ::close(fd);
        return;
    }
    buf[n] = 0;
    std::string line(buf);
    // Simple trim
    while (!line.empty() && (line.back()=='\n' || line.back()=='\r' || line.back()==' ')) line.pop_back();

    // Parse: "cmd:<name> k=v k=v"
    std::string cmd;
    std::map<std::string,std::string> kv;
    {
        std::istringstream iss(line);
        std::string tok;
        while (iss >> tok) {
            if (tok.rfind("cmd:", 0) == 0) {
                cmd = tok.substr(4);
            } else {
                auto eq = tok.find('=');
                if (eq != std::string::npos) {
                    kv[tok.substr(0, eq)] = percent_decode(tok.substr(eq+1));
                }
            }
        }
    }

    std::string resp = "ok\n";
    if (cmd == "get_capabilities") {
        resp = get_command_capabilities_json() + "\n";
    } else if (cmd == "exec_command") {
        auto it = kv.find("name");
        if (it == kv.end() || it->second.empty()) {
            resp = "err missing name\n";
        } else {
            resp = exec_registry_command(*app_, it->second, kv) + "\n";
        }
    } else if (cmd == "create_window") {
        std::string type = kv["type"]; // test_pattern|gradient|frame_player|text_view
        
        // Extract optional positioning parameters
        TRect* bounds = nullptr;
        TRect rectBounds;
        auto x_it = kv.find("x");
        auto y_it = kv.find("y"); 
        auto w_it = kv.find("w");
        auto h_it = kv.find("h");
        if (x_it != kv.end() && y_it != kv.end() && w_it != kv.end() && h_it != kv.end()) {
            int x = std::atoi(x_it->second.c_str());
            int y = std::atoi(y_it->second.c_str());
            int w = std::atoi(w_it->second.c_str());
            int h = std::atoi(h_it->second.c_str());
            rectBounds = TRect(x, y, x + w, y + h);
            bounds = &rectBounds;
        }
        
        if (type == "test_pattern") {
            api_spawn_test(*app_, bounds);
        } else if (type == "gradient") {
            std::string kind = kv.count("gradient") ? kv["gradient"] : std::string("horizontal");
            api_spawn_gradient(*app_, kind, bounds);
        } else if (type == "frame_player") {
            auto it = kv.find("path");
            if (it != kv.end()) api_open_animation_path(*app_, it->second, bounds);
            else resp = "err missing path\n";
        } else if (type == "text_view") {
            auto it = kv.find("path");
            if (it != kv.end()) api_open_text_view_path(*app_, it->second, bounds);
            else resp = "err missing path\n";
        } else if (type == "text_editor") {
            api_spawn_text_editor(*app_, bounds);
        } else if (type == "browser") {
            api_spawn_browser(*app_, bounds);
        } else if (type == "paint") {
            api_spawn_paint(*app_, bounds);
        } else {
            resp = "err unknown type\n";
        }
    } else if (cmd == "cascade") {
        api_cascade(*app_);
    } else if (cmd == "tile") {
        api_tile(*app_);
    } else if (cmd == "close_all") {
        api_close_all(*app_);
    } else if (cmd == "pattern_mode") {
        std::string mode = kv["mode"]; // continuous|tiled
        api_set_pattern_mode(*app_, mode);
    } else if (cmd == "save_workspace") {
        api_save_workspace(*app_);
    } else if (cmd == "open_workspace") {
        auto it = kv.find("path");
        if (it == kv.end() || it->second.empty()) {
            resp = "err missing path\n";
        } else {
            bool ok = api_open_workspace_path(*app_, it->second);
            fprintf(stderr, "[ipc] open_workspace path=%s ok=%s\n", it->second.c_str(), ok ? "true" : "false");
            if (!ok)
                resp = "err open workspace failed\n";
        }
    } else if (cmd == "screenshot") {
        api_screenshot(*app_);
    } else if (cmd == "get_state") {
        resp = api_get_state(*app_) + "\n";
    } else if (cmd == "move_window") {
        auto id = kv.find("id");
        auto x_it = kv.find("x");
        auto y_it = kv.find("y");
        if (id != kv.end() && x_it != kv.end() && y_it != kv.end()) {
            int x = std::atoi(x_it->second.c_str());
            int y = std::atoi(y_it->second.c_str());
            resp = api_move_window(*app_, id->second, x, y) + "\n";
        } else {
            resp = "err missing id/x/y\n";
        }
    } else if (cmd == "resize_window") {
        auto id = kv.find("id");
        auto w_it = kv.find("width");
        auto h_it = kv.find("height");
        if (id != kv.end() && w_it != kv.end() && h_it != kv.end()) {
            int width = std::atoi(w_it->second.c_str());
            int height = std::atoi(h_it->second.c_str());
            resp = api_resize_window(*app_, id->second, width, height) + "\n";
        } else {
            resp = "err missing id/width/height\n";
        }
    } else if (cmd == "focus_window") {
        auto id = kv.find("id");
        if (id != kv.end()) {
            resp = api_focus_window(*app_, id->second) + "\n";
        } else {
            resp = "err missing id\n";
        }
    } else if (cmd == "close_window") {
        auto id = kv.find("id");
        if (id != kv.end()) {
            resp = api_close_window(*app_, id->second) + "\n";
        } else {
            resp = "err missing id\n";
        }
    } else if (cmd == "send_text") {
        auto id_it = kv.find("id");
        auto content_it = kv.find("content");
        auto mode_it = kv.find("mode");
        auto pos_it = kv.find("position");

        if (id_it != kv.end() && content_it != kv.end()) {
            std::string mode = (mode_it != kv.end()) ? mode_it->second : "append";
            std::string position = (pos_it != kv.end()) ? pos_it->second : "end";

            // Decode content if base64-encoded (prefix: "base64:")
            std::string content = content_it->second;
            fprintf(stderr, "[C++ IPC] send_text: id=%s, content_len=%zu, encoded=%s\n",
                   id_it->second.c_str(), content.size(),
                   (content.rfind("base64:", 0) == 0) ? "yes" : "no");

            if (content.rfind("base64:", 0) == 0) {
                // Extract base64 payload
                std::string encoded = content.substr(7);
                fprintf(stderr, "[C++ IPC] Decoding base64: %zu chars\n", encoded.size());
                content = base64_decode(encoded);
                fprintf(stderr, "[C++ IPC] Decoded to: %zu chars\n", content.size());
            }

            fprintf(stderr, "[C++ IPC] Calling api_send_text...\n");
            resp = api_send_text(*app_, id_it->second, content, mode, position) + "\n";
            fprintf(stderr, "[C++ IPC] api_send_text returned: %s", resp.c_str());
        } else {
            resp = "err missing id or content\n";
        }
    } else if (cmd == "send_figlet") {
        auto id_it = kv.find("id");
        auto text_it = kv.find("text");
        auto font_it = kv.find("font");
        auto width_it = kv.find("width");
        auto mode_it = kv.find("mode");
        
        if (id_it != kv.end() && text_it != kv.end()) {
            std::string font = (font_it != kv.end()) ? font_it->second : "standard";
            int width = (width_it != kv.end()) ? std::atoi(width_it->second.c_str()) : 0;
            std::string mode = (mode_it != kv.end()) ? mode_it->second : "append";
            resp = api_send_figlet(*app_, id_it->second, text_it->second, font, width, mode) + "\n";
        } else {
            resp = "err missing id or text\n";
        }
    } else if (cmd == "get_canvas_size") {
        resp = api_get_canvas_size(*app_) + "\n";
    } else if (cmd == "export_state") {
        std::string path = "workspace_state.json";
        auto it = kv.find("path");
        if (it != kv.end() && !it->second.empty())
            path = it->second;
        bool ok = api_save_workspace_path(*app_, path);
        fprintf(stderr, "[ipc] export_state path=%s ok=%s\n", path.c_str(), ok ? "true" : "false");
        resp = ok ? "ok\n" : "err export failed\n";
    } else if (cmd == "import_state") {
        auto it = kv.find("path");
        if (it == kv.end() || it->second.empty()) {
            resp = "err missing path\n";
        } else {
            std::ifstream in(it->second.c_str());
            if (!in.is_open()) {
                resp = "err cannot open import path\n";
            } else {
                std::stringstream buffer;
                buffer << in.rdbuf();
                std::string content = buffer.str();
                // Minimal validity gate for S01: ensure expected snapshot keys are present.
                if (content.find("\"version\"") == std::string::npos ||
                    content.find("\"windows\"") == std::string::npos) {
                    fprintf(stderr, "[ipc] import_state path=%s invalid_snapshot\n", it->second.c_str());
                    resp = "err invalid snapshot\n";
                } else {
                    // Try direct apply first (legacy workspace shape with "bounds").
                    if (api_open_workspace_path(*app_, it->second)) {
                        fprintf(stderr, "[ipc] import_state path=%s applied=direct\n", it->second.c_str());
                        resp = "ok\n";
                    } else {
                        // Compatibility fallback: convert state snapshot shape ("rect") into workspace shape ("bounds").
                        std::string normalized = content;
                        if (normalized.find("\"rect\"") != std::string::npos &&
                            normalized.find("\"bounds\"") == std::string::npos) {
                            size_t pos = 0;
                            while ((pos = normalized.find("\"rect\"", pos)) != std::string::npos) {
                                normalized.replace(pos, 6, "\"bounds\"");
                                pos += 8;
                            }
                        }

                        std::string tmp_path = it->second + ".wwd-import-tmp.json";
                        std::ofstream out(tmp_path.c_str(), std::ios::out | std::ios::trunc);
                        if (!out.is_open()) {
                            resp = "err cannot write import temp\n";
                        } else {
                            out << normalized;
                            out.close();
                            bool ok = api_open_workspace_path(*app_, tmp_path);
                            ::unlink(tmp_path.c_str());
                            fprintf(stderr, "[ipc] import_state path=%s applied=compat ok=%s\n", it->second.c_str(), ok ? "true" : "false");
                            resp = ok ? "ok\n" : "err import apply failed\n";
                        }
                    }
                }
            }
        }
    } else if (cmd == "browser_fetch") {
        auto url_it = kv.find("url");
        if (url_it != kv.end()) {
            resp = api_browser_fetch(*app_, url_it->second) + "\n";
        } else {
            resp = "err missing url\n";
        }
    } else if (cmd == "paint_cell") {
        auto id_it = kv.find("id");
        auto x_it = kv.find("x");
        auto y_it = kv.find("y");
        if (id_it == kv.end() || x_it == kv.end() || y_it == kv.end()) {
            resp = "err missing id/x/y\n";
        } else {
            auto *canvas = api_find_paint_canvas(*app_, id_it->second);
            if (!canvas) { resp = "err paint window not found\n"; }
            else {
                int x = std::atoi(x_it->second.c_str());
                int y = std::atoi(y_it->second.c_str());
                auto fg_it = kv.find("fg");
                auto bg_it = kv.find("bg");
                uint8_t fg = fg_it != kv.end() ? std::atoi(fg_it->second.c_str()) : 15;
                uint8_t bg = bg_it != kv.end() ? std::atoi(bg_it->second.c_str()) : 0;
                canvas->putCell(x, y, fg, bg);
                resp = "ok\n";
            }
        }
    } else if (cmd == "paint_text") {
        auto id_it = kv.find("id");
        auto x_it = kv.find("x");
        auto y_it = kv.find("y");
        auto text_it = kv.find("text");
        if (id_it == kv.end() || x_it == kv.end() || y_it == kv.end() || text_it == kv.end()) {
            resp = "err missing id/x/y/text\n";
        } else {
            auto *canvas = api_find_paint_canvas(*app_, id_it->second);
            if (!canvas) { resp = "err paint window not found\n"; }
            else {
                int x = std::atoi(x_it->second.c_str());
                int y = std::atoi(y_it->second.c_str());
                auto fg_it = kv.find("fg");
                auto bg_it = kv.find("bg");
                uint8_t fg = fg_it != kv.end() ? std::atoi(fg_it->second.c_str()) : 15;
                uint8_t bg = bg_it != kv.end() ? std::atoi(bg_it->second.c_str()) : 0;
                canvas->putText(x, y, text_it->second, fg, bg);
                resp = "ok\n";
            }
        }
    } else if (cmd == "paint_line") {
        auto id_it = kv.find("id");
        auto x0_it = kv.find("x0"); auto y0_it = kv.find("y0");
        auto x1_it = kv.find("x1"); auto y1_it = kv.find("y1");
        if (id_it == kv.end() || x0_it == kv.end() || y0_it == kv.end() ||
            x1_it == kv.end() || y1_it == kv.end()) {
            resp = "err missing id/x0/y0/x1/y1\n";
        } else {
            auto *canvas = api_find_paint_canvas(*app_, id_it->second);
            if (!canvas) { resp = "err paint window not found\n"; }
            else {
                int x0 = std::atoi(x0_it->second.c_str());
                int y0 = std::atoi(y0_it->second.c_str());
                int x1 = std::atoi(x1_it->second.c_str());
                int y1 = std::atoi(y1_it->second.c_str());
                auto erase_it = kv.find("erase");
                bool erase = (erase_it != kv.end() && erase_it->second == "1");
                canvas->putLine(x0, y0, x1, y1, erase);
                resp = "ok\n";
            }
        }
    } else if (cmd == "paint_rect") {
        auto id_it = kv.find("id");
        auto x0_it = kv.find("x0"); auto y0_it = kv.find("y0");
        auto x1_it = kv.find("x1"); auto y1_it = kv.find("y1");
        if (id_it == kv.end() || x0_it == kv.end() || y0_it == kv.end() ||
            x1_it == kv.end() || y1_it == kv.end()) {
            resp = "err missing id/x0/y0/x1/y1\n";
        } else {
            auto *canvas = api_find_paint_canvas(*app_, id_it->second);
            if (!canvas) { resp = "err paint window not found\n"; }
            else {
                int x0 = std::atoi(x0_it->second.c_str());
                int y0 = std::atoi(y0_it->second.c_str());
                int x1 = std::atoi(x1_it->second.c_str());
                int y1 = std::atoi(y1_it->second.c_str());
                auto erase_it = kv.find("erase");
                bool erase = (erase_it != kv.end() && erase_it->second == "1");
                canvas->putRect(x0, y0, x1, y1, erase);
                resp = "ok\n";
            }
        }
    } else if (cmd == "paint_export") {
        auto id_it = kv.find("id");
        if (id_it == kv.end()) {
            resp = "err missing id\n";
        } else {
            auto *canvas = api_find_paint_canvas(*app_, id_it->second);
            if (!canvas) { resp = "err paint window not found\n"; }
            else {
                std::string text = canvas->exportText();
                auto path_it = kv.find("path");
                if (path_it != kv.end() && !path_it->second.empty()) {
                    // Write to file
                    std::ofstream out(path_it->second.c_str());
                    if (out.is_open()) {
                        out << text;
                        out.close();
                        resp = "ok\n";
                    } else {
                        resp = "err cannot write file\n";
                    }
                } else {
                    // Return inline as JSON
                    std::string escaped;
                    for (char ch : text) {
                        if (ch == '\\') escaped += "\\\\";
                        else if (ch == '"') escaped += "\\\"";
                        else if (ch == '\n') escaped += "\\n";
                        else escaped += ch;
                    }
                    resp = "{\"text\":\"" + escaped + "\"}\n";
                }
            }
        }
    } else {
        resp = "err unknown cmd\n";
    }

    ::write(fd, resp.c_str(), resp.size());
    ::close(fd);
#endif
}

void ApiIpcServer::stop() {
#ifndef _WIN32
    if (fd_listen_ >= 0) {
        ::close(fd_listen_);
        fd_listen_ = -1;
    }
    if (!sock_path_.empty()) {
        ::unlink(sock_path_.c_str());
    }
#endif
}
