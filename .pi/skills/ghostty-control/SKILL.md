---
name: ghostty-control
description: >
  Control Ghostty terminal via AppleScript to simulate human interaction with
  the WibWob-DOS TUI — click menu items, send keystrokes, move the mouse,
  read screen state, and take screenshots for visual verification. Use when
  smoke-testing the TUI, verifying a microapp opened correctly, clicking a
  menu to check its contents, simulating user input in an automated test, or
  any task that requires acting on the TUI like a human would. Triggers on:
  "click the menu", "smoke test the TUI", "simulate a click", "send a keystroke
  to the terminal", "verify the TUI visually", "ghostty applescript",
  "ghostty control", "act like a human in the TUI", "test by clicking",
  "screenshot the TUI", "broadcast a command", "jump to terminal by directory".
  macOS only. Requires Ghostty >= 1.3.0.
---

# Ghostty AppleScript Control

Ghostty ships a full AppleScript dictionary (merged in 1.3.0, PRs #11208 #11251).
Drive WibWob-DOS TUI as a human would — click menus, send keys, move the mouse.
Read results via the wibwob API or screencapture.

macOS only. Disable with `macos-applescript = false` in Ghostty config.
TCC permission required — macOS prompts once per calling app.

---

## Objects

| Object | Key Properties | Key Elements |
|---|---|---|
| `application` | `name`, `frontmost`, `version` | `windows`, `terminals` |
| `window` | `id`, `name`, `selected tab` | `tabs`, `terminals` |
| `tab` | `id`, `name`, `index`, `selected`, `focused terminal` | `terminals` |
| `terminal` | `id`, `name`, `working directory` | — |

---

## Commands

| Category | Command | Purpose |
|---|---|---|
| Application | `perform action` | Execute a Ghostty action string on a terminal |
| Configuration | `new surface configuration` | Create/copy a reusable surface config record |
| Creation | `new window` | Open a new Ghostty window (optional config) |
| Creation | `new tab` | Open a new tab (optional target window/config) |
| Layout | `split` | Split a terminal, return the new terminal |
| Focus | `focus` | Focus a terminal |
| Focus | `activate window` | Bring a window to front |
| Focus | `select tab` | Select and foreground a tab |
| Lifecycle | `close` | Close a terminal |
| Lifecycle | `close tab` | Close a tab |
| Lifecycle | `close window` | Close a window |
| Input | `input text` | Paste-style text input |
| Input | `send key` | Key press/release with optional modifiers |
| Input | `send mouse button` | Mouse button press/release |
| Input | `send mouse position` | Mouse position update (pixel coords) |
| Input | `send mouse scroll` | Scroll event with precision/momentum options |
| Standard | `count`, `exists`, `quit` | Standard Cocoa scripting |

---

## Quick reference

```applescript
tell application "Ghostty"
  set t to focused terminal of selected tab of front window

  input text "curl -sf localhost:8099/health\n" to t   -- send text
  send key "escape" to t                                -- named key
  send key "q" modifiers "control" to t                 -- with modifier

  -- Click at pixel coords (relative to terminal content area — see calibration)
  send mouse position x 294.0 y 8.0 to t
  send mouse button left button action press to t
  send mouse button left button action release to t

  send mouse scroll x 0.0 y 3.0 to t                   -- scroll down
  perform action "new_window" on t                      -- Ghostty action string
end tell
```

---

## Coord calibration (click anywhere in TUI)

Pixel coords are relative to the terminal content area, not the screen.

```bash
# Get window geometry
osascript -e 'tell application "System Events" to tell process "Ghostty" to {position of window 1, size of window 1}'
# → win_x, win_y, win_w, win_h   e.g. 1111, 156, 1384, 1167

# Terminal dimensions from wibwob
wibwob ls | python3 -c "import json,sys; s=json.load(sys.stdin)[0]['screen']; print(s['width'], s['height'])"
# → 173 66

# Formula
# cell_w = win_w / cols          e.g. 1384 / 173 = 8.0 px
# cell_h = (win_h - 28) / rows   e.g. (1167 - 28) / 66 = 17.3 px  (28px title bar)
# pixel_x = col * cell_w
# pixel_y = row * cell_h
```

Click "Core Apps" (col 31, row 0):
```bash
osascript << 'EOF'
tell application "Ghostty"
  set t to focused terminal of selected tab of front window
  set cw to 1384.0 / 173.0
  set ch to (1167.0 - 28.0) / 66.0
  send mouse position x (31.0 * cw + cw/2.0) y (0.5 * ch) to t
  send mouse button left button action press to t
  send mouse button left button action release to t
end tell
EOF
sleep 0.3
wibwob screenshot
```

---

## Read results

```bash
wibwob screenshot          # text screenshot — clean, strips ANSI/chrome
wibwob state               # full semantic state as JSON
wibwob windows             # list open windows
curl -sf localhost:8099/errors/recent   # any microapp errors

# Visual proof
screencapture -x -D 1 /tmp/tui-snap.png
```

---

## Worked examples

### Layout — 4-pane dev environment
```applescript
set projectDir to POSIX path of (path to home folder) & "src/myproject"
tell application "Ghostty"
  activate
  set cfg to new surface configuration
  set initial working directory of cfg to projectDir
  set win to new window with configuration cfg
  set paneEditor to terminal 1 of selected tab of win
  set paneBuild to split paneEditor direction right with configuration cfg
  set paneGit   to split paneEditor direction down  with configuration cfg
  set paneLogs  to split paneBuild  direction down  with configuration cfg
  input text "nvim ." to paneEditor
  send key "enter" to paneEditor
  input text "git status -sb" to paneGit
  send key "enter" to paneGit
  input text "tail -f /tmp/dev.log" to paneLogs
  send key "enter" to paneLogs
  focus paneEditor
end tell
```

### Broadcast — run one command across all terminals
```applescript
set cmd to "echo sync && date"
tell application "Ghostty"
  repeat with t in terminals
    input text cmd to t
    send key "enter" to t
  end repeat
end tell
```

### Jump — focus terminal by working directory
```applescript
set needle to "wibandwob-dos"
tell application "Ghostty"
  set matches to every terminal whose working directory contains needle
  if (count of matches) = 0 then
    set matches to every terminal whose name contains needle
  end if
  if (count of matches) > 0 then
    focus terminal (item 1 of matches)
  end if
end tell
```

### Send Input to Focused Terminal (PR #11251)
```applescript
tell application "Ghostty"
  set term to focused terminal of selected tab of front window
  input text "pwd\n" to term
end tell
```

### Split the Focused Terminal (PR #11251)
```applescript
tell application "Ghostty"
  set currentTerm to focused terminal of selected tab of front window
  set newTerm to split currentTerm direction right
  input text "echo split-ready\n" to newTerm
end tell
```

---

## WibWob smoke test pattern

```bash
# 1. Confirm running
wibwob health

# 2. Click a menu (auto-calc coords from wibwob ls)
bash .pi/skills/ghostty-control/scripts/click-menu.sh "Core Apps"
sleep 0.3

# 3. Read result
wibwob screenshot

# 4. Close menu
osascript -e 'tell application "Ghostty" to send key "escape" to focused terminal of selected tab of front window'

# 5. Visual proof if needed
screencapture -x -D 1 /tmp/snap-$(date +%s).png
```

---

## Gotchas

**Coords off — click lands wrong**
Recalibrate: `osascript -e 'tell application "System Events" to tell process "Ghostty" to {position of window 1, size of window 1}'` — window may have moved.

**`send mouse position` has no effect**
Ghostty window not focused. Fix: `tell application "Ghostty" to activate window front window` before sending mouse events.

**`input text` goes to WibWob blessed, not a shell**
WibWob-DOS owns the terminal — blessed swallows unknown keystrokes. Use `send key` for TUI navigation or `wibwob commands/run` for actions. `input text` only works in a shell pane (split or separate tab).

**`focused terminal` error**
Another app is frontmost. Use `first terminal of first tab of first window` as a stable fallback.

**TCC permission denied**
System Settings → Privacy & Security → Automation → allow your terminal/app to control Ghostty.

**`wibwob screenshot` blank**
App not fully rendered yet. Add `sleep 0.5` before reading.

---

## References

- PR #11208 (main AppleScript implementation): https://github.com/ghostty-org/ghostty/pull/11208
- PR #11251 (front window + focused terminal): https://github.com/ghostty-org/ghostty/pull/11251
- Full scripting dictionary: `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`
