# SPK02 — MicropolisCore Engine Megareport (Codex Deep Review)

## Status

Status: in-progress
GitHub issue: —
PR: —

## 1. Executive Summary

MicropolisCore is a modernized extraction of the original SimCity Classic simulation lineage, with a C++ engine compiled to WebAssembly and wrapped by a SvelteKit/WebGL frontend (`/tmp/MicropolisCore/README.md:3-6`, `/tmp/MicropolisCore/README.md:23-47`).

Lineage and intent:
- Original mechanics derive from SimCity (1989), with the open-source release path through Don Hopkins/OLPC (`/tmp/MicropolisCore/README.md:15-16`).
- The project explicitly positions itself as “Micropolis” (not “SimCity”) and documents naming/legal constraints (`/tmp/MicropolisCore/README.md:17-22`, `/tmp/MicropolisCore/MicropolisEngine/src/tool.h:21-39`).

Licensing reality:
- Engine sources are GPL-3-or-later with EA additional terms and name/trademark restrictions in file headers (`/tmp/MicropolisCore/MicropolisEngine/src/tool.h:9-39`).
- “Micropolis” name usage depends on Micropolis Public Name License noted in repo docs (`/tmp/MicropolisCore/README.md:21`).

Practical use boundary:
- You can build derivative engines/frontends if you comply with GPL obligations for distribution.
- You should not market or represent the derivative as EA SimCity; trademark/publicity rights are not granted (`/tmp/MicropolisCore/MicropolisEngine/src/tool.h:23-27`).
- For WibWob-DOS integration, native C++ reuse is technically straightforward but legally inherits GPL copyleft at distribution boundaries.

## 2. Repository Map

### 2.1 Top-Level Functional Layout

- `MicropolisEngine/src/`: simulation core, tools, save/load, bindings.
- `micropolis/src/lib/`: Svelte runtime bridge + renderers.
- `micropolis/scripts/`: CLI and constants.
- `resources/cities/`: canonical `.cty` scenarios/saves.
- `notes/`: algorithm, tile, format, roadmap notes.

Source: `/tmp/MicropolisCore/README.md:27-52`.

### 2.2 Engine File Inventory (LOC)

Engine totals: `22649` LOC across `.cpp/.h` (`/tmp/micro_engine_loc.txt`).

Key files:
- `micropolis.h` 2834
- `sprite.cpp` 2039
- `simulate.cpp` 1729
- `tool.cpp` 1617
- `micropolis.cpp` 1578
- `emscripten.cpp` 1265
- `zone.cpp` 1039
- `map.cpp` 1025
- `generate.cpp` 761
- `connect.cpp` 745
- `fileio.cpp` 676
- `scan.cpp` 600
- `evaluate.cpp` 573
- `traffic.cpp` 519
- `message.cpp` 477
- `utilities.cpp` 435
- `disasters.cpp` 418
- `graph.cpp` 399
- `budget.cpp` 352
- `map_type.h` 354

### 2.3 Frontend File Inventory (LOC)

Frontend/lib totals: `13248` LOC (`/tmp/micro_front_loc.txt`).

Key files:
- `micropolisengine.js` 7084 (generated wasm JS glue)
- `PieMenu.svelte` 1622
- `WebGLTileRenderer.ts` 790
- `TileView.svelte` 669
- `micropolisStore.ts` 341
- `MicropolisSimulator.ts` 325
- `sprites.ts` 305
- `TileRenderer.ts` 298
- `ReactiveMicropolisCallback.ts` 170

### 2.4 Notes/Reference Corpus

Notes totals: `3852` LOC (`/tmp/micro_notes_loc.txt`).
Critical docs:
- `notes/SIMULATOR.txt` phase flow (`/tmp/MicropolisCore/notes/SIMULATOR.txt:18-95`)
- `notes/Tiles.txt` tile grouping/ranges (`/tmp/MicropolisCore/notes/Tiles.txt:13-220`)
- `notes/file-format.txt` cty size and offsets (`/tmp/MicropolisCore/notes/file-format.txt:24-73`)

### 2.5 Dependency Surfaces

Engine includes:
- Internal: map, tool, text, callback, frontendmessage, random.
- External stdlib only in native core.
- Emscripten-specific surface isolated mostly in callback/binding (`callback.h`, `js_callback.h`, `emscripten.cpp`).

Frontend deps:
- Svelte runes (`svelte/internal`) in store (`micropolisStore.ts:3`).
- WebGL2 pipeline in renderer (`WebGLTileRenderer.ts:50`).
- Embind-generated module bridge in simulator (`MicropolisSimulator.ts:3-5`).

## 3. The Micropolis God Object

## 3.1 Class Role

`Micropolis` is a large stateful god object: simulation clock, world map, overlays, economy, disasters, sprites, callbacks, persistence, tools, and UI signaling all sit on one class (`/tmp/MicropolisCore/MicropolisEngine/src/micropolis.h:933+`).

## 3.2 Public State (Representative + High-Impact)

