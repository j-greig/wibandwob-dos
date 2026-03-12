# Microapp SDK Reference

API surface for module authors. Import everything from
`../../src/services/microapp-sdk.js`.

For the basics (manifest, skeleton, lifecycle hooks, verification):
see `docs/building-custom-modules.md`.

For common mistakes: see `pitfalls.md`.

## Manifest notes

`menu.category` must be one of: `file` `edit` `view` `window` `applications` `demos` `help`

Optional `dependencies` in `module.json` declares npm packages the module needs.
These must be installed in the root `package.json` via `bun add <pkg>`. The loader
does not auto-install them. If missing, the module fails to import with a clear
error in stderr.

---

## MicroappHost API

```typescript
host.createWindow({ title, width?, height?, left?, top? })  // → MicroappWindowHandle
host.registerCommand({ id, label, description?, action, menu?, palette?, direct? })
host.registerSnapshot({ serialize, restore })   // workspace persistence — see persistence.md
host.runCommand("markdown.open", { filePath })  // run any registered command
host.runCommand("open")                         // run a command within this module
host.screen                                     // blessed screen — call .render() after changes
host.geometry                                   // { width, height, cellAspect }
host.theme()                                    // current ThemeTokens — call fresh, not once

// WindowFacade — manipulate windows by id
host.windows.moveWindow(id, x, y)
host.windows.resizeWindow(id, w, h)
host.windows.focusWindow(id)
host.windows.closeWindow(id)

// UI layout primitives (also importable directly from SDK)
host.ui.createStack(...)       // vertical flex layout
host.ui.createRow(...)         // horizontal flex layout (canon name)
host.ui.createColumns(...)     // deprecated alias for createRow
host.ui.createHeaderBar(...)
host.ui.createStatusBar(...)
host.ui.createTextBlock(...)
host.ui.createRule(...)
host.ui.createFigletDisplay(...)
host.ui.createAnimatedPanel(...)
host.ui.createButtonBar(...)
host.ui.applyRect(node, rect)

// Available via direct import from microapp-sdk (not on host.ui):
// createGrid(parent, options)       — 2D grid layout
// createScrollViewport(parent, opts) — fixed header/footer + scrollable middle
// pickBreakpoint(width, entries?)    — responsive breakpoint selection
// createNodePart(node)              — wrap blessed box as LayoutPart
// createScrollbar()                 — scrollbar config for blessed boxes
// scrollableStyle(base)             — merge scrollbar styling into base style
```

## MicroappWindowHandle API

```typescript
win.id              // window id (number)
win.body            // blessed BoxElement — parent all widgets here

win.focus()
win.close()
win.setFocusTarget(widget)   // redirect keyboard focus to a child widget

// Required hooks:
win.describeState(fn)   // () => { summary, ...extras }
win.captureText(fn)     // () => string
win.onCleanup(fn)       // stop timers, destroy resources
win.onRestyle(fn)       // re-apply host.theme()

// Optional hooks:
win.onResize(fn)        // window resized
win.onInput(fn)         // (input: string) => void — from control API writeInput
```

## Theme tokens

```typescript
const t = host.theme();
t.body                    // { fg, bg }
t.selected                // { fg, bg } — highlighted items
t.muted                   // { fg } — secondary text
t.titleBarFocused         // { fg, bg }
t.titleBarUnfocused       // { fg, bg }
t.windowBorderFocused     // { fg }
t.windowBorderUnfocused   // { fg }
```

Always call `host.theme()` fresh — never cache the result.

---

## Render policy

- One local render function per window where possible
- Mutate widgets inside that function, not ad hoc across event handlers
- Use `win.onResize()` as the re-layout seam
- Call `host.screen.render()` after visual changes

---

## Layout

Two primitives: flex and grid. See `.agents/module-dev/.workings/layout-guide-final.md` for the full canon guide.

### Flex: createStack and createRow

