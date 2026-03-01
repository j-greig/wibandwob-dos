# PRD 019: Context-Sensitive Menu Bar (macOS-Style)

Status: draft
GitHub issue: —
PR: —

## Origin

User prompt:

> wanna plan a refactor of menu commands for the ts-tui-mvp to make more
> like macos eg the file edit menu for an app is different from if you are
> in the tui 'finder' / base desktop state eg with no apps open, or with
> no app windows selected or with the bg in 'focus'. so we'd need a menu
> registry for each app what are canon ways to describe and register and
> build such a setup?

## Problem

The menu bar is static. Every command is dumped into File/Edit/View/Window/Tools
regardless of what is focused. An editor window shows "Backrooms TV" in Tools.
A terminal window shows "Save" in File. The Chrome browser has no Navigate menu.
The desktop shows editor commands when no editor is open.

macOS does not work this way. The menu bar belongs to the focused application.
TextEdit gets Format. Finder gets Go. Safari gets Bookmarks. When nothing is
focused you get the desktop/Finder menus. Some menus are always present (the
app menu, Window) but their contents change.

The current spike has a good command catalog and registry, but no concept of
command context. Every command is globally visible at all times.

## Prior Art Survey

### macOS (NSMenu / NSMenuItem)

The canonical desktop model. Each NSResponder (view, window, app) contributes
to the menu bar via the responder chain. Key patterns:

- Menu bar is rebuilt when the key window changes
- `validateMenuItem:` enables/disables items dynamically
- The Application menu and Window menu are always present
- Each document type brings its own menus (Format for rich text, etc.)
- Menu items have `target-action` pairs; the responder chain finds the handler

### Turbo Vision (TMenuBar + TView command sets)

The direct ancestor of WibWob-DOS. Each TView declares which commands it
handles. The menu bar rebuilds from the focused view's command set. Turbo
Vision uses integer command constants and `cmXxx` ranges per view type.
Commands not handled by the focused view are disabled or hidden.

### VS Code (contribution points + when clauses)

Extensions declare menu contributions with `"when"` conditions:

```json
{
  "command": "editor.action.formatDocument",
  "when": "editorTextFocus && !editorReadonly"
}
```

The menu system evaluates `when` expressions against a context key service.
Context keys are set/cleared as focus changes. This is the most dynamic
model but also the most complex.

### Emacs (major-mode keymaps)

Each buffer has a major mode. The major mode defines its own keymap which
shadows the global keymap. Mode-specific menus appear in the menu bar.
Switching buffers switches the active keymap and menu set.

### pi-mono (no menus, but relevant patterns)

Pi has no menu bar — it is a single-pane chat TUI. But its architecture
contains several patterns directly relevant to this refactor:

**Action-first keybindings.** Pi defines keybindings as action-to-key
mappings, not key-to-action. You check `kb.matches(data, "interrupt")`
rather than testing for escape directly. This decouples the action
vocabulary from the physical keys and makes rebinding trivial.
`EditorAction` is a ~30-member string union; `AppAction` is a ~20-member
union layered on top. Our spike should adopt this for the window-kind
action vocabulary.

**Component-owns-its-input.** Each pi component implements `handleInput()`
and handles its own keys internally. The TUI routes all input to whoever
is focused. There is no central switch statement dispatching keys to
windows. Our spike partially does this (terminal windows handle their own
keypresses) but the editor keypress handler still lives in app-controller.
The menu refactor is a good moment to push input handling into window
factories.

**Extension tool registration: factory + schema + execute.** Pi tools are
plain objects `{ name, label, description, parameters: TSchema, execute }`.
No class hierarchy. Factory functions create configured instances:
`createReadTool(cwd, options)`. Pluggable operation interfaces
(`ReadOperations`, `BashOperations`) swap backends without touching tool
logic. Our agent tools already follow this pattern. The menu commands
should follow it too — a command is data, not a method on a god object.

**Interception via wrapping, not subclassing.** Pi's extension seam is
`wrapToolWithExtensions()` which wraps every tool with pre/post event
emission. Extensions observe, block, or modify tool calls without
touching tool implementations. For our menu system, this suggests the
right extensibility seam is event-based (onBeforeMenuRebuild,
onCommandExecute) rather than subclass-based.

**Two-phase initialization.** Pi extensions register during factory
execution (stubs only), then `runner.bindCore()` replaces stubs with
real implementations. Our menu providers could follow the same pattern:
register metadata at window creation time, bind actions when the window
gains focus.

**Deferred binding pattern.** `extensionRunnerRef: { current?: }` avoids
circular dependency. Our command registry already has a similar shape
(catalog is data, registry binds actions). The context-sensitive layer
should extend this, not create a parallel system.

