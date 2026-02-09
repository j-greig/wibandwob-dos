# Frame-File Player (Turbo Vision)

## Overview

- Plays ASCII animations by reading a text file and splitting frames on lines equal to `----` (CRLF safe).
- UI-thread timer advances frames every N ms (default 300 ms), no background threads.
- Renders the current frame inside a `TView`, truncating/padding to the view size.

## Architecture

- `FrameFilePlayerView` (TView)
  - Loads entire file into memory (`fileData`).
  - Indexes frames as `[start, end)` spans (`frames`).
  - Holds `frameIndex` and a `TTimerId` for periodic updates.
  - On `cmTimerExpired` → `frameIndex = (frameIndex + 1) % frames.size()` → `drawView()`.
  - `draw()` lays out rows: truncate long lines, pad short ones, fill remaining rows with spaces.

- `AnimWindow` (TWindow)
  - Hosts `FrameFilePlayerView` in its client area.

- `AnimApp` (TApplication)
  - Menubar: File → Exit (`cmQuit`, Alt-X). Status line shows shortcuts.
  - Uses `run()` so menubar/status line are active (F10 opens menu).

## File Format

- Optional header: `FPS=NN` (integer). If present on line 1, sets update period to `1000/NN` ms.
- Frame delimiter: a line exactly equal to `----` (allow `----\r\n`).
- If the file starts with `----`, the first frame starts after it.
- If the file ends without a closing delimiter, the tail is the last frame.
- If no delimiter is present, the whole file is one frame.

## FPS Precedence

1) Command line `--fps NN` (if provided). 2) File header `FPS=NN`. 3) Default = 300 ms per frame.

## Run

```bash
cd test-tui
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
cmake --build ./build
./build/frame_file_player --file frames_demo.txt           # default ~3.33 FPS
./build/frame_file_player --file frames_demo.txt --fps 30  # ~30 FPS
```

Tip: `TVISION_MAX_FPS=-1` can remove the refresh cap for smoother animation.

