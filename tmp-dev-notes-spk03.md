# SPK03 Dev Notes — Engine Grok Pass
_pi review of MicropolisCore internals vs the Codex plan. Temp file — fold into SPK03 brief or burn when done._

---

## TL;DR

The Codex plan is directionally correct and the engine internals support it well. **One hard blocker** before any native build will compile: the engine headers are tightly coupled to Emscripten and the existing Makefile builds WASM only — there is no native static-library path at all. Everything else (map access, tile enum, status fields, zone tier logic) is clean and matches the plan exactly.

---

## What's Solid (Plan Confirmed Against Source)

### Map access
- Grid: `unsigned short *map[WORLD_W][WORLD_H]` — `WORLD_W=120`, `WORLD_H=100`
- Access pattern: `unsigned short cell = map[x][y]`
- Tile id: `MapTile tile = cell & LOMASK` where `LOMASK = 0x03FF` (lower 10 bits) — defined in `tool.h`

### Bitmasks (all in `tool.h`)
```
PWRBIT  = 0x8000  // tile has power
CONDBIT = 0x4000  // tile conducts electricity
BURNBIT = 0x2000  // tile can burn
BULLBIT = 0x1000  // tile is bulldozable
ANIMBIT = 0x0800  // tile is animated
ZONEBIT = 0x0400  // tile is centre of its zone
LOMASK  = 0x03FF  // tile id mask
```
- `(cell & PWRBIT) != 0` = powered → use for the "powered" visual variant in theme files
- `(cell & ZONEBIT) != 0` = zone centre → where to draw R/C/I labels

### Tile enum (in `micropolis.h`) — key ranges for v0 lookup table
| Range | Meaning |
|---|---|
| 0 | DIRT (clear) |
| 2–20 | Water (RIVER, REDGE, CHANNEL, edges) |
| 21–43 | Trees/woods |
| 44–47 | Rubble |
| 48–51 | Flood |
| 52 | Radtile |
| 56–63 | Fire (animated, 8 frames) |
| 64–206 | Roads + bridges + traffic variants |
| 207–239 | Rail |
| 240–248 | Residential — RESBASE=240, **FREEZ=244** (empty res zone centre) |
| 249–421 | Residential developed (tiers grow from 249 upward) |
| 405–413 | Hospital (centre = HOSPITAL=409) |
| 423–431 | Commercial — COMBASE=423 |
| 612–... | Industrial — INDBASE=612 |
| 750–760 | Coal power plant (POWERPLANT=750) |
| 765–... | Fire station (FIRESTATION=765) |
| 770–774 | Police station (POLICESTATION=774) |
| up to 826 | LASTZONE |

### Zone development / tier logic
- `getResZonePop(MapTile)` exists on `Micropolis` — returns current pop for a res zone tile
- Growth driven by `resValve`/`comValve`/`indValve` (demand), land value, traffic access, power
- `FREEZ=244` = empty/undeveloped residential centre (the "tiny house" state)
- Tiles above FREEZ in the residential range = progressively denser; can read visual tier from tile distance from RESBASE

### Status fields (direct member access, no callbacks needed)
```cpp
sim->totalPop       // total city pop
sim->cityPop        // computed city pop (Quad)
sim->resValve       // R demand (-1500 to +2000 ish)
sim->comValve       // C demand
sim->indValve       // I demand
sim->cityScore      // 0–1000
sim->cityTax        // %
sim->cityYear       // Quad
sim->cityMonth      // Quad
sim->cityTime       // raw tick counter
sim->resZonePop     // number of res zones
sim->comZonePop     // number of com zones
sim->indZonePop     // number of ind zones
```
All pollable directly every frame — **no callback system needed for Stage 0 or Stage 1.**

### Engine entry points
```cpp
Micropolis *sim = new Micropolis();
sim->init();
sim->initGame();          // sets up fresh city
sim->setSpeed(1);         // 0=pause, 1=slow, 2=med, 3=fast
sim->simTick();           // advance one tick (call from game loop)
// or: sim->simLoop(true) for a full sim pass
```

---

## Hard Blocker — Emscripten Coupling

**The engine was built exclusively for WASM/browser. There is no native build path.**

Problems:
1. `micropolis.h` directly `#include`s `<emscripten.h>` and `<emscripten/bind.h>`
2. `callback.h` uses `emscripten::val` as a parameter in **every single virtual method** of `Callback`
3. `callback.cpp` also `#include`s `<emscripten.h>`
4. The Makefile targets only `.wasm` / `.js` / `.html` — no `-o libmicropolis.a` target exists

This means: **the engine will not compile with a standard `g++`/`clang++` without patching or shimming.**

### Recommended fix: thin compat shim (do NOT patch upstream source)

Create `src/micropolis/emscripten_native_compat.h` in our tree:
```cpp
#pragma once
// Stub emscripten types for native (non-WASM) builds.
// Include this before any MicropolisEngine headers in native builds.
#ifndef EMSCRIPTEN
  #include <string>
  namespace emscripten { struct val { val() {} }; }
  #define EM_ASM(code)
  #define EMSCRIPTEN_KEEPALIVE
#endif
```

Then in CMakeLists.txt, inject this header first via `-include emscripten_native_compat.h` (GCC/Clang forced-include flag).

This keeps the engine source untouched (no upstream patch = no merge conflict debt).