```typescript
import { createStack, createRow, createNodePart } from "../../src/services/microapp-sdk.js";

// Vertical layout: header / body / footer
const root = createStack(win.body, [
  { key: "header", basis: 1,    part: headerPart },
  { key: "body",   basis: "1fr", part: bodyPart },
  { key: "footer", basis: 1,    part: footerPart },
]);

// Horizontal layout: sidebar / main
const body = createRow(win.body, [
  { key: "sidebar", basis: 20,    part: sidebarPart },
  { key: "main",    basis: "1fr", part: mainPart },
]);

// Wrap a raw blessed box as a LayoutPart
const panel = createNodePart(blessed.box({ parent: win.body, style: host.theme().body }));
```

### Grid: createGrid

```typescript
import { createGrid, createNodePart } from "../../src/services/microapp-sdk.js";

const grid = createGrid(win.body, {
  rows: 2, columns: 2,
  templateRows: ["1fr", "1fr"],
  templateColumns: ["2fr", "1fr"],
  gap: { row: 1, column: 1 },
});

grid.set({ key: "main",  row: 0, column: 0, rowSpan: 2, part: mainPart });
grid.set({ key: "stats", row: 0, column: 1, part: statsPart });
grid.set({ key: "log",   row: 1, column: 1, part: logPart });
```

### Responsive: pickBreakpoint

```typescript
import { pickBreakpoint } from "../../src/services/microapp-sdk.js";

function render() {
  const w = Math.max(1, Number(win.body.width) || 0);
  const mode = pickBreakpoint(w);  // returns "xs" | "sm" | "md" | "lg" | "xl"

  // Or with custom breakpoints:
  const custom = pickBreakpoint(w, [
    { name: "compact", minWidth: 0 },
    { name: "normal",  minWidth: 50 },
    { name: "wide",    minWidth: 80 },
  ]);
}
```

**Responsive rule: stack and scroll before you crush.**
When a narrow layout would produce illegible panels or useless slivers,
change composition instead of squeezing: hide panels, switch from row to
stack, allow the surface to become taller than the viewport, and provide
a scrollbar. Do not treat "everything fits on one screen" as a goal if
legibility is lost.

### Scroll viewport: createScrollViewport

```typescript
import { createScrollViewport } from "../../src/services/microapp-sdk.js";

const sv = createScrollViewport(win.body, {
  headerHeight: 1,
  footerHeight: 1,
});
// sv.header — fixed header box (or null)
// sv.viewport — scrollable middle region
// sv.footer — fixed footer box (or null)
// sv.scrollToBottom(), sv.scrollToTop()
```

### Layout lifecycle

```typescript
function render() {
  const w = Math.max(1, Number(win.body.width) || 0);
  const h = Math.max(1, Number(win.body.height) || 0);
  root.layout({ top: 0, left: 0, width: w, height: h });
  host.screen.render();
}

render();
win.onResize(render);
win.onRestyle(() => { root.restyle(); host.screen.render(); });
win.onCleanup(() => root.destroy());
```

---

## SDK Primitives

### Timers

```typescript
import { createTimer, clearTimers } from "../../src/services/microapp-sdk.js";

const timers = new Set<ReturnType<typeof setInterval>>();
createTimer(() => { /* runs every 500ms */ }, 500, timers);
win.onCleanup(() => clearTimers(timers));
```

### TreeWidget

```typescript
import { createTreeWidget, type TreeNode } from "../../src/services/microapp-sdk.js";

const tree = createTreeWidget(parentBox, { style: host.theme().body });
tree.setNodes([{ id: "a", label: "Folder", children: [{ id: "a1", label: "Child" }] }]);
tree.onSelect((node) => { /* selected */ });
tree.onFocus((node) => { /* focused */ });
tree.expandNode("a");
tree.collapseNode("a");
tree.toggleNode("a");
const focused = tree.getFocusedNode();
tree.destroy();  // in win.onCleanup()
```

Keys: j/k up/down, Enter/Space/←/→ toggle, g/G ends.

### Tabbed container

