# WibWob-DOS menu + window-type registry audit (read-only)

Audited files: `app/test_pattern_app.cpp`, `app/window_type_registry.cpp`, `app/window_type_registry.h`, `app/api_ipc.cpp`, `app/command_registry.cpp`, `app/command_registry.h`, plus multiplayer bridge context in `tools/room/state_diff.py`.

---

## 1) Menu inventory (window-impacting items)

Source of truth for menu wiring: `app/test_pattern_app.cpp:810` (dispatch) + `app/test_pattern_app.cpp:2030` (menu construction).  
Type strings come from `api_get_state` → `windowTypeName()` in `app/test_pattern_app.cpp:2426`, which scans `all_window_type_specs()` and **falls back to `"test_pattern"`** if nothing matches (`app/test_pattern_app.cpp:2431`).

> Columns reflect *what multiplayer will actually see* in `get_state`, and whether that type slug exists in the registry list (`app/window_type_registry.cpp:217`).

| item | type_string (as emitted) | in_registry | syncable | status |
|---|---|---:|---:|---|
| File > New Test Pattern (`cmNewWindow`) | `test_pattern` *(fallback; no matcher)* | yes | yes | Works, but relies on fallback because `match_test_pattern` always returns false (`app/window_type_registry.cpp:187`). |
| File > New H-Gradient (`cmNewGradientH`) | `gradient` | yes | yes | **Param mismatch:** remote spawn defaults to horizontal unless delta includes `gradient=`; `get_state`/bridge currently don’t carry gradient subtype. |
| File > New V-Gradient (`cmNewGradientV`) | `gradient` | yes | yes | Same subtype-loss as above. |
| File > New Radial Gradient (`cmNewGradientR`) | `gradient` | yes | yes | Same subtype-loss as above. |
| File > New Diagonal Gradient (`cmNewGradientD`) | `gradient` | yes | yes | Same subtype-loss as above. |
| File > New Mechs Grid (`cmNewMechs`) | — | n/a | n/a | **Dead end:** menu item exists (`app/test_pattern_app.cpp:2041`), handler is commented out (`app/test_pattern_app.cpp:838`). |
| File > New Animation (Donut) (`cmNewDonut`) | `frame_player` | yes | yes | OK (file-backed). |
| File > Open Text/Animation… (`cmOpenAnimation`) | `frame_player` | yes | yes* | OK if remote has same `path`; otherwise remote behavior depends on file availability. |
| File > Open Image… (`cmOpenImageFile`) | `test_pattern` *(fallback; mis-typed)* | yes | **should be no** | **Type mismatch:** creates `TAsciiImageWindow` (`app/ascii_image_view.cpp`), but no registry matcher/spec → gets reported as `test_pattern`, so it will sync as the wrong window. |
| File > Open Monodraw… (`cmOpenMonodraw`) | — | n/a | n/a | Doesn’t create a window locally; fires a background `curl` to the API (`app/test_pattern_app.cpp:1866`). May *indirectly* spawn a text editor via API side-effects. |
| File > Open Workspace… (`cmOpenWorkspace`) | (creates windows) | — | — | **Rot:** workspace restore only reconstructs `test_pattern` and `gradient` windows (`app/test_pattern_app.cpp:2725`). Everything else is dropped. |
| View > ASCII Grid Demo (`cmAsciiGridDemo`) | `test_pattern` *(fallback; mis-typed)* | yes | **should be no** | **Type mismatch:** window has no registry spec/matcher. Will sync as `test_pattern`. |
| View > Animated Blocks (`cmAnimatedBlocks`) | `blocks` | yes | yes | OK. |
| View > Animated Gradient (`cmAnimatedGradient`) | `animated_gradient` | yes | yes | OK. |
| View > Animated Score (`cmAnimatedScore`) | `score` | yes | yes | OK. |
| View > Verse Field (`cmVerseField`) | `verse` | yes | yes | OK. |
| View > Orbit Field (`cmOrbitField`) | `orbit` | yes | yes | OK. |
| View > Mycelium Field (`cmMyceliumField`) | `mycelium` | yes | yes | OK. |
| View > Torus Field (`cmTorusField`) | `torus` | yes | yes | OK. |
| View > Cube Spinner (`cmCubeField`) | `cube` | yes | yes | OK. |
| View > Monster Portal (`cmMonsterPortal`) | `monster_portal` | yes | yes | OK. |
| View > Monster Verse (`cmMonsterVerse`) | `monster_verse` | yes | yes | OK. |
| View > Monster Cam (`cmMonsterCam`) | `monster_cam` | yes | yes | OK. |
| View > Scramble Cat (`cmScrambleCat`) | `scramble` | yes | **no** | Internal singleton overlay; must never sync. Registry marks it non-spawnable (`app/window_type_registry.cpp:238`). |
| Window > Edit Text Editor (`cmTextEditor`) | `text_editor` | yes | yes | **Event/id gap:** menu path inserts without `registerWindow()` (`app/test_pattern_app.cpp:913`), so no immediate IPC “state_changed” push; bridge only sees it on heartbeat. |
| Window > Browser (`cmBrowser`) | `browser` | yes | maybe | Syncable mechanically, but has side effects (auto-fetch URL in `newBrowserWindow()`). |
| Window > Open Text File (Transparent BG)… (`cmOpenTransparentText`) | `text_view` | yes | yes* | OK if remote can open same `path`. |
| Tools > Wib&Wob Chat (`cmWibWobChat`) | `wibwob` | yes | **no** | Internal-only; registry marks non-spawnable (`app/window_type_registry.cpp:238`). Should never sync. |
| Tools > Test A/B/C (`cmWibWobTestA/B/C`) | `test_pattern` *(fallback; mis-typed)* | yes | **should be no** | **Type mismatch:** creates TWibWobTestWindow* classes (`app/wibwob_scroll_test.*`) but no matcher/spec → reported as `test_pattern`, so it will sync wrong. |
| Tools > API Key… (`cmApiKey`) | `test_pattern` *(fallback; dialog mis-typed)* | yes | **should be no** | Opens a modal `TDialog` (`app/test_pattern_app.cpp:1894`). No dialog matcher → likely appears in `get_state` as `test_pattern` and can sync spuriously. |

