# SPK01 — MicropolisCore Engine Review: Architecture, Game Mechanics & Integration Feasibility

## Status

Status: in-progress
GitHub issue: —
PR: —

## Purpose & Intent

**Goal**: Deep technical review of [SimHacker/MicropolisCore](https://github.com/SimHacker/MicropolisCore) — the open-source C++/WASM recreation of SimCity Classic (1989) — to assess feasibility and map out an integration path for building a custom city simulation with:

1. **Same game mechanics** as classic SimCity (zones, traffic, power, budget, disasters, scoring)
2. **Different graphics/sprites** — custom tile sets, ASCII art, or procedural rendering
3. **Possible integration INTO WibWob-DOS** as a Turbo Vision sub-app (text-native city sim)
4. **Possible web frontend** — SvelteKit, WebGL, or other modern web stack
5. **Modding potential** — extending/tweaking simulation rules, adding new zone types, custom disasters

This report is written to give Codex (and any future agent or human contributor) a **crystal-clear, code-grounded** understanding of how every subsystem works, where the rendering boundary sits, how to swap graphics, and what the realistic integration paths look like.

---

## Context: WibWob-DOS

WibWob-DOS is a **symbient operating system** — a text-native dual operating system built on [Turbo Vision](https://github.com/magiblot/tvision) (C++14/ncurses). Two intelligences (human + AI) coinhabit the same interface with identical capabilities. Key characteristics:

- **C++14 core** with Turbo Vision TUI framework (ncurses backend)
- **REST API + MCP** for programmatic control (FastAPI/Python sidecar)
- **Multi-instance architecture** with Unix socket IPC
- **Module system** for content packs (primers, prompts, art)
- **60+ menu commands**, generative art engines, text editors, ASCII art, animation
- **Browser-accessible** via ttyd PTY bridge
- **Command registry refactor** in progress — single source of truth for commands, parity enforcement
- **24-bit RGB colour**, Unicode throughout, 256-color terminal support

The planning canon uses epic/feature/story hierarchy with strict AC→Test traceability. See `.planning/README.md` for full conventions.

**Integration relevance**: WibWob-DOS's Turbo Vision architecture could host a city simulation as a sub-app with tile rendering mapped to text-mode glyphs, or the engine could run headless with a web frontend served alongside WibWob-DOS.

---

## 1. Repository Structure & Build System

### MicropolisCore Layout

```
MicropolisCore/
├── MicropolisEngine/          # C++ simulation core (THE ENGINE)
│   ├── src/
│   │   ├── micropolis.h       # ~2835 lines — THE monolithic class header
│   │   ├── micropolis.cpp     # Core sim loop, heat simulation
│   │   ├── simulate.cpp       # 16-phase simulation loop
│   │   ├── zone.cpp           # Residential/commercial/industrial zone logic
│   │   ├── traffic.cpp        # Traffic pathfinding & density
│   │   ├── power.cpp          # Power grid flood-fill
│   │   ├── budget.cpp         # Tax collection & funding allocation
│   │   ├── evaluate.cpp       # City score, problems, voting
│   │   ├── disasters.cpp      # Earthquakes, monsters, floods, meltdowns
│   │   ├── generate.cpp       # Terrain generation (rivers, trees, islands)
│   │   ├── sprite.cpp         # Moving objects (trains, helicopters, ships, monster)
│   │   ├── scan.cpp           # Pollution, crime, land value, population density scans
│   │   ├── connect.cpp        # Road/rail/wire auto-connection
│   │   ├── tool.cpp           # Player tools (bulldoze, zone, build)
│   │   ├── fileio.cpp         # .cty save/load (binary format)
│   │   ├── animate.cpp        # Tile animation sequencing
│   │   ├── message.cpp        # City advisor messages
│   │   ├── graph.cpp          # Historical data graphing
│   │   ├── update.cpp         # UI state push (funds, date, demands)
│   │   ├── random.cpp         # PRNG
│   │   ├── position.cpp/h     # Map position utility
│   │   ├── map_type.h         # Templated map storage (MapByte1/2/4, MapShort8)
│   │   ├── data_types.h       # Byte, Quad, UQuad typedefs
│   │   ├── tool.h             # Tool enums, ToolEffects, BuildingProperties
│   │   ├── callback.h         # Frontend callback interface (35+ virtual methods)
│   │   ├── frontendmessage.h  # Frontend message types
│   │   ├── text.h             # Message/string enums
│   │   ├── emscripten.cpp     # Embind WASM bindings (~1266 lines)
│   │   └── js_callback.h      # JSCallback wrapper for Embind
│   └── makefile               # Emscripten build
│
├── micropolis/                 # SvelteKit web application
│   ├── src/lib/
│   │   ├── MicropolisSimulator.ts   # WASM engine wrapper & tick loop
│   │   ├── micropolisStore.ts       # Svelte 5 runes reactive state
│   │   ├── ReactiveMicropolisCallback.ts  # Callback → runes bridge
│   │   ├── WebGLTileRenderer.ts     # WebGL2 tile renderer (primary)
│   │   ├── CanvasTileRenderer.ts    # Canvas 2D fallback
│   │   ├── WebGPUTileRenderer.ts    # WebGPU skeleton
│   │   ├── TileRenderer.ts         # Abstract renderer base
│   │   ├── TileView.svelte         # Map display component
│   │   ├── sprites.ts              # Sprite rendering
│   │   └── micropolisengine.js     # Compiled WASM module
│   ├── scripts/
│   │   ├── micropolis.js            # CLI tool for .cty analysis
│   │   └── constants.js            # Tile definitions, world constants
│   └── src/types/
│       └── micropolisengine.d.ts    # TypeScript declarations
│
├── resources/cities/           # Save files (.cty) including 8 scenarios
├── notes/                      # Design notes (SIMULATOR.txt, Tiles.txt, etc.)
├── documentation/              # Historical docs
└── Cursor/                     # Development notes
```

### Line Counts (Engine Only)

The C++ engine is ~22,649 lines across all `.cpp` and `.h` files. The single `Micropolis` class is the god object — it contains **all** simulation state and logic.

### Build

```bash
# WASM build (requires Emscripten SDK)
cd MicropolisEngine && make

# SvelteKit app
cd micropolis && npm install && npm run dev
```

---

## 2. The Micropolis Class — God Object Architecture

The entire simulation is a single C++ class: `Micropolis`. This is both a strength (easy to embed, clear API surface) and a challenge (~2835 lines of header, no separation of concerns).

### Key State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `map[WORLD_W][WORLD_H]` | `unsigned short*[120]` | The world map — 120×100 tiles, 16 bits each |
| `mop[WORLD_W][WORLD_H]` | `unsigned short*[120]` | Secondary overlay map |
| `totalFunds` | `Quad` (long) | Player's money |
| `cityTime` | `Quad` | Simulation time (1 unit ≈ 7.6 days) |
| `cityYear` / `cityMonth` | `Quad` | Calendar time |
| `resPop` / `comPop` / `indPop` | `short` | Zone populations |
| `totalPop` | `short` | `resPop/8 + comPop + indPop` |
| `resValve` / `comValve` / `indValve` | `short` | Growth demand valves (-2000..+2000 / -1500..+1500) |
| `cityTax` | `short` | Tax rate 0–20% |
| `cityScore` | `short` | Overall city rating 0–999 |
| `gameLevel` | `GameLevel` | Easy/Medium/Hard |
| `simSpeed` | `short` | 0 (paused) to 3+ |
| `scenario` | `Scenario` | Active scenario or SC_NONE |
| Overlay maps | `MapByte1/2/4`, `MapShort8` | Population density, traffic, pollution, crime, land value, power grid, fire/police coverage, rate of growth, terrain density |
| `resHist[240]` / `comHist[240]` / etc. | `short*` | Historical data arrays |
| `spriteList` | `SimSprite*` | Linked list of active sprites |

### Map Tile Format (16-bit)

Each tile in `map[][]` is a 16-bit value:

```
Bits 15-10: Status flags
Bits  9-0:  Tile index (0-1023)

Bit 15: PWRBIT   — Tile has power
Bit 14: CONDBIT  — Tile conducts electricity
Bit 13: BURNBIT  — Tile is flammable
Bit 12: BULLBIT  — Tile is bulldozable
Bit 11: ANIMBIT  — Tile is animated
Bit 10: ZONEBIT  — Tile is center of a zone
Bits 9-0: LOMASK — Tile character index (Tiles enum, 0-1023)
```

### Tile Index Ranges

| Range | Type | Size |
|-------|------|------|
| 0 | Dirt | 1×1 |
| 2–20 | Water & coast edges | 1×1 |
| 21–43 | Trees & woods | 1×1 |
| 44–47 | Rubble | 1×1 |
| 48–51 | Flood | 1×1 |
| 52 | Radioactive | 1×1 |
| 56–63 | Fire animation | 1×1 |
| 64–207 | Roads (base, low traffic, high traffic, intersections, bridges) | 1×1 |
| 208–222 | Power lines | 1×1 |
| 224–238 | Rail | 1×1 |
| 240–248 | Empty residential zone | 3×3 |
| 249–260 | Single-tile houses (12 variants by value) | 1×1 |
| 265–404 | Developed residential (16 variants: 4 pop × 4 value) | 3×3 |
| 405–413 | Hospital | 3×3 |
| 414–422 | Church | 3×3 |
| 423–611 | Commercial zones (empty + 20 variants) | 3×3 |
| 612–692 | Industrial zones (empty + 8 variants by pop/value) | 3×3 |
| 693–708 | Seaport | 4×4 |
| 709–744 | Airport | 6×6 |
| 745–760 | Coal power plant | 4×4 |
| 761–769 | Fire station | 3×3 |
| 770–778 | Police station | 3×3 |
| 779–810 | Stadium (empty + full) | 4×4 |
| 811–826 | Nuclear power plant | 4×4 |
| 827 | Lightning bolt (no power indicator) | 1×1 |
| 828–951 | Bridge animations, radar, fountain, industrial anims | 1×1 |
| 952–955 | Nuclear swirl animation | 1×1 |
| 956–1018 | Extended church variants (7 types) | 3×3 |
| **Total: 1024 tile indices** | | |

**Key insight for custom graphics**: You need a tile atlas with 1024 entries. Each tile is 16×16 pixels in the original. Multi-tile buildings occupy contiguous index ranges, with the center tile marked with ZONEBIT.

---

## 3. Simulation Loop — The 16-Phase Engine

The simulation runs in `simulate()` (simulate.cpp), cycling through 16 phases per game tick:

### Phase Breakdown

| Phase | Action | Frequency |
|-------|--------|-----------|
| 0 | Increment `cityTime`, update valves (every 2 cycles), clear census | Every tick |
| 1–8 | `mapScan()` — process 1/8th of the map per phase | Every tick |
| 9 | Monthly census (every 4 ticks), yearly census (every 48), tax collection (every 48) | Conditional |
| 10 | Decay traffic/growth maps, send advisor messages | Every tick (traffic every tick, growth every 5) |
| 11 | Power scan — flood-fill power connectivity | Speed-dependent |
| 12 | Pollution + terrain + land value scan | Speed-dependent |
| 13 | Crime scan | Speed-dependent |
| 14 | Population density scan | Speed-dependent |
| 15 | Fire analysis, disasters | Speed-dependent |

### Speed System

```
simSpeed 0: Paused (no simulation)
simSpeed 1: Skip 4 of every 5 frames
simSpeed 2: Skip 2 of every 3 frames
simSpeed 3: Every frame
```

Higher speeds also run scans more frequently via `speedPowerScan[]`, `speedCrimeScan[]` etc. tables.

### mapScan() — The Heart of Simulation

For each tile in the scanned range:
1. Skip DIRT tiles
2. **Fire tiles** → spread fire, possibly extinguish
3. **Flood tiles** → handle flooding
4. **Radioactive tiles** → random decay to dirt
5. **Road tiles** → count roads, deteriorate based on funding, update traffic display
6. **Rail tiles** → count rails, generate trains, deteriorate
7. **Zone tiles** (ZONEBIT set) → `doZone()` — the big dispatch:
   - Residential → `doResidential()`
   - Commercial → `doCommercial()`
   - Industrial → `doIndustrial()`
   - Hospital/Church → `doHospitalChurch()`
   - Special (power plants, stations, stadium, airport, seaport) → `doSpecialZone()`

---

## 4. Zone Growth Mechanics (Residential/Commercial/Industrial)

### Demand Valves

The core growth driver is `setValves()` which computes supply/demand for each zone type:

```
Employment = (com + ind) / (res / 8)
Migration  = normalizedResPop * (employment - 1)
Births     = normalizedResPop * 0.02
ProjectedResPop = normalizedResPop + migration + births
```

**Valve computation** (per tick):
- `resRatio` = projected / actual residential
- `comRatio` = projected / actual commercial (uses internal market + labor base)
- `indRatio` = projected / actual industrial (uses external market + labor base)
- Apply tax penalty from `taxTable[cityTax + gameLevel]`
- Valves are **clamped velocities**: `resValve += resRatio`, clamped to ±2000

**Growth caps**:
- `resCap` = true when no stadium → caps resValve at 0
- `comCap` = true when no airport → caps comValve at 0
- `indCap` = true when no seaport → caps indValve at 0

### Zone Processing (doResidential/doCommercial/doIndustrial)

Each zone type follows the same pattern:
1. Check power status
2. Count population
3. If powered AND valve positive AND traffic OK → try to grow (`doResIn`/`doComIn`/`doIndIn`)
4. If not → try to decline (`doResOut`/`doComOut`/`doIndOut`)
5. Growth/decline changes the tile to a different population/value variant
6. Traffic is generated via `makeTraffic()` pathfinding

### Traffic System

`makeTraffic(x, y, destZone)` does a **bounded random walk** (max 30 tiles) from a zone's perimeter road, looking for a destination zone type. Each step increases traffic density on the road tile. Returns:
- `1` if destination found (zone gets traffic bonus)
- `0` if not found (zone penalized)
- `-1` if no road connection at all (severe penalty)

---

## 5. Budget & Economy

### Tax Collection (every 48 ticks = 1 game year)

```
taxFund = (totalPop × landValueAverage / 120) × cityTax × FLevels[gameLevel]
roadFund = (roadTotal + railTotal×2) × RLevels[gameLevel]
policeFund = policeStationPop × 100
fireFund = fireStationPop × 100
cashFlow = taxFund - (policeFund + fireFund + roadFund)
```

Game level multipliers:
- **Easy**: Roads 0.7×, Taxes 1.4×
- **Medium**: Roads 0.9×, Taxes 1.2×
- **Hard**: Roads 1.2×, Taxes 0.8×

### Funding Effects

When `roadSpend < roadFund`, road/rail tiles deteriorate faster. Similarly for police (crime increases) and fire (fires burn longer). Effect is proportional: `roadEffect = MAX_ROAD_EFFECT × roadSpend / roadFund`.

---

## 6. Power Grid

`doPowerScan()` uses a **stack-based flood fill** starting from power plant zones:
1. Push all power plant positions onto stack
2. Pop position, mark as powered (PWRBIT)
3. Check all 4 neighbours — if they have CONDBIT (roads, rails, wires, zones), push them
4. Continue until stack empty

Zones without PWRBIT are unpowered — they don't grow and some special buildings don't function.

---

## 7. Overlay Map Scans

### Pollution Scan
- Sources: traffic density, industrial zones, seaports, airports, power plants, fire
- Radioactive tiles add heavy pollution
- Smoothed across the map
- Affects land value negatively

### Crime Scan
- Base: `landValueMap` inverted (low land value → high crime base)
- Modified by population density
- Reduced by police station coverage (`policeStationEffectMap`)
- Highest crime location tracked in `crimeMaxX/Y`

### Land Value Scan
- Base: `terrainDensityMap` (trees, water = good)
- Modified by distance from city center
- Reduced by pollution and crime
- Higher land value → better zone development

### Population Density Scan
- Aggregated from zone populations
- Smoothed into `populationDensityMap`

---

## 8. Disasters

| Disaster | Trigger | Effect |
|----------|---------|--------|
| Fire | Random, fire bombs | Spreads to burnable neighbours, creates rubble |
| Earthquake | Scenario or random | Shakes map, starts fires, sends message |
| Monster | Scenario or random | Sprite walks across map destroying buildings |
| Tornado | Random | Sprite moves destroying buildings |
| Flood | Scenario or random | Water tiles spread from coast |
| Nuclear meltdown | Random (probability based on game level) | Massive fire + radioactive contamination |
| Fire bombs | Hamburg scenario | Multiple simultaneous fires |

Meltdown probability: `1/30000` (easy), `1/20000` (medium), `1/10000` (hard).

---

## 9. Sprites

Sprites are independent moving objects on the map. Stored as a linked list of `SimSprite`:

| Type | Behaviour |
|------|-----------|
| Train | Follows rail tracks |
| Helicopter | Flies to disasters/crime |
| Airplane | Circles airport |
| Ship | Navigates water tiles |
| Monster | Destructive path across city |
| Tornado | Destructive random movement |
| Explosion | Brief animation then gone |
| Bus | (Unused in current build) |

Sprites have position, direction, speed, destination, animation frame. They are processed in `moveObjects()` each tick. Sprite-sprite collision can cause crashes/explosions.

---

## 10. Scenarios

8 classic scenarios loaded from `.cty` files:

| Scenario | City | Year | Disaster | Win Condition |
|----------|------|------|----------|---------------|
| Dullsville | Dullsville | — | Boredom | Score > threshold after 30 years |
| San Francisco | SF | 1906 | Earthquake | Rebuild score after 5 years |
| Hamburg | Hamburg | 1944 | Fire bombs | Survive fire bombing, score after 5 years |
| Bern | Bern | — | Traffic | Fix traffic, score after 10 years |
| Tokyo | Tokyo | 1961 | Monster | Survive monster, score after 5 years |
| Detroit | Detroit | — | Crime | Fix crime, score after 10 years |
| Boston | Boston | 2010 | Nuclear meltdown | Survive meltdown, score after 5 years |
| Rio | Rio | — | Flooding | Survive floods, score after 10 years |

---

## 11. Save File Format (.cty)

Binary format, 27,120 bytes:

```
Offset   Size    Content
0x0000   480     Residential history (240 shorts)
0x01E0   480     Commercial history
0x03C0   480     Industrial history
0x05A0   480     Crime history
0x0780   480     Pollution history
0x0960   480     Money history
0x0B40   240     Miscellaneous history (120 shorts — encodes game state)
0x0C30   24000   Map data (120 × 100 × 2 bytes, little-endian)
```

Misc history encodes: external market, populations, valves, crime/pollution ramps, game level, city score, cash, settings (auto-bulldoze, auto-budget, tax rate, speed, funding percentages).

---

## 12. Frontend Architecture — The Callback Interface

The engine communicates with **any** frontend via a `Callback` abstract class with **35 virtual methods**:

### Key Callbacks

| Callback | Fired When |
|----------|------------|
| `updateMap()` | Map tiles changed |
| `updateFunds(totalFunds)` | Money changed |
| `updateDate(year, month)` | Time advanced |
| `updateDemand(r, c, i)` | RCI demand changed |
| `sendMessage(index, x, y, picture, important)` | Advisor message |
| `updateBudget()` | Budget needs display |
| `updateEvaluation()` | City evaluation changed |
| `updateHistory()` | Historical graph data changed |
| `didLoadCity(filename)` | City loaded |
| `didGenerateMap(seed)` | New map generated |
| `makeSound(channel, sound, x, y)` | Sound effect triggered |
| `startEarthquake(strength)` | Earthquake started |
| `showBudgetAndWait()` | Budget window should show |
| `showZoneStatus(...)` | Zone query info |
| `didTool(name, x, y)` | Tool applied |
| `autoGoto(x, y, message)` | Camera should jump to location |
| `simulateRobots()` | External robot/AI hook |

### WASM Binding (Embind)

`emscripten.cpp` exposes the full API to JavaScript:
- All enums (tools, tiles, sprites, scenarios, messages, etc.)
- `Micropolis` class with simulation control, state access, gameplay methods
- `JSCallback` subclass that delegates to a JavaScript object
- Direct memory access to map data via `getMapAddress()` / `HEAPU16`
- Map types (`MapByte1/2/4`, `MapShort8`) exposed for overlay access

### Reactive Bridge (Svelte 5)

```
C++ Micropolis (WASM)  →  Embind JSCallback  →  ReactiveMicropolisCallback
       →  $state / $derived runes  →  Svelte 5 components  →  WebGL renderer
```

`MicropolisSimulator.ts` manages:
- WASM module loading (singleton pattern)
- Tick loop via `setInterval` (1–120 fps based on speed)
- Direct `HEAPU16` subarray access to map data (zero-copy)
- Multi-view support (multiple renderers sharing one engine)

`micropolisStore.ts` provides Svelte 5 reactive state:
- All game state as `$state` runes
- Actions (doTool, loadCity, generateNewCity, setSpeed, etc.)
- Internal callback updaters prefixed with `_`

---

## 13. Rendering Architecture

### WebGL2 Tile Renderer (Gold Standard)

`WebGLTileRenderer.ts` implements GPU-accelerated tile rendering:
- Tile atlas loaded as WebGL texture(s) — supports multiple tile set images
- Map data uploaded as texture (120×100 `Uint16Array`)
- Fragment shader looks up tile index → tile atlas position
- Supports pan/zoom with mouse drag and scroll
- Tile rotation layer for visual effects
- MOP (overlay) data rendered as second layer

### Tile Set Requirements

The renderer expects a tile atlas image:
- 16 pixels wide
- 1024 × 16 pixels tall (or tiled equivalently)
- Each 16×16 block = one tile indexed 0–1023
- Tile 0 = dirt, tile 2 = water, etc. per the `Tiles` enum

### Canvas 2D Fallback

`CanvasTileRenderer.ts` — simpler but slower, noted as "needs rewrite" in README.

---

## 14. CLI Tool

`micropolis/scripts/micropolis.js` provides command-line access:
- `city info` — display city metadata
- `city analyze` — detailed analysis with JSON output
- `city edit` — modify funds, tax, year
- `city patch-scenario` — apply engine runtime values
- `city export` — JSON export with optional map data
- `visualize ascii/emoji` — terminal visualization with viewport control

---

## 15. Licensing

- **Code**: GPL-3.0 (EA/Maxis original + OLPC modifications)
- **Name**: "Micropolis" is trademarked by Micropolis GmbH, licensed for use under the [Micropolis Public Name License](https://github.com/SimHacker/MicropolisCore/blob/main/MicropolisPublicNameLicense.md)
- **SimCity**: Cannot use the name "SimCity" or EA trademarks
- **For a custom clone**: Must not call it SimCity. Can use Micropolis code under GPL-3. Any derivative must also be GPL-3.

---

## 16. Integration Analysis — Paths to a Custom City Sim

### Option A: WASM Engine + Custom Web Frontend

**Architecture**: Use MicropolisCore's WASM engine as-is. Build custom web UI.

| Aspect | Details |
|--------|---------|
| Engine | Compile C++ → WASM with Emscripten (already works) |
| API | Full Embind API already exposed — tools, state, callbacks |
| Graphics | Replace tile atlas PNG with custom artwork |
| UI | Custom Svelte/React/vanilla JS frontend |
| Rendering | Reuse WebGLTileRenderer or write custom Canvas/WebGL/WebGPU renderer |
| Effort | **Low-medium** — engine is production-ready, just swap graphics and UI |

**Pros**: Fastest path. Engine is battle-tested. Direct memory access for rendering.
**Cons**: GPL-3 viral license. Must ship source of any modifications.

### Option B: WASM Engine + WibWob-DOS TUI Frontend

**Architecture**: Run WASM engine in Node.js (headless), bridge to WibWob-DOS C++ via IPC.

```
MicropolisEngine (WASM/Node.js)
    ↕ JSON-RPC over Unix socket
WibWob-DOS (C++/Turbo Vision)
    → ASCII tile renderer in TView
```

| Aspect | Details |
|--------|---------|
| Engine | Run in Node.js as headless simulation |
| Bridge | IPC via WibWob-DOS Unix socket protocol |
| Rendering | Map tile → ASCII glyph/colour lookup table |
| Map size | 120×100 tiles — fits in a scrollable TView window |
| Interaction | Cursor-based tool selection, keyboard/mouse tile placement |
| Effort | **Medium-high** — need IPC bridge, ASCII renderer, tool UI |

**ASCII Rendering Strategy** (per the Turbo Vision ANSI guardrail):
1. Engine sends map data as flat array over IPC
2. TUI receives tile indices
3. Lookup table: tile index → (glyph, fg_color, bg_color)
4. Render via `TDrawBuffer::putChar`/`putAttribute` — **never raw ANSI**

Example tile mappings:
```
DIRT       → '.' gray on black
WATER      → '~' blue on dark_blue
WOODS      → '♣' green on dark_green
ROAD       → '═' gray on dark_gray
RAIL       → '╬' brown on dark_gray
POWER      → '⚡' yellow on black
FIRE       → '🔥' red on orange (animated)
RES_LOW    → '▪' green on black
RES_HIGH   → '█' bright_green on green
COM_LOW    → '▪' blue on black
COM_HIGH   → '█' bright_blue on blue
IND_LOW    → '▪' yellow on black
IND_HIGH   → '█' bright_yellow on yellow
POWERPLANT → '⚙' white on red
POLICE     → 'P' white on blue
FIRE_STN   → 'F' white on red
```

### Option C: Native C++ Engine in WibWob-DOS

**Architecture**: Compile MicropolisEngine C++ directly into WibWob-DOS binary.

| Aspect | Details |
|--------|---------|
| Engine | Strip Emscripten dependencies, compile as native C++ library |
| Integration | Link into WibWob-DOS CMake build |
| Rendering | Same ASCII strategy as Option B, but in-process |
| Callback | Implement `Callback` subclass that drives TView updates |
| Effort | **Medium** — need to decouple from Emscripten, but engine is clean C++ |

**Emscripten decoupling needed**:
- `micropolis.h` includes `<emscripten.h>` and `<emscripten/bind.h>`
- `Callback` class uses `emscripten::val`
- `emscripten.cpp` is the binding layer (can be excluded)
- Solution: `#ifdef __EMSCRIPTEN__` guards, or fork with native callback interface

**This is the most attractive option for deep WibWob-DOS integration.** The engine is ~22K lines of straightforward C++ with minimal dependencies beyond Emscripten.

### Option D: Headless Engine + Dual Frontend (Web + TUI)

**Architecture**: Run engine as a service, serve both web and TUI clients.

```
MicropolisEngine (WASM or native)
    ↕ WebSocket / REST API
    ├── Web frontend (SvelteKit + WebGL)
    └── WibWob-DOS TUI client (via IPC)
```

**Pros**: Maximum flexibility, multiplayer-ready.
**Cons**: Most complex architecture. Need state sync protocol.

---

## 17. Custom Graphics / Sprite Swapping

### What You Need to Replace

1. **Tile atlas** — 1024 tiles, 16×16 pixels each (or whatever size your renderer uses)
2. **Sprite images** — 8 sprite types with animation frames
3. **Optionally**: Mini-map overlay colours

### What You Do NOT Need to Change

- The simulation engine
- Tile index assignments (the `Tiles` enum)
- Zone size/shape logic
- Any game mechanics

### Tile Atlas Structure

The atlas is a vertical strip image, 16px wide, 16384px tall (1024 × 16):
- Tile N occupies pixels (0, N×16) to (16, N×16+16)
- Loaded as a WebGL texture in the web renderer

**For custom art**: Create a new PNG with your tiles at the same indices. The engine doesn't care what the pixels look like — it only works with tile indices.

**For ASCII mode**: No atlas needed. Map tile index → (glyph, fg, bg) via lookup table.

---

## 18. Modding Potential

### Easy Mods (No Engine Changes)

| Mod | How |
|-----|-----|
| Custom graphics | Replace tile atlas PNG |
| Custom scenarios | Create new .cty files with the CLI tool |
| Tax table tweaks | Modify `taxTable[]` in `simulate.cpp` |
| Building costs | Modify tool cost constants in `tool.cpp` |
| Game level multipliers | Modify `RLevels[]`, `FLevels[]` in `simulate.cpp` |
| Disaster probabilities | Modify `meltdownTable[]` etc. |

### Medium Mods (Engine Changes)

| Mod | Complexity |
|-----|-----------|
| New zone types | Add tile ranges, zone processing functions, modify `doZone()` dispatch |
| Map size changes | Modify `WORLD_W`/`WORLD_H` constants, recompile everything |
| New building types | Add `BuildingProperties`, new tool enum, update `doTool()` |
| New overlay maps | Add `Map<>` instances, new scan functions |
| Traffic model changes | Modify `tryDrive()` pathfinding, increase `MAX_TRAFFIC_DISTANCE` |

### Hard Mods

| Mod | Complexity |
|-----|-----------|
| 3D terrain | Fundamental map structure change |
| Variable zone sizes | Would require zone registry system |
| Multiplayer | Need state sync, turn system, conflict resolution |
| New tile format (>1024 tiles) | Change `LOMASK` from 10 bits, update all tile checks |

---

## 19. Key Technical Details for Integration

### Direct Memory Access Pattern

The web frontend accesses map data via **zero-copy shared memory**:

```typescript
const mapStartAddress = micropolis.getMapAddress() / 2;  // byte→Uint16 offset
const mapData = engine.HEAPU16.subarray(mapStartAddress, mapStartAddress + 120*100);
// mapData[y * 120 + x] gives the raw 16-bit tile value
// tile = mapData[i] & 0x3FF  (LOMASK)
// flags = mapData[i] & 0xFC00
```

For native C++ integration, the map is `map[x][y]` (column-major).

### Callback Threading

The engine is **single-threaded**. All callbacks fire synchronously during `simTick()`. The tick loop in the web frontend uses `setInterval()` — no web workers needed.

### Determinism

The engine uses its own PRNG (`nextRandom`), seeded via `seedRandom(int)`. Given the same seed and same inputs, simulation should be deterministic. This enables:
- Replay systems
- Multiplayer sync
- Automated testing

### City Time Units

```
1 cityTime unit = 7.6 days
4 units = 1 month
48 units = 1 year
16 simulation passes = 1 cityTime unit
```

---

## 20. MOOLLM & AI Integration Context

MicropolisCore is designed to work with [MOOLLM](https://github.com/SimHacker/moollm) — an AI agent orchestration system. Key concepts:

- **AI tutors** with distinct personalities (Mayor's Advisor, Urban Planner, Economist, etc.)
- **Schema mechanism** — agents discover causal relationships (e.g., "industrial near residential → pollution complaints")
- **Speed-of-light execution** — multiple AI agent turns inside a single LLM call
- **GitHub-as-MMORPG** — cities as git repos, branches as timelines, PRs as decisions

This is relevant for WibWob-DOS because:
1. WibWob-DOS already has an **AI chat agent** (Wib & Wob via Claude Code SDK)
2. The agent could act as a city advisor, analyzing simulation state via IPC/API
3. Symbient model aligns with MOOLLM's "users and agents on common ground" philosophy

---

## 21. Recommendations

### Immediate Next Steps

1. **Spike: Native C++ compilation** — Strip Emscripten, compile MicropolisEngine as a static library against WibWob-DOS's CMake. Target: "does it build?"
2. **Spike: ASCII tile renderer** — Prototype a 120×100 scrollable TView window with hardcoded tile→glyph mapping. Use `TScroller` or custom `TView`.
3. **Spike: Callback→TView bridge** — Implement a `Callback` subclass that calls `TView::drawView()` on map updates and updates status bar with funds/date/pop.

### Architecture Recommendation

**Option C (Native C++ in WibWob-DOS)** is the strongest path because:
- No IPC overhead, no Node.js dependency
- Engine is clean C++ with minimal deps (just stdlib)
- Callback interface is a perfect fit for Turbo Vision event model
- WibWob-DOS's module system could load custom tile→glyph maps
- ASCII rendering through cell model aligns with existing ANSI guardrails

**Option A (Web frontend)** as a parallel track is low-effort — the existing SvelteKit app works today, just needs custom tile art.

### GPL-3 Consideration

Any code that links MicropolisEngine must be GPL-3. Since WibWob-DOS's repo is already on GitHub, this is likely acceptable, but verify license compatibility with the existing codebase.

---

## 22. Reference Links

| Resource | URL |
|----------|-----|
| MicropolisCore repo | https://github.com/SimHacker/MicropolisCore |
| Live demo | https://micropolisweb.com |
| Doxygen docs | https://micropolisweb.com/doc |
| Original Micropolis repo | https://github.com/SimHacker/micropolis |
| MOOLLM | https://github.com/SimHacker/moollm |
| Micropolis skill | https://github.com/SimHacker/moollm/tree/main/skills/micropolis |
| gym-city (RL agents) | https://github.com/smearle/gym-city |
| GPL-3 License | https://github.com/SimHacker/MicropolisCore/blob/main/LICENSE |
| Name License | https://github.com/SimHacker/MicropolisCore/blob/main/MicropolisPublicNameLicense.md |
| WibWob-DOS | This repo |

---

## Appendix A: Complete Source File Index (Engine)

| File | Lines | Purpose |
|------|-------|---------|
| `micropolis.h` | 2835 | Master header — Micropolis class, all enums, all constants |
| `simulate.cpp` | ~650 | 16-phase sim loop, valves, census, tax, mapScan, fire/road/zone dispatch |
| `zone.cpp` | ~1040 | Residential/commercial/industrial zone growth/decline |
| `traffic.cpp` | ~520 | Traffic pathfinding, density updates |
| `tool.cpp` | ~800 | Player tools, building placement, bulldozing |
| `sprite.cpp` | ~1100 | All 8 sprite types, movement, collision |
| `scan.cpp` | ~600 | Pollution, crime, land value, pop density, terrain scans |
| `power.cpp` | ~200 | Power grid flood fill |
| `budget.cpp` | ~200 | Budget calculation and display |
| `evaluate.cpp` | ~400 | City score, problems, voting |
| `disasters.cpp` | ~300 | Earthquake, monster, flood, meltdown |
| `generate.cpp` | ~600 | Terrain generation |
| `fileio.cpp` | ~300 | .cty save/load |
| `connect.cpp` | ~500 | Road/rail/wire auto-connection |
| `animate.cpp` | ~100 | Tile animation tables |
| `message.cpp` | ~300 | Advisor messages |
| `graph.cpp` | ~200 | Historical graph data |
| `update.cpp` | ~200 | UI state push |
| `emscripten.cpp` | 1266 | WASM bindings |
| `callback.cpp` | ~400 | ConsoleCallback implementation |
| Others | ~600 | position, random, utilities, allocate, initialize, frontendmessage |

## Appendix B: Callback Interface — Complete Method List

```cpp
// Game lifecycle
autoGoto(x, y, message)
didGenerateMap(seed)
didLoadCity(filename)
didLoadScenario(name, fname)
didLoseGame()
didSaveCity(filename)
didTool(name, x, y)
didWinGame()
didntLoadCity(filename)
didntSaveCity(filename)
newGame()
saveCityAs(filename)
startGame()
startScenario(scenario)

// State updates
updateBudget()
updateCityName(cityName)
updateDate(cityYear, cityMonth)
updateDemand(r, c, i)
updateEvaluation()
updateFunds(totalFunds)
updateGameLevel(gameLevel)
updateHistory()
updateMap()
updateOptions()
updatePasses(passes)
updatePaused(simPaused)
updateSpeed(speed)
updateTaxRate(cityTax)

// Events
makeSound(channel, sound, x, y)
sendMessage(messageIndex, x, y, picture, important)
showBudgetAndWait()
showZoneStatus(cat, pop, val, cri, pol, gro, x, y)
startEarthquake(strength)
simulateRobots()
simulateChurch(posX, posY, churchNumber)
```

## Appendix C: Tool Enum — Complete Player Tools

```cpp
TOOL_RESIDENTIAL      // 3×3 residential zone ($100)
TOOL_COMMERCIAL       // 3×3 commercial zone ($100)
TOOL_INDUSTRIAL       // 3×3 industrial zone ($100)
TOOL_FIRESTATION      // 3×3 fire station ($500)
TOOL_POLICESTATION    // 3×3 police station ($500)
TOOL_QUERY            // Inspect tile (free)
TOOL_WIRE             // Power line ($5/tile)
TOOL_BULLDOZER        // Clear tile ($1)
TOOL_RAILROAD         // Rail ($20/tile)
TOOL_ROAD             // Road ($10/tile)
TOOL_STADIUM          // 4×4 stadium ($5000)
TOOL_PARK             // 1×1 park ($10)
TOOL_SEAPORT          // 4×4 seaport ($3000)
TOOL_COALPOWER        // 4×4 coal plant ($3000)
TOOL_NUCLEARPOWER     // 4×4 nuclear plant ($5000)
TOOL_AIRPORT          // 6×6 airport ($10000)
TOOL_NETWORK          // Network tile ($100) [unused in classic]
TOOL_WATER            // Water tile ($100) [terrain tool]
TOOL_LAND             // Land tile ($100) [terrain tool]
TOOL_FOREST           // Forest tile ($100) [terrain tool]
```
