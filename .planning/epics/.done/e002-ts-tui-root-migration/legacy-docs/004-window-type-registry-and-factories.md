# 004 — Window Type Registry & Factory Pattern

> Developer handover document for the WibWob-DOS TypeScript rebuild.
> Covers the full C++ window type inventory, the TS spike's current factory shape,
> and a concrete decomposition strategy for the rebuild.

---

## 1. Full Inventory of C++ Window Types (33 registered)

The single source of truth is `app/window_type_registry.cpp`, lines defining the `k_specs[]` table.
Each entry is a `WindowTypeSpec` triple: `{ type_slug, spawn_fn, match_fn }`.

### 1.1 Registry Table (k_specs[])

| # | Type Slug | Spawn Function | Match Function | Spawn Params | Default Size |
|---|-----------|---------------|----------------|-------------|-------------|
| 1 | `test_pattern` | `spawn_test` | `match_test_pattern` (always false) | bounds only | default |
| 2 | `gradient` | `spawn_gradient` | `match_gradient` → `TGradientView` | `gradient` (kind string) | default |
| 3 | `frame_player` | `spawn_frame_player` | `match_frame_player` → `FrameFilePlayerView` or `TTextFileView` | `path` (required), `frameless`, `shadowless`, `title` | auto-sized to content |
| 4 | `text_view` | `spawn_text_view` | `match_text_view` → `TTransparentTextWindow` | `path` (required) | 80×24 + cascade offset |
| 5 | `text_editor` | `spawn_text_editor` | `match_text_editor` → `TTextEditorWindow` | `title` | default |
| 6 | `browser` | `spawn_browser` | `match_browser` → `TBrowserWindow` | bounds only | default |
| 7 | `verse` | `spawn_verse` | `match_verse` → `TGenerativeVerseView` | bounds only | 96×30 centered |
| 8 | `mycelium` | `spawn_mycelium` | `match_mycelium` → `TGenerativeMyceliumView` | bounds only | 96×30 centered |
| 9 | `orbit` | `spawn_orbit` | `match_orbit` → `TGenerativeOrbitView` | bounds only | 96×30 centered |
| 10 | `torus` | `spawn_torus` | `match_torus` → `TGenerativeTorusView` | bounds only | 90×28 centered |
| 11 | `cube` | `spawn_cube` | `match_cube` → `TGenerativeCubeView` | bounds only | 90×28 centered |
| 12 | `life` | `spawn_life` | `match_life` → `TGameOfLifeView` | bounds only | 90×28 centered |
| 13 | `blocks` | `spawn_blocks` | `match_blocks` → `TAnimatedBlocksView` | bounds only | 84×24 centered |
| 14 | `score` | `spawn_score` | `match_score` → `TAnimatedScoreView` | bounds only | ~84×24 |
| 15 | `ascii` | `spawn_ascii` | `match_ascii` → `TAnimatedAsciiView` | bounds only | ~84×24 |
| 16 | `animated_gradient` | `spawn_animated_gradient` | `match_animated_gradient` → `TAnimatedHGradientView` | bounds only | ~84×24 |
| 17 | `monster_cam` | `spawn_monster_cam` | `match_monster_cam` → `TGenerativeMonsterCamView` | bounds only | ~96×30 |
| 18 | `monster_verse` | `spawn_monster_verse` | `match_monster_verse` → `TGenerativeMonsterVerseView` | bounds only | 96×30 centered |
| 19 | `contour_map` | `spawn_contour_map` | `match_contour_map` → `TContourMapView` | bounds only (+seed/terrain/levels via dialog) | ~96×30 |
| 20 | `generative_lab` | `spawn_generative_lab` | `match_generative_lab` → `TGenerativeLabView` | bounds only (+preset via dialog) | ~96×30 |
| 21 | `monster_portal` | `spawn_monster_portal` | `match_monster_portal` → `TGenerativeMonsterPortalView` | bounds only | 96×30 centered |
| 22 | `paint` | `spawn_paint` | `match_paint` → `TPaintWindow` | bounds only | 90% of desktop, centered |
| 23 | `micropolis_ascii` | `spawn_micropolis_ascii` | `match_micropolis_ascii` → `TMicropolisAsciiView` | bounds only | 110×34 centered |
| 24 | `terminal` | `spawn_terminal` | `match_terminal` → `TWibWobTerminalWindow` | bounds only | 80×24 centered |
| 25 | `room_chat` | `spawn_room_chat` | `match_room_chat` → `TRoomChatWindow` | bounds only | default |
| 26 | `wibwob` | inline lambda | `match_wibwob` → `TWibWobWindow` | bounds only | 80×27 |
| 27 | `scramble` | `nullptr` (not spawnable) | `match_scramble` → `TScrambleWindow` | N/A — internal overlay | N/A |
| 28 | `quadra` | `spawn_quadra` | `match_quadra` → `TQuadraView` | bounds only | default |
| 29 | `snake` | `spawn_snake` | `match_snake` → `TSnakeView` | bounds only | default |
| 30 | `rogue` | `spawn_rogue` | `match_rogue` → `TRogueView` | bounds only | default |
| 31 | `deep_signal` | `spawn_deep_signal` | `match_deep_signal` → `TDeepSignalView` | bounds only | default |
| 32 | `backrooms_tv` | `spawn_backrooms_tv` | `match_backrooms_tv` → `TBackroomsTvView` | bounds only (+ BackroomsChannel via dialog or params) | 100×35 centered |
| 33 | `app_launcher` | `spawn_app_launcher` | `match_app_launcher` → `TAppLauncherWindow` | bounds only | default |
| 34 | `gallery` | `spawn_gallery` | `match_gallery` → `TGalleryWindow` | bounds only | default |
| 35 | `figlet_text` | `spawn_figlet_text` | `match_figlet_text` → `TFigletTextWindow` | `text` (required), `font`, `frameless`, `shadowless` | auto-sized to rendered text |

