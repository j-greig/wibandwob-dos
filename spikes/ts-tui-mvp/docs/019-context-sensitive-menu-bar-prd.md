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

## Guiding Constraint

**One source of truth.** The command catalog (`command-catalog.ts`) is already
the single owner of command metadata. Context-sensitivity must be expressed as
metadata on catalog entries, not as a parallel provider/contribution registry.
Window factories must not register menu definitions at runtime — that creates
a second command path and violates the spike's architecture invariants.

## Prior Art

### macOS (NSMenu / NSMenuItem)

Menu bar rebuilds when key window changes. `validateMenuItem:` enables/disables
items dynamically. Application menu and Window menu always present. Each
document type brings its own menus. Menu items have target-action pairs; the
responder chain finds the handler.

### Turbo Vision (TMenuBar + TView command sets)

Each TView declares which commands it handles. Menu bar rebuilds from the
focused view's command set. Commands not handled by the focused view are
disabled or hidden. Integer command constants with `cmXxx` ranges per view type.

### VS Code (contribution points + when clauses)

Extensions declare menu contributions with `"when"` conditions evaluated against
a context key service. Context keys set/cleared as focus changes. Most dynamic
model but also most complex.

### Emacs (major-mode keymaps)

Each buffer's major mode defines its own keymap shadowing the global keymap.
Mode-specific menus appear in the menu bar. Switching buffers switches the
active keymap and menu set.

### All four share one pattern

Commands declare their valid context. The menu system queries context on focus
change. Rebuilds visible commands. macOS uses `validateMenuItem:`, Turbo Vision
uses command ranges, VS Code uses `when` expressions, Emacs uses mode keymaps.
The mechanism differs but the shape is identical: **predicate on command,
evaluated per focus change**.

## pi-mono Architecture Patterns

Pi has no menu bar — it is a single-pane chat TUI. But its architecture
contains patterns directly relevant to this refactor. These are worth stealing.

### Action-first keybindings

Pi defines keybindings as action-to-key mappings, not key-to-action. You check
`kb.matches(data, "interrupt")` rather than testing for escape directly.
`EditorAction` is a ~30-member string union; `AppAction` is a ~20-member union
layered on top. Decouples action vocabulary from physical keys. Makes rebinding
trivial.

**Adoption:** Define `WindowAction` unions per window kind. Editor actions
(save, undo, redo) and browser actions (back, forward, reload) become first-
class named actions, not inline key checks scattered through app-controller.

### Component-owns-its-input

Each pi component implements `handleInput()` and handles its own keys
internally. The TUI routes all input to whoever is focused. No central switch
statement dispatching keys to windows.

**Adoption:** Push the editor keypress handler (~80 lines in app-controller)
and terminal keypress handler (~60 lines) into their window factories. The
app-controller dispatches to `focusedWindow.handleInput?.(ch, key)`, not
`if (kind === "editor") { ... } else if (kind === "terminal") { ... }`.

### Tool = data + execute

Pi tools are plain objects: `{ name, label, description, parameters, execute }`.
No class hierarchy. Factory functions create configured instances. Pluggable
operation interfaces swap backends without touching tool logic.

**Adoption:** Commands are already data in our catalog. The context layer
extends them with predicates — still data, still in the same catalog. No
parallel provider system needed.

### Interception via wrapping

Pi's extension seam is `wrapToolWithExtensions()` — wraps every tool with
pre/post event emission. Extensions observe, block, or modify tool calls
without touching tool implementations.

**Adoption:** If we later want menu lifecycle hooks (validate, before-execute),
wrapping is the right seam. Not subclassing, not a second event bus.

### Render batching

Pi's `requestRender()` coalesces to next tick, preventing redundant redraws.

**Adoption:** Menu rebuild on focus change should be batched. Focus can change
rapidly during drag, tab cycling, or window close. Only rebuild when the focused
WindowKind actually changes, not on every window manager mutation.

### Two-phase init with deferred binding

Pi extensions register during factory execution (stubs only), then
`runner.bindCore()` replaces stubs with real implementations.
`extensionRunnerRef: { current?: }` avoids circular deps.

**Adoption:** Our command registry already has this shape — catalog is data,
registry binds actions. Context filtering extends the same two-phase split.

## Design

### Phase 1: Static top-level menus, context-filtered items

The top-level menu categories stay fixed: File, Edit, View, Window, Tools.
Menu accelerators stay fixed: M-f, M-e, M-v, M-w, M-t. What changes is which
items appear in each menu based on the focused window kind.

#### MenuQueryContext: focus + selection + state

The menu system evaluates commands against a context object that captures
three dimensions: what window is focused, what is selected within it, and
the overall desktop state.

