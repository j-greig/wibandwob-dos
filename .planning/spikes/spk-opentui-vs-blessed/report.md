# OpenTUI vs Blessed: Migration Feasibility Report for WibWob-DOS

**Date:** 2026-03-12
**Purpose:** Evaluate OpenTUI as a potential replacement for blessed as the core TUI runtime

**Repos:**
- OpenTUI: https://github.com/anomalyco/opentui
- Blessed: https://github.com/chjj/blessed
- WibWob-DOS: https://github.com/jamesstaub/wibandwob-dos

---

## TLDR

OpenTUI is a serious, well-architected TUI framework (Zig core + TypeScript bindings,
9.3K stars, 8 months old, weekly releases, powers OpenCode IDE in production). It fixes
most of blessed's pain points — native performance, proper Unicode/grapheme handling,
Yoga flexbox layout, built-in animations, React/Solid frameworks, true 24-bit colour.

BUT: it has NO window manager, NO theme switching system, NO overlapping window model.
WibWob-DOS would need to reimplement its entire window system on top of OpenTUI's
renderable tree. The microapp SDK, chrome assembly, drag/resize, z-order, shadow boxes,
focus routing — all of it. That's 60-70% of the codebase.

**Verdict:** OpenTUI is the RIGHT long-term direction but the WRONG near-term move.
The migration cost is 6-8 weeks of focused work with high regression risk. Blessed's
bugs are known and worked around. OpenTUI's bugs are unknown and unworked-around.

**Recommendation:** Wait for OpenTUI 1.0 (API stability). Meanwhile, prototype ONE
window type (e.g. primer viewer) on OpenTUI to validate the rendering model. If that
works, plan a phased migration when the API stabilises.

---

## Feature Comparison Table