> **Note:** The C++ comment says "33 registered types" but the actual `k_specs[]` table has **35 entries**.
> The count likely excluded `scramble` (not spawnable) and `wibwob` (internal-only), making 33 *externally spawnable* types.

### 1.2 Spawn Signatures

Every spawn wrapper in `window_type_registry.cpp` follows the same contract:

```cpp
// window_type_registry.h, line 14
using WinSpawnFn = const char* (*)(TWwdosApp&,
                                   const std::map<std::string, std::string>&);
```

The `kv` map carries flat string parameters. The `opt_bounds()` helper (line 79) extracts `x`, `y`, `w`, `h` into a `TRect*`.

**Parameter shapes by type:**

| Pattern | Types | Extra KV Keys |
|---------|-------|---------------|
| Bounds-only | 27 types (verse, mycelium, orbit, torus, cube, life, blocks, score, ascii, animated_gradient, monster_cam, monster_verse, contour_map, generative_lab, monster_portal, paint, micropolis_ascii, terminal, room_chat, wibwob, quadra, snake, rogue, deep_signal, backrooms_tv, app_launcher, gallery) | `x,y,w,h` (all optional) |
| Bounds + kind | gradient | `gradient` (string: "horizontal"/"vertical"/etc) |
| Bounds + path | frame_player, text_view | `path` (required), + `frameless`, `shadowless`, `title` for frame_player |
| Bounds + title | text_editor | `title` (optional) |
| Bounds + text/font | figlet_text | `text` (required), `font`, `frameless`, `shadowless` |
| Not spawnable | scramble | `spawn` is `nullptr` |

### 1.3 Match Functions

Match functions identify existing windows by type. Two patterns exist:

```cpp
// Pattern 1: check for child view (used by 21 types)
template <typename ViewType>
static bool has_child_view(TWindow* w) { /* walk child list, dynamic_cast */ }

// Pattern 2: direct dynamic_cast on window (used by 11 types)
static bool match_paint(TWindow* w) { return dynamic_cast<TPaintWindow*>(w) != nullptr; }
```

The match functions are used by the state serializer to tag each window with its `type` slug for workspace save/restore.

---

## 2. Simple vs Complex Window Types

### 2.1 Simple — Stateless Timer-Driven Render (20 types)

These windows are "fire and forget": create, insert into desktop, and an internal timer drives animation. No user input state beyond window geometry.

| Category | Types |
|----------|-------|
| **Generative art** | `verse`, `mycelium`, `orbit`, `torus`, `cube`, `monster_cam`, `monster_verse`, `monster_portal`, `animated_gradient`, `contour_map` |
| **Animated patterns** | `blocks`, `score`, `ascii`, `life` |
| **Static display** | `gradient`, `test_pattern` |
| **Read-only viewers** | `text_view`, `frame_player` |
| **Launchers/browsers** | `app_launcher`, `gallery` |

