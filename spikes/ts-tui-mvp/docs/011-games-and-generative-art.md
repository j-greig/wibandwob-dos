# 011 — Games & Generative Art Views

> Developer handover for the WibWob-DOS TypeScript rebuild.
> Covers all game views, generative art views, animated views, and the ASCII grid primitive.

---

## 1. Common Render-Loop Pattern

Every animated or game view in WibWob-DOS follows the same Turbo Vision timer lifecycle:

```
constructor → set eventMask |= evBroadcast
setState(sfExposed, true) → startTimer()
setState(sfExposed, false) → stopTimer()

handleEvent(evBroadcast, cmTimerExpired) →
    if (ev.message.infoPtr == timerId) {
        advance() / tick()   // compute next state
        drawView()           // trigger redraw
        clearEvent(ev)
    }
```

**Key details:**
- `setTimer(periodMs, repeatMs)` returns an opaque timer ID; views compare `ev.message.infoPtr == timerId` to identify their own timer.
- `draw()` writes one scanline at a time via `writeLine(0, y, W, 1, buf)`. The buffer is either a `std::vector<TScreenCell>` or a `TDrawBuffer`.
- Timer periods range from 20ms (fast generative art) to 500ms (Quadra default gravity).
- Views stop their timer when the window loses `sfExposed` to avoid wasted computation.

**TS port implication:** Replace with `setInterval` / `requestAnimationFrame`. The timer-ID pattern maps naturally to interval handles. The `writeLine` path becomes a cell-buffer write to the terminal grid.

---

## 2. Game State Machines

### 2.1 Quadra (Tetris Clone) — `quadra_view.cpp`

| Aspect | Detail |
|--------|--------|
| Board | 10×20 (`BOARD_W`×`BOARD_H`), `Cell` = 0 (empty) or piece-type+1 |
| Pieces | 7 SRS-standard tetrominos, 4 rotations each, stored as `int[7][4][4][2]` coordinate offsets |
| Randomiser | 7-bag shuffle (`nextFromBag()`) |
| Rotation | Basic wall-kick: try 0, −1, +1 x-offsets |
| Gravity | Quadra-style: after line clear, cells fall independently (`applyGravity`), which can trigger chain clears |
| Scoring | `baseScore × level × (1 + chainCount)`. Base: 100/300/500/800 for 1/2/3/4+ lines |
| Speed | `max(50, periodMs − (level−1)×40)` — restarts timer on level-up |
| States | `Playing`, `Paused`, `GameOver` — toggled by P/R keys |
| Ghost piece | Hard-drop preview computed per draw frame |
| Input | Arrow keys (move/soft-drop), Z/X (rotate), Space (hard-drop), P (pause), R (reset) |
| Rendering | 2-char-wide cells (`[` `]`), border box, HUD panel to the right with score/lines/level/next-piece preview |

**Complexity: Medium.** Full game logic + rendering. ~350 lines. Well-encapsulated — no external dependencies.

### 2.2 Snake — `snake_view.cpp`

| Aspect | Detail |
|--------|--------|
| Board | Dynamic: `boardW() = size.x − 16`, `boardH() = size.y`. Recalculates on resize → `newGame()` |
| Body | `std::deque<Pos>` — front is head, back is tail |
| Movement | Direction-buffered (`nextDir`), prevents 180° reversal |
| Speed | `basePeriodMs − (eaten/5)×10`, minimum 40ms. Timer restarted on food pickup |
| Food | Random placement with sparkle animation (alternates `*`/`o` every 3 frames) |
| Scoring | `10 + eaten` per food — increasing reward |
| Body rendering | Gradient from bright green (head) to dark green (tail). Directional head chars (`^v<>`). Body uses `=`, `#`, `+` for horizontal/vertical/corner segments |
| Resize | Calls `newGame()` — board dimensions are view-dependent |

**Complexity: Low–Medium.** ~280 lines. Simple state, straightforward port.

### 2.3 WibWob Rogue — `rogue_view.cpp`

