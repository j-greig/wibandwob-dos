# Windows Folder Analysis Report

**Folder:** `src/windows/`
**Files:** 17 TypeScript files
**Total lines:** 8,377

---

## File-by-File Analysis

### 1. `agent-slash-commands.ts` (131 lines)

**Purpose:** Dispatches `/slash` commands typed in the Wib&Wob Agent chat window.

**Exports:** `dispatchSlashCommand` (async function)

**Imports:**
- External: `node:child_process`, `node:path`
- Other src/: `../services/wibwob-agent-session.js`

**Responsibilities:**
1. Parse slash command strings and dispatch to appropriate agent methods
- Single responsibility ✅

**Code Smells:**
- Long method: `dispatchSlashCommand` is a 100+ line chain of `if` statements (lines 20–130). Could be a dispatch table.
- `/state` handler (lines 102–126) does raw `fetch` + inline JSON formatting — **feature envy** on `StateService`.
- `/dance` handler (lines 90–100) hardcodes port 8099 with fallback — duplicates control API knowledge.

**Type Safety:**
- `(d: any)` cast on `/state` JSON response (line 107). 1 `any` usage.
- `(a: any, b: any)` in sort callback (line 113). 2 more `any` usages.

**Coupling:** Low. Only depends on `WibWobAgentSession` interface. The `fetch` calls to localhost couple it to the control API shape.

**Refactoring Opportunities:**
1. Replace `if` chain with a `Map<string, Handler>` dispatch table — easier to extend, test.
2. Extract `/state` formatting into a utility shared with `StateService`.
3. Use a constant for the control API base URL.

---

### 2. `backrooms-log-browser-window.ts` (279 lines)

**Purpose:** A split-pane file browser for Backrooms TV session logs — list on left, preview on right.

**Exports:** `openBackroomsLogBrowserWindow` (function)

**Imports:**
- External: `blessed`, `node:fs`, `node:path`
- Same folder: (none directly, called from `backrooms-windows.ts`)
- Other src/: `ui-primitives`, `ui-parts`, `context-menu-items`, `overlay-manager`, `theme/resolver`, `window-manager`, `types`

**Responsibilities:**
1. Scan log directory for `.txt` files
2. Render split-pane list + preview UI
3. Auto-refresh live logs every 2s
- Slightly multi-responsibility but cohesive for a window factory ✅

**Code Smells:**
- `scanLogs` rescans entire directory on every 2s tick — could use file watcher.
- Scroll position map stored as local `Map` — lost on window close, never bounded.

**Type Safety:**
- `(list as any).setItems` — blessed type gap (line 136). 1 `any`.
- `(preview as any).scrollTo` — 2 more `any` casts for blessed scroll methods.

**Coupling:** Moderate. Depends on theme tokens, window manager, overlay manager. Clean callback-based API (`onOpenReplay`, `onSaveSnippet`).

**Refactoring Opportunities:**
1. Extract `scanLogs` + `displayName` into a service — they're pure data functions.

---

### 3. `backrooms-windows.ts` (705 lines)

**Purpose:** Three Backrooms-related windows: log browser proxy, primer picker (with search/filter), and TV streaming window.

**Exports:** `BackroomsWindowContext` (interface), `openBackroomsLogBrowserWindow`, `promptForBackroomsTv`, `openBackroomsPrimerPicker`, `promptForBackroomsRunOptions`, `openBackroomsTvWindow`

**Imports:**
- External: `blessed`, `node:child_process`, `node:fs`, `node:path`
- Same folder: `backrooms-log-browser-window.ts`
- Other src/: `config`, `overlay-manager`, `theme/resolver`, `ui-primitives`, `ui-parts`, `empty-states`, `types`, `window-manager`, `backrooms-service`

**Responsibilities:**
1. Orchestrate Backrooms TV launch flow (theme → primer picker → options → TV window)
2. Primer picker with search, filter, multi-select, preview
3. TV window: spawn CLI subprocess, stream output, fallback to playback
4. Log browser delegation
- **SRP violation:** 4 distinct responsibilities. Primer picker alone is ~250 lines.