**Rebuild cost:** Minimal. Each needs only a `render(tick, width, height) → CellGrid` function and a timer interval.

### 2.2 Complex — Interactive State Machines (15 types)

These have internal state, user input handling, sub-process management, or persistence:

| Type | Complexity Source |
|------|-------------------|
| `text_editor` | Cursor model, file I/O, undo (future), save/load |
| `browser` | List navigation, search/filter, file preview |
| `paint` | Canvas cell grid, tool state (pen/line/rect/text), file I/O (.wwp format), figlet stamping, undo stack, palette state |
| `terminal` | PTY subprocess, input line, VT escape handling, resize sync |
| `backrooms_tv` | Child process lifecycle, live/playback/fake-live mode FSM, BackroomsChannel config, stderr fallback |
| `wibwob` | Chat transcript, LLM integration, message history |
| `room_chat` | Multi-user messaging, presence tracking, timestamp handling |
| `scramble` | Overlay (not a real window), mood state, LLM ask, expand/collapse |
| `micropolis_ascii` | Full SimCity engine, tool API, map rendering, budget/population state |
| `figlet_text` | Font catalogue, text/font/color mutation, auto-sizing |
| `generative_lab` | Preset selection, cellular automata rules, configurable parameters |
| `quadra` | Tetris-style game state (board, piece queue, score, levels) |
| `snake` | Game loop, direction queue, food placement, collision |
| `rogue` | Dungeon map generation, player position, inventory, combat |
| `deep_signal` | Space scanner game state, signal processing |

**Rebuild cost:** High. Each needs its own state model, event handlers, and often external service integration.

---

## 3. WindowRecord / WindowSnapshot Serialization Contract (TS Spike)

### 3.1 WindowRecord (runtime representation)

Defined in `spikes/ts-tui-mvp/src/core/types.ts`, line 109:

```typescript
export interface WindowRecord {
  id: number;
  kind: WindowKind;
  title: string;
  frame: Box;              // blessed outer container (border, shadow, title bar)
  body: Box;               // blessed inner content area
  close: () => void;       // teardown + remove from manager
  focus: () => void;       // bring to front + focus inner widget
  titleBar?: Box;          // blessed title bar widget
  editor?: EditorState;    // only for kind === "editor"
  filePath?: string;       // source file path (primers, editor)
  terminal?: TerminalState; // only for kind === "terminal"
  chat?: ChatState;        // only for kind === "chat"
  writeInput?: (input: string) => void;  // terminal write pipe
  cleanup?: () => void;    // timer/process teardown on close
  describeState?: () => WindowStateDetails;  // introspection for API/inspector
  openContextMenu?: (x?: number, y?: number) => void;
}
```

**Key design problem:** The `WindowRecord` has grown optional fields for each window type (`editor?`, `terminal?`, `chat?`). This is the discriminated-union-via-optional-fields antipattern — the rebuild should use a proper tagged union.

### 3.2 WindowSnapshot (persistence format)

Defined in `spikes/ts-tui-mvp/src/core/types.ts`, line 71:

```typescript
export interface WindowSnapshot {
  kind: WindowKind;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  filePath?: string;
  focused?: boolean;
  payload?: Record<string, unknown>;  // type-specific state blob
}
```

Serialization happens in `app-controller.ts` via `serializeWindowSnapshot()` and `buildWindowSnapshotPayload()` (line ~2380). The payload shape varies per kind:

| Kind | Payload Keys |
|------|-------------|
| `editor` | `content: string`, `cursor: number` |
| `browser` | `selectedIndex: number` |
| `gallery` | `activeTabIndex`, `searchValue`, `selectedIndex` |
| `figlet` | `inputText`, `font` |
| `chat` | `transcriptLines: string[]`, `draft: string` |
| `backrooms` | `theme`, `primers`, `turns`, `model`, `mode` |
| `companion` | `tick: number` |
| all others | `undefined` |

Restore happens via `restoreWindowSnapshot()` — a 60-line switch statement that dispatches to the correct `open*Window()` method.

### 3.3 DesktopWindowState (API/inspector view)

Each window exposes state via `describeState()` returning `WindowStateDetails`:

```typescript
export interface WindowStateDetails {
  appType: string;        // e.g. "terminal-shell", "primer-viewer", "paint-canvas"
  summary?: string;
  contentPreview?: string;
  lineCount?: number;
  [key: string]: unknown; // type-specific extras
}
```

