---
id: E011
title: Desktop Shell — Icons, Folders, Trash, App Launcher & Desktop Apps
status: not-started
issue: 78
pr: ~
depends_on: [E009]
---

# E011 — Desktop Shell: Icons, Folders, Trash, App Launcher & Desktop Apps

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

### F07: Figlet Clock App

A desktop clock widget rendered in large figlet-style ASCII art. The AI's bedside clock.

- Displays current time (HH:MM:SS) rendered through figlet fonts
- Runs as a `TWindow` subclass, auto-refreshes every second
- Default font: `banner` or `big` — something chunky and retro
- **Stretch goal**: Font selector (cycle through installed figlet fonts via menu or API)
- **Stretch goal**: Date display toggle, 12/24hr toggle
- Clock is a natural "desktop furniture" item — always visible, makes the OS feel alive

Implementation notes:
- Figlet rendering in C++: either shell out to `figlet` binary, or embed a minimal figlet font parser (`.flf` format is simple — header + character definitions)
- Embedding is preferred for portability (no runtime dependency)
- Available fonts on macOS: `/opt/homebrew/Cellar/figlet/2.2.5/share/figlet/fonts/` (~150+ fonts)
- Window auto-sizes to fit rendered text

Stories:
- [ ] S27: Figlet font parser (load `.flf` file, render string → multi-line ASCII)
- [ ] S28: Clock window (TWindow subclass, timer-driven redraw)
- [ ] S29: Font selection (menu or API command `set_clock_font`)
- [ ] S30: API surface (`open_clock`, `set_clock_font`, `list_clock_fonts`)

### F08: WibWob World Map App

A map viewer showing the geography of WibWob World — locations of Wib, Wob, Scramble, other symbients, and points of interest.

- ASCII/box-drawing map rendered in a `TWindow`
- Shows named locations, symbient positions (updated via state/API)
- Scrollable if map exceeds window size
- Symbient positions update in real-time (or on refresh) from the game state
- Map data defined in a simple format (ASCII art + coordinate metadata)
- Pre-1993 aesthetic: no fancy graphics, just text, borders, and symbols

Stories:
- [ ] S31: Map data format and loader (ASCII art map + named POI coordinates)
- [ ] S32: Map viewer window (TWindow with scroll, symbient markers)
- [ ] S33: Real-time symbient position overlay (query game state, update markers)
- [ ] S34: API surface (`open_map`, `get_map_state`, `set_symbient_location`)

### F09: Neural Lace Mail App

A messaging app for reading and composing neural lace messages — something between email and a bulletin board. Plain text always, pre-1993 tech aesthetic.

- Dual-pane view: message list (top/left) + message body (bottom/right)
- Messages have: sender (symbient name), subject, timestamp, body (plain text)
- Inbox shows unread count, sorted by date
- Compose mode: plain text editor, recipient picker from known symbients
- Messages stored locally as flat files or simple JSON (one file per message, maildir-style)
- **Not networked** — messages are local state, created by AI agents via API or by human
- Bulletin board mode: shared messages visible to all symbients (like a town notice board)
- Read/unread tracking, delete/archive

Design aesthetic: Think `pine`, `elm`, or early BBS mail readers. No MIME, no HTML, no attachments. Just text.

Stories:
- [ ] S35: Message data model and storage (maildir-style flat files)
- [ ] S36: Mail list view (TWindow with TListViewer or similar)
- [ ] S37: Message body viewer (TWindow with scrollable text)
- [ ] S38: Compose mode (simple text input, recipient, subject)
- [ ] S39: Unread tracking and notification (badge on desktop icon)
- [ ] S40: Bulletin board mode (shared inbox visible to all symbients)
- [ ] S41: API surface (`send_message`, `list_messages`, `read_message`, `delete_message`, `list_unread`)

### F10: Session Tape Recorder