The full public declaration surface is massive; high-impact public fields include:
- Calendar/time: `cityTime`, derived `cityYear/cityMonth` accessors and callbacks (`simulate.cpp:172-174`, `callback.h:115`).
- Economy: `totalFunds`, `cityTax`, `taxFund`, `cashFlow`, `roadFund/fireFund/policeFund`, spends and percents (`simulate.cpp:884-892`, `fileio.cpp:378-405`).
- Demand valves: `resValve/comValve/indValve` (`simulate.cpp:671-673`).
- Pop/census: `resPop/comPop/indPop`, total/pop class (`simulate.cpp:611-614`, `evaluate.cpp`).
- Feature caps: `resCap/comCap/indCap` gating growth (`simulate.cpp:675-685`).
- Effects: `roadEffect/policeEffect/fireEffect` (`simulate.cpp:915-933`).
- Automation options: auto-bulldoze/budget/goto/sound from `miscHist` (`fileio.cpp:387-396`).

## 3.3 Overlay Maps and Resolutions

Map template is block-based and column-major (`map_type.h:105-147`).

Canonical overlay types in `micropolis.h` use different granularities:
- `MapByte1` / `MapShort1`: full resolution 1:1 (120x100).
- `MapByte2` / `MapShort2`: 2x2 blocks (60x50).
- `MapByte4` / `MapShort4`: 4x4 blocks (30x25).
- `MapShort8`: 8x8 blocks (15x13, due ceil on height) (`micropolis.h:179-185`).

Important maps:
- `populationDensityMap` (2x2), `trafficDensityMap` (2x2)
- `pollutionDensityMap` (2x2), `landValueMap` (2x2)
- `crimeRateMap` (2x2)
- `terrainDensityMap` (4x4)
- `rateOfGrowthMap` (8x8)
- station effect maps (8x8)

## 3.4 16-bit Tile Encoding

Bits are defined in `MapTileBits` (`tool.h:119-134`):

| Bit | Mask | Meaning |
|---|---|---|
| 15 | `0x8000` | `PWRBIT` tile currently powered |
| 14 | `0x4000` | `CONDBIT` conducts power |
| 13 | `0x2000` | `BURNBIT` flammable |
| 12 | `0x1000` | `BULLBIT` bulldozable |
| 11 | `0x0800` | `ANIMBIT` animated |
| 10 | `0x0400` | `ZONEBIT` zone center |
| 9..0 | `0x03ff` | tile index (`LOMASK`) |

Bit layout:

```text
15      14       13       12       11       10       9 ... 0
[PWRBIT][CONDBIT][BURNBIT][BULLBIT][ANIMBIT][ZONEBIT][ TILE ID ]
```

## 3.5 Tile Catalogue Envelope (0-1023)

Core enum ends at `TILE_COUNT=1024`, with `USED_TILE_COUNT=1019` (`micropolis.h:687-689`).

High-level ranges:
- Terrain/water/coast/trees/rubble/fire: low indices (0x000+)
- Roads/traffic variants: ~0x040-0x0cf (see grouped notes)
- Power/rail infra: 0x0d0-0x0ef
- R/C/I zone blocks: start 0x0f0 upward in fixed 3x3 blocks
- Special facilities: port/airport/stadium/power plants
- Extended church tiles: 956-1018 (`micropolis.h:667-684`)

Full grouped canonical list is in `notes/Tiles.txt` (`/tmp/MicropolisCore/notes/Tiles.txt:13-305`).

## 4. Simulation Loop Deep-Dive

## 4.1 Speed Gate (`simFrame`)

- `simSpeed=0`: full pause.
- `simSpeed=1`: run 1 of every 5 frames.
- `simSpeed=2`: run 1 of every 3 frames.
- `simSpeed>=3`: run every frame.

Source: `simulate.cpp:111-128`.

## 4.2 16-Phase Scheduler (`simulate`)

Phase model (`phaseCycle & 15`) (`simulate.cpp:149-281`):
1. Phase 0: increment time/tax accumulator, valves on even `simCycle`, clear census.
2. Phases 1-8: `mapScan()` each horizontal eighth of world.
3. Phase 9: short census (every 4), long census (every 48), tax+evaluation (every 48).
4. Phase 10: decay growth/traffic and send messages.
5. Phase 11: power scan at speed-dependent cadence.
6. Phase 12: pollution+terrain+land value scan cadence.
7. Phase 13: crime scan cadence.
8. Phase 14: pop density scan cadence.
9. Phase 15: fire analysis cadence + disasters.

Speed-dependent cadence tables (`simulate.cpp:134-143`):
- Power: `{2,4,5}`
- PTL: `{2,7,17}`
- Crime: `{1,8,18}`
- Pop density: `{1,9,19}`
- Fire analysis: `{1,10,20}`

## 4.3 Time Units and Calendar

- `PASSES_PER_CITYTIME=16` (`micropolis.h:195`)
- `CITYTIMES_PER_MONTH=4` (`micropolis.h:200`)
- `CITYTIMES_PER_YEAR=48` (`micropolis.h:205`)

Tax and yearly systems key off these units:
- Monthly census every `4` cityTime (`simulate.cpp:90`, `198-200`)
- Yearly census/tax every `48` cityTime (`simulate.cpp:96`, `206-208`)

## 4.4 `mapScan()` Dispatch

`mapScan(startX, endX)` reads each tile, strips low index, and dispatches by tile class/range into handlers:
- Fires, roads/rails, power conductors, zones, hospitals/churches, special zones, etc.
- Also updates census counters and map overlays per tile class.