This is collected into `DesktopState` for the control API and state inspector.

---

## 4. Factory Decomposition Strategy

### 4.1 The Problem: God Class

`app/wwdos_app.cpp` is **5,609 lines**. The TS spike's `app-controller.ts` is **2,514 lines**. Both are single-file god classes where every window factory method lives as a private method.

In the C++ codebase, `wwdos_app.cpp` contains ~35 `api_spawn_*` functions (lines 2931–5420), each following a pattern:

```cpp
void api_spawn_verse(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeVerseWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}
```

The TS spike's `app-controller.ts` has the same shape — each `open*Window()` method is 20–150 lines of blessed widget construction inline.

### 4.2 The Solution: Registry Map + WindowType Modules

Replace the god class with a **registry pattern** matching the C++ `WindowTypeSpec` table, but using TypeScript modules:

```
src/
  window-types/
    index.ts              # registry map: WindowKind → WindowTypeModule
    base.ts               # shared interfaces and helpers
    verse.ts              # one file per simple type
    orbit.ts
    terminal.ts           # one file per complex type
    paint.ts
    backrooms.ts
    figlet.ts
    ...
```

Each module exports a `WindowTypeModule`:

```typescript
// src/window-types/base.ts

export interface WindowSpawnOptions {
  bounds?: { x: number; y: number; w: number; h: number };
  params?: Record<string, string>;
}

export interface WindowTypeModule<TState = unknown> {
  /** Canonical slug matching C++ registry */
  readonly kind: WindowKind;

  /** Default window dimensions [width, height] */
  readonly defaultSize: [number, number];

  /** Chrome mode for frame calculation */
  readonly chromeMode: ChromeMode;

  /** Create the window's initial state */
  createState(options: WindowSpawnOptions): TState;

  /** Build the blessed widget tree inside the frame body */
  buildContent(body: Box, state: TState, ctx: WindowContext): void;

  /** Optional: tick handler for animated windows (interval in ms) */
  tick?: {
    interval: number;
    handler: (state: TState, width: number, height: number) => string;
  };

  /** Optional: keyboard event handler */
  handleKey?: (state: TState, ch: string, key: KeyEvent) => void;

  /** Serialize type-specific state for workspace save */
  serializePayload?(state: TState): Record<string, unknown> | undefined;

  /** Restore from workspace snapshot */
  restorePayload?(payload: Record<string, unknown>): Partial<WindowSpawnOptions>;

  /** Describe state for API/inspector */
  describeState?(state: TState): WindowStateDetails;

  /** Cleanup on close (kill timers, processes, etc) */
  cleanup?(state: TState): void;
}
```

### 4.3 Registry Map

```typescript
// src/window-types/index.ts
import type { WindowKind } from "../core/types.js";
import type { WindowTypeModule } from "./base.js";

import { verseType } from "./verse.js";
import { orbitType } from "./orbit.js";
import { terminalType } from "./terminal.js";
import { paintType } from "./paint.js";
// ... 30+ more

const REGISTRY = new Map<WindowKind, WindowTypeModule>();

function register(mod: WindowTypeModule): void {
  REGISTRY.set(mod.kind, mod);
}

// Register all types
register(verseType);
register(orbitType);
register(terminalType);
register(paintType);
// ...

export function getWindowType(kind: WindowKind): WindowTypeModule | undefined {
  return REGISTRY.get(kind);
}

export function getAllWindowTypes(): WindowTypeModule[] {
  return [...REGISTRY.values()];
}

export function getSpawnableTypes(): WindowTypeModule[] {
  return [...REGISTRY.values()]; // scramble excluded from registry
}
```

### 4.4 Simple Type Example (15 lines)

```typescript
// src/window-types/verse.ts
import type { WindowTypeModule } from "./base.js";

interface VerseState { tick: number }

export const verseType: WindowTypeModule<VerseState> = {
  kind: "verse",
  defaultSize: [96, 30],
  chromeMode: "standard",

  createState: () => ({ tick: 0 }),
  buildContent: (body, state, ctx) => ctx.attachAnimatedCanvas(body),

  tick: {
    interval: 120,
    handler: (state, width, height) => {
      state.tick++;
      // Generative verse rendering logic here
      return renderVerse(state.tick, width, height);
    }
  }
};
```

### 4.5 Complex Type Example (paint)

