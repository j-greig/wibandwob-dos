# Manual Coord Calibration

Use this only when `calibrate.sh` doesn't work or you need to debug coord issues.
Prefer `bash scripts/calibrate.sh` for normal use.

Pixel coords are relative to the terminal content area, not the screen.

```bash
# Get window geometry
osascript -e 'tell application "System Events" to tell process "Ghostty" to {position of window 1, size of window 1}'
# → win_x, win_y, win_w, win_h

# Terminal dimensions from wibwob
wibwob health  # shows screen: COLSxROWS

# Formula
# cell_w = win_w / cols
# cell_h = (win_h - 28) / rows   (28px title bar)
# pixel_x = col * cell_w + cell_w / 2  (center of cell)
# pixel_y = row * cell_h + cell_h / 2
```

The 28px title bar offset is a magic number. If Ghostty changes tab bar height
or the user has a different config, this will silently break. There is no way to
query the content area offset programmatically.
