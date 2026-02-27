# Window Types Catalogue

**Source of Truth:** `app/window_type_registry.cpp` (k_specs table)  
**Last Updated:** 2026-02-27  
**Total Registered:** 36 window types  
**Agent-Spawnable:** 35 (all except "scramble")

---

## Registry Summary

The window type registry (`app/window_type_registry.cpp`) is the **single source of truth** for all spawnable window types. Each entry in the `k_specs[]` table contains:

1. **type** (slug): Canonical name used by agents via IPC `create_window` command
2. **spawn** (function pointer): Agent-spawnable if non-null; null = menu-only or internal
3. **matches** (function pointer): Runtime type identification for serialization/restoration

---

## All Registered Window Types

### 1. test_pattern
- **Slug:** `test_pattern`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_test`)
- **Match Function:** `match_test_pattern` (always returns false; falls back to first entry)
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds; uses default if omitted)
- **Created By:** `api_spawn_test()`
- **Window Class:** `TTestPatternWindow` (local to wwdos_app.cpp, not exported)
- **View Class:** `TTestPatternView` (local)
- **Notes:** Fallback type when no matcher hits. App only spawns if no registered type matches.

---

### 2. gradient
- **Slug:** `gradient`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_gradient`)
- **Match Function:** `match_gradient`
- **Properties Accepted:**
  - `gradient` (optional, default: "horizontal") — gradient direction/style
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_gradient()`
- **Window Class:** `TGradientWindow` (local to wwdos_app.cpp)
- **View Class:** `TGradientView`
- **Include:** `#include "gradient.h"`
- **Notes:** Displays procedural gradient. Gradient param controls direction.

---

### 3. frame_player
- **Slug:** `frame_player`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_frame_player`)
- **Match Function:** `match_frame_player`
- **Properties Accepted:**
  - `path` (required) — path to animation frames file or directory
  - `frameless` (optional, default: false) — "1"/"true" to hide frame border
  - `shadowless` (optional, default: false) — "1"/"true" to hide shadow
  - `title` (optional) — custom window title
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_open_animation_path()`
- **Window Class:** `TFrameAnimationWindow`
- **View Classes:** `FrameFilePlayerView`, `TTextFileView` (also matched)
- **Include:** `#include "frame_file_player_view.h"`
- **Error Handling:** Returns "err missing path" if path omitted

---

### 4. text_view
- **Slug:** `text_view`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_text_view`)
- **Match Function:** `match_text_view`
- **Properties Accepted:**
  - `path` (required) — path to text file to display
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_open_text_view_path()`
- **Window Class:** `TTransparentTextWindow`
- **View Class:** `TTextFileView` (wrapped)
- **Include:** `#include "transparent_text_view.h"`
- **Error Handling:** Returns "err missing path" if path omitted

---

### 5. text_editor
- **Slug:** `text_editor`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_text_editor`)
- **Match Function:** `match_text_editor`
- **Properties Accepted:**
  - `title` (optional, default: "Text Editor") — window title
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_text_editor()`
- **Window Class:** `TTextEditorWindow`
- **View Class:** `TTextEditorView`
- **Include:** `#include "text_editor_view.h"`

---

### 6. browser
- **Slug:** `browser`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_browser`)
- **Match Function:** `match_browser`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_browser()`
- **Window Class:** `TBrowserWindow`
- **View Class:** `TBrowserView`
- **Include:** `#include "browser_view.h"`

---

### 7. verse
- **Slug:** `verse`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_verse`)
- **Match Function:** `match_verse`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_verse()`
- **Window Class:** `TGenerativeVerseWindow`
- **View Class:** `TGenerativeVerseView`
- **Include:** `#include "generative_verse_view.h"`

---

### 8. mycelium
- **Slug:** `mycelium`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_mycelium`)
- **Match Function:** `match_mycelium`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_mycelium()`
- **Window Class:** `TGenerativeMyceliumWindow`
- **View Class:** `TGenerativeMyceliumView`
- **Include:** `#include "generative_mycelium_view.h"`

---

### 9. orbit
- **Slug:** `orbit`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_orbit`)
- **Match Function:** `match_orbit`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_orbit()`
- **Window Class:** `TGenerativeOrbitWindow`
- **View Class:** `TGenerativeOrbitView`
- **Include:** `#include "generative_orbit_view.h"`

---