Source: `simulate.cpp:947-1017` with sub-calls in `zone.cpp`, `traffic.cpp`, `power.cpp`, `simulate.cpp` special handlers.

## 5. Zone Growth Model

## 5.1 `setValves()` Demand Equations

Source: `simulate.cpp:564-688`.

Core constants:
- `taxTable[21]={200..-600}`
- `extMarketParamTable={1.2,1.1,0.98}` by difficulty
- `resPopDenom=8`, `birthRate=0.02`, `laborBaseMax=1.3`, `internalMarketDenom=3.7`

Key equations:
- `normalizedResPop = resPop / 8`
- `employment = (comHist[1]+indHist[1]) / normalizedResPop` (if resPop>0 else 1)
- `migration = normalizedResPop * (employment - 1)`
- `births = normalizedResPop * 0.02`
- `projectedResPop = normalizedResPop + migration + births`
- `laborBase = clamp(resHist[1] / (comHist[1]+indHist[1]), 0, 1.3)`
- `internalMarket = (normalizedResPop + comPop + indPop)/3.7`
- `projectedComPop = internalMarket * laborBase`
- `projectedIndPop = max(indPop * laborBase * extMarketParam[level], 5.0)`

Ratios and tax transform:
- `resRatio = projectedResPop/normalizedResPop` (fallback 1.3)
- `comRatio = projectedComPop/comPop` (or projectedComPop)
- `indRatio = projectedIndPop/indPop` (or projectedIndPop)
- Clamp ratio maxima to 2.0
- `z=min(cityTax + gameLevel,20)`
- `ratio = (ratio - 1) * 600 + taxTable[z]`

Valve integration:
- `resValve = clamp(resValve + (short)resRatio, -RES_VALVE_RANGE, RES_VALVE_RANGE)`
- same for com/ind.
- Positive valves are zeroed when caps are active (`resCap/comCap/indCap`).

Note: apparent bug at `simulate.cpp:662` where `resRatio = min(indRatio, indRatioMax)` likely intended `indRatio`.

## 5.2 Residential

Flow:
- `doResidential()` computes local pop/traffic, power, valve gate, then calls `doResIn` or `doResOut` (`zone.cpp:548-605`).
- Traffic requirement uses `makeTraffic()` toward commercial destination classes (`zone.cpp:574-577`, `traffic.cpp:134-157`).

Evaluation:
- `evalRes = clamp((landValue - pollution)*32,0,6000)-3000`.
- if no traffic route: `-3000` (`zone.cpp:736-756`).

Growth transitions:
- Empty zone -> houses -> denser 3x3 layouts according to value and pop thresholds (`zone.cpp:614-700`).
- Decline uses inverse transitions + rubble/empty as needed.

## 5.3 Commercial

Flow:
- `doCommercial()` with traffic requirement toward industrial destinations (`zone.cpp:765-814`).
- Growth/decline via `doComIn()/doComOut()` (`zone.cpp:823-858`).

Evaluation:
- `evalCom` reads `comRateMap`, traffic failure forces `-3000` (`zone.cpp:897-908`, `scan.cpp:585-597`).

## 5.4 Industrial

Flow:
- `doIndustrial()` traffic requirement toward residential (`zone.cpp:917-958`).
- `doIndIn()/doIndOut()` manage level transitions (`zone.cpp:967-993`).

Evaluation:
- If traffic fails, `-1000`; otherwise neutral baseline (`zone.cpp:1029-1036`).

## 5.5 Growth Caps

Caps lock positive valve motion:
- `resCap` requires stadium to continue growth.
- `indCap` requires seaport.
- `comCap` requires airport.

Valve cap enforcement: `simulate.cpp:675-685`.
Scenario/user message pressure in `message.cpp` and `text.h` (e.g., NEED_STADIUM/SEAPORT/AIRPORT).

## 5.6 Traffic Model

Pathing parameters:
- `MAX_TRAFFIC_DISTANCE=30` (`micropolis.h:248`).
- `findPerimeterRoad` probes 12 offsets around zone (`traffic.cpp:239-264`).
- `tryDrive` random walk, avoiding immediate reversal (`traffic.cpp:309-347`, `356-395`).
- Route success by `driveDone` destination range checks (`traffic.cpp:453-495`).

Density feedback:
- successful routes increment traffic memory (+50 up to 240) and can retarget helicopter on congestion (`traffic.cpp:165-202`).

## 5.7 External Market

Difficulty modifies industrial projection multiplier through `extMarketParamTable` in `setValves()` (`simulate.cpp:571-573`, `639-640`).
Lower difficulties subsidize industrial demand.

## 6. Budget & Economy

Revenue and obligations (`simulate.cpp:856-900`):
- `policeFund = policeStationPop * 100`
- `fireFund = fireStationPop * 100`
- `roadFund = (roadTotal + railTotal*2) * RLevels[level]`
- `taxFund = (((totalPop * landValueAverage)/120) * cityTax * FLevels[level])`
- `cashFlow = taxFund - (policeFund + fireFund + roadFund)`

Difficulty multipliers:
- `RLevels={0.7,0.9,1.2}`
- `FLevels={1.4,1.2,0.8}`

