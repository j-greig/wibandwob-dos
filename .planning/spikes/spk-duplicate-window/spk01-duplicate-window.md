---
type: spike
status: not-started
tags: [ui, feature, window-management]
tldr: "Ctrl+D / right-click 'Duplicate' clones the focused window — same content, new instance"
created: 2026-02-24
---

# SPK01 — Duplicate Window

## Simple Description

Select a window, press Ctrl+D (or right-click → Duplicate). A new window appears **directly in front** of the original, offset by 1 col right and 1 row down — exactly like duplicating a layer in Illustrator or Figma. The clone is focused (on top), the original is directly behind it peeking out at the top-left edge. Same content, independent copy.

## Scope

### Phase 1: Duplicatable window types (v1)

These window types carry clonable state and make sense to duplicate:

| Type | Registry name | What gets cloned |
|------|--------------|------------------|
| Text document | `text_view` | text content, title, chrome flags |
| Text editor | `text_editor` | text content, title |
| Frame animation | `frame_player` | file path, title, frameless/shadowless |
| FIGlet text | `figlet_text` | text, font, fg/bg colour, chrome flags |
| Paint canvas | `paint` | cell buffer (deep copy), title, dirty=false |

### Phase 2: Stub-only (future implementation)

These types get a `duplicate()` stub that returns `nullptr` — the infrastructure handles them gracefully (beep / status message "Window type does not support duplication").

| Type | Registry name | Why stub for now |
|------|--------------|-----------------|
| Generative views | `verse`, `mycelium`, `orbit`, `torus`, `cube`, `life` | Stateless/random — "duplicate" would just spawn a new instance (trivial but not useful) |
| Monster views | `monster_cam`, `monster_verse`, `monster_portal` | Same as above |
| Animated views | `blocks`, `score`, `animated_gradient`, `gradient` | Same |
| Test pattern | `test_pattern` | Legacy demo view |
| Games | `quadra`, `snake`, `rogue` | Game state cloning is complex |
| Micropolis | `micropolis_ascii` | Deep simulation state — separate feature |
| Terminal | `terminal` | PTY can't be cloned |
| Deep signal | `deep_signal` | Generative, no meaningful clone |

### Excluded (never duplicate)

These are singletons or make no sense to clone:

| Type | Registry name | Why excluded |
|------|--------------|-------------|
| Wib&Wob chat | `room_chat` | One conversation, not a document |
| Scramble | (not in registry) | Singleton chat personality |
| App launcher | `app_launcher` | Singleton browser |
| ASCII gallery | `gallery` | Singleton browser |
| Browser | `browser` | Singleton terminal embed |

## Design

### How it works

1. User focuses a window, presses Ctrl+D (or right-click → "Duplicate")
2. App finds the focused window on desktop
3. Looks up its type via `window_type_registry` match functions
4. Calls a new `duplicate(TWindow*)` virtual/dispatch that:
   - Reads the source window's state
   - Spawns a new window with identical state
   - Offsets the new window by (+1, +1) from the source (Illustrator/Figma style)
5. Inserts the new window on the desktop **in front of the source**, focuses it

### Where the logic lives

**Option A (recommended): Dispatch table in window_type_registry**

Add a `duplicate` function pointer to `WindowTypeSpec`:

```cpp
struct WindowTypeSpec {
    const char* name;
    SpawnFn spawn;
    MatchFn match;
    DuplicateFn duplicate;  // NEW — can be nullptr (= not duplicatable)
};

// Signature:
typedef TWindow* (*DuplicateFn)(TWindow* source);
```

Each duplicatable type provides a `duplicate_xxx(TWindow* source)` function that reads state from the source and spawns a clone. Non-duplicatable types set `nullptr`.

**Why not a virtual method on TWindow:** tvision's TWindow doesn't have a clone interface and we don't control all window subclasses. The registry dispatch table is already the pattern for type-specific behaviour.

### Command ID

```cpp
const ushort cmDuplicateWindow = 350;  // or next available
```

Check existing command IDs to avoid collision — `cmFigletEditText` is 350, so use a higher range.