**Typed event bus.** Pi uses discriminated unions for events with typed
overloads per event type. If we add menu lifecycle events (rebuild,
validate, execute), they should follow this pattern.

**Render batching.** Pi's `requestRender()` coalesces to next tick. Our
menu rebuild on focus change should be similarly batched — focus can
change rapidly during drag or tab cycling.

## Design

### Core Concept: CommandContext

Every command in the catalog gains a `context` field declaring when it
should be visible:

```typescript
type CommandContext =
  | { type: "always" }              // quit, tile, cascade
  | { type: "desktop" }             // open new windows, browse primers
  | { type: "focused-any" }         // close window, focus next/prev
  | { type: "window"; kinds: WindowKind[] }  // save (editor), reload (browser)
```

### Core Concept: MenuContribution

Window kinds can contribute entirely new menu categories:

```typescript
interface MenuContribution {
  /** Top-level menu label. Merged if it matches an existing category. */
  category: string;
  /** Keyboard accelerator for the menu. */
  key?: string;
  /** Items contributed by this window kind. */
  items: Array<{
    id: string;
    label: string;
    order: number;
    enabled?: () => boolean;
  }>;
}
```

### Core Concept: MenuProvider

Each window kind declares what it contributes to the menu bar:

```typescript
interface MenuProvider {
  /** Window kinds this provider handles. Empty array = desktop context. */
  kinds: WindowKind[];
  /** Static menu contributions for this context. */
  contributions: MenuContribution[];
}
```

Providers are registered once at startup. The menu system queries them
on focus change.

### Menu Rebuild Flow

```
focus changes → get focused WindowKind (or null for desktop)
  → filter catalog commands by CommandContext
  → collect MenuContributions from matching MenuProviders
  → merge contributions into menu categories
  → sort items by order within each category
  → rebuild menu bar widget content
  → apply enabled() checks for greyed-out items
```

This runs on every focus change. It is pure data filtering — no DOM,
no blessed widget creation, just array operations feeding into
`menuBar.setContent()`.

### What Changes Per Context

**Desktop (no window focused):**
```
File: Browse Primers, Open File Manager, Open Primer..., Open Text File...,
      New Text Buffer, Save Workspace..., Load Workspace..., Quit
View: Backrooms TV..., Gallery, Chrome Browser
Window: Tile, Cascade
Tools: All open-new-surface commands
```

**Editor focused:**
```
File: Save, Save As..., Close Window, Quit
Edit: (future: Undo, Redo, Cut, Copy, Paste)
Window: Tile, Cascade, Focus Next, Focus Previous
```

**Chrome Browser focused:**
```
File: Close Window, Quit
Navigate: Back, Forward, Reload, Go to URL..., Search...
Window: Tile, Cascade, Focus Next, Focus Previous
```

**Terminal focused:**
```
File: Close Window, Quit
Shell: Clear, Send Break (Ctrl-C), Send EOF (Ctrl-D)
Window: Tile, Cascade, Focus Next, Focus Previous
```

**Backrooms TV focused:**
```
File: Close Window, Quit
Backrooms: Restart, Change Theme...
Window: Tile, Cascade, Focus Next, Focus Previous
```

**Any other window focused (art, pattern, companion, etc.):**
```
File: Close Window, Quit
Window: Tile, Cascade, Focus Next, Focus Previous
```

### System vs Context Commands

Commands tagged `{ type: "always" }` appear in EVERY context:
- `app.quit` (File > Quit)
- `window.tile`, `window.cascade` (Window menu)

Commands tagged `{ type: "focused-any" }` appear when ANY window is focused:
- `window.close_focused`
- `window.focus_next`, `window.focus_previous`

Commands tagged `{ type: "desktop" }` appear ONLY when no window is focused
(or desktop background is clicked):
- All "Open..." commands
- Browse Primers
- Save/Load Workspace

Commands tagged `{ type: "window", kinds: ["editor"] }` appear ONLY when
an editor is focused:
- Save, Save As

### Impact on Existing Systems

**command-catalog.ts** — Add `context` field to `AppCommandDefinition`.
Tag all existing commands. No commands are removed, only filtered.

**command-registry.ts** — Add `buildMenusForContext(kind?: WindowKind)`.
The existing `buildMenus()` becomes `buildMenusForContext(undefined)`
(desktop context, shows everything tagged desktop or always).

**menu-overlay-manager.ts** — Call rebuild on focus change instead of
once at startup. Cache previous menu state to avoid redundant redraws.

