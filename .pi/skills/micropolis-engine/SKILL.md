---
name: micropolis-engine
description: Use when working on the Micropolis/WibWobCity integration in WibWob-DOS. Covers engine architecture, tile system, bitmasks, zone logic, tool API, porting notes, and the emscripten compat shim. Load before touching any file in app/micropolis/ or app/micropolis_ascii_view.
---

# Micropolis Engine — Working Notes

> ROUGH SKILL — updated as we learn. Refine later. Accuracy over polish.

## Vendor location
```
vendor/MicropolisCore/MicropolisEngine/src/   ← engine source (DO NOT EDIT)
vendor/MicropolisCore/MicropolisEngine/src/micropolis.h  ← master header
vendor/MicropolisCore/MicropolisEngine/src/tool.h        ← EditingTool, ToolResult, bitmasks
app/micropolis/compat/emscripten.h            ← native build compat shim (stub emscripten::val)
app/micropolis/micropolis_bridge.h/.cpp       ← our wrapper (EDIT HERE)
app/micropolis_ascii_view.h/.cpp              ← TV view (EDIT HERE)
```

## Build porting notes
- Engine was WASM-only. `micropolis.h` includes `<emscripten.h>` and uses `emscripten::val` everywhere.
- Native build uses `-include app/micropolis/compat/emscripten.h` injected via CMake.
- Exclude `emscripten.cpp` from the static lib build.
- `callback.h` vtable uses `emscripten::val` in every method — `ConsoleCallback` stubs them all as no-ops for native builds.
- See `app/CMakeLists.txt` for the full integration.

## Tile system
```
cell = map[x][y]          unsigned short, 120x100 grid
tile = cell & LOMASK       lower 10 bits — tile ID (0–1023)
flags = cell & ~LOMASK     upper bits — PWRBIT, ZONEBIT, ANIMBIT, BURNBIT, BULLBIT, CONDBIT
```

### Key bitmasks (tool.h)
```
PWRBIT  = 0x8000   tile has power
CONDBIT = 0x4000   conducts electricity
BURNBIT = 0x2000   can burn
BULLBIT = 0x1000   bulldozable
ANIMBIT = 0x0800   animated
ZONEBIT = 0x0400   centre tile of a zone
LOMASK  = 0x03FF   tile ID mask
```

### Key tile ranges (micropolis.h)
```
DIRT        = 0
RIVER       = 2,   LASTRIVEDGE = 20
WOODS_LOW   = 21,  WOODS_HIGH  = 39
RUBBLE      = 44,  LASTRUBBLE  = 47
FIRE        = 56,  LASTFIRE    = 63
ROADBASE    = 64,  LASTROAD    = 206
RAILBASE    = 207  (approx)
RESBASE     = 240  empty res zone, FREEZ=244 (centre), up to COMBASE-1
COMBASE     = 423  empty com zone centre, up to INDBASE-1
INDBASE     = 612  empty ind zone centre
HOSPITAL    = 409  (centre, range 405-413)
FIRESTATION = 765
POLICESTATION = 774 (base 770)
POWERPLANT  = 750
LASTZONE    = 826
```

### Zone development tiers (resolved in Stage D)
- Residential: FREEZ=244 is empty centre. `r.` glyph = empty, `r1`/`r2`/`r3` = low/mid/high.
- Tier mapping via `glyph_pair_for_tile()` in `micropolis_bridge.cpp` — linear bucket over tile range.
- `getResZonePop(tile)` on Micropolis returns zone pop for a res tile.

## Tool API
```cpp
// In micropolis.h:
ToolResult doTool(EditingTool tool, short tileX, short tileY);

// ToolResult values:
TOOLRESULT_NO_MONEY     = -2
TOOLRESULT_NEED_BULLDOZE = -1
TOOLRESULT_FAILED       =  0
TOOLRESULT_OK           =  1

// EditingTool enum (tool.h):
TOOL_RESIDENTIAL=0, TOOL_COMMERCIAL=1, TOOL_INDUSTRIAL=2,
TOOL_FIRESTATION=3, TOOL_POLICESTATION=4, TOOL_QUERY=5,
TOOL_WIRE=6, TOOL_BULLDOZER=7, TOOL_RAILROAD=8, TOOL_ROAD=9, ...
```

