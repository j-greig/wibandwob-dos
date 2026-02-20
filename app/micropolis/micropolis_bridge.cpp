#include "micropolis_bridge.h"

#include <algorithm>
#include <cstddef>
#include <cstring>

#include "micropolis.h"
#include "tool.h"

namespace {
constexpr std::uint64_t FNV_OFFSET = 1469598103934665603ull;
constexpr std::uint64_t FNV_PRIME = 1099511628211ull;

std::uint64_t fnv1a_64(const std::uint8_t *data, std::size_t size) {
    std::uint64_t hash = FNV_OFFSET;
    for (std::size_t i = 0; i < size; ++i) {
        hash ^= static_cast<std::uint64_t>(data[i]);
        hash *= FNV_PRIME;
    }
    return hash;
}

void hash_mix(std::uint64_t &hash, const void *value, std::size_t size) {
    const auto *bytes = static_cast<const std::uint8_t *>(value);
    for (std::size_t i = 0; i < size; ++i) {
        hash ^= static_cast<std::uint64_t>(bytes[i]);
        hash *= FNV_PRIME;
    }
}

int tier_from_distance(std::uint16_t tile, std::uint16_t start, std::uint16_t end) {
    if (tile < start || tile > end) {
        return 0;
    }
    const int span = static_cast<int>(end - start + 1);
    const int distance = static_cast<int>(tile - start);
    const int cut1 = span / 3;
    const int cut2 = (span * 2) / 3;
    if (distance < cut1) {
        return 1;
    }
    if (distance < cut2) {
        return 2;
    }
    return 3;
}

std::uint16_t neutralized_road_tile(std::uint16_t tile) {
    if (tile >= ROADBASE && tile <= LASTROAD) {
        return static_cast<std::uint16_t>((tile & 0x000F) + ROADBASE);
    }
    return tile;
}

char road_glyph(std::uint16_t tile) {
    if (tile == BRWV) {
        return '|';
    }

    const auto normalized = neutralized_road_tile(tile);
    if (normalized == HBRIDGE || normalized == ROADS || normalized == HROADPOWER ||
        normalized == BRWH) {
        return '-';
    }
    if (normalized == VBRIDGE || normalized == ROADS2 || normalized == VROADPOWER) {
        return '|';
    }
    return '+';
}
} // namespace

MicropolisBridge::MicropolisBridge() : sim_(new Micropolis()) {
    // Micropolis leaves callback pointers uninitialized before setCallback.
    sim_->callback = nullptr;
    sim_->callbackData = nullptr;
    sim_->userData = nullptr;
    sim_->setCallback(new ConsoleCallback(), emscripten::val::null());
}

MicropolisBridge::~MicropolisBridge() = default;

bool MicropolisBridge::initialize_new_city(int seed, short speed) {
    if (!sim_) {
        return false;
    }

    sim_->init();
    sim_->setSpeed(speed);
    sim_->generateSomeCity(seed);
    return true;
}

void MicropolisBridge::tick(int tick_count) {
    if (!sim_) {
        return;
    }
    for (int i = 0; i < std::max(0, tick_count); ++i) {
        sim_->simTick();
    }
}

std::uint16_t MicropolisBridge::cell_at(int x, int y) const {
    if (!sim_ || x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) {
        return 0;
    }
    return static_cast<std::uint16_t>(sim_->map[x][y]);
}

std::uint16_t MicropolisBridge::tile_at(int x, int y) const {
    return static_cast<std::uint16_t>(cell_at(x, y) & LOMASK);
}

char MicropolisBridge::glyph_for_tile(std::uint16_t tile) const {
    const std::string glyph_pair = glyph_pair_for_tile(tile);
    if (glyph_pair.empty()) {
        return '?';
    }
    return glyph_pair.front();
}

