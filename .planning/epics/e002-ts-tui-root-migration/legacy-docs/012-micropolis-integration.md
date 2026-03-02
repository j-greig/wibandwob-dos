# 012 — Micropolis (SimCity) Integration

> Developer handover for the WibWob-DOS TypeScript rebuild.
> Covers the embedded Micropolis (open-source SimCity) engine: architecture,
> ASCII tile rendering, tool palette, zone logic, the SIGBUS fix, memory
> model, determinism, and TS rebuild feasibility.

---

## 1. Overview

WibWob-DOS embeds **Micropolis** — the open-source SimCity Classic engine
originally released by Don Hopkins / Maxis. It runs as an in-process C++
library (not a subprocess), wrapped by a `MicropolisBridge` abstraction that
the Turbo Vision view consumes. The result is a fully playable city builder
inside a TUI window, rendered as coloured ASCII glyphs.

### Source map

| File | Role |
|------|------|
| `app/micropolis/micropolis_bridge.h` | Bridge API: snapshot, tick, apply_tool, save/load |
| `app/micropolis/micropolis_bridge.cpp` | Bridge implementation + SIGBUS fix (`create_zeroed_micropolis`) |
| `app/micropolis_ascii_view.h / .cpp` | Turbo Vision view: draw loop, camera, cursor, keyboard |
| `app/micropolis_tool_palette.cpp` | Side panel: tool list, funds, result display |
| `app/micropolis/compat/emscripten.h` | Shim replacing Emscripten APIs with no-ops for native builds |
| `app/micropolis/compat/emscripten/bind.h` | Empty header — satisfies `#include` in engine sources |
| `.planning/sparks/micropolis-sigbus-clearmap.md` | Post-mortem for the SIGBUS crash |

The engine sources themselves live in `vendor/MicropolisCore/` and are compiled
as part of the WibWob-DOS build. Key engine headers referenced by the bridge:
`micropolis.h`, `tool.h` (defines `EditingTool`, `ToolResult`, tile constants
like `ROADBASE`, `LOMASK`, `WORLD_W`, `WORLD_H`).

---

## 2. Engine Architecture

### 2.1 Micropolis engine internals

The original Micropolis engine is a monolithic C++ class (`Micropolis`) that
owns:

- **Map buffer** — a 120×100 grid of `short` values (`map[WORLD_W][WORLD_H]`).
  Each cell packs a tile ID (lower 10 bits, masked by `LOMASK`) plus flag bits
  (power, zone centre, animation).
- **Simulation state** — population, funds, score, demand valves (R/C/I),
  city time, disaster flags, tax rates, etc.
- **Callback system** — originally designed for Emscripten/JS interop. The
  engine calls `callback->*` for UI updates, sound, etc. On native builds we
  supply a `ConsoleCallback` no-op.
- **Tool system** — `doTool(EditingTool, x, y)` applies a tool (residential
  zone, road, bulldoze, etc.) and returns a `ToolResult` enum.
- **Tick loop** — `simTick()` advances one simulation step. The bridge wraps
  this with speed multipliers.

### 2.2 Emscripten compat shim

The engine was ported from its Emscripten/web build. To compile natively:

```
app/micropolis/compat/emscripten.h
```

Provides stub `emscripten::val`, `EM_ASM`, `EMSCRIPTEN_KEEPALIVE` so the
engine compiles without modification. The `bind.h` is an empty header
satisfying transitive includes.

### 2.3 MicropolisBridge

The bridge is the **only** interface the TUI code uses. It wraps `Micropolis*`
in a `unique_ptr` with a custom deleter and provides:

| Method | Purpose |
|--------|---------|
| `initialize_new_city(seed, speed)` | Calls `init()`, `setSpeed()`, `generateSomeCity()` |
| `tick(count)` | Runs `simTick()` N times |
| `cell_at(x,y)` / `tile_at(x,y)` | Raw cell (with flags) / tile ID (masked) |
| `glyph_for_tile(tile)` | Single-char ASCII representation |
| `glyph_pair_for_tile(tile)` | Two-char pair for wide-tile rendering |
| `snapshot()` | Returns `MicropolisSnapshot` with funds, pop, score, valves, time, map hash |
| `apply_tool(tool_id, x, y)` | Returns `ToolApplyResult` with code + message |
| `save_city(path)` / `load_city(path)` | Delegates to engine `saveFile`/`loadFile` |
| `render_ascii_excerpt(x,y,w,h)` | Bulk text export of a map region |
| `hash_map_bytes()` | FNV-1a hash of entire map buffer for change detection |

