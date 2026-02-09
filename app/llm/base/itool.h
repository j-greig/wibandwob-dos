/*---------------------------------------------------------*/
/*                                                         */
/*   itool.h - Tool Interface for LLM Providers           */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef ITOOL_H
#define ITOOL_H

#include <string>
#include <vector>
#include <functional>
#include <memory>

// Tool definition structure
struct Tool {
    std::string name;        // Unique tool identifier
    std::string description; // Human-readable description
    std::string input_schema; // JSON schema for input validation
    
    // Optional metadata
    std::string category;    // Tool category (file, time, tui, etc.)
    bool async = false;      // Whether tool execution is async
    
    Tool() = default;
    Tool(const std::string& n, const std::string& desc, const std::string& schema)
        : name(n), description(desc), input_schema(schema) {}
};

// Tool call request from LLM
struct ToolCall {
    std::string id;          // Unique call identifier
    std::string name;        // Tool name to execute
    std::string input;       // JSON arguments for tool
    
    ToolCall() = default;
    ToolCall(const std::string& call_id, const std::string& tool_name, const std::string& args)
        : id(call_id), name(tool_name), input(args) {}
};

// Tool execution result
struct ToolResult {
    std::string tool_use_id; // Matches ToolCall.id
    std::string content;     // Result content (JSON or text)
    bool is_error = false;   // Whether execution failed
    std::string error_message; // Error details if is_error=true
    int duration_ms = 0;     // Execution time
    
    ToolResult() = default;
    ToolResult(const std::string& id, const std::string& result)
        : tool_use_id(id), content(result) {}
    
    // Helper for error results
    static ToolResult error(const std::string& id, const std::string& error) {
        ToolResult result(id, "");
        result.is_error = true;
        result.error_message = error;
        return result;
    }
};

// Tool execution callback
using ToolExecutionCallback = std::function<void(const ToolResult&)>;

// Abstract tool executor interface
class IToolExecutor {
public:
    virtual ~IToolExecutor() = default;
    
    // Execute a tool synchronously
    virtual ToolResult execute(const ToolCall& call) = 0;
    
    // Execute a tool asynchronously
    virtual bool executeAsync(const ToolCall& call, ToolExecutionCallback callback) = 0;
    
    // Check if this executor can handle the given tool
    virtual bool canExecute(const std::string& tool_name) const = 0;
    
    // Get tool definition if supported
    virtual Tool getToolDefinition(const std::string& tool_name) const = 0;
    
    // Get all supported tools
    virtual std::vector<Tool> getSupportedTools() const = 0;
};

// Tool registry for managing multiple executors
class ToolRegistry {
public:
    static ToolRegistry& instance();
    
    // Register tool executor
    void registerExecutor(std::shared_ptr<IToolExecutor> executor);
    
    // Execute tool call
    ToolResult execute(const ToolCall& call);
    bool executeAsync(const ToolCall& call, ToolExecutionCallback callback);
    
    // Get all available tools
    std::vector<Tool> getAllTools() const;
    
    // Get tool definition
    Tool getToolDefinition(const std::string& name) const;
    
    // Check if tool is supported
    bool isToolSupported(const std::string& name) const;
    
private:
    std::vector<std::shared_ptr<IToolExecutor>> executors_;
    
    std::shared_ptr<IToolExecutor> findExecutor(const std::string& tool_name) const;
};

#endif // ITOOL_H