### 10. torus
- **Slug:** `torus`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_torus`)
- **Match Function:** `match_torus`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_torus()`
- **Window Class:** `TGenerativeTorusWindow`
- **View Class:** `TGenerativeTorusView`
- **Include:** `#include "generative_torus_view.h"`

---

### 11. cube
- **Slug:** `cube`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_cube`)
- **Match Function:** `match_cube`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_cube()`
- **Window Class:** `TGenerativeCubeWindow`
- **View Class:** `TGenerativeCubeView`
- **Include:** `#include "generative_cube_view.h"`

---

### 12. life
- **Slug:** `life`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_life`)
- **Match Function:** `match_life`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_life()`
- **Window Class:** `TGameOfLifeWindow`
- **View Class:** `TGameOfLifeView`
- **Include:** `#include "game_of_life_view.h"`

---

### 13. blocks
- **Slug:** `blocks`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_blocks`)
- **Match Function:** `match_blocks`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_blocks()`
- **Window Class:** `TAnimatedBlocksWindow`
- **View Class:** `TAnimatedBlocksView`
- **Include:** `#include "animated_blocks_view.h"`

---

### 14. score
- **Slug:** `score`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_score`)
- **Match Function:** `match_score`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_score()`
- **Window Class:** `TAnimatedScoreWindow`
- **View Class:** `TAnimatedScoreView`
- **Include:** `#include "animated_score_view.h"`

---

### 15. ascii
- **Slug:** `ascii`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_ascii`)
- **Match Function:** `match_ascii`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_ascii()`
- **Window Class:** `TAnimatedAsciiWindow`
- **View Class:** `TAnimatedAsciiView`
- **Include:** `#include "animated_ascii_view.h"`

---

### 16. animated_gradient
- **Slug:** `animated_gradient`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_animated_gradient`)
- **Match Function:** `match_animated_gradient`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_animated_gradient()`
- **Window Class:** `TAnimatedGradientWindow`
- **View Class:** `TAnimatedHGradientView`
- **Include:** `#include "animated_gradient_view.h"`

---

### 17. monster_cam
- **Slug:** `monster_cam`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_monster_cam`)
- **Match Function:** `match_monster_cam`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_monster_cam()`
- **Window Class:** `TGenerativeMonsterCamWindow`
- **View Class:** `TGenerativeMonsterCamView`
- **Include:** `#include "generative_monster_cam_view.h"`

---

### 18. monster_verse
- **Slug:** `monster_verse`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_monster_verse`)
- **Match Function:** `match_monster_verse`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_monster_verse()`
- **Window Class:** `TGenerativeMonsterVerseWindow`
- **View Class:** `TGenerativeMonsterVerseView`
- **Include:** `#include "generative_monster_verse_view.h"`

---

### 19. contour_map
- **Slug:** `contour_map`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_contour_map`)
- **Match Function:** `match_contour_map`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_contour_map()`
- **Window Class:** `TContourMapWindow`
- **View Class:** `TContourMapView`
- **Include:** `#include "contour_map_view.h"`

---

### 20. generative_lab
- **Slug:** `generative_lab`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_generative_lab`)
- **Match Function:** `match_generative_lab`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_generative_lab()`
- **Window Class:** `TGenerativeLabWindow`
- **View Class:** `TGenerativeLabView`
- **Include:** `#include "generative_lab_view.h"`

---

### 21. monster_portal
- **Slug:** `monster_portal`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_monster_portal`)
- **Match Function:** `match_monster_portal`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_monster_portal()`
- **Window Class:** `TGenerativeMonsterPortalWindow`
- **View Class:** `TGenerativeMonsterPortalView`
- **Include:** `#include "generative_monster_portal_view.h"`

---

### 22. paint
- **Slug:** `paint`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_paint`)
- **Match Function:** `match_paint`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_paint()`
- **Window Class:** `TPaintWindow`
- **View Class:** `TPaintCanvasView`
- **Include:** `#include "paint/paint_window.h"`

---

### 23. micropolis_ascii
- **Slug:** `micropolis_ascii`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_micropolis_ascii`)
- **Match Function:** `match_micropolis_ascii`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_micropolis_ascii()`
- **Window Class:** `TMicropolisAsciiWindow`
- **View Class:** `TMicropolisAsciiView`
- **Include:** `#include "micropolis_ascii_view.h"`

