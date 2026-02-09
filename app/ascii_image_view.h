// ASCII Image View (Turbo Vision) — Menu-integrated viewer
#pragma once

// Forward declarations to avoid forcing tv.h into headers
class TWindow;
struct TRect;
#include <string>

// Creates a tileable window that hosts an ASCII image view rendering the given file.
// Supported formats: PNG/JPEG (via stb_image). Returns nullptr on failure.
TWindow* createAsciiImageWindowFromFile(const TRect &bounds, const std::string &path);
