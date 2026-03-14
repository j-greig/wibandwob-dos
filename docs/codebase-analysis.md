# WibWob-DOS TypeScript Codebase — Deep-Dive Analysis

> Generated: 2026-03-05  
> Scope: `src/` directory of the Bun/blessed TypeScript port  
> Runtime: Bun · Renderer: blessed · Entry: `src/app.ts`

---

## Table of Contents

1. [Window Types](#1-window-types)
2. [Menu Structure](#2-menu-structure)
3. [Generative Art / Animation](#3-generative-art--animation)
4. [Music / Audio](#4-music--audio)
5. [Text / Content Systems](#5-text--content-systems)
6. [Games](#6-games)
7. [Companion / Pets](#7-companion--pets)
8. [Agent / AI Integration](#8-agent--ai-integration)
9. [Desktop Management](#9-desktop-management)
10. [Network / API](#10-network--api)
11. [Services / Infrastructure](#11-services--infrastructure)
12. [Backrooms System](#12-backrooms-system)
13. [Command Palette](#13-command-palette)
14. [Unique / Distinctive Features](#14-unique--distinctive-features)
15. [Dependencies Summary](#15-dependencies-summary)

---

## 1. Window Types

All windows are floating, overlapping, draggable, and resizable blessed `BoxElement` frames managed by `WindowManager`. Each has:
- A titlebar with close button and drag handle
- A drop shadow
- A `describeState()` hook for desktop state reporting
- An optional `cleanup()` hook called on close
- An optional `onRestyle()` hook for live theme switching

### 1.1 Primer Viewer

| Property | Value |
|---|---|
| **Source** | `src/windows/content-windows.ts` |
| **Kind** | `primer` |
| **AppType** | `primer-viewer` |
| **Interactive** | Scrollable, opens from browser/gallery |
| **Persistable** | Yes (file path restored) |

Displays `.txt` primer files (ASCII art, lore text, creative writing). If the file contains multi-frame animation markers (`# frame N`), measures and plays all frames at the configured FPS via `createPreRenderedPlayer`. Window is sized to `recommendedWidth × recommendedHeight` from `ContentMeasurement`. Unicode/wide-character aware via `string-width` + a `fitLineToWidth()` helper that clips by display width rather than byte length.

---

### 1.2 Text Editor

| Property | Value |
|---|---|
| **Source** | `src/windows/text-windows.ts`, `src/core/editor-coordinator.ts`, `src/services/editor-service.ts` |
| **Kind** | `editor` |
| **AppType** | `text-editor` |
| **Interactive** | Full keyboard editor |
| **Persistable** | Yes (content + cursor + file path) |

Custom-built text editor; does not use a blessed `textarea` widget (stock widget was unreliable). Manages a raw string value and integer cursor position in `EditorState`. The `EditorCoordinator` intercepts all key events through `WindowManager`'s `EditorWriteHook`. Features:
- Typing, delete, backspace, arrow keys
- Ctrl+A / Ctrl+E (line start/end)
- Ctrl+K (kill line)
- Save (`Ctrl+S`) and Save As, via `FileActions.writeEditorWindow()`
- Dirty indicator (asterisk in titlebar without dirtying the title stored in state)
- Context menu entries for Save / Save As
- Cursor-aware rendering with tag-escaped content

---

### 1.3 Document Reader (Browser Reader)

| Property | Value |
|---|---|
| **Source** | `src/windows/figlet-windows.ts` (`openBrowserReaderWindow`) → delegates to content-windows.ts `openTextViewerWindow` |
| **Kind** | `reader` |
| **AppType** | `reader-viewer` |
| **Interactive** | Scrollable |
| **Persistable** | Yes (file path) |

Opens a local file (typically markdown or plain text) in a scrollable, read-only viewer. Prepends `Location: <path>` header. Used for the README viewer and document reader command. Visually identical to a primer viewer but does not animate.

---

### 1.4 Primer Browser

| Property | Value |
|---|---|
| **Source** | `src/windows/content-windows.ts` (`openPrimerBrowserWindow`) |
| **Kind** | `browser` |
| **AppType** | `primer-browser` |
| **Interactive** | Navigable list, Enter to open |
| **Persistable** | Yes (selected index) |

Simple single-pane list showing all primer files discovered from `microapps/`, `microapps-private/`, and `docs/`. `Enter` opens the selected file as a primer viewer. Vi-key scrolling.

---

### 1.5 Primer Gallery

| Property | Value |
|---|---|
| **Source** | `src/windows/content-windows.ts` (`openPrimerGalleryWindow`) |
| **Kind** | `gallery` |
| **AppType** | `primer-gallery` |
| **Interactive** | Tabbed + filterable + live preview |
| **Persistable** | Yes (active tab, search value, selection) |

Two-pane window:
- **Left**: Tab bar by module/category, live text filter, scrollable vi-key list
- **Right**: Live preview rendering full file content, viewport-clipped via `setViewportContent()`

Tabs are dynamically generated from `ContentService.collectGalleryEntries()`. Tab keys and letter-jump navigation. Can open any primer from the preview pane.

---

### 1.6 File Manager (Finder)

| Property | Value |
|---|---|
| **Source** | `src/windows/content-windows.ts` (large section) |
| **Kind** | `browser` |
| **AppType** | `farjs-file-manager` |
| **Interactive** | Full file manager |
| **Persistable** | Yes (path, filter, sort, view mode, search state) |

Full-featured file manager. Exposes a `FinderController` interface for programmatic control:

- **List view / Icon view** toggle
- **Live filter** by filename substring
- **Simple search** (ripgrep-powered file content search)
- **Advanced search** via QMD (semantic/keyword: lex/vec/hyde modes)
- **Bookmarks**: save and recall named paths
- **New folder** creation
- **Sort by** name / size / modified / type
- **Navigate to path** programmatically
- Context menu with file-path actions
- Always shows dotfiles (hidden-file toggle removed)

---

### 1.7 Backrooms TV

| Property | Value |
|---|---|
| **Source** | `src/windows/backrooms-windows.ts` (`openBackroomsTvWindow`) |
| **Kind** | `backrooms` |
| **AppType** | `backrooms-tv` |
| **Interactive** | Scrollable transcript; Space/N to restart |
| **Persistable** | Yes (theme, primers, turns, model, mode) |

Streams an external Backrooms CLI process (`wibandwob-backrooms/src/ui/cli-v3.ts`) via Bun `spawnProcess`. Three source modes:
- **live**: real Claude API session running in the sibling repo
- **fake-live**: replays lines from local log files at 30ms/line intervals  
- **playback**: fallback triggered on timeout or error, uses sampled local files

A 1-second watchdog timer triggers playback fallback if no stdout appears within 8 seconds. All output is written to a timestamped log file in `logs/backrooms-tv/`. Footer shows mode, source, and log path. Space/N restarts the session. Status phases: `IDLE → STARTING → WAITING FOR FIRST TOKENS → STREAMING → EXIT`.

---

### 1.8 Backrooms Primer Picker

| Property | Value |
|---|---|
| **Source** | `src/windows/backrooms-windows.ts` (`openBackroomsPrimerPicker`) |
| **Kind** | `browser` |
| **AppType** | `backrooms-primer-picker` |
| **Interactive** | Multi-select list + preview |
| **Persistable** | Yes |

Shown before a Backrooms TV session. Two-pane window:
- Left: searchable list with `[x]` / `[ ]` toggle (Space bar), letter-jump navigation
- Right: live file content preview

After confirmation, passes comma-joined selected primer labels to `promptForBackroomsRunOptions` for turns/model prompts before launch.

---

### 1.9 Backrooms Log Browser

| Property | Value |
|---|---|
| **Source** | `src/windows/backrooms-log-browser-window.ts` |
| **Kind** | `browser` |
| **AppType** | `backrooms-log-browser` |
| **Interactive** | Two-pane browser |
| **Persistable** | Yes |

Scans `logs/backrooms-tv/` for `.txt` log files sorted newest-first. Live indicator (●) for files modified < 30 seconds ago. Right pane shows full log content. Toolbar buttons:
- **Replay**: opens as a `fake-live` Backrooms TV window
- **Snippet**: saves selected text to an editor window

Context menu includes file-path actions (open editor, copy path, etc.).

---

### 1.10 Chrome Browser

| Property | Value |
|---|---|
| **Source** | `src/windows/chrome-browser-window.ts` |
| **Kind** | `browser` |
| **AppType** | `chrome-browser` |
| **Interactive** | Full navigation, search |
| **Persistable** | Yes (current URL) |

Real headless Chrome via Puppeteer + Chrome DevTools Protocol. `ChromeBrowserService` launches Chrome or connects to existing instance on `:9222`. Pages are extracted with Mozilla Readability + Turndown (markdown), rendered as scrollable text. Toolbar:
- Back / Forward navigation buttons
- URL input field (editable, Enter to navigate)
- Go / Reload buttons
- Search button (opens overlay search)

State includes `currentUrl`, `currentTitle`, `history[]`.

---

### 1.11 FIGlet Banner

| Property | Value |
|---|---|
| **Source** | `src/windows/figlet-windows.ts` (`openFigletWindow`) |
| **Kind** | `figlet` |
| **AppType** | `figlet-banner` |
| **Interactive** | Toolbar with text input + font picker |
| **Persistable** | Yes (text, font) |

Renders big ASCII art text using the real system `figlet` CLI. Toolbar:
- Text input box (edit with `[E]` or toolbar button)
- Font picker button `[F]` (opens `openFigletFontPicker` overlay list with live preview)

Font catalogue loaded from `modules[-private]/wibwob-figlet-fonts/fonts.json` — categorised (`standard`, `slant`, `gothic`, etc.) with per-font height/width metadata. Window auto-sizes to `max(columnWidth, 32) × oneRowHeight` on first render. Resize re-renders.

---

### 1.12 Generative Art

| Property | Value |
|---|---|
| **Source** | `src/windows/misc-windows.ts` (`openArtWindow`) |
| **Kind** | `art` |
| **AppType** | `generative-art` |
| **Interactive** | Passive (viewport-filling animation) |
| **Persistable** | Yes |

Three layered sine waves (`waveA`, `waveB`, `orbit`) combined and mapped onto a 10-character density ramp (` .:-=+*#%@`) at 10 fps via `createLivePlayer`. Viewport-aware — adapts to window resize.

---

### 1.13 Pattern Field

| Property | Value |
|---|---|
| **Source** | `src/windows/misc-windows.ts` (`openPatternWindow`) |
| **Kind** | `pattern` |
| **AppType** | `pattern-animation` |
| **Interactive** | Passive |
| **Persistable** | Yes |

Block-character diagonal wave using `░▒▓█` at 8 fps. `glyphs[Math.abs((x + y + tick) % 4)]`.

---

### 1.14 Plasma Screensaver

| Property | Value |
|---|---|
| **Source** | `src/windows/plasma-window.ts` |
| **Kind** | `plasma` (cast as `any` — not yet in `WindowKind` enum) |
| **AppType** | `plasma` |
| **Interactive** | Keyboard controls; info panel |
| **Persistable** | No (transient) |

Layered sinusoidal colour-field screensaver. **8 moods**: `circuit`, `void`, `chaos`, `aurora`, `sunset`, `acid`, `deep-space`, `chrome`. Each mood defines wave frequency coefficients, time speed, displacement, char ramp, emoji palette, and RGB gradient stops. **3 render modes**:
- `plain`: Unicode block-char brightness ramp
- `emoji`: colour-square emoji (🟥🟦🟩)
- `ansi`: `▀` half-block + truecolour ANSI sequences (double vertical resolution)

Composable layout using `createStack` + `createRow` + `createInfoBlock` + `createHeaderBar` + `createStatusBar`. Info panel shows mood, render mode, speed, displacement, FPS, and key bindings. Can also be opened with a primer text input for "primer-smear" mode (displaces chars based on primer content). Keys: `m` = cycle mood, `r` = cycle render mode, `p` = pause, `s` = save frame to `scratch/captures/`.

---

### 1.15 Contour Studio

| Property | Value |
|---|---|
| **Source** | `src/windows/contour-window.ts` |
| **Kind** | `contour` |
| **AppType** | `contour-studio` |
| **Interactive** | Keyboard controls |
| **Persistable** | No (transient) |

Procedural terrain + marching-squares contour renderer at 12 fps. Three rendering modes (`chaos` = organic contours, `order` = binary grid clusters, `hybrid` = blended). Named terrain presets (e.g. `meadow`, `mountain`, etc.). Seeded PRNG for deterministic replay. Keys: `m` = cycle mode, `t`/Tab = cycle terrain, `r` = re-seed, `+`/`-` = contour levels, `s` = save frame.

---

### 1.16 Terrain Lab

| Property | Value |
|---|---|
| **Source** | `src/windows/terrain-lab-window.ts` |
| **Kind** | `terrain-lab` |
| **AppType** | `terrain-lab` |
| **Interactive** | Same keys as Contour Studio + info panel |
| **Persistable** | No (transient) |

Contour Studio embedded as a composable `ContourPlayer` component inside a structured layout (header + 2-column body + status bar). Left panel is the contour map; right panel is a text info block showing mode, terrain, levels, and seed. Demonstrates the composable UI parts system.

---

### 1.17 Contour Triptych

| Property | Value |
|---|---|
| **Source** | `src/windows/contour-triptych-window.ts` |
| **Kind** | `contour` |
| **AppType** | `contour-triptych` |
| **Interactive** | Synchronised keyboard controls across all 3 panels |
| **Persistable** | No (transient) |

Three independent `ContourPlayer` instances side-by-side, separated by vertical rule dividers. Each panel starts with a different mode (`chaos` / `order` / `hybrid`) and a randomly shuffled terrain. Keys act on all three simultaneously: `r` = reseed all, `m` = cycle modes, `t` = cycle terrains, `s` = capture combined triptych to file.

---

### 1.18 Monster Cam

| Property | Value |
|---|---|
| **Source** | `src/windows/monster-cam-window.ts`, `src/services/monster-cam-service.ts`, `src/services/monster-cam-worker.ts` (TS), `src/services/monster_cam_worker.py` (Python) |
| **Kind** | `monster-cam` |
| **AppType** | `monster-cam` |
| **Interactive** | Webcam + detection overlay |
| **Persistable** | Yes |

Live ASCII webcam view with real-time ML object detection:
- **Architecture**: Bun spawns a Python worker (`monster_cam_worker.py`) that reads the webcam via OpenCV + MediaPipe. Worker sends binary frame packets over a Unix socket (`/tmp/face_monster_cam.sock`). `MonsterCamService` (EventEmitter) receives and parses packets, emits `frame` events.
- **Detection**: Face detection (bounding box `┌┐└┘─│`), hand detection (left `L`=yellow / right `R`=cyan with `╔╗╚╝═║` box), pose detection flag.
- **ASCII rendering**: `" .:-=+*#%@"` grayscale ramp, optional background (`[B]` toggle).
- **Status bar**: detection summary + FPS + bg toggle.

---

### 1.19 Music Player

| Property | Value |
|---|---|
| **Source** | `src/windows/music-player-window.ts` |
| **Kind** | `microapp` |
| **AppType** | `music-player` |
| **Interactive** | Play/pause/stop/scrub/volume |
| **Persistable** | No (transient) |

WinAMP-style player using macOS `afplay`. Features:
- Track filename display, play state icon (`▶` / `⏸` / `■`)
- Progress bar (`█░`) derived from elapsed/duration
- Volume bar (`▮▯`) 0–100%
- Duration detection via `afinfo` (macOS audio utility)
- 250ms scrub timer for elapsed tracking
- `SIGSTOP`/`SIGCONT` for pause/resume (process signals to `afplay`)
- Scrub ±5s (restarts `afplay` at new offset)
- Volume change (restarts `afplay` with new `-v` flag)
- Open file via inline textbox prompt

Also exposes a `frame.musicPlayer` controller for programmatic use by agent tools.

---

### 1.20 Companion (Scramble the Cat)

| Property | Value |
|---|---|
| **Source** | `src/windows/misc-windows.ts` (`openCompanionWindow`) |
| **Kind** | `companion` |
| **AppType** | `companion-widget` |
| **Interactive** | Passive animation |
| **Persistable** | Yes (tick position) |

Cycles through 4 ASCII art moods every 2.4 seconds:
```
 /\_/\      /\_/\      /\_/\      /\_/\
( o.o )    ( -.- )    ( 0.0 )    ( ^.^ )
 > ^ <      > ^ <      > ^ <      > ^ <

lurking    judging    cat online  purring in ANSI
```

---

### 1.21 Wib&Wob Agent

| Property | Value |
|---|---|
| **Source** | `src/windows/wibwob-agent-window.ts`, `src/services/wibwob-agent-session.ts` |
| **Kind** | `chat` |
| **AppType** | `wibwob-agent` |
| **Interactive** | Full chat interface |
| **Persistable** | Yes |

See [§8 Agent / AI Integration](#8-agent--ai-integration) for full detail.

---

### 1.22 Command Palette

| Property | Value |
|---|---|
| **Source** | `src/windows/misc-windows.ts` (`openCommandPaletteWindow`) |
| **Kind** | `palette` |
| **AppType** | `command-palette` |
| **Interactive** | Searchable list |
| **Persistable** | No (transient) |

Vi-key scrollable list of all commands that have a `palettePlacement`. Selecting runs the command action immediately. Currently ~45 entries.

---

### 1.23 Workspace Manager

| Property | Value |
|---|---|
| **Source** | `src/windows/misc-windows.ts` (`openWorkspaceManagerWindow`) |
| **Kind** | `workspace` |
| **AppType** | `workspace-manager` |
| **Interactive** | Action list |
| **Persistable** | No (transient) |

Small action window: Save Workspace, Save As..., Load Workspace..., Cascade, Tile, Open Command Palette. Footer shows current workspace name, file path, and known workspace names.

---

### 1.24 State Inspector

| Property | Value |
|---|---|
| **Source** | `src/windows/misc-windows.ts` (`openStateInspectorWindow`) |
| **Kind** | `inspector` |
| **AppType** | `state-inspector` |
| **Interactive** | Scrollable JSON viewer |
| **Persistable** | No (transient) |

Subscribes to `StateService` and renders the full `DesktopState` as pretty-printed JSON, live-updated on every state change. Used for debugging window state during development and agent work.

---

### 1.25 Microapp Windows (Dynamic)

| Property | Value |
|---|---|
| **Source** | `src/services/microapp-loader.ts` |
| **Kind** | `microapp` |
| **AppType** | Module's `microapp.id` |
| **Interactive** | Module-defined |
| **Persistable** | Optional (if module calls `registerSnapshot`) |

The module loader scans `microapps/` and `microapps-private/` for subdirectories containing `microapp.json` with `type: "microapp"`. Each microapp's `entry.ts` exports a `setup(host: MicroappHost)` function. The `MicroappHost` API provides:
- `createWindow(init)` → `MicroappWindowHandle`
- `registerCommand(def)` — adds menu/palette entries backed by command registry
- `registerSnapshot(handlers)` — opts into workspace persistence
- `registerTheme(variant)` — same as built-in theme registration
- `runCommand(id, args)` — dispatch any registry command
- `host.ui.*` — full composable UI parts library
- `host.screen`, `host.geometry`, `host.theme()`

Known dynamically-loaded microapp: **wibwob.poetry-clock** (Poetry Clock — mentioned in live desktop state, shows `microapp.wibwob.poetry-clock.set-mode` command with `mode:clock|sentient` and `voice:plain|liminal|scramble`).

---

## 2. Menu Structure

Six top-level menus generated from `src/core/command-catalog.ts` → projected by `command-registry.ts`.

### File

| Order | Label | Command ID |
|---|---|---|
| 20 | Open Primer... | `primer.open` |
| 30 | Open Text File... | `editor.open` |
| 40 | New Editor | `editor.new` |
| 50 | Save | `editor.save` |
| 60 | Save As... | `editor.save_as` |
| 70 | Save Workspace... | `workspace.save_as` |
| 80 | Load Workspace... | `workspace.load` |
| 190 | Quit | `app.quit` |

### Edit

| Order | Label | Command ID |
|---|---|---|
| 10 | Copy Window Text | `window.copy_text` |
| 20 | Export Window Text... | `window.export_text` |

### View

| Order | Label | Command ID |
|---|---|---|
| 10 | Command Palette | `palette.open` |
| 20 | Open State Inspector | `inspector.open` |
| 30 | Cycle Theme | `theme.cycle` |
| 31 | Choose Theme... | `theme.choose` |

### Window

| Order | Label | Command ID |
|---|---|---|
| 10 | Focus Next Window | `window.focus_next` |
| 20 | Focus Previous Window | `window.focus_previous` |
| 30 | Close Focused Window | `window.close_focused` |
| 35 | Toggle Maximize | `window.toggle_maximize` |
| 40 | Tile Windows | `window.tile` |
| 50 | Cascade Windows | `window.cascade` |
| 60 | Workspace Manager | `workspace.manage` |

### Applications

| Order | Label | Command ID |
|---|---|---|
| 0 | Open File Manager | `finder.open` |
| 10 | Backrooms TV... | `backrooms.open` |
| 20 | Backrooms Log Browser | `backrooms_logs.open` |
| 25 | Browse Primers | `primer.browse` |
| 30 | Open Gallery | `primer_gallery.open` |
| 40 | Open Chrome Browser | `chrome.open` |
| 50 | Document Reader | `document.open` |
| 60 | Open Art | `art.open` |
| 70 | Figlet Banner | `figlet.open` |
| 80 | Pattern Window | `pattern.open` |
| 82 | Plasma Screensaver | `plasma.open` |
| 83 | Plasma from Primer | `plasma.from-primer` |
| 85 | Contour Studio | `contour.open` |
| 86 | Terrain Lab | `terrain_lab.open` |
| 87 | Contour Triptych | `contour_triptych.open` |
| 120 | Wib&Wob Agent | `agent.open` |
| 125 | Music Player | `music-player.open` |
| 130 | Companion | `companion.open` |
| 150 | Monster Cam | `monster_cam.open` |
| + dynamic | (microapp modules) | (per module `id`) |

### Help

| Order | Label | Command ID |
|---|---|---|
| 0 | View README | `readme.open` |

### Context Menus (right-click)

Two sources of context menu items:
1. **Desktop** (no window focused): primer.open, editor.open, chrome.open, agent.open, monster_cam.open, backrooms.open, workspace.manage, window.tile, window.cascade
2. **Window-focused**: window.copy_text, editor.save, editor.save_as (editor windows), file-path actions (browser windows)

---

## 3. Generative Art / Animation

### 3.1 Animation Engine (`src/services/animation-service.ts`)

Two player primitives:

- **`createPreRenderedPlayer(frames[][])`** — cycles pre-built frame arrays (from `ContentMeasurement.frames` for animated primers). Configurable FPS, loop, onFrame callback.
- **`createLivePlayer(generator, getViewport)`** — calls a `LiveFrameGenerator(tick, width, height) → string` on each interval. Used by all procedural art windows.
- **`createLazyMountedPlayer`** — bridge for microapps: attachTarget/setRunning lifecycle.

### 3.2 Plasma Engine (`src/services/plasma-engine.ts`)

Pure maths, no I/O. Eight mood definitions with:
- `freq[4]` — wave frequency coefficients
- `speed` — time step per frame
- `displacement` — maximum char displacement in primer-smear mode
- `chars` — character brightness ramp (plain mode)
- `emoji[]` — colour-square emoji palette (emoji mode)
- `gradient[]` — RGB stops for ANSI truecolour half-block mode

Three render paths:
- **plain**: `value → index in chars ramp`
- **emoji**: `value → emoji character` (wide-char, double-column cells)
- **ansi**: pairs two rows into one `▀` cell with independent fg/bg truecolour via `\x1b[38;2;R;G;Bm\x1b[48;2;R;G;Bm▀`

Also supports **primer-smear mode**: source primer text chars are displaced by the plasma field rather than using the char ramp — creates a liquid text effect.

### 3.3 Contour Engine (`src/services/contour-engine.ts`)

Full procedural terrain system:
- **SeededRandom** PRNG (Murmur3-style) — same seed = identical terrain
- **Hill generation** — parametric hills with 5 shape variants: circle, polygon, ellipse, super-ellipse, asymmetric. Each hill has `(cx, cy, radius, peak, shape, rotation, aspect, sides, power)`.
- **Named terrain presets** (`terrainNames[]`) — e.g. `meadow`, `mountain`, `canyon`, `archipelago`, etc.
- **Heightmap** — accumulates contributions from all hills
- **Marching-squares** — `MS_LOOKUP` 16-entry table maps 2×2 binary cell patterns to Unicode box-drawing chars (`╮╭─╰╯│╭╌`)
- **Grid modes** — checker, random, sequential, hexagonal — used in `order` mode
- **Three ContourMode renderers**: `chaos` (pure marching-squares), `order` (density-mapped grid clusters), `hybrid` (both blended by height threshold)
- **ContourPlayer** — wraps engine in a `FramePlayer`-compatible interface with `setMode`, `setTerrain`, `setLevels`, `reroll` controls

### 3.4 Generative Art (inline, `misc-windows.ts`)

```
waveA = sin((x + tick) / 5)
waveB = cos((y - tick) / 4)
orbit = sin((x + y + tick) / 7)
value = (waveA + waveB + orbit + 3) / 6
char  = palette[floor(value * 10)]
```
Palette: ` .:-=+*#%@`. 10 fps.

### 3.5 Pattern Field (inline, `misc-windows.ts`)

```
glyphs[abs((x + y + tick) % 4)]  →  ░▒▓█
```
8 fps diagonal wave.

### 3.6 Animated Primers (`content-windows.ts`)

Multi-frame ASCII art files using `# frame N` comment markers. `ContentMeasurement.detectFrames` splits the file into per-frame line arrays, which are played back via `createPreRenderedPlayer` at the file's declared FPS (default 8 fps). Animation is embedded in the primer viewer — no special window type needed.

### 3.7 Monster Cam (`monster-cam-window.ts` + services)

Live ASCII video at webcam framerate. Grayscale ramp + overlaid bounding-box characters. See §1.18.

---

## 4. Music / Audio

### 4.1 Music Player Window (`src/windows/music-player-window.ts`)

WinAMP-style floating window. Backend: macOS `afplay`. Supports mp3 and wav. Duration detection via `afinfo`. Play/pause uses `SIGSTOP`/`SIGCONT` signals. Volume and scrub require restarting `afplay` with new flags. Exposes `frame.musicPlayer` controller for API/agent use.

### 4.2 Audio Player Controller (`src/services/audio-player-controller.ts`)

Shared service used by both the music player extension and the agent `play_music` tool. Backend: `ffplay` (cross-platform, not macOS-only). Manages a singleton "shared player" across tools. Features:
- Track discovery from `scratch/compositions/` directory
- File list navigation (next/prev)
- Volume control (`VOLUME_STEP = 10`)
- Duration detection via `ffprobe`
- `SIGSTOP`/`SIGCONT` for pause
- `fmtTime()` formatter shared between UI

### 4.3 Agent Audio Tools (in `wibwob-agent-session.ts`)

Two tools registered in the agent's tool set:

| Tool | Description |
|---|---|
| `play_music` | Play a track by path, stop playback, or open the Music Player window. Args: `action` (play/stop/open_window), `filePath`. |
| `list_music` | List audio files available in `scratch/compositions/`. Returns file names and paths. |

### 4.4 Timeline Audio (`src/services/timeline-service.ts`)

The VJ Timeline Service supports an `audio` field in timeline files specifying a track path. When a timeline runs, it spawns `ffplay` (or `afplay` as fallback) and fires visual cues at computed timestamps relative to audio start. See §14.

---

## 5. Text / Content Systems

### 5.1 Primer Files

Primers are `.txt` files in `microapps/*/primers/`, `microapps-private/*/primers/`, or `docs/`. They contain:
- Static ASCII art or lore text
- Multi-frame animations (delimited by `# frame N` comments)
- Optional metadata comments (`# fps:8`, `# width:80`)

### 5.2 Content Service (`src/services/content-service.ts`)

Walks `microapps/` and `microapps-private/` to discover:
- `collectPrimerEntries()` — flat sorted list for the browser
- `collectPrimerGroups()` — per-module groups for the gallery
- `collectGalleryEntries()` — all gallery items
- `collectGalleryTabs()` — tabs for the gallery window

Also handles symlinked private primer directories.

### 5.3 Content Measurement (`src/services/content-measurement.ts`)

Measures any text file and returns a `ContentMeasurement`:
- `lineCount`, `columnWidth` — Unicode-aware via `string-width`
- `frameCount`, `hasFrames`, `animated`, `fps` — from `# frame N` detection
- `recommendedWidth`, `recommendedHeight` — chrome-adjusted window dimensions
- `frames[][]` — split frame text arrays for pre-rendered playback

### 5.4 FIGlet System (`src/services/figlet-service.ts`)

- Font catalogue loaded from `modules[-private]/wibwob-figlet-fonts/fonts.json`
- Categories with names and font lists
- Per-font metadata (height, width)
- `renderFiglet(text, font)` — shells out to `figlet` CLI
- `measureFiglet(text, font, availableWidth)` — returns rendered text + measurement
- Font picker choices list for overlay list prompt
- Default font selected from catalogue `favourites[]`

### 5.5 Chrome Browser Content Extraction (`src/services/chrome-browser-service.ts`)

- Launches headless Chrome from well-known paths (macOS/Linux) or connects to `:9222`
- Navigates to URL, waits for `networkidle2`
- Injects `@mozilla/readability` to extract main article content
- Converts HTML → markdown via `turndown` + `turndown-plugin-gfm`
- Returns `BrowseResult { url, title, markdown }`
- Also provides DuckDuckGo HTML search scraping (`searchDDG`)

### 5.6 Brave Search Service (`src/services/brave-search-service.ts`)

REST-based web search without browser:
- Requires `BRAVE_API_KEY` env var (free tier available)
- `search(query, n)` → `BraveSearchResult[]`
- `fetchContent(url)` → `BraveContentResult` (Readability + Turndown, same pipeline as Chrome service)
- Graceful degradation when key is missing

### 5.7 YouTube Transcript Service (`src/services/youtube-transcript-service.ts`)

Wraps `youtube-transcript-plus` to extract plain text transcripts from YouTube video URLs or IDs.

---

## 6. Games

**None.** There are no game window types in the current TypeScript port.

The C++ Turbo Vision version reportedly had games (Tetris, etc.). The TypeScript port has not yet ported any. The closest things to interactive toys are the contour studio (parameter exploration), plasma screensaver (mood cycling), and the pattern field — but these are purely visual, not scored or rule-based.

---

## 7. Companion / Pets

### Scramble the Cat (`src/windows/misc-windows.ts`)

A 30×10 floating window cycling 4 moods at 2.4-second intervals:

```
 /\_/\        /\_/\        /\_/\        /\_/\
( o.o )      ( -.- )      ( 0.0 )      ( ^.^ )
 > ^ <        > ^ <        > ^ <        > ^ <

Scramble:    Scramble:    Scramble:    Scramble:
 lurking    judging      cat online    purring in ANSI
            layout
```

Tick position is persisted to workspace files so the mood survives reload. `describeState()` exposes `tick` and `contentPreview`. Theme-aware via `onRestyle`.

---

## 8. Agent / AI Integration

### 8.1 Overview

The primary AI surface is the **Wib&Wob Agent** — a native chat window backed by `WibWobAgentSession`. Uses `@mariozechner/pi-agent-core` (Agent class) + `@mariozechner/pi-coding-agent` (session management, tool factories, auth storage, model registry).

### 8.2 Models

Selected via `ModelRegistry` from `@mariozechner/pi-coding-agent`. Models referenced:
- `claude-haiku-*` (fast, for Backrooms)
- `claude-sonnet-*` (default agent model)
- `claude-opus-*` (premium option for Backrooms)

### 8.3 Session Management

- Sessions persist to `scratch/pi-agent-home/` via `SessionManager`
- Up to 15 recent sessions listed via `/resume` slash command
- Session ID, message count, token stats, cost, log file path all visible via `/session`
- Sessions can be resumed by index from the slash command list

### 8.4 System Prompt Loading

`loadBasePrompt()` reads all `.md` files from `microapps-private/wibwob-prompts/` sorted alphabetically, joining them as fragments. Falls back to `.pi/APPEND_SYSTEM.md`, then a minimal default. Hot-reloadable via `agent.reload_prompt` command or `/reload` slash command without restarting the session.

### 8.5 Desktop State Injection

Every agent turn, `transformContext` prepends a compact desktop summary (generated by `formatDesktopSummary`) to the conversation context. The summary includes:
- Theme, screen dimensions, window count
- Per-window: ID, appType, title, size, position, focus indicator
- Spatial minimap (optional, from `scripts/minimap.sh`)

### 8.6 Tool Set

The agent has access to four tool groups:

#### TUI Tools (in `src/services/agent-tools.ts`)

| Tool | Description |
|---|---|
| `tui_get_state` | Full `DesktopState` JSON |
| `tui_list_commands` | All registry commands with descriptions |
| `tui_run_command` | Execute any registry command by ID with args |
| `tui_open_window` | Open a window by type string |
| `tui_open_figlet` | Open a FIGlet banner (text + optional font) |
| `tui_editor_write` | Insert text at cursor in an editor window |
| `tui_close_window` | Close a window by ID |
| `tui_move_window` | Move and/or resize a window |
| `tui_focus_window` | Bring a window to front and focus it |
| `tui_send_input` | Send keyboard input to any window |
| `tui_read_window` | Capture a window's text content |
| `tui_open_chrome_browser` | Open Chrome browser (optional URL) |
| `tui_browser_navigate` | Navigate Chrome to a URL |
| `tui_browser_list_links` | List all links on the current Chrome page |
| `tui_browser_follow_link` | Follow a link by index |
| `tui_browser_search` | Search via the Chrome browser service |
| `tui_web_search` | Web search via Brave API |
| `tui_web_content` | Fetch and extract content from a URL |
| `tui_youtube_transcript` | Extract YouTube video transcript |

#### Jailed Coding Tools (scoped to `REPO_ROOT`)

| Tool | Description |
|---|---|
| `read` | Read file contents (path-jailed) |
| `write` | Write file (path-jailed) |
| `edit` | Find-and-replace edit (path-jailed) |
| `bash` | Shell command (cwd-jailed) |
| `grep` | Regex search in files |
| `find` | Find files by glob |
| `ls` | List directory |

All file paths are checked via `jailPath()` — escaping `REPO_ROOT` throws an error.

#### Pi Session Bridge Tools

| Tool | Description |
|---|---|
| `list_sessions` | Discover running pi sessions via `~/.pi/session-control/*.sock` |
| `send_to_session` | Send a message to a named pi session |
| `get_session_message` | Read the last response from a pi session |
| `start_session_server` | Start the in-app socket server (makes this node visible to others) |

#### Audio Tools

| Tool | Description |
|---|---|
| `play_music` | Play a file, stop, or open the Music Player window |
| `list_music` | List tracks in `scratch/compositions/` |

### 8.7 Window UI (`src/windows/wibwob-agent-window.ts`)

The agent chat window has:
- **Info bar** (top): model + session ID + Claude Code log link
- **Transcript** (scrollable): chat messages rendered by `wibwob-agent-render.ts`
- **Status line**: streaming indicator
- **Input box**: multiline textbox, `Enter`/`Ctrl+S` to submit

Transcript rendering (`wibwob-agent-render.ts`):
- User messages: highlighted with `C().pink` sender label
- Assistant messages: `C().gray` body text, with kaomoji voice marker substitution (`Wib:` / `Wob:` → `༼つ◕‿◕‿⚆༽つ` / `༼つ⚆‿◕‿◕༽つ`) for non-haiku models
- Tool calls: compact one-line summaries (e.g. `read src/foo.ts`, `$ bun run typecheck`, `figlet "HELLO"`)
- Status messages: styled with `C().lime`

### 8.8 Slash Commands (`src/windows/agent-slash-commands.ts`)

| Slash Command | Action |
|---|---|
| `/help` | Show slash command list |
| `/session` | Session ID, model, message count, token stats, cost, log path |
| `/new` | Start a fresh agent session |
| `/resume [n]` | List recent sessions or resume by index |
| `/stop` | Abort current streaming generation |
| `/reload` | Hot-swap system prompt from disk |
| `/model` | Show current model info |
| `/tools` | List active tools |
| `/clear` | Clear transcript (session preserved) |
| `/minimap` | ASCII spatial map via `scripts/minimap.sh` |
| `/state` | Compact desktop state summary |

### 8.9 Two-Voice Persona

The agent is prompted as "Wib & Wob" — a two-voice system. Responses are expected in `Wib: …` / `Wob: …` dialog format. Kaomoji markers replace the name prefixes in rendered output.

---

## 9. Desktop Management

### 9.1 Theme System

**5 built-in variants** (in `src/core/theme/`):
- `wibwob-dark` — primary dark theme
- `wibwob-dark-nord` — Nord colour palette variant
- `wibwob-dark-pastel` — pastel tones variant
- `wibwob-phosphor` — green phosphor terminal aesthetic
- `wibwob-light` — light background theme

Themes are **loaded dynamically** by `microapp-loader.ts` — external modules can register additional variants via `registerExternalTheme()`.

**Semantic tokens** per theme (in `ThemeTokens`): `body`, `bodyAlt`, `header`, `footer`, `input`, `selected`, `muted`, `warning`, `accent`, `success`, `highlight`, `agentBg`, `windowShadow`, `windowBorder`, `windowTitle`.

**Live switching**: All windows implement `onRestyle()` hooks that re-apply theme tokens when the theme changes. Switching is instantaneous without closing/reopening windows.

**Switching methods**: Alt+T (cycle), menu `View > Cycle/Choose Theme`, command palette, `POST /commands/run {"id":"theme.set"}`, agent tool `tui_run_command`.

**Persistence**: Current theme name is saved into workspace files and restored on workspace load.

### 9.2 Window Manager (`src/core/window-manager.ts`)

Core responsibilities:
- **Z-order stack** — `windows[]` array, last = topmost
- **createFrame()** — builds blessed frame (border), shadow, titlebar, body; wires drag/resize/focus/context-menu events
- **Drag** — click-hold on titlebar, mouse move event on screen
- **Resize** — Shift+Arrow keys (1 cell), or mouse corner/edge drag (planned `ResizeState`)
- **Double-click titlebar** — toggle maximize (saves/restores `savedBounds`)
- **Focus** — brings window to top of z-order, calls blessed `focus()` on body widget
- **Close** — removes from stack, calls `cleanup()`, destroys blessed elements
- **Tile** — grid layout distributing windows evenly across desktop
- **Cascade** — staggered diagonal layout (2-cell offset per window)
- **Implements `WindowFacade`** — single interface consumed by all external callers

### 9.3 Window Chrome (`src/core/window-chrome.ts`)

Centralised chrome math:
- `ChromeMode`: `standard` (+2w, +2h), `toolbar` (+4w, +5h), `frameless` (0, 0)
- `contentToWindowSize(content, chromeMode)` — only place border/titlebar padding is computed
- `figlet` kind uses `toolbar` mode (has a 1-row toolbar above the viewer)

### 9.4 Workspace Persistence

- **WorkspaceService** saves named JSON files to `scratch/workspaces/<name>.json`
- Format v2: `{ version: 2, theme, windows: WindowSnapshot[] }`
- **SnapshotRegistry** (`src/core/snapshot-registry.ts`) provides compile-time-checked serialize/restore handlers for all 14 `PersistableAppType` values
- **Dynamic handlers** can be registered by microapp modules at runtime
- **Default workspace** is `default.json`, auto-restored on launch
- Legacy appType remaps handle old workspace files (`wibwob-chat-v2` → `wibwob-agent`)

### 9.5 Desktop Geometry (`src/core/desktop-geometry.ts`)

Canonical screen dimensions snapshot with `width`, `height`, `cellAspect`. Never computed locally in window code.

### 9.6 Overlay Manager (`src/core/overlay-manager.ts`)

Transient UI primitives:
- `flash(message)` — status bar flash
- `openValuePrompt(label, default, onSubmit)` — single-line text input overlay
- `openListPrompt(label, choices, index, onSelect, opts?)` — vi-key list picker with optional live preview callback
- Shared file browser (for workspace/file selection pickers)

---

## 10. Network / API

### 10.1 Control API (`src/services/control-api.ts`)

Local HTTP server (`Bun.serve()`) on port 8099 (configurable via `CONTROL_API_PORT` env). Hand-rolled routing. Returns JSON. Intended for autonomous debug loops, agent-driven validation, and external tooling.

#### GET Endpoints

| Endpoint | Description |
|---|---|
| `GET /` or `/help` | Structured endpoint catalogue with method, path, description, body fields |
| `GET /health` | Health check `{ok:true, port:number, instanceId:string, instanceLabel?:string}` |
| `GET /openapi.json` | Full OpenAPI 3.0 spec derived from `ENDPOINT_CATALOGUE` |
| `GET /state` | Full live `DesktopState` JSON |
| `GET /commands/list?surface=` | All commands (optionally filtered by `menu\|palette\|api\|agent`) |
| `GET /content/primer-info?path=` | Content metadata for a primer file |
| `GET /windows/text?id=N` | Raw text content of window N |
| `GET /screenshot/text?id=N` | ANSI-stripped text crop of window N |

#### POST Endpoints

| Endpoint | Body | Description |
|---|---|---|
| `POST /commands/run` | `{id, args?}` | Run any registry command by ID |
| `POST /view/primer/open` | `{filePath}` | Open primer viewer |
| `POST /view/figlet/open` | `{text, font?}` | Open FIGlet banner |
| `POST /view/editor/open` | `{filePath?, title?, initial?}` | Open text editor |
| `POST /view/backrooms/open` | `{theme, mode, model, turns, primers?}` | Open Backrooms TV |
| `POST /view/browser-reader/open` | `{filePath?}` | Open document reader |
| `POST /view/art/open` | `{}` | Open generative art |
| `POST /view/monster-cam/open` | `{}` | Open Monster Cam |
| `POST /view/wibwob-agent/open` | `{}` | Open / focus agent window |
| `POST /view/companion/open` | `{}` | Open Scramble |
| `POST /view/music-player/open` | `{filePath?}` | Open music player |
| `POST /view/primer-browser/open` | `{}` | Open primer browser |
| `POST /view/file-manager/open` | `{}` | Open file manager |
| `POST /view/primer-gallery/open` | `{}` | Open gallery |
| `POST /view/workspace/open` | `{}` | Open workspace manager |
| `POST /view/palette/open` | `{}` | Open command palette |
| `POST /view/inspector/open` | `{}` | Open state inspector |
| `POST /windows/focus` | `{id}` | Focus a window |
| `POST /windows/move` | `{id, left, top}` | Move a window |
| `POST /windows/resize` | `{id, width, height}` | Resize a window |
| `POST /windows/close` | `{id}` | Close a window |
| `POST /windows/maximize` | `{id}` | Toggle maximize |
| `POST /windows/batch` | `{ops:[{id,x?,y?,w?,h?,close?}]}` | Batch move/resize/close |
| `POST /windows/input` | `{id, input}` | Send keyboard input |
| `POST /windows/agent-message` | `{id, text, sender?}` | Send labelled message to agent |
| `POST /windows/text/export` | `{id, name?}` | Export window text to `scratch/captures/` |
| `POST /workspace/save` | `{name}` | Save workspace |
| `POST /workspace/load` | `{name}` | Load workspace |

### 10.2 Pi Session Bridge (`src/services/pi-session-bridge.ts`)

Unix socket JSON-RPC client for communication with external `pi` coding agent sessions. Protocol: newline-delimited JSON over `~/.pi/session-control/<id>.sock`.

- `listSessions()` — discovers live sockets + alias symlinks → `LiveSession[]`
- `sendToSession(name, message)` — routes message via alias or socket ID
- `getLastMessage(name)` — reads last reply
- `startSessionServer()` — **server mode**: creates a socket under `~/.pi/session-control/`, registers the in-app agent as a first-class peer visible to other pi nodes. Implements `send`, `get_message`, `get_summary`, `clear` RPC methods.
- `listLocalSessions(repoRoot)` — lists persisted Claude Code JSONL session files (for `/resume`)

### 10.3 Brave Search API

REST calls to `https://api.search.brave.com/res/v1/web/search`. Requires `BRAVE_API_KEY`. Fallback to Chrome browser service if key is absent.

### 10.4 YouTube Transcript

`youtube-transcript-plus` npm package. No API key needed.

---

## 11. Services / Infrastructure

| Service | Source | Responsibility |
|---|---|---|
| `StateService` | `src/services/state-service.ts` | Canonical `DesktopState` snapshot, file persistence to `scratch/app-state.json`, pub/sub for State Inspector |
| `WorkspaceService` | `src/services/workspace-service.ts` | Named workspace JSON read/write, current name tracking, list |
| `WorkspaceSnapshots` | `src/core/workspace-snapshots.ts` | Collect serializable windows, dispatch to SnapshotRegistry |
| `SnapshotRegistry` | `src/core/snapshot-registry.ts` | Compile-time-checked serialize/restore per `PersistableAppType` |
| `ContentService` | `src/services/content-service.ts` | Primer/gallery file discovery across module directories |
| `ContentMeasurement` | `src/services/content-measurement.ts` | Unicode-aware dimension measurement, frame detection |
| `BackroomsService` | `src/services/backrooms-service.ts` | CLI discovery, primer collection, log management, playback streams |
| `FigletService` | `src/services/figlet-service.ts` | Font catalogue, `figlet` CLI bridge, font picker choices |
| `AnimationService` | `src/services/animation-service.ts` | `FramePlayer` primitives (pre-rendered + live + lazy-mounted) |
| `PlasmaEngine` | `src/services/plasma-engine.ts` | Sinusoidal plasma maths, mood definitions, 3 render modes |
| `ContourEngine` | `src/services/contour-engine.ts` | Seeded terrain generation, marching-squares, ContourPlayer |
| `ModuleLoader` | `src/services/microapp-loader.ts` | Dynamic module discovery (themes, microapps), `MicroappHost` |
| `MonsterCamService` | `src/services/monster-cam-service.ts` | Python worker lifecycle, Unix socket frame parsing |
| `ChromeBrowserService` | `src/services/chrome-browser-service.ts` | Puppeteer CDP, Readability, Turndown |
| `BraveSearchService` | `src/services/brave-search-service.ts` | Brave Search REST API + content extraction |
| `AudioPlayerController` | `src/services/audio-player-controller.ts` | `ffplay`-backed shared player, track discovery |
| `TimelineService` | `src/services/timeline-service.ts` | Parse, schedule, and execute VJ timeline files |
| `ScenePlanner` | `src/services/scene-planner.ts` | Diff desired scene vs live desktop → `SceneOp[]` |
| `SceneLayout` | `src/services/scene-layout.ts` | Resolve layout tokens (hero-left, lyric-bar, etc.) → `Rect` |
| `AgentTools` | `src/services/agent-tools.ts` | TUI `AgentTool[]` definitions (19 tools) |
| `AgentSessionHelpers` | `src/services/agent-session-helpers.ts` | Claude Code JSONL parsing, session preview formatting |
| `PiSessionBridge` | `src/services/pi-session-bridge.ts` | Unix socket JSON-RPC client + server |
| `YouTubeTranscriptService` | `src/services/youtube-transcript-service.ts` | YouTube transcript extraction |
| `AppLogger` | `src/services/app-logger.ts` | Application logging |
| `ControlAPI` | `src/services/control-api.ts` | HTTP control surface |
| `FileActions` | `src/services/file-actions.ts` | Save, save-as, `writeEditorWindow()` |
| `WorkspaceUI` | `src/services/workspace-ui.ts` | Workspace-related overlay flows |
| `AppController` | `src/core/app-controller.ts` | App composition root, menu wiring, workspace restore |
| `WindowManager` | `src/core/window-manager.ts` | Z-order, focus, drag, resize, tile, cascade |
| `WindowFacade` | `src/core/window-facade.ts` | 11-method interface for all window operations |
| `CommandCatalog` | `src/core/command-catalog.ts` | Source of truth for all user-visible command metadata |
| `CommandRegistry` | `src/core/command-registry.ts` | Execution + projection layer, menu/palette/API/agent exposure |
| `DesktopGeometry` | `src/core/desktop-geometry.ts` | Canonical screen snapshot |
| `WindowChrome` | `src/core/window-chrome.ts` | Content→window size math |
| `OverlayManager` | `src/core/overlay-manager.ts` | Flash, value prompt, list prompt, shared browsers |
| `AppearanceService` | `src/core/appearance-service.ts` | Appearance mode (system/light/dark — currently always dark) |
| `ThemeResolver` | `src/core/theme/resolver.ts` | Active theme variant getter, live switching |
| `LayoutParts` | `src/core/ui-parts.ts` | Composable layout primitives: `createStack`, `createRow`, `createHeaderBar`, `createStatusBar`, `createTextBlock`, `createRule`, `createFigletDisplay`, `createAnimatedPanel` |
| `UIPartsSlim` | `src/core/ui-primitives.ts` | `createScrollbar`, `safeSetStyle` |
| `ContextMenuItems` | `src/core/context-menu-items.ts` | File-path context menu item factories |
| `EditorCoordinator` | `src/core/editor-coordinator.ts` | Intercepts key events for all editor windows |
| `EditorService` | `src/services/editor-service.ts` | Text editor cursor/buffer manipulation logic |
| `CustomCursor` | `src/core/custom-cursor.ts` | Custom cursor rendering |
| `Primitives` | `src/core/primitives.ts` | Shared low-level utilities |
| `CLI` | `src/core/cli.ts` | CLI flag parsing (`--dev`, `--help`) |
| `Config` | `src/core/config.ts` | Path constants (`REPO_ROOT`, `WORKSPACES_DIR`, etc.) |

---

## 12. Backrooms System

### 12.1 What It Is

The Backrooms is a creative writing / LLM collaborative system living in a **sibling repository** (`wibandwob-backrooms/`). WibWob-DOS acts as a front-end TV for this external system.

### 12.2 External CLI

`wibandwob-backrooms/src/ui/cli-v3.ts` — spawned by `BackroomsService.resolveCliCommand()` as `bun src/ui/cli-v3.ts`. Runs a multi-turn Claude session with Backrooms-specific primers and themes, writing dialogue to stdout.

### 12.3 Primers

Backrooms-specific primers live in `wibandwob-backrooms/primers/`. WibWob primers from `modules[-private]/*/primers/` take precedence on name collision. `BackroomsService.collectPrimers()` merges both sources.

### 12.4 Launch Modes

| Mode | Description |
|---|---|
| `live` | Spawns real `cli-v3.ts`, streams actual Claude API output |
| `fake-live` | Replays lines from local log files at 30ms/line (simulated live) |
| `playback` | Auto-fallback on timeout (8s) or error; uses sampled log files at 35ms/line |
| `auto` | Tries `live`, falls back to `playback` on failure |

### 12.5 Run Root Isolation

`BackroomsService.prepareRunRoot(channel)` creates a per-run directory under `logs/backrooms-tv/runs/` and sets `WIBWOB_ROOT` env var. This isolates per-run state from the main repo.

### 12.6 Log Management

All session output is written to `logs/backrooms-tv/<timestamp>_<theme>.txt`. The Log Browser (`backrooms-log-browser-window.ts`) sorts these by modification time, shows a live indicator (●) for files touched < 30s ago, previews content, and can replay or extract snippets.

### 12.7 Playback Stream Construction

`BackroomsService.buildPlaybackStream(channel, n)` randomly samples up to `n` log files, concatenates their lines, and returns them for fake-live playback. This ensures the TV always has content even if the live API is unavailable.

---

## 13. Command Palette

Built from all `AppCommandDefinition` entries with a `palettePlacement` field. ~45 commands. Vi-key navigable list with Enter to run.

**Palette entries by category** (sorted by `palettePlacement.order`):

| Order | Label |
|---|---|
| 0 | Backrooms TV... |
| 5 | Backrooms Log Browser |
| 10 | Open File Manager |
| 11 | Finder: Search Files |
| 12 | Finder: Go to Path |
| 13 | Finder: Toggle List/Icon View |
| 15 | Finder: Advanced Search (QMD) |
| 16 | Finder: Bookmark Current Path |
| 17 | Finder: New Folder |
| 18 | Finder: Refresh |
| 19 | Finder: Sort By |
| 20 | Open Gallery |
| 25 | (Primer Gallery) |
| 30 | Document Reader |
| 50 | Open Figlet Banner |
| 52 | Plasma Screensaver |
| 53 | Plasma from Primer |
| 55 | Contour Studio |
| 56 | Terrain Lab |
| 57 | Contour Triptych |
| 60 | Pattern Window |
| 70 | Save |
| 80 | Load Workspace... (interactive) |
| 110 | Open Chrome Browser |
| 115 | Music Player |
| 120 | Workspace Manager |
| 130 | Wib&Wob Agent |
| 145 | Monster Cam |
| 160 | Open State Inspector |
| 170 | Save Workspace |
| 180 | Load Workspace (named) |
| 190 | Cycle Theme |
| 191 | Choose Theme... |
| 200 | Copy Window Text |
| 210 | Export Window Text... |
| 200 | View README |
| + dynamic | (microapp-registered entries) |

---

## 14. Unique / Distinctive Features

### 14.1 Composable UI Parts System (`src/core/ui-parts.ts`)

A layout engine built on top of blessed that provides:
- `createStack(parent, children[])` — vertical or horizontal distribution with `basis` (px, fr, %)
- `createRow(parent, children[])` — horizontal column distribution
- `createNodePart(node)` — wraps an existing blessed node as a layout part
- `createHeaderBar(parent)` — themed header with left/right text fields
- `createStatusBar(parent)` — themed status bar
- `createTextBlock(parent)` — auto-wrapping text block
- `createRule(parent, axis)` — vertical or horizontal divider
- `createFigletDisplay(parent)` — embedded FIGlet art with font/text controls
- `createAnimatedPanel(parent)` — embedded `FramePlayer` surface

Used by Plasma, Terrain Lab, Contour Triptych, and microapps. Each part exposes `layout(rect)`, `restyle()`, and `destroy()`. This is the foundation for composable "dashboard-style" windows.

### 14.2 Microapp Module System (`src/services/microapp-loader.ts`)

Drop-in TypeScript modules loaded at runtime from `microapps/` or `microapps-private/`:
- `microapp.json` manifest declares type, id, entry, menu/palette/API visibility
- `setup(host: MicroappHost)` function gets full access to screen, window manager, UI parts, commands, geometry, and theme
- Can register commands, themes, and workspace snapshot handlers
- Menu and palette entries are injected into the command registry dynamically
- Windows use the `microapp` kind and report their module ID as appType

Known example: `wibwob.poetry-clock` — a clock microapp with `clock` / `sentient` modes and `plain` / `liminal` / `scramble` voices.

### 14.3 VJ Timeline System (`src/services/timeline-service.ts`, `timeline-types.ts`, `scene-planner.ts`, `scene-layout.ts`)

Declarative music video / VJ show scheduling:

**Timeline file format** (JSON or YAML):
```json
{
  "audio": "scratch/compositions/track.mp3",
  "bpm": 120,
  "scenes": { "intro": { "windows": [...] } },
  "cues": [
    { "at": 0, "scene": "intro" },
    { "at": "bar:8", "command": "theme.set", "args": {"name": "wibwob-phosphor"} },
    { "at": "section:chorus", "window": "primer", "filePath": "...", "layout": "hero-left" }
  ]
}
```

**Layout tokens** resolve to absolute geometry at runtime: `hero-left`, `hero-right`, `hero-center`, `backdrop`, `top-banner`, `bottom-banner`, `lyric-bar`, `top-right-corner`, `sidebar-right`, `center-card`, `strip-bottom`, plus proportional `{xPct, yPct, wPct, hPct}` and explicit `{x, y, w, h}`.

**Beat/bar/section timing** references the `BeatMap` (from audio analysis) for musical precision.

**ScenePlanner** diffs desired scene state vs live desktop → produces `SceneOp[]` (close, open, move, theme, command) without touching window IDs — uses stable `role` strings.

**In-process dispatch** — no HTTP round-trips per cue; uses `CommandRegistry` + `WindowFacade` directly.

### 14.4 Monster Cam (CV Integration)

The only window that bridges a Python subprocess (MediaPipe + OpenCV) with the TypeScript TUI via Unix socket IPC. `monster_cam_worker.py` runs in a Bun-spawned Python process, encodes binary packets with a fixed header + grayscale pixel data, and the TypeScript `MonsterCamService` deserialises and emits `frame` events. The window renders everything at terminal resolution using tagged blessed strings with per-cell colour overrides.

### 14.5 Plasma "From Primer" Mode

`plasma.from-primer` command opens Plasma by analysing a primer file's text content and using the agent (or a heuristic) to select the most thematically appropriate plasma mood. The primer name, a short preview, and the matching reason are displayed in the info panel.

### 14.6 Pi Session Bridge — Peer Network

WibWob-DOS can join the `pi` session network as a first-class node. When `startSessionServer()` is called, it creates a Unix socket at `~/.pi/session-control/<id>.sock`, becoming discoverable by any other running pi session via `list_sessions`. Implements the full four-method RPC protocol: `send`, `get_message`, `get_summary`, `clear`.

### 14.7 Backrooms Fake-Live Mode

A deliberate fallback that makes a locally-stored past session appear to stream in real time by replaying saved log lines at 30ms intervals. Indistinguishable from a live session visually. Used when no Claude API key is present or as a content demo.

### 14.8 Full Agent-Controllable Desktop

Every user-visible surface has:
1. A `describeState()` hook exposing semantic metadata
2. A command registry entry for opening/controlling it
3. A control API endpoint (direct or via `/commands/run`)
4. An agent tool (via `tui_run_command`)

This means an agent running inside the Wib&Wob Agent window can autonomously open/close/arrange any window, set themes, browse content, search the web, edit files, run shell commands, and compose VJ shows — all through the same tool surface exposed to external agents via the control API.

---

## 15. Dependencies Summary

| Package | Purpose |
|---|---|
| `blessed` | TUI rendering engine |
| `@mariozechner/pi-agent-core` | Agent + tool primitives |
| `@mariozechner/pi-coding-agent` | Session management, jailed coding tools, auth |
| `@anthropic-ai/claude-code` | Claude API access |
| `@mediapipe/tasks-vision` | Face/hand/pose detection (Monster Cam worker) |
| `@mozilla/readability` | Article extraction from HTML |
| `@skitee3000/bun-pty` | PTY support (present, not yet used for main features) |
| `jsdom` | DOM environment for Readability |
| `puppeteer-core` | Chrome DevTools Protocol |
| `string-width` | Unicode-aware character display width |
| `turndown` + `turndown-plugin-gfm` | HTML → Markdown conversion |
| `youtube-transcript-plus` | YouTube transcript extraction |
| `typescript` | Type checking |
| `bun` (runtime) | JS runtime, package manager, test runner |

**External system dependencies** (not npm):
- `figlet` CLI — FIGlet banner rendering
- `ffplay` / `ffprobe` — audio playback + duration detection
- `afplay` / `afinfo` — macOS audio (Music Player window, alternative to ffplay)
- Python 3 + `opencv-python` + `mediapipe` — Monster Cam worker
- Chrome/Chromium — Chrome Browser window
- Sibling `wibandwob-backrooms` repo + Bun — Backrooms TV live mode
