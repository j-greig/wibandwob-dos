/*---------------------------------------------------------*/
/*                                                         */
/*   clipboard_read.cpp - Read system clipboard text       */
/*                                                         */
/*---------------------------------------------------------*/

#include "clipboard_read.h"

#include <cstdio>
#include <memory>
#include <array>
#include <string>
#include <vector>
#include <cstdlib>

namespace {

static bool runPipe(const std::vector<const char*> &cmd, std::string &out)
{
#if defined(_WIN32)
    (void)cmd; (void)out; return false; // Not implemented for Windows in MVP.
#else
    // Build command string safely by bypassing the shell (but popen needs a string).
    // Use a simple best-effort fallback joining with spaces; arguments must be trusted literals here.
    std::string joined;
    for (size_t i = 0; i < cmd.size(); ++i) {
        if (i) joined += ' ';
        joined += cmd[i];
    }
    FILE *pipe = popen(joined.c_str(), "r");
    if (!pipe) return false;
    std::array<char, 4096> buf;
    while (true) {
        size_t n = fread(buf.data(), 1, buf.size(), pipe);
        if (n == 0) break;
        out.append(buf.data(), n);
    }
    int rc = pclose(pipe);
    return rc == 0;
#endif
}

static void rtrimCR(std::string &s)
{
    while (!s.empty() && (s.back() == '\r')) s.pop_back();
}

}

bool readClipboard(std::string &out, std::string &err)
{
    out.clear(); err.clear();
#if defined(__APPLE__)
    // macOS: pbpaste
    if (runPipe({"pbpaste"}, out)) { rtrimCR(out); return true; }
    err = "pbpaste failed";
    return false;
#else
    const char *wayland = std::getenv("WAYLAND_DISPLAY");
    if (wayland) {
        if (runPipe({"wl-paste"}, out)) { rtrimCR(out); return true; }
        err = "wl-paste failed"; return false;
    }
    // Try xclip, xsel in order
    if (runPipe({"xclip", "-selection", "clipboard", "-out"}, out)) { rtrimCR(out); return true; }
    if (runPipe({"xsel", "--clipboard", "--output"}, out)) { rtrimCR(out); return true; }
    err = "No clipboard reader available";
    return false;
#endif
}

