#pragma once

#include <cstdint>
#include <memory>
#include <string>

class Micropolis;

struct MicropolisSnapshot {
    std::uint64_t map_hash = 0;
    short total_pop = 0;
    short city_score = 0;
    short res_valve = 0;
    short com_valve = 0;
    short ind_valve = 0;
    long city_time = 0;
    long total_funds = 0;
};

struct ToolApplyResult {
    int code;          // -2 no money, -1 need bulldoze, 0 failed, 1 ok
    std::string message;
};

struct CityIOResult {
    bool ok;
    std::string message;
};

class MicropolisBridge {
public:
    MicropolisBridge();
    ~MicropolisBridge();

    bool initialize_new_city(int seed, short speed);
    void tick(int tick_count);

    std::uint16_t cell_at(int x, int y) const;
    std::uint16_t tile_at(int x, int y) const;
    char glyph_for_tile(std::uint16_t tile) const;
    std::string glyph_pair_for_tile(std::uint16_t tile) const;

    MicropolisSnapshot snapshot() const;
    ToolApplyResult apply_tool(int tool_id, int x, int y);
    CityIOResult save_city(const std::string &path);
    CityIOResult load_city(const std::string &path);
    std::string render_ascii_excerpt(int x, int y, int width, int height) const;

private:
    std::uint64_t hash_map_bytes() const;

    std::unique_ptr<Micropolis> sim_;
};
