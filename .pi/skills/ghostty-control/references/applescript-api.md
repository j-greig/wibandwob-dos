# Ghostty AppleScript API Reference

Full scripting dictionary: `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`

## Objects

| Object | Key Properties | Key Elements |
|---|---|---|
| `application` | `name`, `frontmost`, `version` | `windows`, `terminals` |
| `window` | `id`, `name`, `selected tab` | `tabs`, `terminals` |
| `tab` | `id`, `name`, `index`, `selected`, `focused terminal` | `terminals` |
| `terminal` | `id`, `name`, `working directory` | — |

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

## Quick reference

```applescript
tell application "Ghostty"
  set t to focused terminal of selected tab of front window

  input text "some text" to t                           -- paste-style input
  send key "escape" to t                                -- named key
  send key "q" modifiers "control" to t                 -- with modifier

  -- Click at pixel coords (relative to terminal content area)
  send mouse position x 294.0 y 8.0 to t
  send mouse button left button action press to t
  send mouse button left button action release to t

  send mouse scroll x 0.0 y 3.0 to t                   -- scroll down
  perform action "new_window" on t                      -- Ghostty action string
end tell
```

## Valid key names

Tested and confirmed working: `enter`, `escape`, `space`, single letters (`a`–`z`).
**Do NOT work:** `return`, `down`, `up`, `left`, `right`.
Modifiers: `"control"`, `"shift"`, `"alt"`, `"super"`.

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

### Split the focused terminal
```applescript
tell application "Ghostty"
  set currentTerm to focused terminal of selected tab of front window
  set newTerm to split currentTerm direction right
  input text "echo split-ready" to newTerm
  send key "enter" to newTerm
end tell
```

## References

- PR #11208 (main AppleScript implementation): https://github.com/ghostty-org/ghostty/pull/11208
- PR #11251 (front window + focused terminal): https://github.com/ghostty-org/ghostty/pull/11251
