# Microapp Guide

> Architecture + COAT principle: `ARCHITECTURE.md` · SDK stability tiers: `ARCHITECTURE.md §SDK`

Scaffold, implement, verify. Under 60 seconds to a working microapp.

---

## 1. Quick start

```bash
bash scripts/scaffold-microapp.sh microapps/<name> wibwob.<id> "<Title>" <menuOrder>
```

Then register in `src/core/microapp-registry.ts` → `REGISTRY` (**required — the microapp won't appear otherwise**):

```typescript
import { MyMicroapp } from "../../microapps/my-microapp/index.js";
// Add to REGISTRY array:
{ tier: "core", factory: () => new MyMicroapp() }
// Tiers: core = menu + API visible · beta = API only · internal = host-only · disabled = off
```

**Core imports** — everything from one place:

```typescript
import {
  MicroappHost, MicroappWindowHandle,
  createStack, createRow, createHeaderBar, createStatusBar, createButtonBar,
  createTextViewer, createListPanel, createSplitView, createScrollView,
  createLazyMountedPlayer, createAnimationClock,
  renderFiglet, renderMarkdown, highlightCode,
} from "../../src/services/microapp-sdk.js";
```

**Minimal `setup(host)` with required hooks:**

```typescript
export function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open", label: "Open My App",
    menu: { label: "My App", group: "apps", order: 50 },
    action: () => {
      const win = host.createWindow({ title: "My App", width: 80, height: 24 });

      win.describeState(() => ({ summary: "my-app open" }));
      win.captureText(() => "content text for agents");
      win.onCleanup(() => { /* stop timers */ });
      win.onRestyle(() => { /* re-apply host.theme() colours */ });
    }
  });
}
```

**Verify:**

```bash
bash scripts/reload-microapp.sh <id>       # hot reload
bun run wibwob -i <label> cmd wibwob.<id>.open
bun run wibwob -i <label> read <windowId>  # agent sees meaningful text
```

**Persistence** — add to `setup()` if the user should survive restarts:

```typescript
let state = { mode: "default" };
host.registerSnapshot({
  serialize: () => state,
  restore: (saved) => { state = saved; }
});
```

---

## 2. Examples by complexity

| Level | Microapp | What it shows |
|-------|----------|---------------|
| 1 — Static | `microapps/demo-hello-world/` | Minimal setup, describeState |
| 2 — Animated | `microapps/demo-wibwob-tidepool/` | Animation clock, canvas |
| 3 — Persistent + AI | `microapps/demo-wibwob-poetry-clock/` | Snapshot, agent integration |
| 4 — SDK sampler | `microapps/demo-e026-demo/` | All public components |
| 4b — Runtime utility | `microapps/command-lab/` | Command registration patterns |
| 4c — Inspection | `microapps/runtime-inspector/` | describeState, captureText depth |

---

## 3. SDK reference

> Exhaustive per-method API: source JSDoc in `src/services/microapp-sdk.ts`.
> This section covers what to reach for and when.

### Component families

Tiers match JSDoc tags. Prefer `@public` → `@beta` → reach for `@internal` only when no higher-tier primitive fits.

| Tier | Family | Key exports |
|------|--------|-------------|
| `@public` | **Composition** | `createHeaderBar`, `createStatusBar`, `createButtonBar`, `createTabs`, `createInputLine`, `createRule`, `createTextViewer`, `createListPanel`, `createSplitView`, `createScrollView`, `createCanvas` |
| `@public` | **Animation** | `createLazyMountedPlayer` |
| `@public` | **Runtime / diagnostics** | `createAnimationClock`, `createLayoutReporter`, `fetchRuntimeHealth`, `fetchRuntimeInspection`, `fetchRuntimeCommands`, `getRuntimeControlApiBaseUrl` |
| `@public` | **Syntax highlighting** | `highlightCode`, `HIGHLIGHTED_LANGUAGES` |
| `@beta` | **Grid canvas** | `blankGrid`, `paintText`, `paintCentered`, `paintLines`, `drawArrow`, `gridToText`, `waveLine`, `bar` |
| `@beta` | **ASCII composition** | `composeAsciiLayers`, `renderAsciiTextBlock` |
| `@beta` | **Text rendering** | `renderFiglet`, `responsiveFiglet`, `renderMarkdown`, `renderMarkdownFile` |
| `@beta` | **Empty states** | `EMPTY_PRIMER_SELECTED`, `EMPTY_FILE_SELECTED`, `EMPTY_NO_MESSAGE` |
| `@internal` | **Layout primitives** | `createStack`, `createRow`, `createGrid`, `createNodePart`, `pickBreakpoint`, `createScrollViewport` |
| `@internal` | **Forms** | `createButton`, `createCheckbox`, `createToggleSwitch`, `createRadioGroup`, `createSelect`, `createSegmentedControl`, `createFilterableList`, `createTextArea` |
| `@internal` | **Data display** | `createKeyValuePanel`, `createLogView`, `createDataTable` |
| `@internal` | **Feedback** | `createProgressBar`, `createSpinner`, `createToast` |

**Advanced components** (source-level only, no SDK re-export):
`TreeWidget` (`src/ui/molecules/tree-widget.ts`) · `TabbedContainer` (`src/ui/organisms/tabbed-container.ts`) · `RenderMonitor` (`src/ui/data/render-monitor.ts`)

### MicroappHost API (key methods)

```typescript
host.createWindow({ title, width?, height?, left?, top? })  // → MicroappWindowHandle
host.registerCommand({ id, label, description?, action, menu?, palette?, direct? })
host.registerSnapshot({ serialize, restore })       // workspace persistence
host.runGlobalCommand("markdown.open", { filePath })
host.screen                   // blessed screen — call .render() after changes
host.geometry                 // { width, height, cellAspect }
host.theme()                  // ThemeTokens — call fresh each time, never cache
host.repoRoot                 // absolute path to repo root
host.pickFile(label, startDir, onSelect, opts?)
host.flash(message)
host.promptValue(label, default, onSubmit)
host.focusOrCreate(appType, createFn, multiInstance?)
host.windows.{moveWindow, resizeWindow, focusWindow, closeWindow}(id, ...)
host.ui.{createStack, createRow, createHeaderBar, createStatusBar, createButtonBar, applyRect}
```

**`direct` flag:** bypasses `focusOrCreate` — use for toggle/query commands that must always fire.

### MicroappWindowHandle API

```typescript
win.id              // window id (number)
win.body            // blessed BoxElement — parent all widgets here
win.focus() · win.close() · win.setFocusTarget(widget) · win.setTitle(title)

// Required hooks:
win.describeState(fn)   // () => { summary, ...extras }   ← agents read this
win.captureText(fn)     // () => string                   ← agents capture this
win.onCleanup(fn)       // stop timers, destroy resources
win.onRestyle(fn)       // re-apply host.theme()           ← required for theme switching

// Optional hooks:
win.onResize(fn)        // window resized
win.onInput(fn)         // (input: string) => void — from control API writeInput
```

### Theme tokens

```typescript
const t = host.theme();   // always call fresh
t.body                    // { fg, bg }
t.selected                // { fg, bg }
t.muted                   // { fg }
t.titleBarFocused         // { fg, bg }
t.titleBarUnfocused       // { fg, bg }
t.windowBorderFocused     // { fg }
t.windowBorderUnfocused   // { fg }
```

### Component contract (guarantees for all `create*` functions)

Every SDK component returns `{ node: BlessedElement, destroy() }`. Lifecycle: call `destroy()` in `onCleanup`. Re-apply theme in `onRestyle`. For components with focus state, connect `setFocusTarget`. Disabled state: pass `disabled: true` in options — component blocks interaction and dims visually. Event payloads arrive synchronously. See source JSDoc for full per-component options.

---

## 4. Layout

Two primitives: **flex** (stack/row) and **grid**. Everything else composes from them.

### Flex

```typescript
import { createStack, createRow, createNodePart } from "../../src/services/microapp-sdk.js";

// Vertical stack
const { node: container, layout } = createStack(parent, {
  top: 0, left: 0, width: "100%", height: "100%",
  children: [
    { part: createNodePart(headerNode), size: 3, fixed: true },
    { part: createNodePart(bodyNode), size: 1, grow: true },
    { part: createNodePart(footerNode), size: 1, fixed: true },
  ]
});

// Horizontal row — same API, horizontal axis
const { node: row } = createRow(parent, { children: [...] });

// Re-layout on resize:
win.onResize(() => layout.reflow());
```

**FlexChild shape:** `{ part, size, fixed?, grow?, shrink? }` — `fixed: true` + `size: N` = fixed lines; `grow: true` = takes remaining space; `shrink: true` = can compress below nominal.

**Best practices:** header/footer fixed + body grow; always call `layout.reflow()` on resize; use `applyRect` for nested nodes.

### Grid

```typescript
import { createGrid } from "../../src/services/microapp-sdk.js";

const { node, layout } = createGrid(parent, {
  top: 0, left: 0, width: "100%", height: "100%",
  columns: ["50%", "50%"],
  rows: ["auto", 1],
  gap: { col: 1, row: 0 },
  children: [
    { part: createNodePart(left), col: 0, row: 0 },
    { part: createNodePart(right), col: 1, row: 0, rowSpan: 2 },
  ]
});
```

Track sizes: `"auto"` = equal share · `N` = fixed lines · `"N%"` = percentage.

### Responsive

```typescript
import { pickBreakpoint } from "../../src/services/microapp-sdk.js";

const layout = pickBreakpoint(win.body.width, [
  { minWidth: 0,   value: "narrow" },
  { minWidth: 80,  value: "normal" },
  { minWidth: 120, value: "wide" },
]);
// Stack and scroll before crushing — don't hide content at narrow widths
```

### Scroll viewport

```typescript
import { createScrollViewport } from "../../src/services/microapp-sdk.js";

const vp = createScrollViewport(parent, {
  top: headerHeight, height: bodyHeight, width: "100%",
  // optional fixed header/footer nodes
});
vp.scrollTo(line);
vp.getScrollOffset();
```

---

## 5. Pitfalls

| Category | Mistake | What happens | Fix |
|----------|---------|--------------|-----|
| **Lifecycle** | Skip `onCleanup` | Timers fire into dead window | Always register |
| **Lifecycle** | Skip `onRestyle` | Window keeps old theme colours | Re-apply `host.theme()` to every coloured node |
| **Lifecycle** | Skip `describeState` | Agents can't inspect window | Return `{ summary, ...extras }` |
| **Lifecycle** | Skip `captureText` | `wibwob read <id>` returns nothing | Return meaningful string |
| **Timers** | `setInterval` without `onCleanup` | Timer runs forever | `clearInterval` in cleanup |
| **Timers** | Re-register on every render | Hundreds of intervals | Create once, store ref |
| **Motion** | Start tween before `describeState` | Host can't track animation | Register hooks first |
| **Motion** | Tween without cleanup | Tween continues after close | Cancel in `onCleanup` |
| **Widget** | Parent to `host.screen` | Widget escapes window bounds | Parent to `win.body` |
| **Widget** | Nested lists without focus guard | Input captured by wrong widget | Use `setFocusTarget` |
| **Theme** | Inline blessed style literals | Breaks on theme switch | Use `host.theme()` tokens |
| **Theme** | Cache `host.theme()` result | Stale colours after switch | Call fresh in `onRestyle` |
| **Commands** | Use full id in `runCommand` | Command not found | Omit microapp prefix — `"open"` not `"wibwob.myapp.open"` |
| **Commands** | Register commands outside `setup()` | Missed in palette | Register sync in setup |
| **Imports** | Import from `src/core/` directly | COAT violation, breaks microapp isolation | Only import from `microapp-sdk.js` |
| **Persistence** | Access saved state before `restore` | Stale / undefined | Use snapshot callback, not module-level init |