### Keyboard shortcut

Ctrl+D — add to `initMenuBar` under Window menu:
```
Window ▶  ...existing...
          Duplicate    Ctrl+D
```

### Right-click context menu

Add "Duplicate" to window frame right-click menus (where shadow/frame toggles already live).

## Implementation Detail per Type

### `text_view` (TTransparentTextWindow)

```cpp
TWindow* duplicate_text_view(TWindow* source) {
    auto* tw = dynamic_cast<TTransparentTextWindow*>(source);
    if (!tw) return nullptr;
    TRect r = source->getBounds();
    r.move(1, 1);  // Illustrator-style: 1 right, 1 down
    // Read content from the text view inside
    // Spawn new TTransparentTextWindow with same content + title
    return clone;
}
```

State to clone: text lines, title, frameless/shadowless flags.

### `text_editor` (TTextEditorWindow)

State to clone: editor buffer content, title.

### `frame_player` (animation)

State to clone: file path, title, frameless/shadowless. New instance re-reads the file (same as opening it fresh — animations are stateless display of a file).

### `figlet_text` (TFigletTextWindow)

State to clone: text, font, fg colour, bg colour, frameless/shadowless, title.

```cpp
TWindow* duplicate_figlet_text(TWindow* source) {
    auto* fw = dynamic_cast<TFigletTextWindow*>(source);
    if (!fw || !fw->getFigletView()) return nullptr;
    auto* view = fw->getFigletView();
    TRect r = source->getBounds();
    r.move(1, 1);  // offset: 1 right, 1 down, in front
    // Spawn with same params
    auto* clone = new TFigletTextWindow(r, view->getText(), view->getFont(),
                                         fw->isFrameless(), /* shadowless */ ...);
    clone->getFigletView()->setFgColor(view->getFgColor());
    clone->getFigletView()->setBgColor(view->getBgColor());
    return clone;
}
```

### `paint` (TPaintWindow)

