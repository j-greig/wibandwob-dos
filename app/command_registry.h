#pragma once

#include <map>
#include <string>
#include <vector>

class TTestPatternApp;

struct CommandCapability {
    const char* name;
    const char* description;
    bool requires_path;
};

const std::vector<CommandCapability>& get_command_capabilities();
std::string get_command_capabilities_json();
std::string exec_registry_command(
    TTestPatternApp& app,
    const std::string& name,
    const std::map<std::string, std::string>& kv);
