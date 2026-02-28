# PRD: WibWob-DOS TypeScript Port

> Port WibWob-DOS from C++14/Turbo Vision to TypeScript using @farjs/blessed
> as the TUI framework, with the Rust Turbo Vision port as architectural reference.

## 1. Problem statement

WibWob-DOS is a ~2,600 LOC C++14 TUI application built on Turbo Vision
(magiblot/tvision fork). The C++ toolchain creates friction:

- **30-60s rebuild cycles** for any C++ change (cmake + compile + link)
- **Submodule dependency hell** — tvision, tvterm, MicropolisCore require
  recursive init; private modules fail in CI environments
- **Three-runtime architecture** — C++ TUI + Python API server + Node.js SDK
  bridge, connected via Unix socket IPC. Each runtime has its own package
  manager, dependency chain, and failure modes
- **Contributor barrier** — requires CMake, ncurses-dev, C++14 toolchain,
  knowledge of Turbo Vision's 1990s API patterns
- **No hot-reload** — every edit requires full rebuild and TUI restart
- **Sprites hosting target (E015)** — the browser-based multi-user future
  requires xterm.js, which is native JavaScript

A TypeScript port collapses all three runtimes into one Node.js process,
enables sub-second hot-reload, and positions WibWob-DOS for web deployment.

## 2. Goals and non-goals

### Goals

- Port all 82 commands, 42 view types, and 14 window types to TypeScript
- Preserve the overlapping-window, z-ordered desktop OS experience
- Maintain the command registry pattern (one list, many callers)
- Keep the two-tool MCP interface (tui_list_commands + tui_menu_command)
- Achieve visual parity with the C++ version (same menus, same layout, same
  generative art output)
- Single Node.js process replaces C++ app + Python API + Node SDK bridge
- Sub-second hot-reload during development
- Enable future browser deployment via xterm.js

### Non-goals

- Pixel-perfect frame-by-frame rendering parity with C++ (minor differences acceptable)
- Porting the Micropolis city builder engine (vendor C++ library — defer or use WASM)
- Supporting ncurses directly (blessed handles terminal abstraction)
- Rewriting the Python test suite (keep tests, point them at the new server)

## 3. Architecture

### Current (C++ + Python + Node.js)

```
Human / Agent
  ├── REST API ──→ Python FastAPI (port 8089)
  │                  └── Unix socket ──→ C++ TUI (Turbo Vision)
  └── MCP tools ──→ Node.js SDK Bridge
                      └── REST API ──→ Python FastAPI
```

Three processes, two IPC layers, three package managers.

### Target (TypeScript, single process)

```
Human / Agent
  ├── REST API ──→ Express/Fastify server (port 8089)
  │                  └── direct function call ──→ TUI engine
  ├── MCP tools ──→ SDK Bridge (same process)
  │                  └── direct function call ──→ TUI engine
  └── WebSocket ──→ Event stream (same process)
```

One process. Zero IPC. Same API surface.

### Module structure

```
wibwob-ts/
├── src/
│   ├── app.ts                    # Application entry point
│   ├── engine/
│   │   ├── desktop.ts            # TWwdosApp equivalent — screen, desktop, menus
│   │   ├── window-manager.ts     # Z-order, focus, raise/lower/close
│   │   ├── view.ts               # Base WwView class (TView equivalent)
│   │   ├── window.ts             # Base WwWindow class (TWindow equivalent)
│   │   ├── frame.ts              # Frame types (standard, ghost, no-title)
│   │   ├── events.ts             # Event types (discriminated unions)
│   │   ├── timer.ts              # Animation timer system
│   │   ├── screen-cell.ts        # Cell model (glyph + fg + bg)
│   │   └── theme.ts              # Color palettes, theme modes
│   ├── registry/
│   │   ├── command-registry.ts   # All 82 commands, single source of truth
│   │   └── window-type-registry.ts
│   ├── views/
│   │   ├── generative/           # Verse, Orbit, Mycelium, Torus, Cube, etc.
│   │   ├── games/                # Quadra, Snake, Rogue, DeepSignal
│   │   ├── paint/                # Canvas, palette, tools, wwp codec
│   │   ├── chat/                 # WibWob chat, Scramble, Room chat
│   │   ├── figlet/               # FIGlet text view + font catalogue
│   │   ├── gallery/              # Gallery browser, primer viewer
│   │   └── utility/              # Text editor, browser, terminal, ANSI viewer
│   ├── api/
│   │   ├── server.ts             # Express/Fastify REST API (replaces Python)
│   │   ├── mcp.ts                # MCP tool server (replaces Node SDK bridge)
│   │   └── websocket.ts          # Event stream
│   └── llm/
│       ├── auth.ts               # AuthConfig (Claude Code / API Key / NoAuth)
│       ├── provider.ts           # ILLMProvider interface
│       └── claude-sdk.ts         # Claude SDK integration (direct, no bridge)
├── modules/                      # Content packs (primers, fonts)
├── tests/
│   ├── contract/                 # Parity tests (reuse existing Python tests)
│   └── unit/                     # TypeScript unit tests (vitest)
├── package.json
└── tsconfig.json
```

