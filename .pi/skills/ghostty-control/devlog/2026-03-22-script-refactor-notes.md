# Script Refactor Notes — 2026-03-22

## Current call graph (wasteful)

```
menu-click.sh "File" "Quit"
  ├── wibwob health | awk        ← port detection #1
  ├── curl /menu/list            ← API call
  ├── click-cell.sh COL 0 --single
  │     ├── calibrate.sh         ← port detection #2 + osascript window scan #1 + curl health #2
  │     └── osascript (click)
  └── click-cell.sh COL ROW
        ├── calibrate.sh         ← port detection #3 + osascript window scan #2 + curl health #3
        └── osascript (click)
```

3× port detection, 2× window scan, 3× curl health, 2× python cell calc.
For clicking ONE menu item.

## Target call graph

```
menu-click.sh "File" "Quit"
  ├── eval $(calibrate.sh)       ← once
  ├── curl /menu/list            ← once
  ├── click-cell.sh COL 0 --single   ← uses exported CELL_W/CELL_H
  └── click-cell.sh COL ROW         ← reuses same vars
```

1× everything.

## The lego bricks

### Brick 1: `calibrate.sh` (data only, no side effects)
Outputs shell vars. Already correct. No changes needed.

### Brick 2: `click-cell.sh` (atomic click action)
Takes col, row. Should:
- Check for CELL_W/CELL_H/GHOSTTY_WIN_INDEX env vars first
- Only call calibrate.sh if they're missing
- Single AppleScript with click count param (not two copy-pasted blocks)

### Brick 3: `click-text.sh` (find + click)
Takes a string. Searches screenshot for it, gets row/col, calls click-cell.
Options: --row-hint N (disambiguate), --single, --window-id N

### Brick 4: `menu-click.sh` (composed workflow)
Calibrates once, exports vars, calls click-cell twice.
Uses /menu/list API — no screenshot parsing.

### Brick 5: `send-to-terminal.sh` (standalone, already clean)
Doesn't need calibration — pure AppleScript terminal matching.
No changes needed.

### Brick 6: `ghostty-windows.sh` (standalone, already clean)
Pure AppleScript query. No changes needed.

## DRY fixes

### click-cell.sh — single AppleScript, env var passthrough

Before: two copy-pasted osascript blocks (single vs double click)
After: one osascript with click count

```bash
# If CELL_W is set, skip calibrate
if [[ -z "${CELL_W:-}" ]]; then
  eval "$("${SCRIPT_DIR}/calibrate.sh")"
fi

CLICKS=$($SINGLE && echo 1 || echo 2)

osascript <<EOF
tell application "Ghostty"
  activate
  delay 0.3
  set t to focused terminal of selected tab of front window
  set px to (${COL}.0 * ${CELL_W} + ${CELL_W} / 2.0)
  set py to (${ROW}.0 * ${CELL_H} + ${CELL_H} / 2.0)
  repeat ${CLICKS} times
    send mouse position x px y py to t
    delay 0.1
    send mouse button left button action press to t
    delay 0.05
    send mouse button left button action release to t
    delay 0.15
  end repeat
end tell
EOF
```

### menu-click.sh — calibrate once, export, pass to children

```bash
eval "$("${SCRIPT_DIR}/calibrate.sh")"
export CELL_W CELL_H GHOSTTY_WIN_INDEX PORT

# click-cell.sh will see the exported vars and skip calibrating
bash "${SCRIPT_DIR}/click-cell.sh" "$MENU_COL" 0 --single
```

### menu-click.sh — safe python arg passing

Before (breaks on quotes in labels):
```python
label = '$MENU_LABEL'
```

After:
```bash
echo "$MENU_DATA" | python3 - "$MENU_LABEL" <<'PYEOF'
import json, sys
data = json.load(sys.stdin)['result']
label = sys.argv[1]
...
PYEOF
```

## New script: click-text.sh

```bash
# Usage:
#   bash click-text.sh "OK"              # find "OK" on screen, click it
#   bash click-text.sh "Quit" --single   # single click
#   bash click-text.sh "OK" --row 36     # hint: only search row 36

# Implementation:
# 1. wibwob screenshot
# 2. python: find text, return row + col
# 3. click-cell.sh row col
```

## Deleted

- `get-coords.sh` — superseded by calibrate.sh, removed.
