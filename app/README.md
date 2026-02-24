# TUI Applications (C++ Source Guide)

This directory contains the C++ Turbo Vision applications built in this repo.

Operational run recipes (tmux, API, screenshots, Docker) are documented in `.pi/skills/wibwobdos/SKILL.md`. API server behavior and endpoints live in `../tools/api_server/README.md`.

## Applications

### wwdos
Multi-window test pattern generator with gradients and wallpaper:
- **Features**: Creates unlimited resizable windows with test patterns, gradient windows (horizontal, vertical, radial, diagonal), cascading/tiling window management, screenshot capability
- **Animations**: View → Animated Blocks, Animated Gradient, Animated Score (musical ASCII score)
- **Pattern modes**: Continuous (diagonal flowing patterns) or Tiled (cropped at window edges)
- **Background**: ASCII art wallpaper with custom desktop
- **Build**: `cmake . -B ./build && cmake --build ./build`
- **Run**: `./build/app/wwdos`
- **Debug logging**: `./run_wwdos_logged.sh` (logs to `wibwob_debug.log` for session IDs, raw JSON, IPC traces)

### simple_tui
Basic TUI application demonstrating fundamental Turbo Vision usage:
- **Features**: Simple window with basic menu and status line
- **Purpose**: Learning/reference implementation
- **Build**: `cmake . -B ./build && cmake --build ./build`
- **Run**: `./build/app/simple_tui`

### frame_file_player
Timer-based ASCII animation player that loads frame files:
- **Features**: Plays frame-delimited text files using UI timers (no threads), configurable FPS, working menubar
- **File format**: Frames separated by `----` lines, optional `FPS=NN` header
- **Build**: `cmake . -B ./build && cmake --build ./build`
- **Run**: `./build/app/frame_file_player --file app/frames_demo.txt [--fps NN]`
- **Documentation**: See [FRAME_PLAYER.md](FRAME_PLAYER.md)

## Window Auto-sizing

When using File → Open Text/Animation… in the wwdos app, the window automatically sizes to fit the content:
- Text files: width = longest line; height = total lines.
- Animation files (`----`-delimited): sized to the largest frame (max width/height across frames).
The window never exceeds the desktop area and uses sensible minimum dimensions.

## Build System

All applications use CMake and link against the main Turbo Vision library:
```bash
# From repo root
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
cmake --build ./build
```

## Files Structure

**Core Applications:**
- `wwdos_app.cpp` - Main test pattern application
- `simple_tui.cpp` - Basic TUI example
- `frame_file_player_main.cpp` - Frame animation player

**Support Files:**
- `test_pattern.h`, `test_pattern.cpp` - Test pattern generation
- `gradient.{h,cpp}` - Gradient rendering views  
- `wallpaper.{h,cpp}` - ASCII art wallpaper
- `frame_file_player_view.{h,cpp}` - Animation player view
- `animated_blocks_view.{h,cpp}` - Color block animation view
- `animated_gradient_view.{h,cpp}` - Flowing gradient animation view
- `animated_score_view.{h,cpp}` - Musical-score style ASCII animation
- `CMakeLists.txt` - Build configuration
- `frames_demo.txt` - Sample animation file

**Documentation:**
- `README.md` - This file
- `FRAME_PLAYER.md` - Animation player documentation

## Programmatic Control API

The WibWob-DOS app can be controlled remotely via a REST API + MCP server.
Keep operational setup commands in one place:

- **Ops manual (authoritative)**: `.pi/skills/wibwobdos/SKILL.md`
- **API server details + endpoint examples**: [../tools/api_server/README.md](../tools/api_server/README.md)
- **Interactive docs** (when server is running): `http://127.0.0.1:8089/docs`

**MCP Integration**: http://127.0.0.1:8089/mcp (for Claude Code / AI agents)
