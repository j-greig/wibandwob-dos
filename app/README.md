# Test TUI Applications

This directory contains test TUI applications built with Turbo Vision.

## Applications

### test_pattern
Multi-window test pattern generator with gradients and wallpaper:
- **Features**: Creates unlimited resizable windows with test patterns, gradient windows (horizontal, vertical, radial, diagonal), cascading/tiling window management, screenshot capability
- **Animations**: View → Animated Blocks, Animated Gradient, Animated Score (musical ASCII score)
- **Pattern modes**: Continuous (diagonal flowing patterns) or Tiled (cropped at window edges)
- **Background**: ASCII art wallpaper with custom desktop
- **Build**: `cmake . -B ./build && cmake --build ./build`
- **Run**: `./build/test_pattern`
- **Debug logging**: `./run_test_pattern_logged.sh` (logs to `test_pattern_debug.log` for session IDs, raw JSON, IPC traces)

### simple_tui
Basic TUI application demonstrating fundamental Turbo Vision usage:
- **Features**: Simple window with basic menu and status line
- **Purpose**: Learning/reference implementation
- **Build**: `cmake . -B ./build && cmake --build ./build`
- **Run**: `./build/simple_tui`

### frame_file_player
Timer-based ASCII animation player that loads frame files:
- **Features**: Plays frame-delimited text files using UI timers (no threads), configurable FPS, working menubar
- **File format**: Frames separated by `----` lines, optional `FPS=NN` header
- **Build**: `cmake . -B ./build && cmake --build ./build`
- **Run**: `./build/frame_file_player --file frames_demo.txt [--fps NN]`
- **Documentation**: See [FRAME_PLAYER.md](FRAME_PLAYER.md)

## Window Auto-sizing

When using File → Open Text/Animation… in the test pattern app, the window automatically sizes to fit the content:
- Text files: width = longest line; height = total lines.
- Animation files (`----`-delimited): sized to the largest frame (max width/height across frames).
The window never exceeds the desktop area and uses sensible minimum dimensions.

## Build System

All applications use CMake and link against the main Turbo Vision library:
```bash
# From test-tui directory
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
cmake --build ./build
```

## Files Structure

**Core Applications:**
- `test_pattern_app.cpp` - Main test pattern application
- `simple_tui.cpp` - Basic TUI example
- `frame_file_player_main.cpp` - Frame animation player

**Support Files:**
- `test_pattern.{h,cpp}` - Test pattern generation
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

The test_pattern app can be controlled remotely via a REST API + MCP server:

```bash
# 1. Setup API server (one-time)
cd ../tools/api_server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Run API server (from project root)
cd /path/to/tvision
./tools/api_server/venv/bin/python -m tools.api_server.main --port=8089

# 3. Run test_pattern app (separate terminal)
cd test-tui && ./build/test_pattern
```

**API Documentation**: See [../tools/api_server/README.md](../tools/api_server/README.md)
**Interactive Docs**: http://127.0.0.1:8089/docs
**MCP Integration**: http://127.0.0.1:8089/mcp (for Claude Code / AI agents)