**Code Smells:**
- **God function:** `openBackroomsTvWindow` (lines 241–705) is ~460 lines with deeply nested state, timers, process management, and UI wiring.
- **Data clumps:** `BackroomsChannel` fields (`theme`, `primers`, `turns`, `model`) passed through 3 layers of prompts.
- `_backroomsPickerInfo`, `_backroomsPickerSelect`, etc. (lines 240–268) — **inappropriate intimacy** via duck-typed frame properties for API bridge. Should be a typed interface.
- 15+ `let` state variables in `openBackroomsTvWindow` — state management via closure soup.

**Type Safety:**
- `(list as List & { selected: number })` cast pattern used 8+ times — blessed's type defs lack `selected`.
- `(frame as unknown as Record<string, unknown>)` — 4 unsafe casts for API bridge hooks.

**Coupling:** High. Directly spawns child processes, manages file I/O, interacts with BackroomsService, OverlayManager, WindowManager.

**Refactoring Opportunities:**
1. **Extract `openBackroomsTvWindow` process management** into a `BackroomsTvController` class — separate UI from subprocess lifecycle.
2. **Extract primer picker** into its own file — it's a self-contained 250-line component.
3. Define a typed `BackroomsPickerAPI` interface instead of duck-typing frame properties.
4. The prompt chain (`promptForBackroomsTv` → `openBackroomsPrimerPicker` → `promptForBackroomsRunOptions`) could be a single wizard flow.

---

### 4. `browser-windows.ts` (2,082 lines)

**Purpose:** Content browser windows: primer browser, primer gallery (tabbed), text viewer (with animation), and file manager.

**Exports:** `openPrimerBrowserWindow`, `openPrimerGalleryWindow`, `ViewerKind`, `openTextViewerWindow`, `FileManagerRestore`, `openFileManagerWindow`

**Imports:**
- External: `blessed`, `node:child_process`, `node:fs`, `node:path`
- Other src/: `theme/resolver`, `empty-states`, `ui-primitives`, `ansi-utils`, `ui-parts`, `markdown-service`, `syntax-highlight`, `content-measurement`, `animation-service`, `types`, `overlay-manager`, `window-manager`

**Responsibilities:**
1. Primer browser (simple list)
2. Primer gallery (tabbed, search, preview)
3. Text viewer (primer/reader with animation support)
4. File manager (full Finder-style with search, filter, icon/list view, git status, syntax highlighting, context menus)
- **Major SRP violation:** 4 completely independent window types. File manager alone is ~1,400 lines.

**Code Smells:**
- **God function:** `openFileManagerWindow` is ~1,400 lines — the largest single function in the folder. Contains git status tracking, icon rendering, search (ripgrep subprocess), context menus, sort logic, directory listing, file preview with syntax highlighting, markdown rendering, icon grid navigation, and more.
- **Primitive obsession:** File entries use inline object type `{ label: string; fullPath: string; isDirectory: boolean; size: number; mtime: number }` — defined inline, repeated across helper functions.
- `setViewportContent` (lines 51–72) and `fitLineToWidth` (lines 40–48) are generic utilities that belong in `ui-parts.ts` or `ansi-utils.ts`.
- `fileIcon` (lines 360–383) and `fileColour` (lines 750–766) duplicate extension-to-visual-property mapping — should be a single `FileTypeInfo` lookup.
- `(list as List & { selected: number })` cast appears 15+ times throughout the file.
- Context menu (lines 1522–1590) is a bespoke blessed popup — duplicates overlay manager functionality.

**Type Safety:**
- `(viewport as any).iwidth`, `(viewport as any).scrollbar` — 4+ `any` casts in `setViewportContent`.
- `(list as List & { selected: number })` — pervasive blessed type gap workaround, ~15 instances.
- `require("node:child_process")` dynamic imports (lines 1530, 1540) instead of static imports.

**Coupling:** Very high. Imports from 10+ modules. The file manager has direct knowledge of git internals, ripgrep CLI, macOS clipboard (`pbcopy`), Finder (`open -R`), Quick Look (`qlmanage`), and xdg-open.

