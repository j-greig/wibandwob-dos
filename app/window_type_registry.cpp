// Window type registry — single source of truth for all spawnable window types.
// Keeps api_ipc.cpp free of per-type knowledge: adding a new type only requires
// a new entry in the k_specs table below.

#include "window_type_registry.h"
#include "gradient.h"
#include "frame_file_player_view.h"
#include "transparent_text_view.h"
#include "text_editor_view.h"
#include "browser_view.h"
#include "generative_verse_view.h"
#include "generative_mycelium_view.h"
#include "generative_orbit_view.h"
#include "generative_torus_view.h"
#include "generative_cube_view.h"
#include "game_of_life_view.h"
#include "animated_blocks_view.h"
#include "animated_score_view.h"
#include "animated_ascii_view.h"
#include "animated_gradient_view.h"
#include "generative_monster_cam_view.h"
#include "generative_monster_verse_view.h"
#include "generative_monster_portal_view.h"
#include "wibwob_view.h"
#include "quadra_view.h"
#include "snake_view.h"
#include "rogue_view.h"
#include "deep_signal_view.h"
#include "app_launcher_view.h"
#include "ascii_gallery_view.h"
#include "scramble_view.h"
#include "room_chat_view.h"
#include "paint/paint_window.h"
#include "micropolis_ascii_view.h"
#include "tvterm_view.h"
#include "figlet_text_view.h"

// tvision for TRect
#define Uses_TRect
#include <tvision/tv.h>

#include <cstdlib>  // atoi
#include <cstring>  // strcmp

// ── Extern declarations for spawn helpers in wwdos_app.cpp ─────────────

class TWwdosApp; // forward decl (full type used only by called functions)

extern void api_spawn_test(TWwdosApp&, const TRect*);
extern void api_spawn_gradient(TWwdosApp&, const std::string&, const TRect*);
extern void api_open_animation_path(TWwdosApp&, const std::string&, const TRect*, bool frameless, bool shadowless, const std::string& title);
extern void api_open_text_view_path(TWwdosApp&, const std::string&, const TRect*);
extern void api_spawn_text_editor(TWwdosApp&, const TRect*, const std::string&);
extern void api_spawn_browser(TWwdosApp&, const TRect*);
extern void api_spawn_verse(TWwdosApp&, const TRect*);
extern void api_spawn_mycelium(TWwdosApp&, const TRect*);
extern void api_spawn_orbit(TWwdosApp&, const TRect*);
extern void api_spawn_torus(TWwdosApp&, const TRect*);
extern void api_spawn_cube(TWwdosApp&, const TRect*);
extern void api_spawn_life(TWwdosApp&, const TRect*);
extern void api_spawn_blocks(TWwdosApp&, const TRect*);
extern void api_spawn_score(TWwdosApp&, const TRect*);
extern void api_spawn_ascii(TWwdosApp&, const TRect*);
extern void api_spawn_animated_gradient(TWwdosApp&, const TRect*);
extern void api_spawn_monster_cam(TWwdosApp&, const TRect*);
extern void api_spawn_monster_verse(TWwdosApp&, const TRect*);
extern void api_spawn_monster_portal(TWwdosApp&, const TRect*);
extern void api_spawn_paint(TWwdosApp&, const TRect*);
extern void api_spawn_micropolis_ascii(TWwdosApp&, const TRect*);
extern void api_spawn_terminal(TWwdosApp&, const TRect*);
extern void api_spawn_wibwob(TWwdosApp&, const TRect*);
extern void api_spawn_room_chat(TWwdosApp&, const TRect*);
extern void api_spawn_quadra(TWwdosApp&, const TRect*);
extern void api_spawn_snake(TWwdosApp&, const TRect*);
extern void api_spawn_rogue(TWwdosApp&, const TRect*);
extern void api_spawn_deep_signal(TWwdosApp&, const TRect*);
extern void api_spawn_app_launcher(TWwdosApp&, const TRect*);
extern void api_spawn_gallery(TWwdosApp&, const TRect*);
extern void api_spawn_figlet_text(TWwdosApp&, const TRect*,
    const std::string& text, const std::string& font,
    bool frameless, bool shadowless);

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

