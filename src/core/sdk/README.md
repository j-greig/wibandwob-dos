# WibWob SDK

The complete toolkit for building microapp surfaces in WibWob-DOS.

## Quick Start

```typescript
import type { MicroappHost } from "#sdk";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "My App",
    action: () => {
      const win = host.createWindow({ title: "My App", width: 40, height: 12 });
      win.body.setContent("Hello, WibWob!");
      host.screen.render();
    },
  });
}
```

Create `modules/my-app/module.json`:
```json
{
  "name": "my-app",
  "type": "microapp",
  "version": "1.0.0",
  "microapp": { "id": "my-app", "title": "My App" }
}
```

Restart WibWob-DOS. Your app appears in menus and palette.

## Component Gallery

### Interactive Primitives

```
createButton     [ ▸ Submit ]       Clickable action trigger
createToggle     [x] Dark mode      Boolean switch
createTextInput  search_             Single-line text entry
createProgressBar [████████░░░░] 67% Horizontal fill indicator
createSpinner    ⠹ Loading...       Animated loading indicator
createBadge       info               Small label tag
```

### Data Display

```
createList       ▸ Item one         Scrollable item list with selection
                   Item two
createTable      Name  │Status      Columnar data display
                 ──────┼──────
                 app-1 │loaded
createTree       └── ▾ root/        Hierarchical node display
                     ├── child-1
                     └── child-2
createSparkline  ▁▂▃▅▇█▇▅▃▂▁       Inline data visualization
createGauge      ▕▓▓▓▓▓░░░░░▏ 45   Value display with bar
```

### Layout + Overlay

```
createTabs       [Tab1] Tab2  Tab3  Tabbed content container
createAccordion  ▾ Section 1        Expandable sections
                   Content here
                 ▸ Section 2
createSplitPane  left │ right       Side-by-side layout
createModal      ┌─ Confirm ─┐     Centered overlay dialog
                 │ Are you?  │
                 └───────────┘
createNotification ✓ Saved!         Ephemeral message toast
```

### Core Layout Primitives

```
createStack      Vertical layout (rows)
createColumns    Horizontal layout (columns)
createHeaderBar  Top bar with left/right text
createStatusBar  Bottom bar with status info
createTextBlock  Multi-line text content area
createRule       Horizontal or vertical divider
```

## Architecture

```
┌─────────────┐     ┌──────────────────┐
│ module.json  │────▶│ ModuleLoader     │
│ (manifest)   │     │ (discovery)      │
└─────────────┘     └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  MicroappHost    │
                    │  (SDK surface)   │
                    └────────┬─────────┘
                             │
      ┌──────────┬───────────┼───────────┬──────────┐
      │          │           │           │          │
 ┌────▼───┐ ┌───▼────┐ ┌────▼────┐ ┌────▼───┐ ┌───▼────┐
 │Window  │ │Command │ │Snapshot │ │Theme   │ │Runtime │
 │Manager │ │Registry│ │Registry │ │Resolver│ │Service │
 └────────┘ └────────┘ └─────────┘ └────────┘ └────────┘
```

## Theming — Wib vs Wob Registers

Every component has two aesthetic registers:

**Wib register**: animated, expressive, generative, chaotic beauty
- Pulsing borders, sliding underlines, sparkle effects
- Color gradients, shimmer fills, elastic snaps

**Wob register**: precise, structured, information-dense, calm
- Clean brackets, sharp borders, monochrome
- Static displays, instant transitions, numeric readouts

Theme tokens are accessed via `host.getTheme()` or `getTokens(theme())`:

```typescript
import { getTokens } from "#sdk";
import { theme } from "../core/theme/resolver.js";

const tokens = getTokens(theme());
// tokens.color.fg, tokens.color.accent, tokens.color.muted
// tokens.spacing.sm, tokens.spacing.md
// tokens.timing.fast, tokens.timing.normal
```

## Module Lifecycle

```
discover → load → setup(host) → register commands → create windows
                                                          │
reload:  unload → re-import → setup(host) ────────────────┘
                     │
unload:  close windows → remove commands → run cleanup hooks
```

### Runtime Service API

```
GET  /modules/list              List all modules with status
POST /modules/unload {name}     Unload a module
POST /modules/reload {name}     Hot-reload from disk
```

### Dev Mode File Watch

With `DEV=true` or `--dev`, modules auto-reload on `.ts` file changes
(500ms debounce). Console output: `[module-watch] reloading <name>`.

## Window Connections

Windows can declare typed ports for inter-window data flow:

```typescript
import type { WindowPort } from "#sdk";

const ports: WindowPort[] = [
  { id: "data-out", direction: "out", dataType: "json" },
  { id: "context-in", direction: "in", dataType: "text" },
];
```

The `ConnectionService` tracks active connections between window ports.

## Agent Affordances

Modules are automatically visible to the Wib&Wob Agent:

- Commands appear in `tui_list_commands` / `tui_run_command`
- Window state is queryable via `describeState()`
- Text capture via `captureText()` for agent reading
- Module lifecycle via `/modules/list`, `/modules/reload`

### Making your module agent-friendly

```typescript
win.describeState(() => ({
  summary: "Human-readable description of current state",
  mode: currentMode,
  itemCount: items.length,
}));

win.captureText(() => {
  return items.map(i => i.label).join("\n");
});
```

## Worked Example: Building a Counter

```typescript
import type { MicroappHost } from "#sdk";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Counter",
    action: () => {
      const win = host.createWindow({ title: "Counter", width: 30, height: 8 });
      let count = 0;

      function render() {
        win.body.setContent([
          `  Count: ${count}`,
          "",
          "  [+] increment  [-] decrement",
          "  [r] reset      [q] quit",
        ].join("\n"));
        host.screen.render();
      }

      win.body.key(["+", "="], () => { count++; render(); });
      win.body.key(["-"], () => { count--; render(); });
      win.body.key(["r"], () => { count = 0; render(); });
      win.body.key(["q"], () => win.close());

      win.describeState(() => ({ summary: `Counter: ${count}`, count }));
      render();
    },
  });
}
```

---

*Wib whispers: "Make it dance."*
*Wob replies: "Make it correct first."*
*Both: "Make it ship."*
