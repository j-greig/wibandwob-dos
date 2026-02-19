#include "api_ipc.h"
#include "command_registry.h"
#include "window_type_registry.h"

#ifndef _WIN32
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#endif

#ifdef __APPLE__
#include <CommonCrypto/CommonHMAC.h>
#else
#include <openssl/hmac.h>
#endif

#include <cstring>
#include <cstdlib>
#include <sstream>
#include <map>
#include <vector>
#include <fstream>
#include <random>

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

#ifndef _WIN32
static bool safe_write(int fd, const void* buf, size_t len) {
    const char* p = static_cast<const char*>(buf);
#ifdef SO_NOSIGPIPE
    int one = 1;
    ::setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof(one));
#endif
    size_t written = 0;
    while (written < len) {
#ifdef MSG_NOSIGNAL
        ssize_t n = ::send(fd, p + written, len - written, MSG_NOSIGNAL);
#else
        ssize_t n = ::send(fd, p + written, len - written, 0);
#endif
        if (n > 0) {
            written += static_cast<size_t>(n);
            continue;
        }
        if (n < 0 && errno == EINTR) {
            continue;
        }
        return false;
    }
    return true;
}
#endif

// Include TRect definition
#define Uses_TRect
#define Uses_TWindow
#include <tvision/tv.h>

#include "paint/paint_window.h"

// Forward declarations of helper methods implemented in test_pattern_app.cpp.
// Note: window spawn functions are now in window_type_registry.cpp — not listed here.
extern void api_cascade(TTestPatternApp& app);
extern void api_tile(TTestPatternApp& app);
extern void api_close_all(TTestPatternApp& app);
extern void api_set_pattern_mode(TTestPatternApp& app, const std::string& mode);
extern void api_save_workspace(TTestPatternApp& app);
extern bool api_save_workspace_path(TTestPatternApp& app, const std::string& path);
extern bool api_open_workspace_path(TTestPatternApp& app, const std::string& path);
extern void api_screenshot(TTestPatternApp& app);
extern std::string api_take_last_registered_window_id(TTestPatternApp& app);
extern std::string api_get_state(TTestPatternApp& app);
extern std::string api_move_window(TTestPatternApp& app, const std::string& id, int x, int y);
extern std::string api_resize_window(TTestPatternApp& app, const std::string& id, int width, int height);
extern std::string api_focus_window(TTestPatternApp& app, const std::string& id);
extern std::string api_close_window(TTestPatternApp& app, const std::string& id);
extern std::string api_get_canvas_size(TTestPatternApp& app);
extern void api_spawn_paint(TTestPatternApp& app, const TRect* bounds);
extern TPaintCanvasView* api_find_paint_canvas(TTestPatternApp& app, const std::string& id);
extern std::string api_browser_fetch(TTestPatternApp& app, const std::string& url);
extern std::string api_send_text(TTestPatternApp& app, const std::string& id, 
                                 const std::string& content, const std::string& mode, 
                                 const std::string& position);
extern std::string api_send_figlet(TTestPatternApp& app, const std::string& id, const std::string& text,
                                   const std::string& font, int width, const std::string& mode);

// Convert bytes to hex string.
static std::string bytes_to_hex(const unsigned char* data, size_t len) {
    static const char hex[] = "0123456789abcdef";
    std::string out;
    out.reserve(len * 2);
    for (size_t i = 0; i < len; ++i) {
        out += hex[(data[i] >> 4) & 0xf];
        out += hex[data[i] & 0xf];
    }
    return out;
}

ApiIpcServer::ApiIpcServer(TTestPatternApp* app) : app_(app) {
    // Read auth secret from environment.
    const char* secret = std::getenv("WIBWOB_AUTH_SECRET");
    if (secret && secret[0] != '\0') {
        auth_secret_ = secret;
        fprintf(stderr, "[ipc] Auth enabled (secret length=%zu)\n", auth_secret_.size());
    }
}

std::string ApiIpcServer::generate_nonce() {
    std::random_device rd;
    unsigned char bytes[16];
    for (int i = 0; i < 16; ++i)
        bytes[i] = static_cast<unsigned char>(rd());
    return bytes_to_hex(bytes, 16);
}

std::string ApiIpcServer::compute_hmac(const std::string& nonce) {
    unsigned char result[32]; // SHA-256 = 32 bytes
#ifdef __APPLE__
    CCHmac(kCCHmacAlgSHA256,
           auth_secret_.data(), auth_secret_.size(),
           nonce.data(), nonce.size(),
           result);
#else
    unsigned int len = 32;
    HMAC(EVP_sha256(),
         auth_secret_.data(), auth_secret_.size(),
         reinterpret_cast<const unsigned char*>(nonce.data()), nonce.size(),
         result, &len);
#endif
    return bytes_to_hex(result, 32);
}