Funding-to-effect conversion (`simulate.cpp:912-933`):
- `roadEffect = MAX_ROAD_EFFECT * roadSpend/roadFund`
- `policeEffect = MAX_POLICE_STATION_EFFECT * policeSpend/policeFund`
- `fireEffect = MAX_FIRE_STATION_EFFECT * fireSpend/fireFund`

Allocation policy is in `budget.cpp`:
- Manual vs auto-budget paths.
- Priority reductions under deficits (road/fire/police sequencing) (`budget.cpp:116-324`).

## 7. Power Grid

Algorithm: stack flood-fill from power plants (`power.cpp:125-166`).
- Start from conductive neighbors of coal/nuclear plants.
- Carry available power budget (`700` coal, `2000` nuclear) (`power.cpp:85-90`).
- Set/clear `PWRBIT` during scan via zone and conductor checks.
- Emit `MESSAGE_NOT_ENOUGH_POWER` on exhaustion (`power.cpp:159-165`).

Zone power state then influences growth viability (`zone.cpp:setZonePower`, `zone.cpp:433-450`).

## 8. Overlay Map Scans

## 8.1 Pollution / Terrain / Land Value

`pollutionTerrainLandValueScan()` (`scan.cpp:227-333`):
- Pollution sources sampled by `getPollutionValue` (`scan.cpp:341-381`).
- Terrain density sampled from neighboring trees/water.
- Land value formula roughly:
  - center-distance bonus
  - plus terrain
  - minus pollution
  - minus crime interaction
  - clamped [1,250]
- Pollution hotspot tracked for evaluation/messages.

Resolution: mostly 2x2 maps with world→block mapping.

## 8.2 Crime

`crimeScan()` (`scan.cpp:413-460`):
- Station effect maps smoothed 3 times (`scan.cpp:90-114`, `120-130`).
- Crime base formula:
  - `crime = 128 - landValue + popDensity`
  - cap 300
  - subtract police effect
  - clamp [0,250] (`scan.cpp:423-433`).

## 8.3 Population Density

`populationDensityScan()` computes zone-based density, then smoothes and recenters (`scan.cpp:136-189`).
Feeds: land value/crime and city-center estimate.

## 8.4 Fire/Police Coverage

Station maps build from building counts and funding-scaled effects, then smooth passes. These values directly feed fire suppression and crime reduction (`scan.cpp:90-130`, `413-460`, `simulate.cpp:922-933`).

## 8.5 Rate of Growth

ROG stored at 8x8 granularity (`MapShort8`).
- incremented by zone growth via `incRateOfGrowth()` (`zone.cpp:351-357`)
- decayed periodically at phase 10 (`simulate.cpp:215-217`).

## 8.6 Traffic Density

Traffic map decays each phase-10 pass and accumulates from successful trips (`simulate.cpp:219`, `traffic.cpp:165-202`).

## 8.7 Commercial Rate

`computeComRateMap()` computes center-distance gradient `64..-64` (`scan.cpp:585-597`). This becomes a key term in `evalCom()` (`zone.cpp:897-908`).

## 9. Disasters

Random disaster chance by level (`disasters.cpp:95-99`):
- lower interval => more disasters.

Disaster types and mechanics:
- Fire: spread probability from `doFire` local random checks and flammability bits (`simulate.cpp:1300-1352`).
- Flood: river-edge water expansion (`disasters.cpp`).
- Tornado: sprite-driven destruction (`sprite.cpp`).
- Earthquake: random damage swath + callback `startEarthquake` (`disasters.cpp`, `callback.h:110`).
- Monster: sprite spawn and movement destroying tiles (`sprite.cpp`).
- Nuclear meltdown: probability by level table `{30000,20000,10000}` during nuclear special-zone processing (`simulate.cpp:1453-1479`).

Scenario-triggered events:
- Delay table and score wait table loaded in `simLoadInit()` (`simulate.cpp:442-466`).

## 10. Sprites

Sprite enum (`micropolis.h:328-341`):
- train, helicopter, airplane, ship, monster, tornado, explosion, bus.

Engine loop:
- `moveObjects` dispatches per-sprite behavior (`sprite.cpp:553-615`).

Highlights:
- Train/bus follow transport graph, can crash with effects.
- Helicopter patrols traffic/crime events; retargets congestion.
- Airplane flight pathing and crash conditions.
- Ship constrained to channels/edges.
- Monster/tornado apply destruction per tick.
- Explosion is timed effect + message mapping (`sprite.cpp:1654-1693`).

Generation conditions include city population/random gates and infrastructure existence (`sprite.cpp` creation functions around object-specific handlers).

## 11. Terrain Generation

`generateMap(seed)` is deterministic with PRNG seeding (`generate.cpp:129-134`).

Pipeline:
- optional island synthesis (modes).
- river carving and branching.
- lake placement.
- tree planting/distribution.
- smoothing/erosion-like cleanup passes.

Relevant files:
- `generate.cpp`, `random.cpp`, and map editing helpers in `utilities.cpp`.

## 12. Tools & Building Placement

`doTool()` dispatches editing commands (`tool.cpp:1397-1506`).

`ToolEffects` transaction pattern (`tool.h:178-229`):
- collect world modifications + cost + frontend messages first.
- apply only if funding is sufficient.
- prevents partial writes during validation.

