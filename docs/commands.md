# WibWob-DOS Command Reference

> An ASCII art creation and display system for a resident agent that lives
> inside its own OS — researching, sketching, and thinking about its ideas.

## How commands work

**One registry, every surface.** All 82 commands are defined once in C++
(`app/command_registry.cpp`). The menu bar, keyboard shortcuts, IPC socket,
REST API, and MCP tools all read from the same list. Adding a command in C++
makes it instantly available everywhere.

**Two MCP tools cover everything.** The embedded agent uses just:
- `tui_list_commands` — discover all commands (calls `GET /commands`)
- `tui_menu_command` — execute any command by name (calls `POST /menu/command`)

**REST universal dispatch:**
```
POST /menu/command  {"command": "<name>", "args": {<key-value pairs>}}
```

**State inspection:**
```
GET  /health      → {"ok": true}
GET  /state       → full app state (windows, theme, canvas, uptime)
GET  /commands    → all 82 commands with descriptions and param hints
GET  /capabilities → window types + commands + properties
```

---

## Command quick-reference

### Create — tools for making things

| Command | Menu path | Key | What it opens |
|---------|-----------|-----|---------------|
| `new_paint_canvas` | Create > Paint Canvas | | Pixel-level drawing canvas |
| `open_figlet_text` | Create > FIGlet Text | | FIGlet typography window (args: `text`, `font`, `x`, `y`, `shadow`) |
| `open_text_editor` | Create > Text Editor | | Text editor (arg: `title`) |
| `open_primer` | (API only) | | Primer/ASCII art file viewer (args: `path`, `frameless`, `shadowless`, `title`, `x`, `y`, `w`, `h`) |

File openers are also under Create:

| Command | Menu path | Key | What it opens |
|---------|-----------|-----|---------------|
| (open text/anim) | Create > Open Text/Animation | Ctrl-O | File browser for .txt/.ans |
| (open image) | Create > Open Image | | Image file viewer |
| (open monodraw) | Create > Open Monodraw | | Monodraw JSON loader |
| (open transparent) | Create > Open Text File (Transparent) | | Transparent text overlay |

### Generate — generative art engines

Generative engines are grouped into submenus: Organic, Geometric, Monsters.

| Command | Menu path | Description |
|---------|-----------|-------------|
| `open_verse` | Generate > Organic > Verse Field | Generative poetry field |
| `open_mycelium` | Generate > Organic > Mycelium | Organic growth simulation |
| `open_contour_map` | Generate > Organic > Contour Studio | Topographic map (args: `seed`, `terrain`, `levels`, `grow`, `triptych`) |
| `open_orbit` | Generate > Geometric > Orbit | Hypnotic geometry |
| `open_torus` | Generate > Geometric > Torus | Spinning 3D shape |
| `open_cube` | Generate > Geometric > Cube Spinner | Rotating wireframe |
| `open_animated_gradient` | Generate > Geometric > Animated Gradient | Animated colour gradient |
| `open_monster_portal` | Generate > Monsters > Portal | Dimensional rift |
| `open_monster_verse` | Generate > Monsters > Verse | Eldritch poetry |
| `open_monster_cam` | Generate > Monsters > Cam | Emoji monster camera |
| `open_blocks` | Generate > Animated Blocks | Abstract pattern generator |
| `open_score` | Generate > Animated Score | Musical notation display |
| `open_life` | (API only) | Conway's Game of Life |
| `open_ascii` | (API only) | ASCII art display |
| `open_gradient` | (API only) | Static gradient (arg: `kind`: horizontal/vertical/radial/diagonal) |

### Play — games (under Generate > Games)

| Command | Menu path | Description |
|---------|-----------|-------------|
| `open_micropolis_ascii` | Generate > Games > Micropolis | ASCII city builder |
| `open_quadra` | Generate > Games > Quadra | Falling blocks |
| `open_snake` | Generate > Games > Snake | Snake |
| `open_rogue` | Generate > Games > WibWob Rogue | Dungeon crawler |
| `open_deep_signal` | Generate > Games > Deep Signal | Space scanner |

### Canvas — arrange, browse, save, capture