std::string MicropolisBridge::glyph_pair_for_tile(std::uint16_t tile) const {
    if (tile == DIRT) {
        return ". ";
    }
    if (tile >= RIVER && tile <= LASTRIVEDGE) {
        return "~ ";
    }
    if (tile >= WOODS_LOW && tile <= WOODS_HIGH) {
        return "\" ";
    }
    if (tile >= FIREBASE && tile <= LASTFIRE) {
        return "* ";
    }
    if (tile >= RUBBLE && tile <= LASTRUBBLE) {
        return ": ";
    }

    if (tile >= HOSPITALBASE && tile <= HOSPITALBASE + 8) {
        return "H ";
    }
    if (tile >= POWERPLANT && tile <= LASTPOWERPLANT) {
        return "* ";
    }
    if (tile >= FIRESTATION && tile <= 768) {
        return "F ";
    }
    if (tile >= POLICESTBASE && tile <= POLICESTATION) {
        return "P ";
    }

    if (tile == FREEZ) {
        return "r.";
    }
    if (tile == COMBASE || tile == COMCLR) {
        return "c.";
    }
    if (tile == INDBASE || tile == INDCLR) {
        return "i.";
    }

    if (tile >= ROADBASE && tile <= LASTROAD) {
        return std::string(1, road_glyph(tile)) + " ";
    }
    if (tile >= RAILBASE && tile <= LASTRAIL) {
        return "# ";
    }
    if (tile >= POWERBASE && tile <= LASTPOWER) {
        return "w ";
    }

    if (tile >= 245 && tile <= 422 && !(tile >= HOSPITALBASE && tile <= HOSPITALBASE + 8)) {
        const int tier = tier_from_distance(tile, 245, 422);
        return "r" + std::to_string(tier);
    }
    if (tile >= 424 && tile <= 611) {
        const int tier = tier_from_distance(tile, 424, 611);
        return "c" + std::to_string(tier);
    }
    if (tile >= 613 && tile <= 826 &&
        !(tile >= POWERPLANT && tile <= LASTPOWERPLANT) &&
        !(tile >= FIRESTATION && tile <= 768) &&
        !(tile >= POLICESTBASE && tile <= POLICESTATION)) {
        const int tier = tier_from_distance(tile, 613, 826);
        return "i" + std::to_string(tier);
    }

    return "? ";
}

std::uint64_t MicropolisBridge::hash_map_bytes() const {
    if (!sim_) {
        return 0;
    }
    const auto *bytes = reinterpret_cast<const std::uint8_t *>(sim_->getMapBuffer());
    const std::size_t size = static_cast<std::size_t>(sim_->getMapSize());
    if (!bytes || size == 0) {
        return 0;
    }
    return fnv1a_64(bytes, size);
}

MicropolisSnapshot MicropolisBridge::snapshot() const {
    MicropolisSnapshot out;
    if (!sim_) {
        return out;
    }

    out.map_hash = hash_map_bytes();
    out.total_pop = sim_->totalPop;
    out.city_score = sim_->cityScore;
    out.res_valve = sim_->resValve;
    out.com_valve = sim_->comValve;
    out.ind_valve = sim_->indValve;
    out.city_time = static_cast<long>(sim_->cityTime);
    out.total_funds = static_cast<long>(sim_->totalFunds);

    std::uint64_t mixed = out.map_hash;
    hash_mix(mixed, &out.total_pop, sizeof(out.total_pop));
    hash_mix(mixed, &out.city_score, sizeof(out.city_score));
    hash_mix(mixed, &out.res_valve, sizeof(out.res_valve));
    hash_mix(mixed, &out.com_valve, sizeof(out.com_valve));
    hash_mix(mixed, &out.ind_valve, sizeof(out.ind_valve));
    hash_mix(mixed, &out.city_time, sizeof(out.city_time));
    out.map_hash = mixed;
    return out;
}

std::string MicropolisBridge::render_ascii_excerpt(int x, int y, int width, int height) const {
    std::string out;
    if (width <= 0 || height <= 0) {
        return out;
    }

    for (int row = 0; row < height; ++row) {
        const int wy = y + row;
        for (int col = 0; col < width; ++col) {
            const int wx = x + col;
            const auto tile = tile_at(wx, wy);
            out.push_back(glyph_for_tile(tile));
        }
        out.push_back('\n');
    }
    return out;
}

ToolApplyResult MicropolisBridge::apply_tool(int tool_id, int x, int y) {
    if (!sim_) {
        return {0, "No sim"};
    }
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) {
        return {0, "Out of bounds"};
    }
    if (tool_id < TOOL_FIRST || tool_id > TOOL_LAST) {
        return {0, "Unknown tool"};
    }

    const auto tool = static_cast<EditingTool>(tool_id);
    const ToolResult result = sim_->doTool(tool, static_cast<short>(x), static_cast<short>(y));

    switch (result) {
        case TOOLRESULT_OK:            return {1,  "OK"};
        case TOOLRESULT_FAILED:        return {0,  "Failed"};
        case TOOLRESULT_NEED_BULLDOZE: return {-1, "Bulldoze first"};
        case TOOLRESULT_NO_MONEY:      return {-2, "No funds"};
        default:                       return {0,  "?"};
    }
}

CityIOResult MicropolisBridge::save_city(const std::string &path) {
    if (!sim_) {
        return {false, "No sim"};
    }
    if (sim_->saveFile(path)) {
        return {true, "Saved to " + path};
    }
    return {false, "Save failed: " + path};
}

CityIOResult MicropolisBridge::load_city(const std::string &path) {
    if (!sim_) {
        return {false, "No sim"};
    }
    if (sim_->loadFile(path)) {
        return {true, "Loaded from " + path};
    }
    return {false, "Load failed: " + path};
}
