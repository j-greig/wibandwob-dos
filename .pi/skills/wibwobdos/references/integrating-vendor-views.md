# Integrating Vendor View Libraries into WibWob-DOS

Retrospective from tvterm integration (Feb 2026). Applies to any external Turbo Vision widget library.

## The checklist

Adding a vendor TView subclass (e.g. tvterm's `BasicTerminalWindow`) touches exactly these surfaces:

| # | Surface | File(s) | Notes |
|---|---------|---------|-------|
| 1 | Git submodule | `.gitmodules`, `vendor/<lib>` | `git submodule add <url> vendor/<name>` |
| 2 | CMake build | root `CMakeLists.txt` | Build the vendor lib as a static lib target |
| 3 | CMake link | `app/CMakeLists.txt` | Add .cpp to sources, link the new target |
| 4 | C++ wrapper | `app/<name>_view.h`, `app/<name>_view.cpp` | Thin subclass + factory function |
| 5 | Command ID | `test_pattern_app.cpp` | New `cmXxx` constant in the 100-299 range |
| 6 | Menu item | `test_pattern_app.cpp` `initMenuBar()` | Under appropriate menu (Window, Tools, etc.) |
| 7 | handleEvent | `test_pattern_app.cpp` | Case for new command ID |
| 8 | API function | `test_pattern_app.cpp` | `api_spawn_xxx()` + `friend` declaration |
| 9 | Command registry | `app/command_registry.cpp` | Capability entry + dispatch case |
| 10 | Window type registry | `app/window_type_registry.cpp` | spawn/match + k_specs table entry |
| 11 | Test stubs | `command_registry_test.cpp`, `scramble_engine_test.cpp` | Stub for each new extern |
| 12 | Python model | `tools/api_server/models.py` | Add to `WindowType` enum |
| 13 | Python controller | `tools/api_server/controller.py` | Dispatch in `create_window()` |
| 14 | MCP docstring | `tools/api_server/mcp_tools.py` | Update `tui_create_window` docstring |

All 14 surfaces must be touched or the drift tests / link will fail.

## Gotchas discovered

### Duplicate tvision target
If the vendor lib bundles its own copy of tvision (tvterm does), do NOT use its top-level `CMakeLists.txt` via `add_subdirectory()`. Instead, build only the library sources yourself:

```cmake
file(GLOB LIB_SRCS vendor/<name>/source/<lib>/*.cc)
add_library(<lib> STATIC ${LIB_SRCS})
target_include_directories(<lib> PUBLIC vendor/<name>/include)
target_link_libraries(<lib> PUBLIC tvision <other-deps>)
```

This avoids the "target tvision already defined" CMake error.

### Command ID ranges
- App commands: 100-299 (currently up to 214)
- Vendor-internal command IDs: use 500+ to avoid collisions
- tvterm uses `TVTermConstants` struct to receive command IDs at construction time, which is the clean pattern

### idle() broadcast requirement
Some vendor widgets need periodic refresh (e.g. tvterm needs `cmCheckTerminalUpdates` broadcast). Add the broadcast to `TTestPatternApp::idle()`. This is easy to forget and causes the view to appear frozen.

### KeyDownEvent has no setText()
The tvision `KeyDownEvent` struct exposes `text[maxCharSize]` and `textLength` fields directly. There is a `getText()` method but no `setText()`. For programmatic input, set the fields directly:

```cpp
termEvent.keyDown.text[0] = static_cast<char>(ch);
termEvent.keyDown.textLength = 1;
```

### Submodule init order
The tvision submodule (`vendor/tvision`) must be initialized before building. If CI or a fresh clone fails, check `git submodule update --init --recursive`.

### Test stub symmetry
Both test executables (`command_registry_test`, `scramble_engine_test`) link `command_registry.cpp` and therefore need stubs for every `extern` function it references. When adding a new API function, update BOTH test files or the link will fail.

## Verification sequence

```bash
# 1. Build
cmake . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build

# 2. Run ctests (must all pass)
ctest --test-dir build --output-on-failure

# 3. Run Python room tests (should show no regressions)
uv run --with pytest pytest tests/room/ -q

# 4. Manual: launch app, open terminal from Window menu, type in it
./build/app/test_pattern

# 5. API test: open terminal via IPC
curl -X POST http://127.0.0.1:8089/exec -d '{"command":"open_terminal"}'
curl -X POST http://127.0.0.1:8089/exec -d '{"command":"terminal_write","args":{"text":"ls\n"}}'
```

## Template for future integrations

When starting a new vendor view integration, copy this checklist and work through it top-to-bottom. The order matters: CMake first (ensures compilation feedback), then C++ wiring, then registries, then Python parity, then tests.