\* File-backed windows are only “syncable” if all instances can access the same filesystem paths; the bridge currently assumes that by sending `path` when present (`tools/room/state_diff.py:291`).

---

## 2) Dead ends / legacy / placeholders (menu rot)

- **No-op menu item:** “New Mechs Grid” is present but has no active handler (`app/test_pattern_app.cpp:2041`, handler commented at `app/test_pattern_app.cpp:838`).
- **Commented-out feature:** ASCII Cam menu entry is explicitly disabled (`app/test_pattern_app.cpp:2078`, dispatch commented at `app/test_pattern_app.cpp:1016`).
- **Placeholders that don’t create windows:** Zoom In/Out/Actual Size/Full Screen, ANSI Editor, Paint Tools, Animation Studio, Glitch Settings are “coming soon” message boxes (`app/test_pattern_app.cpp:896` onward).
- **Workspace save/load drift:** save/load is effectively legacy for multiplayer-era window types: it only preserves `test_pattern` + `gradient` (`app/test_pattern_app.cpp:2725`, `app/test_pattern_app.cpp:2866`).

---

## 3) Window type registry inventory + menu coverage

Registry table: `app/window_type_registry.cpp:217`.

### Registered type specs (type → spawnability)
Spawnable via IPC `create_window` if `spawn != nullptr` (see `app/api_ipc.cpp:402`).

Spawnable:
- `test_pattern`, `gradient`, `frame_player`, `text_view`, `text_editor`, `browser`
- `verse`, `mycelium`, `orbit`, `torus`, `cube`, `life`
- `blocks`, `score`, `ascii`, `animated_gradient`
- `monster_cam`, `monster_verse`, `monster_portal`

Internal-only (recognized but non-spawnable):
- `wibwob`, `scramble` (`app/window_type_registry.cpp:237`)

### Registry types with **no corresponding menu item**
- `life` (spawnable via IPC, but no menu entry)
- `ascii` (spawnable via IPC, but no menu entry)

### Menu windows with **no dedicated registry matcher/spec** (currently collapse to `test_pattern`)
These violate “every window must have a stable known type string” because they are indistinguishable from real `test_pattern` windows in `get_state`:
- `TAsciiImageWindow` (Open Image…) → misreported as `test_pattern` (`app/ascii_image_view.cpp`, fallback in `app/test_pattern_app.cpp:2431`)
- ASCII Grid Demo window (`createAsciiGridDemoWindow`) → misreported as `test_pattern`
- WibWob scrollbar test windows A/B/C → misreported as `test_pattern` (`app/wibwob_scroll_test.*`)
- Modal dialogs (API key dialog, file dialogs, message boxes) → likely misreported as `test_pattern` while visible

---

## 4) Internal/singleton windows (should NEVER sync)

Already explicitly treated as “never sync” in the bridge:
- `wibwob`, `scramble` are filtered out by `_INTERNAL_TYPES` (`tools/room/state_diff.py:26`), and are also non-spawnable in the registry (`app/window_type_registry.cpp:237`).