```typescript
// src/window-types/paint.ts
import type { WindowTypeModule } from "./base.js";
import type { PaintCanvasState } from "../services/paint-engine.js";

export const paintType: WindowTypeModule<PaintCanvasState> = {
  kind: "paint",
  defaultSize: [0, 0],  // 0 = use 90% of desktop
  chromeMode: "toolbar",

  createState: (options) => createPaintCanvas(options),
  buildContent: (body, state, ctx) => buildPaintUI(body, state, ctx),

  handleKey: (state, ch, key) => handlePaintKeypress(state, ch, key),

  serializePayload: (state) => ({
    canvasWidth: state.canvas.width,
    canvasHeight: state.canvas.height,
    filePath: state.filePath,
    toolState: state.currentTool
  }),

  restorePayload: (payload) => ({
    params: { path: payload.filePath as string }
  }),

  describeState: (state) => ({
    appType: "paint-canvas",
    summary: `Paint canvas ${state.canvas.width}x${state.canvas.height}`,
    filePath: state.filePath
  }),

  cleanup: (state) => state.undoStack?.clear()
};
```

### 4.6 Unified Spawn in WindowManager

```typescript
// In the rebuilt WindowManager or AppController
function spawnWindow(kind: WindowKind, options: WindowSpawnOptions = {}): WindowRecord {
  const type = getWindowType(kind);
  if (!type) throw new Error(`Unknown window type: ${kind}`);

  const state = type.createState(options);
  const [defaultW, defaultH] = type.defaultSize;
  const frame = windowManager.createFrame(kind, type.chromeMode, {
    width: options.bounds?.w ?? defaultW,
    height: options.bounds?.h ?? defaultH,
    left: options.bounds?.x,
    top: options.bounds?.y
  });

  type.buildContent(frame.body, state, windowContext);

  if (type.tick) {
    const timer = setInterval(
      () => frame.body.setContent(type.tick!.handler(state, bodyWidth(), bodyHeight())),
      type.tick.interval
    );
    frame.cleanup = () => { clearInterval(timer); type.cleanup?.(state); };
  }

  frame.describeState = () => type.describeState?.(state) ?? { appType: kind };
  windowManager.registerWindow(frame);
  return frame;
}
```

This reduces the god class to a ~200-line orchestrator. Adding a new window type requires **one file** and **one register() call**.

---

## 5. Window Lifecycle: Create → Focus → Resize → Close → Serialize → Restore

### 5.1 C++ Lifecycle

```
api_spawn_*()           →  TRect r = bounds or default
                        →  TWindow* w = create*Window(r)
                        →  app.deskTop->insert(w)
                        →  app.registerWindow(w)    // assigns ID, adds to idToWin map

focus                   →  w->select()              // TView z-order

resize                  →  w->changeBounds(newRect)  // TView method

close                   →  TWindow::close()         // TView virtual
                        →  app deregisters from idToWin

serialize (workspace)   →  walk deskTop children
                        →  match_* identifies type slug
                        →  extract bounds + type-specific state

restore                 →  for each saved entry: call spawn with bounds + params
```

### 5.2 TS Spike Lifecycle

```
open*Window()           →  windowManager.createFrame(title, kind)
                           creates blessed box hierarchy (frame > titleBar > body > closeHint > resizeGrip)
                        →  build kind-specific content in body
                        →  set record.cleanup, .describeState, .focus
                        →  windowManager.registerWindow(record)

focus                   →  record.focus()
                        →  windowManager.focusWindow(record)
                           splices to end of windows array (z-order)
                           sets frame border cyan, calls body.focus()

resize                  →  windowManager.resizeWindow(id, width, height)
                           clamps to desktop bounds, min 24×8
                        →  mouse resize via resizeGrip mousedown → mousemove

close                   →  record.close()
                        →  record.cleanup?.()       // kill timers, processes
                        →  frame.destroy()          // remove blessed nodes
                        →  splice from windows array
                        →  focus next window

serialize               →  serializeWindowSnapshot(record)
                        →  { kind, title, left, top, width, height, filePath, focused }
                        →  + buildWindowSnapshotPayload(record)  // kind-specific

restore                 →  restoreWindowSnapshot(snapshot)
                        →  switch(kind) dispatch to open*Window()
                        →  apply saved left/top/width/height
```

### 5.3 Rebuild Lifecycle (proposed)

Same as TS spike but with the factory indirection:

```
spawnWindow(kind, opts)     // single entry point
  → type = registry.get(kind)
  → state = type.createState(opts)
  → frame = createFrame(kind, chromeMode, bounds)
  → type.buildContent(frame.body, state, ctx)
  → register timer if type.tick
  → windowManager.registerWindow(frame)

serialize:
  → snapshot.payload = type.serializePayload(state)

restore:
  → opts = type.restorePayload(snapshot.payload)
  → spawnWindow(kind, opts)  // same entry point, no switch statement
```

---

## 6. Chrome Modes Per Type

### 6.1 C++ Chrome Modes

The C++ app has implicit chrome modes controlled per-type at spawn time:

| Mode | Visual | Types |
|------|--------|-------|
| **Standard** | Line border + title bar + shadow | Most types (verse, orbit, editor, browser, terminal, etc.) |
| **Frameless** | No border, no title, optional shadow removal | `frame_player` (with `frameless=true`), `figlet_text` (with `frameless=true`) |
| **FIGlet** | Standard border but auto-sized to rendered text content | `figlet_text` (default) |
| **Minimal** | Standard border, small fixed size | `scramble` (overlay, not a real window — managed separately) |
| **Near-fullscreen** | 90% of desktop | `paint` |

The `frameless` and `shadowless` flags are per-instance, not per-type — a `frame_player` can be either standard or frameless depending on spawn params.

### 6.2 TS Spike Chrome Modes

Defined in `spikes/ts-tui-mvp/src/core/window-chrome.ts`:

```typescript
export type ChromeMode = "standard" | "toolbar" | "frameless";

const CHROME_BY_KIND: Partial<Record<WindowKind, ChromeMode>> = {
  figlet: "toolbar"  // only figlet overrides; everything else is "standard"
};

const CHROME_PADDING: Record<ChromeMode, WindowSize> = {
  standard:  { width: 2, height: 2 },   // border
  toolbar:   { width: 4, height: 5 },   // border + toolbar + extra padding
  frameless: { width: 0, height: 0 }
};
```

### 6.3 Proposed Chrome Modes for Rebuild

Extend to cover all C++ patterns:

```typescript
export type ChromeMode = "standard" | "toolbar" | "frameless" | "fullscreen" | "overlay";

export interface ChromeConfig {
  mode: ChromeMode;
  shadow: boolean;      // default true
  resizable: boolean;   // default true
  closable: boolean;    // default true
  titleBar: boolean;    // default true
}

const CHROME_DEFAULTS: Record<string, Partial<ChromeConfig>> = {
  paint:        { mode: "toolbar", shadow: true },
  figlet_text:  { mode: "toolbar", shadow: true },
  frame_player: { mode: "standard", shadow: true },  // can be overridden to frameless
  scramble:     { mode: "overlay", shadow: false, resizable: false, closable: false, titleBar: false },
};
```

---

## 7. TS Spike WindowKinds → C++ Type Mapping

The TS spike defines **17 WindowKinds** in `spikes/ts-tui-mvp/src/core/types.ts` (line 7). Here's how they map to the **35 C++ entries**:

| TS WindowKind | C++ Type(s) Covered | Notes |
|---------------|---------------------|-------|
| `"primer"` | `frame_player`, `text_view` | TS conflates animated primers and static text viewers into one kind |
| `"editor"` | `text_editor` | 1:1 |
| `"terminal"` | `terminal` | 1:1 |
| `"backrooms"` | `backrooms_tv` | 1:1 |
| `"browser"` | `browser`, primer picker (backrooms) | Overloaded — browser kind used for both file browser and primer picker |
| `"art"` | `verse`, `mycelium`, `torus`, `cube`, `monster_cam`, `monster_verse`, `monster_portal`, `animated_gradient`, `blocks`, `score`, `ascii`, `life` | **12 C++ types → 1 TS kind** — the biggest mapping gap |
| `"gallery"` | `gallery` | 1:1 |
| `"reader"` | `text_view` (browser mode) | Maps to same C++ type as primer but via different code path |
| `"figlet"` | `figlet_text` | 1:1 |
| `"pattern"` | `test_pattern`, `gradient` | 2 C++ types → 1 TS kind |
| `"orbit"` | `orbit` | 1:1 (extracted from art for the spike) |
| `"glitch"` | *(no C++ equivalent)* | TS-only, simple animated effect |
| `"chat"` | `wibwob` | 1:1 |
| `"companion"` | `scramble` | 1:1 (but scramble is overlay in C++, window in TS) |
| `"workspace"` | *(no C++ equivalent)* | TS-only workspace manager UI |
| `"palette"` | *(no C++ equivalent)* | TS-only command palette |
| `"inspector"` | *(no C++ equivalent)* | TS-only state debugger |