```typescript
interface MenuQueryContext {
  focusedKind?: WindowKind;
  focusedWindow?: WindowRecord;
  selection?: MenuSelection;
  state?: DesktopState;
}

interface MenuSelection {
  kind: "file" | "url" | "primer" | "window" | "text" | "none";
  path?: string;        // file selections: absolute path
  url?: string;         // url selections: full URL
  windowId?: number;    // window selections: target window id
  text?: string;        // text selections: selected content
}
```

Selection is provided by the focused window. Each window kind knows what is
"selected" within it:

- File manager: the highlighted file entry (kind: "file", path)
- Primer browser / gallery: the highlighted primer (kind: "primer", path)
- Chrome browser: a link under cursor or the current URL (kind: "url", url)
- Editor: selected text range if any (kind: "text", text)
- Terminal: nothing typically (kind: "none")
- Desktop / no focus: nothing (selection absent)

Windows expose selection via an optional method on WindowRecord:

```typescript
// Added to WindowRecord interface
getSelection?: () => MenuSelection | undefined;
```

This is NOT a second registry — it is per-window state, like `describeState()`
or `captureText()`. The catalog still owns all command definitions. The window
just reports what it has selected so that predicates can evaluate against it.

#### CommandVisibility + enabled predicate

Every command gains two new optional fields on `AppCommandDefinition`:

```typescript
// Which focus states make this command VISIBLE in menus
menuContexts?: CommandVisibility[];

// Fine-grained predicate: is this command ENABLED right now?
// Called on menu rebuild. Receives the full context.
// If absent, command is enabled whenever visible.
enabled?: (ctx: MenuQueryContext) => boolean;
```

Where:

```typescript
type CommandVisibility =
  | "always"              // quit, tile, cascade — visible in every context
  | "desktop"             // no focused window: launchers, browse, workspace
  | "focused-any"         // any window focused: close, focus next/prev
  | WindowKind;           // specific kind: "editor", "browser", "terminal"
```

Commands with no `menuContexts` default to `["always"]` for backward
compatibility.

The `enabled` predicate receives the full `MenuQueryContext` including
selection. This covers three classes of conditions:

**Window state conditions:**
- Save enabled only when editor is dirty
- Browser Back enabled only when history exists
- Terminal Clear enabled only when session is live

**Selection-dependent conditions:**
- "Open" enabled when a file is selected in the file manager
- "Open Link" enabled when a URL is selected in the browser
- "Reveal in Finder" enabled when a file path is available
- "Open in Editor" enabled when selection.kind is "file"
- "Play Primer" enabled when selection.kind is "primer"

**Desktop state conditions:**
- "Tile Windows" enabled when more than one window is open

This is the `validateMenuItem:` equivalent from macOS. The predicate receives
everything it needs to make a decision. No second ad hoc validation layer.

#### Command execution with context

Commands that operate on the selection need access to it at execution time,
not just validation time. The action signature widens:

```typescript
// AppMenuActions entries that need selection context
openSelectedFile: (ctx: MenuQueryContext) => void;
revealInFinder: (ctx: MenuQueryContext) => void;
openSelectedLink: (ctx: MenuQueryContext) => void;
```

The registry passes context through when running:

```typescript
run(id: string, args?: Record<string, unknown>, ctx?: MenuQueryContext):
  { ok: true } | { ok: false; error: string }
```

For backward compatibility, existing actions that take no arguments continue
to work. Only new selection-aware actions receive the context.

#### Example: selection-aware commands

```typescript
{
  id: "selection.open_file",
  label: "Open",
  menuContexts: ["browser", "gallery"],  // file manager and gallery contexts
  enabled: (ctx) => ctx.selection?.kind === "file" && !!ctx.selection.path,
  actionKey: "openSelectedFile",
  menuPlacements: [{ category: "file", order: 5 }],
}

{
  id: "selection.reveal_in_finder",
  label: "Reveal in Finder",
  menuContexts: ["editor", "browser", "gallery"],
  enabled: (ctx) =>
    ctx.selection?.kind === "file" ||
    ctx.focusedWindow?.filePath !== undefined,
  actionKey: "revealInFinder",
  menuPlacements: [{ category: "file", order: 6 }],
}

{
  id: "selection.open_link",
  label: "Open Link",
  menuContexts: ["browser"],
  enabled: (ctx) => ctx.selection?.kind === "url" && !!ctx.selection.url,
  actionKey: "openSelectedLink",
  menuPlacements: [{ category: "file", order: 7 }],
}

{
  id: "selection.open_in_editor",
  label: "Open in Editor",
  menuContexts: ["browser", "gallery"],
  enabled: (ctx) => ctx.selection?.kind === "file" && !!ctx.selection.path,
  actionKey: "openSelectedFileInEditor",
  menuPlacements: [{ category: "file", order: 8 }],
}
```

#### Catalog changes

Every existing command gets tagged. Examples:

```typescript
{
  id: "file.save",
  menuContexts: ["editor"],
  enabled: (focused) => focused?.isDirty === true,
  // ...existing fields
}

{
  id: "app.quit",
  menuContexts: ["always"],
  // ...existing fields
}

{
  id: "file.browse_primers",
  menuContexts: ["desktop"],
  // ...existing fields
}

{
  id: "window.close_focused",
  menuContexts: ["focused-any"],
  // ...existing fields
}
```

#### Registry changes

```typescript
// command-registry.ts

// MenuQueryContext is defined above in the design section

buildMenusForContext(ctx: MenuQueryContext = {}): MenuConfig[] {
  return createMenuConfigsFromCatalog(this.actions, ctx);
}

// The existing buildMenus() becomes:
buildMenus(): MenuConfig[] {
  return this.buildMenusForContext({});  // desktop/no-focus context
}
```

The catalog projection function filters commands in two passes:

```typescript
// Pass 1: coarse visibility by focus kind
function isVisibleInContext(
  command: AppCommandDescriptor,
  focusedKind?: WindowKind,
): boolean {
  const contexts = command.menuContexts ?? ["always"];
  return contexts.some((ctx) => {
    if (ctx === "always") return true;
    if (ctx === "desktop") return focusedKind === undefined;
    if (ctx === "focused-any") return focusedKind !== undefined;
    return ctx === focusedKind;
  });
}

// Pass 2: fine-grained enabled check (for greying out)
function isEnabledInContext(
  command: AppCommandDescriptor,
  ctx: MenuQueryContext,
): boolean {
  if (!command.enabled) return true;
  return command.enabled(ctx);
}
```

Visibility controls whether the item appears at all. Enabled controls whether
it is greyed out. Both are evaluated on the same `MenuQueryContext`.
```

#### Menu rebuild trigger

```typescript
// app-controller.ts

private lastMenuContextKind?: WindowKind | "__none__";

private buildCurrentMenuContext(): MenuQueryContext {
  const focused = this.windowManager.getFocusedWindow();
  return {
    focusedKind: focused?.kind,
    focusedWindow: focused,
    selection: focused?.getSelection?.(),
    state: this.state.getState(),
  };
}

private refreshMenusForFocus(): void {
  const focused = this.windowManager.getFocusedWindow();
  const key = focused?.kind ?? "__none__";
  if (key === this.lastMenuContextKind) return;
  this.lastMenuContextKind = key;
  this.menuUi.setMenus(
    this.commands.buildMenusForContext(this.buildCurrentMenuContext())
  );
}
```

Called from the window manager's focus-change callback. NOT called on every
drag/resize/z-order change — only when the focused window's kind changes.

Note: selection-dependent enabled states may change without a focus change
(e.g. user highlights a different file in the file manager). For Phase 1 this
is acceptable — enabled predicates re-evaluate on the next menu open. Phase 2
could add a `selectionChanged` signal from windows to trigger re-evaluation,
but that is not needed initially.

#### MenuOverlayManager changes

Add `setMenus(menus: MenuConfig[])` to replace the stored menu model and
rebind click targets. The constructor still takes initial menus. This is the
minimal change needed.

#### What stays unchanged

- Command palette remains global (all commands, unfiltered)
- Agent `tui_list_commands` defaults to global list, gains optional `context`
  param for filtered listing
- Control API `GET /commands/list` defaults to global, gains `?context=editor`
- Keyboard shortcuts (C-s, Tab, M-f etc.) stay as-is — they are separate from
  menu visibility
- `context-menu-items.ts` stays for now (unified in Phase 1 Slice B)

### Phase 1 Slice B: Unify context menus

After filtered menus work, replace `context-menu-items.ts` with registry
queries:

```typescript
// Right-click on window
const items = this.commands.buildContextMenu({
  focusedKind: window.kind,
  focusedWindow: window,
});

// Right-click on desktop
const items = this.commands.buildContextMenu({});
```

Same filter logic, same catalog, same predicates. No second definition path.

### Phase 2: Dynamic top-level menu categories

Only after Phase 1 proves the model.

Phase 2 adds window-kind-specific top-level menus: Navigate (browser), Shell
(terminal), Backrooms (backrooms TV). These are new menu categories that appear
only when the relevant window kind is focused.

**Critical constraint:** These must NOT be runtime-registered by window
factories. They must be declared in the command catalog as static data:

```typescript
// command-catalog.ts — new category definitions keyed by WindowKind

