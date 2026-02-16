---
name: ww-scaffold-view
description: Scaffold a new TView window type for WibWob-DOS. Generates C++ header/implementation, patches CMakeLists.txt, and optionally wires menu, command registry, IPC, REST, and MCP surfaces based on requested parity scope. Use when user says "scaffold view", "new view", "add window type", "ww-scaffold-view", or describes wanting a new TView subclass in the TUI app.
---

# ww-scaffold-view

Scaffold a new TView window type across WibWob-DOS command surfaces.

## Inputs

Ask for any not provided:

| Input | Required | Example | Notes |
|-------|----------|---------|-------|
| `view_name` | yes | `particle_field` | snake_case, becomes `TParticleFieldView` |
| `window_title` | yes | `"Particle Field"` | Human-readable for TWindow |
| `type` | yes | `view-only` | `view-only`, `window+view`, `browser-like`, `animation-like` |
| `parity_scope` | no | `ui+registry` | `ui-only`, `ui+registry`, `full-parity`. Default: `ui+registry` |
| `issue_id` | no | `#42` | Required for non-trivial work per repo canon |
| `description` | no | `Animated particle system` | One-line for comments and registry |

## Parity Scope

| Scope | C++ | CMake | Menu | Registry | IPC | REST | MCP | Py models |
|-------|-----|-------|------|----------|-----|------|-----|-----------|
| `ui-only` | yes | yes | yes | - | - | - | - | - |
| `ui+registry` | yes | yes | yes | yes | - | - | - | - |
| `full-parity` | yes | yes | yes | yes | yes | yes | yes | yes |

## Procedure

### 1. Find next command ID
Scan `app/test_pattern_app.cpp` for highest `const ushort cm* = NNN;`, use NNN+1.

### 2. Generate C++ files
Create `app/{name}_view.h` and `app/{name}_view.cpp`. See `references/templates.md` for exact templates by type.

### 3. Patch CMakeLists
Add `{name}_view.cpp` to `test_pattern` sources in `app/CMakeLists.txt`.

### 4. Patch test_pattern_app.cpp
1. `#include "{name}_view.h"` near other view includes (~line 77)
2. `const ushort cm{PascalName} = {next_id};` with command constants
3. Forward-declare factory: `class TWindow; TWindow* create{PascalName}Window(const TRect &bounds);`
4. Menu item under View (Generative/Animated/Utility)
5. `handleEvent` case dispatching to factory

### 5. Patch registry (if `ui+registry` or `full-parity`)
In `app/command_registry.cpp`:
- Add capability: `{"open_{name}", "Open {title} window", false}`
- Add dispatch case in `exec_registry_command()`

### 6. Patch Python surfaces (only `full-parity`)
- `tools/api_server/models.py` — `WindowType` enum value
- `tools/api_server/controller.py` — `create_window()` case
- `tools/api_server/mcp_tools.py` — update valid types in docstring

### 7. Build
```bash
cmake --build ./build --target test_pattern 2>&1
```

### 8. Parity report
```
PARITY REPORT: {name}_view
============================
registry:  yes/no
menu:      yes/no
ipc:       yes/no
rest:      yes/no
mcp:       yes/no
schemas:   yes/no
```

## Guardrails
- Never raw ANSI in TDrawBuffer. `browser-like` types include parse boundary comments.
- Files: `snake_case.cpp/.h`. Classes: `T{PascalCase}View`. Factory: `create{PascalCase}Window`.
- `gfGrowHiX | gfGrowHiY` growMode. `ofTileable` on TWindow.
- Animated types use `TTimerId` pattern from `animated_blocks_view`.

## Acceptance
- `cmake --build ./build --target test_pattern` passes
- No unused command IDs
- Parity report clean for requested scope