| Command | Menu path | Key | What it does |
|---------|-----------|-----|--------------|
| `open_gallery` | Canvas > Gallery | | Tabbed primer browser |
| `open_apps` | Canvas > Applications | | Application folder browser |
| `open_browser` | Canvas > Browser | Ctrl-B | In-terminal web browser |
| `open_terminal` | Canvas > Terminal | | Terminal emulator |
| `cascade` | Canvas > Cascade | | Cascade all windows |
| `tile` | Canvas > Tile | | Tile all windows |
| `screenshot` | Canvas > Screenshot | Ctrl-P | Capture screen to text |
| `save_workspace` | Canvas > Save Workspace | Ctrl-S | Save current layout |
| `open_workspace` | Canvas > Open Workspace | | Open workspace (arg: `path`) |
| `close_all` | Canvas > Close All | | Close everything |
| `move_window` | (API only) | | Move window (args: `id`, `x`, `y`) |
| `resize_window` | (API only) | | Resize window (args: `id`, `w`, `h`) |
| `focus_window` | (API only) | | Bring to front + focus (arg: `id`) |
| `raise_window` | (API only) | | Same as focus (arg: `id`) |
| `lower_window` | (API only) | | Send to back of z-order (arg: `id`) |
| `close_window` | (API only) | | Close by ID (arg: `id`) |
| `window_shadow` | (API only) | | Toggle shadow (args: `id`, `on`) |
| `window_title` | (API only) | | Set title (args: `id`, `title`) |

### Paint — draw on canvas

All paint commands require `id` (the paint window ID).

| Command | Args | What it does |
|---------|------|--------------|
| `paint_cell` | `id`, `x`, `y`, `fg`, `bg` | Set single cell |
| `paint_text` | `id`, `x`, `y`, `text`, `fg`, `bg` | Write text string |
| `paint_line` | `id`, `x0`, `y0`, `x1`, `y1`, `erase` | Draw line |
| `paint_rect` | `id`, `x0`, `y0`, `x1`, `y1`, `erase` | Draw rectangle |
| `paint_clear` | `id` | Clear canvas |
| `paint_export` | `id` | Export as text (returns content) |
| `paint_save` | `id`, `path` | Save to .wwp file |
| `paint_load` | `id`, `path` | Load from .wwp file |
| `open_paint_file` | `path` | Open new window with .wwp loaded |
| `paint_stamp_figlet` | `id`, `text`, `font`, `x`, `y`, `fg`, `bg` | Stamp FIGlet onto canvas |

### Type — FIGlet typography

| Command | Args | What it does |
|---------|------|--------------|
| `open_figlet_text` | `text`, `font`, `x`, `y`, `shadow` | Open auto-sized FIGlet window |
| `figlet_set_text` | `id`, `text` | Change text in-place |
| `figlet_set_font` | `id`, `font` | Change font in-place |
| `figlet_set_color` | `id`, `fg`, `bg` | Set colours (hex RGB) |
| `list_figlet_fonts` | (none) | List all 148 font names |
| `figlet_list_fonts` | (none) | Alias for above |
| `preview_figlet` | `text`, `font`, `width`, `info` | Render without opening window |

### Style — desktop and theme

| Command | Args | What it does |
|---------|------|--------------|
| `set_theme_mode` | `mode` (light/dark) | Light or dark mode |
| `set_theme_variant` | `variant` (monochrome/dark_pastel) | Colour variant |
| `reset_theme` | (none) | Reset to defaults |
| `desktop_preset` | `preset` | Named desktop preset |
| `desktop_texture` | `char` | Desktop fill character |
| `desktop_color` | `fg`, `bg` (0-15) | Desktop colours |
| `desktop_gallery` | `on` (true/false) | Hide menu/status bar |
| `desktop_get` | (none) | Get current desktop state |
| `pattern_mode` | `mode` (continuous/tiled) | Gradient fill mode |

### Talk — chat, AI, and collaboration

| Command | Menu path | Key | What it does |
|---------|-----------|-----|--------------|
| `open_wibwob` | Talk > Wib&Wob Chat | F12 | Open Wib&Wob AI chat |
| `open_scramble` | Talk > Scramble Cat | F8 | Toggle Scramble cat |
| `open_room_chat` | Talk > Room Chat | | Open multi-user room |
| `wibwob_ask` | (API only) | | Send message to Wib&Wob (arg: `text`) |
| `get_chat_history` | (API only) | | Return chat as JSON |
| `scramble_expand` | (API only) | | Toggle smol/tall mode |
| `scramble_say` | (API only) | | Send message to Scramble (arg: `text`) |
| `scramble_pet` | (API only) | | Pet the cat |
| `chat_receive` | (API only) | | Display message in Scramble (args: `sender`, `text`) |
| `room_chat_receive` | (API only) | | Deliver room message (args: `sender`, `text`, `ts`) |
| `room_presence` | (API only) | | Update room participant list (arg: `participants` JSON) |

### Terminal — remote terminal control

| Command | Args | What it does |
|---------|------|--------------|
| `open_terminal` | (none) | Open terminal window |
| `terminal_write` | `text`, `window_id` | Send text to terminal |
| `terminal_read` | `window_id` | Read terminal content |

### Internal

| Command | Args | What it does |
|---------|------|--------------|
| `inject_command` | `cmd_id` | Inject raw IPC command (testing) |
| `gallery_list` | `tab` | List primer filenames by tab |

---

## REST API endpoints beyond /menu/command

