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

## Codex Review: Current-State Accuracy

The broad diagnosis is correct: the current menu bar is static and the command
catalog/registry already act as the single source of truth for menu + palette
projection.

Concrete corrections against the current code:

- `src/core/command-catalog.ts` currently defines exactly five top-level menu
  categories via `AppCommandCategory`:
  `file | edit | view | window | tools`.
- `src/core/command-registry.ts` currently exposes:
  `buildMenus()`, `buildPalette()`, `list(surface?)`, `run(id, args?)`, and
  `createMenuItems(ids)`. There is no context-aware menu builder yet.
- The menu bar is built once in `src/core/app-controller.ts` and passed once to
  `src/core/menu-overlay-manager.ts`. `MenuOverlayManager` does not currently
  support replacing the menu model after construction.
- Window focus commands are currently placed in the `Edit` menu, not `Window`:
  `window.focus_next`, `window.focus_previous`, `window.close_focused`.
- The current catalog already distinguishes some surfaces:
  `workspace.save` and `workspace.load` are palette-only, while
  `workspace.save_as` and `workspace.load_prompt` are the menu-visible file
  entries.
- The current window kind for the Chrome-style browser is `"browser"`, not
  `"chrome"`. The command id is `browser.open_chrome`.
- There is also a separate `"reader"` window kind and `reader.open` command.
  The PRD should keep those distinct.
- Current `WindowKind` values are:
  `primer`, `editor`, `terminal`, `backrooms`, `browser`, `art`, `gallery`,
  `reader`, `figlet`, `pattern`, `orbit`, `glitch`, `chat`, `companion`,
  `workspace`, `palette`, `inspector`.
- `tui_list_commands` and `GET /commands/list` currently support only a
  `surface` filter. They do not accept `context`.
- Context menus are still bespoke today in `src/core/context-menu-items.ts`.

One important edge-case correction: the current spike does not have a true
"desktop background focused while windows remain open" mode. Right-clicking the
desktop opens the system context menu, but normal desktop clicks do not clear
window focus. Today, "desktop context" effectively means "no focused window",
which mainly occurs when no windows are open or focus has not been restored yet.

## Menu Deduplication and Applications Menu

The current catalog proves the core problem: many launchers are defined once as
commands, but projected into multiple top-level menus via `menuPlacements[]`.
That flexibility is useful for context-sensitive menus, but it is currently
being used to multiply app launchers instead of consolidating them. The result
is the same app appearing in `File`, `Window`, and `Tools` with inconsistent
labels.

This PRD should explicitly adopt a deduplication rule:

- Each openable app or feature appears once in the menu bar in any given
  context.
- App launchers should not be repeated across `File`, `Window`, and `Tools`
  just because the catalog supports multiple placements.
- Context-specific menus should add local actions, not duplicate global app
  launchers.

### Applications Menu

When no app window is focused, or when the focused surface is the desktop /
Finder-style file manager context, the menu bar should include an
`Applications` top-level menu. This menu becomes the single canonical place for
launching windows and apps.

The `Applications` menu should contain all openable app/window commands that are
currently scattered across `File`, `Window`, and `Tools`.

Recommended contents from the current catalog:

- `chat.open_wibwob` -> `Open Wib&Wob Chat`
- `agent.open_wibwob` -> `Open Wib&Wob Agent`
- `companion.open` -> `Companion`
- `chat.open_transcript` -> `Chat Transcript`
- `figlet.open` -> `Open Figlet Banner`
- `file.open_art_window` / `art.open_window` -> normalize to one Art launcher
- `pattern.open` -> `Pattern Window`
- `orbit.open` -> `Orbit Window`
- `glitch.open` -> `Glitch FX`
- `gallery.open` -> `Open Gallery` or normalized `Primer Gallery`
- `file.open_file_manager` -> `Open File Manager`
- `reader.open` -> `Open Browser` or normalized `Browser Reader`
- `browser.open_chrome` -> `Open Chrome Browser`
- `backrooms.open_prompt` -> `Backrooms TV...`
- `terminal.open_legacy` -> `Open Terminal`
- `terminal.open_xterm` -> `Open XTerm Shell`
- `terminal.open_pi_legacy` -> `Open Pi Terminal (Legacy)`
- `inspector.open` -> `Open State Inspector`
- `workspace.open_manager` -> `Workspace Manager`

Two viable ordering schemes are acceptable:

- Alphabetical A-Z for the entire menu. This is the simplest and most
  predictable first slice.
- Grouped sections for readability:
  `Communication`, `Creative`, `Browsing`, `System`.

If grouped, the current catalog maps cleanly as follows:

- `Communication`: `chat.open_wibwob`, `agent.open_wibwob`,
  `companion.open`, `chat.open_transcript`
- `Creative`: `figlet.open`, normalized Art launcher, `pattern.open`,
  `orbit.open`, `glitch.open`
- `Browsing`: `gallery.open`, `file.open_file_manager`, `reader.open`,
  `browser.open_chrome`, `backrooms.open_prompt`
- `System`: `terminal.open_legacy`, `terminal.open_xterm`,
  `terminal.open_pi_legacy`, `inspector.open`, `workspace.open_manager`

Alphabetical should be the default implementation target unless grouped sections
materially improve usability without adding special-case branching.

### File Menu Simplification

The `File` menu should be reduced to file and workspace lifecycle actions only:

- `file.new_text_buffer`
- `file.open_text_file_prompt`
- `file.open_primer_prompt`
- `file.save`
- `file.save_as`
- `workspace.save_as`
- `workspace.load_prompt`
- `app.quit`

Commands that should move out of `File` and into `Applications`:

- `file.open_file_manager`
- `file.open_art_window`
- `terminal.open_legacy`
- `terminal.open_xterm`
- `browser.open_chrome`
- `chat.open_wibwob`
- `agent.open_wibwob`
- `terminal.open_pi_legacy`

`file.browse_primers` needs a product decision. If it is treated as a document
open flow, it can remain in `File`. If it is treated as launching the gallery,
it should collapse into the `Applications` entry for `gallery.open`. The
important part is to avoid keeping both as overlapping primer-launch affordances
without a sharper distinction.

### Window and Tools Simplification

`Window` should contain window-management actions, not app launchers:

- `window.tile`
- `window.cascade`
- `window.focus_next`
- `window.focus_previous`
- `window.close_focused`

This also corrects the current mismatch where focus commands live under `Edit`.

`Tools` should stop acting as a second application launcher. It should be
reserved for global utilities that are not best understood as apps, or be
replaced contextually by app-specific menus.

From the current catalog, these commands should move out of `Tools` and into
`Applications`:

- `backrooms.open_prompt`
- `gallery.open`
- `file.open_file_manager`
- `reader.open`
- `browser.open_chrome`
- `figlet.open`
- `pattern.open`
- `orbit.open`
- `glitch.open`
- `chat.open_transcript`
- `chat.open_wibwob`
- `agent.open_wibwob`
- `companion.open`
- `workspace.open_manager`
- `terminal.open_xterm`
- `terminal.open_pi_legacy`
- `inspector.open`

`palette.open` is the clearest candidate to remain in `Tools` as a true utility
rather than an app launcher.

### Context Menus Replace Scatter

Once app launchers are centralized in `Applications`, context-sensitive menus
can become meaningfully local:

- Editor focus: `Edit` contains text editing actions and `File` keeps save/open
  flows relevant to the editor.
- Terminal focus: a `Shell` menu appears with terminal/session actions.
- Browser focus: a `Navigate` menu appears with browser navigation actions.
- Desktop or Finder-style focus: `Applications` is present and acts as the main
  launcher surface.

The key rule is that context menus should contribute commands that are specific
to the focused window kind. They should not re-add launchers already available
from `Applications`.

### Label Normalization

Deduplication will work better if labels are normalized while commands move:

- Prefer one canonical launcher label per app.
- Avoid one menu saying `Open Chrome Browser` while another says
  `Chrome Browser`.
- Avoid one menu saying `Open Browser` while another says `Browser Reader`
  unless those are intentionally distinct apps.
- Avoid having both `file.open_art_window` and `art.open_window` surface as
  parallel user-facing ways to open the same thing.

This implies a small follow-up audit of the catalog so each app has:

- one canonical command id for launching when possible
- one canonical user-facing label
- one canonical menu home in desktop/base contexts

The menu registry can still support multiple `menuPlacements[]`, but the PRD
should treat that as an escape hatch for true context-specific projection, not
as the default mechanism for global launcher duplication.

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

## Codex Review: Architectural Alignment

The direction aligns with the existing catalog/registry pattern only if context
stays in the same source of truth as the current command metadata.

What aligns well:

- Extending `AppCommandDefinition` with context metadata is consistent with the
  current "define once, project many times" pattern in
  `src/core/command-catalog.ts`.
- Adding context-aware projections to `CommandRegistry` is consistent with its
  current role as the execution/projection adapter.
- Reusing the same filtered command set for context menus, control API, and
  agent tooling matches the architecture invariant that user-visible surfaces
  must remain API-visible.

What does not currently align:

- Registering `MenuProvider`s from window factories at runtime would create a
  second command/menu definition path outside `command-catalog.ts`.