### 7.1 Coverage Gaps

**C++ types with no TS equivalent (14 types):**

| C++ Type | Category | Rebuild Priority |
|----------|----------|-----------------|
| `paint` | Complex interactive | High — flagship feature |
| `micropolis_ascii` | Complex game | Medium |
| `room_chat` | Complex networking | Medium |
| `quadra` | Game | Low |
| `snake` | Game | Low |
| `rogue` | Game | Low |
| `deep_signal` | Game | Low |
| `contour_map` | Generative art | Low |
| `generative_lab` | Generative art | Low |
| `app_launcher` | Browser | Medium |
| `mycelium` | Generative art | Low |
| `torus` | Generative art | Low |
| `cube` | Generative art | Low |
| `monster_portal` | Generative art | Low |

### 7.2 Proposed Expanded WindowKind for Rebuild

```typescript
export type WindowKind =
  // Content viewers
  | "primer"          // frame_player, animated primer viewer
  | "text_view"       // static text viewer
  | "reader"          // browser-reader (markdown/prose)

  // Editors & tools
  | "editor"          // text_editor
  | "paint"           // paint canvas
  | "figlet"          // figlet text banner

  // Interactive apps
  | "terminal"        // PTY terminal
  | "browser"         // file browser
  | "gallery"         // tabbed gallery browser
  | "app_launcher"    // applications folder browser

  // Communication
  | "chat"            // wibwob chat (LLM)
  | "room_chat"       // multiplayer room chat
  | "companion"       // scramble companion overlay

  // Streaming
  | "backrooms"       // backrooms TV

  // Generative art (one kind per C++ type)
  | "verse" | "mycelium" | "orbit" | "torus" | "cube"
  | "life" | "blocks" | "score" | "ascii"
  | "animated_gradient" | "gradient"
  | "monster_cam" | "monster_verse" | "monster_portal"
  | "contour_map" | "generative_lab"
  | "test_pattern"

  // Games
  | "micropolis" | "quadra" | "snake" | "rogue" | "deep_signal"

  // System
  | "workspace" | "palette" | "inspector";
```

This gives a 1:1 mapping with C++ types while preserving the TS-only additions.

---

## 8. Concrete Interface Proposals for the TS Rebuild

### 8.1 Core Types

```typescript
// core/types.ts — replace the flat WindowRecord

export interface WindowFrame {
  id: number;
  kind: WindowKind;
  title: string;
  bounds: { left: number; top: number; width: number; height: number };
  focused: boolean;
  chrome: ChromeConfig;
}

export interface WindowHandle<TState = unknown> {
  frame: WindowFrame;
  state: TState;
  type: WindowTypeModule<TState>;

  focus(): void;
  close(): void;
  resize(width: number, height: number): void;
  move(left: number, top: number): void;
  serialize(): WindowSnapshot;
}
```

### 8.2 WindowTypeModule (complete)

```typescript
export interface WindowContext {
  screen: Screen;
  desktop: Box;
  spawnWindow: (kind: WindowKind, options?: WindowSpawnOptions) => WindowHandle;
  flash: (message: string) => void;
  prompt: (label: string, defaultValue: string) => Promise<string>;
  syncState: () => void;
}

export interface WindowTypeModule<TState = unknown> {
  readonly kind: WindowKind;
  readonly label: string;                    // human-readable, e.g. "Verse Field"
  readonly defaultSize: [number, number];    // [width, height], 0 = auto
  readonly chromeMode: ChromeMode;
  readonly spawnable: boolean;               // false for scramble

  createState(options: WindowSpawnOptions): TState;
  buildContent(body: Box, state: TState, ctx: WindowContext): void;

  // Optional capabilities
  tick?: { interval: number; handler: (state: TState, w: number, h: number) => string };
  handleKey?: (state: TState, ch: string, key: KeyEvent) => void;
  handleMouse?: (state: TState, data: MouseEvent) => void;

  // Serialization
  serializePayload?(state: TState): Record<string, unknown> | undefined;
  restorePayload?(payload: Record<string, unknown>): Partial<WindowSpawnOptions>;

  // Introspection
  describeState?(state: TState): WindowStateDetails;

  // Lifecycle
  onFocus?(state: TState): void;
  onBlur?(state: TState): void;
  onResize?(state: TState, width: number, height: number): void;
  cleanup?(state: TState): void;
}
```