**app-controller.ts** — Wire `windowManager.onFocusChange` to menu rebuild.
Move editor keypress handling into the editor window factory (aligns with
pi-mono's component-owns-its-input pattern).

**agent tools** — `tui_list_commands` gains an optional `context` parameter
so the agent can ask "what commands are available for the focused window?"

**control API** — `GET /commands/list` gains optional `?context=editor`
query parameter.

**context-menu-items.ts** — Can be replaced entirely. Context menus
for windows become "right-click shows the window-context menu items",
which is just the same filtered command set. Desktop right-click shows
the desktop-context commands.

### Patterns Borrowed from pi-mono

| Pattern | pi-mono source | Our adoption |
|---------|---------------|--------------|
| Action-first keybindings | `EditorAction` union + `matches()` | Define `WindowAction` unions per kind |
| Component-owns-input | `Component.handleInput()` | Push keypress handlers into window factories |
| Tool = data + execute | `AgentTool` interface | Command = data + context + action |
| Factory + operations DI | `createReadTool(cwd, ops)` | `createMenuProvider(kind, actions)` |
| Interception via wrapping | `wrapToolWithExtensions()` | Event-based menu lifecycle hooks |
| Typed event discriminants | `ExtensionEvent` union | `MenuEvent` union for rebuild/validate/execute |
| Render batching | `requestRender()` nextTick | Batch menu rebuilds on rapid focus changes |
| Two-phase init | Register stubs → bindCore() | Register providers → bind on focus |

## Implementation Plan

### Slice 1: CommandContext on catalog + rebuild-on-focus

- Add `context: CommandContext` to `AppCommandDefinition`
- Tag every existing command
- `CommandRegistry.buildMenusForContext(kind?: WindowKind)` filters
- Menu bar rebuilds on `windowManager` focus change callback
- No new commands, no new menu categories — just existing commands
  filtered properly
- Acceptance: editor focused hides "Browse Primers"; desktop focused
  hides "Save"

### Slice 2: Per-window-kind commands

- Add window-specific commands: editor (Save, Save As), browser (Back,
  Forward, Reload, Go to URL), terminal (Clear, Send Break)
- New `AppMenuActions` entries that operate on the focused window
- Commands only visible when their window kind is focused
- Acceptance: browser focused shows Navigate menu; editor focused shows
  Save in File; terminal focused shows Shell menu

### Slice 3: Dynamic menu categories via MenuProvider

- `MenuProvider` interface and registration
- Window factories register their providers at creation
- Menu category list changes on focus (Navigate, Shell, Format, Backrooms)
- Desktop context gets the full launcher menu set
- Acceptance: switching focus between editor, browser, terminal shows
  different menu categories in the bar

### Slice 4: Push input handling to windows

- Move editor keypress logic from app-controller into editor window factory
- Move terminal keypress logic similarly
- Each window kind handles its own keys via `handleInput()` on WindowRecord
- app-controller dispatches to focused window, not switch-on-kind
- Acceptance: removing the editor keypress handler from app-controller
  does not break editing

### Slice 5: Unify context menus

- Replace `context-menu-items.ts` with command registry queries
- Right-click on a window = show window-context commands
- Right-click on desktop = show desktop-context commands
- Acceptance: `context-menu-items.ts` deleted, all context menus
  generated from the command registry

## Non-Goals

- Full VS Code `when`-clause expression evaluation
- Extension/plugin system for third-party menu contributions
- Toolbar/ribbon UI (menus are enough for the terminal)
- Porting the pi-mono extension event bus wholesale

## Risks

- Menu rebuild on every focus change could flicker if not batched
- Dynamic menu categories change the menu bar width, which shifts
  accelerator positions — needs careful layout
- Agent tool `tui_list_commands` returning different results per context
  could confuse agents that cache command lists

## Testing

- AC-1: Desktop focused shows open/browse commands, no Save
  - Test: focus desktop, verify menu content via state inspector
- AC-2: Editor focused shows Save/Save As, no Browse Primers
  - Test: open editor, focus it, verify File menu
- AC-3: Browser focused shows Navigate menu with Back/Forward/Reload
  - Test: open chrome browser, focus it, verify Navigate appears
- AC-4: Terminal focused shows Shell menu with Clear/Break
  - Test: open terminal, focus it, verify Shell appears
- AC-5: Tab cycling rebuilds menus correctly each time
  - Test: open editor + browser + terminal, tab between them, verify
    menus change each time
- AC-6: Context menus match the current context
  - Test: right-click editor window, verify Save appears;
    right-click desktop, verify Open commands appear
- AC-7: Agent `tui_list_commands` respects context parameter
  - Test: call with context=editor, verify Save appears, Browse absent
