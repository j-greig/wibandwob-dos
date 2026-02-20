#include <iostream>

#include "micropolis/micropolis_bridge.h"

int main() {
    MicropolisBridge sim;
    if (!sim.initialize_new_city(2026, 1)) {
        std::cerr << "failed to initialize sim\n";
        return 1;
    }

    sim.tick(64);
    const std::string text = sim.render_ascii_excerpt(0, 0, 80, 25);

    if (text.find('\x1b') != std::string::npos) {
        std::cerr << "escape byte found in ascii render output\n";
        return 2;
    }
    if (text.find("\\x1b[") != std::string::npos) {
        std::cerr << "escaped CSI marker found in ascii render output\n";
        return 3;
    }

    return 0;
}