---

### 24. terminal
- **Slug:** `terminal`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_terminal`)
- **Match Function:** `match_terminal`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_terminal()`
- **Window Class:** `TWibWobTerminalWindow`
- **View Class:** Terminal view
- **Include:** `#include "tvterm_view.h"`

---

### 25. room_chat
- **Slug:** `room_chat`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_room_chat`)
- **Match Function:** `match_room_chat`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_room_chat()`
- **Window Class:** `TRoomChatWindow`
- **View Class:** `TRoomChatView`
- **Include:** `#include "room_chat_view.h"`

---

### 26. wibwob
- **Slug:** `wibwob`
- **Agent-Spawnable:** ✓ Yes (inline lambda spawn function)
- **Match Function:** `match_wibwob`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_wibwob()` (called by inline lambda)
- **Window Class:** `TWibWobWindow`
- **View Class:** Chat/messaging view
- **Include:** `#include "wibwob_view.h"`
- **Notes:** "Internal-only types" comment, but has spawn function. Used by menu and agents.

---

### 27. scramble
- **Slug:** `scramble`
- **Agent-Spawnable:** ✗ No (spawn is nullptr)
- **Match Function:** `match_scramble`
- **Properties Accepted:** (not spawnable via IPC)
- **Window Class:** `TScrambleWindow`
- **View Class:** `TScrambleView`
- **Include:** `#include "scramble_view.h"`
- **Notes:** Recognized but NOT spawnable via agent IPC. Menu-only or internal creation.

---

### 28. quadra
- **Slug:** `quadra`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_quadra`)
- **Match Function:** `match_quadra`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_quadra()`
- **Window Class:** `TQuadraWindow`
- **View Class:** `TQuadraView`
- **Include:** `#include "quadra_view.h"`

---

### 29. snake
- **Slug:** `snake`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_snake`)
- **Match Function:** `match_snake`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_snake()`
- **Window Class:** `TSnakeWindow`
- **View Class:** `TSnakeView`
- **Include:** `#include "snake_view.h"`

---

### 30. rogue
- **Slug:** `rogue`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_rogue`)
- **Match Function:** `match_rogue`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_rogue()`
- **Window Class:** `TRogueWindow`
- **View Class:** `TRogueView`
- **Include:** `#include "rogue_view.h"`

---

### 31. deep_signal
- **Slug:** `deep_signal`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_deep_signal`)
- **Match Function:** `match_deep_signal`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_deep_signal()`
- **Window Class:** `TDeepSignalWindow`
- **View Class:** `TDeepSignalView`
- **Include:** `#include "deep_signal_view.h"`

---

### 32. app_launcher
- **Slug:** `app_launcher`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_app_launcher`)
- **Match Function:** `match_app_launcher`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_app_launcher()`
- **Window Class:** `TAppLauncherWindow`
- **View Class:** `TAppLauncherView`
- **Include:** `#include "app_launcher_view.h"`

---

### 33. gallery
- **Slug:** `gallery`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_gallery`)
- **Match Function:** `match_gallery`
- **Properties Accepted:**
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_gallery()`
- **Window Class:** `TGalleryWindow`
- **View Class:** `TAsciiGalleryView`
- **Include:** `#include "ascii_gallery_view.h"`

---

### 34. figlet_text
- **Slug:** `figlet_text`
- **Agent-Spawnable:** ✓ Yes (spawn function: `spawn_figlet_text`)
- **Match Function:** `match_figlet_text`
- **Properties Accepted:**
  - `text` (required) — text to render as ASCII art
  - `font` (optional, default: "standard") — figlet font name
  - `frameless` (optional, default: false) — "1"/"true" to hide frame
  - `shadowless` (optional, default: false) — "1"/"true" to hide shadow
  - `x`, `y`, `w`, `h` (optional bounds)
- **Created By:** `api_spawn_figlet_text()`
- **Window Class:** `TFigletTextWindow`
- **View Class:** `TFigletTextView`
- **Include:** `#include "figlet_text_view.h"`
- **Error Handling:** Returns "err missing text param" if text omitted

---

## Window Types in Code but NOT Registered

The following window types exist as window classes in the codebase but are **NOT** in the registry and **NOT** spawnable via agent IPC:

### 1. ansi_mini (TAnsiMiniWindow)
- **File:** `app/ansi_view.h` (line 73)
- **Class:** `TAnsiMiniWindow : public TWindow`
- **Status:** Not registered
- **Spawnable via IPC:** ✗ No
- **Creation Method:** Internal/menu only (if at all)

### 2. ascii_image (TAsciiImageWindow)
- **File:** `app/ascii_image_view.cpp` (line 89)
- **Class:** `TAsciiImageWindow : public TWindow`
- **Creator Function:** `createAsciiImageWindowFromFile()` (called from file open dialogs)
- **Status:** Not registered
- **Spawnable via IPC:** ✗ No
- **Notes:** Created only through file menu when opening image files

### 3. mech (TMechWindow)
- **File:** `app/mech_window.h` (line 29)
- **Class:** `TMechWindow : public TWindow`
- **Status:** Not registered
- **Spawnable via IPC:** ✗ No
- **Notes:** Purpose unclear; may be experimental or deprecated

### 4. token_tracker (TTokenTrackerWindow)
- **File:** `app/token_tracker_view.cpp` (line 661)
- **Class:** `TTokenTrackerWindow : public TWindow`
- **Creator Function:** `createTokenTrackerWindow()`
- **Status:** Not registered
- **Spawnable via IPC:** ✗ No
- **Notes:** Likely used internally for tracking LLM token usage

### 5. wibwob_test_a (TWibWobTestWindowA)
- **File:** `app/wibwob_scroll_test.h` (line 65)
- **Class:** `TWibWobTestWindowA : public TWindow`
- **Creator Function:** `createWibWobTestWindowA()` (called from hotkey cmds_test)
- **Status:** Not registered
- **Spawnable via IPC:** ✗ No
- **Notes:** Test/debug window for WibWob scroll behavior

### 6. wibwob_test_b (TWibWobTestWindowB)
- **File:** `app/wibwob_scroll_test.h` (line 108)
- **Class:** `TWibWobTestWindowB : public TWindow`
- **Creator Function:** `createWibWobTestWindowB()`
- **Status:** Not registered
- **Spawnable via IPC:** ✗ No
- **Notes:** Alternative test/debug window for WibWob scroll behavior

---

## Bounds Property Reference

Nearly all registered window types accept optional bounds parameters:

```
x  : int — left edge (0-based column)
y  : int — top edge (0-based row)
w  : int — width in cells
h  : int — height in cells
```

**How they're parsed:** `opt_bounds()` function in `window_type_registry.cpp`
- All four must be present to be used; if any missing, bounds are nullptr (default sizing)
- Bounds are converted to `TRect(x, y, x+w, y+h)` for tvision

---

## Property-Accepting Window Types

### Frame-Related Properties
- **frame_player:** `path` (req), `frameless`, `shadowless`, `title`, bounds
- **figlet_text:** `text` (req), `font`, `frameless`, `shadowless`, bounds

### Customizable Properties
- **gradient:** `gradient` (default: "horizontal"), bounds
- **text_view:** `path` (req), bounds
- **text_editor:** `title` (default: "Text Editor"), bounds

### Bounds-Only
All remaining 25 types accept only optional bounds: `x`, `y`, `w`, `h`

---

## Agent Creation via IPC

Agents can create windows using the **`create_window`** IPC command:

```
create_window type=<slug> [property=value ...]
```

**Flow:**
1. Agent calls IPC with `type` and optional properties
2. `api_ipc.cpp` looks up type in registry via `find_window_type_by_name()`
3. If type not found → error "err unknown type"
4. If type found but `spawn` is nullptr → error "err unsupported type"
5. If type found and `spawn` is valid → calls `spawn(app, kv)` with property map
6. Spawn function either succeeds (returns nullptr) or fails (returns error string)

**Example (pseudo-code):**
```bash
cmd:create_window type=gradient gradient=vertical x=5 y=5 w=40 h=20
cmd:create_window type=frame_player path=/path/to/frames frameless=1
cmd:create_window type=figlet_text text="Hello" font=banner
```

---

## Menu-Only Window Types

Only **one** registered type is menu-only:

- **scramble**: `spawn` is nullptr, so agents cannot create it
  - Created by menu commands
  - Identified by `match_scramble()` for serialization

**Unregistered types** (ascii_image, mech, token_tracker, wibwob_test_*, ansi_mini) are also menu/internal-only but are not in the registry, so they won't be recognized by the window system as restorable/saveable.