Record entire WibWobDOS sessions to disk for replay, sharing, and debugging. Inspired by [TUIOS tape recording](https://github.com/Gaurav-Gosain/tuios/blob/main/docs/TAPE_RECORDING.md) and [asciinema](https://github.com/asciinema/asciinema).

Two recording modes:
1. **Action tape** (TUIOS-style): Records commands/actions, not raw output. Portable, editable, replayable. Good for tutorials and automated workflows.
2. **Screen tape** (asciinema-style): Records raw terminal output + timing. Exact visual replay. Good for demos and debugging.

- Start/stop recording via menu or API
- Status indicator when recording (e.g. `●REC` in status bar)
- Tapes saved to `~/.wibwobdos/tapes/` or workspace directory
- Playback: replay in a window, or export to asciinema `.cast` format for web sharing

Implementation notes:
- **Action tape in C++**: Hook into command registry — log every command dispatch with timestamp. On replay, feed commands back through the registry with timing delays.
- **Screen tape in C++**: Capture the TScreen buffer at intervals or on damage, store as timestamped frames. Similar to asciinema v2 format (newline-delimited JSON: `[time, "o", "data"]`).
- TUIOS does this in Go with Bubble Tea's `tea.Program` — we'd hook into Turbo Vision's event loop instead.
- asciinema `.cast` format is simple and well-documented: https://docs.asciinema.org/manual/asciicast/v2/

Stories:
- [ ] S42: Action recorder (hook command registry, log with timestamps)
- [ ] S43: Screen recorder (capture TScreen buffer, store as timestamped frames)
- [ ] S44: Start/stop UI (menu item, status bar indicator)
- [ ] S45: Action tape playback (feed commands with timing)
- [ ] S46: Screen tape playback (render frames in a window)
- [ ] S47: Export to asciinema `.cast` format
- [ ] S48: API surface (`tape_start`, `tape_stop`, `tape_play`, `tape_list`, `tape_export`)

### F11: Browser Improvements

Port ideas from [TUIOS web terminal architecture](https://github.com/Gaurav-Gosain/tuios/blob/main/docs/WEB.md) to improve WibWobDOS's existing browser view. Current browser is MVP — these bring it closer to usable.

Key ideas to steal from TUIOS-web:
- **WebGL/Canvas rendering pipeline** — TUIOS uses xterm.js with WebGL addon for 60fps. Our browser-hosted mode should evaluate the same stack.
- **Dual transport** — WebTransport (QUIC/UDP) with WebSocket fallback. Lower latency for the hosted web version.
- **Mouse deduplication** — Only send mouse events when cell position changes (80-95% reduction). Our browser may be sending too many.
- **requestAnimationFrame batching** — Batch terminal writes per frame instead of per-event.
- **Settings panel** — Transport, renderer, font size controls accessible in-browser.
- **Read-only mode** — For public demos and spectating.

This feature is about the **browser-hosted WibWobDOS experience** (when accessed via web), not the in-app text-mode browser for visiting URLs.

Stories:
- [ ] S49: Audit current browser transport — identify latency bottlenecks
- [ ] S50: Implement mouse event deduplication (cell-change-only)
- [ ] S51: requestAnimationFrame write batching
- [ ] S52: Evaluate xterm.js WebGL addon for rendering
- [ ] S53: Read-only spectator mode
- [ ] S54: In-browser settings panel (font size, renderer)

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

### Phase 1: Foundation (shell infrastructure)
1. **F01 S01–S02**: Desktop icon layer + keyboard nav (foundation)
2. **F04 S16–S17**: App manifest + launcher (makes icons useful)
3. **F02 S06–S07**: Folder views with built-in categories

### Phase 2: Desktop Apps (make it feel alive)
4. **F07 S27–S28**: Figlet clock (quick win, instant desktop furniture)
5. **F09 S35–S38**: Neural lace mail (core read/compose loop)
6. **F08 S31–S32**: WibWob world map (static map + POI)

### Phase 3: Polish & Infra
7. **F01 S03–S05**: Icon drag, persistence, API
8. **F03 S11–S15**: Trash view
9. **F05 S21–S23**: Minimise-to-icon
10. **F10 S42–S44**: Session tape recorder (record + stop)

### Phase 4: Stretch
11. **F06 S24–S26**: Wallpaper
12. **F07 S29–S30**: Clock font selector
13. **F08 S33–S34**: Real-time symbient positions on map
14. **F09 S39–S41**: Mail unread badges, bulletin board mode
15. **F10 S45–S48**: Tape playback, asciinema export
16. **F11 S49–S54**: Browser improvements (web-hosted experience)

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

## Research References

- **TUIOS Tape Recording**: https://github.com/Gaurav-Gosain/tuios/blob/main/docs/TAPE_RECORDING.md — action-level recording (commands, not raw bytes), `.tape` file format, playback architecture. Port concept to C++/Turbo Vision event loop.
- **TUIOS Web Terminal**: https://github.com/Gaurav-Gosain/tuios/blob/main/docs/WEB.md — xterm.js + WebGL rendering, WebTransport/WebSocket dual protocol, mouse deduplication, rAF batching. Steal for our browser-hosted mode.
- **asciinema**: https://github.com/asciinema/asciinema (16.8k⭐, Rust) — screen-level recording, `.cast` v2 format (newline-delimited JSON), web player. Export target for F10.
- **Awesome TUIs survey**: See `RESEARCH-awesome-tuis.md` in tvterm repo notes branch for full landscape analysis.
- **Figlet fonts**: `.flf` format spec at http://www.jave.de/figlet/figfont.html — simple enough to embed a parser in C++ (header line + character blocks).
- **Desktop-TUI**: https://github.com/Julien-cpsn/desktop-tui — Go-based terminal desktop env, for reference only (different stack).

## Parking Lot

- [ ] Icon drag-and-drop between desktop and folders
- [ ] Icon editor (draw custom multi-line ASCII icons)
- [ ] Virtual desktops / multiple desktop pages
- [ ] Dock/taskbar at bottom of screen
- [ ] Start menu (Windows 95 style)
- [ ] File associations (open .txt → text editor, .cty → Micropolis)
- [ ] Right-click context menus on icons
- [ ] Clock: alarm/timer mode (pomodoro for symbients)
- [ ] Clock: timezone display (WibWob Standard Time vs Earth time)
- [ ] Mail: message threading / reply chains
- [ ] Mail: message forwarding between symbients
- [ ] Mail: mail notification sound (terminal bell)
- [ ] Map: fog of war (unexplored areas hidden)
- [ ] Map: clickable locations to teleport/navigate
- [ ] Tape: live streaming mode (stream session to web viewer)
- [ ] Tape: tape editing TUI (trim, cut, annotate)
- [ ] Calendar app (complements clock — symbient schedule)
- [ ] Address book (complements mail — symbient contacts)
- [ ] Calculator (desk accessory, like Windows 3.1)
- [ ] Notepad (simple text editor, desk accessory)
