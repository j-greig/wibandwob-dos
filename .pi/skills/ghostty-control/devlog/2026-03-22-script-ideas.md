# Ghostty Control — Script & Tooling Ideas

## The core insight

**The agent should never do pixel math.** Every time we calculated cell widths, counted columns in screenshot text, or manually converted row/col to pixels — that was avoidable friction. The system should tell the agent where things are, and scripts should handle the coordinate plumbing.

## Friction map from this session

| Task | What we actually did | What should have happened |
|---|---|---|
| Click "Core Apps" menu | Get window geometry → calc cell size → find text with `.find()` → compute pixel coords → send mouse events | `click-text.sh "Core Apps"` |
| Click "Quit" menu item | Same calc + discovered double-click needed | `click-text.sh "Quit"` |
| Send `bun run dev` to terminal | Focus by cwd, Ctrl+C, Ctrl+U, input text, send key enter — took 4 attempts | `send-to-terminal.sh wibandwob-dos "bun run dev"` |
| Check what's highlighted in menu | `wibwob screenshot` strips ANSI — couldn't see | API should report active/highlighted item |
| Open Figlet Banner from menu | Tried mouse click (failed single, worked double) | `wibwob cmd microapp.wibwob.figlet.open` (skip the menu entirely) |
| Set text in overlay prompt | Had to build a new API endpoint | Now exists: `POST /overlay/set-text` ✅ |

## Three layers of improvement

### Layer 1: Shell scripts (agent-facing, encapsulate AppleScript + geometry)

#### `calibrate.sh`
Outputs current Ghostty window geometry and cell dimensions as shell-sourceable vars.
```bash
# Usage
eval $(bash scripts/calibrate.sh)
echo "$CELL_W x $CELL_H — $COLS cols, $ROWS rows"
```
Internally: `osascript` for window geometry + `wibwob` API for cols/rows.
One source of truth, never hand-calculate again.

#### `click-text.sh "<text>"` ⭐ biggest win
Find text on screen and click it. Handles everything.
```bash
bash scripts/click-text.sh "Core Apps"     # click menu bar item
bash scripts/click-text.sh "Quit"          # click menu item (double-click)
bash scripts/click-text.sh "OK"            # click button in overlay
```
Internally:
1. `wibwob screenshot` → find row/col of text
2. `calibrate.sh` → get cell dimensions  
3. `osascript` → send mouse position + double-click
4. Verify via screenshot or API

Options: `--single` (one click), `--double` (default for safety), `--row-hint N` (disambiguate if text appears multiple times)

#### `click-cell.sh <col> <row>`
When you already know the cell coords. Wraps calibrate + osascript.
```bash
bash scripts/click-cell.sh 35 0           # click col 35, row 0
bash scripts/click-cell.sh 35 0 --single  # single click variant
```

#### `send-to-terminal.sh <cwd-needle> <command>`
The safe "find terminal, clear line, type command, press enter" pattern.
```bash
bash scripts/send-to-terminal.sh wibandwob-dos "bun run dev"
bash scripts/send-to-terminal.sh myproject "npm test"
```
Internally: focus by cwd → Ctrl+C → Ctrl+U → input text → send key enter.

#### `menu-click.sh <menu-label> [item-label]`
High-level: click a menu, optionally click an item in it.
```bash
bash scripts/menu-click.sh "File"                  # just open the menu
bash scripts/menu-click.sh "File" "Quit"            # open File, click Quit
bash scripts/menu-click.sh "Core Apps" "Terminal"    # open Core Apps, click Terminal
```
Internally: click-text for menu label → wait → click-text for item.
Could also use the API shortcut when available (many menu items map to commands).

### Layer 2: TUI API enrichment (system tells the agent where things are)

#### `GET /ui/menu-items` — menu item positions
When a menu is open, return the items with their cell coordinates.
```json
{
  "menuLabel": "File",
  "items": [
    { "label": "Open Primer...", "row": 2, "col": 2 },
    { "label": "Quit", "row": 7, "col": 2 }
  ]
}
```
This eliminates the need to parse screenshots to find menu item positions.

#### `GET /ui/overlay-buttons` — button positions in active overlay
When an overlay is active, report where OK/Cancel are.
```json
{
  "type": "value",
  "label": "Figlet Text",
  "buttons": [
    { "label": "OK", "row": 5, "col": 42 },
    { "label": "Cancel", "row": 5, "col": 48 }
  ],
  "input": { "row": 2, "col": 2, "width": 40 }
}
```
Agents can then click OK via coords when they want a "real" click, or use `/overlay/confirm` for the API shortcut.

#### `GET /screenshot/annotated` — screenshot with position metadata
Return the text screenshot plus a sidecar of clickable regions.
```json
{
  "text": " File   Edit   View ...",
  "regions": [
    { "label": "File", "row": 0, "col": 1, "width": 4, "clickable": true },
    { "label": "Edit", "row": 0, "col": 8, "width": 4, "clickable": true },
    ...
  ]
}
```

#### Enhance `GET /overlay/info` with geometry
Already exists, just needs button/input positions added. Cheap win.

### Layer 3: Decision logic — when to use which tool

Not everything needs AppleScript. The right tool for each job:

| Task | Best tool | Why |
|---|---|---|
| Open a microapp | `wibwob cmd <id>` or API POST | Bypasses menu entirely, most reliable |
| Set overlay text | `POST /overlay/set-text` | Direct, no mouse needed |
| Confirm overlay | `POST /overlay/confirm` | Direct, no mouse needed |
| Click a menu item (when no API equivalent) | `click-text.sh` | Some menu items don't have command IDs |
| Navigate TUI with keyboard | `send key` AppleScript | For tab, escape, arrow-like navigation |
| Type into a shell terminal | `send-to-terminal.sh` | Safe pattern with line clearing |
| Visual verification | `screencapture` | Only way to see colors/highlights |
| Semantic verification | `wibwob state` / `wibwob windows` | Structured, parseable |
| Check what's on screen | `wibwob screenshot` + API | Text for content, API for structure |

### Priority order for implementation

1. **`click-text.sh`** — eliminates 80% of the manual coord calculation pain
2. **`send-to-terminal.sh`** — encapsulates the 4-step safe-send pattern
3. **`calibrate.sh`** — foundation for click-text and click-cell
4. **`menu-click.sh`** — composed from click-text, common enough to warrant its own script
5. **`GET /ui/menu-items`** (API) — makes menu clicking reliable without screenshot parsing
6. **Enhance `/overlay/info`** with button positions — cheap, high value

### Naming convention

All scripts in `.pi/skills/ghostty-control/scripts/`.
Prefix with purpose: `click-*`, `send-*`, `calibrate*`.
All take `--help` and echo usage.
All are self-contained (no external deps beyond osascript + curl + wibwob CLI).

### Open questions

- Should `click-text.sh` search the full screenshot or accept a bounding box hint?
- Should scripts auto-detect the wibwob instance, or require `-i <id>`?  
  → Probably auto-detect (use canonical instance from `wibwob ls`)
- Should we cache calibration within a session? Window could move/resize.
  → No cache, always re-calibrate. It's fast (two calls).
- The 28px title bar offset — is there a way to query this? Or should we make it configurable?
  → Check if Ghostty exposes content rect vs frame rect via AppleScript
