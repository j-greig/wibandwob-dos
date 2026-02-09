/*---------------------------------------------------------*/
/*                                                         */
/*   time_tools.cpp - Time and Date Tools                 */
/*                                                         */
/*---------------------------------------------------------*/

#include "../base/itool.h"
#include <chrono>
#include <iomanip>
#include <sstream>
#include <ctime>

class TimeToolExecutor : public IToolExecutor {
public:
    ToolResult execute(const ToolCall& call) override {
        if (call.name == "get_current_time") {
            return getCurrentTime(call);
        } else if (call.name == "get_current_date") {
            return getCurrentDate(call);
        } else if (call.name == "get_timestamp") {
            return getTimestamp(call);
        }
        
        return ToolResult::error(call.id, "Unknown time tool: " + call.name);
    }
    
    bool executeAsync(const ToolCall& call, ToolExecutionCallback callback) override {
        // Time tools are always synchronous
        if (callback) {
            callback(execute(call));
        }
        return true;
    }
    
    bool canExecute(const std::string& tool_name) const override {
        return tool_name == "get_current_time" || 
               tool_name == "get_current_date" || 
               tool_name == "get_timestamp";
    }
    
    Tool getToolDefinition(const std::string& tool_name) const override {
        if (tool_name == "get_current_time") {
            return Tool(
                "get_current_time",
                "Get the actual current time in HH:MM:SS format. Use this when the user asks 'what time is it?' or needs to know the current time.",
                R"({"type": "object", "properties": {}, "required": []})"
            );
        } else if (tool_name == "get_current_date") {
            return Tool(
                "get_current_date", 
                "Get the current date in YYYY-MM-DD format",
                R"({"type": "object", "properties": {}, "required": []})"
            );
        } else if (tool_name == "get_timestamp") {
            return Tool(
                "get_timestamp",
                "Get the current timestamp in ISO 8601 format",
                R"({"type": "object", "properties": {}, "required": []})"
            );
        }
        return Tool();
    }
    
    std::vector<Tool> getSupportedTools() const override {
        return {
            getToolDefinition("get_current_time"),
            getToolDefinition("get_current_date"), 
            getToolDefinition("get_timestamp")
        };
    }

private:
    ToolResult getCurrentTime(const ToolCall& call) {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        
        std::ostringstream oss;
        oss << std::put_time(std::localtime(&time_t), "%H:%M:%S");
        
        return ToolResult(call.id, oss.str());
    }
    
    ToolResult getCurrentDate(const ToolCall& call) {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        
        std::ostringstream oss;
        oss << std::put_time(std::localtime(&time_t), "%Y-%m-%d");
        
        return ToolResult(call.id, oss.str());
    }
    
    ToolResult getTimestamp(const ToolCall& call) {
        auto now = std::chrono::system_clock::now();
        auto time_t = std::chrono::system_clock::to_time_t(now);
        auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()) % 1000;
        
        std::ostringstream oss;
        oss << std::put_time(std::localtime(&time_t), "%Y-%m-%dT%H:%M:%S");
        oss << "." << std::setfill('0') << std::setw(3) << ms.count();
        oss << std::put_time(std::localtime(&time_t), "%z");
        
        return ToolResult(call.id, oss.str());
    }
};

// Auto-register the time tools
static bool time_tools_registered = []() {
    ToolRegistry::instance().registerExecutor(
        std::make_shared<TimeToolExecutor>()
    );
    return true;
}();