```
╔══════════════════════════════╦══════════════════════╦══════════════════════╗
║ FEATURE                      ║ BLESSED (current)    ║ OPENTUI (candidate)  ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ Language / Core              ║ Pure JavaScript      ║ Zig native + TS FFI  ║
║ Runtime                      ║ Bun (via Node compat)║ Bun (native FFI)     ║
║ TypeScript Support           ║ @types/blessed       ║ First-class TS       ║
║ Maturity                     ║ 10+ years, stable    ║ 8 months, beta       ║
║ Last Meaningful Update       ║ Years ago (dormant)  ║ 2 days ago (active)  ║
║ Stars                        ║ ~11K                 ║ ~9.3K                ║
║ Production Use               ║ Many projects        ║ OpenCode IDE         ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ RENDERING                    ║                      ║                      ║
║ Render Pipeline              ║ JS widget tree walk  ║ Zig native cell buf  ║
║ Diff Rendering               ║ Yes (JS diffing)     ║ Yes (native diffing) ║
║ FPS Control                  ║ No (render on demand)║ Yes (target/max FPS) ║
║ Post-Process Filters         ║ No                   ║ Yes (filter pipeline)║
║ Performance                  ║ Adequate, JS-bound   ║ Native, fast         ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ LAYOUT                       ║                      ║                      ║
║ Layout Engine                ║ String-based coords  ║ Yoga (CSS Flexbox)   ║
║ Absolute Positioning         ║ Yes (primary mode)   ║ Yes (supported)      ║
║ Flex / Responsive            ║ Percentage only      ║ Full flexbox model   ║
║ Nesting                      ║ Parent-child boxes   ║ Renderable tree      ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ COLOUR                       ║                      ║                      ║
║ 16 Colour                    ║ Yes                  ║ Yes                  ║
║ 256 Colour                   ║ Yes (only reliable!) ║ Yes                  ║
║ 24-bit True Colour           ║ BROKEN (desaturates) ║ Yes (native RGBA)    ║
║ Alpha Blending               ║ No                   ║ Yes (per-cell)       ║
║ Colour System                ║ String names/hex     ║ RGBA objects + parse ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ TEXT & UNICODE                ║                      ║                      ║
║ Unicode Width                ║ BUGGY (monkeypatch)  ║ Native grapheme clust║
║ Emoji Support                ║ Broken without patch  ║ Built-in (uucode)    ║
║ CJK Wide Characters          ║ Broken without patch  ║ Correct (OSC 66)     ║
║ Text Attributes              ║ Bold/underline/etc   ║ Full bitmask set     ║
║ Styled Text Templates        ║ {tag} markup         ║ Template literals    ║
║ Rope-Based Text Buffer       ║ No                   ║ Yes (Zig native)     ║
║ Syntax Highlighting          ║ No                   ║ Tree-sitter built-in ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ WIDGETS / RENDERABLES        ║                      ║                      ║
║ Box / Container              ║ blessed.box          ║ BoxRenderable        ║
║ Text Display                 ║ blessed.text         ║ TextRenderable       ║
║ Text Input                   ║ blessed.textbox      ║ InputRenderable      ║
║ List / Select                ║ blessed.list         ║ SelectRenderable     ║
║ Table                        ║ blessed.table        ║ None (build custom)  ║
║ Textarea / Editor            ║ blessed.textarea     ║ TextBufferRenderable ║
║ Terminal Emulator            ║ blessed.terminal     ║ None (build custom)  ║
║ Scrollable Container         ║ blessed.scrollablebox║ ScrollBoxRenderable  ║
║ Progress Bar                 ║ blessed.progressbar  ║ Slider               ║
║ ASCII Art Fonts              ║ No                   ║ ASCIIFontRenderable  ║
║ Code w/ Syntax               ║ No                   ║ CodeRenderable       ║
║ Markdown Renderer            ║ No                   ║ MarkdownRenderable   ║
║ Diff Viewer                  ║ No                   ║ DiffRenderable       ║
║ Framebuffer (pixel-level)    ║ No                   ║ FrameBufferRenderable║
║ 3D Rendering                 ║ No                   ║ Three.js + WebGPU    ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ WINDOW MANAGEMENT            ║                      ║                      ║
║ Overlapping Windows          ║ Via z-index/setIndex ║ NONE (must build)    ║
║ Window Chrome (borders etc)  ║ Built-in border prop ║ Must compose from Box║
║ Drag / Resize                ║ Custom (mouse events)║ Must build from mouse║
║ Focus Stack / Z-Order        ║ screen.focused       ║ Must build custom    ║
║ Shadow Boxes                 ║ Custom blessed.box   ║ Must build custom    ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ INPUT                        ║                      ║                      ║
║ Keyboard Events              ║ screen.key() / on()  ║ KeyHandler + events  ║
║ Mouse Events                 ║ screen.on("mouse")   ║ renderer.on("mouse") ║
║ Mouse Drag Detection         ║ Custom (state track) ║ Built-in drag bounds ║
║ Paste Events                 ║ No (manual)          ║ Built-in             ║
║ Mouse Pointer Shape          ║ No                   ║ Yes (arrow/hand/text)║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ ANIMATION                    ║                      ║                      ║
║ Built-in Animation System    ║ No                   ║ Timeline + easing    ║
║ Tween / Easing Functions     ║ No (manual setInterval)║ 15+ easing functions ║
║ Animation Sequencing         ║ No (manual)          ║ Timeline.add() + time║
║ Loop / Alternate             ║ No                   ║ Yes                  ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ THEMING                      ║                      ║                      ║
║ Theme System                 ║ Custom (25 tokens)   ║ NONE (must build)    ║
║ Runtime Theme Switching      ║ Yes (restyleAll)     ║ Must build custom    ║
║ Light/Dark Detection         ║ No                   ║ Yes (DEC 2031)       ║
║ External Theme Loading       ║ Yes (module themes)  ║ Must build custom    ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ FRAMEWORKS                   ║                      ║                      ║
║ React Integration            ║ No                   ║ @opentui/react       ║
║ Solid.js Integration         ║ No                   ║ @opentui/solid       ║
║ Declarative UI (JSX)         ║ No                   ║ Yes (Constructs/VNode)║
║ Testing Framework            ║ No                   ║ createTestRenderer() ║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ DEVELOPER EXPERIENCE         ║                      ║                      ║
║ Debug Console                ║ No                   ║ Built-in overlay     ║
║ FPS / Memory Stats           ║ No                   ║ Debug overlay        ║
║ Test Renderer (headless)     ║ No                   ║ Yes                  ║
║ Hot Reload                   ║ No                   ║ No                   ║
║ Documentation Quality        ║ Decent (old)         ║ Good (examples-heavy)║
╠══════════════════════════════╬══════════════════════╬══════════════════════╣
║ WIBWOB-SPECIFIC              ║                      ║                      ║
║ Microapp SDK Compat          ║ Native (SDK is built ║ Full rewrite needed  ║
║                              ║ on blessed)          ║                      ║
║ Agent Window                 ║ Works today          ║ Must port            ║
║ Workspace Save/Restore       ║ Works today          ║ Must port            ║
║ Control API (/state etc)     ║ Works today          ║ Must port            ║
║ 18 Existing Modules          ║ All working          ║ All need porting     ║
║ Terminal PTY Module           ║ Working (with hacks) ║ Must rebuild entirely║
║ Image Rendering (chafa)      ║ 256-colour workaround║ True colour possible ║
╚══════════════════════════════╩══════════════════════╩══════════════════════╝
```