Tool metadata:
- cost table `gCostOf[]` (`tool.cpp:216-223`).
- size table `gToolSize[]` (`tool.cpp:230-237`).
- building footprints in `BuildingProperties` (`tool.cpp:1242-1279`).

Placement semantics:
- auto-bulldoze checks and site prep (`tool.cpp:657-697`).
- zone center constraints and footprint write masks.
- `connect.cpp` normalizes adjacent road/rail/wire topology after placement.

Auto-connect details:
- fixed adjacency tables and commands per infrastructure type (`connect.cpp:87-106`, `133+`, `271+`, `364+`, `460+`, `565+`).

## 13. Save File Format

## 13.1 File Sizes

From `fileio.cpp`:
- standard `.cty`: `27120` bytes
- extended with mop: `51120` bytes (`fileio.cpp:230-242`)

Breakdown:
- 6 history arrays: `6 * 480 * 2 = 5760`
- misc history: `240 * 2 = 480`
- map: `120 * 100 * 2 = 24000`
- optional mop: `24000`

## 13.2 Load/Save Order

Order (`fileio.cpp:247-258`):
1. `resHist`
2. `comHist`
3. `indHist`
4. `crimeHist`
5. `pollutionHist`
6. `moneyHist`
7. `miscHist`
8. map
9. optional mop

## 13.3 Endianness

Endian conversion macros perform short and half-long swaps (`fileio.cpp:85-160`).
Notes also call out little-endian assumptions (`notes/file-format.txt:1`).

## 13.4 `miscHist` Encodings

Critical offsets (read/write path):
- city time at words 8/9 (32-bit via half-swap)
- funds at words 50/51 (32-bit)
- options/tax/speed in words 52-55
- funding percents fixed-point in words 58/60/62 (`fileio.cpp:289-329`, `378-405`).

## 13.5 Map Layout

Map arrays are column-major in engine map template (`map_type.h:145-147`) and frontend renderer adapts width/height swap accordingly (`WebGLTileRenderer.ts:170-171`, `739-743`, `770-771`).

## 14. Callback Interface

Canonical interface has 35 methods in `callback.h` (`callback.h:92-126`).

Categories:
- Lifecycle: `newGame`, `startGame`, `startScenario`, `didLoadCity`, `didSaveCity`, fail callbacks.
- UI state: `updateFunds`, `updateDate`, `updateDemand`, `updateTaxRate`, `updateSpeed`, `updatePaused`, `updateOptions`, `updateMap`, `updateHistory`, `updateEvaluation`, `updateBudget`.
- UX actions: `sendMessage`, `showBudgetAndWait`, `showZoneStatus`, `autoGoto`, `makeSound`.
- Scenario/disaster: `startEarthquake`, `didWinGame`, `didLoseGame`, `simulateRobots`, `simulateChurch`.

Frontend response contract:
- Treat callback thread as state-delta stream.
- Avoid heavy recompute in callback itself; enqueue changes and repaint once per tick.

## 15. WASM/Embind Binding Layer

Binding entrypoint: `emscripten.cpp` with `EMSCRIPTEN_BINDINGS` (`emscripten.cpp:1071+`).

Exposed:
- enums (tiles, tools, messages, scenarios, map types).
- `Micropolis` methods/properties.
- callback wrapper types.

Bridge pattern:
- `JSCallback` C++ class delegates every callback into JS method calls (`js_callback.h:8-156`).

Memory access:
- frontend computes addresses/sizes via `getMapAddress/getMapSize`, then uses `HEAPU16.subarray` for zero-copy views (`MicropolisSimulator.ts:142-148`, `micropolisStore.ts:150-158`).

## 16. SvelteKit Frontend Architecture

## 16.1 `MicropolisSimulator.ts`

Pattern:
- singleton/shared simulator with global key and multi-view reference count (`MicropolisSimulator.ts:9-15`, `288-324`).
- tick loop calls `simTick()` then `animateTiles()` (`184-189`).
- speed table:
  - FPS: `[1,5,10,30,60,120,120,120,120]`
  - passes: `[1,1,1,1,1,1,4,10,50]` (`95-97`).

## 16.2 `micropolisStore.ts`

- Uses Svelte runes state/effect/derived (`micropolisStore.ts:3`).
- Maintains reactive game state (funds/date/demand/speed/tax).
- effects manage tick interval and pass updates (`102-132`).

## 16.3 `ReactiveMicropolisCallback.ts`

- Implements JS callback interface and mutates store on each event (`ReactiveMicropolisCallback.ts:10-170`).
- Main map redraw trigger is callback `onUpdateMapWindow` -> `micropolisStore.triggerMapUpdate()` (`98-101`).

## 16.4 `WebGLTileRenderer.ts`

Pipeline:
- Upload map and mop as `R16UI` integer textures (`166-175`, `230-239`).
- Fragment shader samples `u_map`, `u_mop`, and tile atlas array `u_tiles[8]` (`374-485`).
- Pan/zoom encoded by dynamic `screenTileArray` update (`689-716`).
- Render path updates textures every frame with `texSubImage2D` (`736-757`).

Tile atlas requirements:
- nearest-neighbor sampling (`191`, `195`, `324`, `329`).
- square tile assumptions and set packing derived in shader (`439-450`).

MOP usage:
- `mopValue & 0xff` selects tile set/layer set row (`417-421`, `449-450`).

