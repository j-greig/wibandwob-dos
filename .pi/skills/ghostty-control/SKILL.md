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
  Scripts: calibrate.sh, click-cell.sh, click-text.sh, menu-click.sh,
  send-to-terminal.sh, wait-for.sh, restart-wibwob.sh, ghostty-windows.sh.
---

# Ghostty AppleScript Control

Drive WibWob-DOS TUI as a human would — click menus, send keys, move the mouse.
macOS only. Requires Ghostty >= 1.3.0 with AppleScript enabled.

## Scripts — use these first

```bash
bash .pi/skills/ghostty-control/scripts/index.sh   # list all scripts
```

All scripts auto-detect the running wibwob instance. No port or instance args needed.

```bash
# Click a menu item by name
bash .pi/skills/ghostty-control/scripts/menu-click.sh "File" "Quit"
bash .pi/skills/ghostty-control/scripts/menu-click.sh "Core Apps" "Figlet Banner"

# Click any TUI cell (double-click default, --single for one click)
bash .pi/skills/ghostty-control/scripts/click-cell.sh 35 3
bash .pi/skills/ghostty-control/scripts/click-cell.sh 75 36 --single

# Send a command to a Ghostty terminal matched by cwd
bash .pi/skills/ghostty-control/scripts/send-to-terminal.sh wibandwob-dos "bun run dev"

# List Ghostty windows with sizes and terminal cwds
bash .pi/skills/ghostty-control/scripts/ghostty-windows.sh

# Get cell dimensions (for manual coord work)
eval "$(bash .pi/skills/ghostty-control/scripts/calibrate.sh)"
```

## When to use what

| Task | Tool | Why |
|---|---|---|
| Open a microapp | `wibwob cmd <id>` or API | Bypasses menu, most reliable |
| Set overlay text | `POST /overlay/set-text` | Direct, no mouse needed |
| Confirm/cancel overlay | `POST /overlay/confirm` | Direct, no mouse needed |
| Click a menu item | `menu-click.sh` | Uses `/menu/list` API for positions |
| Click a button visible on screen | `click-cell.sh` | Find row/col from screenshot |
| Type into a shell terminal | `send-to-terminal.sh` | Clears line, types, presses enter |
| Navigate TUI with keyboard | Raw `send key` AppleScript | For escape, tab, letters |
| Visual verification | `screencapture -x -D 1 /tmp/snap.png` | Only way to see colors |
| Semantic verification | `wibwob state` / `wibwob windows` | Structured, parseable |
| Find text position on screen | `wibwob screenshot` + Python `.find()` | For dynamic click targets |

## Finding click targets

For buttons, labels, or other text visible on screen:

```bash
# Find row and col of text
wibwob screenshot | python3 -c "
import sys
for i, line in enumerate(sys.stdin.readlines()):
    if 'OK' in line:
        print(f'row={i} col={line.find(\"OK\")}')
        break
"
# Then click it
bash .pi/skills/ghostty-control/scripts/click-cell.sh <col> <row>
```

For menu items, use the API — no screenshot parsing needed:

```bash
curl -sf http://127.0.0.1:$(wibwob health 2>&1 | awk '/^port:/{print $2}')/menu/list
```

## Read results

```bash
wibwob screenshot          # text screenshot (strips ANSI)
wibwob state               # full semantic state as JSON
wibwob windows             # list open windows
screencapture -x -D 1 /tmp/snap.png   # visual proof (PNG)
```

## Raw AppleScript (when scripts don't cover it)

```applescript
tell application "Ghostty"
  set t to focused terminal of selected tab of front window
  input text "some text" to t              -- paste-style input
  send key "enter" to t                    -- press enter
  send key "c" modifiers "control" to t    -- Ctrl+C
  send key "escape" to t                   -- escape key
end tell
```

Read [references/applescript-api.md](references/applescript-api.md) for the full
object model, command table, and worked examples (splits, broadcasts, layouts).

## Gotchas

**Blessed menu items need double-click.**
Single click dismisses without selecting. `menu-click.sh` and `click-cell.sh`
handle this automatically (double-click by default).

**`input text` does not interpret `\n` as enter.**
Use `send key "enter"` after `input text`. `send-to-terminal.sh` does this for you.

**Always clear the line before sending commands.**
Stray human input concatenates with yours. `send-to-terminal.sh` sends Ctrl+C +
Ctrl+U automatically. For raw AppleScript, do it manually.

**`focus t` not `focus terminal t`.**
Terminal references from `whose` filters are already typed — `focus terminal t`
throws a coercion error.

**Valid key names: `enter`, `escape`, `space`, single letters.**
`return` and `down` do NOT work. Arrow keys may not be supported.

**`wibwob screenshot` strips ANSI — no highlight visibility.**
Can't see which menu item is hovered. Use `screencapture` for visual proof.

**Wrong Ghostty window targeted.**
With multiple windows, `front window` may not be the WibWob TUI. `calibrate.sh`
finds the right window by matching terminal `working directory` to "wibandwob-dos".

## References

- [references/applescript-api.md](references/applescript-api.md) — objects, commands, key names, worked examples
- [references/coord-calibration.md](references/coord-calibration.md) — manual pixel math (when scripts break)
- Full scripting dictionary: `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`