```typescript
import { createTabs, type TabDef } from "../../src/services/microapp-sdk.js";

const tabs = createTabs(win.body, [
  { name: "Tab A", build: (c) => { /* add widgets to c */ }, update: () => {}, cleanup: () => {} },
  { name: "Tab B", build: (c) => { /* ... */ } },
]);

tabs.switchTo(1);
tabs.tickActive();                   // call in timer loop
tabs.onSwitch((idx) => { /* tab changed */ });
win.onCleanup(() => tabs.destroy());
win.onRestyle(() => { tabs.renderBar(); host.screen.render(); });
```

Keys 1-9 switch tabs. Pass `{ keys: false }` as third arg to disable.

### Tween / motion

```typescript
import { tweenWindowPosition, tweenWindowSize, tween, EASINGS } from "../../src/services/microapp-sdk.js";

tweenWindowPosition(host.windows, win.id, 20, 5, 400, "easeOutCubic");
tweenWindowSize(host.windows, win.id, 120, 36, 300, "easeOutCubic");

const { cancel } = tween({
  from: 0, to: 100, duration: 600,
  easing: EASINGS.elasticOut,
  onUpdate: (v) => { box.width = Math.round(v); host.screen.render(); },
});
```

Easings: `linear` `easeIn` `easeOut` `easeInOut` `easeInCubic` `easeOutCubic`
`easeInOutCubic` `elasticOut` `bounceOut`

### RenderMonitor

```typescript
import { createRenderMonitor } from "../../src/services/microapp-sdk.js";

const monitor = createRenderMonitor(host.screen);
monitor.fps;           // frames in last 1000ms
monitor.avgFrameMs;    // ms between renders
monitor.totalFrames;   // lifetime frame count
const unsub = monitor.subscribe((r) => { /* periodic update */ }, 500);
win.onCleanup(() => { unsub(); monitor.destroy(); });
```

### Embedded animated surfaces

```typescript
import { createEmbeddedLivePlayer, readNodeViewport } from "../../src/services/microapp-sdk.js";

const player = createEmbeddedLivePlayer({
  fps: 6,
  generator: (tick, w, h) => renderFrame(tick, w, h),
  getViewport: (target) => readNodeViewport(target, { minWidth: 8, minHeight: 4, fallbackWidth: 24, fallbackHeight: 6 }),
  onFrame: (content) => { /* update */ },
  render: () => host.screen.render(),
});
player.attachTarget(box);
player.setRunning(true);
win.onCleanup(() => player.destroy());
```

### Pattern generators

11 built-in animated fill functions. Each takes `(width, height, tick)` → `string[]`.

```typescript
import { PATTERNS, patternBlockGradient, patternWave, ... } from "../../src/services/microapp-sdk.js";

const fn = PATTERNS[tick % PATTERNS.length]!;
box.setContent(fn(w, h, tick).join("\n"));
```

### Data simulation

```typescript
import { sinWave, randHistory, xLabels } from "../../src/services/microapp-sdk.js";
```

### ANSI gradient

```typescript
import { ansiGradientLine, hslToRgb } from "../../src/services/microapp-sdk.js";
const line = ansiGradientLine(width, 0, 180);  // hue 0→180
```

### Figlet

```typescript
import { renderFiglet, responsiveFiglet } from "../../src/services/microapp-sdk.js";
const text = renderFiglet("HELLO", "slant");
const responsive = responsiveFiglet("HELLO WORLD", availableWidth);
```

Use `renderFiglet` for the string. Use `host.ui.createFigletDisplay` for a
scrollable widget. Never shell out to figlet directly.

### Markdown

```typescript
host.runCommand("markdown.open", { filePath: "/path/to/file.md" });
```

---

## Scrollable canvas gotcha

Blessed's `_getCoords()` double-subtracts scroll offset for grandchildren
of a scrollable box. Fix: set `fixed: true` on all grandchildren.

```
scrollableCanvas (scrollable: true)
  frame (parent: canvas)           → no fixed needed
    titleBar (parent: frame)       → fixed: true  ← REQUIRED
    content (parent: frame)        → fixed: true  ← REQUIRED
```