### Callback strategy for MVP
- For Stage 0–2: **skip the Callback vtable entirely**. Poll `map[x][y]` and status fields directly. Zero events needed.
- For Stage 3+ (interactions): implement `WibWobCallback : public Callback` with stub `emscripten::val` params, pushing events to a `std::queue<EngineEvent>` that `TMicropolisView` drains each frame.

---

## Build Integration — What Needs Writing

The engine has no `CMakeLists.txt`. We need to write one. Key points:

- Compile all `.cpp` in `MicropolisEngine/src/` **except** `emscripten.cpp` (WASM-only)
- Output: static lib `libmicropolis.a`
- Inject compat header via `-include`
- Link into WibWob-DOS CMake target
- No external deps beyond stdlib — engine is self-contained

Rough sketch:
```cmake
# vendor/MicropolisCore/MicropolisEngine/CMakeLists.txt (new file)
file(GLOB_RECURSE MICROPOLIS_SRCS src/*.cpp)
list(FILTER MICROPOLIS_SRCS EXCLUDE REGEX "emscripten\\.cpp$")
add_library(micropolis STATIC ${MICROPOLIS_SRCS})
target_include_directories(micropolis PUBLIC src)
target_compile_options(micropolis PRIVATE
  -include ${CMAKE_SOURCE_DIR}/src/micropolis/emscripten_native_compat.h
)
```

Then in main `CMakeLists.txt`:
```cmake
add_subdirectory(vendor/MicropolisCore/MicropolisEngine)
target_link_libraries(wibwobdos PRIVATE micropolis)
```

---

## GPL Note (risk already flagged in SPK03)

GPL v3 applies to the engine source. Bundling the compiled binary in a distributed app requires:
- Shipping source or a written offer for it
- Keeping GPL notices intact
- Not applying additional restrictions

For a private/internal WibWob-DOS build this is fine. Matters if/when the app is distributed.

---

## Questions for Codex

### Q1 — Compat shim approach
> The `-include` forced-header trick is the cleanest no-upstream-patch strategy. Confirm this compiles cleanly in Docker (ARM64 Linux, GCC 12+). If `emscripten::val` is used in template-resolved code paths rather than just method signatures, the stub may need to be richer (e.g., forwarding constructors). Can you build a minimal test that includes `micropolis.h` via the shim and instantiates `Micropolis` without calling any sim methods?

### Q2 — NativeCallback design
> Every `Callback` virtual method takes `emscripten::val callbackVal` as its second param. For native use this param is meaningless. Should `WibWobCallback` just accept the stubbed `emscripten::val` and ignore it entirely, pushing events into a `std::queue<EngineEvent>` — or is there a cleaner re-abstraction that avoids the dead param in every signature?

### Q3 — CMakeLists.txt placement
> Should the new `CMakeLists.txt` live inside `vendor/MicropolisCore/MicropolisEngine/` (modifying the submodule working tree, not committed upstream) or should we keep all build glue in our own `src/micropolis/` shim layer with a standalone `add_library` call that lists source files by path? Preference is to keep the submodule dir untouched — confirm this is feasible with CMake's `add_library` + explicit source list without a `CMakeLists.txt` inside the submodule.

### Q4 — Deterministic hash for AC-01
> `map[x][y]` is `unsigned short` — `120 × 100 × 2 = 24,000 bytes`. Simplest hash: CRC32 or FNV-1a over the raw map array + 6 status shorts (totalPop, cityScore, resValve, comValve, indValve, cityTime). Is that sufficient for a deterministic replay test, or do sprite state arrays also need to be included? Where does sprite state live — on the `Micropolis` object or in a separate allocator?

### Q5 — Polling cadence vs dirty rects
> For Stage 0 we redraw the full visible viewport every TV paint cycle. At 120×100 that's 12,000 cells. At 60fps this is fine. But the TV `draw()` only runs when the view is invalidated. What's the right Turbo Vision pattern here — a `TTimer`/idle callback that calls `clearEvent` + `drawView()` on every tick, or drive invalidation from the sim thread posting a custom event to the TV event loop?

### Q6 — City save file format + test fixtures
> `fileio.cpp` handles `.cty` load/save. Are there bundled scenario `.cty` files in the submodule we can use as test fixtures for the deterministic hash test (fixed seed + known map state), or do we need to generate a map programmatically via `generateSomeCity()` / `generateNewCity()`?

### Q7 — Zone tier to visual level mapping
> The plan says `r1 r2 r3` style tier labels. The tile range 240–422 covers all residential. `FREEZ=244` is the empty zone centre. Can we derive tier (0–7 or similar) from `(tile - RESBASE) / N` where N is the tiles-per-tier, or is it irregular? Need the actual tier bucket boundaries — does `getResZonePop(tile)` map cleanly to display tiers, or do we need to cross-reference with `populationDensityMap`?

---

## Suggested Stage 0 Minimal File List

Files to create for the feasibility spike (no existing files modified except CMakeLists.txt):

```
src/micropolis/emscripten_native_compat.h   ← compat shim
src/micropolis/micropolis_bridge.h          ← thin C++ wrapper (init, tick, map read)
src/micropolis/micropolis_bridge.cpp
src/micropolis/wibwob_callback.h            ← NativeCallback impl
src/micropolis/wibwob_callback.cpp
src/views/micropolis_view.h                 ← TMicropolisView skeleton (TV TView subclass)
src/views/micropolis_view.cpp
tests/test_micropolis_determinism.cpp       ← AC-01 hash test
tests/test_micropolis_no_ansi.cpp           ← AC-02 ESC guard test
```