---

## Section 1: Blessed — The Incumbent

### What It Is

Blessed is a curses-like terminal interface library for Node.js, created by
Christopher Jeffrey circa 2013. It provides a widget-based abstraction over
raw terminal escape codes: boxes, text, lists, textareas, tables, scrollable
containers, and a terminal emulator widget.

WibWob-DOS uses blessed v0.1.81 (pinned), plus blessed-contrib v4.11.0 for
some generative art widgets and blessed-xterm v1.5.1 as a terminal fallback.

### Architecture & Philosophy

Blessed follows a DOM-like model:

- A `screen` object owns the terminal program and event loop
- Widgets are nested in a tree (screen > box > box > text)
- Each widget has position, size, style, content, and event handlers
- `screen.render()` walks the tree, composites to a cell buffer, diffs
  against the previous frame, and outputs only changed ANSI escape codes

The philosophy is "HTML/CSS for the terminal" — string-based positioning
(`top: "50%"`, `left: 5`), border properties, style objects with fg/bg
colours, and a scrollable viewport model.

### Key Features (as used by WibWob-DOS)

- WIDGET TREE: Every window is a tree of blessed.box elements — shadow,
  frame (with border), titleBar, body (content parent), closeHint, resizeGrip
- RENDER SCHEDULER: WibWob layers a RenderScheduler above blessed that
  batches requestRender() calls into one screen.render() per microtask
- WINDOW MANAGER: Custom z-order stack, focus routing, drag/resize, all
  built on blessed mouse events and setIndex() for z-ordering
- MICROAPP SDK: Modules get a MicroappHost with createWindow(), theme(),
  screen, and registerCommand(). All widgets parent to win.body.
- THEMING: 25+ semantic tokens (windowFrame, titleBarFocused, body, accent
  etc.), runtime switching via restyleAll() which calls onRestyle() hooks
- INPUT: screen.on("mouse") for all mouse events, screen.on("keypress")
  for keyboard, custom dispatch to focused window