**Refactoring Opportunities:**
1. **Split into 4 files:** `primer-browser-window.ts`, `primer-gallery-window.ts`, `text-viewer-window.ts`, `file-manager-window.ts`.
2. **Extract file manager subsystems:** `FileManagerSearch` (ripgrep integration), `FileManagerGitStatus`, `FileManagerPreview` (syntax highlight + markdown), `FileManagerIcons`.
3. Move `setViewportContent` and `fitLineToWidth` to `ui-parts.ts`.
4. Define a `FileEntry` type interface instead of inline object types.
5. Replace inline context menu with overlay manager's existing context menu support.

---

### 5. `chrome-browser-window.ts` (476 lines)

**Purpose:** A web browser window using Chrome DevTools Protocol — navigates URLs, renders pages as markdown, hydrates images to ASCII.

**Exports:** `openChromeBrowserWindow`

**Imports:**
- External: `blessed`, `node:fs`
- Other src/: `theme/resolver`, `ui-primitives`, `ui-parts`, `types`, `window-manager`, `overlay-manager`, `chrome-browser-service`, `markdown-service`

**Responsibilities:**
1. Browser chrome (back/forward/reload/URL bar)
2. Navigation and history management
3. Markdown rendering of web pages
4. Image hydration (fetch via Chrome, convert to ASCII via chafa)
- Multiple responsibilities but tightly related to "browser" concept. Moderate SRP concern.

**Code Smells:**
- `postProcessImages` (lines 175–220) and `spliceImages` (lines 223–237) handle image lifecycle — could be extracted to the service layer.
- Navigation token pattern (`navigationToken`) for stale-request cancellation is a DIY cancellation token — could use `AbortController`.
- `cachedChafaBlocks` is a `Map` that grows unbounded across navigations (cleared on new navigation, but not on resize/rerender).

**Type Safety:**
- Clean — no `any` casts visible. Good use of typed service interfaces.

**Coupling:** Moderate. Cleanly delegates to `ChromeBrowserService` for all CDP interaction. Image hydration tightly couples window to service internals.

**Refactoring Opportunities:**
1. Move `postProcessImages` + `spliceImages` into `ChromeBrowserService` — the window shouldn't own image pipeline logic.
2. Use `AbortController` for navigation cancellation instead of manual token tracking.

---

### 6. `contour-window.ts` (397 lines)

**Purpose:** Contour Studio — animated contour map visualization with solo and triptych (3-panel) view modes.

**Exports:** `openContourWindow`

**Imports:**
- External: `blessed`, `node:fs`, `node:path`
- Same folder: `generative-windows.ts` (for `BaseWindowDeps`)
- Other src/: `theme/resolver`, `ui-parts`, `contour-engine`

**Responsibilities:**
1. Solo contour player view
2. Triptych (3-panel synchronized) view with layout management
3. Save frame captures
- Cohesive around "contour visualization" ✅

**Code Smells:**
- `mountTriptych` + `destroyTriptych` manage a complex lifecycle of 3 players + layout parts — works but fragile.
- `bindSharedKeys` duplicated for solo and triptych targets — could be unified.

**Type Safety:** Clean. Well-typed via `ContourPlayer` and `ContourMode` types.

**Coupling:** Low. Only depends on `contour-engine` service and base deps.

**Refactoring Opportunities:**
1. Minor: extract `TriptychView` as a reusable component for any multi-panel visualization.

---

### 7. `figlet-windows.ts` (230 lines)

**Purpose:** FIGlet banner window with font picker and text input, plus a simple browser reader utility.

**Exports:** `promptForFigletText`, `openFigletFontPicker`, `openFigletWindow`, `openBrowserReaderWindow`

**Responsibilities:**
1. FIGlet text prompt flow
2. Font picker (delegates to overlay list prompt)
3. FIGlet banner display window with toolbar
4. Browser reader (simple file viewer)
- **Minor SRP:** `openBrowserReaderWindow` (lines 211–225) is unrelated to figlet — it's a generic file reader. Should be elsewhere.

**Code Smells:**
- `openBrowserReaderWindow` is a misplaced utility — not related to figlet at all.

**Type Safety:** Clean.

**Coupling:** Low. Delegates to `figlet-service` for all rendering.