| Aspect | Detail |
|--------|--------|
| Map | 80×45 (`MAP_W`×`MAP_H`), BSP-generated dungeon rooms with corridors |
| Tiles | `Wall`, `Floor`, `Door`, `StairsDown`, `StairsUp`, `Water`, `Terminal` |
| FOV | Radius-8 ray-march line-of-sight. Tiles marked `seen[]` persist dimly |
| Player | HP, maxHP, attack, defense, level, XP, gold, dataChips, floor (1–5) |
| Creatures | 6 kinds: Rat, Bat, Skeleton, Goblin, Glitch, Boss. Simple chase AI (move toward player if within 8 tiles) |
| Items | Potion, Scroll (reveal map), Key, Gold, DataChip, Weapon, Armor |
| Level-up | XP thresholds: `10 + level×5`. Grants +5 maxHP (full heal), +1 attack, +1 defense every 2 levels |
| Terminal interaction | `interactTerminal()` — if player has DataChip: reveal map + heal + XP. Emits `cmRogueHackTerminal` event → app spawns a real terminal window |
| Victory | Reach floor 5 |
| Input | Arrow/vi keys + numpad (8-directional movement), `>` (stairs), `T` (terminal), `R` (restart), `5`/`s` (wait) |
| Camera | Centered on player, clamped to map bounds |
| Log | Rolling message log below map with colour-coded entries |

**Complexity: High.** ~620 lines. BSP generation, creature AI, item system, FOV, camera, log. The `cmRogueHackTerminal` integration with the app shell is a cross-cutting concern.

### 2.4 Game of Life — `game_of_life_view.cpp`

| Aspect | Detail |
|--------|--------|
| Grid | Sparse: `unordered_set<CellCoord>` for living cells, `unordered_map` for ages |
| Topology | Toroidal wrap (edges connect) |
| Rules | Standard Conway: survive on 2–3, birth on exactly 3 |
| Optimisation | Active-cell set: only evaluate cells neighbouring at least one living cell |
| Interaction | Mouse click reseeds with 12% random density |
| Rendering | `░` (dead) / `█` (alive). Uses classic `TColorAttr(0x08)` / `(0x0F)` |
| Resize | Reinitialises grid + reseeds |

**Complexity: Low.** ~200 lines. Good first port candidate for testing timer + cell-buffer infrastructure.

---

## 3. Generative Art Views

All generative views share a common skeleton:

```
TView subclass with:
  frame counter, paletteIndex (0–2), periodMs
  startTimer/stopTimer/advance/draw pattern
  Space = pause/resume, P/O = cycle palette
  changeBounds → drawView()
  TNoTitleFrame window wrapper (borderless)
```

### 3.1 Orbit Field — `generative_orbit_view.cpp`

**Renders:** Radial interference patterns from 3 rotating point sources. Concentric colour bands and ripples that evolve smoothly.

**Math:** Three sources orbit the centre at different angular velocities and radii. Per-pixel: compute Euclidean distance to each source, sum `sin(freq×dist − time)` interference terms, apply radial falloff via `exp(-2.5×r²)`.

**Palette:** 3 palettes (warm/cold/mono), 5-stop gradient with linear interpolation. Shade character selected from ` .:-=+*#%@` by luminance.

**Period:** 50ms (~20 FPS). **Complexity: Low.** ~150 lines of rendering math.

### 3.2 Torus (Donut) — `generative_torus_view.cpp`

**Renders:** Classic spinning ASCII donut (à la a1k0n). Z-buffered 3D torus projected to 2D.

**Math:** Parametric torus sweep: outer loop (theta — tube cross-section), inner loop (phi — revolution). Rotation matrices `A`, `B` applied. Perspective projection via `1/(z + K2)`. Surface-normal dot-product for luminance.

**Extra controls:** `1`–`4` scale presets, `[`/`]` fine-tune scale, `{`/`}` adjust vertical stretch (`yStretch`).

