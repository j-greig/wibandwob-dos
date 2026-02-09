// Simple Unix domain socket IPC server to receive control commands.
// Intended for local development; parses a tiny line protocol:
//   cmd:<name> [key=value ...]\n
#pragma once

#include <string>

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

private:
    TTestPatternApp* app_ = nullptr;
    int fd_listen_ = -1;
    std::string sock_path_;
};