## 17. CLI Tool (`micropolis.js`)

Purpose: headless save analysis/edit/export/visualization (`micropolis.js:4-17`).

Command surfaces (yargs):
- `city dump`
- `city export`
- `city info`
- `city analyze`
- `city edit`
- `city patch-scenario`
- `visualize ascii|emoji|mono|map|filter`

Refs: `micropolis.js:1314-2055` (command declarations).

Scenario patch logic mirrors engine defaults (`micropolis.js:37-80`).

## 18. Modding Guide

## 18.1 Easy (No Core Engine Refactor)

Examples:
- Replace tile atlases and sprites.
- Add/edit scenario files `.cty`.
- Tune tax/difficulty and frontend speed/pass presets.

Files:
- graphics: frontend assets + `WebGLTileRenderer.ts`
- scenarios: `resources/cities/*.cty`
- simple params: `simulate.cpp` constants, `micropolis/scripts/constants.js`

Tests:
- load city, run 10 years deterministic seed, snapshot key metrics.
- visual smoke for atlas validity.

## 18.2 Medium (Engine Changes)

Examples:
- New zone/building categories.
- New overlays/maps.
- World size changes.

Files:
- enums/constants: `micropolis.h`, `tool.h`, `text.h`, `constants.js`
- sim logic: `zone.cpp`, `simulate.cpp`, `scan.cpp`, `tool.cpp`, `connect.cpp`
- bindings: `emscripten.cpp`, TS typings.

Tests:
- save/load roundtrip.
- zone growth regression.
- callback parity tests.

## 18.3 Hard (Architectural)

Examples:
- tile format expansion beyond 16-bit.
- 3D renderer with true elevation.
- multiplayer deterministic lockstep.

Required work:
- rewrite serialization, bit masks, render codecs, network state sync.
- strict determinism harness and replay diffing.

## 19. Integration Paths for WibWob-DOS

## 19.1 Option A: WASM Engine + Custom Web Frontend

```text
WibWob-DOS (menu/launcher) -> browser client -> wasm Micropolis + WebGL
```

Pros:
- reuse existing Micropolis frontend.
- fast proof-of-concept.

Cons:
- dual UI stack (Turbo Vision + web).
- weaker integration with text-native workflows.

Effort: medium.
Risk: medium (coordination complexity).

## 19.2 Option B: WASM/Node Headless + TUI via IPC

```text
Turbo Vision TUI -> IPC -> Node host -> wasm engine
```

Pros:
- isolates engine process.
- easier crash containment.

Cons:
- IPC protocol and performance overhead.
- embind/JS callback marshaling in tight loops.

Effort: medium-high.
Risk: medium-high.

## 19.3 Option C: Native C++ Engine In-Process (Recommended)

```text
WibWob-DOS C++ process
  |- Micropolis core (native objects)
  |- TV view(s): map, status, tools
  |- callback bridge -> event queue
```

Pros:
- one runtime/language for core and UI.
- no wasm boundary, direct memory access.
- easiest deterministic testing and instrumentation.

Cons:
- requires Emscripten decoupling in callback layer.
- GPL scope applies directly to shipped binary.

Effort: high initial, best long-term.
Risk: low-medium after decoupling.

## 19.4 Option D: Headless Service + Dual Frontends

```text
Micropolis service (native/wasm)
  |- API/MCP/IPC
  |- Web UI + TUI client
```

Pros:
- flexible clients, remote control.
- aligns with existing sidecar API patterns.

Cons:
- highest architecture complexity.
- consistency and latency concerns.

Effort: high.
Risk: high.

## 19.5 Turbo Vision Design for Option C

### ASCII Tile Rendering Strategy

Use `tile = mapValue & LOMASK`, flags from high bits.

Lookup table example:
- Terrain/water -> `.` `~`
- Roads -> box-drawing or `+|-`
- Rails -> `=` `#`
- Power lines -> `:` or light box glyphs
- Residential -> `r/R`
- Commercial -> `c/C`
- Industrial -> `i/I`
- Fire -> `*` with red/yellow cycle
- Rubble -> `,;`
- Plants -> `P/N`
- Police/Fire -> `p/f`

Coloring from category + flags:
- powered zones tint brighter.
- unpowered zones dim + warning marker.

### `TView` Subclass

`class TMicropolisMapView : public TView`:
- viewport pan/zoom in tile units.
- `draw()` pulls visible cells and writes via `TDrawBuffer` per-cell glyph/color attrs.
- no raw ANSI streams; direct cell model mapping (aligns with guardrail).

### Status Bar

Single-line fixed fields:
- `Funds`
- `Date`
- `Pop`
- `R C I` valve bars
- `Score`
- `Speed/Paused`

### Tool Palette

Keyboard-driven:
- numeric hotkeys `1..0` for primary tools.
- shifted layer for power/transport/special buildings.
- preview footprint overlay before commit.

### Callback Bridge

`Micropolis::callback` implementation pushes typed events into lock-free/single-thread queue consumed by UI tick.

### Module Integration

Tile theme packs as WibWob modules:
- mapping file: `tile-index -> glyph, fg, bg`
- optional animation rules.
- load at runtime, fallback to default theme.

## 20. Emscripten Decoupling Guide