**Refactoring Opportunities:**
1. Move `openBrowserReaderWindow` to `text-windows.ts` or `browser-windows.ts`.

---

### 8. `generative-windows.ts` (327 lines)

**Purpose:** Collection of simple animated/utility windows: pattern field, companion (Scramble idle), generative art, workspace manager, command palette, state inspector.

**Exports:** `BaseWindowDeps`, `AnimationKind`, `openAnimatedWindow`, `openPatternWindow`, `openCompanionWindow`, `openArtWindow`, `openWorkspaceManagerWindow`, `openCommandPaletteWindow`, `openStateInspectorWindow`

**Imports:**
- External: `blessed`
- Other src/: `theme/resolver`, `ui-primitives`, `ui-parts`, `animation-service`, `types`, `window-manager`, `state-service`, `workspace-service`

**Responsibilities:**
1. Generic animated window factory
2. Pattern field animation
3. Companion (Scramble) idle widget
4. Generative art animation
5. Workspace manager window
6. Command palette window
7. State inspector window
- **SRP violation:** 7 distinct window types. The non-animated windows (workspace manager, command palette, state inspector) don't belong with the animated ones.

**Code Smells:**
- **Grab-bag file:** Unrelated window types lumped together by "doesn't fit elsewhere."
- `openCompanionWindow` (lines 73–112) is a simple idle animation that's been superseded by `scramble-window.ts` — possibly **dead code** or legacy.
- Unused imports: `StateService`, `WorkspaceService`, `DesktopState`, `List`, `LogBox`, `MenuItem`, `WindowKind` — several only used by one function.

**Type Safety:**
- `(list as List & { selected: number })` — 2 instances of the standard blessed cast.

**Coupling:** Mixed. Animation windows are self-contained. Workspace/palette windows depend on service interfaces.

**Refactoring Opportunities:**
1. **Split into files:** `animated-windows.ts` (pattern, art), `workspace-manager-window.ts`, `command-palette-window.ts`, `state-inspector-window.ts`.
2. Remove or deprecate `openCompanionWindow` if superseded by `scramble-window.ts`.
3. Move `BaseWindowDeps` to `types.ts` — it's used by `contour-window.ts`, `terrain-lab-window.ts`, `plasma-window.ts`.

---

### 9. `monster-cam-model.ts` (97 lines)

**Purpose:** Pure data model and update function for Monster Cam — Elm-architecture style state management.

**Exports:** `MonsterCamPhase`, `MonsterCamModel`, `MonsterCamMsg`, `createMonsterCamModel`, `updateMonsterCamModel`

**Imports:**
- Other src/: `figlet-service` (for `renderFiglet`)

**Responsibilities:**
1. Define Monster Cam state shape
2. Handle state transitions via message dispatch
- Single responsibility ✅ Clean Elm-style architecture.

**Code Smells:** None significant. Well-structured.

**Type Safety:** Excellent. Discriminated union for `MonsterCamMsg`, pure function update.

**Coupling:** Very low. Only depends on `renderFiglet` for emotion overlay text.

**Refactoring Opportunities:** None — this is a model file done right.

---

### 10. `monster-cam-window.ts` (164 lines)

**Purpose:** Monster Cam window — live ASCII webcam with face/hand/pose detection overlay.

**Exports:** `openMonsterCamWindow`

**Imports:**
- External: `blessed`
- Same folder: `monster-cam-model.ts`
- Other src/: `theme/resolver`, `ui-parts`, `monster-cam-service`, `webcam-renderer`, `window-manager`

**Responsibilities:**
1. Render webcam frames as ASCII art in a blessed window
2. Wire keyboard/button controls to model dispatch
- Clean separation: model in `monster-cam-model.ts`, view here ✅

**Code Smells:** Minor — `mkBtn` helper creates buttons with inline styles that could use theme tokens more consistently.

**Type Safety:** Clean.

**Coupling:** Low. Delegates to model and services.

**Refactoring Opportunities:** None significant. Good example of the Elm-architecture pattern.

---

### 11. `music-player-window.ts` (1,224 lines)

**Purpose:** WinAMP-style music player with audio playback (ffplay), spectrum analysis (ffmpeg + FFT), and 4 visualization modes.