## 4. Framework choice: @farjs/blessed

### Why blessed (not Ink, not OpenTUI, not Rezi)

WibWob-DOS is a **desktop window manager**, not a CLI tool. It requires:

1. **Overlapping windows with z-order** — blessed renders via painter's
   algorithm with absolute positioning. Child array order = z-order.
   This is the same model as Turbo Vision.

2. **Per-cell rendering** — blessed's Screen has a damage buffer and writes
   only changed cells. Elements can set individual cell content and attributes.

3. **Mouse support** — click, drag, scroll, right-click. blessed handles this
   natively including element hit-testing.

4. **Absolute positioning** — `left: 10, top: 5, width: 40, height: 20`.
   No flexbox, no layout engine fighting the window manager.

Ink uses Flexbox (wrong paradigm — no overlapping windows).
Rezi is pre-alpha.
OpenTUI's overlapping window support is unclear.

### Why @farjs/blessed specifically

| Fork | Version | Last release | Status |
|------|---------|-------------|--------|
| blessed (chjj) | 0.1.81 | 10+ years ago | Dead |
| neo-blessed | — | 5 years ago | Dead |
| @farjs/blessed | 0.4.0 | Feb 2025 | Active, 13 releases |
| @unblessed/blessed | alpha | Active | Full TS rewrite, too early |
| bbblessed | — | Active | Bun.js fork, niche |