Goal: build Micropolis engine natively with WibWob-DOS CMake/C++14.

Steps:
1. Guard includes:
- wrap `#include <emscripten/val.h>` and embind-only headers with `#ifdef MICROPOLIS_EMSCRIPTEN`.

2. Callback abstraction:
- replace `emscripten::val callbackVal` in `Callback` interface with opaque native context pointer or `std::any`-like adapter.
- keep a wasm adapter subclass for web builds.

3. Exclude `emscripten.cpp` from native target.
- It is binding glue only.

4. Provide native callback implementation for Turbo Vision.

5. Build integration:
- add Micropolis sources to WibWob target or static lib.
- define compile flags enabling native callback path.

6. Verify:
- compile passes.
- deterministic simulation parity against wasm baseline for fixed seeds.

## 21. MOOLLM & AI Integration

MicropolisCore README defines MOOLLM coupling explicitly (`README.md:116-198`):
- micropolis skill composed with `schema-mechanism`, `experiment`, `speed-of-light` and others (`README.md:161-174`).
- speed-of-light model: multi-agent turns in one LLM call (`README.md:176`).
- schema mechanism framing: learned causal triples context+action->result (`README.md:178`).
- experiment cycle: simulate/evaluate/iterate/analyze (`README.md:180`).

Relevance to WibWob-DOS symbient model:
- maps naturally to equal human/AI control with shared world state.
- WibWob command registry + MCP can expose deterministic sim actions as AI tools.

## 22. Determinism & Testing

PRNG:
- seeded generation path in `generateMap` and random helpers (`generate.cpp:129-134`, `random.cpp`).

Determinism harness proposal:
1. Load fixed seed and map.
2. Run N ticks with fixed tool actions.
3. Snapshot:
- map hash
- funds/date/pop/valves/score
- overlay checksums
4. Compare against golden snapshots.

Regression suites:
- zone growth parity (R/C/I counts over time)
- budget parity (cashFlow/fund effects)
- save/load round-trip equivalence (`fileio.cpp`)
- callback event sequence tests.

## 23. Appendices

## Appendix A: Tile Enum Reference

`TILE_COUNT=1024`, `USED_TILE_COUNT=1019`, extended church tiles `956-1018` (`micropolis.h:667-689`).

Grouped canonical catalogue:
- `notes/Tiles.txt` provides authoritative grouped mappings and building footprints (`/tmp/MicropolisCore/notes/Tiles.txt:13-305`).

Key size anchors:
- R/C/I zones: 3x3 blocks from base tile bands.
- Seaport/coal/nuclear/stadium: 4x4.
- Airport: 6x6.
- Anim groups include fire and special effects.

## Appendix B: Callback Method Signatures (Complete)

From `callback.h:92-126`:
- `autoGoto(Micropolis*, emscripten::val, int x, int y, std::string message)`
- `didGenerateMap(Micropolis*, emscripten::val, int seed)`
- `didLoadCity(Micropolis*, emscripten::val, std::string filename)`
- `didLoadScenario(Micropolis*, emscripten::val, std::string name, std::string fname)`
- `didLoseGame(Micropolis*, emscripten::val)`
- `didSaveCity(Micropolis*, emscripten::val, std::string filename)`
- `didTool(Micropolis*, emscripten::val, std::string name, int x, int y)`
- `didWinGame(Micropolis*, emscripten::val)`
- `didntLoadCity(Micropolis*, emscripten::val, std::string filename)`
- `didntSaveCity(Micropolis*, emscripten::val, std::string filename)`
- `makeSound(Micropolis*, emscripten::val, std::string channel, std::string sound, int x, int y)`
- `newGame(Micropolis*, emscripten::val)`
- `saveCityAs(Micropolis*, emscripten::val, std::string filename)`
- `sendMessage(Micropolis*, emscripten::val, int messageIndex, int x, int y, bool picture, bool important)`
- `showBudgetAndWait(Micropolis*, emscripten::val)`
- `showZoneStatus(Micropolis*, emscripten::val, int tileCategoryIndex, int populationDensityIndex, int landValueIndex, int crimeRateIndex, int pollutionIndex, int growthRateIndex, int x, int y)`
- `simulateRobots(Micropolis*, emscripten::val)`
- `simulateChurch(Micropolis*, emscripten::val, int posX, int posY, int churchNumber)`
- `startEarthquake(Micropolis*, emscripten::val, int strength)`
- `startGame(Micropolis*, emscripten::val)`
- `startScenario(Micropolis*, emscripten::val, int scenario)`
- `updateBudget(Micropolis*, emscripten::val)`
- `updateCityName(Micropolis*, emscripten::val, std::string cityName)`
- `updateDate(Micropolis*, emscripten::val, int cityYear, int cityMonth)`
- `updateDemand(Micropolis*, emscripten::val, float r, float c, float i)`
- `updateEvaluation(Micropolis*, emscripten::val)`
- `updateFunds(Micropolis*, emscripten::val, int totalFunds)`
- `updateGameLevel(Micropolis*, emscripten::val, int gameLevel)`
- `updateHistory(Micropolis*, emscripten::val)`
- `updateMap(Micropolis*, emscripten::val)`
- `updateOptions(Micropolis*, emscripten::val)`
- `updatePasses(Micropolis*, emscripten::val, int passes)`
- `updatePaused(Micropolis*, emscripten::val, bool simPaused)`
- `updateSpeed(Micropolis*, emscripten::val, int speed)`
- `updateTaxRate(Micropolis*, emscripten::val, int cityTax)`