State to clone: deep copy of cell buffer, canvas dimensions, pixel mode, fg/bg colours, title. Dirty flag = false on clone (it's a fresh copy, not the original file).

This is the most complex clone — needs a `TPaintCanvasView::cloneBuffer()` method or constructor that accepts an existing buffer.

## Dev Handover (Codex Execution Notes)

### Preflight

```bash
# Verify window type registry structure
rg -n "struct WindowTypeSpec|SpawnFn|MatchFn" app/window_type_registry.cpp app/window_type_registry.h
# Verify match functions exist for target types
rg -n "match_text_view|match_text_editor|match_frame_player|match_figlet_text|match_paint" app/window_type_registry.cpp
# Check command ID space (avoid collision)
rg -n "const ushort cm" app/test_pattern_app.cpp app/figlet_text_view.h | sort -t= -k2 -n | tail -20
# Verify Ctrl+D not already bound
rg -n "kbCtrlD|Ctrl+D|ctrl.*d" app/test_pattern_app.cpp
```

### Step 1: Add `DuplicateFn` to `WindowTypeSpec`

In `app/window_type_registry.h` (or `.cpp` if struct is local):

```cpp
typedef TWindow* (*DuplicateFn)(TWindow* source);
```

Add `DuplicateFn duplicate;` field to the spec struct. Set `nullptr` for all existing entries initially.

### Step 2: Implement duplicate functions for Phase 1 types

Add to `app/window_type_registry.cpp`:

- `duplicate_text_view(TWindow*)` 
- `duplicate_text_editor(TWindow*)`
- `duplicate_frame_player(TWindow*)`
- `duplicate_figlet_text(TWindow*)`
- `duplicate_paint(TWindow*)`

Each reads state from source via `dynamic_cast`, spawns a new window, returns it.

### Step 3: Wire into k_specs table

Update each Phase 1 entry:
```cpp
{ "figlet_text", spawn_figlet_text, match_figlet_text, duplicate_figlet_text },
```

Phase 2 and excluded types get `nullptr`.

### Step 4: Add public dispatch function

In `app/window_type_registry.h`:
```cpp
// Returns cloned window or nullptr if type doesn't support duplication.
TWindow* duplicateWindow(TWindow* source);
```

Implementation: iterate `k_specs`, find matching type via `match`, call `duplicate` if non-null.

### Step 5: Add command + menu + handler

- Add `cmDuplicateWindow` constant
- Add to Window menu: `*new TMenuItem("~D~uplicate", cmDuplicateWindow, kbCtrlD)`
- In `TTestPatternApp::handleEvent`:

```cpp
case cmDuplicateWindow: {
    TWindow* focused = dynamic_cast<TWindow*>(deskTop->current);
    if (focused) {
        TWindow* clone = duplicateWindow(focused);
        if (clone) {
            deskTop->insert(clone);
        } else {
            // Beep or status message
        }
    }
    clearEvent(event);
    break;
}
```

### Step 6: Add IPC command

In `app/command_registry.cpp`:
```cpp
{"duplicate_window", "Duplicate the specified window (id param)", true},
```

Dispatch: find window by ID, call `duplicateWindow()`, return new window ID.

### Step 7: Build + test

```bash
cmake --build build --target test_pattern -j4
```

Manual test:
- Open a text view → Ctrl+D → second window appears with same text, offset
- Open a figlet text → Ctrl+D → clone has same text/font/colours
- Open Wib&Wob chat → Ctrl+D → nothing happens (beep)
- Open paint canvas, draw something → Ctrl+D → clone has same drawing

IPC test:
```bash
python3 -c "
import socket, json
def ipc(cmd):
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(3)
    s.connect('/tmp/wibwob_1.sock')
    s.sendall(cmd.encode() + b'\n')
    s.shutdown(socket.SHUT_WR)
    data = b''
    while True:
        try:
            chunk = s.recv(65536)
            if not chunk: break
            data += chunk
        except: break
    s.close()
    return data.decode().strip()

# Create a figlet window
r = json.loads(ipc('cmd:create_window type=figlet_text text=Hello font=doom'))
print('original:', r)
wid = r['id']

# Duplicate it
r2 = ipc(f'cmd:exec_command name=duplicate_window id={wid}')
print('duplicate:', r2)
"
```

## Acceptance Criteria

- AC-1: Ctrl+D on a focused text view creates a duplicate with same content
  - Test: Open text view, Ctrl+D, verify new window has identical text
- AC-2: Ctrl+D on a figlet text window creates a duplicate with same text/font/colours
  - Test: Create figlet window, set font+colour, Ctrl+D, verify clone matches
- AC-3: Ctrl+D on a non-duplicatable window does nothing (no crash)
  - Test: Focus Wib&Wob chat, Ctrl+D, verify no crash, no new window
- AC-4: Duplicate window is offset (+1, +1) from source and appears in front
  - Test: Duplicate, verify new window position is 1 right + 1 down, and is focused (on top of source)
- AC-5: `duplicate_window` IPC command works
  - Test: Create window via IPC, duplicate via IPC, verify new ID returned
- AC-6: Paint canvas duplicate is a deep copy (editing clone doesn't affect original)
  - Test: Duplicate paint, draw in clone, verify original unchanged
- AC-7: Window menu shows "Duplicate Ctrl+D" item
  - Test: Open Window menu, verify item present

## Effort

| Phase | Est |
|-------|-----|
| Registry DuplicateFn + dispatch | 30m |
| 5 duplicate implementations (text_view, text_editor, frame_player, figlet_text, paint) | 2h |
| Command + menu + handler | 30m |
| IPC command | 15m |
| Testing | 30m |
| **Total** | **~4h** |

## Open Questions

1. For paint canvas, should the clone share the same filename or be "untitled"? Recommend: untitled (it's a copy, not the same file).
2. Should animations restart from frame 0 in the clone? Recommend: yes (fresh playback).
3. Ctrl+D might conflict with editor "delete line" in some contexts — check TTextEditorView key handling.
4. Repeated Ctrl+D should keep offsetting (+1,+1 each time) — 5 dupes = staircase effect. Natural behaviour if each dupe reads source bounds fresh.