- Putting focus subscriptions or menu-provider APIs onto `WindowFacade` would
  widen a deliberately small cross-system seam. `WindowFacade` is currently
  query + geometry + content only.
- Adding dynamic top-level menus in the first slice conflicts with today's
  static menu bar implementation:
  `MenuOverlayManager` stores `menus` as constructor state, click targets are
  bound once, and `app-controller.ts` binds fixed accelerators for
  `M-f`, `M-e`, `M-v`, `M-w`, and `M-t`.

The simplest correct first implementation is therefore:

1. Keep the top-level menu set static in slice 1.
2. Filter menu items by focused `WindowKind`.
3. Keep the command palette global at first, or add availability metadata
   without hiding commands.
4. Revisit dynamic top-level categories only after the filtered static menus
   prove the model.

That approach stays inside the current invariants in `spikes/ts-tui-mvp/AGENTS.md`:

- one source of truth per concern
- user-visible commands defined once
- no parallel systems
- app-controller coordinates, but catalog/registry own command metadata

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

## Codex Review: Concrete Design Adjustments

The PRD should tighten the proposed model in a few places so it matches the
current codebase:

- Prefer `menuContext` or `contexts` on `AppCommandDefinition` over a separate
  runtime `MenuProvider` registry for the first slice.
- Treat `"browser"` as the window kind name everywhere, not `"chrome"`.
- Treat `"reader"` separately from `"browser"`; both may want different menu
  visibility later.
- Treat desktop context as `focusedKind === undefined`, not "desktop background
  clicked", because that state does not currently exist.
- Keep the command palette behavior explicit. The current palette is generated
  from `palettePlacement`; the PRD should state whether palette results remain
  global or become filtered.
- Keep keyboard shortcuts explicit. Menu visibility should not silently remove
  existing local shortcuts like browser `g/r/b/f` or global `C-s`.

Minimal type sketch aligned with current files:

```typescript
// src/core/command-catalog.ts
import type { WindowKind } from "./types.js";

export type CommandContext =
  | "always"
  | "desktop"
  | "focused-window"
  | WindowKind;

export interface AppCommandDefinition {
  id: string;
  label: string;
  group: AppCommandGroup;
  actionKey: keyof AppMenuActions;
  description?: string;
  menuPlacements?: MenuPlacement[];
  palettePlacement?: PalettePlacement;
  menuContexts?: CommandContext[]; // new
  api?: boolean;
  agent?: boolean;
}
```

```typescript
// src/core/command-registry.ts
import type { WindowKind } from "./types.js";

export interface CommandQueryContext {
  focusedKind?: WindowKind;
}

function matchesContext(
  command: AppCommandDescriptor,
  focusedKind?: WindowKind,
): boolean {
  const contexts = command.menuContexts ?? ["always"];
  return contexts.some((context) => {
    if (context === "always") return true;
    if (context === "desktop") return focusedKind === undefined;
    if (context === "focused-window") return focusedKind !== undefined;
    return context === focusedKind;
  });
}
```

```typescript
// src/core/command-registry.ts
buildMenusForContext(context: CommandQueryContext = {}): MenuConfig[] {
  return createMenuConfigsFromCatalog(this.actions, context);
}

list(surface?: CommandSurface, context?: CommandQueryContext): CommandListItem[] {
  return this.commands
    .filter((command) =>
      surface ? this.getSurfaces(command).includes(surface) : true)
    .filter((command) => matchesContext(command, context?.focusedKind))
    .map(...);
}
```

```typescript
// src/core/command-catalog.ts
export function createMenuConfigsFromCatalog(
  actions: AppMenuActions,
  context: CommandQueryContext = {},
): MenuConfig[] {
  return MENU_DEFINITIONS.map((menu) => ({
    ...menu,
    items: listAppCommands()
      .filter((command) => matchesContext(command, context.focusedKind))
      .flatMap(...)
  }));
}
```

If dynamic top-level categories are still desired later, prefer a static map
keyed by `WindowKind` in core command/menu code rather than per-window runtime
registration. That keeps command/menu structure declarative and discoverable.

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

## Codex Review: Minimal First Slice That Proves The Pattern

The current implementation plan can be simplified further for the first proof:

### Slice 1A: Filter existing static menus only

- Add `menuContexts` to `AppCommandDefinition`.
- Add `buildMenusForContext({ focusedKind })` to `CommandRegistry`.
- Add a mutable `setMenus()` or `replaceMenus()` path to
  `MenuOverlayManager`.
- In `app-controller.ts`, rebuild menus only when the focused window kind
  changes, not on every `WindowManager` change callback.
- Keep top-level categories fixed as `File/Edit/View/Window/Tools`.
- Keep `buildPalette()` unchanged for now.

