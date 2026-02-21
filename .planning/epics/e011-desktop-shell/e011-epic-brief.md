---
id: E011
title: Desktop Shell — Icons, Folders, Trash & App Launcher
status: not-started
issue: 78
pr: ~
depends_on: [E009]
---

# E011 — Desktop Shell: Icons, Folders, Trash & App Launcher

## Objective

Transform WibWob-DOS from a flat window manager into a **desktop shell** inspired by Windows 3.1 / early macOS — with icons on the desktop, folder views for organising applications and files, a working trash can, drag-to-launch semantics, and scriptable action items. All controllable via both TUI interaction and the REST/MCP API.

## Vision

> WibWob-DOS becomes a text-native desktop operating environment. Applications, games, scripts, and files have icons (text-mode glyphs/sprites) that live on a spatial desktop or inside folder views. Users (human or AI) can organise, launch, drag, and trash items. The terminal emulator (tvterm) becomes the "MS-DOS prompt inside Windows" — you can drop to a command line from the desktop, or launch graphical TUI apps from it.

### Inspirations

| Source | What We Take |
|--------|-------------|
| **Windows 3.1** | Program Manager with group windows, desktop icons, minimise-to-icon |
| **macOS Finder** | Desktop icons, Trash, application folders, double-click launch |
| **GEM Desktop** | Text-mode desktop with file/folder icons (Atari ST aesthetic) |
| **Norton Commander** | Dual-pane file browser in text mode |

### Key Principles

1. **Text-native icons** — Icons are 2–4 character glyphs with optional colour, not bitmaps. Think `[📁]`, `[🐍]`, `[🏙️]`, `[🗑️]` or ASCII art mini-sprites.
2. **Spatial desktop** — Icons have persistent x,y positions on the desktop background.
3. **Modular & extensible** — New apps/scripts register as launchable items via a manifest.
4. **API-first** — Every desktop action (create icon, move, launch, trash, restore) is an API/MCP command.
5. **Symbient-compatible** — AI agent can arrange the desktop, launch apps, organise folders, empty trash.

## Features

### F01: Desktop Icon Layer

A persistent icon layer rendered on the `TDeskTop` background, beneath all windows.

- Icons have: glyph (1–4 chars), label (text below), position (x,y in desktop coords), colour, action (command name or script path).
- Icons are selectable (highlight), movable (drag or API), and double-click/Enter launchable.
- Desktop icon state persists across sessions (saved to workspace or `~/.wibwobdos/desktop.json`).
- Icons can overlap windows; windows render on top.

Stories:
- [ ] S01: Desktop icon data model and renderer (TDeskTop subclass with icon layer)
- [ ] S02: Icon selection, keyboard navigation (arrows between icons, Enter to launch)
- [ ] S03: Icon drag-move (mouse drag or API `move_icon`)
- [ ] S04: Desktop state persistence (save/load icon positions)
- [ ] S05: API surface (`create_icon`, `move_icon`, `delete_icon`, `list_icons`, `launch_icon`)

### F02: Folder Views

Folder windows that display a collection of launchable items as icons in a grid.

- Folder is a `TWindow` subclass displaying icons in a grid/list.
- Built-in folders: "Applications", "Games", "Generative Art", "Scripts".
- User can create custom folders.
- Double-click/Enter on a folder icon opens the folder view.
- Double-click/Enter on an item inside launches it.
- Folder contents defined by manifest files or dynamic command registry queries.

Stories:
- [ ] S06: Folder view window (TWindow with icon grid layout)
- [ ] S07: Built-in folders populated from command registry categories
- [ ] S08: Custom folder creation and item management
- [ ] S09: Folder state persistence
- [ ] S10: API surface (`create_folder`, `add_to_folder`, `remove_from_folder`, `open_folder`)

### F03: Trash View

A special folder/view that shows recently deleted/closed items.

