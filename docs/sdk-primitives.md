# SDK Composition Helpers

> **Note:** This file documents composition helpers from the pre-refactor era
> (`createTextViewer`, `createListPanel`, `createSplitView`, etc.). For new
> microapps, prefer the SDK-native equivalents (`createTextBlock`,
> `createSelectableList`, `createStack`, etc.) documented in
> `.agents/guides/microapp/sdk-reference.md`.

Themed UI primitives for microapp authors. Import from `microapp-sdk.js`:

```typescript
import {
  createStatusBar,
  createTextViewer,
  createListPanel,
  createSplitView,
  createButtonBar,
} from "../../src/services/microapp-sdk.js";
```

All helpers are theme-aware — colours update via `.update()` on restyle.

---

## `createStatusBar(parent, opts?)`

Bottom-pinned bar with left/right text slots.

```typescript
const status = createStatusBar(win.body, {
  left: " Notepad │ 42 lines",
  right: "UTF-8 ",
});

// Update text:
status.update({ left: " Notepad │ 99 lines" });

// Cleanup:
status.destroy();
```

**Options**: `left?`, `right?`, `height?` (default 1)
**Returns**: `{ element, update(opts), destroy() }`

---

## `createTextViewer(parent, opts?)`

Scrollable text box with vi keys, mouse scroll, themed scrollbar.

```typescript
const viewer = createTextViewer(win.body, {
  content: "Hello world\nLine 2",
  wrap: true,        // default: true
  vi: true,          // default: true
  bottomOffset: 1,   // reserve 1 row for status bar
});

// Set focus:
win.setFocusTarget(viewer.element);

// Update content:
viewer.update({ content: newText });

// Read content:
const text = viewer.getContent();
```

**Options**: `content?`, `wrap?`, `vi?`, `bottomOffset?`
**Returns**: `{ element, update(opts), getContent(), destroy() }`

---

## `createListPanel(parent, opts)`

Selectable list with keyboard nav and theme-aware selection highlight.

```typescript
const list = createListPanel(win.body, {
  items: ["Alpha", "Beta", "Gamma"],
  vi: true,          // default: true
  bottomOffset: 1,
});

list.onSelect((index, item) => {
  status.update({ left: ` Selected: ${item}` });
});

// Update items:
list.update({ items: ["New", "Items"], selected: 0 });

// Read selection:
const idx = list.getSelected();
```

**Options**: `items`, `vi?`, `bottomOffset?`
**Returns**: `{ element, update(opts), getSelected(), onSelect(cb), destroy() }`

---

## `createSplitView(parent, opts?)`

Two-pane layout — horizontal (left/right) or vertical (top/bottom).

```typescript
const split = createSplitView(win.body, {
  direction: "horizontal",  // default
  ratio: 0.3,               // 30% left, 70% right
  bottomOffset: 1,
});

// Add content to panes:
const list = createListPanel(split.first, { items: ["A", "B"] });
const viewer = createTextViewer(split.second, { content: "Details..." });

// Resize:
split.update({ ratio: 0.5 });
```

**Options**: `direction?`, `ratio?` (0–1), `bottomOffset?`
**Returns**: `{ first, second, element, update(opts), destroy() }`

---

## `createButtonBar(parent, opts)`

Bottom toolbar with labelled buttons and optional keyboard shortcuts.

```typescript
const bar = createButtonBar(win.body, {
  buttons: [
    { label: "Save", key: "C-s", action: () => save() },
    { label: "Quit", key: "q", action: () => win.close() },
  ],
});

// Update buttons:
bar.update({
  buttons: [{ label: "Done", key: "enter", action: () => finish() }],
});
```

**Options**: `buttons` (array of `{ label, key?, action }`), `height?`
**Returns**: `{ element, update(opts), destroy() }`

---

## Pattern: Notepad with SDK Helpers

