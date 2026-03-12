# Microapp SDK Reference

API surface for module authors. Import everything from
`../../src/services/microapp-sdk.js`.

## Component families

| Family | Components |
|--------|-----------|
| **Layout** | createStack, createRow, createGrid, createNodePart, pickBreakpoint, createScrollViewport, applyRect |
| **Chrome** | createHeaderBar, createStatusBar, createButtonBar, createBorderedPanel, createSidebarPanel, createRule |
| **Content** | createTextBlock, createFigletDisplay, createMessageHistory, createContentStack, createCollapsibleBlock |
| **Navigation** | createTabs, createSelectableList, createInlineSearch |
| **Forms** | createInputLine, createButton, createCheckbox, createRadioGroup, createSelect |
| **Data Display** | createKeyValuePanel, createLogView |
| **Feedback** | createProgressBar, createSpinner |
| **Animation** | createAnimationClock, tween, EASINGS |
| **Rendering** | grid-canvas helpers, ascii-composition, figlet, markdown |

All components follow the [component contract](component-contract.md).

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
host.runGlobalCommand("markdown.open", { filePath })  // run any global command by full id
host.runCommand("open")                                // run a command within this module (auto-prefixed)
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
host.ui.createRow(...)         // horizontal flex layout
host.ui.createHeaderBar(...)
host.ui.createStatusBar(...)
host.ui.createTextBlock(...)
host.ui.createRule(...)
host.ui.createFigletDisplay(...)
host.ui.createAnimatedPanel(...)
host.ui.createButtonBar(...)
host.ui.applyRect(node, rect)

// Advanced layout helpers — direct import only (not on host.ui):
// createGrid(parent, options)       — 2D grid layout
// createScrollViewport(parent, opts) — fixed header/footer + scrollable middle
// pickBreakpoint(width, entries?)    — responsive breakpoint selection
// createNodePart(node)              — wrap blessed box as LayoutPart
// createScrollbar()                 — scrollbar config for blessed boxes
// scrollableStyle(base)             — merge scrollbar styling into base style
//
// host.ui is a curated subset (createStack, createRow, bars, applyRect).
// For grid, scroll, responsive, and composition: import from microapp-sdk directly.
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

Two primitives: flex and grid. Full guide: `layout.md` in this directory.

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

Note: `align` on FlexChild and GridChild is declared in the types but
not yet implemented. Grid cells always fill their track area. Flex children
always fill their cross-axis. This is a future enhancement.

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
  // Entries must be non-empty, sorted ascending by minWidth.
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

## Forms

All form controls follow the [component contract](component-contract.md).
They return `LayoutPart` and compose with createStack/createRow/createGrid.
Import from `../../src/services/microapp-sdk.js`.

### createButton

```typescript
const btn = createButton({
  label: "Submit",
  onPress: () => save(),
  disabled: false,        // optional
});
// btn.update({ label: "Saving...", disabled: true });
```

Focusable. Enter/Space activates. Focus ring shows inverted colours.

### createCheckbox

```typescript
const cb = createCheckbox({
  label: "Enable sound",
  checked: true,           // optional, default false
  onChange: (e) => {       // e: ChangeEvent<boolean>
    console.log(e.value);  // new state
  },
  disabled: false,         // optional
});
// cb.checked()  → boolean
// cb.update({ checked: false })
```

Space toggles. Renders `[x]` or `[ ]`.

### createRadioGroup

```typescript
const radio = createRadioGroup({
  options: [
    { label: "Small", value: "sm" },
    { label: "Medium", value: "md" },
    { label: "Large", value: "lg" },
  ],
  selected: "md",          // optional
  onChange: (e) => {       // e: SelectEvent<string>
    console.log(e.value, e.index);
  },
});
// radio.selected()  → string | undefined
// Height = number of options
```

Arrow Up/Down navigates. Enter/Space selects. Shows `(o)` selected, `( )` unselected,
`>` focus indicator.

### createSelect

```typescript
const sel = createSelect({
  options: [
    { label: "Red", value: "red" },
    { label: "Blue", value: "blue" },
  ],
  placeholder: "Pick a colour",  // optional
  onChange: (e) => {              // e: SelectEvent<string>
    console.log(e.value);
  },
});
// sel.selected()  → string | undefined
```

Inline single-row picker (not a dropdown — blessed constraint).
Arrow Left/Right or Up/Down cycles through options. Renders `< label >`.

---

