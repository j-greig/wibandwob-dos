---
name: ghostty-control
description: >
  TERMINAL EMULATOR LAYER — control Ghostty itself, below WibWob-DOS.
  Uses AppleScript to act as a human at the keyboard/mouse: click blessed
  menu items, send keystrokes, inject shell commands, take PNG screenshots,
  ghost-click TUI cells. Use when: clicking a menu, sending a keystroke,
  restarting the TUI, smoke-testing the UI, simulating user input.
  NOT for: opening microapps, reading window content, or anything the HTTP
  API can do — use wibwobdos-control for that.
  Typical sequence: ghostty-control to act → wibwobdos-control to verify.
  macOS only. Requires Ghostty >= 1.3.0.
  Scripts: calibrate.sh, click-cell.sh, click-text.sh, menu-click.sh,
  send-to-terminal.sh, wait-for.sh, restart-wibwob.sh, ghostty-windows.sh.
---

# Ghostty AppleScript Control

> **Layer:** terminal emulator (below WibWob-DOS) · **Sibling:** `wibwobdos-control` (application layer above)
> If the HTTP API can do it — use `wibwobdos-control`. If it needs a human at the keyboard — use this.

Drive WibWob-DOS TUI as a human would — click menus, send keys, move the mouse.
macOS only. Requires Ghostty >= 1.3.0 with AppleScript enabled.

## Scripts — signatures and valid flags

> **Before invoking any script, run this to see every script's real args and flags:**
> ```bash
> bash .pi/skills/ghostty-control/scripts/index.sh
> ```
> **Do not guess flags.** These scripts have minimal, specific interfaces — not generic CLI conventions. There is no `--port`, no `--help`. If a flag isn't shown by `index.sh`, it doesn't exist.

All scripts auto-detect the running wibwob instance. No port or instance args needed.

Common usage:

```bash
bash .pi/skills/ghostty-control/scripts/menu-click.sh "File" "Quit"
bash .pi/skills/ghostty-control/scripts/click-cell.sh 35 3
bash .pi/skills/ghostty-control/scripts/click-cell.sh 75 36 --single
bash .pi/skills/ghostty-control/scripts/send-to-terminal.sh wibandwob-dos "bun run dev"
bash .pi/skills/ghostty-control/scripts/wait-for.sh health
bash .pi/skills/ghostty-control/scripts/wait-for.sh window "Figlet" --timeout 5
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
| Visual verification | `bash scripts/ghostty-capture.sh --port <n> /tmp/snap.png` | Targets exact Ghostty window by port — no display guessing |
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
bash scripts/ghostty-capture.sh --port <n> /tmp/snap.png  # visual proof — exact window, any display
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
Can't see which menu item is hovered. Use `ghostty-capture.sh --port <n>` for visual proof.

**Wrong Ghostty window targeted.**
With multiple windows, `front window` may not be the WibWob TUI. `calibrate.sh`
finds the right window by matching terminal `working directory` to "wibandwob-dos".

## References

- [references/applescript-api.md](references/applescript-api.md) — objects, commands, key names, worked examples
- [references/coord-calibration.md](references/coord-calibration.md) — manual pixel math (when scripts break)
- Full scripting dictionary: `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`