- "Trash" icon on desktop (always present, like macOS dock trash).
- When windows are closed, they can optionally go to trash instead of being destroyed.
- Trash view shows: window title, type, timestamp, preview snippet.
- Items can be restored (reopened) or permanently deleted.
- Trash integrates with the tvterm session — closed terminal sessions can be inspected.
- "Empty Trash" action.

Stories:
- [ ] S11: Trash data model (ring buffer of closed window metadata + optional state snapshots)
- [ ] S12: Trash view window (TWindow listing trashed items)
- [ ] S13: Restore from trash (reopen window with saved state)
- [ ] S14: Trash icon on desktop with item count badge
- [ ] S15: API surface (`trash_item`, `restore_item`, `empty_trash`, `list_trash`)

### F04: App Launcher & Script Actions

A system for registering launchable items — applications, games, scripts, and custom actions.

- **App manifest**: JSON/YAML file describing a launchable item:
  ```json
  {
    "id": "snake",
    "name": "Snake",
    "icon": "🐍",
    "category": "games",
    "command": "open_snake",
    "description": "Classic snake game"
  }
  ```
- **Script actions**: Shell scripts or Python scripts with a manifest that makes them double-clickable:
  ```json
  {
    "id": "backup-workspace",
    "name": "Backup Workspace",
    "icon": "💾",
    "category": "scripts",
    "script": "scripts/backup.sh",
    "confirm": true
  }
  ```
- Manifests live in `modules/` or `modules-private/` alongside existing module system.
- Registry scans manifests at startup, populates folders and desktop.

Stories:
- [ ] S16: App manifest schema and loader
- [ ] S17: Script action executor (spawn shell/python, capture output, show result)
- [ ] S18: Manifest-driven folder population
- [ ] S19: Hot-reload manifests on module scan
- [ ] S20: API surface (`register_app`, `list_apps`, `launch_app`, `register_script`)

### F05: Window Minimise-to-Icon

Windows can be minimised to icons on the desktop (Windows 3.1 style).

- Minimise button or keyboard shortcut reduces window to a desktop icon.
- Double-click icon restores the window.
- Minimised icon shows window title and type glyph.

Stories:
- [ ] S21: Minimise-to-icon behaviour (hide window, create temporary desktop icon)
- [ ] S22: Restore-from-icon (show window, remove icon)
- [ ] S23: API surface (`minimize_window`, `restore_window`)

### F06: Desktop Wallpaper Integration

The desktop background behind icons can display wallpaper patterns or art.

- Existing generative art patterns (verse field, mycelium, etc.) can be set as live wallpaper.
- Static ASCII art can be used as wallpaper.
- Wallpaper renders beneath icon layer.
- API: `set_wallpaper(type, params)`.

Stories:
- [ ] S24: Wallpaper renderer on TDeskTop
- [ ] S25: Wallpaper selection from existing generative art engines
- [ ] S26: API surface (`set_wallpaper`, `get_wallpaper`)

## Non-Goals

- **File manager** — Not building a full file browser. Folder views show launchable items, not arbitrary filesystem contents.
- **Drag-and-drop between folders** — Can be added later but not in first pass.
- **Icon editor** — Icons are text glyphs defined in manifests, not user-drawn.
- **Multi-desktop / virtual desktops** — Out of scope for this epic.

## Architecture Notes

### Desktop Icon Layer

The current `TDeskTop` draws a solid background. We need a subclass `TWibWobDeskTop` that:
1. Draws wallpaper (if set) via `draw()` override.
2. Draws icons on top of wallpaper.
3. Handles mouse/keyboard events for icon interaction.
4. Delegates to `TDeskTop` for window management.

### Icon Data Model

```cpp
struct DesktopIcon {
    std::string id;           // unique identifier
    std::string label;        // display text
    std::string glyph;        // 1-4 char icon (UTF-8)
    TColorAttr color;         // foreground colour
    TPoint position;          // desktop coordinates
    std::string command;      // command registry name to execute
    std::string script;       // alternative: script path to run
    bool pinned;              // true = user-placed, false = auto-arranged
    std::string folder;       // "" = desktop, otherwise folder id
};
```