static const char* spawn_test(TWwdosApp& app,
                               const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_test(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_gradient(TWwdosApp& app,
                                   const std::map<std::string, std::string>& kv) {
    auto it = kv.find("gradient");
    std::string kind = (it != kv.end()) ? it->second : "horizontal";
    TRect r; api_spawn_gradient(app, kind, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_frame_player(TWwdosApp& app,
                                       const std::map<std::string, std::string>& kv) {
    auto it = kv.find("path");
    if (it == kv.end() || it->second.empty()) return "err missing path";
    auto fi = kv.find("frameless");
    auto si = kv.find("shadowless");
    auto ti = kv.find("title");
    bool frameless   = (fi != kv.end() && (fi->second == "1" || fi->second == "true"));
    bool shadowless  = (si != kv.end() && (si->second == "1" || si->second == "true"));
    std::string title = (ti != kv.end()) ? ti->second : "";
    TRect r; api_open_animation_path(app, it->second, opt_bounds(kv, r), frameless, shadowless, title); return nullptr;
}

static const char* spawn_text_view(TWwdosApp& app,
                                    const std::map<std::string, std::string>& kv) {
    auto it = kv.find("path");
    if (it == kv.end() || it->second.empty()) return "err missing path";
    TRect r; api_open_text_view_path(app, it->second, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_text_editor(TWwdosApp& app,
                                      const std::map<std::string, std::string>& kv) {
    const auto it = kv.find("title");
    const std::string title = (it != kv.end()) ? it->second : "";
    TRect r; api_spawn_text_editor(app, opt_bounds(kv, r), title); return nullptr;
}

static const char* spawn_browser(TWwdosApp& app,
                                  const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_browser(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_verse(TWwdosApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_verse(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_mycelium(TWwdosApp& app,
                                   const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_mycelium(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_orbit(TWwdosApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_orbit(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_torus(TWwdosApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_torus(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_cube(TWwdosApp& app,
                               const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_cube(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_life(TWwdosApp& app,
                               const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_life(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_blocks(TWwdosApp& app,
                                 const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_blocks(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_score(TWwdosApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_score(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_ascii(TWwdosApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_ascii(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_animated_gradient(TWwdosApp& app,
                                            const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_animated_gradient(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_monster_cam(TWwdosApp& app,
                                      const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_monster_cam(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_monster_verse(TWwdosApp& app,
                                        const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_monster_verse(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_monster_portal(TWwdosApp& app,
                                         const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_monster_portal(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_paint(TWwdosApp& app,
                                const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_paint(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_micropolis_ascii(TWwdosApp& app,
                                           const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_micropolis_ascii(app, opt_bounds(kv, r)); return nullptr;
}

static const char* spawn_terminal(TWwdosApp& app,
                                   const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_terminal(app, opt_bounds(kv, r)); return nullptr;
}
static const char* spawn_room_chat(TWwdosApp& app,
                                   const std::map<std::string, std::string>& kv) {
    TRect r; api_spawn_room_chat(app, opt_bounds(kv, r)); return nullptr;
}
static const char* spawn_quadra(TWwdosApp& app, const std::map<std::string,std::string>& kv) {
    TRect r; api_spawn_quadra(app, opt_bounds(kv, r)); return nullptr; }
static const char* spawn_snake(TWwdosApp& app, const std::map<std::string,std::string>& kv) {
    TRect r; api_spawn_snake(app, opt_bounds(kv, r)); return nullptr; }
static const char* spawn_rogue(TWwdosApp& app, const std::map<std::string,std::string>& kv) {
    TRect r; api_spawn_rogue(app, opt_bounds(kv, r)); return nullptr; }
static const char* spawn_deep_signal(TWwdosApp& app, const std::map<std::string,std::string>& kv) {
    TRect r; api_spawn_deep_signal(app, opt_bounds(kv, r)); return nullptr; }
static const char* spawn_app_launcher(TWwdosApp& app, const std::map<std::string,std::string>& kv) {
    TRect r; api_spawn_app_launcher(app, opt_bounds(kv, r)); return nullptr; }
static const char* spawn_gallery(TWwdosApp& app, const std::map<std::string,std::string>& kv) {
    TRect r; api_spawn_gallery(app, opt_bounds(kv, r)); return nullptr; }
static const char* spawn_figlet_text(TWwdosApp& app, const std::map<std::string,std::string>& kv) {
    auto ti = kv.find("text");
    if (ti == kv.end() || ti->second.empty()) return "err missing text param";
    auto fi = kv.find("font");
    std::string font = (fi != kv.end()) ? fi->second : "standard";
    auto fli = kv.find("frameless");
    auto si = kv.find("shadowless");
    bool frameless  = (fli != kv.end() && (fli->second == "1" || fli->second == "true"));
    bool shadowless = (si != kv.end() && (si->second == "1" || si->second == "true"));
    TRect r;
    api_spawn_figlet_text(app, opt_bounds(kv, r), ti->second, font, frameless, shadowless);
    return nullptr;
}

template <typename ViewType>
static bool has_child_view(TWindow* w) {
    if (!w) return false;
    TView* start = w->first();
    if (!start) return false;
    TView* v = start;
    do {
        if (dynamic_cast<ViewType*>(v)) return true;
        v = v->next;
    } while (v != start);
    return false;
}

static bool match_test_pattern(TWindow*) {
    // TTestPatternWindow/TTestPatternView are local to wwdos_app.cpp.
    // The app falls back to this registry's first entry when no matcher hits.
    return false;
}

static bool match_gradient(TWindow* w) { return has_child_view<TGradientView>(w); }
static bool match_frame_player(TWindow* w) { return has_child_view<FrameFilePlayerView>(w) || has_child_view<TTextFileView>(w); }
static bool match_text_view(TWindow* w) { return dynamic_cast<TTransparentTextWindow*>(w) != nullptr; }
static bool match_text_editor(TWindow* w) { return dynamic_cast<TTextEditorWindow*>(w) != nullptr; }
static bool match_browser(TWindow* w) { return dynamic_cast<TBrowserWindow*>(w) != nullptr; }
static bool match_verse(TWindow* w) { return has_child_view<TGenerativeVerseView>(w); }
static bool match_mycelium(TWindow* w) { return has_child_view<TGenerativeMyceliumView>(w); }
static bool match_orbit(TWindow* w) { return has_child_view<TGenerativeOrbitView>(w); }
static bool match_torus(TWindow* w) { return has_child_view<TGenerativeTorusView>(w); }
static bool match_cube(TWindow* w) { return has_child_view<TGenerativeCubeView>(w); }
static bool match_life(TWindow* w) { return has_child_view<TGameOfLifeView>(w); }
static bool match_blocks(TWindow* w) { return has_child_view<TAnimatedBlocksView>(w); }
static bool match_score(TWindow* w) { return has_child_view<TAnimatedScoreView>(w); }
static bool match_ascii(TWindow* w) { return has_child_view<TAnimatedAsciiView>(w); }
static bool match_animated_gradient(TWindow* w) { return has_child_view<TAnimatedHGradientView>(w); }
static bool match_monster_cam(TWindow* w) { return has_child_view<TGenerativeMonsterCamView>(w); }
static bool match_monster_verse(TWindow* w) { return has_child_view<TGenerativeMonsterVerseView>(w); }
static bool match_monster_portal(TWindow* w) { return has_child_view<TGenerativeMonsterPortalView>(w); }
static bool match_paint(TWindow* w) { return dynamic_cast<TPaintWindow*>(w) != nullptr; }
static bool match_micropolis_ascii(TWindow* w) { return has_child_view<TMicropolisAsciiView>(w); }
static bool match_terminal(TWindow* w) { return dynamic_cast<TWibWobTerminalWindow*>(w) != nullptr; }
static bool match_wibwob(TWindow* w) { return dynamic_cast<TWibWobWindow*>(w) != nullptr; }
static bool match_room_chat(TWindow* w) { return dynamic_cast<TRoomChatWindow*>(w) != nullptr; }
static bool match_scramble(TWindow* w)    { return dynamic_cast<TScrambleWindow*>(w) != nullptr; }
static bool match_quadra(TWindow* w)      { return has_child_view<TQuadraView>(w); }
static bool match_snake(TWindow* w)       { return has_child_view<TSnakeView>(w); }
static bool match_rogue(TWindow* w)       { return has_child_view<TRogueView>(w); }
static bool match_deep_signal(TWindow* w) { return has_child_view<TDeepSignalView>(w); }
static bool match_app_launcher(TWindow* w){ return dynamic_cast<TAppLauncherWindow*>(w) != nullptr; }
static bool match_gallery(TWindow* w)     { return dynamic_cast<TGalleryWindow*>(w) != nullptr; }
static bool match_figlet_text(TWindow* w) { return dynamic_cast<TFigletTextWindow*>(w) != nullptr; }

// ── Registry table ────────────────────────────────────────────────────────────
// Add new window types here — nowhere else.

static const WindowTypeSpec k_specs[] = {
    { "test_pattern",      spawn_test,              match_test_pattern      },
    { "gradient",          spawn_gradient,          match_gradient          },
    { "frame_player",      spawn_frame_player,      match_frame_player      },
    { "text_view",         spawn_text_view,         match_text_view         },
    { "text_editor",       spawn_text_editor,       match_text_editor       },
    { "browser",           spawn_browser,           match_browser           },
    { "verse",             spawn_verse,             match_verse             },
    { "mycelium",          spawn_mycelium,          match_mycelium          },
    { "orbit",             spawn_orbit,             match_orbit             },
    { "torus",             spawn_torus,             match_torus             },
    { "cube",              spawn_cube,              match_cube              },
    { "life",              spawn_life,              match_life              },
    { "blocks",            spawn_blocks,            match_blocks            },
    { "score",             spawn_score,             match_score             },
    { "ascii",             spawn_ascii,             match_ascii             },
    { "animated_gradient", spawn_animated_gradient, match_animated_gradient },
    { "monster_cam",       spawn_monster_cam,       match_monster_cam       },
    { "monster_verse",     spawn_monster_verse,     match_monster_verse     },
    { "monster_portal",    spawn_monster_portal,    match_monster_portal    },
    { "paint",             spawn_paint,             match_paint             },
    { "micropolis_ascii",  spawn_micropolis_ascii,  match_micropolis_ascii  },
    { "terminal",          spawn_terminal,          match_terminal          },
    { "room_chat",         spawn_room_chat,         match_room_chat         },
    // Internal-only types — recognised but not spawnable via IPC
    { "wibwob",            [](TWwdosApp& app, const std::map<std::string,std::string>& kv) -> const char* {
                               TRect r; api_spawn_wibwob(app, opt_bounds(kv, r)); return nullptr;
                           },                       match_wibwob             },
    { "scramble",          nullptr,                match_scramble           },
    { "quadra",            spawn_quadra,           match_quadra             },
    { "snake",             spawn_snake,            match_snake              },
    { "rogue",             spawn_rogue,            match_rogue              },
    { "deep_signal",       spawn_deep_signal,      match_deep_signal        },
    { "app_launcher",      spawn_app_launcher,     match_app_launcher       },
    { "gallery",           spawn_gallery,          match_gallery            },
    { "figlet_text",       spawn_figlet_text,      match_figlet_text        },
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

std::string get_window_types_json() {
    const auto& specs = all_window_type_specs();
    std::string json = "{\"window_types\":[";
    for (size_t i = 0; i < specs.size(); ++i) {
        if (i > 0) json += ",";
        json += "{\"type\":\"";
        json += specs[i].type;
        json += "\",\"spawnable\":";
        json += specs[i].spawn ? "true" : "false";
        json += "}";
    }
    json += "]}";
    return json;
}