Acceptance for this first slice:

- `editor` focus hides desktop-only launcher commands from `File`.
- `browser` focus hides `Save` and `Save As...`.
- no-window state shows launcher commands again.
- existing `M-f/M-e/M-v/M-w/M-t` accelerators still work.

Suggested controller sketch:

```typescript
// src/core/app-controller.ts
private lastMenuContextKind?: WindowKind;

private refreshMenusForFocus(): void {
  const focusedKind = this.windowManager.getFocusedWindow()?.kind;
  if (focusedKind === this.lastMenuContextKind) {
    return;
  }
  this.lastMenuContextKind = focusedKind;
  this.menuUi.setMenus(this.commands.buildMenusForContext({ focusedKind }));
}
```

This is preferable to rebuilding on every `WindowManager` mutation because the
current `onChange` callback also fires for drag, resize, close, and z-order
changes.

### Slice 1B: Unify context menus with the same filter

Do this before introducing new top-level menu categories. The current bespoke
`context-menu-items.ts` can be replaced by a thin adapter over:

```typescript
this.commands.createMenuItemsForContext(
  ["file.save", "file.save_as", "window.close_focused"],
  { focusedKind: window.kind },
);
```

That proves the context model across both menu bar and right-click menus
without introducing a second provider system.

### Slice 2: Add missing window-local command ids

Only after slice 1A/1B works:

- browser navigation commands
- xterm shell actions
- backrooms actions

Those actions do require additional controller/window wiring not yet described
in the original PRD, so they should be called out as new product work rather
than menu-only refactoring.

## Codex Review: Missing Edge Cases

The PRD should explicitly cover these cases:

- No focused window with windows still open:
  today this is not a normal steady state, so decide whether desktop menus
  should depend on `focusedKind === undefined` only, or whether desktop clicks
  should actively clear focus as part of this project.
- Menu/popup overlay open:
  keep menu context based on the underlying focused window; do not switch to an
  overlay-specific command context.
- Workspace restore:
  menus should refresh after `focusedWindow?.focus()` on restore, and also
  produce the desktop context when no snapshot restores focus.
- Palette window and workspace manager window:
  decide whether these internal/meta windows use generic window context or their
  own menu filtering.
- Browser vs reader:
  both are distinct window kinds today and should not be conflated.
- Shortcut collisions:
  context-sensitive visibility must not break existing direct shortcuts
  (`C-s`, `Tab`, `S-tab`, browser local keys, figlet local keys).
- Agent/API discoverability:
  if `listCommands()` becomes context-sensitive by default, callers may lose
  discoverability. Safer default is global list plus optional context filter.

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

## Codex Review: Additional Risks

- Dynamic top-level categories require new support in
  `src/core/menu-overlay-manager.ts`; today it cannot swap menu definitions or
  rebind menu hit targets after construction.
- Dynamic top-level categories also require rethinking fixed `left` positions
  in `MENU_DEFINITIONS` and fixed `M-f/M-e/M-v/M-w/M-t` bindings in
  `src/core/app-controller.ts`.
- Introducing runtime `MenuProvider` registration from window factories would
  split command/menu metadata across multiple places and conflict with the spike
  canon of one owner per concern.
- Filtering the command palette too aggressively would reduce discoverability
  and could regress agent/control workflows that currently treat the registry as
  a global command index.
- Adding browser/terminal/backrooms menu actions is not just presentation work;
  some actions need new focused-window execution paths that do not exist yet in
  `AppMenuActions`.

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

## Codex Review: Risks And Tests To Add

Additional tests worth making explicit:

- Menu rebuild stability:
  - Test: drag and resize the focused window and verify the menu model does not
    rebuild unless the focused kind changes.
- Static accelerator preservation:
  - Test: `M-f/M-e/M-v/M-w/M-t` still open the expected top-level menus after
    context filtering.
- Workspace restore menu state:
  - Test: save a workspace with an `editor` focused, restore it, and verify the
    menu reflects `editor` context immediately after restore.
- Browser vs reader separation:
  - Test: focus a `"browser"` window and a `"reader"` window in turn and verify
    only the intended context-specific commands appear.
- Context-menu parity:
  - Test: window right-click menu and top-bar menu expose the same context-valid
    actions for `editor` and `browser`.
- API default behavior:
  - Test: `GET /commands/list` with no context still returns the full registry
    unless the implementation intentionally changes that contract.
- Agent tool opt-in filtering:
  - Test: `tui_list_commands` without context remains backward-compatible; with
    context it filters deterministically.

Recommended wording adjustment for AC-1:

- Replace "desktop focused" with "no focused window" unless this project also
  adds an explicit desktop-focus state.