**Exports:** `MusicPlayerDeps`, `MusicPlayerRestore`, `MusicPlayerPublicAPI`, `VizColors`, `VizMode`, `openMusicPlayerWindow`, plus viz factories (`createBarsViz`, `createRingsViz`, `createGridViz`, `createRainViz`)

**Responsibilities:**
1. Audio playback control (ffplay subprocess management)
2. Audio analysis (FFT, spectrum binning)
3. 4 visualization modes (bars, rings, grid, rain)
4. Playlist management
5. Window UI with toolbar, player pane, playlist pane
- **SRP violation:** Audio engine, FFT analysis, 4 viz modes, and UI all in one file.

**Code Smells:**
- **God class:** `AudioController` (lines 500–680) manages subprocess lifecycle, audio state, volume, scrub, ticker — ~180 lines. Could be its own module.
- **God class:** `AudioAnalyser` (lines 120–220) implements full FFT from scratch — ~100 lines of DSP code. Should be in a service.
- Each viz mode (bars ~60 lines, rings ~70 lines, grid ~90 lines, rain ~70 lines) is self-contained but clutters the window file.
- `fftInPlace` (lines 126–147) is a general-purpose FFT implementation buried in a window file.
- `_opChain` pattern in `AudioController` implements a manual async queue — could use a standard queue library.

**Type Safety:**
- `(this._proc as any)?.stdin?.write(input)` — 1 `any` cast.
- `(playlistPane as any).setItems` / `(playlistPane as any).select` — 2 blessed type casts.
- `(frame as any).musicPlayer = publicAPI` — 1 duck-typed API attachment.

**Coupling:** Moderate. Self-contained except for theme, window manager, overlay manager. Spawns ffplay/ffmpeg subprocesses directly.

**Refactoring Opportunities:**
1. **Extract `AudioController`** to `services/audio-controller.ts` — it's a pure audio engine with no UI dependencies.
2. **Extract `AudioAnalyser`** (including `fftInPlace`) to `services/audio-analyser.ts` — it's pure DSP.
3. **Extract viz modes** to `services/music-viz-modes.ts` — they implement a clean `VizMode` interface and have zero UI dependencies.
4. After extraction, `music-player-window.ts` drops to ~400 lines of pure UI wiring.

---

### 12. `plasma-window.ts` (314 lines)

**Purpose:** Plasma screensaver window — animated colour-field with mood presets, render modes, and fullscreen toggle.

**Exports:** `PlasmaWindowOptions`, `openPlasmaWindow`

**Imports:**
- External: `blessed`, `node:fs`, `node:path`
- Same folder: `generative-windows.ts` (for `BaseWindowDeps`)
- Other src/: `theme/resolver`, `ui-parts`, `plasma-engine`

**Responsibilities:**
1. Plasma animation window with sidebar info panel
2. Fullscreen toggle with geometry save/restore
- Cohesive ✅

**Code Smells:**
- ANSI colour constant object `A` (lines 37–48) duplicated identically in `terrain-lab-window.ts` — **code duplication**.
- `toggleFullscreen` (lines 254–287) implements a complex pause → resize → show/hide → resume sequence. Fragile timing with `setTimeout(…, 50)`.
- `chromeNodes()` returns array for hide/show — iterating all chrome nodes is a layout concern that should be in the stack abstraction.

**Type Safety:**
- `frame.frame.width = "plasma" as any` — well, `"plasma" as any` for kind registration (line 70). Actually it's `"plasma" as any` for kind — 1 cast.

**Coupling:** Low. Delegates to `plasma-engine` service.

**Refactoring Opportunities:**
1. Extract shared ANSI constant object `A` to a shared module (used identically in `terrain-lab-window.ts`).
2. Move fullscreen toggle logic to a reusable `FullscreenMixin` — other windows could benefit.

---

### 13. `scramble-window.ts` (573 lines)

**Purpose:** Scramble (LLM cat companion) window — two entry points: full floating window (S1) and three-state clippy popup (S2, smol/tall).

**Exports:** `ScrambleFloatingDeps`, `openScrambleFloatingWindow`, `ScramblePopupMode`, `ScrambleSmolDeps`, `openScrambleSmolPopup`