---

## Matching/Serialization

Each registered type has a **match function** that identifies window instances at runtime:

- **Dynamic cast matchers:** Browser, TextEditor, TextEditorWindow, Paint, AppLauncher, Gallery, FigletText, Terminal, WibWob, RoomChat, Scramble
- **Child view search matchers:** All generative/animated types (verse, orbit, life, blocks, etc.)
- **Special matchers:** 
  - `match_frame_player`: Matches both `FrameFilePlayerView` and `TTextFileView`
  - `match_test_pattern`: Always returns false (fallback to default)

When a window is saved/closed, the match function identifies its type for restoration.

---

## Summary Table

| Slug | Agent-Spawnable | Window Class | Has Bounds | Has Custom Props |
|------|-----------------|--------------|-----------|-----------------|
| test_pattern | ✓ | TTestPatternWindow | ✓ | ✗ |
| gradient | ✓ | TGradientWindow | ✓ | ✓ |
| frame_player | ✓ | TFrameAnimationWindow | ✓ | ✓ |
| text_view | ✓ | TTransparentTextWindow | ✓ | ✓ |
| text_editor | ✓ | TTextEditorWindow | ✓ | ✓ |
| browser | ✓ | TBrowserWindow | ✓ | ✗ |
| verse | ✓ | TGenerativeVerseWindow | ✓ | ✗ |
| mycelium | ✓ | TGenerativeMyceliumWindow | ✓ | ✗ |
| orbit | ✓ | TGenerativeOrbitWindow | ✓ | ✗ |
| torus | ✓ | TGenerativeTorusWindow | ✓ | ✗ |
| cube | ✓ | TGenerativeCubeWindow | ✓ | ✗ |
| life | ✓ | TGameOfLifeWindow | ✓ | ✗ |
| blocks | ✓ | TAnimatedBlocksWindow | ✓ | ✗ |
| score | ✓ | TAnimatedScoreWindow | ✓ | ✗ |
| ascii | ✓ | TAnimatedAsciiWindow | ✓ | ✗ |
| animated_gradient | ✓ | TAnimatedGradientWindow | ✓ | ✗ |
| monster_cam | ✓ | TGenerativeMonsterCamWindow | ✓ | ✗ |
| monster_verse | ✓ | TGenerativeMonsterVerseWindow | ✓ | ✗ |
| contour_map | ✓ | TContourMapWindow | ✓ | ✗ |
| generative_lab | ✓ | TGenerativeLabWindow | ✓ | ✗ |
| monster_portal | ✓ | TGenerativeMonsterPortalWindow | ✓ | ✗ |
| paint | ✓ | TPaintWindow | ✓ | ✗ |
| micropolis_ascii | ✓ | TMicropolisAsciiWindow | ✓ | ✗ |
| terminal | ✓ | TWibWobTerminalWindow | ✓ | ✗ |
| room_chat | ✓ | TRoomChatWindow | ✓ | ✗ |
| wibwob | ✓ | TWibWobWindow | ✓ | ✗ |
| scramble | ✗ | TScrambleWindow | N/A | N/A |
| quadra | ✓ | TQuadraWindow | ✓ | ✗ |
| snake | ✓ | TSnakeWindow | ✓ | ✗ |
| rogue | ✓ | TRogueWindow | ✓ | ✗ |
| deep_signal | ✓ | TDeepSignalWindow | ✓ | ✗ |
| app_launcher | ✓ | TAppLauncherWindow | ✓ | ✗ |
| gallery | ✓ | TGalleryWindow | ✓ | ✗ |
| figlet_text | ✓ | TFigletTextWindow | ✓ | ✓ |

---

## Key Takeaways

1. **Registry is Complete:** All 36 registered types are in `window_type_registry.cpp` k_specs table
2. **35 Agent-Spawnable:** All except "scramble" can be created by agents
3. **Bounds are Universal:** Nearly all types accept optional x/y/w/h bounds
4. **Property Parsing:** Each spawn function parses properties from the kv map
5. **Unregistered Types Exist:** 6 window types exist in code but aren't in registry (ascii_image, mech, token_tracker, ansi_mini, wibwob_test_*, etc.)
6. **Matching is Critical:** Match functions enable window type identification for persistence and restoration
7. **IPC Flow:** Agents use `create_window` command which delegates to registry's spawn functions