## Appendix C: EditingTool Enum + Costs + Sizes

Enum order (`tool.h:142-167`):
- `TOOL_RESIDENTIAL`
- `TOOL_COMMERCIAL`
- `TOOL_INDUSTRIAL`
- `TOOL_FIRESTATION`
- `TOOL_POLICESTATION`
- `TOOL_QUERY`
- `TOOL_WIRE`
- `TOOL_BULLDOZER`
- `TOOL_RAILROAD`
- `TOOL_ROAD`
- `TOOL_STADIUM`
- `TOOL_PARK`
- `TOOL_SEAPORT`
- `TOOL_COALPOWER`
- `TOOL_NUCLEARPOWER`
- `TOOL_AIRPORT`
- `TOOL_NETWORK`
- `TOOL_WATER`
- `TOOL_LAND`
- `TOOL_FOREST`

Costs (`tool.cpp:216-223`):
`[100,100,100,500,500,0,5,1,20,10,5000,10,3000,3000,5000,10000,100,0,0,0]`

Sizes (`tool.cpp:230-237`):
`[3,3,3,3,3,1,1,1,1,1,4,1,4,4,4,6,1,1,1,1]`

## Appendix D: Message Enum (`MESSAGE_*`)

Complete numeric range and text intent in `text.h:112-171`.
- First: `MESSAGE_NEED_MORE_RESIDENTIAL = 1`
- Last: `MESSAGE_SCENARIO_RIO_DE_JANEIRO = 57`
- `MESSAGE_LAST = 57`

Notable groups:
- Infrastructure demand (res/com/ind/roads/rails/electricity/stadium/seaport/airport)
- City risks (pollution/crime/traffic/fire/meltdown/flooding)
- Financial alerts (tax too high/no money/not enough funds)
- Milestones (town/city/capital/metropolis/megalopolis)
- Scenario lifecycle (won/lost and scenario titles)

## Appendix E: Scenario Details

Scenario load defaults from `fileio.cpp:442-498`:

| Scenario | Start Year | Funds | File |
|---|---:|---:|---|
| Dullsville | 1900 | 5000 | `scenario_dullsville.cty` |
| San Francisco | 1906 | 20000 | `scenario_san_francisco.cty` |
| Hamburg | 1944 | 20000 | `scenario_hamburg.cty` |
| Bern | 1965 | 20000 | `scenario_bern.cty` |
| Tokyo | 1957 | 20000 | `scenario_tokyo.cty` |
| Detroit | 1972 | 20000 | `scenario_detroit.cty` |
| Boston | 2010 | 20000 | `scenario_boston.cty` |
| Rio de Janeiro | 2047 | 20000 | `scenario_rio_de_janeiro.cty` |

Scenario disaster delays and scoring windows from `simulate.cpp:442-466`.

## Appendix F: Map Constant Reference

From `map_type.h` and `micropolis.h`:
- `WORLD_W=120` (`map_type.h:90`)
- `WORLD_H=100` (`map_type.h:95`)
- `WORLD_W_2=60`, `WORLD_H_2=50` (`micropolis.h:151-157`)
- `WORLD_W_4=30`, `WORLD_H_4=25` (`micropolis.h:165-171`)
- `WORLD_W_8=15`, `WORLD_H_8=13` (`micropolis.h:179-185`)
- `HISTORY_LENGTH=480` (`micropolis.h:210`)
- `MISC_HISTORY_LENGTH=240` (`micropolis.h:215`)
- `POWER_STACK_SIZE=(120*100)/4=3000` (`micropolis.h:226`)
- `MAX_TRAFFIC_DISTANCE=30` (`micropolis.h:248`)
- `TILE_COUNT=1024`, `USED_TILE_COUNT=1019` (`micropolis.h:687-688`)

## Appendix G: Game Level Parameter Tables

From `simulate.cpp`:
- Valves external market params: `{1.2,1.1,0.98}` (`simulate.cpp:571-573`)
- Road multiplier `RLevels={0.7,0.9,1.2}` (`simulate.cpp:863`)
- Tax multiplier `FLevels={1.4,1.2,0.8}` (`simulate.cpp:864`)
- Tax table (0..20):
`[200,150,120,100,80,50,30,0,-10,-40,-100,-150,-200,-250,-300,-350,-400,-450,-500,-550,-600]` (`simulate.cpp:567-570`)

---

## Cross-Section Notes and Risks

- `setValves()` appears to contain one likely typo/bug in ratio clamp assignment (`simulate.cpp:662`). Validate before adopting formulas verbatim in a rewrite.
- Save format docs in `notes/file-format.txt` are useful but partial; `fileio.cpp` is source of truth for offsets and conversions.
- Existing JS callback naming in `ReactiveMicropolisCallback.ts` is not a perfect mirror of the C++ callback names; treat it as frontend adapter, not authoritative API contract.
- For WibWob-DOS Turbo Vision integration, follow the ANSI guardrail strictly: render from parsed tile/cell model to TV attributes, never raw escape streams.