[@farjs/blessed](https://www.npmjs.com/package/@farjs/blessed) is used by
[FAR.js](https://github.com/nickel-org/nickel.rs) — a production file manager
— proving it works for complex TUI applications with panels, dialogs, and
keyboard navigation. Zero runtime dependencies. Ships its own `index.d.ts`
(delegates to `@types/blessed` for core types, adds `unicode` utility).

The fork's 13 releases focus on: Unicode/wide-character handling fixes (wcwidth,
surrogate pairs), Windows compatibility (Ctrl+Fx keys), TypeScript 5.7
maintenance, and bug fixes. The core blessed API surface is unchanged from the
original — all documentation and community knowledge applies.

**Key blessed APIs and their TV equivalents:**

| Turbo Vision | blessed | Notes |
|---|---|---|
| `TApplication` | `blessed.screen({smartCSR: true})` | Top-level container, event loop |
| `TDeskTop` | `blessed.box({parent: screen})` | Desktop background |
| `TWindow` | `blessed.box({border: 'line', draggable: true, shadow: true, label: 'Title'})` | Framed, movable window |
| `TView.draw()` | `element.render()` writes into `screen.lines` | Per-cell rendering (painter's algorithm) |
| `TView.handleEvent()` | `element.on('keypress')`, `element.on('click')` | Event handlers |
| `TView.setState(sfShadow)` | `element.shadow = true/false` | Runtime toggle |
| `TView.setState(sfVisible)` | `element.show()` / `element.hide()` | Visibility toggle |
| `TView.options.ofSelectable` | `{input: true, keys: true}` | Focusable element |
| `deskTop->insert(w)` | `screen.append(element)` | Add to z-order |
| `w->select()` | `element.setFront(); element.focus()` | Raise + focus |
| `w->putInFrontOf(bg)` | `element.setBack()` | Send to back |
| `w->makeFirst()` | `element.setFront()` | Z-order: children array reorder |
| `TView::setIndex(z)` | `element.setIndex(z)` | Explicit z position |
| `writeLine(x,y,w,1,cells)` | `screen.lines[y][x] = [attr, ch]` | Per-cell write |
| `TDrawBuffer` / `TScreenCell` | `screen.lines` — each cell is `[attr, ch]` | Raw screen buffer |
| `TDrawBuffer::moveChar()` | `screen.fillRegion(attr, ch, x1, x2, y1, y2)` | Fill region |
| `TTimerId` / `setTimer()` | `setInterval(fn, 50)` | Animation timer |
| `TFrame` | `border: {type: 'line'}` | Standard frame |
| `TGhostFrame` | `border: false` (no border) | Frameless window |
| `TGroup::forEach()` | `parent.children.forEach()` | Iterate child views |
| `cmCommand` dispatch | `screen.emit('command', {name, args})` | Custom events |

**Cell format (critical detail):** Each cell in `screen.lines[y][x]` is a
two-element array `[attr, ch]` where `attr` is a 27-bit packed integer:

```
Bits  0-8:  background color (0-255, or 0x1ff = default)
Bits  9-17: foreground color (0-255, or 0x1ff = default)
Bits 18-26: flags (bold=1, underline=2, blink=4, inverse=8, invisible=16)
```

Built with `Element.prototype.sattr(style, fg, bg)`. This is the equivalent
of Turbo Vision's `TColorAttr` packed encoding. Each row has a `.dirty`
boolean — the draw pass only diffs dirty rows against `screen.olines`.

**Rendering cycle:** `screen.render()` → iterate `children` in order (index 0 =
back, last index = front), each child writes into `screen.lines` → `screen.draw()`
diffs `lines` vs `olines` cell-by-cell → only changed cells written to terminal
via smart cursor movement (`cuf`/`cup`). This is the painter's algorithm with
damage tracking — the exact same model as Turbo Vision.

**Color support:** 16 named colors + 256-color indices + hex `'#rrggbb'`
(mapped to nearest 256-color via weighted Euclidean distance, cached). No true
24-bit SGR output. Hex colors are approximated. `style.transparent = true`
blends at 50% opacity via `colors.blend()`.

### Architectural reference: turbo-vision-4-rust

The [Rust Turbo Vision port](https://github.com/aovestdipaperino/turbo-vision-4-rust)
(v1.0.2, 28k LOC, 226 tests) provides a cleaner architectural reference than
the C++ original because Rust's ownership model forced explicit design decisions:

- **View trait** → TypeScript `interface WwView` (draw, handleEvent, changeBounds)
- **Event enum** → TypeScript discriminated union `type WwEvent = KeyEvent | MouseEvent | CommandEvent | TimerEvent`
- **Group composition** → TypeScript class composition (Window contains Frame + ContentView)
- **Three-phase event processing** (PreProcess → Focused → PostProcess) → method chain

Read the Rust code as a spec. Write TypeScript.

**Reference links:**
- Crate: https://crates.io/crates/turbo-vision
- GitHub: https://github.com/aovestdipaperino/turbo-vision-4-rust
- Docs: https://docs.rs/turbo-vision/latest/turbo_vision/
- Architecture article: https://medium.com/rustaceans/turbo-vision-for-rust-1-0-06c253faac64

## 5. View port inventory

### Phase 1: Core engine (weeks 1-3)

The minimum to get a working desktop with windows.

| Component | C++ source | TS target | Effort |
|---|---|---|---|
| Application shell | `wwdos_app.cpp` (main, menus, status) | `engine/desktop.ts` | Large |
| Window manager | `wwdos_app.cpp` (insert/remove/z-order) | `engine/window-manager.ts` | Medium |
| Base view | `TView` (Turbo Vision) | `engine/view.ts` | Medium |
| Base window | `TWindow` (Turbo Vision) | `engine/window.ts` | Medium |
| Frame types | `TFrame`, `TGhostFrame`, `TNoTitleFrame` | `engine/frame.ts` | Small |
| Event system | `TEvent`, handleEvent chain | `engine/events.ts` | Medium |
| Timer system | `setTimer`, evBroadcast | `engine/timer.ts` | Small |
| Screen cell | `TScreenCell`, `TColorAttr` | `engine/screen-cell.ts` | Small |
| Theme | mapColor, palettes | `engine/theme.ts` | Small |
| Command registry | `command_registry.cpp` | `registry/command-registry.ts` | Medium |
| Window type registry | `window_type_registry.cpp` | `registry/window-type-registry.ts` | Small |
| Desktop background | `TWibWobBackground` | `engine/desktop.ts` (inner) | Small |
| API server | `tools/api_server/main.py` (60+ routes) | `api/server.ts` | Large |
| MCP tools | `app/llm/sdk_bridge/mcp_tools.js` | `api/mcp.ts` | Small |

### Phase 2: Creative views (weeks 3-6)

The views that make WibWob-DOS feel like WibWob-DOS.

| View family | Count | C++ source | Effort |
|---|---|---|---|
| Generative art | 8 views | `generative_*.cpp` | Large (math-heavy) |
| FIGlet text | 2 (view + window) | `figlet_text_view.cpp` | Medium |
| Paint canvas | 5 (canvas, palette, tools, status, window) | `paint/*.cpp` | Large |
| Gallery browser | 4 (tab bar, file list, preview, window) | `ascii_gallery_view.cpp` | Medium |
| Primer viewer | 2 (file player, animation window) | `frame_file_player_view.cpp`, `frame_animation_window.cpp` | Medium |
| Text editor | 2 (view + window) | `text_editor_view.cpp` | Medium |
| Static displays | 6 (blocks, gradient, score, ascii, grid, gradient variants) | Various | Small each |

### Phase 3: Chat and games (weeks 6-9)

| View family | Count | C++ source | Effort |
|---|---|---|---|
| Wib&Wob chat | 3 (messages, input, window) | `wibwob_view.cpp` | Large (LLM integration) |
| Scramble cat | 4 (cat, messages, input, window) | `scramble_view.cpp` | Medium |
| Room chat | 3 (messages, strip, window) | `room_chat_view.cpp` | Medium |
| Games | 5 (Quadra, Snake, Rogue, DeepSignal, Micropolis) | Various | Large |
| Terminal | 1 | `tvterm_view.cpp` | Medium (node-pty) |
| Browser | 2 (content, window) | `browser_view.cpp` | Medium |
| App launcher | 3 (grid, category bar, window) | `app_launcher_view.cpp` | Small |

### Phase 4: Polish and parity (weeks 9-12)

- Workspace save/load
- Screenshot capture
- Right-click context menus
- Desktop presets
- Parity tests passing
- Performance profiling

## 6. Core abstractions

### WwView (base class for all views)

```typescript
// engine/view.ts
import blessed from '@farjs/blessed';

export interface WwViewOptions {
  bounds: { x: number; y: number; w: number; h: number };
  parent?: WwView;
}

export abstract class WwView {
  readonly element: blessed.Widgets.BoxElement;
  protected timers: NodeJS.Timeout[] = [];

  constructor(options: WwViewOptions) {
    this.element = blessed.box({
      left: options.bounds.x,
      top: options.bounds.y,
      width: options.bounds.w,
      height: options.bounds.h,
    });
    this.element.on('keypress', (ch, key) => this.onKey(ch, key));
    this.element.on('click', (data) => this.onClick(data));
  }

  /** Override to render content. Called on every repaint. */
  abstract draw(): void;

  /** Override to handle keyboard input. */
  onKey(ch: string, key: blessed.Widgets.Events.IKeyEventArg): void {}

  /** Override to handle mouse clicks. */
  onClick(data: blessed.Widgets.Events.IMouseEventArg): void {}

  /** Start a repeating timer (for animation). */
  protected startTimer(periodMs: number, callback: () => void): void {
    this.timers.push(setInterval(() => {
      callback();
      this.element.screen.render();
    }, periodMs));
  }

  /** Clean up timers on destroy. */
  destroy(): void {
    this.timers.forEach(clearInterval);
    this.element.destroy();
  }

  /** Reposition and resize. */
  locate(bounds: { x: number; y: number; w: number; h: number }): void {
    this.element.left = bounds.x;
    this.element.top = bounds.y;
    this.element.width = bounds.w;
    this.element.height = bounds.h;
    this.draw();
  }
}
```

### Screen cell helpers

```typescript
// engine/screen-cell.ts

/** Pack fg, bg, and style flags into blessed's 27-bit attr integer. */
export function sattr(
  fg: number,                // 0-255 color index (0x1ff = default)
  bg: number,                // 0-255 color index (0x1ff = default)
  flags: { bold?: boolean; underline?: boolean; blink?: boolean;
           inverse?: boolean; invisible?: boolean } = {}
): number {
  return ((flags.invisible ? 16 : 0) << 18)
    | ((flags.inverse ? 8 : 0) << 18)
    | ((flags.blink ? 4 : 0) << 18)
    | ((flags.underline ? 2 : 0) << 18)
    | ((flags.bold ? 1 : 0) << 18)
    | ((fg & 0x1ff) << 9)
    | (bg & 0x1ff);
}

/** Write a single cell to the screen buffer. */
export function writeCell(
  screen: blessed.Widgets.Screen,
  x: number, y: number,
  ch: string, attr: number
): void {
  const line = (screen as any).lines[y];
  if (line && line[x]) {
    line[x][0] = attr;
    line[x][1] = ch;
    line.dirty = true;
  }
}
```

### WwWindow (framed, movable window wrapping a view)

```typescript
// engine/window.ts
export class WwWindow extends WwView {
  readonly id: string;
  private contentView: WwView;
  private frameType: 'standard' | 'ghost' | 'no-title';

  constructor(options: WwWindowOptions) {
    super({
      ...options,
      // blessed box with border = window frame
    });
    this.element.draggable = true;
    this.element.border = options.frameless ? undefined : { type: 'line' };
    this.element.shadow = !options.shadowless;
    this.id = WindowManager.allocateId();
  }

  draw(): void {
    this.contentView?.draw();
  }

  /** Raise to front of z-order and focus. */
  raise(): void {
    this.element.setFront();
    this.element.focus();
  }

  /** Send to back of z-order (above desktop background). */
  lower(): void {
    this.element.setBack();
  }

  /** Toggle shadow at runtime. */
  setShadow(on: boolean): void {
    this.element.shadow = on;
    this.element.screen.render();
  }

  /** Toggle frame at runtime. */
  setFrameless(frameless: boolean): void {
    this.element.border = frameless ? undefined : { type: 'line' };
    this.element.screen.render();
  }
}
```

### Event system (discriminated unions)

```typescript
// engine/events.ts
export type WwEvent =
  | { kind: 'key'; ch: string; key: string; shift: boolean; ctrl: boolean }
  | { kind: 'mouse'; x: number; y: number; button: 'left' | 'right' | 'middle'; action: 'click' | 'drag' | 'scroll' }
  | { kind: 'command'; name: string; args: Record<string, string> }
  | { kind: 'timer'; timerId: number; elapsed: number }
  | { kind: 'resize'; width: number; height: number };
```

### Mouse and keyboard event handling

Blessed provides full mouse event support with automatic element hit-testing:

```typescript
// Screen-level key binding (global shortcuts)
screen.key(['escape', 'C-s', 'M-x', 'f12'], (ch, key) => { /* ... */ });

// Element-level events
element.on('click', (mouse) => {
  // mouse: { x, y, button: 'left'|'middle'|'right', action: 'click' }
});
element.on('mousedown', handler);
element.on('mouseup', handler);
element.on('mousemove', handler);
element.on('mouseover', handler);  // hover enter
element.on('mouseout', handler);   // hover leave
element.on('wheelup', handler);    // scroll
element.on('wheeldown', handler);

// Dragging is built-in
element.draggable = true;

// Focus management
screen.focused;           // Current focus
screen.focusNext();       // Tab cycling
screen.focusPrevious();   // Shift-tab
```

Events bubble up the element tree. Parent elements can intercept child events:
```typescript
parent.on('element click', (el, mouse) => {
  return false;  // Stops propagation
});
```

### Generative view pattern (example: Verse Field)

```typescript
// views/generative/verse-view.ts
export class VerseView extends WwView {
  private frame = 0;
  private palette: RGB[][] = buildVersePalettes();

  constructor(options: WwViewOptions) {
    super(options);
    this.startTimer(50, () => this.advance());  // 20 Hz
  }

  private advance(): void {
    this.frame++;
    this.draw();
  }

  draw(): void {
    const W = (this.element.width as number) - 2;  // minus borders
    const H = (this.element.height as number) - 2;
    const t = this.frame * 0.05;
    const lines = this.element.screen.lines;
    const baseY = (this.element.atop as number) + 1;
    const baseX = (this.element.aleft as number) + 1;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = (x - W / 2) / W * 2;
        const v = (y - H / 2) / H * 2;
        const f = 0.55 + 0.45 * Math.sin((u * 3.1 + Math.sin(v * 2.3 + t)) * 1.2 + t);
        const rgb = paletteSample(this.palette, f);
        const ch = shadeFor(f);

        // Direct cell write — blessed screen buffer
        // Cell format: [attr, ch] where attr is 27-bit packed integer
        const line = lines[baseY + y];
        if (line && line[baseX + x]) {
          line[baseX + x][0] = sattr(rgb, {r:0, g:0, b:0});  // packed attr (fg|bg|flags)
          line[baseX + x][1] = ch;                            // character
          line[baseY + y].dirty = true;                       // mark row dirty
        }
      }
    }
  }
}
```

### Command registry (TypeScript port)

```typescript
// registry/command-registry.ts
interface CommandCapability {
  name: string;
  description: string;
  params?: string[];  // parameter names
}

const COMMANDS: CommandCapability[] = [
  { name: 'cascade', description: 'Cascade all windows on desktop' },
  { name: 'tile', description: 'Tile all windows on desktop' },
  { name: 'open_verse', description: 'Open Verse Field generative poetry window' },
  { name: 'open_figlet_text', description: 'Open FIGlet text window',
    params: ['text', 'font', 'x', 'y', 'shadow'] },
  // ... all 82 commands
];

export function execCommand(
  app: WwDesktop,
  name: string,
  args: Record<string, string>
): string {
  switch (name) {
    case 'cascade': app.cascade(); return 'ok';
    case 'open_verse': app.spawnVerse(parseBounds(args)); return 'ok';
    // ...
  }
}

export function getCapabilitiesJson(): string {
  return JSON.stringify({ commands: COMMANDS, count: COMMANDS.length });
}
```

## 7. API server consolidation

The Python FastAPI server (60+ routes) becomes an Express/Fastify server
in the same Node.js process. No IPC — direct function calls.

```typescript
// api/server.ts
import Fastify from 'fastify';

export function createApiServer(app: WwDesktop) {
  const server = Fastify();

  // Universal command dispatch (replaces POST /menu/command)
  server.post('/menu/command', async (req) => {
    const { command, args } = req.body as { command: string; args?: Record<string, string> };
    const result = execCommand(app, command, args ?? {});
    return { command, ok: true, actor: 'api', result };
  });

  // State inspection (replaces GET /state)
  server.get('/state', async () => app.getState());

  // Command discovery (replaces GET /commands)
  server.get('/commands', async () => JSON.parse(getCapabilitiesJson()));

  // Health check
  server.get('/health', async () => ({ ok: true }));

  // Screenshot
  server.post('/screenshot', async () => app.takeScreenshot());

  // ... remaining routes translate directly

  return server;
}
```

The MCP server becomes a direct import instead of a separate Node.js process:

```typescript
// api/mcp.ts — same two-tool pattern, no HTTP intermediary
export function createMcpServer(app: WwDesktop) {
  return {
    tools: [
      {
        name: 'tui_list_commands',
        handler: () => getCapabilitiesJson()
      },
      {
        name: 'tui_menu_command',
        handler: ({ command, args }) => execCommand(app, command, args)
      }
    ]
  };
}
```

## 8. Performance strategy

### The problem

Generative art views compute O(W*H) sine+noise per cell per frame at 20Hz.
JavaScript is 3-10x slower than C++ for tight math loops.

### Blessed's built-in optimizations

Blessed already handles rendering efficiently:

1. **Dual-buffer diffing** — `screen.lines` vs `screen.olines`, only changed cells output
2. **Per-row dirty flags** — `screen.lines[y].dirty`, unchanged rows skipped entirely
3. **Smart cursor movement** — `cuf` for same-row jumps, `cup` for cross-row, minimizes escape sequences
4. **CSR** — `smartCSR`/`fastCSR` for efficient scrolling without redrawing
5. **Color cache** — hex-to-256-color conversions memoized by RGB hash

The render cycle scales as O(children * area) for the paint phase, then O(rows * cols)
for the diff pass. For a 200x50 terminal (10,000 cells), the diff pass is fast — the
bottleneck is terminal I/O bandwidth, not internal rendering. The library was used to
build the `slap` text editor and `blessed-contrib` dashboards with smooth rendering.

### Mitigation tiers

**Tier 1: Acceptable degradation (try first)**
- Run generative art at 10-15 Hz instead of 20 Hz
- Most views are 40-60 columns wide — the computation budget is small
- Profile before optimising: Node.js V8 JIT is fast for numeric code

**Tier 2: Typed arrays + manual optimisation**
- Pre-allocate `Float32Array` for the field buffer
- Avoid object allocation in the inner loop
- Use lookup tables for sine/palette instead of computing per-pixel

**Tier 3: WASM for hot loops (if needed)**
- Compile the noise/sine/palette kernel to WASM (from Rust or C)
- ~50 lines of math code, not the entire view system
- Call from TypeScript: `const cells = wasmVerseKernel(W, H, frame)`
- This gives C++ performance for the inner loop while keeping the view system in TS

**Tier 4: Web Workers (browser only)**
- Offload generative computation to a worker thread
- Main thread handles events and compositing

### Target performance

| Metric | C++ today | TS target | Acceptable? |
|---|---|---|---|
| Generative art FPS | 20 Hz | 10-15 Hz | Yes (visually smooth) |
| Window open latency | <50ms | <100ms | Yes |
| IPC round-trip | ~5ms (socket) | ~0ms (direct call) | Better |
| Startup time | ~200ms (compiled binary) | ~500ms (Node.js startup) | Acceptable |
| Memory (10 windows) | ~15 MB | ~50 MB | Acceptable (Node.js overhead) |

## 9. Migration path

### Phase 0: Skeleton (1 week)

1. `npm init` with TypeScript, @farjs/blessed, vitest, fastify
2. Implement `WwView`, `WwWindow`, `WindowManager`, `WwDesktop`
3. Render empty desktop with menu bar and status line
4. Take screenshot, compare with C++ version

**Exit criteria:** `Create  Generate  Canvas  Talk` menu bar renders.
Screenshot matches C++ layout.

### Phase 1: Core loop (2 weeks)

1. Port command registry (all 82 commands, dispatch skeleton)
2. Port API server (Express/Fastify, same routes as Python)
3. Port MCP tools (two-tool pattern)
4. Implement window lifecycle (open, close, move, resize, z-order)
5. Run existing Python contract tests against new server

**Exit criteria:** `curl /health`, `curl /commands`, `curl /state` work.
`POST /menu/command {"command":"cascade"}` works.
Python parity tests pass.

### Phase 2: Views (4 weeks)

Port views in dependency order:

1. Static views first (gradient, blocks, ascii grid) — simplest draw()
2. Generative art (verse, orbit, torus, cube, mycelium) — math-heavy
3. FIGlet text (shell out to figlet, cache lines)
4. Paint canvas (cell buffer, drawing tools, wwp codec)
5. Gallery browser (tab bar, file list, preview)
6. Text editor (cursor, selection, word wrap)

**Exit criteria:** All view types render. Screenshot comparison passes.

### Phase 3: Chat + LLM (2 weeks)

1. Port Wib&Wob chat (message view, input, streaming)
2. Port Scramble cat (three states, ASCII art, bubble)
3. Port AuthConfig (Claude Code / API Key / NoAuth detection)
4. Port Claude SDK integration (direct — no Node bridge needed)
5. Port Room Chat (PartyKit bridge)

**Exit criteria:** Wib&Wob chat works with Claude. Scramble responds.

### Phase 4: Games + Terminal (2 weeks)

1. Port Quadra, Snake, Rogue, Deep Signal (game loops)
2. Terminal emulator via node-pty + blessed widget
3. Micropolis — defer or compile engine to WASM

**Exit criteria:** All games playable. Terminal emulator works.

### Phase 5: Polish (1 week)

1. Workspace save/load
2. Desktop presets
3. Right-click context menus
4. Performance profiling and optimisation
5. Final parity audit

## 10. Testing strategy

### Reuse existing Python contract tests

The Python tests in `tests/contract/` and `tests/room/` test the API surface,
not the implementation. Point them at the new server:

```bash
# Same tests, new server
API_PORT=8089 uv run --with pytest pytest tests/contract/ -v
API_PORT=8089 uv run --with pytest pytest tests/room/ -q
```

### New TypeScript unit tests

```typescript
// tests/unit/command-registry.test.ts
import { describe, it, expect } from 'vitest';
import { COMMANDS, execCommand } from '../src/registry/command-registry';

describe('command registry', () => {
  it('has 82 commands', () => {
    expect(COMMANDS.length).toBe(82);
  });

  it('every command has a name and description', () => {
    for (const cmd of COMMANDS) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.description).toBeTruthy();
    }
  });
});
```

### Visual regression

Screenshot comparison between C++ and TS versions:

```bash
# C++ version
curl -X POST http://localhost:8089/screenshot  # → tui_cpp.txt

# TS version (same API)
curl -X POST http://localhost:8090/screenshot  # → tui_ts.txt

# Compare (menu bar, window chrome, content)
diff tui_cpp.txt tui_ts.txt
```

## 11. Dependencies

### Runtime

| Package | Purpose | Size |
|---|---|---|
| `@farjs/blessed` | TUI framework (blessed fork, 0 deps) | ~500 KB |
| `fastify` | HTTP server (API) | ~200 KB |
| `@anthropic-ai/claude-agent-sdk` | MCP + Claude SDK | ~100 KB |
| `node-pty` | Terminal emulation (pty) | Native addon |
| `ws` | WebSocket server | ~50 KB |
| `zod` | Schema validation | ~50 KB |

### Development

| Package | Purpose |
|---|---|
| `typescript` | Language |
| `tsx` | Development runner (hot-reload) |
| `vitest` | Unit tests |
| `@types/node` | Node.js types |

### System requirements

- Node.js 20+ (LTS)
- No CMake, no ncurses, no C++ toolchain
- `npm install` and go

## 12. Risks and mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| @farjs/blessed goes unmaintained | High | Medium | Fork early, vendor the dependency. Blessed is 16k LOC of pure JS — maintainable by one person. |
| Generative art too slow in JS | Medium | Low-Medium | Tier 1-3 performance strategy. Profile first — V8 JIT may surprise. WASM escape hatch for hot loops. |
| blessed can't do per-cell rendering well enough | High | Low | blessed.screen.lines gives raw cell access. Proven by blessed-contrib charts and dashboards. |
| node-pty breaks on some platforms | Medium | Low | node-pty is used by VS Code's terminal — battle-tested. |
| Two-version maintenance burden | Medium | High | Commit to cutover. Don't maintain both. C++ version becomes read-only reference. |
| Missing blessed features (ghost frame etc) | Low | Medium | blessed supports no-border mode natively. Shadow is a built-in option. Custom frame rendering via _render() override. |
| No true-color (24-bit) in blessed | Low | Certain | blessed maps hex to nearest 256-color index. WibWob-DOS generative art already uses shade characters (`.:;*#%`) more than color gradients — impact is minimal. Patch `draw()` to emit 24-bit SGR if needed (small diff). |

## 13. Decision log

| Decision | Rationale | Alternatives considered |
|---|---|---|
| @farjs/blessed over Ink | Overlapping windows with painter's algorithm. Ink uses Flexbox — wrong paradigm. | Ink (no overlap), Rezi (pre-alpha), OpenTUI (unclear overlap support) |
| TypeScript over Rust | Developer accessibility, ecosystem alignment (Node.js SDK, npm), hot-reload. | Rust (turbo-vision crate exists but TS is the goal) |
| Direct port over WASM bridge | Clean architecture. WASM bridge creates split-brain runtime. | Rust TV -> WASM -> TS (trap: two event loops, two rendering engines) |
| Fastify over Express | Faster, TypeScript-first, schema validation built in. | Express (larger ecosystem but slower) |
| Rust TV as reference over C++ | Cleaner architecture (ownership model forced explicit design). | C++ magiblot/tvision (known but harder to read as spec) |
| Single Node.js process | Eliminates IPC, simplifies deployment, enables browser target. | Keep Python API server (more work, no benefit) |

## 14. Success criteria

The port is complete when:

- [ ] All 82 commands execute correctly via `POST /menu/command`
- [ ] `GET /state` returns valid JSON matching the schema
- [ ] `GET /commands` returns all commands with descriptions
- [ ] All 42 view types render (screenshot comparison)
- [ ] All 14 window types support open/close/move/resize/z-order
- [ ] Python contract tests pass against the TS server
- [ ] Wib&Wob chat works with Claude (both auth modes)
- [ ] Scramble cat responds to messages and slash commands
- [ ] Generative art runs at >= 10 Hz on 80x24 terminal
- [ ] Paint canvas supports all pixel modes (Full, HalfY, Quarter)
- [ ] Workspace save/load round-trips correctly
- [ ] `npm install && npm start` is the only setup required
- [ ] Screenshots match C++ version (menu bar, window chrome, content areas)

## 15. References

### WibWob-DOS (current C++ codebase)

- Architecture: `CLAUDE.md` (this repo)
- Command reference: `docs/commands.md` (this repo)
- Master philosophy: `docs/master-philosophy.md` (this repo)
- Command registry: `app/command_registry.cpp` (this repo)
- Menu bar: `app/wwdos_app.cpp:2564+` (this repo)
- MCP tools: `app/llm/sdk_bridge/mcp_tools.js` (this repo)
- API server: `tools/api_server/main.py` (this repo)

### Framework and libraries

- @farjs/blessed npm: https://www.npmjs.com/package/@farjs/blessed
- @farjs/blessed GitHub: https://github.com/farjs/blessed
- @farjs/blessed releases: https://github.com/farjs/blessed/releases
- @farjs/blessed security analysis: https://snyk.io/advisor/npm-package/@farjs/blessed
- blessed API docs (original, still applies): https://github.com/chjj/blessed
- blessed events docs: https://lightyears1998.github.io/blessed-docs/mechanics/events/
- @types/blessed: https://www.npmjs.com/package/@types/blessed
- @unblessed/blessed (fallback): https://www.npmjs.com/package/@unblessed/blessed
- Fastify: https://fastify.dev/
- node-pty: https://github.com/microsoft/node-pty
- Claude Agent SDK: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- vitest: https://vitest.dev/

### Architectural references

- Turbo Vision for Rust (spec reference): https://github.com/aovestdipaperino/turbo-vision-4-rust
- Turbo Vision Rust docs: https://docs.rs/turbo-vision/latest/turbo_vision/
- Turbo Vision Rust announcement: https://medium.com/rustaceans/turbo-vision-for-rust-1-0-06c253faac64
- magiblot/tvision (C++ modern port): https://github.com/magiblot/tvision
- Ratzilla (Rust TUI WASM — pattern reference): https://github.com/ratatui/ratzilla

### Design inspiration

- "Lessons from Building Claude Code: Seeing Like an Agent" — progressive
  disclosure, two-tool MCP pattern, menus shaped to agent workflow
- WibWob-DOS menu redesign: Create / Generate / Canvas / Talk
  (see `docs/commands.md`, agent design notes section)
