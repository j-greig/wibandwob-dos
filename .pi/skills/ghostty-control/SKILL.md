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
  "act like a human in the TUI", "test by clicking", "screenshot the TUI".
  macOS only. Requires Ghostty >= 1.3.0.
---

# Ghostty AppleScript — TUI Automation

Ghostty ships a full AppleScript dictionary (merged in 1.3.0, PRs #11208 #11251).
Use it to drive the WibWob-DOS TUI as a human would — click menus, send keys,
move the mouse — then read results via tmux capture-pane or the API.

macOS only. Requires `System Events` TCC permission (macOS will prompt once).

---

## Quick reference

```applescript
tell application "Ghostty"
  set t to focused terminal of selected tab of front window

  -- Type text + submit
  input text "curl -sf localhost:8099/health\n" to t

  -- Send a named key (with optional modifiers)
  send key "escape" to t
  send key "q" modifiers "control" to t

  -- Click at pixel coords relative to the terminal content area
  send mouse position x 294.0 y 8.0 to t
  send mouse button left button action press to t
  send mouse button left button action release to t

  -- Perform a Ghostty action string
  perform action "new_window" on t
end tell
```

---

## Coord calibration (required before clicking)

Pixel coords are relative to the terminal content area (not the screen).
Calibrate once per session — window position and font size can change.

```bash
bash .pi/skills/ghostty-applescript/scripts/get-coords.sh
# → window: x=1111 y=156 w=1384 h=1167
# → terminal: 173 cols x 66 rows
# → cell: 8.0 x 17.3 px
# → formula: pixel_x = col * cell_w, pixel_y = row * cell_h
```

Or inline:
```bash
osascript -e 'tell application "System Events" to tell process "Ghostty" to {position of window 1, size of window 1}'
# → win_x, win_y, win_w, win_h
# cell_w = win_w / cols (cols from: tmux capture-pane -t wibwob -p | head -1 | wc -c)
# cell_h = (win_h - 28) / rows  (28px title bar)
```

---

## Read the TUI after acting

```bash
# Text dump — primary method, works headless
tmux capture-pane -t wibwob -p | head -15

# Full dump, strip blank lines
tmux capture-pane -t wibwob -p | grep -v '^[[:space:]]*$' | head -20

# API semantic state — for assertions
curl -sf localhost:8099/state | python3 -m json.tool
curl -sf localhost:8099/errors/recent
```

---

## Common patterns

### Click a menu item by column position

```bash
bash .pi/skills/ghostty-applescript/scripts/click-menu.sh "Core Apps"
# Reads col position from tmux dump, calibrates coords, clicks, waits 0.3s
# Prints tmux dump of result (menu open or window changed)
```

### Open a microapp and verify it appeared

```bash
# Via API (preferred — no coord calibration needed)
curl -sf -X POST localhost:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.notepad.open"}'
sleep 0.5
tmux capture-pane -t wibwob -p | grep -i notepad

# Via AppleScript click (proves menu path works end-to-end)
bash .pi/skills/ghostty-applescript/scripts/click-menu.sh "Core Apps"
sleep 0.3
osascript -e '
  tell application "Ghostty"
    set t to focused terminal of selected tab of front window
    send mouse position x 294.0 y 60.0 to t
    send mouse button left button action press to t
    send mouse button left button action release to t
  end tell'
sleep 0.5
tmux capture-pane -t wibwob -p | head -20
```

### Send Escape to close a menu or dialog

```applescript
tell application "Ghostty"
  send key "escape" to focused terminal of selected tab of front window
end tell
```

### Screenshot for visual proof

```bash
screencapture -x -D 1 /tmp/tui-snap.png
# Then attach /tmp/tui-snap.png as evidence in your session notes
```

---

## Ensure app is running first

```bash
curl -sf --max-time 2 localhost:8099/health || bash scripts/ensure-running.sh --tmux
tmux list-sessions   # should show: wibwob: 1 windows
```

---

## Gotchas

**Coords off — click lands in wrong place**
Cause: window moved or font size changed since last calibration.
Fix: re-run `get-coords.sh` and recalculate. Coords are relative to terminal
content area, not screen. Title bar (~28px) is excluded from the y origin.

**`send mouse position` has no effect**
Cause: Ghostty window not focused / mouse tracking not enabled in the TUI.
Fix: `activate window` first, then send mouse events.
```applescript
tell application "Ghostty"
  activate window front window
  delay 0.2
  -- now send mouse events
end tell
```

**AppleScript permission error**
Cause: macOS TCC hasn't granted permission for the calling app (Terminal, pi, etc).
Fix: System Preferences → Privacy & Security → Automation → allow your terminal.
Or run from Ghostty's own Script Editor where permissions are implicit.

**`focused terminal` returns error in split panes**
Cause: `front window` may not have focus if another app is frontmost.
Fix: use `first terminal of first tab of first window` for a stable reference
when focus state is uncertain.

**tmux capture shows old content**
Cause: pane not updated yet — TUI renders asynchronously.
Fix: add `sleep 0.3` after any click/keystroke before capturing.
For menu open/close, 0.3s is sufficient. For microapp open, use 0.5–1s
or poll `curl localhost:8099/state` until window count changes.

---

## References

- Ghostty AppleScript PR (main implementation): https://github.com/ghostty-org/ghostty/pull/11208
- Front window + focused terminal properties: https://github.com/ghostty-org/ghostty/pull/11251
- Full scripting dictionary: `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`
  (open in Script Editor for browsable reference)