---

## 3. The SIGBUS Fix — Placement-New with Memset

### 3.1 The bug

Spawning a `micropolis_ascii` window caused an immediate **SIGBUS**
(`KERN_PROTECTION_FAILURE`) in `Micropolis::clearMap()` — 100% reproducible on
ARM64/Apple Silicon. The crash stack:

```
clearMap() → simInit() → init() → MicropolisBridge::initialize_new_city()
```

### 3.2 Root cause

The `Micropolis` class has a massive footprint (~hundreds of KB) with many
member pointers and arrays. When constructed normally (`new Micropolis()`),
the constructor does **not** zero-initialize all members. The `clearMap()`
function then writes to `map[][]` which may contain garbage pointers or
trigger pointer authentication failures on ARM64.

The crash hint — "Possible pointer authentication failure" — confirmed that
uninitialized callback/vtable pointers were being dereferenced or validated
by ARM's PAC mechanism before the map arrays were even touched.

### 3.3 The fix

```cpp
Micropolis *create_zeroed_micropolis() {
    void *storage = ::operator new(sizeof(Micropolis));
    std::memset(storage, 0, sizeof(Micropolis));   // ← zero ALL bytes first
    try {
        return new (storage) Micropolis();          // ← placement new
    } catch (...) {
        ::operator delete(storage);
        throw;
    }
}
```

**Key insight**: by `memset`-ing the raw storage to zero before placement-new,
every pointer, vtable slot, and array element starts as NULL/zero. The
constructor then overwrites what it knows about, but anything it **doesn't**
initialize is safely zeroed rather than containing stack/heap garbage.

The bridge also explicitly nullifies callback pointers after construction:

```cpp
sim_->callback = nullptr;
sim_->callbackData = nullptr;
sim_->userData = nullptr;
sim_->setCallback(new ConsoleCallback(), emscripten::val::null());
```

Corresponding custom deleter calls destructor explicitly then frees:

```cpp
void destroy_micropolis(Micropolis *sim) {
    sim->~Micropolis();
    ::operator delete(static_cast<void *>(sim));
}
```

### 3.4 Implications for TS rebuild

A TypeScript/WASM port of Micropolis would likely compile the engine to
WebAssembly (it already has an Emscripten build path). The SIGBUS issue is
specific to native ARM64 — WASM linear memory doesn't have pointer
authentication. However, the **zero-init discipline** should be preserved:
ensure the WASM heap region for the Micropolis instance is zeroed before
the constructor runs (Emscripten's `malloc` does this by default for `calloc`).

---

## 4. ASCII Tile Rendering

### 4.1 Glyph mapping

`glyph_pair_for_tile()` converts a 10-bit tile ID into a 2-character ASCII
pair. This is the heart of the visual representation:

| Tile range | Glyph | Colour | Meaning |
|------------|-------|--------|---------|
| `DIRT` (0) | `. ` | grey | Empty land |
| `RIVER`–`LASTRIVEDGE` | `~ ` | blue on blue (`0x1F`) | Water |
| `WOODS_LOW`–`WOODS_HIGH` | `" ` | green on green (`0x2F`) | Forest |
| `FIREBASE`–`LASTFIRE` | `* ` | white on red (`0x4E`) | Fire |
| `RUBBLE`–`LASTRUBBLE` | `: ` | dark grey | Rubble |
| `ROADBASE`–`LASTROAD` | `-`, `\|`, `+` | dark grey (`0x08`) | Roads (directional) |
| `RAILBASE`–`LASTRAIL` | `# ` | dark grey | Rail |
| `POWERBASE`–`LASTPOWER` | `w ` | yellow (`0x0B`) | Power lines |
| Residential zones (245–422) | `r1`/`r2`/`r3` | green tiers | Res density |
| Commercial zones (424–611) | `c1`/`c2`/`c3` | blue tiers | Com density |
| Industrial zones (613–826) | `i1`/`i2`/`i3` | brown/yellow tiers | Ind density |
| Zone bases (`FREEZ`, etc.) | `r.`/`c.`/`i.` | zone colour | Empty zone |
| Special buildings | `H`, `P`, `F`, `*` | magenta/cyan/red | Hospital/Police/Fire/Power |

### 4.2 Density tiers

Zone density is computed by `tier_from_distance()` — divides the tile range
into thirds and returns tier 1/2/3. Higher tiers get brighter colours:

- Tier 1: dim (dark green/blue/brown)
- Tier 2: medium (bright green/cyan/yellow)  
- Tier 3: bright (white/bright cyan/bright red)

### 4.3 Road direction detection

`road_glyph()` examines the tile's lower 4 bits (after normalizing with
`neutralized_road_tile()`) to determine orientation:

- Horizontal bridges/roads → `-`
- Vertical bridges/roads → `|`
- Intersections/everything else → `+`

### 4.4 Wide tile mode

When the view is wide enough (`size.x >= 2`), tiles are rendered as **2-cell
pairs** (e.g. `r2`, `c.`, `~ `). This doubles the effective resolution.
In narrow mode, only the first character of each pair is used.

### 4.5 Colour model

Colours use Turbo Vision's `TColorAttr` with DOS-style 8-bit attribute bytes
(high nibble = background, low nibble = foreground). The `color_for_glyph()`
function maps glyphs to attributes, with a special case: when the second
character of a pair is a density digit (`1`/`2`/`3`), the first character
(zone prefix `r`/`c`/`i`) determines the colour palette.

---

## 5. View Architecture

### 5.1 TMicropolisAsciiView

The main view (`TView` subclass) owns:

- `MicropolisBridge bridge_` — the simulation instance (member, not pointer)
- Camera position (`camX_`, `camY_`) — top-left corner of the viewport
- Cursor position (`curX_`, `curY_`) — world coordinates of the placement cursor
- Active tool ID, simulation speed, save slot, seed
- A Turbo Vision timer (120ms interval) driving the simulation

**Draw loop** (3 regions):
1. **Top bar** (row 0) — funds, date, population, score, R/C/I valves, speed, slot
2. **Map area** (rows 1 to H-2) — scrollable ASCII tile grid with cursor highlight
3. **Bottom bar** (last row) — active tool name, hotkey legend, tool result message

**Event handling**:
- Arrow keys → move cursor (with autopan when cursor nears viewport edge)
- Number keys 1–9 → select tool
- Enter/Space → apply tool at cursor
- `p`/`P` → toggle pause, `-`/`+` → adjust speed (5 levels: pause/slow/med/fast/ultra)
- F2/F3 → save/load city to slot, Tab → cycle save slot (1–3)
- Esc/`q` → reset to Query tool

**State management**:
- Timer starts when view becomes exposed (`sfExposed`), stops when hidden
- `advanceSim()` fires `kTicksPerFire[simSpeed_]` ticks per timer pulse
  (0/1/4/16/64 for pause through ultra)

### 5.2 TMicropolisToolPalette

A companion `TView` placed to the right of the map view inside the window.
Displays:
- Funds and date (inverse video header)
- 9 tool rows with hotkey, name, cost, and active highlight
- Tool result message
- Save slot info and key hints

