#ifndef APP_CORE_PRIMER_UTILS_H
#define APP_CORE_PRIMER_UTILS_H

#include <string>
#include <fstream>

struct PrimerInfo {
    size_t lines = 0;
    size_t width = 0;
    bool hasFrames = false;
    bool ok = false;
};

inline PrimerInfo measurePrimer(const std::string& path) {
    PrimerInfo info;
    std::ifstream f(path);
    if (!f.is_open()) return info;
    std::string line;
    while (std::getline(f, line)) {
        if (!line.empty() && line[0] == '#') continue;  // metadata for LLMs, never rendered
        ++info.lines;
        if (line.size() > info.width) info.width = line.size();
        if (line.find("---") == 0 || line.find("===") == 0) info.hasFrames = true;
    }
    info.ok = true;
    return info;
}

#endif