## Bridge API (our wrapper)
```cpp
// MicropolisBridge public interface:
bool initialize_new_city(int seed, short speed);
void tick(int tick_count);
std::uint16_t cell_at(int x, int y) const;
std::uint16_t tile_at(int x, int y) const;          // = cell & LOMASK
char glyph_for_tile(std::uint16_t tile) const;
std::string glyph_pair_for_tile(std::uint16_t) const; // 2-char wide tile glyph
MicropolisSnapshot snapshot() const;                // pop, score, valves, funds, time
ToolApplyResult apply_tool(int tool_id, int x, int y);
CityIOResult save_city(const std::string &path);    // wraps sim_->saveFile()
CityIOResult load_city(const std::string &path);    // wraps sim_->loadFile()
```

## View key bindings (current)
```
Tools:  1=Query 2=Bulldoze 3=Road 4=Wire 5=Res 6=Com 7=Ind 8=CoalPwr 9=NucPwr
Cursor: Arrows=move  PgUp/PgDn=±8rows  Home=recenter(60,50)
Place:  Enter/Space=apply  Esc/q=cancel→Query
Speed:  p=pause/resume  -=slower  +=faster  (PAUSE/SLOW/MED/FAST/ULTRA)
Save:   F2=save  F3=load  Tab=cycle slot(1-3)  → saves/slotN.city
```

## Full controls reference
`docs/wibwobcity-gameplay.md`

## Guardrails
- NEVER write raw ANSI bytes (`\x1b[`) into a TDrawBuffer — use `putChar`/`putAttribute`/`moveStr`
- `micropolis_determinism` and `micropolis_no_ansi` tests must stay green
- Feature stays behind `open_micropolis_ascii` command

## Open questions / SPK05 work
- [ ] Workspace round-trip (Stage E) — register `micropolis_ascii` in window_type_registry, persist seed/speed/cam
- [ ] Game events panel (Stage F) — tap `ConsoleCallback::sendMessage` into a ring buffer, surface as scrolling log
- [ ] Debug overlay (Stage G) — `d` key shows tile ID, power status, land value at cursor
- [ ] Budget panel (Stage H) — `F4` shows tax/maintenance breakdown
- [ ] Threading: `tick()` called from TV timer callback — no issues seen, but worth noting
- [ ] Fire/police station full tile footprint ranges (currently just centre glyph `F`/`P`)
- [ ] `COMBASE`/`INDBASE` vs `COMCLR`/`INDCLR` distinction for empty zone centres

## Codex notes (2026-02-20, append-only)
- Current city generation is deterministic in MVP: `seed_` defaults to `1337` in `TMicropolisAsciiView`, and window init calls `initialize_new_city(seed_, 2)`.
- If map variety is desired, add either:
  - random seed per new Micropolis window, or
  - keep deterministic default and add a "new random city" command/key.
- Crash-log reminder for fish/zsh:
  - Correct: `WIBWOB_INSTANCE=12 ./build/app/test_pattern 2> /tmp/wibwob_micropolis_crash.log`
  - Wrong: redirecting to `/tmp/` (directory) causes shell error before app run.
- Multi-instance run hygiene:
  - If IPC socket conflict appears, set unique `WIBWOB_INSTANCE`.
  - Stale sockets can still happen after crash; cleanup/retry is expected.
- Stage-A/B implementation decisions locked:
  - Arrows move cursor; camera auto-pans at viewport edge.
  - Cursor stored in world coords.
  - Tool bridge should wrap `doTool(...)` (not `toolDown`) for structured result handling.
