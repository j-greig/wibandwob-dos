// Data-driven registry mapping window type slugs to spawn callbacks.
// Eliminates the if-else dispatch chain and extern declarations in api_ipc.cpp.
// To add a new window type: add ONE entry in window_type_registry.cpp.
#pragma once

#include <string>
#include <vector>
#include <map>

class TTestPatternApp;

// Spawn callback: return nullptr on success, a static error string on failure.
using WinSpawnFn = const char* (*)(TTestPatternApp&,
                                   const std::map<std::string, std::string>&);

struct WindowTypeSpec {
    const char* type;    // canonical slug, e.g. "verse", "gradient"
    WinSpawnFn  spawn;   // nullptr = recognised but not creatable via IPC
};

// Finds the spec for the given type slug (exact match). Returns nullptr if not found.
const WindowTypeSpec* find_window_type_by_name(const std::string& name);

// All registered specs — useful for capability listings or help text.
const std::vector<WindowTypeSpec>& all_window_type_specs();
