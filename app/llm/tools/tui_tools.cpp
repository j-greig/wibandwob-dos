/*---------------------------------------------------------*/
/*                                                         */
/*   tui_tools.cpp - TUI Application Control Tools        */
/*                                                         */
/*---------------------------------------------------------*/

#include "../base/itool.h"
#include <sstream>
#include <stdexcept>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <cstring>
#include <cstdlib>

class TUIToolExecutor : public IToolExecutor {
public:
    ToolResult execute(const ToolCall& call) override {
        if (call.name == "list_windows") {
            return listWindows(call);
        } else if (call.name == "create_test_pattern_window") {
            return createTestPatternWindow(call);
        } else if (call.name == "get_canvas_size") {
            return getCanvasSize(call);
        }
        
        return ToolResult::error(call.id, "Unknown TUI tool: " + call.name);
    }
    
    bool executeAsync(const ToolCall& call, ToolExecutionCallback callback) override {
        // TUI tools are synchronous for now
        if (callback) {
            callback(execute(call));
        }
        return true;
    }
    
    bool canExecute(const std::string& tool_name) const override {
        return tool_name == "list_windows" ||
               tool_name == "create_test_pattern_window" ||
               tool_name == "get_canvas_size";
    }
    
    Tool getToolDefinition(const std::string& tool_name) const override {
        if (tool_name == "list_windows") {
            return Tool(
                "list_windows",
                "Get a complete list of all currently open TUI windows, including their IDs, positions, sizes, and types. Use this when the user asks about what windows are open or wants to see the current window layout.",
                R"({"type": "object", "properties": {}, "required": []})"
            );
        } else if (tool_name == "create_test_pattern_window") {
            return Tool(
                "create_test_pattern_window",
                "Actually create and display a new test pattern window in the TUI application. This will make a real window appear on screen with colorful test patterns. Use this when the user asks you to create, spawn, open, or make a new window.",
                R"({"type": "object", "properties": {}, "required": []})"
            );
        } else if (tool_name == "get_canvas_size") {
            return Tool(
                "get_canvas_size", 
                "Get the current terminal canvas dimensions (width and height in characters). Use this when you need to know the screen size for window positioning or layout calculations.",
                R"({"type": "object", "properties": {}, "required": []})"
            );
        }
        return Tool();
    }
    
    std::vector<Tool> getSupportedTools() const override {
        return {
            getToolDefinition("list_windows"),
            getToolDefinition("create_test_pattern_window"),
            getToolDefinition("get_canvas_size")
        };
    }

private:
    std::string sendIpcCommand(const std::string& command) {
        int sock = socket(AF_UNIX, SOCK_STREAM, 0);
        if (sock < 0) return "";

        // Derive socket path from same env var as main app
        std::string sockPath = "/tmp/test_pattern_app.sock";
        const char* inst = std::getenv("WIBWOB_INSTANCE");
        if (inst && inst[0] != '\0') {
            sockPath = std::string("/tmp/wibwob_") + inst + ".sock";
        }

        struct sockaddr_un addr;
        memset(&addr, 0, sizeof(addr));
        addr.sun_family = AF_UNIX;
        strncpy(addr.sun_path, sockPath.c_str(), sizeof(addr.sun_path) - 1);
        
        if (connect(sock, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
            close(sock);
            return "";
        }
        
        send(sock, command.c_str(), command.length(), 0);
        send(sock, "\n", 1, 0);
        
        char buffer[4096] = {0};
        recv(sock, buffer, sizeof(buffer) - 1, 0);
        
        close(sock);
        return std::string(buffer);
    }
    
    ToolResult listWindows(const ToolCall& call) {
        try {
            std::string response = sendIpcCommand("cmd:get_state");
            
            if (response.empty()) {
                return ToolResult(call.id, R"({"windows": [], "note": "No TUI application running or no response"})");
            }
            
            return ToolResult(call.id, response);
        } catch (const std::exception& e) {
            return ToolResult::error(call.id, "Failed to list windows: " + std::string(e.what()));
        }
    }
    
    ToolResult createTestPatternWindow(const ToolCall& call) {
        try {
            std::string response = sendIpcCommand("cmd:create_window type=test_pattern");
            
            return ToolResult(call.id, response.empty() ? "Window created" : response);
        } catch (const std::exception& e) {
            return ToolResult::error(call.id, "Failed to create window: " + std::string(e.what()));
        }
    }
    
    ToolResult getCanvasSize(const ToolCall& call) {
        try {
            std::string response = sendIpcCommand("cmd:get_canvas_size");
            
            if (response.empty()) {
                return ToolResult(call.id, R"({"width": 80, "height": 25, "note": "Default size - no TUI app running"})");
            }
            
            return ToolResult(call.id, response);
        } catch (const std::exception& e) {
            return ToolResult::error(call.id, "Failed to get canvas size: " + std::string(e.what()));
        }
    }
};

// Auto-register the TUI tools
static bool tui_tools_registered = []() {
    ToolRegistry::instance().registerExecutor(
        std::make_shared<TUIToolExecutor>()
    );
    return true;
}();