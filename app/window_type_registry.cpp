// Window type registry — single source of truth for all spawnable window types.
// Keeps api_ipc.cpp free of per-type knowledge: adding a new type only requires
// a new entry in the k_specs table below.

#include "window_type_registry.h"

// tvision for TRect
#define Uses_TRect
#include <tvision/tv.h>

#include <cstdlib>  // atoi
#include <cstring>  // strcmp

// ── Extern declarations for spawn helpers in test_pattern_app.cpp ─────────────

class TTestPatternApp; // forward decl (full type used only by called functions)

extern void api_spawn_test(TTestPatternApp&, const TRect*);
extern void api_spawn_gradient(TTestPatternApp&, const std::string&, const TRect*);
extern void api_open_animation_path(TTestPatternApp&, const std::string&, const TRect*);
extern void api_open_text_view_path(TTestPatternApp&, const std::string&, const TRect*);
extern void api_spawn_text_editor(TTestPatternApp&, const TRect*);
extern void api_spawn_browser(TTestPatternApp&, const TRect*);
extern void api_spawn_verse(TTestPatternApp&, const TRect*);
extern void api_spawn_mycelium(TTestPatternApp&, const TRect*);
extern void api_spawn_orbit(TTestPatternApp&, const TRect*);
extern void api_spawn_torus(TTestPatternApp&, const TRect*);
extern void api_spawn_cube(TTestPatternApp&, const TRect*);
extern void api_spawn_life(TTestPatternApp&, const TRect*);
extern void api_spawn_blocks(TTestPatternApp&, const TRect*);
extern void api_spawn_score(TTestPatternApp&, const TRect*);
extern void api_spawn_ascii(TTestPatternApp&, const TRect*);
extern void api_spawn_animated_gradient(TTestPatternApp&, const TRect*);
extern void api_spawn_monster_cam(TTestPatternApp&, const TRect*);
extern void api_spawn_monster_verse(TTestPatternApp&, const TRect*);
extern void api_spawn_monster_portal(TTestPatternApp&, const TRect*);

// ── Bounds helper ─────────────────────────────────────────────────────────────

static const TRect* opt_bounds(const std::map<std::string, std::string>& kv, TRect& buf) {
    auto xi = kv.find("x"), yi = kv.find("y");
    auto wi = kv.find("w"), hi = kv.find("h");
    if (xi == kv.end() || yi == kv.end() || wi == kv.end() || hi == kv.end())
        return nullptr;
    int x = std::atoi(xi->second.c_str()), y = std::atoi(yi->second.c_str());
    int w = std::atoi(wi->second.c_str()), h = std::atoi(hi->second.c_str());
    buf = TRect(x, y, x + w, y + h);
    return &buf;
}

// ── Spawn wrappers ────────────────────────────────────────────────────────────

static const char* spawn_test(TTestPatternApp& app,
                               const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_test(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_gradient(TTestPatternApp& app,
                                   const std::map<std::string, std::string>& kv) {
    auto it = kv.find("gradient");
    std::string kind = (it != kv.end()) ? it->second : "horizontal";
    TRect r; api_spawn_gradient(app, kind, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_frame_player(TTestPatternApp& app,
                                       const std::map<std::string, std::string>& kv) {
    auto it = kv.find("path");
    if (it == kv.end()) return "err missing path";
    TRect r; api_open_animation_path(app, it->second, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_text_view(TTestPatternApp& app,
                                    const std::map<std::string, std::string>& kv) {
    auto it = kv.find("path");
    if (it == kv.end()) return "err missing path";
    TRect r; api_open_text_view_path(app, it->second, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_text_editor(TTestPatternApp& app,
                                      const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_text_editor(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_browser(TTestPatternApp& app,
                                  const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_browser(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_verse(TTestPatternApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_verse(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_mycelium(TTestPatternApp& app,
                                   const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_mycelium(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_orbit(TTestPatternApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_orbit(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_torus(TTestPatternApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_torus(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_cube(TTestPatternApp& app,
                               const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_cube(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_life(TTestPatternApp& app,
                               const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_life(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_blocks(TTestPatternApp& app,
                                 const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_blocks(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_score(TTestPatternApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_score(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_ascii(TTestPatternApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_ascii(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_animated_gradient(TTestPatternApp& app,
                                            const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_animated_gradient(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_monster_cam(TTestPatternApp& app,
                                      const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_monster_cam(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_monster_verse(TTestPatternApp& app,
                                        const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_monster_verse(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_monster_portal(TTestPatternApp& app,
                                         const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_monster_portal(app, opt_bounds(kv, r)); return nullptr;
}

// ── Registry table ────────────────────────────────────────────────────────────
// Add new window types here — nowhere else.

static const WindowTypeSpec k_specs[] = {
    { "test_pattern",      spawn_test             },
    { "gradient",          spawn_gradient         },
    { "frame_player",      spawn_frame_player     },
    { "text_view",         spawn_text_view        },
    { "text_editor",       spawn_text_editor      },
    { "browser",           spawn_browser          },
    { "verse",             spawn_verse            },
    { "mycelium",          spawn_mycelium         },
    { "orbit",             spawn_orbit            },
    { "torus",             spawn_torus            },
    { "cube",              spawn_cube             },
    { "life",              spawn_life             },
    { "blocks",            spawn_blocks           },
    { "score",             spawn_score            },
    { "ascii",             spawn_ascii            },
    { "animated_gradient", spawn_animated_gradient},
    { "monster_cam",       spawn_monster_cam      },
    { "monster_verse",     spawn_monster_verse    },
    { "monster_portal",    spawn_monster_portal   },
    // Internal-only types — recognised but not spawnable via IPC
    { "wibwob",            nullptr                },
    { "scramble",          nullptr                },
};

// ── Lookup implementations ────────────────────────────────────────────────────

const std::vector<WindowTypeSpec>& all_window_type_specs() {
    static std::vector<WindowTypeSpec> specs(
        k_specs, k_specs + sizeof(k_specs) / sizeof(k_specs[0]));
    return specs;
}

const WindowTypeSpec* find_window_type_by_name(const std::string& name) {
    for (const auto& spec : all_window_type_specs())
        if (name == spec.type) return &spec;
    return nullptr;
}