bool ApiIpcServer::authenticate_connection(int fd) {
    if (!auth_required()) return true;

    // Ensure the accepted fd is blocking for the auth handshake.
    int flags = ::fcntl(fd, F_GETFL, 0);
    if (flags & O_NONBLOCK)
        ::fcntl(fd, F_SETFL, flags & ~O_NONBLOCK);

    // Set a short read timeout — failed probes must not freeze the TUI event loop.
    struct timeval tv = {1, 0}; // 1 second
    ::setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

    // Send challenge: {"type":"challenge","nonce":"<hex>"}\n
    std::string nonce = generate_nonce();
    std::string challenge = "{\"type\":\"challenge\",\"nonce\":\"" + nonce + "\"}\n";
    if (!safe_write(fd, challenge.c_str(), challenge.size())) return false;

    // Read auth response — loop until we have a full newline-terminated frame.
    char buf[512];
    std::string response;
    while (response.find('\n') == std::string::npos) {
        ssize_t n = ::read(fd, buf, sizeof(buf) - 1);
        if (n <= 0) {
            fprintf(stderr, "[ipc] Auth read returned %zd (errno=%d)\n", n, errno);
            return false;
        }
        buf[n] = '\0';
        response += buf;
        if (response.size() > 4096) {
            fprintf(stderr, "[ipc] Auth response too large\n");
            return false;
        }
    }
    fprintf(stderr, "[ipc] Auth response (%zu bytes): %s\n", response.size(), response.c_str());

    // Parse HMAC from response — handle both "hmac":"..." and "hmac": "..."
    size_t hmac_pos = response.find("\"hmac\":");
    if (hmac_pos == std::string::npos) {
        fprintf(stderr, "[ipc] Auth failed: no hmac field in response\n");
        return false;
    }
    hmac_pos = response.find('"', hmac_pos + 7); // find opening quote of HMAC value
    if (hmac_pos == std::string::npos) return false;
    hmac_pos += 1; // skip opening quote
    size_t hmac_end = response.find('"', hmac_pos);
    if (hmac_end == std::string::npos) return false;
    std::string client_hmac = response.substr(hmac_pos, hmac_end - hmac_pos);

    // Check nonce replay
    if (used_nonces_.count(nonce)) {
        fprintf(stderr, "[ipc] Auth failed: nonce replay detected\n");
        return false;
    }

    // Verify HMAC
    std::string expected = compute_hmac(nonce);
    if (client_hmac != expected) {
        fprintf(stderr, "[ipc] Auth failed: HMAC mismatch\n");
        return false;
    }

    // Mark nonce as used
    used_nonces_.insert(nonce);
    // Prune old nonces (keep last 1000)
    if (used_nonces_.size() > 1000) {
        auto it = used_nonces_.begin();
        std::advance(it, used_nonces_.size() - 1000);
        used_nonces_.erase(used_nonces_.begin(), it);
    }

    // Send auth_ok so client knows to proceed with commands.
    std::string ok_msg = "{\"type\":\"auth_ok\"}\n";
    (void)safe_write(fd, ok_msg.c_str(), ok_msg.size());

    fprintf(stderr, "[ipc] Auth OK for connection\n");
    return true;
}

ApiIpcServer::~ApiIpcServer() { stop(); }

// Probe a Unix socket to check if a listener is active.
// Returns true if a process is listening (connection succeeds).
static bool probe_socket_live(const std::string& path) {
    int fd = ::socket(AF_UNIX, SOCK_STREAM, 0);
    if (fd < 0) return false;

    struct sockaddr_un addr;
    std::memset(&addr, 0, sizeof(addr));
    addr.sun_family = AF_UNIX;
    std::snprintf(addr.sun_path, sizeof(addr.sun_path), "%s", path.c_str());

    bool live = (::connect(fd, (struct sockaddr*)&addr, sizeof(addr)) == 0);
    ::close(fd);
    return live;
}