- TERMINAL: blessed.terminal widget + Node PTY bridge subprocess (Bun
  doesn't support node-pty natively)

### Known Pain Points (11 documented)

1. UNICODE: Double-width string handling broken, requires monkeypatch
2. SCROLL BUG: _getCoords() double-subtracts scroll offset for grandchildren
3. CLICK ROUTING: lpos hit-testing breaks with fixed:true children
4. DOUBLE INPUT: element.key() registers globally, fires multiple times
5. SCROLL JUMP: screen._focus auto-scrolls on .focus() calls
6. STYLE CRASH: Missing style.scrollbar or style.item causes render crash
7. TRUE COLOUR: 24-bit hex tags broken, must use 256-colour mode
8. PTY BRIDGE: Bun can't use node-pty directly, needs Node subprocess
9. MOUSE PASSTHROUGH: Terminal widget needs custom VT100 mouse translation
10. CLICK SUPPRESSION: Click fires before mouseup-ends-drag, needs state guard
11. CURSOR OVERLAY: Blessed re-shows system cursor on every render

All of these have working workarounds in the codebase. They're annoying but
they're KNOWN. That's worth something.

### Blessed's Strengths (often overlooked)

- BATTLE-TESTED: Thousands of projects have shipped on blessed
- SIMPLE MENTAL MODEL: It's boxes all the way down
- LOW BARRIER: No build step, no FFI, no native binaries
- ADEQUATE PERFORMANCE: For WibWob-DOS's needs, it's fast enough
- THE DEVIL YOU KNOW: Every bug is documented, every workaround is in place

---

## Section 2: OpenTUI — The Challenger

### What It Is

OpenTUI is a native terminal UI framework with a Zig core (~58K lines of Zig)
and TypeScript bindings via Bun FFI. Created ~July 2025, currently at v0.1.87,
9.3K GitHub stars, weekly releases. It powers OpenCode IDE in production.

### Architecture & Philosophy

OpenTUI follows a RENDERABLE TREE model (similar to a scene graph):

- A `CliRenderer` owns terminal I/O, the event loop, and the render pipeline
- Renderables are composable visual components with lifecycle methods
- Layout is computed by Yoga (Facebook's CSS Flexbox engine)
- Rendering happens at a target FPS (default 60), with diff-only output
- The Zig core handles cell buffer operations, grapheme breaking, and
  terminal escape code generation — TypeScript orchestrates the tree

The philosophy is "native performance, modern DX" — Yoga flexbox for layout,
RGBA colour model with alpha blending, template literal styling, and optional
React/Solid.js declarative frameworks on top.

### Key Features

- NATIVE CORE: Zig handles all hot-path operations (text measurement,
  cell buffer manipulation, diff rendering, ANSI output)
- YOGA LAYOUT: CSS Flexbox model — flexDirection, justifyContent, alignItems,
  percentage sizing, flex-grow/shrink, min/max constraints
- RGBA COLOURS: True 24-bit colour with alpha blending per cell
- GRAPHEME HANDLING: Proper Unicode grapheme cluster detection via uucode,
  correct emoji width, ZWJ sequence support, OSC 66 width queries
- RICH RENDERABLES: 15+ built-in types including code with tree-sitter
  syntax highlighting, markdown renderer, diff viewer, framebuffer for
  pixel-level drawing, ASCII art fonts, 3D via Three.js
- TIMELINE ANIMATIONS: Built-in animation system with 15+ easing functions,
  sequencing, looping, alternate (ping-pong) mode
- FRAMEWORK SUPPORT: @opentui/react and @opentui/solid for declarative UI
- INPUT: Detailed KeyEvent with ctrl/shift/alt/meta/option/repeated flags,
  mouse click/drag/scroll with pointer shape hints, paste events
- TEST RENDERER: createTestRenderer() for headless testing
- DEBUG OVERLAY: Built-in FPS/memory stats and console capture

### What OpenTUI Does NOT Have

- NO WINDOW MANAGER: No overlapping windows, no z-order stack, no focus
  routing between windows. You get a renderable tree, not a desktop.
- NO THEME SYSTEM: Light/dark detection yes, but no token-based theme
  switching framework. Colours are per-component.
- NO TERMINAL WIDGET: No equivalent to blessed.terminal. You'd need to
  build terminal emulation from scratch or integrate xterm.js headless.
- NO TABLE WIDGET: Must compose from boxes/text
- NO SESSION/WORKSPACE: No save/restore, no persistence
- NO PLUGIN SYSTEM: Static architecture, no hot-reload for widgets

### OpenTUI's Strengths

- PERFORMANCE: Native Zig core is genuinely fast. Cell buffer ops, text
  measurement, diff rendering — all in compiled native code via FFI.
- CORRECTNESS: Unicode/grapheme handling is correct from the ground up,
  not monkeypatched on top of a broken string-width calculation.
- MODERN DX: First-class TypeScript, template literal styling, React/Solid
  reconcilers, test renderer, debug overlay.
- ACTIVE DEVELOPMENT: Weekly releases, responsive maintainers, growing
  community. This project has momentum.
- RICHER PRIMITIVES: Framebuffer for pixel-level drawing, ASCIIFont for
  large text, code with syntax highlighting, markdown renderer, diff viewer.
  These would be genuinely useful for WibWob-DOS.

---

## Section 3: The WibWob-DOS Custom Layer

WibWob-DOS isn't just "blessed with some windows." It's a substantial
abstraction layer ABOVE blessed that would need to be rebuilt regardless
of which underlying framework is chosen.

### What WibWob Built On Top of Blessed

```
┌─────────────────────────────────────────────────┐
│ MICROAPP SDK                                     │
│ MicroappHost, createWindow(), registerCommand()  │
│ 18 modules, lifecycle hooks, theme access        │
├─────────────────────────────────────────────────┤
│ WINDOW MANAGER                                   │
│ Z-order stack, focus routing, drag/resize        │
│ Shadow boxes, chrome assembly, tile/cascade      │
│ WindowFacade (11 methods), WindowRecord          │
├─────────────────────────────────────────────────┤
│ RENDER SCHEDULER                                 │
│ Batched invalidation, sync/persist/render        │
│ Coalesces multiple requests per microtask        │
├─────────────────────────────────────────────────┤
│ THEME SYSTEM                                     │
│ 25 semantic tokens, runtime switching            │
│ restyleAll(), onRestyle() hooks, external themes │
├─────────────────────────────────────────────────┤
│ CONTROL API + STATE SERVICE                      │
│ HTTP on :8099, GET /state, POST /commands/run    │
│ Agent tools, workspace save/restore              │
├─────────────────────────────────────────────────┤
│ blessed.screen + blessed.box + blessed.terminal  │
└─────────────────────────────────────────────────┘
```

The bottom layer (blessed) is maybe 30% of the complexity. The other 70%
is WibWob's own window manager, microapp SDK, theme system, control API,
state service, workspace persistence, and agent integration.

Swapping blessed for OpenTUI means rebuilding the bottom 30% AND rewiring
every connection point between the bottom and the 70% above it.

---

## Section 4: Migration Analysis

### What Gets Easier with OpenTUI

- TRUE COLOUR: The chafa 256-colour workaround goes away. Images render
  in full 24-bit colour. The image hydrator simplifies.
- UNICODE: The monkeypatch goes away. Emoji and CJK just work.
- SCROLL BUGS: Blessed's _getCoords double-subtraction, fixed:true
  workarounds, click routing desync — all gone. Yoga layout is sane.
- ANIMATIONS: The manual setInterval + frame counter pattern gets replaced
  by Timeline with easing. Glitchbox, primers, VJ timeline all benefit.
- TEXT EDITING: Rope-based text buffer with undo/redo. Editor windows
  become much more capable.
- TESTING: createTestRenderer() enables headless integration tests.
  Currently WibWob has no headless test path.
- SYNTAX HIGHLIGHTING: Tree-sitter built in. Code viewer gets free
  highlighting without a third-party dependency.

### What Gets Harder with OpenTUI

- WINDOW MANAGER: Must reimplement from scratch. OpenTUI has no concept
  of overlapping windows with z-order, focus stacking, drag, resize,
  shadow boxes, or chrome assembly. This is the CORE of WibWob-DOS.
- TERMINAL WIDGET: blessed.terminal is gone. The PTY bridge pattern
  needs a new rendering target. Possibly xterm.js headless rendering
  to a FrameBufferRenderable? Uncharted territory.
- THEME SYSTEM: Must rebuild theme token application. OpenTUI has no
  style.scrollbar, no style.item, but also no restyleAll() pattern.
  Need a new approach to runtime theme switching across all renderables.
- 18 MODULE PORTS: Every module's blessed.box/list/textbox usage needs
  converting to OpenTUI renderables. Some are trivial (hello-world),
  some are complex (terminal, sy2-chronicles, glitchbox).
- BUILD COMPLEXITY: Zig 0.15.2 exact version requirement. Pre-built
  binaries exist for common platforms, but CI/CD needs the right native
  package. Less forgiving than "npm install blessed".
- API INSTABILITY: Beta project, weekly releases. API may change.
  Pinning helps but you might miss security/perf fixes.

### Effort Estimate

```
┌────────────────────────────────┬──────────┬──────────────────────────┐
│ Task                           │ Effort   │ Risk                     │
├────────────────────────────────┼──────────┼──────────────────────────┤
│ Screen abstraction + renderer  │ 3-5 days │ Low (well-documented)    │
│ Window manager (z-order, focus │          │                          │
│   drag, resize, chrome, shadow)│ 2-3 weeks│ HIGH (core of WibWob)    │
│ Microapp SDK adapter           │ 3-5 days │ Medium (interface stable)│
│ Theme system port              │ 2-3 days │ Low (already decoupled)  │
│ Input routing (keyboard+mouse) │ 3-5 days │ Medium (different model) │
│ Control API + state service    │ 3-5 days │ Low (HTTP layer unchanged│
│ Module ports (18 modules)      │ 1-2 weeks│ Medium (varies by module)│
│ Terminal widget rebuild        │ 1-2 weeks│ HIGH (uncharted)         │
│ Integration testing + bugfix   │ 2-3 weeks│ HIGH (unknown unknowns)  │
├────────────────────────────────┼──────────┼──────────────────────────┤
│ TOTAL                          │ 6-10 wks │                          │
└────────────────────────────────┴──────────┴──────────────────────────┘
```

---

## Section 5: Architectural Philosophy Comparison

### Blessed: "HTML for Terminals"

- Widgets are DOM-like nodes with properties and events
- Layout is string-based coordinates ("50%", 5, "center")
- Rendering is imperative: mutate widget, call render()
- The screen is the document, widgets are elements
- Designed for FORMS and DASHBOARDS — not desktops

### OpenTUI: "Scene Graph for Terminals"

- Renderables are composable visual components with lifecycle
- Layout is CSS Flexbox (Yoga engine)
- Rendering is frame-based with FPS control and diff output
- The renderer is a game engine, renderables are scene nodes
- Designed for RICH INTERACTIVE APPS — closer to what WibWob needs

### WibWob-DOS: "Desktop Metaphor on Terminal"

- Neither blessed nor OpenTUI was designed for overlapping windows
- WibWob's window manager is the REAL abstraction — blessed is just
  the rendering backend
- The WindowFacade interface (11 methods) is framework-agnostic
- The microapp SDK is the developer-facing surface
- The question isn't "blessed vs OpenTUI" — it's "which backend
  gives WindowFacade the best foundation?"

This is the key insight: WibWob-DOS already abstracts away blessed
through WindowFacade. A migration is really about providing a better
implementation of that interface, not about adopting OpenTUI's
programming model wholesale.

---

## Section 6: Strategic Options

### Option A: Stay on Blessed (Status Quo)

- COST: Zero
- RISK: Low (known bugs, known workarounds)
- UPSIDE: Stability, all 18 modules working, all workarounds in place
- DOWNSIDE: Dormant upstream, true colour broken, Unicode patched,
  no animation system, no test renderer, aging codebase
- WHEN: If the current pain is tolerable and velocity matters more
  than long-term architecture

### Option B: Full Migration to OpenTUI

- COST: 6-10 weeks, high regression risk
- RISK: High (beta API, unknown bugs, terminal widget unknown)
- UPSIDE: Native perf, true colour, proper Unicode, animations,
  testing, syntax highlighting, active upstream, modern DX
- DOWNSIDE: All-or-nothing, long period of instability, every
  module needs porting, terminal emulation is uncharted
- WHEN: If blessed is genuinely blocking features or if WibWob-DOS
  is entering a "v2 rewrite" phase

### Option C: Hybrid / Incremental Migration (Recommended)

- PHASE 0 (1 week): Prototype one window type on OpenTUI. Pick
  something visual but simple — primer viewer or glitchbox. Run
  it standalone to validate the rendering model, colour fidelity,
  animation API, and terminal compatibility.

- PHASE 1 (2-3 weeks): If Phase 0 succeeds, build a WindowFacade
  implementation backed by OpenTUI. Keep blessed running for existing
  windows. New windows can use either backend.

- PHASE 2 (2-3 weeks): Port modules one at a time, starting with
  simple ones (hello-world, heartbeat) and ending with complex ones
  (terminal, sy2-chronicles).

- PHASE 3 (1-2 weeks): Remove blessed dependency entirely. Full
  integration testing.

- COST: Same total effort but spread over months with escape hatches
- RISK: Medium (can bail at any phase)
- UPSIDE: Learn OpenTUI's real pain points before committing
- DOWNSIDE: Temporary complexity of two rendering backends

### Option D: Wait for OpenTUI 1.0

- COST: Zero now, full migration cost later
- RISK: Low (blessed continues working)
- UPSIDE: Stable API, more community resources, more battle-testing
- DOWNSIDE: Could be months/years. Blessed pain continues.
- WHEN: If there's no urgent driver and patience is available

---

## Section 7: What I'd Actually Do

If I were making this call for WibWob-DOS today:

1. DO NOT migrate now. The 6-10 week cost is too high for a beta
   framework. Blessed's bugs are worked around and the app ships.

2. DO run the OpenTUI examples on your terminal setup. See if the
   rendering quality, colour fidelity, and performance feel right.
   This costs an afternoon.

3. DO build a standalone OpenTUI prototype of the primer viewer.
   This validates the one thing blessed is worst at: rendering
   colourful ASCII art with correct Unicode. If OpenTUI nails this,
   it's worth the migration eventually.

4. WATCH the project. Subscribe to releases. When it hits 1.0 or
   when blessed causes a blocking issue that can't be worked around,
   that's the trigger.

5. MEANWHILE, keep the WindowFacade abstraction clean. Every new
   window and module should go through the SDK, not touch blessed
   directly. This makes the eventual migration cheaper.

---

## Appendix: Quick Reference

### Installing OpenTUI (for prototyping)

```bash
bun add @opentui/core
# Platform-specific native binary auto-selected:
# @opentui/core-darwin-arm64 (Apple Silicon)
# @opentui/core-darwin-x64 (Intel Mac)
# @opentui/core-linux-x64 etc.
```

### Minimal OpenTUI Example

```typescript
import { createCliRenderer, BoxRenderable, TextRenderable } from "@opentui/core"

const renderer = await createCliRenderer({
  stdin: process.stdin,
  stdout: process.stdout,
  exitOnCtrlC: true,
})

const box = new BoxRenderable(renderer, {
  border: true,
  width: 40,
  height: 10,
  padding: 1,
})

const text = new TextRenderable(renderer, {
  content: "Hello from OpenTUI",
})

box.add(text)
renderer.root.add(box)
renderer.start()
```

### WibWob-DOS Window Facade Interface (migration target)

```typescript
interface WindowFacade {
  move(x: number, y: number): void
  resize(w: number, h: number): void
  focus(): void
  close(): void
  setTitle(title: string): void
  getGeometry(): { x, y, w, h }
  onInput(handler: InputHandler): void
  onCleanup(handler: () => void): void
  onRestyle(handler: () => void): void
  describeState(fn: () => StateDescription): void
  captureText(fn: () => string): void
}
```

This interface is framework-agnostic. The migration is about providing
a better implementation, not changing the contract.