### 8.3 Registry Service

```typescript
export class WindowTypeRegistry {
  private readonly types = new Map<WindowKind, WindowTypeModule>();

  register(mod: WindowTypeModule): void {
    if (this.types.has(mod.kind)) {
      throw new Error(`Duplicate window type: ${mod.kind}`);
    }
    this.types.set(mod.kind, mod);
  }

  get(kind: WindowKind): WindowTypeModule {
    const type = this.types.get(kind);
    if (!type) throw new Error(`Unknown window type: ${kind}`);
    return type;
  }

  getAll(): WindowTypeModule[] {
    return [...this.types.values()];
  }

  getSpawnable(): WindowTypeModule[] {
    return this.getAll().filter(t => t.spawnable);
  }

  /** JSON manifest matching C++ get_window_types_json() */
  toJSON(): { window_types: Array<{ type: string; spawnable: boolean }> } {
    return {
      window_types: this.getAll().map(t => ({
        type: t.kind,
        spawnable: t.spawnable
      }))
    };
  }
}
```

### 8.4 Command Registry (matching C++ exec_registry_command)

The C++ `command_registry.cpp` has **80+ commands** beyond window spawning (paint_cell, terminal_write, snap_window, etc.). These should be a separate registry:

```typescript
export interface CommandSpec {
  name: string;
  description: string;
  requiresParams: boolean;
  execute: (params: Record<string, string>, ctx: AppContext) => string | Promise<string>;
}

export class CommandRegistry {
  private readonly commands = new Map<string, CommandSpec>();

  register(spec: CommandSpec): void {
    this.commands.set(spec.name, spec);
  }

  execute(name: string, params: Record<string, string>, ctx: AppContext): string | Promise<string> {
    const spec = this.commands.get(name);
    if (!spec) return `err unknown command`;
    return spec.execute(params, ctx);
  }

  /** JSON manifest matching C++ get_command_capabilities_json() */
  toJSON(): object {
    return {
      version: "v1",
      commands: [...this.commands.values()].map(c => ({
        name: c.name,
        description: c.description,
        requires_path: c.requiresParams
      }))
    };
  }
}
```

### 8.5 Migration Path

1. **Phase 1:** Extract the 20 simple animated types into `WindowTypeModule` files. Each is <30 lines.
2. **Phase 2:** Extract content viewers (primer, text_view, reader). These share the `openTextViewerWindow()` pattern.
3. **Phase 3:** Extract complex interactive types (editor, terminal, chat) one at a time.
4. **Phase 4:** Port paint, backrooms, micropolis — each is a multi-file subsystem.
5. **Phase 5:** Build the command registry, porting commands from `command_registry.cpp`.

At each phase, the god class shrinks and the `switch` in `restoreWindowSnapshot()` disappears — replaced by `type.restorePayload()`.

---

## Appendix: Key File References

| File | Lines | Role |
|------|-------|------|
| `app/window_type_registry.h` | 29 | `WindowTypeSpec` struct, `WinSpawnFn`/`WinMatchFn` typedefs |
| `app/window_type_registry.cpp` | 280 | 35-entry `k_specs[]` table, spawn wrappers, match functions |
| `app/wwdos_app.cpp` | 5,609 | God class: all `api_spawn_*` functions (lines 2931–5420) |
| `app/command_registry.cpp` | 530 | 80+ IPC commands, `exec_registry_command()` dispatcher |
| `spikes/ts-tui-mvp/src/core/types.ts` | 166 | `WindowKind` (17 values), `WindowRecord`, `WindowSnapshot`, `DesktopState` |
| `spikes/ts-tui-mvp/src/core/window-manager.ts` | 295 | `WindowManager`: create frame, focus, drag, resize, tile/cascade |
| `spikes/ts-tui-mvp/src/core/app-controller.ts` | 2,514 | `TsTuiMvpApp`: all `open*Window()` factory methods, workspace save/restore |
| `spikes/ts-tui-mvp/src/core/window-chrome.ts` | 34 | `ChromeMode`, padding constants, `getChromeModeForWindow()` |