Redraws on every `cmTimerExpired` broadcast (piggybacks on the map's timer).

### 5.3 TMicropolisAsciiWindow

A `TWindow` subclass that creates both views in `setup()`:
- Map view fills `interior` minus `kPaletteW` (16 columns) on the right
- Palette fills the remaining 16 columns

The window is tileable (`ofTileable`) and titled "WibWobCity".

---

## 6. Tool System

### 6.1 Tool IDs

Tool IDs match the engine's `EditingTool` enum but are duplicated as local
constants to avoid pulling engine headers into view code:

| ID | Constant | Name | Cost | Footprint |
|----|----------|------|------|-----------|
| 0 | `TOOL_RESIDENTIAL` | Res | $100 | 3×3 |
| 1 | `TOOL_COMMERCIAL` | Com | $100 | 3×3 |
| 2 | `TOOL_INDUSTRIAL` | Ind | $100 | 3×3 |
| 5 | `TOOL_QUERY` | Query | $0 | 1×1 |
| 6 | `TOOL_WIRE` | Wire | $5 | 1×1 |
| 7 | `TOOL_BULLDOZER` | Bulldoze | $1 | 1×1 |
| 9 | `TOOL_ROAD` | Road | $10 | 1×1 |
| 13 | `TOOL_COALPOWER` | CoalPwr | $3k | 4×4 |
| 14 | `TOOL_NUCLEARPOWER` | NucPwr | $5k | 4×4 |

### 6.2 Tool results

`doTool()` returns one of:
- `TOOLRESULT_OK` → "OK"
- `TOOLRESULT_FAILED` → "Failed"
- `TOOLRESULT_NEED_BULLDOZE` → "Bulldoze first"
- `TOOLRESULT_NO_MONEY` → "No funds"

Results display in both the bottom bar and the palette for 25 timer ticks
(~3 seconds at 120ms intervals).

---

## 7. Persistence

### 7.1 City save/load

Cities save to `saves/slot{1..3}.city` using the engine's native binary format
(`saveFile` / `loadFile`). The `saves/` directory is created on view
construction.

### 7.2 Workspace integration

The micropolis window participates in WibWob-DOS workspace save/load — the
window type is registered as `micropolis_ascii` and can be spawned via IPC:

```
cmd:create_window type=micropolis_ascii
```

City state (map data) is **not** serialized into the workspace JSON — only
window position/size. City data persists independently in save slots.

---

## 8. Determinism

### 8.1 Map hash

`snapshot()` includes a `map_hash` field — FNV-1a over the entire map buffer
plus population/score/valve/time values. This enables:
- Change detection (redraw only when hash changes)
- Replay verification (deterministic seeds should produce identical hashes)

### 8.2 Seeded generation

`initialize_new_city(seed, speed)` passes the seed to `generateSomeCity()`.
The default seed is 1337. Identical seeds produce identical starting maps
(the engine's terrain generator is deterministic given the same seed).

### 8.3 Simulation determinism

The Micropolis engine is **deterministic per tick** given identical starting
state. However, it uses global mutable state extensively (class members, not
function-local), so running multiple instances in the same process is safe
only because each `Micropolis` object owns its own `map[][]` buffer.

---

## 9. TS Rebuild Feasibility

### 9.1 Strategy: WASM module

The recommended approach for the TS TUI rebuild:

1. **Compile Micropolis to WASM** using Emscripten (the engine already has
   Emscripten support — that's where the compat shim came from).
2. **Create a TypeScript bridge** mirroring `MicropolisBridge` that calls
   into the WASM module via `@aspect-build/aspect` or raw `WebAssembly` API.
3. **Render to a blessed/ink grid** using the same glyph/colour mapping.

### 9.2 What to port vs. what to wrap

| Component | Approach |
|-----------|----------|
| Micropolis engine | WASM (compile, don't rewrite) |
| `MicropolisBridge` | TypeScript class calling WASM exports |
| `glyph_pair_for_tile()` | Port to TS (pure function, ~100 lines) |
| `color_for_glyph()` | Port to TS (pure function, ~50 lines) |
| Tool palette | Rewrite as TS TUI component |
| Camera/cursor logic | Port to TS (pure math, ~30 lines) |
| Timer/tick system | Use `setInterval` or TUI framework timer |

### 9.3 Risks

1. **WASM size** — the Micropolis engine is ~200KB of C++. WASM output will
   be larger. Consider lazy-loading the module only when the user opens the
   city window.
2. **Memory model** — WASM linear memory is contiguous; no SIGBUS risk. But
   the 120×100 map buffer + simulation state needs ~50KB+ of WASM heap.
3. **Callback overhead** — frequent JS↔WASM calls during `simTick()` can be
   slow. Batch ticks (as the current code does with `kTicksPerFire[]`) and
   only read state after the batch.
4. **Save format** — the engine's binary save format is platform-endian. If
   you want cross-platform save compatibility, serialize to a portable format
   or force little-endian in the WASM build.
5. **Missing tools** — the current integration exposes only 9 of ~20 available
   tools. The TS rebuild could expose more (stadium, seaport, airport, park,
   etc.) but each needs UI work.

### 9.4 Alternative: Pure TS city sim

If WASM complexity is too high for MVP, a simplified city simulator in pure
TypeScript (grid of zones, basic demand model, no disasters) could provide
the same TUI experience with ~500 lines of code. Defer Micropolis engine
integration to a later phase.

---

## 10. Key Patterns for the TS Developer

1. **Bridge pattern** — the view never touches `Micropolis*` directly. All
   access goes through `MicropolisBridge`. Maintain this in TS: the WASM
   module should be fully encapsulated behind a typed interface.

2. **Timer-driven simulation** — the view doesn't call `tick()` in a tight
   loop. It uses a periodic timer (120ms) and batches ticks per speed level.
   In TS, use the TUI framework's timer/interval mechanism.

3. **Snapshot pattern** — `snapshot()` returns an immutable struct with all
   display-relevant state. The view reads this once per draw cycle. This is
   a natural fit for React/Ink-style rendering.

4. **Glyph functions are pure** — `glyph_pair_for_tile()` and
   `color_for_glyph()` are stateless. Port them verbatim.

5. **Tool IDs are duplicated** — the view doesn't include engine headers.
   In TS, define a `ToolId` enum with the same values.