While `POST /menu/command` covers all 82 commands, the REST API also provides
specialised endpoints for batch operations and richer payloads:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/windows` | POST | Create window (typed payload) |
| `/windows/{id}/move` | POST | Move with validation |
| `/windows/{id}/focus` | POST | Focus window |
| `/windows/{id}/close` | POST | Close window |
| `/windows/cascade` | POST | Cascade all |
| `/windows/tile` | POST | Tile all |
| `/windows/close_all` | POST | Close all |
| `/windows/batch_layout` | POST | Batch layout request |
| `/props/{id}` | POST | Set window properties |
| `/gallery/arrange` | POST | Smart layout (8 algorithms) |
| `/primers/batch` | POST | Batch spawn primers |
| `/primers/list` | GET | List all primers |
| `/primers/{name}/metadata` | GET | Get primer dimensions |
| `/paint/cell` | POST | Paint single cell |
| `/paint/line` | POST | Draw line |
| `/paint/rect` | POST | Draw rectangle |
| `/paint/clear` | POST | Clear canvas |
| `/paint/export/{id}` | GET | Export as text |
| `/screenshot` | POST | Capture screen |
| `/workspace/save` | POST | Save workspace |
| `/workspace/open` | POST | Open workspace |
| `/browser/*` | POST | Browser navigation, fetch, render |
| `/ws` | WS | Real-time event stream |

---

## Menu bar structure

```
Create                      Generate                    Canvas                  Talk
 Paint Canvas                Organic >                   Gallery                 Wib&Wob Chat (F12)
 FIGlet Text                  Verse Field                 Applications            Scramble Cat (F8)
 Text Editor                  Mycelium                    Browser (^B)            Room Chat
 ----                         Contour Studio              Terminal                ----
 Open Text/Anim... (^O)       Game of Life                ----                    Quantum Printer (F11)
 Open Image...               Geometric >                  Cascade                 ----
 Open Monodraw...              Orbit                       Tile                   About WIBWOBWORLD
 Open Text File...             Torus                       Send to Back           Keyboard Shortcuts
 ----                          Cube Spinner                Next (F6)              LLM Status
 FIGlet Edit Text...           Animated Gradient           Previous (^F6)         API Key...
 FIGlet Font >               Monsters >                   ----
 ----                          Portal                      Screenshot (^P)
 Pattern Mode >                Verse                       Copy Page (^Ins)
                               Cam (Emoji)                 ----
                             ----                          Save Workspace (^S)
                             Animated Blocks               Save Workspace As...
                             Animated Score                Open Workspace...
                             New Animation (^D)            Manage Workspaces...
                             ASCII Grid Demo               Recent >
                             ----                          ----
                             Games >                       Close Window (Alt-F3)
                              Micropolis                   Close All
                              Quadra                       ----
                              Snake                        Exit (Alt-X)
                              WibWob Rogue
                              Deep Signal
```

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Alt-X | Exit |
| Ctrl-N | New Test Pattern |
| Ctrl-D | New Animation |
| Ctrl-O | Open Text/Animation |
| Ctrl-S | Save Workspace |
| Ctrl-P | Screenshot |
| Ctrl-B | Browser |
| Ctrl-Ins | Copy Page |
| F5 | Repaint |
| F6 | Next Window |
| Shift-F6 | Previous Window |
| F8 | Scramble Cat |
| F11 | Quantum Printer |
| F12 | Wib&Wob Chat |
| Alt-F3 | Close Window |

---

## Agent design notes

**Progressive disclosure, not tool sprawl.** This system follows the pattern
described in "Lessons from Building Claude Code: Seeing Like an Agent": rather
than 82 specialised MCP tools (one per command), there are exactly two. The
agent discovers what's available at runtime via `tui_list_commands`, then
executes anything via `tui_menu_command`. New C++ commands appear instantly
without touching the MCP layer.

**Menus shaped to the agent's work.** The four-menu layout — Create, Generate,
Canvas, Talk — maps to the creative verbs of a resident artist-agent: make
things, spawn generative processes, arrange the workspace, and converse. This
replaces the generic File/Edit/View/Window/Tools/Help convention which was
designed for human office workers, not for an agent living inside its own OS.

**The REST API provides richer typed endpoints** for batch operations, gallery
layout algorithms, and browser control — but `POST /menu/command` alone
covers the full command surface for simple agent workflows. The specialised
endpoints exist for when the agent needs batch layout, typed validation, or
WebSocket streaming.

Key files:
- `app/command_registry.cpp` — single source of truth for all 82 commands
- `app/command_registry.h` — command capability struct
- `app/wwdos_app.cpp` — menu bar definition (initMenuBar)
- `app/llm/sdk_bridge/mcp_tools.js` — two-tool MCP server
- `tools/api_server/main.py` — REST API (60+ endpoints)