**Imports:**
- External: `blessed`
- Same folder: `wibwob-agent-render.ts` (for `C()` color helper)
- Other src/: `theme/resolver`, `ui-primitives`, `ui-parts`, `window-manager`, `scramble-brain`

**Responsibilities:**
1. Full floating chat window with transcript, input, cat art
2. Smol/tall popup mode with expand/pop-out controls
3. Shared input handling (keypress → draft → submit)
4. Transcript rendering from brain history
- Two distinct window modes. Input handling is shared via `wireInput` helper.

**Code Smells:**
- **Code duplication:** The floating window (lines 137–262) and smol popup (lines 275–500) share ~60% of their structure (cat rendering, transcript, input, status). Only layout/sizing differs.
- `wireInput` helper (lines 66–97) reimplements the same draft-based input pattern found in `wibwob-agent-window.ts` — should be a shared primitive.
- `(frame as unknown as Record<string, unknown>)._scrambleExpand` / `_scramblePopOut` — 2 duck-typed API attachments.
- `renderHistory` uses `C()` colours from `wibwob-agent-render` — couples Scramble to the agent render module.

**Type Safety:**
- `(mouse as unknown as { x: number }).x` — 1 unsafe cast for blessed mouse event.

**Coupling:** Moderate. Depends on `ScrambleBrain` service and `wibwob-agent-render` for colour palette.

**Refactoring Opportunities:**
1. **Unify S1 and S2** into a single window factory with a `mode: "floating" | "smol" | "tall"` parameter — eliminate duplicate rendering logic.
2. Extract `wireInput` to `ui-parts.ts` as a reusable draft-input primitive — used here and in `wibwob-agent-window.ts`.
3. Define typed interfaces for `_scrambleExpand` / `_scramblePopOut` API hooks.

---

### 14. `terrain-lab-window.ts` (253 lines)

**Purpose:** Terrain Lab — contour map with info panel sidebar, proving the contour engine is composable.

**Exports:** `openTerrainLabWindow`

**Imports:**
- External: `blessed`, `node:fs`, `node:path`
- Same folder: `generative-windows.ts` (for `BaseWindowDeps`)
- Other src/: `theme/resolver`, `ui-parts`, `contour-engine`

**Responsibilities:**
1. Contour map visualization with mode/terrain/seed/levels controls
2. Rich ANSI-coloured info sidebar
3. Frame save to disk
- Cohesive ✅

**Code Smells:**
- ANSI colour constant object `A` (lines 29–40) — **exact duplicate** of the one in `plasma-window.ts`.
- Very similar structure to `plasma-window.ts` (header + canvas + info + status layout). Could share a `LabWindowFactory`.

**Type Safety:** Clean.

**Coupling:** Low.

**Refactoring Opportunities:**
1. Extract shared `A` ANSI constants to a common module.
2. Consider a shared `LabWindow` abstraction for terrain-lab and plasma — they share identical layout patterns.

---

### 15. `text-windows.ts` (335 lines)

**Purpose:** Unified smart editor window — edit mode (writable) and view mode (formatted markdown reader) with toggle.

**Exports:** `EditorWindowParams`, `openEditorWindow`

**Imports:**
- External: `blessed`
- Other src/: `theme/resolver`, `ui-primitives`, `ui-parts`, `window-manager`, `overlay-manager`, `types`, `markdown-service`, `ansi-utils`

**Responsibilities:**
1. Edit mode: writable text editor widget
2. View mode: rendered markdown viewer with figlet headings, scroll, copy
3. Mode toggling between edit and view
- Cohesive dual-mode editor ✅

**Code Smells:**
- `nearestCodeBlock` (lines 310–325) is a utility that could be in markdown-service.
- Dynamic `require("node:child_process")` (line 279) for clipboard — should be a static import.
- `renderView` reads file from disk on every call — no caching of file content, only of rendered lines.

**Type Safety:**
- `(scrollBox as any).scroll(delta)` — 3 `any` casts for blessed scroll methods.
- `(scrollBox as any).childBase` — 2 more for scroll state access.

