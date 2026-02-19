// Unix domain socket IPC server with optional HMAC challenge-response auth.
// Protocol: cmd:<name> [key=value ...]\n
// Auth: when WIBWOB_AUTH_SECRET is set, new connections must complete a
//       challenge-response handshake before commands are accepted.
#pragma once

#include <string>
#include <set>
#include <vector>
#include <cstdint>

class TTestPatternApp;

class ApiIpcServer {
public:
    explicit ApiIpcServer(TTestPatternApp* app);
    ~ApiIpcServer();

    // Start listening on a Unix socket path. Returns false on failure.
    bool start(const std::string& path = "/tmp/test_pattern_app.sock");
    // Poll for new connections and handle a single command per connection.
    void poll();
    // Stop and clean up.
    void stop();

    // Push a newline-delimited JSON event to all active subscribers.
    // Cleans up disconnected subscriber fds automatically.
    void publish_event(const char* event_type, const std::string& payload_json = "{}");

private:
    TTestPatternApp* app_ = nullptr;
    int fd_listen_ = -1;
    std::string sock_path_;
    std::string auth_secret_;       // from WIBWOB_AUTH_SECRET env var (empty = no auth)
    std::set<std::string> used_nonces_;  // replay protection

    // Event push: persistent subscriber connections
    std::vector<int> event_subscribers_;
    uint64_t next_event_seq_ = 1;

    // Auth helpers
    bool auth_required() const { return !auth_secret_.empty(); }
    std::string generate_nonce();
    std::string compute_hmac(const std::string& nonce);
    bool authenticate_connection(int fd);
};

