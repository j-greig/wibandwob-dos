# SDK Composition Helpers

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