**Coupling:** Moderate. Depends on markdown service, overlay manager. The `renderEditor` callback is injected — good separation.

**Refactoring Opportunities:**
1. Move `nearestCodeBlock` to `markdown-service.ts`.
2. Replace dynamic `require` with static import.

---

### 16. `wibwob-agent-render.ts` (234 lines)

**Purpose:** Rendering logic for the Wib&Wob Agent chat transcript — message formatting, tool run rendering, transcript block model.

**Exports:** `C` (color palette), `renderMessage`, `renderToolRun`, `TranscriptBlock`, `buildTranscriptBlocks`, `renderTranscript`

**Imports:**
- Other src/: `theme/resolver`, `types` (`ChatMessageEntry`, `ToolRun`)

**Responsibilities:**
1. Message rendering (user/assistant/status with blessed tags)
2. Tool run rendering (collapsible summaries)
3. Transcript block model (ordered list of text + tool-run blocks)
4. Legacy flat transcript renderer
- Multiple render concerns but all serve the agent transcript ✅

**Code Smells:**
- `shortenToolResult` (lines 97–103) duplicates regex patterns from `renderMessage` (lines 62–66) — the same `tui_run_command` shortening logic appears twice.
- `renderTranscript` (lines 200–220) marked as legacy — candidate for removal.
- Kaomoji faces (`WIB_FACE`, `WOB_FACE`) are hardcoded creative content — fine, but surprising to find in a render module.

**Type Safety:** Clean. Well-typed discriminated unions for `TranscriptBlock`.

**Coupling:** Low. Pure rendering functions, only depends on theme and types.