## Feedback

### createProgressBar

```typescript
const bar = createProgressBar({
  value: 0,
  max: 100,             // optional, default 100
  label: "Loading",     // optional
  showPercent: true,    // optional, default true
});
// bar.update({ value: 50 });  → renders: Loading ████████░░░░░░░░ 50%
```

Single-row horizontal bar with `█` filled and `░` empty segments.

### createSpinner

```typescript
const spinner = createSpinner({
  label: "Processing...",  // optional
  frames: undefined,       // optional, default braille frames
  interval: 80,            // optional, ms per frame
});
// spinner.stop();
// spinner.start();
// spinner.running()  → boolean
// spinner.update({ label: "Done!" });
```

Auto-starts on creation. Animated braille frames by default.
Call `destroy()` or `stop()` to clean up the internal timer.

### createToast

```typescript
createToast({
  message: "Saved!",
  severity: "success",     // "info" | "success" | "warning" | "error"
  parent: win.body,        // required — positions at bottom of this node
  duration: 3000,          // optional, ms, default 3000
});
// Returns { dismiss() } for manual removal
```

Per-window auto-dismissing notification. Non-blocking (does not steal focus).
Colour-coded by severity. Auto-cleans up after duration.

---

## Navigation

### createFilterableList

```typescript
const list = createFilterableList({
  items: [
    { label: "Apple", value: "apple" },
    { label: "Banana", value: "banana" },
  ],
  placeholder: "Search...",  // optional
  onSelect: (e) => {         // e: SelectEvent<string>
    console.log(e.value);
  },
});
// list.filter()    → current search query
// list.selected()  → value of focused item
```

Type to filter, Arrow Up/Down to navigate, Enter to select, Escape to clear,
Backspace to edit query. Height = 1 (search row) + visible items.

### createFormField

```typescript
const field = createFormField({
  label: "Username",
  help: "Letters and numbers only",  // optional
  error: "Required field",           // optional, shows in red
  child: someLayoutPart,             // any LayoutPart
});
// field.update({ error: "" })  → clears error
```

Wraps any LayoutPart child with label, optional help text, optional error text.
Height = 1 (label) + child + (1 if help) + (1 if error).

### createTextArea

```typescript
const ta = createTextArea({
  placeholder: "Type notes...",  // optional
  rows: 4,                      // optional, fills available height if omitted
  value: "",                    // optional
  onChange: (e) => {            // e: ChangeEvent<string>
    console.log(e.value);
  },
  disabled: false,              // optional
});
// ta.value()  → current text
```

Multiline text input using blessed.textarea. Bordered.
Focus to type, placeholder shown when empty and blurred.

---

## Data Display

### createKeyValuePanel

```typescript
const kv = createKeyValuePanel({
  entries: [
    { key: "Name", value: "Antopolis" },
    { key: "Population", value: "142" },
  ],
  border: true,    // optional
  label: "Stats",  // optional (requires border)
  keyWidth: 12,    // optional, auto-calculated if omitted
});
// kv.update({ entries: newEntries })
```

Aligned key-value pairs. Auto-calculates key column width.
Truncates values on narrow resize.

### createLogView

```typescript
const log = createLogView({
  maxEntries: 50,     // optional, default 100
  autoscroll: true,   // optional, default true
  border: true,       // optional
  label: "Events",    // optional
});
log.append({ text: "Reactor online", severity: "success" });
log.append("Plain message");  // string shorthand, severity defaults to "info"
// log.clear()
// log.entries()  → readonly LogEntry[]
```

Rolling event log. Severity prefixes: info=`  `, success=`+ `, warning=`~ `, error=`! `.

### createDataTable

```typescript
const table = createDataTable({
  columns: [
    { key: "name", label: "Name" },           // flex width
    { key: "role", label: "Role", width: 10 }, // fixed width
  ],
  rows: [
    { name: "Alice", role: "Engineer" },
    { name: "Bob", role: "Designer" },
  ],
  sortable: true,        // optional
  onSelect: (row, idx) => console.log(row.name),  // optional
});
// table.selectedIndex()  → number
// table.selectedRow()    → Record<string, string> | undefined
// table.update({ rows: newRows })
```

Arrow Up/Down navigates, Enter selects. Column headers with `|` separators.
Flex columns share remaining space proportionally. Truncates with `~` on narrow.

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
host.runGlobalCommand("markdown.open", { filePath: "/path/to/file.md" });
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