Other windows that should likely be treated as non-syncable (not currently representable as such via type string):
- **Modal dialogs and transient UI** (`TDialog`, file pickers, message boxes): likely appear in `get_state` and are currently indistinguishable from `test_pattern` due to fallback (`app/test_pattern_app.cpp:2431`).
- **Dev/test-only windows** (WibWob Test A/B/C) and **local-only viewers** (ASCII image viewer, ASCII grid demo).

Recommendation: yes, a `syncable: false` (or equivalent) flag in the window registry would be useful, because:
- “spawnable via IPC” (`spawn != nullptr`) is not the same as “safe/desirable to sync”.
- The Python bridge currently hardcodes internal types (`tools/room/state_diff.py:26`), which is drift-prone.
- Fallback-to-`test_pattern` prevents the bridge from reliably filtering non-syncable windows by type.

---

## 5) Type-safety gaps to close (root causes)

### A) **Fallback masks unknown window types**
- `windowTypeName()` falls back to the first spec type (currently `test_pattern`) when nothing matches (`app/test_pattern_app.cpp:2431`).
- `match_test_pattern` is intentionally non-functional (`app/window_type_registry.cpp:187`), so even genuine test-pattern windows rely on fallback.
- Result: many unrelated windows (image viewer, test windows, dialogs) become indistinguishable from `test_pattern` in state, so multiplayer will “successfully” sync the wrong thing instead of failing fast.

### B) **`create_window` is validated, but error modes are coarse**
- IPC validates type at create time and returns:
  - `err unknown type` if no spec (`app/api_ipc.cpp:405`)
  - `err unsupported type` if internal/non-spawnable (`app/api_ipc.cpp:407`)
- This is good, but it doesn’t protect you from mis-typed windows (because fallback prevents “unknown type” from ever showing up).

### C) **ID mapping depends on `create_window` returning an ID**
- Bridge captures the local window id from the JSON response payload’s `"id"` (`tools/room/state_diff.py:298`).
- `create_window` only returns an `"id"` if the spawn path ultimately calls `registerWindow()` before returning (`app/api_ipc.cpp:410` + `api_take_last_registered_window_id`).
- **Gap:** `api_spawn_text_editor` inserts a window but never registers it (`app/test_pattern_app.cpp:3072`), so `create_window type=text_editor` can succeed but return no `"id"`, breaking subsequent move/resize routing via `id_map`.

### D) **Gradient subtype is not part of synced state**
- Registry supports `gradient` parameter (`window_type_registry.cpp` wrapper reads `kv["gradient"]`), but the bridge does not send it (`tools/room/state_diff.py:290` only sends `type`, rect, optional `path`).
- Result: vertical/radial/diagonal gradients sync as horizontal on peers.

### E) **No compile-time/runtime linkage between menu spawn sites and registry**
- Menu handlers directly construct windows (many without `registerWindow()`), not via a typed registry API (`app/test_pattern_app.cpp:810`).
- There’s no automated check that “every menu-spawned window has a unique, matchable, registry-backed type string”.

### F) **Command IDs collide (rot / latent bug)**
- Command constants collide:
  - `cmTextEditor = 130` and `cmKeyboardShortcuts = 130` (`app/test_pattern_app.cpp:171` vs `app/test_pattern_app.cpp:207`)
  - `cmWibWobChat = 131` and `cmDebugInfo = 131` (`app/test_pattern_app.cpp:193` vs `app/test_pattern_app.cpp:208`)
- Even if currently unused, this is a type-safety/dispatch footgun.

---

## 6) Recommendation: registry metadata to add

Yes: add a `syncable` flag (or similar) to `WindowTypeSpec`, and consider these additional fields:

- `syncable: bool` (explicit, not inferred from `spawn`)
- `spawnable: bool` (already implied by `spawn != nullptr`, but useful to expose)
- `requires: { path?: bool, gradient_kind?: bool, ... }` (so bridge knows what params must be included)
- `singleton: bool` (scramble, wibwob)
- `deterministic: bool` / `side_effects: bool` (browser/network, live chat, etc.)
- `display_name: string` (for capability listings / UI)
- `schema_version` / `params_schema` (so bridge can validate outgoing `create_window` requests)

Crucially: adjust type resolution so **unknown/unmatched windows do not masquerade as `test_pattern`**, enabling the bridge to skip or fail-fast on windows that aren’t safe to sync.

If you want, I can also do a follow-up read-only audit specifically of *which non-registry windows can appear in `get_state` during normal use* (dialogs, file pickers, transient message boxes) and how often they’re likely to leak into multiplayer deltas.