**Refactoring Opportunities:**
1. DRY the `tui_run_command` shortening regex into a single utility.
2. Remove `renderTranscript` if no callers use it (it's imported by `wibwob-agent-window.ts` but may not be called).

---

### 17. `wibwob-agent-window.ts` (556 lines)

**Purpose:** The main Wib&Wob Agent chat window — chat input, transcript display with collapsible tool runs, session management, inline audio player bar.

**Exports:** `openWibWobAgentWindow`

**Imports:**
- External: `blessed`, `node:fs`, `node:path`, `@mariozechner/pi-coding-agent`
- Same folder: `agent-slash-commands.ts`, `wibwob-agent-render.ts`
- Other src/: `config`, `theme/resolver`, `ui-primitives`, `ui-parts`, `types`, `window-manager`, `pi-session-bridge`, `wibwob-agent-session`, `audio-player-controller`, `agent-session-helpers`

**Responsibilities:**
1. Chat input with multi-line draft
2. Block-based transcript rendering (text + collapsible tool runs)
3. Info bar with clickable session/log links
4. Inline audio player bar
5. Session resume command handling
6. Log viewer opening
- **SRP violation:** 6 responsibilities. The inline player bar and session resume logic are separable.

**Code Smells:**
- `updateTranscript` (lines 265–370) is ~100 lines of DOM-like diffing for blessed widgets — complex, hard to follow.
- Draft input handling (lines 380–430) reimplements the same pattern as `scramble-window.ts` `wireInput` — **code duplication**.
- `runResumeCommand` (lines 180–230) is session management logic that could be a separate module.
- `openLogViewer` (lines 235–250) creates a minimal editor frame inline — duplicates logic from `text-windows.ts`.
- `renderPlayerBar` (lines 112–145) builds a complex coloured string inline — could be a render function in `audio-player-controller`.

**Type Safety:**
- `(mouse as unknown as { x: number }).x` — 2 casts for blessed mouse events.
- No other significant issues.

**Coupling:** High. Imports from 12 modules. Directly uses `SessionManager` from pi-coding-agent, manages block lifecycle, subscribes to audio player.

**Refactoring Opportunities:**
1. **Extract `wireInput`** to a shared draft-input primitive in `ui-parts.ts` (shared with `scramble-window.ts`).
2. **Extract `runResumeCommand`** to `agent-session-helpers.ts` or the slash commands module.
3. **Extract inline player bar** to a reusable `PlayerBarWidget` — it has its own lifecycle and subscription.
4. **Extract `openLogViewer`** to use the existing editor window factory.

---

## Folder Summary

### Overall Responsibility and Cohesion

The `src/windows/` folder contains **window factory functions** — each creates a blessed-based UI window, wires keyboard/mouse events, registers with the WindowManager, and provides `describeState`/`cleanup`/`onRestyle` hooks. This is a cohesive folder purpose.

However, **cohesion within files is poor**. Several files are grab-bags of unrelated window types (`generative-windows.ts` has 7, `browser-windows.ts` has 4), and large files mix UI code with business logic (audio engines, FFT, subprocess management, git status).

### Files That Don't Belong

| File | Issue |
|------|-------|
| `monster-cam-model.ts` | Pure data model — belongs in `services/` |
| `wibwob-agent-render.ts` | Pure rendering logic — could be in `services/` |
| `openBrowserReaderWindow` (in `figlet-windows.ts`) | Unrelated to figlet — belongs in `text-windows.ts` |

### Internal Dependency Graph

```
wibwob-agent-window.ts
  ├── agent-slash-commands.ts
  └── wibwob-agent-render.ts

scramble-window.ts
  └── wibwob-agent-render.ts  (for C() colors)

backrooms-windows.ts
  └── backrooms-log-browser-window.ts

contour-window.ts ──┐
plasma-window.ts ───┤── generative-windows.ts (BaseWindowDeps)
terrain-lab-window.ts──┘

monster-cam-window.ts
  └── monster-cam-model.ts
```

### Cross-Folder Dependencies

| Dependency Target | Files Using It | Notes |
|------------------|---------------|-------|
| `core/theme/resolver.js` | All 17 | Universal — expected |
| `core/ui-parts.js` | 15/17 | Heavy reliance on shared UI primitives |
| `core/window-manager.js` | 15/17 | Expected — all windows register |
| `core/types.js` | 12/17 | Shared type definitions |
| `core/overlay-manager.js` | 7/17 | For prompts, flash messages |
| `services/` various | 12/17 | Service layer dependencies |
| `core/config.js` | 2/17 | `REPO_ROOT` constant |

### Top 5 Priority Refactoring Actions

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Split `browser-windows.ts`** into 4 files (primer-browser, primer-gallery, text-viewer, file-manager). The file manager alone is 1,400 lines with 6+ subsystems. | Massive readability improvement, enables independent testing | Medium |
| 2 | **Extract `music-player-window.ts` internals**: `AudioController` → `services/audio-controller.ts`, `AudioAnalyser` + FFT → `services/audio-analyser.ts`, viz modes → `services/music-viz-modes.ts`. Window drops from 1,224 to ~400 lines. | Reusable audio engine, testable DSP code | Medium |
| 3 | **Extract shared draft-input primitive** (`wireInput`) from `scramble-window.ts` and `wibwob-agent-window.ts` into `ui-parts.ts`. Same pattern reimplemented in both. | Eliminates duplication, consistent input behavior | Low |
| 4 | **Split `generative-windows.ts`** into focused files. Move `BaseWindowDeps` to `types.ts` (3 other files import it). Move workspace manager, command palette, state inspector to their own files. Deprecate `openCompanionWindow` if superseded. | Folder becomes navigable, each file has one purpose | Low |
| 5 | **Extract `BackroomsTvWindow` subprocess management** from `backrooms-windows.ts` into a `BackroomsTvController` service. Extract primer picker to its own file. The 460-line `openBackroomsTvWindow` function manages process lifecycle, timer fallbacks, and UI — three distinct layers. | Testable process management, cleaner window code | Medium |

### Aggregate Metrics

| Metric | Count |
|--------|-------|
| Total `any` casts | ~45+ |
| `(list as List & { selected: number })` casts | ~25+ |
| `(frame as unknown as Record<string, unknown>)` casts | ~6 |
| Dynamic `require()` calls | 3 |
| Functions > 200 lines | 5 (`openFileManagerWindow`, `openBackroomsTvWindow`, `openMusicPlayerWindow`, `openBackroomsPrimerPicker`, `openWibWobAgentWindow`) |
| Functions > 100 lines | 8 |
| Duplicated patterns | 3 (ANSI constants, draft input, tool result shortening) |