**Rendering:** Full-screen buffer + z-buffer. 12-level shade charset `.,-~:;=!*#$@`. Colour by theta+phi angle through palette. Very dense inner loop — potential perf concern in TS.

**Period:** 40ms (~25 FPS). **Complexity: Medium.** Dense math but self-contained. ~180 lines.

### 3.3 Cube Spinner — `generative_cube_view.cpp`

**Renders:** Wireframe rotating cube in perspective.

**Math:** 8 vertices at (±1,±1,±1), rotated by `Rz·Ry·Rx`, projected with perspective. 12 edges drawn via Bresenham-style line rasterisation into a z-buffered screen buffer.

**Period:** 45ms. **Complexity: Low.** ~140 lines. Simplest 3D view.

### 3.4 Mycelium Field — `generative_mycelium_view.cpp`

**Renders:** Curl-noise flow field with branching ASCII motifs. Looks like a living fungal network.

**Math:** Value noise → curl vector field (perpendicular gradients). Sample point advected along flow. Banding via `sin(uu×7 + vv×9 − t)` interference. Glyph selection by flow angle: `/`, `\`, `|`, with density-based overrides (`*` for high, `.` for low).

**Palettes:** Moss, spore-violet, monochrome.

**Period:** 55ms. **Complexity: Low.** ~150 lines.

### 3.5 Verse Field — `generative_verse_view.cpp`

**Renders:** Full-window evolving generative field. Three switchable modes:

| Mode | Visual |
|------|--------|
| `mdFlow` | Flowing sine-wave interference (u×3.1 + sin(v×2.3 + t)) |
| `mdSwirl` | Angular-radial spiral (ang×3.5 + r×5.0 − t) |
| `mdWeave` | Cross-hatched sinusoid grid (sin(u×6)×cos(v×6)) |

**Math:** Mode-specific base field + 3-octave FBM noise detail. Palette-mapped with vignette background.

**Extra controls:** `M` cycles mode.

**Period:** 50ms. **Complexity: Low–Medium.** ~220 lines. Heavier than Orbit due to FBM.

---

## 4. Monster Ecosystem

Three views that integrate emoji rendering and/or LLM-adjacent features. They form a conceptual trio: face-tracking cam → generative verse with monsters → decomposing portal.

### 4.1 Monster Cam — `generative_monster_cam_view.cpp`

**What it does:** Connects to a Python/OpenCV face-tracking worker via Unix domain socket (`/tmp/face_monster_cam.sock`). Renders a minimal 3-line emoji face sprite (`👁️═👁️` / `∿∿∿👃∿∿∿` / `👅`) that tracks the detected face position.

**Key features:**
- Non-blocking socket I/O with lazy reconnect (500ms retry)
- JSON-ish header parsing for face bbox, blink detection
- Smoothed face tracking with deadband quantization (prevents jitter)
- Sticky face position (holds last position for `faceStickyMs` after face lost)
- Two sprite modes: minimal 3-line + full "big monster" diamond sprite
- Debug HUD overlay (toggle with `V`)
- Blink detection hides eyes

**No LLM usage.** The "monster" aesthetic is purely visual.

**Period:** 80ms. **Complexity: High.** ~400 lines. Socket I/O, face tracking, smoothing math. The Unix socket dependency is platform-specific.

### 4.2 Monster Verse — `generative_monster_verse_view.cpp`

**What it does:** Verse-style flow fields mapped to a whitespace→punctuation→geometric→emoji character hierarchy. Sparse crown/eye overlays (`╱╲` crown, `👁️═👁️` eyes) placed on a tiled grid. Dynamic eyes that seek dark spots in the field.

**Key features:**
- Column-accurate emitter using `TDrawBuffer::moveCStr` for multi-byte emoji
- Four-tier glyph selection by field intensity: space → `.`,`,` → `∿`,`◊`,`│` → 🕳️,👁️,💀,🦴 etc.
- Head motif placed on coarse grid (`tileW=28`, `tileH=10`), hashed per-tile for sparse placement
- Eyes that scan a 5×3 search grid to find darkest field spot and drift toward it
- Limb diagonals as oriented sine stripes
- `emojiBias`, `emojiFlood` controls
- Same 3 palettes and 3 modes as Verse

**Period:** 60ms. **Complexity: Medium–High.** ~350 lines. Complex glyph selection logic.

### 4.3 Monster Portal — `generative_monster_portal_view.cpp`

**What it does:** Tiles emoji from a "monster-death-flyer-portal" theme on black background with brick-offset layout. Pattern gradually decomposes over time via glitch/noise field.

**Key features:**
- Brick-offset tiling (50% shift on odd rows)
- FBM-based field drives glyph selection: whitespace → punctuation → geometric → emoji
- Progressive decomposition: `glitch` parameter grows over time, swapping tiles to noise/emoji
- Episode cycling (4 phases: default, haunt, flame, default) with accent emoji (👻, 🔥)
- Head motif: crown (`╱╲`), eyes (`👁️═👁️`), placed per-tile via hash
- Arms/legs: smooth sine-stripe diagonals with `╱`/`╲`
- Crown rigidity, whitespace bias, density, episode duration — all adjustable via keys

**Period:** 90ms. **Complexity: Medium–High.** ~380 lines. Most complex glyph composition logic.

---

## 5. Special-Feature Views

### 5.1 Deep Signal — `deep_signal_view.cpp`

**A full space-exploration game** with:

| Feature | Detail |
|---------|--------|
| Map | 80×45, populated with stars, asteroid fields, embedded ASCII art (4 art pieces: Nebula Vortex, Cosmic Eye, Derelict Fleet, Crystal Array) |
| Probe | Directional scanner with 90° cone FOV. Facing N/E/S/W |
| Scanner | Regular (radius 8) and deep scan (radius 12, costs 3 fuel) |
| Visibility | Scan-recency based brightness: 4 levels from in-cone (100%) down to barely-remembered (20%) |
| LOS | Bresenham line-of-sight check; asteroids block scanner |
| Signals | 5 signal sources that decode when scanned → emits `cmDeepSignalTerminal` → app spawns analysis terminal |
| Anomalies | 3 anomalies that also trigger terminal spawns |
| Fuel | 150 max, depots (4) refuel +50. Nebula costs 2 fuel to traverse |
| HUD | Fuel gauge bar, direction, signals decoded, turn counter, position |
| No timer | Turn-based — input-driven only. No `setTimer`. |

**Agent integration:** `cmDeepSignalTerminal` broadcasts trigger the app to spawn terminal windows with signal analysis prompts.

**Complexity: High.** ~550 lines. Full game with map gen, LOS, fuel management, art embedding.

### 5.2 Contour Map — `contour_map_view.cpp`

**Unique architecture:** Delegates rendering to a **Python subprocess** (`tools/contour_stream.py`) via pipe. The C++ view is purely a display shell.

| Feature | Detail |
|---------|--------|
| Base class | `TScroller` (scrollable view with vertical scrollbar) |
| Bridge | `ContourBridge` — forks Python process, captures stdout via non-blocking pipe |
| Frame protocol | Lines delimited by `\n`, frames separated by `\x1E` (record separator). `STATUS:` prefix for metadata |
| Modes | Static (one-shot) or grow (animated cellular automaton). Pause/resume via `SIGSTOP`/`SIGCONT` |
| Terrains | 7 terrain types. Order modes: chaos, order:pop, order:spread, hybrid |
| UI | Button strip (H-2) + status bar (H-1). Mouse-clickable terrain buttons |
| Resize | Debounced relaunch (200ms) — kills old process, spawns new with updated dimensions |
| Save | Exports to `exports/contour/` as timestamped .txt |

**Complexity: High for TS port** — requires subprocess spawning (or rewriting the Python logic in TS). The pipe protocol and `SIGSTOP`/`SIGCONT` won't work in browser.

### 5.3 Generative Lab — `generative_lab_view.cpp`

**Also subprocess-based** via `GenerativeBridge` → `tools/generative_stream.py`. Same pipe/frame protocol as Contour Map.

**Extra features over Contour Map:**
- 9+ presets (Life, Brian's Brain, etc.) + random mode
- **Stamp picker dialog** — full TDialog with 3-column layout (available primers / preview / selected), radio buttons for position/mode, canvas mode
- **handleApiAction()** — the only view with a full JSON API surface: `get_info`, `set_preset`, `set_seed`, `new_seed`, `mutate`, `pause`, `resume`, `toggle_pause`, `step`, `save`, `set_speed`, `set_max_ticks`, `stamp`, `clear_stamps`, `cycle_preset`, `list_primers`
- Canvas mode: primer art becomes the initial grid
- Mutation: reroll seeds

**Complexity: Very High.** ~700 lines. Subprocess bridge + full dialog + API handler. The most complex view in the codebase.

---

## 6. Animated Views

These are simpler, purely decorative animated views. All follow the standard timer pattern.

### 6.1 Animated Blocks — `animated_blocks_view.cpp`

Zigzag block animation using 16 ANSI colours. Phase-based colour cycling of `█` block characters in a zigzag pattern. Simple `phase++` advance.

**Period:** Configurable. **Complexity: Very Low.** ~80 lines of rendering.

### 6.2 Animated Gradient — `animated_gradient_view.cpp`

Horizontal colour gradient that flows/oscillates. Linear interpolation between configurable start/end `TColorRGB` values with phase-based offset.

**Period:** Configurable. **Complexity: Very Low.** ~70 lines.

### 6.3 Animated Score — `animated_score_view.cpp`

Turns a multi-line ASCII/Unicode "score" into gentle animation: phase-based wave oscillation, breathing intensity loops (`░▒▓`), drift/scroll of token ribbons, cyclic face glyph morphing (`(⊙_⊙)` → `(◉_◉)` → etc).

**Period:** Configurable. **Complexity: Low.** Deterministic line composition.

### 6.4 Animated ASCII — `animated_ascii_view.cpp`

Multi-layer parallax ASCII art animation. Static art lines containing Unicode faces (`つ◑‿◐༽つ`, `(╯°□°)╯`, etc.) and block/wave characters, rendered with layered scrolling offsets.

**Period:** Configurable. **Complexity: Low.** ~120 lines.

### 6.5 ASCII Grid — `ascii_grid_view.cpp`

**Not animated** — a static cell grid primitive. Provides `putChar(x,y,ch,attr)` and `putGlyph(x,y,utf8,attr)` with double-width emoji support (trail-cell marking via `flags[]`). Used by other views as a composable building block.

**Complexity: Very Low.** ~100 lines. A utility, not a standalone view.

---

## 7. Common Patterns

### 7.1 `changeBounds` Override

Every game/generative window overrides `changeBounds`:

```cpp
// Window level:
void changeBounds(const TRect& b) override {
    TWindow::changeBounds(b);
    setState(sfExposed, True);
    redraw();
}
```

Some views additionally reset state on resize:
- **Snake:** calls `newGame()` (board dimensions are view-dependent)
- **Game of Life:** reinitialises grid + reseeds
- **Contour Map / Generative Lab:** debounced relaunch of subprocess
- **Rogue / Deep Signal:** `updateCamera()` only

### 7.2 Colour Cycling

Three approaches:
1. **Palette index cycling** (generative views): 3 pre-defined 5-stop RGB gradient palettes. `P`/`O` keys cycle. Palette sampled per-pixel via `paletteSample(idx, t)`.
2. **Phase-based colour shifting** (animated views): Colours computed from `phase` counter + position. No explicit palette state.
3. **Fixed colour maps** (games): Static `TColorAttr` constants for game elements. No cycling.

### 7.3 TDrawBuffer / TScreenCell Usage

Two rendering strategies:
1. **`std::vector<TScreenCell>` + `::setCell()` + `writeLine()`** — Used by Quadra, Snake, Rogue, Deep Signal, all generative views. Each cell set individually with `setCell(cell, char, TColorAttr)`. Written one row at a time.
2. **`TDrawBuffer` + `moveCStr()` / `moveStr()` / `moveChar()`** — Used by Monster Cam, Monster Verse, Monster Portal, Contour Map, Generative Lab, Animated Score. Required for multi-byte UTF-8/emoji (the `TAttrPair` overload of `moveCStr` handles wide characters).

**TS port note:** Both map to the same concept — writing to a 2D cell buffer. The key distinction is that emoji views need `moveCStr`-equivalent logic that tracks display width (`wcwidth`) and handles double-width characters.

---

## 8. Pure Render vs Agent-Accessible

| View | Pure Render | Agent Commands | Notes |
|------|:-----------:|:--------------:|-------|
| Quadra | ✅ | ❌ | Keyboard only |
| Snake | ✅ | ❌ | Keyboard only |
| Game of Life | ✅ | ❌ | Mouse click reseeds |
| Rogue | ❌ | ⚠️ Partial | Emits `cmRogueHackTerminal` → app spawns terminal. No direct API. |
| Deep Signal | ❌ | ⚠️ Partial | Emits `cmDeepSignalTerminal` → app spawns terminal. No direct API. |
| Orbit | ✅ | ❌ | |
| Torus | ✅ | ❌ | |
| Cube | ✅ | ❌ | |
| Mycelium | ✅ | ❌ | |
| Verse | ✅ | ❌ | |
| Monster Cam | ✅ | ❌ | External socket dependency (Python worker) |
| Monster Verse | ✅ | ❌ | |
| Monster Portal | ✅ | ❌ | |
| Contour Map | ❌ | ❌ | External subprocess dependency |
| Generative Lab | ❌ | ✅ Full API | `handleApiAction()` with 15+ actions |
| Animated * | ✅ | ❌ | |
| ASCII Grid | ✅ | ❌ | Utility primitive |

---

## 9. Complexity Estimates for TS Port

| View | Lines (approx) | Complexity | External Deps | Port Effort |
|------|:--------------:|:----------:|:--------------:|:-----------:|
| Animated Blocks | 80 | Trivial | None | 🟢 1–2 hrs |
| Animated Gradient | 70 | Trivial | None | 🟢 1–2 hrs |
| ASCII Grid | 100 | Trivial | None | 🟢 2 hrs |
| Game of Life | 200 | Low | None | 🟢 3–4 hrs |
| Animated ASCII | 120 | Low | None | 🟢 2–3 hrs |
| Animated Score | 150 | Low | None | 🟢 3 hrs |
| Cube Spinner | 140 | Low | None | 🟢 3 hrs |
| Mycelium | 150 | Low | None | 🟢 3 hrs |
| Orbit | 150 | Low | None | 🟢 3 hrs |
| Snake | 280 | Low–Med | None | 🟡 4–6 hrs |
| Verse | 220 | Low–Med | None | 🟡 4 hrs |
| Quadra | 350 | Medium | None | 🟡 6–8 hrs |
| Torus | 180 | Medium | None | 🟡 4–5 hrs |
| Monster Verse | 350 | Med–High | None | 🟡 6–8 hrs |
| Monster Portal | 380 | Med–High | None | 🟡 6–8 hrs |
| Rogue | 620 | High | App events | 🔴 12–16 hrs |
| Deep Signal | 550 | High | App events | 🔴 10–14 hrs |
| Monster Cam | 400 | High | Unix socket + Python worker | 🔴 10–12 hrs |
| Contour Map | 450 | High | Python subprocess | 🔴 12–16 hrs |
| Generative Lab | 700 | Very High | Python subprocess + API + Dialog | 🔴 20–30 hrs |

---

## 10. Recommendations

### 10.1 Port First (quick wins, validates infrastructure)

1. **Game of Life** — Validates timer, cell-buffer rendering, resize handling. Sparse-grid algorithm is straightforward in TS. ~3 hrs.
2. **Animated Blocks / Gradient** — Simplest possible timer+render views. Proves the TView base pattern works. ~2 hrs each.
3. **Snake** — First real game. Validates keyboard input handling, game-loop separation. Board-size-dependent layout tests resize. ~5 hrs.
4. **Cube Spinner** — Simplest 3D generative view. Validates the palette system and per-pixel `setCell` pattern. ~3 hrs.

### 10.2 Port Second (core content, moderate effort)

5. **Quadra** — Core game. SRS piece data can be ported as literal arrays. Ghost piece + chain scoring are the tricky bits.
6. **Orbit / Mycelium / Verse** — All follow the same generative skeleton. Port one, and the others are ~1 hr incremental each. Verse is most feature-rich (3 modes).
7. **ASCII Grid** — Utility needed by other views. Port alongside emoji views.

### 10.3 Port Later (complex, external dependencies)

8. **Rogue** — Large but self-contained game. BSP generation can be ported directly. The `cmRogueHackTerminal` event needs the app shell command dispatch to exist first.
9. **Deep Signal** — Similar to Rogue but turn-based (no timer). ASCII art embedding is unique.
10. **Monster Verse / Portal** — Emoji rendering via `moveCStr` needs `wcwidth`-aware cell writing. Port after ASCII Grid proves emoji works.

### 10.4 Skip or Defer

- **Monster Cam** — Unix domain socket to Python OpenCV worker. Requires either: (a) a WebSocket equivalent for the camera feed, or (b) WebRTC face detection in browser. Defer until there's a clear camera story.
- **Contour Map** — Python subprocess. Either rewrite `contour_stream.py` in TS, or expose it as a WebSocket service. Don't try to pipe-fork in Node/browser.
- **Generative Lab** — Same subprocess issue as Contour Map, plus the stamp picker dialog (which needs the full dialog system ported). This should be one of the last views ported. However, its `handleApiAction()` interface is valuable — consider exposing a TS API equivalent early.

### 10.5 Shared Abstractions to Build

| Abstraction | Why |
|-------------|-----|
| `AnimatedView` base class | Timer lifecycle, `advance()`/`draw()` contract, pause/resume, palette index cycling. Covers ~12 views. |
| `CellBuffer` | 2D grid of `{char, fg, bg}` cells with `setCell(x, y, ch, attr)` and `writeLine()`. Replaces both `vector<TScreenCell>` and `TDrawBuffer` patterns. |
| `Palette` system | 3-palette × 5-stop gradient with `sample(paletteIndex, t)`. Reused by all generative views verbatim. |
| `GameView` base class | Extends `AnimatedView` with keyboard input dispatch, game-over/paused state, HUD rendering helpers. |
| `ValueNoise` + `FBM` | Cheap hash-based value noise + fractional Brownian motion. Used by Verse, Mycelium, Monster Verse, Monster Portal. Identical implementation in all four — extract once. |
| `WideCharWriter` | `wcwidth`-aware string writer for emoji content. Replaces `TDrawBuffer::moveCStr` with `TAttrPair`. |
| `SubprocessBridge` | For Contour Map / Generative Lab if ported. WebSocket or child_process wrapper with frame protocol parsing. |

### 10.6 Suggested Port Order (critical path)

```
Phase 1 — Infrastructure validation:
  AnimatedView + CellBuffer + Palette → Game of Life → Animated Blocks

Phase 2 — Games:
  GameView base → Snake → Quadra

Phase 3 — Generative art:
  ValueNoise/FBM → Orbit → Verse → Mycelium → Torus → Cube

Phase 4 — Emoji views:
  WideCharWriter + ASCII Grid → Monster Verse → Monster Portal

Phase 5 — Complex games:
  Rogue → Deep Signal

Phase 6 — Subprocess views (if needed):
  SubprocessBridge → Contour Map → Generative Lab
```