bool ApiIpcServer::start(const std::string& path) {
#ifdef _WIN32
    (void)path; return false;
#else
    sock_path_ = path;

    // Check for existing socket file before touching it.
    struct stat st;
    if (::stat(sock_path_.c_str(), &st) == 0) {
        if (probe_socket_live(sock_path_)) {
            // Another instance is listening on this socket — do not steal it.
            fprintf(stderr, "[ipc] ERROR: socket %s is already in use by another instance. "
                    "Set WIBWOB_INSTANCE to a unique value or stop the other instance.\n",
                    sock_path_.c_str());
            return false;
        }
        // Stale socket (no listener) — safe to clean up.
        fprintf(stderr, "[ipc] Cleaning up stale socket: %s\n", sock_path_.c_str());
        ::unlink(sock_path_.c_str());
    }

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

    // Authenticate if secret is set.
    if (auth_required()) {
        if (!authenticate_connection(fd)) {
            std::string err = "{\"error\":\"auth_failed\"}\n";
            (void)safe_write(fd, err.c_str(), err.size());
            ::close(fd);
            return;
        }
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
        const std::string& type = kv["type"];
        const WindowTypeSpec* spec = find_window_type_by_name(type);
        if (!spec) {
            resp = "err unknown type\n";
        } else if (!spec->spawn) {
            resp = "err unsupported type\n";
        } else {
            // Clear any previous create-window ID capture so we can reliably
            // return the ID for this specific spawn.
            (void)api_take_last_registered_window_id(*app_);
            const char* err = spec->spawn(*app_, kv);
            if (err) {
                resp = std::string(err) + "\n";
            } else {
                std::string id = api_take_last_registered_window_id(*app_);
                if (id.empty()) {
                    resp = "{\"success\":true}\n";
                } else {
                    resp = std::string("{\"success\":true,\"id\":\"") + id + "\"}\n";
                }
            }
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

    if (cmd == "subscribe_events") {
        // Keep this fd open — the client will receive pushed events.
#ifdef SO_NOSIGPIPE
        int one = 1;
        ::setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof(one));
#endif
        // Send initial ack so the client knows subscription is active.
        const char* ack = "{\"type\":\"subscribed\"}\n";
        if (!safe_write(fd, ack, std::strlen(ack))) {
            ::close(fd);
            return;
        }
        // Set non-blocking so publish_event doesn't stall the event loop.
        ::fcntl(fd, F_SETFL, ::fcntl(fd, F_GETFL, 0) | O_NONBLOCK);
        event_subscribers_.push_back(fd);
        return; // do NOT write resp or close fd
    }

    (void)safe_write(fd, resp.c_str(), resp.size());
    ::close(fd);
#endif
}

void ApiIpcServer::publish_event(const char* event_type, const std::string& payload_json) {
#ifndef _WIN32
    if (event_subscribers_.empty()) return;
    std::string msg = std::string("{\"type\":\"event\",\"seq\":")
                    + std::to_string(next_event_seq_++)
                    + ",\"event\":\"" + std::string(event_type) + "\""
                    + ",\"payload\":" + payload_json
                    + "}\n";
    const char* data = msg.c_str();
    const ssize_t total = static_cast<ssize_t>(msg.size());
    for (auto it = event_subscribers_.begin(); it != event_subscribers_.end(); ) {
        int fd = *it;
        // Use MSG_NOSIGNAL on Linux to avoid SIGPIPE killing the process when
        // a subscriber disconnects. On macOS set SO_NOSIGPIPE on the fd instead.
#ifdef SO_NOSIGPIPE
        int one = 1;
        ::setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof(one));
#endif
        ssize_t written = 0;
        bool drop = false;
        while (written < total) {
#ifdef MSG_NOSIGNAL
            ssize_t n = ::send(fd, data + written, static_cast<size_t>(total - written), MSG_NOSIGNAL);
#else
            ssize_t n = ::write(fd, data + written, static_cast<size_t>(total - written));
#endif
            if (n > 0) {
                written += n;
            } else if (n < 0 && errno == EINTR) {
                // Interrupted by signal — retry immediately.
                continue;
            } else if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
                // Non-blocking buffer full — drop this subscriber to avoid stalling.
                drop = true;
                break;
            } else {
                // Error or EOF — subscriber gone.
                drop = true;
                break;
            }
        }
        if (drop) {
            ::close(fd);
            it = event_subscribers_.erase(it);
        } else {
            ++it;
        }
    }
#endif
}

void ApiIpcServer::stop() {
#ifndef _WIN32
    // Close all event subscriber fds.
    for (int sub_fd : event_subscribers_) ::close(sub_fd);
    event_subscribers_.clear();

    if (fd_listen_ >= 0) {
        ::close(fd_listen_);
        fd_listen_ = -1;
    }
    if (!sock_path_.empty()) {
        ::unlink(sock_path_.c_str());
    }
#endif
}