### Icon Registry

```cpp
class IconRegistry {
    std::vector<DesktopIcon> icons;
    void loadFromManifests(const std::string& modulesDir);
    void saveDesktopState(const std::string& path);
    void loadDesktopState(const std::string& path);
    DesktopIcon* findIcon(const std::string& id);
    void addIcon(DesktopIcon icon);
    void removeIcon(const std::string& id);
    std::vector<DesktopIcon> iconsInFolder(const std::string& folderId);
    std::vector<DesktopIcon> desktopIcons(); // folder == ""
};
```

### Manifest Location

```
modules/
  example-primers/
    module.json
  desktop-apps/           ← new: app manifests
    module.json
    apps/
      snake.json
      quadra.json
      micropolis.json
      ...
modules-private/
  my-scripts/
    module.json
    apps/
      backup-workspace.json
```

### IPC/API Commands

New command surface (all go through command registry):

| Command | Args | Description |
|---------|------|-------------|
| `desktop_create_icon` | `{id, label, glyph, color, x, y, command}` | Place icon on desktop |
| `desktop_move_icon` | `{id, x, y}` | Reposition icon |
| `desktop_delete_icon` | `{id}` | Remove icon |
| `desktop_list_icons` | `{}` | List all desktop icons |
| `desktop_launch_icon` | `{id}` | Execute icon's command/script |
| `folder_create` | `{id, name, glyph}` | Create folder |
| `folder_open` | `{id}` | Open folder view window |
| `folder_add_item` | `{folder_id, item_id}` | Add item to folder |
| `folder_remove_item` | `{folder_id, item_id}` | Remove item from folder |
| `folder_list` | `{}` | List all folders |
| `trash_item` | `{window_id}` | Move window to trash |
| `trash_restore` | `{trash_id}` | Restore from trash |
| `trash_empty` | `{}` | Empty trash |
| `trash_list` | `{}` | List trash contents |
| `window_minimize` | `{window_id}` | Minimise to icon |
| `window_restore` | `{window_id}` | Restore from icon |
| `set_wallpaper` | `{type, params}` | Set desktop wallpaper |
| `register_app` | `{manifest}` | Register launchable app |

## Sequencing

Recommended implementation order:

1. **F01 S01–S02**: Desktop icon layer + keyboard nav (foundation)
2. **F04 S16–S17**: App manifest + launcher (makes icons useful)
3. **F02 S06–S07**: Folder views with built-in categories
4. **F01 S03–S05**: Icon drag, persistence, API
5. **F03 S11–S15**: Trash view
6. **F05 S21–S23**: Minimise-to-icon
7. **F06 S24–S26**: Wallpaper (stretch goal)

## Risks

| Risk | Mitigation |
|------|-----------|
| TDeskTop subclassing complexity | Spike TDeskTop draw override with one icon before committing |
| Mouse event conflicts (icons vs windows) | Icons only respond when no window is focused / desktop has focus |
| Performance with many icons | Limit to 50 desktop icons; folders handle larger collections |
| Module system scope creep | Manifests are simple JSON, not a plugin system |
| GPL scope if Micropolis icon uses engine | Icons are just glyphs + command refs, no engine code involved |

## Rollback

All changes are additive. The existing flat menu and window system continue to work. Feature can be disabled by reverting to standard `TDeskTop` class.

## Parking Lot

- [ ] Icon drag-and-drop between desktop and folders
- [ ] Icon editor (draw custom multi-line ASCII icons)
- [ ] Virtual desktops / multiple desktop pages
- [ ] Dock/taskbar at bottom of screen
- [ ] Start menu (Windows 95 style)
- [ ] File associations (open .txt → text editor, .cty → Micropolis)
- [ ] Right-click context menus on icons
