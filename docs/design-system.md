# WibWob-DOS Terminal Design System

The UI component library lives in `src/ui/`. Microapp authors import via
`../../src/services/microapp-sdk.js`. Internal code imports from `src/ui/` directly
or via the backward-compatible `src/core/ui-parts.js` barrel.

## Directory Structure

```
src/ui/
  types.ts        — Rect, LayoutPart, FlexBasis, TrackSize, AxisAlign
  layout.ts       — Stack, Row, Grid, breakpoints, rect helpers
  chrome.ts       — HeaderBar, StatusBar, TextBlock, InputLine, Rule, etc.
  containers.ts   — ScrollViewport, BorderedPanel, Tabs, SidebarPanel, etc.
  data.ts         — KeyValuePanel, LogView, DataTable
  feedback.ts     — ProgressBar, Spinner, Toast
  forms.ts        — Button, Checkbox, RadioGroup, Select, FilterableList, etc.
  patterns.ts     — Pattern generators, data simulation, colour helpers
  index.ts        — barrel re-export
```

## Component Layers

| Layer | What | Example |
|-------|------|---------|
| **Tokens** | Theme semantic slots from `theme()` | `theme().body`, `theme().footer`, `theme().selected` |
| **Atoms** | Smallest rendered units | Text content, divider rules, spacers |
| **Molecules** | Single-purpose components | `createStatusBar`, `createTextViewer`, `createList` |
| **Organisms** | Multi-component compositions | `createSplitView`, `createTabs`, `createSidebarPanel` |
| **Layouts** | Positioning engines | `createStack`, `createRow`, `createGrid` |
| **Patterns** | Visual fill generators | `patternBlockGradient`, `PATTERNS` array |

## Two API Families

### Handle API (SDK — for microapp authors)

Self-positioning components that attach to a parent. Simpler, fewer concepts.

```typescript
import { createSimpleStatusBar, createTextViewer } from "../../src/services/microapp-sdk.js";

const viewer = createTextViewer(win.body, { content: "Hello", bottomOffset: 1 });
const status = createSimpleStatusBar(win.body, { left: " Title" });

viewer.update({ content: "New text" });
status.update({ left: " Updated" });
viewer.destroy();
```

**Convention:**
- Constructor: `create<Component>(parent, opts?)`
- Returns: `{ element, update(partial), destroy() }`
- Options type: `<Component>Options`
- Handle type: `<Component>Handle`

**Available:** `createSimpleStatusBar`, `createTextViewer`, `createListPanel`,
`createSplitView`, `createSimpleButtonBar`

### LayoutPart API (internal — for shell/window code)

Rect-driven components used by the layout engine. More powerful, more ceremony.

```typescript
import { createStack, createHeaderBar, createStatusBar } from "../ui/layout.js";

const header = createHeaderBar(body);
const status = createStatusBar(body);
const stack = createStack(body, [
  { key: "header", basis: 1, part: header },
  { key: "content", basis: "1fr", part: contentPart },
  { key: "status", basis: 1, part: status },
]);
stack.layout({ top: 0, left: 0, width: 80, height: 24 });
header.update({ left: "Title", right: "Status" });
```

**Convention:**
- Constructor: `create<Component>(parent, opts?)`
- Returns: `LayoutPart<Props>` with `{ node, layout(rect), update(props), restyle(), destroy() }`
- Used with `createStack`/`createRow`/`createGrid` for rect-driven layout

### When to Use Which

| Building... | Use |
|-------------|-----|
| A microapp | Handle API via `microapp-sdk.js` |
| A shell window in `src/windows/` | LayoutPart API via `src/ui/` |
| An SDK composition helper | LayoutPart internally, expose Handle externally |

## Naming Rules

| Pattern | Convention | Example |
|---------|-----------|---------|
| Constructor | `create<Component>` | `createStatusBar`, `createGrid` |
| Options type | `<Component>Options` | `StatusBarOptions`, `GridOptions` |
| Handle type | `<Component>Handle` | `StatusBarHandle`, `GridHandle` |
| Update method | `update(props)` | Always partial props |
| Read state | `get<Property>()` | `getSelected()`, `getContent()` |
| Events | `on<Event>(cb)` | `onSelect(cb)`, `onChange(cb)` |
| Cleanup | `destroy()` | Releases nodes, timers, listeners |
| Restyle | `restyle()` | Re-apply theme tokens |

## Theme Tokens

All components use `theme()` from `src/core/theme/resolver.js`. Key semantic slots:

| Token | Use |
|-------|-----|
| `body` | Default content area fg/bg |
| `bodyAlt` | Alternate content area |
| `header` | Header bars, toolbars |
| `footer` | Status bars |
| `selected` | Selection highlight |
| `accent` | Emphasis, active indicators |
| `muted` | Disabled, secondary text |
| `scrollbar` | Scrollbar fg/bg/track |

## Migration Path

The long-term goal is to converge on the Handle API for all SDK-facing components.
The LayoutPart API remains for internal layout engine use. Steps:

1. ✅ Handle API exists (B02 composition helpers)
2. ✅ `src/ui/` directory structure established (B06)
3. ✅ Design system documented
4. **Next:** Add `restyle()` to Handle API components
5. **Next:** Create Handle versions of remaining LayoutPart components
6. **Next:** Deprecate `createSimple*` prefix once old LayoutPart names are internal-only