```typescript
import type { MicroappHost } from "../../src/services/microapp-sdk.js";
import { createStatusBar, createTextViewer } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open Notepad",
    action: () => {
      const win = host.createWindow({ title: "Notepad", width: 60, height: 20 });
      const viewer = createTextViewer(win.body, { bottomOffset: 1, wrap: false });
      const status = createStatusBar(win.body, { left: " Notepad" });

      win.setFocusTarget(viewer.element);
      win.captureText(() => viewer.getContent());
      win.describeState(() => ({ lines: viewer.getContent().split("\n").length }));
      win.onRestyle(() => { viewer.update({}); status.update({}); });
      win.onCleanup(() => { viewer.destroy(); status.destroy(); });
      return { ok: true };
    },
  });
}
```

---

## `createHeaderBar(parent, opts?)`

Top-pinned bar with left/right text slots. Uses `theme().header` tokens.

```typescript
const header = createHeaderBar(win.body, { left: " My App", right: "v1.0 " });
header.update({ left: " Updated Title" });
header.destroy();
```

**Options**: `left?`, `right?`, `height?` (default 1)
**Returns**: `{ element, update(opts), destroy() }`

---

## `createScrollView(parent, opts?)`

Scrollable content area with themed scrollbar, vi keys, mouse support.
Like `createTextViewer` but with `topOffset` and `scrollTo`.

```typescript
const scroll = createScrollView(win.body, {
  content: longText,
  topOffset: 1,
  bottomOffset: 1,
  wrap: false,
});
scroll.scrollTo(50);
scroll.update({ content: newText });
```

**Options**: `content?`, `wrap?`, `vi?`, `topOffset?`, `bottomOffset?`
**Returns**: `{ element, update(opts), getContent(), scrollTo(line), destroy() }`

---

## `createTabs(parent, opts)`

Tabbed container — tab bar at top, content area below.
Switch with left/right arrows or number keys (1-9).

```typescript
const tabs = createTabs(win.body, {
  tabs: [
    { label: "Info", content: "System info here..." },
    { label: "Logs", content: "Log output..." },
  ],
  active: 0,
  bottomOffset: 1,
});

tabs.onSwitch((index) => status.update({ left: ` Tab ${index + 1}` }));
tabs.update({ active: 1 });
```

**Options**: `tabs` (array of `{ label, content }`), `active?`, `bottomOffset?`
**Returns**: `{ element, update(opts), getActive(), onSwitch(cb), destroy() }`

---

## `createRule(parent, opts?)`

Horizontal divider line. Uses `theme().muted` tokens.

```typescript
const rule = createRule(win.body, { char: "═", top: 5 });
rule.update({ char: "─" });
```

**Options**: `char?` (default "─"), `height?`, `top?`
**Returns**: `{ element, update(opts), destroy() }`

---

## `createInputLine(parent, opts?)`

Single-line text input. Uses `theme().input` tokens. Fires submit on Enter.

```typescript
const input = createInputLine(win.body, { placeholder: "Type here..." });
input.onSubmit((value) => {
  viewer.update({ content: value });
});
input.focus();
```

**Options**: `placeholder?`, `bottom?`
**Returns**: `{ element, getValue(), setValue(text), focus(), onSubmit(cb), destroy() }`

---

## `createCanvas(parent, opts?)`

Free-form drawing surface for graphics, animations, or generative art.
Provides a pixel-aware element with direct character-cell access.
Useful for real-time visualizations, waveforms, animations, or ASCII graphics.

```typescript
const canvas = createCanvas(win.body, {
  width: 40,
  height: 20,
  bottomOffset: 1,
});

// Draw characters to the canvas:
canvas.setChar(5, 5, "█", { fg: "green", bg: undefined });
canvas.setChar(6, 5, "▓");

// Clear and redraw:
canvas.clear();
canvas.update({ width: 50, height: 25 });

// Cleanup:
canvas.destroy();
```

**Options**: `width?`, `height?`, `topOffset?`, `bottomOffset?`
**Returns**: `{ element, setChar(x, y, char, style?), clear(), update(opts), destroy() }`

Common use cases:
- Live data visualization (stock tickers, charts)
- Real-time animation (scrollers, spinners)
- ASCII art generation or procedural drawing
- Waveform or spectrum displays
- Game-like graphics in terminal