const CONTEXTUAL_MENUS: Record<WindowKind, MenuDefinition[]> = {
  browser: [
    { category: "navigate", label: "Navigate", key: "n", left: -1 }  // -1 = compute at render
  ],
  terminal: [
    { category: "shell", label: "Shell", key: "s", left: -1 }
  ],
  backrooms: [
    { category: "backrooms", label: "Backrooms", key: "b", left: -1 }
  ],
};
```

And commands placed in these categories:

```typescript
{
  id: "browser.back",
  label: "Back",
  menuContexts: ["browser"],
  menuPlacements: [{ category: "navigate", order: 10 }],
  actionKey: "browserBack",
}
```

The menu bar builder merges the base categories (File/Edit/View/Window/Tools)
with any contextual categories active for the focused kind. Dynamic `left`
positions are computed at render time.

This requires `MenuOverlayManager` to support variable-length menu bars and
rebinding accelerator keys. That is materially more complex than Phase 1 and
should be scoped separately.

### Phase 2 Slice B: Push input handling to windows

Move editor and terminal keypress logic from app-controller into window
factories. Add optional `handleInput?(ch, key): boolean` to `WindowRecord`.
App-controller dispatches to focused window first; handles unhandled keys
globally.

This is independent of menu work but synergistic — once windows own their
input, window-specific menu commands map naturally to the same action handlers.

## Edge Cases

- **No focused window with windows open:** Not a normal steady state today.
  Desktop context triggers when `focusedKind === undefined`. No need to add
  explicit desktop-focus mode in Phase 1.
- **Menu/popup overlay open:** Keep context based on underlying focused window.
  Do not switch to overlay-specific context.
- **Workspace restore:** Menus refresh after `focusedWindow?.focus()` on
  restore. Desktop context if no snapshot restores focus.
- **Palette and workspace manager windows:** Use generic `focused-any` context.
  They are meta-windows, not app contexts.
- **Browser vs reader:** Both are distinct WindowKinds. Do not conflate.
- **Shortcut collisions:** Menu visibility must not break existing shortcuts.
  C-s still saves regardless of whether Save is visible in the menu.
- **Agent/API discoverability:** `tui_list_commands` returns global list by
  default. Context is opt-in filter parameter.
- **Selection changes within a window:** Enabled predicates re-evaluate when
  the menu is opened, not continuously. If a user selects a different file in
  the file manager, the menu updates next time it is opened. No live polling.
- **Windows without selection:** `getSelection()` returns undefined. Commands
  with selection-dependent enabled predicates simply disable. No crash path.
- **Selection across window types:** A command like "Reveal in Finder" checks
  both `selection?.path` and `focusedWindow?.filePath` so it works for file
  managers (selection) and editors (window-level file path).

## Testing

- AC-1: No focused window shows launcher commands, no Save
  Test: close all windows, check File menu via state inspector
- AC-2: Editor focused shows Save/Save As, hides Browse Primers
  Test: open editor, focus it, verify File menu items
- AC-3: Tab cycling rebuilds menus each time kind changes
  Test: open editor + terminal, tab between, verify menus differ
- AC-4: Same kind re-focus does not rebuild menus
  Test: open two editors, tab between, verify no rebuild (kind unchanged)
- AC-5: Right-click context menu matches current context (Phase 1B)
  Test: right-click editor shows Save; right-click desktop shows launchers
- AC-6: Agent tui_list_commands with context filters correctly
  Test: call with context=editor, verify Save present, Browse absent
- AC-7: Agent tui_list_commands without context returns full list
  Test: call without context, verify all commands returned
- AC-8: C-s still saves even if Save not visible in menu
  Test: focus terminal, press C-s, verify no crash; focus editor, C-s saves
- AC-9: Enabled predicate greys out Save when editor is clean
  Test: open editor with no changes, verify Save visible but disabled
- AC-10: Browser Navigate menu appears only when browser focused (Phase 2)
  Test: focus browser, verify Navigate in menu bar; focus editor, verify gone
- AC-11: "Open" enabled only when file selected in file manager
  Test: focus file manager with file highlighted, verify Open enabled;
  focus file manager with directory highlighted, verify Open disabled
- AC-12: "Open Link" enabled only when URL selected in browser
  Test: focus browser with page loaded, verify Open Link reflects selection
- AC-13: "Reveal in Finder" works for both file manager selection and editor filePath
  Test: focus editor with saved file, verify Reveal enabled;
  focus file manager with file selected, verify Reveal enabled;
  focus art window, verify Reveal disabled
- AC-14: Selection-aware commands receive context when executed
  Test: select file in file manager, invoke "Open in Editor" via menu,
  verify correct file opens in editor

## Risks

- Menu rebuild flicker if not batched on rapid focus changes
- `MenuOverlayManager.setMenus()` may need careful widget lifecycle management
  to avoid blessed memory leaks
- Phase 2 dynamic categories require variable-width menu bar layout — more
  complex than it sounds
- Filtering command palette could reduce discoverability — keep it global
- Adding browser/terminal/backrooms menu actions is product work, not just
  menu refactoring — some actions need new execution paths in AppMenuActions
