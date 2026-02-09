/*---------------------------------------------------------*/
/*                                                         */
/*   tool_executor.cpp - Tool Registry Implementation     */
/*                                                         */
/*---------------------------------------------------------*/

#include "itool.h"
#include <algorithm>
#include <stdexcept>

ToolRegistry& ToolRegistry::instance() {
    static ToolRegistry registry;
    return registry;
}

void ToolRegistry::registerExecutor(std::shared_ptr<IToolExecutor> executor) {
    if (executor) {
        executors_.push_back(executor);
    }
}

ToolResult ToolRegistry::execute(const ToolCall& call) {
    auto executor = findExecutor(call.name);
    if (!executor) {
        return ToolResult::error(call.id, "Tool not found: " + call.name);
    }
    
    try {
        return executor->execute(call);
    } catch (const std::exception& e) {
        return ToolResult::error(call.id, "Tool execution failed: " + std::string(e.what()));
    }
}

bool ToolRegistry::executeAsync(const ToolCall& call, ToolExecutionCallback callback) {
    auto executor = findExecutor(call.name);
    if (!executor) {
        if (callback) {
            callback(ToolResult::error(call.id, "Tool not found: " + call.name));
        }
        return false;
    }
    
    return executor->executeAsync(call, callback);
}

std::vector<Tool> ToolRegistry::getAllTools() const {
    std::vector<Tool> all_tools;
    for (const auto& executor : executors_) {
        auto tools = executor->getSupportedTools();
        all_tools.insert(all_tools.end(), tools.begin(), tools.end());
    }
    return all_tools;
}

Tool ToolRegistry::getToolDefinition(const std::string& name) const {
    auto executor = findExecutor(name);
    if (executor) {
        return executor->getToolDefinition(name);
    }
    return Tool(); // Empty tool if not found
}

bool ToolRegistry::isToolSupported(const std::string& name) const {
    return findExecutor(name) != nullptr;
}

std::shared_ptr<IToolExecutor> ToolRegistry::findExecutor(const std::string& tool_name) const {
    auto it = std::find_if(executors_.begin(), executors_.end(),
        [&tool_name](const std::shared_ptr<IToolExecutor>& executor) {
            return executor->canExecute(tool_name);
        });
    
    return (it != executors_.end()) ? *it : nullptr;
}