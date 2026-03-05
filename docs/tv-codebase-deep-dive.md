# WibWob-DOS Turbo Vision C++ — Comprehensive Codebase Deep-Dive

**Date:** 2026-03-05  
**Source repo:** `wibandwob-dos-last-days-of-tvision`  
**Purpose:** Reference implementation catalogue for porting and future development.

---

## Table of Contents

1. [Window Types — Complete Catalogue](#1-window-types--complete-catalogue)
2. [Menu Structure](#2-menu-structure)
3. [Generative Art & Animation](#3-generative-art--animation)
4. [Music / Audio](#4-music--audio)
5. [Text & Content Systems](#5-text--content-systems)
6. [Games](#6-games)
7. [Companion: Scramble the Cat](#7-companion-scramble-the-cat)
8. [Agent / AI Integration](#8-agent--ai-integration)
9. [Desktop Management](#9-desktop-management)
10. [Network / API](#10-network--api)
11. [Services & Infrastructure](#11-services--infrastructure)
12. [Backrooms Content System](#12-backrooms-content-system)
13. [Command Palette / Registry](#13-command-palette--registry)
14. [Unique & Distinctive Features](#14-unique--distinctive-features)

---

## 1. Window Types — Complete Catalogue

All window types are registered in `app/window_type_registry.cpp` with a slug, a spawn function, and a type-match predicate. There are **39 registered types**.

### 1.1 Developer / Diagnostic Windows

| Slug | Class / View | Description | Interactive | Source |
|------|-------------|-------------|-------------|--------|
| `test_pattern` | `TTestPatternView` | Colourful test pattern grid (CGA palette, diagonal animation). First window type ever created. | No (decorative) | `wwdos_app.cpp` |
| `gradient` | `TGradientView` | Static gradient: horizontal, vertical, radial, or diagonal. Configurable via `gradient=` param. | No | `gradient.h/.cpp` |
| `frame_player` | `FrameFilePlayerView` / `TTextFileView` | Loads a `----`-delimited frame file and plays it as a timer-driven ASCII animation. Also opens plain text files. Optional `frameless`, `shadowless`, `title` flags. FPS from file header or constructor. | Pause/resume | `frame_file_player_view.h/.cpp` |
| `text_view` | `TTransparentTextWindow` | Read-only scrollable plain text viewer with transparent background (desktop shows through). | Scroll only | `transparent_text_view.h/.cpp` |

### 1.2 Creative / Editor Windows

| Slug | Class / View | Description | Interactive | Source |
|------|-------------|-------------|-------------|--------|
| `text_editor` | `TTextEditorWindow` / `TTextEditorView` | Full freeform text editor. Supports `sendText()` (append/prepend/replace modes), `sendFigletText()` (render FIGlet into editor), word-wrap. Created by IPC `send_text` auto-spawn path. | Yes — keyboard edit | `text_editor_view.h/.cpp` |
| `paint` | `TPaintWindow` / `TPaintCanvasView` | ASCII paint canvas with tools (Pencil, Eraser, Line, Rect, Text), 16-colour BIOS palette, subpixel modes (Full / HalfY / HalfX / Quarter), FIGlet stamp dialog. Saves/loads `.wwp` JSON format. Full IPC remote-control API. | Yes — draw, cursor | `paint/paint_window.h`, `paint_canvas.h/.cpp`, `paint_tools.h`, `paint_palette.h`, `paint_wwp_codec.h` |
| `figlet_text` | `TFigletTextWindow` / `TFigletTextView` | Displays FIGlet-rendered ASCII typography. Supports 100+ fonts via category sub-menu. Right-click context menu: font picker, edit text, color, shadow/frame toggles. Can be frameless+shadowless (borderless floating typography). IPC-controllable text/font/color. | Right-click menu | `figlet_text_view.h/.cpp`, `figlet_utils.h/.cpp` |

### 1.3 Animated / Generative Art Windows

| Slug | Class / View | Description | Timer (ms) | Source |
|------|-------------|-------------|------------|--------|
| `animated_gradient` | `TAnimatedHGradientView` | Horizontally flowing colour gradient (blue→magenta default). All cells shift each tick. | 100 | `animated_gradient_view.h/.cpp` |
| `blocks` | `TAnimatedBlocksView` | Zigzag block characters. Even rows shift right, odd rows shift left; colours rotate. | 42 | `animated_blocks_view.h/.cpp` |
| `score` | `TAnimatedScoreView` | Animated musical ASCII score: multi-row Unicode notation glyphs with phase shifts, breathing, drift, glyph cycling. Configurable BG colour. | 120 | `animated_score_view.h/.cpp` |
| `ascii` | `TAnimatedAsciiView` | Multi-layer animated ASCII art: kaomoji bob up/down, `≋` wave chars flow horizontal, `⊖⊕` circles drift, `∿` squiggles wiggle, block chars `▓▒░` slide, triangles bounce, arrows race. | 120 | `animated_ascii_view.h/.cpp` |
| `verse` | `TGenerativeVerseView` | Layered wave/flow/swirl/weave field. Three modes (Flow, Swirl, Weave). Evolving colour palettes. Left/right arrows cycle palette; space cycles mode. | 50 | `generative_verse_view.h/.cpp` |
| `mycelium` | `TGenerativeMyceliumView` | Curl-noise organic branching with living-weave motifs. Evolving palettes. | 55 | `generative_mycelium_view.h/.cpp` |
| `orbit` | `TGenerativeOrbitView` | Radial interference from multiple rotating attractors. Evolving colour bands and ripple animation. | 50 | `generative_orbit_view.h/.cpp` |
| `torus` | `TGenerativeTorusView` | Classic ASCII donut (z-buffer shading) with animated rotation on A and B axes. Vertical-stretch compensation for terminal aspect ratio. | 40 | `generative_torus_view.h/.cpp` |
| `cube` | `TGenerativeCubeView` | Wireframe 3D cube with perspective projection, per-edge depth colouring, continuous rotation on 3 axes. | 45 | `generative_cube_view.h/.cpp` |
| `life` | `TGameOfLifeView` | Conway's Game of Life, sparse-grid implementation (O(living_cells)). Seeded randomly or with Glider pattern. Auto-reseed on stagnation. | 400 | `game_of_life_view.h/.cpp` |
| `monster_verse` | `TGenerativeMonsterVerseView` | Verse-style flow/swirl/weave field using emoji monster glyphs instead of ASCII punctuation. Configurable whitespace bias, emoji density, head density overlay, flood mode. | 60 | `generative_monster_verse_view.h/.cpp` |
| `monster_portal` | `TGenerativeMonsterPortalView` | Tiled emoji portal pattern (brick-offset rows), gradual glitch decay, horizontal drift, 4-episode arc (BREATHE→HAUNT→FLAME→COLLAPSE). Very slow temporal evolution (per-cell latch rate). | 90 | `generative_monster_portal_view.h/.cpp` |
| `monster_cam` | `TGenerativeMonsterCamView` | Reads from a Unix socket; receives webcam luminance frames + face bounding box. Renders face position as emoji on empty field. Smoothed tracking with deadband stabilisation. HUD shows FPS and connection status. Falls back to minimal sprite when no camera. | 80 | `generative_monster_cam_view.h/.cpp`, `tools/face_worker.py` |
| `contour_map` | `TContourMapView` (TScroller) | Forks `tools/contour_stream.py`. Python generates ASCII terrain contour maps (7 terrain types, configurable levels, grow mode, triptych mode). Scrollable output with live pipe polling. Save-to-file. Config dialog at launch. | 50 (pipe poll) | `contour_map_view.h/.cpp`, `tools/contour_stream.py` |
| `generative_lab` | `TGenerativeLabView` | Forks `tools/generative_stream.py`. 10 Python cellular automata presets: `game-of-life`, `corners-bleed`, `eno-bloom`, `coral-reef`, `mycelium`, `crystal`, `tidal`, `erosion`, `aurora`, `spiral-life`. Accepts stamp overlays (ASCII art files placed at x,y). Canvas mode. Config dialog with preset picker and seed control. | 50 (pipe poll) | `generative_lab_view.h/.cpp`, `tools/generative_stream.py` |
| `animated_ascii_view` (standalone) | `TAnimatedAsciiView` | Same as `ascii` above but launched via menu. | 120 | Same |

### 1.4 Games

| Slug | Class / View | Description | Source |
|------|-------------|-------------|--------|
| `quadra` | `TQuadraView` | Tetris clone. 10×20 board. All 7 standard tetrominoes (bag randomiser for fairness). Hard-drop, rotation, gravity increase with level. Score / lines / level / chain display. 2-char-wide cells for square look. | `quadra_view.h/.cpp` |
| `snake` | `TSnakeView` | Classic Snake. Board fills view minus 18-col HUD. Food sparkle animation. Speed increases with score. High-score persistence within session. Death flash. | `snake_view.h/.cpp` |
| `rogue` | `TRogueView` | WibWob Rogue dungeon crawler. Procedural multi-floor dungeons. Creatures (Rat, Bat, Skeleton, Goblin, Glitch, Boss). Items (Potion, Scroll, Key, Gold, Weapon, Armour, DataChip). Player stats (HP, attack, defense, XP, level, floor). Hackable terminals → spawn tvterm window. | `rogue_view.h/.cpp` |
| `deep_signal` | `TDeepSignalView` | Space scanner exploration. 80×40 world map (stars, nebulae, asteroids, fuel depots, signal beacons, anomalies). 90° FOV cone scanner you rotate N/E/S/W. Fuel management. Signal decoding puzzles. Anomaly investigation. Log pane. Deep-scan mode. | `deep_signal_view.h/.cpp` |
| `micropolis_ascii` | `TMicropolisAsciiView` | Micropolis city-builder (the open-source SimCity engine) rendered in ASCII. Full sim engine (residential/commercial/industrial zones, roads, power, water, fire, disasters). Camera pan + cursor. Tool palette: Query, Road, Rail, Wire, Bulldoze, Park, Residential, Commercial, Industrial, Fire Station, Police, Stadium, Seaport, Power Plant, Nuclear, Airport. 4 simulation speeds + pause. 3 save slots. | `micropolis_ascii_view.h/.cpp`, `micropolis/micropolis_bridge.h/.cpp` |

### 1.5 Communication / AI Windows

| Slug | Class / View | Description | Source |
|------|-------------|-------------|--------|
| `wibwob` | `TWibWobWindow` / `TWibWobMessageView` + `TWibWobInputView` | Wib&Wob AI chat. Streaming LLM responses via Claude Code SDK bridge (Node.js subprocess). Full message history, role-mapped chat log (user/assistant/system), scrollable message pane, single-line input. IPC: `wibwob_ask`, `get_chat_history`, `chat_receive`. | `wibwob_view.h/.cpp`, `wibwob_engine.h/.cpp` |
| `scramble` | `TScrambleWindow` / `TScrambleView` + `TScrambleMessageView` | Scramble the cat companion (see §7). | `scramble_view.h/.cpp`, `scramble_engine.h/.cpp` |
| `room_chat` | `TRoomChatWindow` / `TRoomMessageView` + `TRoomParticipantStrip` | Multi-user PartyKit chat room. Participant list strip (left), scrollable message log (right), inline input. Messages coloured by sender hash. IPC: `room_chat_receive`, `room_presence`. Slash commands. | `room_chat_view.h/.cpp` |

### 1.6 Browser & Terminal

| Slug | Class / View | Description | Source |
|------|-------------|-------------|--------|
| `browser` | `TBrowserWindow` / `TBrowserView` | In-terminal web browser. Fetches URLs and displays formatted text. `fetchUrl()` callable via IPC (`browser_fetch`). | `browser_view.h/.cpp`, `browser_window.h/.cpp` |
| `terminal` | `TWibWobTerminalWindow` | Full PTY terminal emulator via `tvterm` (libvterm). Runs a shell. `sendText()` injects keystrokes; `getOutputText()` reads visible buffer. IPC: `terminal_write`, `terminal_read`. | `tvterm_view.h/.cpp`, vendor `tvterm` library |

### 1.7 Browsers / Utilities

| Slug | Class / View | Description | Source |
|------|-------------|-------------|--------|
| `gallery` | `TGalleryWindow` | ASCII Art Gallery browser. Tabbed file browser (6 tabs: #-C, D-L, M, N-S, T-Z, Find). Left file list + right preview pane. Scans the `primers/` directory. Open button loads a text_view/frame_player on the selected file. IPC: `gallery_list`. | `ascii_gallery_view.h/.cpp` |
| `app_launcher` | `TAppLauncherWindow` | Application launcher grid (macOS Finder style). Icon cells (20×4 chars). Category tabs (All / Games / Tools / Creative / Demos). Keyboard navigation, Enter launches. | `app_launcher_view.h/.cpp` |
| `backrooms_tv` | `TBackroomsTvWindow` / `TBackroomsTvView` | Live LLM ASCII art stream (see §12). | `backrooms_tv_view.h/.cpp` |

---

## 2. Menu Structure

Defined in `TWwdosApp::initMenuBar()` in `wwdos_app.cpp`.

### File (`Alt-F`)
```
New Test Pattern             Ctrl-N
New H-Gradient
New V-Gradient
New Radial Gradient
New Diagonal Gradient
─────────────────────────────────────
New Animation (Donut)        Ctrl-D
─────────────────────────────────────
Open Text/Animation…         Ctrl-O
Open Image…
Open Monodraw…
─────────────────────────────────────
Save Workspace               Ctrl-S
Save Workspace As…
Open Workspace…
Manage Workspaces…
Recent >                     (dynamic submenu, last 5)
─────────────────────────────────────
Exit                         Alt-X
```

### Edit (`Alt-E`)
```
Copy Page                    Ctrl-Ins
─────────────────────────────────────
Screenshot                   Ctrl-P
─────────────────────────────────────
Pattern Mode >
    • Continuous (Diagonal)
    • Tiled (Cropped)
─────────────────────────────────────
FIGlet Edit Text…
FIGlet Font >                (category sub-menus, 100+ fonts, More Fonts…)
```

### View (`Alt-V`)
```
ASCII Grid Demo
─────────────────────────────────────
Animated Blocks
Animated Gradient
Animated Score
Score BG Color…
─────────────────────────────────────
Verse Field (Generative)
Orbit Field (Generative)
Mycelium Field (Generative)
Torus Field (Generative)
Cube Spinner (Generative)
Monster Portal (Generative)
Monster Verse (Generative)
Monster Cam (Emoji)
Backrooms TV
─────────────────────────────────────
Applications
ASCII Gallery
─────────────────────────────────────
Games >
    Micropolis City Builder
    Quadra (Falling Blocks)
    Snake
    WibWob Rogue
    Deep Signal
─────────────────────────────────────
Paint Canvas
FIGlet Text
─────────────────────────────────────
Scramble Cat               F8
```

### Window (`Alt-W`)
```
Text Editor
Browser                    Ctrl-B
Terminal
Open Text File (Transparent)…
─────────────────────────────────────
Cascade
Tile
Send to Back
─────────────────────────────────────
Next                       F6
Previous                   Shift-F6
─────────────────────────────────────
Close                      Alt-F3
Close All
```

### Tools (`Alt-T`)
```
Wib&Wob Chat               F12
Room Chat
─────────────────────────────────────
Quantum Printer            F11
─────────────────────────────────────
API Key…
```
*(Note: Glitch Effects, Test A/B/C, ANSI Editor, Animation Studio menus were removed in E009.)*

### Help (`Alt-H`)
```
About WIBWOBWORLD
Keyboard Shortcuts
API Key Help
LLM Status
```

### Status Line (always visible)
```
Alt-X Exit | Ctrl-N New Window | F5 Repaint | F6 Next | Alt-F3 Close | F8 Scramble
```
Custom `TCustomStatusLine` also shows IPC connection status indicator (listening/active/client count).

---

## 3. Generative Art & Animation

### 3.1 Pure C++ Timer-driven Views

All use Turbo Vision's `setTimer()/killTimer()` + `cmTimerExpired` event loop. No threads.

| View | Algorithm | Palette system | FPS target |
|------|-----------|---------------|------------|
| `TAnimatedBlocksView` | Phase-shift offset per row (even/odd direction flip), colour index modulo | CGA 16-colour | ~24 fps (42ms) |
| `TAnimatedHGradientView` | Linear RGB interpolation across columns, phase shifts hue start | RGB direct | 10 fps (100ms) |
| `TAnimatedScoreView` | Musical notation glyphs `♩♪♫♬` + barlines, multi-row phase + breathing + per-glyph drift; background palette cycling | TColorAttr direct | ~8 fps (120ms) |
| `TAnimatedAsciiView` | Fixed ASCII art template; each "line" classified by dominant glyph into 8 layers; layers move independently (bob, scroll, wiggle, static) | Colour by layer | ~8 fps (120ms) |
| `TGenerativeVerseView` | Sine-wave interference fields (multiple frequencies, phase-locked to frame), 3 modes: Flow (parallel waves), Swirl (radial + tangential), Weave (cross-product grid). Cell value → glyph from Unicode set + palette colour. | Cyclic palette tables (8+ palettes) | 20 fps (50ms) |
| `TGenerativeMyceliumView` | Curl-noise field (perlin-curl approximation) with branching; each cell's glyph chosen by velocity angle + magnitude. Colour from palette index + noise magnitude. | Same cyclic palettes | ~18 fps (55ms) |
| `TGenerativeOrbitView` | N rotating point attractors; each cell's value = sum of 1/r² influence from all attractors. Value → glyph + colour. Attractors rotate at different speeds. | Cyclic palette | 20 fps (50ms) |
| `TGenerativeTorusView` | Classic Donut algorithm: A/B rotation matrices, z-buffer per-cell, shading chars `.,-~:;=!*#$@`. Projection accounts for terminal aspect ratio (yStretch=1.25). | Palette colouring on depth | 25 fps (40ms) |
| `TGenerativeCubeView` | 8 wireframe vertices, perspective divide, draw 12 edges via Bresenham. Per-edge colour by average depth. | Per-edge depth colour | ~22 fps (45ms) |
| `TGameOfLifeView` | Sparse grid using `unordered_set<CellCoord>`. Neighbour counting O(living_cells). Auto-reseed when population drops below threshold or stabilises. | CGA 16-colour by age | 2.5 fps (400ms) |
| `TGenerativeMonsterVerseView` | Same interference math as Verse but glyph table is emoji monsters (multi-codepoint). Configurable emoji/whitespace/head density. | Same palettes | ~17 fps (60ms) |
| `TGenerativeMonsterPortalView` | Tiled emoji grid (brick-offset rows). Glitch parameter grows over time (episode system). Per-cell latch: each cell updates at ~0.2 Hz. Episode arc: BREATHE/HAUNT/FLAME/COLLAPSE cycles over ~7 minutes. | None (emoji on black) | ~11 fps (90ms) |

### 3.2 Python Subprocess Views

Both use `fork()`/`pipe()`/`execvp()` pattern. The C++ side polls the pipe on a 50ms timer and streams rendered rows into a TScroller buffer.

**ContourMapView (`tools/contour_stream.py`)**
- 7 terrain types: archipelago, saddle pass, ridge valley, caldera, lone peak, meadow, twin peaks
- Configurable levels (contour lines), grow mode (coast expansion), triptych (3-panel render)
- Renders to ASCII art characters with colour coding per elevation band
- Optional `mode` (render style) and `orderRatio` (order/chaos blend)

**GenerativeLabView (`tools/generative_stream.py`)**
- 10 presets driven by different cellular automata / field rules:
  - `game-of-life` — Conway binary (binary substrate, half-size grid)
  - `corners-bleed` — Bleeding edges from corners (block cells)
  - `eno-bloom` — Bloom algorithm inspired by Eno's ambient systems (binary)
  - `coral-reef` — Coral growth simulation (contour cells)
  - `mycelium` — Branching growth (binary)
  - `crystal` — Crystal nucleation simulation (binary)
  - `tidal` — Tidal wave pattern (block cells)
  - `erosion` — Erosion/deposition simulation (contour)
  - `aurora` — Aurora-style glyph field
  - `spiral-life` — Spiral Life hybrid (contour)
- Accepts stamp overlays (ASCII art placed at x,y, immune to rules)
- Canvas mode (static-then-generate)

### 3.3 MonsterCam (`tools/face_worker.py`)

- Python worker reads webcam via OpenCV or similar
- Sends luminance frames + face bounding box over Unix socket
- C++ `TGenerativeMonsterCamView` reads binary protocol: header (4 bytes length) + JSON payload
- Renders face position as emoji cluster; emoji shifts to follow face with smoothed tracking (deadband: 1.0 col, 1.0 row)
- Sticky face persistence: last known position held for 900ms after face disappears
- Debug HUD shows: `connecting|N frames|X.X fps` in dim grey bottom row

---

## 4. Music / Audio

**There is no audio output in this codebase.**

The closest feature is the **Animated Score View** (`TAnimatedScoreView`) — a purely visual representation of musical notation using Unicode chars (`♩♪♫♬▬─│`). It is decorative ASCII animation, not a music system.

No MIDI, no chiptune synthesis, no PCM, no sound device access. The Backrooms TV outputs text, not sound. The Scramble cat does not speak aloud.

If audio is needed for a port, it must be added from scratch. The `chiptune-bricks` skill in `.pi/skills/chiptune-bricks/` is a separate Python toolkit that can be used separately.

---

## 5. Text & Content Systems

### 5.1 Frame File Player
- **Format:** Plain text file. Frames delimited by lines that are exactly `----`. CRLF-safe.
- **Header (optional):** `FPS=30` on first line sets playback rate.
- **Auto-sizing:** Window sized to largest frame (max width × max height across frames).
- **Transparency:** Background type configurable (Solid, Transparent, VerticalGradient, HorizontalGradient, RadialGradient, DiagonalGradient).
- **Source:** `frame_file_player_view.h/.cpp`

### 5.2 Transparent Text View
- `TTransparentTextWindow` — read-only TScroller, white text on transparent background.
- Desktop wallpaper shows through (composited via TView hit-test).
- Source: `transparent_text_view.h/.cpp`

### 5.3 Text Editor
- `TTextEditorView` — freeform editable text with word-wrap.
- **`sendText(content, mode, position)`** API:
  - `mode`: `"append"`, `"prepend"`, `"replace"`
  - `position`: positional hint
- **`sendFigletText(text, font, width, mode)`** — renders FIGlet and inserts the rendered text block.
- Source: `text_editor_view.h/.cpp`

### 5.4 FIGlet Typography
- Shells out to the `figlet` CLI binary.
- `figlet_utils.h/.cpp` wraps: `render()`, `renderLines()`, `listFonts()`, `allFontsSorted()`, `fontHeight()`, `buildCategoryMenuItems()`.
- **100+ fonts** bundled or found on system, organised into categories.
- `TFigletTextView` renders at view width, re-renders on resize.
- Color: configurable RGB fg/bg via `TColorAttr(TColorRGB(...))`.
- **Frameless / shadowless** mode: uses `TGhostFrame` (from `notitle_frame.h`) to remove window chrome entirely — typography floats on the desktop.
- Source: `figlet_text_view.h/.cpp`, `figlet_utils.h/.cpp`

### 5.5 Primer / ASCII Gallery System
- **Primer files:** Plain `.txt` files in `primers/` directory (or `wibandwob-backrooms/primers/`).
- Content ranges from short ASCII art pieces to multi-page illustrated text documents.
- `TGalleryWindow` (`ascii_gallery_view.h/.cpp`) provides tabbed browsing:
  - Tab 0: `#-C`, Tab 1: `D-L`, Tab 2: `M`, Tab 3: `N-S`, Tab 4: `T-Z`, Tab 5: `Find` (search input)
  - Left pane: file list with scroll. Right pane: live preview.
  - Enter / Open button: loads selected file as `frame_player` window.
- `core/primer_utils.h` — `findPrimerDir()` searches common locations.
- IPC: `gallery_list` returns JSON of primer filenames, filterable by tab.
- IPC: `open_primer` opens a primer file by name (auto-resolves bare filename to primer dir).

### 5.6 Monodraw `.monojson` Files
- `tools/api_server/monodraw_parser.py` parses Monodraw JSON exports.
- Menu: File → Open Monodraw… → `TFileDialog` for `*.monojson`.
- Displayed as a frame_player or text_view window (exact implementation in wwdos_app.cpp handler).

### 5.7 Image Files (ASCII conversion)
- Menu: File → Open Image… → `TFileDialog` for `*.{png,jpg,jpeg}`.
- `app/stb_image.h` (STB single-header image loader) likely used for decoding.
- Image converted to ASCII art for display.

---

## 6. Games

### 6.1 Quadra (`TQuadraView`) — `quadra_view.h/.cpp`
- **Board:** 10×20 cells. Each cell rendered as 2 characters wide for square appearance.
- **Pieces:** 7 standard tetrominoes (I, O, T, S, Z, J, L) with bag randomiser (fair distribution).
- **Controls:** Left/Right (move), Up/Z (rotate CW/CCW), Down (soft drop), Space (hard drop), P (pause).
- **Mechanics:** Line clear with gravity, chain tracking, level increases speed.
- **Scoring:** Line clears × level multiplier + chain bonus.
- **Display:** Board + next piece preview + score/lines/level panel.
- **Timer:** 500ms base, decreases with level.

### 6.2 Snake (`TSnakeView`) — `snake_view.h/.cpp`
- **Board:** fills view width minus 18-col HUD.
- **Controls:** Arrow keys for direction.
- **Food:** Sparkle animation (4-frame). Multiple food items may exist.
- **Speed:** `currentSpeed()` returns `basePeriodMs / (1 + eaten/10)` — gets faster as you eat.
- **HUD:** Score, high score (session), lives indicator.
- **Death:** Flash animation (countdown).

### 6.3 WibWob Rogue (`TRogueView`) — `rogue_view.h/.cpp`
- **Map:** Procedurally generated multi-room dungeons per floor.
- **Tiles:** Wall, Floor, Door, StairsDown, StairsUp, Water, Terminal.
- **Creatures:** Rat, Bat, Skeleton, Goblin, Glitch (near terminals), Boss.
- **Items:** Potion, Scroll, Key, Gold, Weapon, Armour, DataChip.
- **Player stats:** HP, MaxHP, Attack, Defense, Gold, Level, XP, XPNext, Floor, HasKey.
- **Hackable terminals:** Walking onto a Terminal tile can trigger `cmRogueHackTerminal` → spawns a tvterm window for "hacking".
- **Message log:** `std::deque<SignalLog>` scrolling log at bottom of view.
- **Controls:** Arrow keys move/attack, `g` get item, `>` stairs, `?` help.

### 6.4 Deep Signal (`TDeepSignalView`) — `deep_signal_view.h/.cpp`
- **World:** 80×40 grid with procedurally placed stars (3 intensities), nebulae, asteroids, fuel depots, signal beacons, anomalies.
- **Scanner:** 90° FOV cone (N/E/S/W). Range 12 (normal) or 20 (deep scan).
- **Resources:** Fuel depletes on movement/scanning. Refuel at depots.
- **Puzzles:** 5 signal beacon types to decode. 3 anomaly types to investigate.
- **Log pane:** Right side shows `SignalLog` entries colour-coded by type (normal/good/bad/info/signal).
- **Special:** `cmDeepSignalTerminal` — can spawn a tvterm for "signal analysis".

### 6.5 Micropolis City Builder (`TMicropolisAsciiView`) — `micropolis_ascii_view.h/.cpp`
- Full Micropolis (SimCity) engine via `MicropolisBridge` (`micropolis/micropolis_bridge.h/.cpp`).
- **Emscripten compat shim:** `micropolis/compat/emscripten.h` allows engine to compile natively.
- **Tools:** Query(5), Road, Rail, Wire, Bulldoze, Park, Residential, Commercial, Industrial, FireStation, Police, Stadium, Seaport, PowerPlant, Nuclear, Airport.
- **Camera:** Pan with arrows/WASD. Cursor separate from camera.
- **Simulation speeds:** 0=Pause, 1=Slow, 2=Medium, 3=Fast, 4=Ultra (controlled by `f`/`s` keys).
- **Save slots:** 3 slots, `[` / `]` cycle, `S` saves, `L` loads.
- **Snapshot API:** `snapshot()` returns full `MicropolisSnapshot` struct (for IPC querying).
- **Auto-pan:** Camera slowly drifts toward cursor if far from centre.

---

## 7. Companion: Scramble the Cat

Scramble is the "symbient cat" — a resident AI companion that lives in the corner of the desktop.

### 7.1 Architecture

**`TScrambleView`** (`scramble_view.h/.cpp`) — the visual renderer:
- Renders ASCII cat art (12×8 chars) in one of 3 poses: Default, Sleeping, Curious.
- Speech bubble: up to 24 chars wide, word-wrapped, displayed above/beside cat.
- Bubble auto-fades after 5 seconds.
- **Two display states:**
  - `sdsSmol` — small window: cat + bubble only, 12-ish cols wide.
  - `sdsTall` — tall window: cat + `TScrambleMessageView` (scrollable message history).
- 10 Hz timer for bubble fade countdown and idle pose changes.
- Idle timer randomly cycles poses at configurable thresholds.

**`ScrambleEngine`** (`scramble_engine.h/.cpp`) — the brain:
- **`ScrambleHaikuClient`** — LLM backend with 3 modes:
  1. Direct Anthropic API via `curl` subprocess (reads ANTHROPIC_API_KEY)
  2. `claude` CLI subprocess (uses `claude /login` auth)
  3. OpenRouter free tier fallback (OPENROUTER_API_KEY)
- Async LLM calls: `startAsync()` opens a `popen()` pipe; `poll()` checks completion (non-blocking).
- Rate limiting: 1-second minimum gap between API calls.
- **Slash commands** (handled before LLM):
  - `/help` — shows command list
  - `/sleep` — Scramble takes a nap
  - `/wake` — Scramble wakes up
  - `/meow` — Scramble says meow
  - `/version` — version info
  - *(extensible)*

**`TScrambleMessageView`** — message history list, only visible in `sdsTall` mode.

### 7.2 Interaction Flow
1. F8 or menu toggles Scramble visibility (Hidden → Smol → Hidden).
2. Second press of cmScrambleExpand cycles Smol → Tall.
3. User types in the input or IPC sends `scramble_say text=Hello`.
4. Slash commands handled synchronously; other text sent to Haiku async.
5. Response arrives → `TScrambleView::say()` called → bubble shown for 5s.
6. IPC: `scramble_pet` returns a canned response ("she allows it").

### 7.3 IPC Commands for Scramble
```
open_scramble     — toggle visibility
scramble_expand   — toggle smol/tall
scramble_say      text=<message>
scramble_pet      — pet the cat
```

---

## 8. Agent / AI Integration

### 8.1 LLM Provider Abstraction (`app/llm/`)

**`ILLMProvider`** interface (`llm/base/illm_provider.h`):
```cpp
virtual bool sendQuery(const LLMRequest& request, ResponseCallback callback) = 0;
virtual bool isAvailable() const = 0;
virtual bool isBusy() const = 0;
virtual void cancel() = 0;
virtual void poll() {}
```

**`LLMRequest`**: message, system_prompt, session_id, temperature, max_tokens, stream flag, tools list, tool_results.  
**`LLMResponse`**: result, session_id, cost, duration_ms, is_error, model_used, provider_name, tool_calls.  
**`StreamChunk`**: type (CONTENT_DELTA/MESSAGE_COMPLETE/ERROR_OCCURRED/SESSION_UPDATE), content.

**Providers:**
- `AnthropicApiProvider` (`llm/providers/anthropic_api_provider.h/.cpp`) — direct Anthropic HTTP API.
- `ClaudeCodeSDKProvider` (`llm/providers/claude_code_sdk_provider.h/.cpp`) — spawns Node.js SDK bridge.
- `LLMProviderFactory` — selects provider from `llm/config/llm_config.json`.

### 8.2 Claude Code SDK Bridge (`app/llm/sdk_bridge/`)

Node.js subprocess that bridges C++ ↔ Claude Code SDK:

- `claude_sdk_bridge.js` — main bridge process. Reads JSON commands from stdin, writes JSON responses to stdout.
- `sdk_loader.js` — loads `@anthropic-ai/claude-agent-sdk` with fallback paths.
- `mcp_tools.js` — creates MCP server with 2 tools:
  - `tui_list_commands` — calls `GET http://localhost:8089/commands` → returns full C++ command registry.
  - `tui_menu_command` — calls API to execute any named command with args.
- `smoke_test.js` — health check.
- Allowed tools: `Read`, `Write`, `Grep`, `WebSearch`, `WebFetch` (+ MCP tools).
- Max turns: 50.
- Session resumption: tracks `sdkSessionId` for conversation continuity.

### 8.3 Tool System (`app/llm/`)

**`ITool` / `IToolExecutor`** (`llm/base/itool.h`):
```cpp
struct Tool { name, description, input_schema, category, async };
struct ToolCall { id, name, input (JSON) };
struct ToolResult { tool_use_id, content, is_error, error_message, duration_ms };
```

**`TUIToolExecutor`** (`llm/tools/tui_tools.cpp`) — synchronous tools via IPC socket:
- `list_windows` — enumerate open TUI windows.
- `create_test_pattern_window` — spawn test pattern window.
- `get_canvas_size` — desktop dimensions.

**`time_tools.cpp`** — time-related tools (get current time, etc.).

### 8.4 Wib&Wob Chat (`TWibWobWindow`)

- Full persistent chat window with role-mapped history.
- `TWibWobMessageView` (TScroller): renders messages with sender colours. Streaming support: `startStreamingMessage()` → `appendToStreamingMessage()` → `finishStreamingMessage()`.
- `TWibWobInputView`: single-line input at bottom, Enter to submit.
- `WibWobEngine` (`wibwob_engine.h/.cpp`): drives LLM via `ILLMProvider`.
- IPC:
  - `wibwob_ask text=<>` — trigger AI response programmatically.
  - `get_chat_history` — return JSON array `[{role, content}]`.
  - `chat_receive sender=<> text=<>` — inject incoming message (Scramble echo path).

---

## 9. Desktop Management

### 9.1 TWibWobBackground (`wibwob_background.h/.cpp`)

Custom `TBackground` subclass replacing the default Turbo Vision background:

- **Pattern character:** any single char (default `▒` = `\xB1`).
- **Colour modes:**
  - CGA 16-colour (fg 0-15, bg 0-15)
  - True RGB (`setColorRgb(uint32_t fg, uint32_t bg)`)
- **Named presets** (9 built-in):
  - `default` — `▒` light grey on classic TV blue
  - `jet_black` — true black RGB
  - `dark_grey` — dark grey RGB
  - `terminal` — `░` dark grey on black (CRT feel)
  - `cga_cyan` — `▒` white on CGA cyan
  - `cga_green` — `░` bright green on black
  - `noise` — `%` grungy
  - `white_paper` — true white RGB
  - `gallery_wall` — true black (gallery mode)
- IPC: `desktop_preset`, `desktop_texture`, `desktop_color`, `desktop_get`.

### 9.2 Gallery Mode

`api_desktop_gallery(app, true)` activates gallery mode:
- Hides menu bar (`menuBar->setState(sfVisible, false)`).
- Hides status line.
- Expands desktop to fill full terminal height.
- Reverting (`false`) restores chrome and shrinks desktop.
- Designed for screenshot/recording sessions where chrome is unwanted.

### 9.3 Theme Manager (`theme_manager.h/.cpp`)

- **Modes:** `Light`, `Dark`
- **Variants:** `Monochrome` (default), `DarkPastel`
- **Semantic roles:** Background, Foreground, ForegroundSecondary, AccentPrimary, AccentSecondary, AccentTertiary, Frame, Selection, Warning
- `ThemeManager::getColor(role, mode, variant)` → `TColorAttr`
- Currently IPC stubs exist (`set_theme_mode`, `set_theme_variant`, `reset_theme`) but full palette application to all views is in-progress.

### 9.4 Window Layout

- **Cascade:** `api_cascade()` — standard Turbo Vision cascade.
- **Tile:** `api_tile()` — divides desktop evenly among open windows.
- **Close All:** iterates all desktop children, closes each.
- **Send to Back:** z-order move.
- **Next/Previous:** F6 / Shift-F6 focus cycling.
- **Drag & Resize:** native Turbo Vision TWindow behaviour (drag titlebar, resize by corner/edge).

### 9.5 Workspace Persistence

- **Save:** `buildWorkspaceJson()` serialises all open windows (type, position, size, props) to JSON. Written atomically via `.tmp` rename. Stored in `workspaces/` directory.
- **Load:** `loadWorkspaceFromFile()` parses JSON, spawns each window via the window_type_registry dispatch.
- **Recent workspaces:** scans `workspaces/` on startup, keeps last 5 in File → Recent > submenu.
- **Manage Workspaces dialog** (`TManageWorkspacesDialog`):
  - List box of saved workspaces with window count.
  - Live miniature preview (`TWorkspacePreview`): renders ASCII wireframe of window layout, updates as list focus changes.
  - Actions: Load, Rename, Delete.
- **`TWorkspacePreview`:** custom `TView` that scales window positions to preview pane size, draws box-drawing chars for each window, shows type label inside.

### 9.6 Window IDs & Management

- `TWwdosApp::idToWin` — `map<string, TWindow*>` mapping IPC-assigned IDs to windows.
- `registerWindow(win)` — assigns a UUID-ish ID.
- `findWindowById(id)` — lookup for IPC commands.
- Per-window IPC commands: `move_window`, `resize_window`, `focus_window`, `raise_window`, `lower_window`, `close_window`, `window_shadow`, `window_title`.

### 9.7 Custom Status Line

`TCustomStatusLine` — override that embeds IPC connection indicator:
- Shows `⚡ N` (lightning bolt + client count) when API server is connected and active.
- Flashes indicator briefly after each command received.

---

## 10. Network / API

### 10.1 Unix Socket IPC Server (`app/api_ipc.h/.cpp`)

- **Socket path:** `/tmp/wwdos.sock` (default); `WIBWOB_INSTANCE=N` → `/tmp/wibwob_N.sock`.
- **Protocol:** line-oriented text. Each command: `cmd:<name> [key=value ...]` terminated by `\n`.
- **Values:** percent-encoded (`%20`=space, `%0A`=newline) or base64.
- **Auth (optional):** `WIBWOB_AUTH_SECRET` enables HMAC-SHA256 challenge-response handshake on connect.
- **Polling:** `ApiIpcServer::poll()` called from main event loop (non-blocking, single-threaded on UI side).
- **Event push:** persistent subscriber connections. `publish_event(type, payload_json)` broadcasts newline-delimited JSON to all subscribers.
- **Connection status:** `ConnectionStatus { listening, api_active, client_count }` — read by status line indicator.

### 10.2 FastAPI Server (`tools/api_server/`)

Python FastAPI bridge between HTTP and the C++ IPC socket:

- **Port:** 8089 (configurable via `WIBWOB_API_PORT`).
- **Key endpoints:**
  - `GET /health` — liveness.
  - `GET /capabilities` — window types + commands.
  - `GET /commands` — live C++ command registry (JSON).
  - `GET /state` — pattern_mode, windows, canvas, last_workspace, uptime_sec.
  - `POST /windows` — create window `{type, title?, rect?, props?}`.
  - `POST /windows/{id}/move` — move/resize.
  - `POST /command` — execute named command.
  - `GET /ws` — WebSocket event stream (broadcasts state changes).
  - `GET /mcp` — MCP endpoint (requires `fastapi-mcp`).
- **`ipc_client.py`** — connects to `/tmp/wwdos.sock`, sends commands, reads responses.
- **`mcp_tools.py`** — exposes commands as MCP tools.
- **Test suite:** `test_ipc.py`, `test_paint_ipc.py`, `test_registry_dispatch.py`, `test_terminal_read.py`, `test_browser_ipc.py`, `test_move.py`, `live_api_parity_suite.py`.

### 10.3 PartyKit Multi-user Server (`partykit/src/server.ts`)

Cloudflare Workers Durable Object for real-time multiplayer:

**Message types (JSON WebSocket protocol):**

| Type | Direction | Purpose |
|------|-----------|---------|
| `state_delta` | Client→Server | Window layout change `{add?, remove?, update?}` |
| `state_sync` | Server→Client | Full canonical state on connect |
| `chat_msg` | Client→All | Chat message `{sender, text, ts}` |
| `cursor_pos` | Client→All | Cursor position `{sender, x, y}` |
| `presence` | Server→All | Join/leave events `{event, id, count}` |
| `rename` | Client→Server | Set display name `{conn_id, name}` |
| `ping` | Client→Server | Keepalive |

**Canonical state:** `{ windows: Record<id, WindowState>, version: number }`

**Room Chat integration:** `TRoomChatWindow` in C++ connects to PartyKit room, receives `room_chat_receive` + `room_presence` IPC events from the Python bridge which polls the WebSocket.

### 10.4 MCP Integration (Claude Code)

- MCP server at `http://127.0.0.1:8089/mcp`.
- Two tools via `mcp_tools.js`:
  - `tui_list_commands` — returns full command catalogue.
  - `tui_menu_command` — executes any command by name+args.
- Claude Code agents can directly control all 70+ TUI commands through this MCP endpoint.

---

## 11. Services & Infrastructure

### 11.1 Command Registry (`app/command_registry.h/.cpp`)

- 70+ named commands, each with: `name`, `description`, `requires_path` flag.
- `exec_registry_command(app, name, kv)` — single dispatch function. No per-command files needed.
- `get_command_capabilities_json()` — JSON export for API `/commands` endpoint.
- Adding a command: add to `get_command_capabilities()` vector + add handler block in `exec_registry_command()`.

### 11.2 Window Type Registry (`app/window_type_registry.h/.cpp`)

- 39 window types, each with: `type` slug, `spawn` function, `matches` predicate.
- `find_window_type_by_name(name)` — O(N) linear scan.
- `get_window_types_json()` — JSON manifest for API `/capabilities`.
- `has_child_view<ViewType>(w)` — template helper for match predicates.
- Adding a window type: add ONE entry in `k_specs[]` table only.

### 11.3 Frame Capture / Screenshot (`app/frame_capture.h/.cpp`)

- `api_screenshot(app)` captures the TUI to a text file.
- Uses Turbo Vision's screen buffer read path.
- Output stored in `exports/` or timestamped file.
- Announced via `messageBox` on completion.

### 11.4 Glitch Engine (`app/glitch_engine.h/.cpp`)

- Post-process effects applied to the screen buffer.
- Effects (disabled in menus as of E009, but code present):
  - `GlitchScatter` — random pixel scatter
  - `GlitchColorBleed` — horizontal colour bleeding
  - `GlitchRadialDistort` — radial displacement
  - `GlitchDiagonalScatter` — diagonal pixel shift
- Commands still defined (cmToggleGlitchMode, cmGlitchScatter, etc.) but menu items removed.

### 11.5 Clipboard (`app/clipboard_read.h/.cpp`)

- `readClipboard()` — reads system clipboard text (platform-specific: `pbpaste`/`xclip`/`xsel`).
- Used by the text editor for paste operations.

### 11.6 Pattern Mode

Two rendering modes for the test pattern background:
- **Continuous (Diagonal):** pattern flows across window boundaries; uses global phase counter.
- **Tiled (Cropped):** pattern restarts at each window edge.
- Toggled via Edit menu or IPC `pattern_mode mode=continuous|tiled`.

### 11.7 Auth Config (`app/llm/base/auth_config.h/.cpp`)

- Reads `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` from environment.
- Searches for `claude` CLI binary in PATH and common locations.
- Singleton pattern, read at LLM provider init.

### 11.8 Primer Sync (`backrooms_tv_view.cpp`)

- `syncModulePrimers()` — at startup, scans `modules-private/*/primers/` and symlinks each file into `wibandwob-backrooms/primers/`.
- Enables module-specific primers to be available to the Backrooms CLI without manual setup.
- `g_modulePrimerPaths` — global `map<name, path>` populated by dialog open, consumed by `BackroomsBridge::start()`.

---

## 12. Backrooms Content System

### What it is

A live streaming ASCII art generator powered by an LLM (Claude). The user configures a "channel" (theme + primers + turns + model) and the system runs the `wibandwob-backrooms` CLI subprocess, which makes LLM API calls and streams the generated ASCII art text to stdout. The TUI displays this as a live scrolling text stream.

### Architecture

```
TBackroomsTvWindow
  └─ TBackroomsTvView (TScroller, 50ms poll timer)
       └─ BackroomsBridge (fork/exec subprocess)
            └─ wibandwob-backrooms/src/ui/cli-v3.ts (TypeScript CLI)
                 └─ Anthropic API (Claude Haiku/Sonnet/Opus)
```

### BackroomsChannel config struct

```cpp
struct BackroomsChannel {
    std::string theme;        // Generation theme ("make art", "cosmic horror", etc.)
    std::string primers;      // Comma-separated primer names (filenames without .txt)
    int turns = 3;            // Number of LLM turns (1–20)
    std::string model;        // "haiku" | "sonnet" | "opus"
    std::string customText;   // Inline text written as _custom.txt primer
};
```

### BackroomsBridge

- `start(channel)`: Resolves backrooms CLI path (env `WIBWOB_BACKROOMS_PATH`, or sibling dir discovery). Writes custom text to `_custom_N.txt` in primers dir. Symlinks module primers. Forks `npx tsx cli-v3.ts` with args.
- `readAvailable(out)`: Non-blocking `read()` from pipe fd. Returns bytes read or -1 for EOF.
- `stop()`: SIGTERM + SIGKILL to subprocess.

### TBackroomsTvView

- 500-line ring buffer (`deque<string>`).
- Partial line accumulator (`string partial_`).
- Auto-scroll: snaps to bottom on new content.
- **Keyboard controls:** Space = pause/resume; `n` = next (restart with same config); `q` = close.
- **Log file:** Opens a session log at `exports/bktv_TIMESTAMP.txt`, appends all received text.
- **Status bar** (bottom row): `[LIVE|PAUSED|IDLE] theme="..." turns=N model=... log=...`
- **Colours:** White text (`#FFFFFF`) on jet black (`#000000`) — `kTextAttr` is `TColorAttr(RGB(255,255,255), RGB(0,0,0))`.

### Config Dialog (`TBackroomsTvDialog`)

3-column layout: Available | Preview | Selected

| Control | Purpose |
|---------|---------|
| Theme input | Free text theme for LLM |
| Turns spinner | 1–20 LLM turns |
| Model selector | Haiku / Sonnet / Opus |
| Available list | All primers (native + module). Shift+click/↑↓ for range selection. |
| Preview pane | Live file content preview of focused item |
| Selected list | Primers chosen for this channel |
| Add → | Move focused item(s) to Selected |
| ← Remove | Remove from Selected |
| Custom editor | Freeform text; `---` splits into multiple primers |
| Add custom → | Writes custom text as `_custom_N.txt`, adds to Selected |
| Play | Launches with current config |

### Primer types

1. **File primers:** `.txt` files in `wibandwob-backrooms/primers/`
2. **Module primers:** from `modules-private/*/primers/` — symlinked at startup
3. **Custom text primers:** pasted inline, split by `---`, written as temp files per session
4. **Primer size cap:** 500,000 chars (raised from 15,000)

### IPC / Command registry access

```
open_backrooms_tv                         # Show config dialog
open_backrooms_tv theme=X turns=N primers=a,b model=sonnet  # Direct launch
```

---

## 13. Command Palette / Registry

There is no dedicated "command palette" UI widget (no fuzzy-search popup). Commands are exposed through:

1. **Menu bar** — the primary human interface.
2. **IPC socket** — `cmd:<name> [key=value...]` text protocol.
3. **FastAPI REST** — `POST /command {name, params}`.
4. **MCP tools** — `tui_list_commands` + `tui_menu_command` (for AI agents).

### Complete Command List (70+ commands)

**Window management:**
`cascade`, `tile`, `close_all`, `move_window`, `resize_window`, `focus_window`, `raise_window`, `lower_window`, `close_window`, `window_shadow`, `window_title`

**Workspace:**
`save_workspace`, `open_workspace`

**Screenshot / capture:**
`screenshot`

**Desktop:**
`pattern_mode`, `set_theme_mode`, `set_theme_variant`, `reset_theme`, `desktop_preset`, `desktop_texture`, `desktop_color`, `desktop_gallery`, `desktop_get`

**Open/spawn windows:**
`open_verse`, `open_mycelium`, `open_orbit`, `open_torus`, `open_cube`, `open_life`, `open_blocks`, `open_score`, `open_ascii`, `open_animated_gradient`, `open_gradient`, `open_monster_cam`, `open_backrooms_tv`, `open_monster_verse`, `open_monster_portal`, `open_browser`, `open_figlet_text`, `open_text_editor`, `open_wibwob`, `open_micropolis_ascii`, `open_quadra`, `open_snake`, `open_rogue`, `open_deep_signal`, `open_apps`, `open_gallery`, `open_primer`, `open_terminal`, `new_paint_canvas`, `open_paint_file`, `open_room_chat`

**Scramble cat:**
`open_scramble`, `scramble_expand`, `scramble_say`, `scramble_pet`

**AI / chat:**
`wibwob_ask`, `get_chat_history`, `chat_receive`

**Room chat:**
`room_chat_receive`, `room_presence`

**Terminal:**
`terminal_write`, `terminal_read`

**Paint canvas API:**
`paint_cell`, `paint_text`, `paint_line`, `paint_rect`, `paint_clear`, `paint_export`, `paint_save`, `paint_load`, `paint_stamp_figlet`

**FIGlet:**
`figlet_set_text`, `figlet_set_font`, `figlet_set_color`, `figlet_list_fonts`, `list_figlet_fonts`, `preview_figlet`

**Gallery:**
`gallery_list`

**Text editor:**
`send_text` (legacy IPC), `send_figlet` (legacy IPC)

**Internal:**
`inject_command` (raw TV command injection for testing)

---

## 14. Unique & Distinctive Features

### 14.1 Subpixel Paint Canvas

`TPaintCanvasView` supports 5 pixel modes:

| Mode | Description | Resolution |
|------|-------------|-----------|
| `Full` | 1 char = 1 pixel | Cols × Rows |
| `HalfY` | Uses `▀`/`▄`/`█`/` ` trick: fg=upper-half, bg=lower-half | Cols × Rows×2 |
| `HalfX` | Similar horizontal split | Cols×2 × Rows |
| `Quarter` | `▝▗▖▘▚▞` block chars; 4 subpixels per cell | Cols×2 × Rows×2 |
| `Text` | Direct character + fg/bg placement | Cols × Rows |

The `.wwp` file format (JSON) stores the cell buffer with all mode metadata. Paint canvases are fully remote-controllable via 10 IPC commands (`paint_cell`, `paint_text`, `paint_line`, `paint_rect`, etc.).

### 14.2 Frameless Floating FIGlet Windows

`TFigletTextWindow` with `frameless=true, shadowless=true` creates windows with no border, no title, no shadow — pure typography floating on the desktop. Uses `TGhostFrame` (from `notitle_frame.h`). Auto-sized to fit the rendered text. Can be placed at exact x,y coordinates via IPC. Multiple can stack/overlap for composed typographic displays.

### 14.3 Workspace Preview in Manage Dialog

`TWorkspacePreview` renders a live miniature ASCII wireframe of any workspace file without loading it. Scales coordinates proportionally, draws box-drawing characters for each window boundary, labels each window with its type slug. Updates as you navigate the list.

### 14.4 App Launcher Grid

`TAppLauncherWindow` is a macOS Finder-style launcher. Apps are represented as 20×4 char icon cells with a 2-char icon glyph and name. Category tabs (All/Games/Tools/Creative/Demos). Keyboard navigation with arrow keys, Enter to launch. The grid adjusts column count to window width.

### 14.5 Anti-ANSI TDrawBuffer Guardrail

Documented in `CLAUDE.md`. The codebase enforces that **raw ANSI escape sequences are never written to `TDrawBuffer`**. All colouring uses the Turbo Vision cell model (`TColorAttr(TColorRGB(...), TColorRGB(...))` or `TColorAttr(uint8_t)`). ANSI sequences from external sources (terminal emulator, contour map output) are parsed through libvterm before being placed into the cell model.

### 14.6 HMAC Auth on IPC Socket

Optional security layer: set `WIBWOB_AUTH_SECRET=<secret>`. New connections receive a random nonce; must respond with `HMAC-SHA256(secret, nonce)` before commands are accepted. Nonces are one-time use (replay protection via `used_nonces_` set). Uses Apple CommonCrypto on macOS, OpenSSL on Linux.

### 14.7 Backrooms Custom Primer via Paste + `---` Separator

In the Backrooms config dialog, the custom text editor supports `---` as a separator. A multi-section paste (e.g., multiple ASCII art pieces) is automatically split into N separate primer files (`_custom_1.txt`, `_custom_2.txt`, …) and each is independently added to the Selected list. This allows rapidly building a primer collection from a clipboard dump.

### 14.8 Rogue + Terminal Integration

In `TRogueView`, stepping onto a `Terminal` tile in the dungeon fires `cmRogueHackTerminal`, which spawns a `TWibWobTerminalWindow` (full PTY terminal). The fiction is that you are "hacking" the terminal. DataChip items enable this interaction. `Glitch` creatures appear near Terminal tiles (digital enemies in the dungeon lore).

### 14.9 Deep Signal FOV Cone Scanner

`TDeepSignalView` has a unique mechanic: you don't see the whole map. You have a 90° scanning cone in one of 4 compass directions. Rotating the scanner costs fuel. Deep Scan mode extends range from 12 to 20 tiles but costs more fuel. The map is revealed cell by cell as you scan. Asteroid tiles block the scanner (shadow behind them). Signal beacons pulse and must be "decoded" by visiting them. Anomalies trigger unique events.

### 14.10 Monster Portal Episode System

`TGenerativeMonsterPortalView` runs a 4-episode narrative arc over ~7 minutes:
1. **BREATHE** (~1.8 min) — calm tiled display, very low glitch
2. **HAUNT** (~1.8 min) — glitch starts accumulating, drifting begins
3. **FLAME** (~1.8 min) — heavy glitch, high churn
4. **COLLAPSE** (~1.8 min) — maximum chaos, near-full degradation

Each episode influences the rendering parameters (glitch factor, density cap, whitespace bias). The 4-episode cycle then repeats. Individual cells update at ~0.2 Hz (very slow) for a "rotting" temporal feel.

### 14.11 Mech Grid System (Stub)

`app/mech.h/.cpp`, `mech_grid.h/.cpp`, `mech_window.h/.cpp`, `mech_config.h/.cpp` — appears to be an in-progress Mech/robot simulation grid system. Not yet registered in the window type registry or main menu. Future feature.

### 14.12 Token Tracker View

`token_tracker_view.h/.cpp` — a view that tracks and displays LLM token usage. Not fully integrated into main menus but the infrastructure exists.

### 14.13 ANSI Art Viewer (Standalone Binary)

`ansi_viewer_main.cpp` + `ansi_view.h/.cpp` — a standalone binary that renders ANSI escape art (`.ans` files) in a Turbo Vision window. Separate from the main `wwdos` binary; not spawnable via IPC.

### 14.14 Contour Map Triptych Mode

`ContourBridge` supports `triptych=true`: generates 3 panels side-by-side in a single stream. Each panel uses the same terrain type and seed but different render parameters, creating a progression or comparison view.

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Window types (registered) | 39 |
| IPC commands | 70+ |
| Generative art views (animated) | 16 |
| Games | 5 |
| Python subprocess views | 3 (Backrooms, Contour, GenLab) |
| LLM providers | 3 (Anthropic direct, Claude Code CLI, OpenRouter) |
| Desktop presets | 9 |
| FIGlet fonts | 100+ |
| Primer tabs in Gallery | 6 (5 letter + search) |
| Generative Lab presets | 10 |
| Paint pixel modes | 5 |

---

*End of deep-dive report.*
