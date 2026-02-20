#include <iostream>

#include "micropolis/micropolis_bridge.h"

int main() {
    MicropolisBridge run_a;
    MicropolisBridge run_b;

    const int seed = 1337;
    const int ticks = 1200;

    if (!run_a.initialize_new_city(seed, 2)) {
        std::cerr << "failed to initialize run_a\n";
        return 1;
    }
    if (!run_b.initialize_new_city(seed, 2)) {
        std::cerr << "failed to initialize run_b\n";
        return 1;
    }

    run_a.tick(ticks);
    run_b.tick(ticks);

    const auto a = run_a.snapshot();
    const auto b = run_b.snapshot();

    if (a.map_hash != b.map_hash) {
        std::cerr << "determinism hash mismatch: " << a.map_hash << " vs " << b.map_hash << "\n";
        return 2;
    }
    if (a.city_time != b.city_time) {
        std::cerr << "city_time mismatch\n";
        return 3;
    }
    if (a.total_pop != b.total_pop || a.city_score != b.city_score) {
        std::cerr << "metrics mismatch\n";
        return 4;
    }

    return 0;
}

