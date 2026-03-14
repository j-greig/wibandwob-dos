# src/core/ — Codebase Analysis Report

**Scope:** 37 top-level `.ts` files in `src/core/` (theme/ subdirectory excluded)  
**Total lines:** ~12,857

---

## Per-File Analysis

### 1. `ansi-utils.ts` (378 lines)

**Purpose:** ANSI-aware text measurement, word-wrapping, and escape-code tracking for terminal output.

**Exports:** `visibleWidth`, `extractAnsiCode`, `AnsiCodeTracker`, `wrapTextWithAnsi`, `clipToVisibleWidth`, `padToWidth`, `stripAnsi`

**Imports:**
- External: `get-east-asian-width`
- Same-folder: none
- Other src/: none

**Responsibilities:** 1 — ANSI text processing. Clean SRP.

**Code Smells:** None significant. Well-structured with internal helpers.

**Type Safety:** ✅ Good. No `as any`, return types on all public functions.

**Coupling:** Very low — standalone utility, no dependencies on other core files.

**Refactoring:** None needed. Exemplary utility file.

---

### 2. `app-controller.ts` (2,244 lines)

**Purpose:** Application composition root — owns startup, menus, window openers, workspace restore, theme application, global keybindings, and control API wiring.

**Exports:** `DEV_RELOAD_EXIT_CODE`, `TsTuiMvpApp`

**Imports:**
- External: `blessed`, `node:fs`, `node:os`, `node:path`, `node:child_process`
- Same-folder: `config.js`, `cli.js`, `command-registry.js`, `context-menu-items.js`, `desktop-geometry.js`, `menu-overlay-manager.js`, `overlay-manager.js`, `theme/resolver.js`, `ui-primitives.js`, `workspace-snapshots.js`, `snapshot-registry.js`, `types.js`, `window-chrome.js`, `window-manager.js`, `render-scheduler.js`, `shell-chrome.js`, `runtime-stats.js`, `custom-cursor.js`, `editor-coordinator.js`, `unicode-patch.js`
- Other src/: `services/app-logger.js`, `services/module-loader.js`, `services/content-measurement.js`, `services/control-api.js`, `services/content-service.js`, `services/figlet-service.js`, `services/file-actions.js`, `services/state-service.js`, `services/capability-service.js`, `services/workspace-ui.js`, `services/workspace-service.js`, `services/canvas-document.js`, `services/plasma-engine.js`, `services/scramble-brain.js`, `services/chrome-browser-service.js`, `services/wibwob-agent-session.js`, `services/world-chat-service.js`, `windows/backrooms-windows.js`, `windows/browser-windows.js`, `windows/figlet-windows.js`, `windows/generative-windows.js`, `windows/scramble-window.js`, `windows/contour-window.js`, `windows/plasma-window.js`, `windows/music-player-window.js`, `windows/terrain-lab-window.js`, `windows/text-windows.js`, `windows/wibwob-agent-window.js`, `windows/chrome-browser-window.js`, `windows/monster-cam-window.js`

**Responsibilities:** ⚠️ **MANY (SRP violation)**
1. Service graph construction (constructor)
2. Window opener methods (~20 open* methods)
3. Action bridge (`getAppMenuActions()` — 200+ lines)
4. Workspace save/load/restore
5. Theme management
6. Global keybindings
7. FX scripts (`runFxScript`, `smearTextSurface`)
8. Clipboard operations (`copyFocusedWindowText`, `exportFocusedWindowText`)
9. Context menu routing
10. Primer info resolution

**Code Smells:**
- **God object**: `TsTuiMvpApp` is the largest class at 2,244 lines. It touches nearly every subsystem.
- **Long method**: `getAppMenuActions()` (lines ~1690–2210) is ~520 lines of action bridging boilerplate.
- **Feature envy**: `smearTextSurface()` (lines ~1539–1640) has deep knowledge of Python script arguments — belongs in a service.
- **Feature envy**: `runFxScript()` (lines ~1450–1530) similarly shell-outs belong in a service.
- **Shotgun surgery**: Adding a new window type requires changes in constructor, open method, restore actions, and getAppMenuActions.

**Type Safety:** 3 `as any` casts (lines with `(screen as any).screenshot()`, `(record.frame.style as any)`, `renderMode as any`). Return types mostly implied by methods.

**Coupling:** Extremely high — imports from 30+ files across services/ and windows/. This is the expected coupling for a composition root, but the file does too much beyond composition.

**Refactoring Opportunities:**
1. **Extract FX service** — Move `runFxScript()` and `smearTextSurface()` into `src/services/fx-service.ts`.
2. **Extract action bridge** — `getAppMenuActions()` could be a standalone factory function in its own file, reducing app-controller by ~500 lines.
3. **Extract clipboard service** — `copyFocusedWindowText()` and `exportFocusedWindowText()` → `src/services/clipboard-service.ts`.
4. **Window opener registry pattern** — Replace the 20+ individual `open*Window` methods with a registry pattern, similar to how snapshot-registry works.

---

### 3. `appearance-service.ts` (24 lines)

**Purpose:** Global appearance mode selection (light/dark). Currently always resolves to dark.

**Exports:** `getAppearanceMode`, `setAppearanceMode`

**Imports:** Same-folder: `theme/types.js`, `theme/resolver.js`

**Responsibilities:** 1 — Appearance mode.

**Code Smells:**
- **Lazy class / Speculative generality**: Only 24 lines, mostly stubbed. The "Future" comments suggest premature abstraction.

**Type Safety:** ✅ Good.

**Coupling:** Low.

**Refactoring:** Consider inlining into `theme/resolver.ts` unless light mode is imminent.

---

### 4. `canvas-types.ts` (61 lines)

**Purpose:** Shared types for `.canvas.yaml` documents — layout primitives for ZINE rendering.

**Exports:** `ZineItemType`, `ZineSourceType`, `ZineItem`, `ZineLayoutResult`, `CanvasColumnDef`, `CanvasDocument`

**Imports:**
- Other: `../../modules/sy2-chronicles/panel-types.js` (CEPanelDef)

**Responsibilities:** 1 — Type definitions.

**Code Smells:**
- **Inappropriate intimacy**: Imports from `modules/sy2-chronicles/panel-types.js` — a core type file depending on a module is an architectural inversion.

**Type Safety:** ✅ Pure types.

**Coupling:** The module dependency is concerning — should be inverted.

**Refactoring:** Move `CEPanelDef` to a shared types location (or define the shape in core and have the module conform to it).

---

### 5. `cli.ts` (66 lines)

**Purpose:** CLI flag parser — single source of truth for command-line options.

**Exports:** `AppFlags`, `parseAppFlags`, `appFlags`, `printHelp`

**Imports:** External: `node:util`

**Responsibilities:** 1 — CLI parsing.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Zero — no internal dependencies.

**Refactoring:** None needed.

---

### 6. `command-catalog.ts` (1,307 lines)

**Purpose:** Single source of truth for user-visible command metadata — IDs, groups, menu/palette/context-menu placements, and API visibility.

**Exports:** `AppMenuActions` (interface), `AppCommandCategory`, `AppCommandGroup`, `MenuPlacement`, `PalettePlacement`, `ContextMenuPlacement`, `AppCommandDefinition`, `AppCommandDescriptor`, `getCommandDefinition`, `listAppCommands`, `createMenuConfigs`, `createPaletteCommands`

**Imports:**
- External: `zod`
- Same-folder: `types.js`
- Other src/: `services/capability-service.js`

**Responsibilities:** 2 (borderline)
1. Command definition data
2. Menu/palette projection logic

**Code Smells:**
- **Data clump**: The `APP_COMMANDS` array is a 900+ line data block. This is intentional (canonical source of truth) but makes the file very long.
- **Primitive obsession**: `AppMenuActions` interface has 100+ method signatures with `(args?: Record<string, unknown>)` — no type narrowing per-command.

**Type Safety:** Good — uses Zod schemas for params on newer commands. Older commands use untyped `Record<string, unknown>`.

**Coupling:** Moderate — depends on `types.js` and `capability-service.js`.

**Refactoring:**
1. Consider splitting `APP_COMMANDS` data into a separate file (e.g., `command-definitions.ts`) from the projection functions.
2. Gradually add Zod `params` schemas to all commands for uniform validation.

---

### 7. `command-registry.ts` (306 lines)

**Purpose:** Runtime command execution and listing — bridges catalog definitions to controller actions.

**Exports:** `CommandRegistry`, `CommandSurface`, `CommandListItem`, `CommandRunResult`, `DynamicCommandDefinition`

**Imports:**
- External: `zod-to-json-schema`
- Same-folder: `command-catalog.js`, `types.js`
- Other src/: `services/app-logger.js`, `services/capability-service.js`

**Responsibilities:** 2
1. Built-in command execution
2. Dynamic (microapp) command registration

**Code Smells:**
- **Long legacy alias map** (`LEGACY_COMMAND_ALIASES`, ~50 entries) — necessary but adds visual noise.

**Type Safety:** ✅ Good. `safeSerializable()` properly guards cyclic objects.

**Coupling:** Moderate — depends on catalog and capability service.

**Refactoring:** Extract `LEGACY_COMMAND_ALIASES` to its own file or to `command-catalog.ts`.

---

### 8. `config.ts` (51 lines)

**Purpose:** Central configuration constants — paths, ports, roots.

**Exports:** `PRIMER_ROOTS`, `SRC_ROOT`, `APP_ROOT`, `REPO_ROOT`, `PI_DIR`, `SCRATCH_BASE`, `WORKSPACES_DIR`, `STATE_PATH`, `CONTROL_API_PORT`, etc.

**Imports:** External: `node:path`, `node:url`

**Responsibilities:** 1 — Configuration.

**Code Smells:**
- 5 `@deprecated` aliases at the bottom — should be cleaned up once all consumers are migrated.

**Type Safety:** ✅ Good.

**Coupling:** Zero — leaf node.

**Refactoring:** Remove deprecated aliases.

---

### 9. `context-menu-items.ts` (87 lines)

**Purpose:** Context menu adapter — builds context menus from registry commands plus local file-path actions.

**Exports:** `createFilePathMenuItems`, `buildWindowContextMenu`, `buildDesktopContextMenu`

**Imports:** Same-folder: `command-registry.js`, `types.js`. External: `node:child_process`.

**Responsibilities:** 1 — Context menu construction.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Low — depends only on registry and types.

**Refactoring:** None needed.

---

### 10. `custom-cursor.ts` (72 lines)

**Purpose:** Custom TUI cursor overlay — tracks mouse and renders a themed character.

**Exports:** `CustomCursor`

**Imports:** External: `blessed`. Same-folder: `theme/resolver.js`.

**Responsibilities:** 1 — Cursor rendering.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Low.

**Refactoring:** None needed.

---

### 11. `desktop-geometry.ts` (22 lines)

**Purpose:** Screen geometry service — provides width, height, cell aspect ratio.

**Exports:** `DesktopGeometry`, `DesktopGeometryService`

**Imports:** External: `blessed` (type only).

**Responsibilities:** 1 — Geometry.

**Code Smells:**
- **Lazy class**: Only 22 lines. The env-var parsing could be inlined.

**Type Safety:** ✅ Good.

**Coupling:** Zero.

**Refactoring:** Consider inlining into config or a more substantial geometry module.

---

### 12. `editor-coordinator.ts` (247 lines)

**Purpose:** Owns all editor open/save/dirty/render/keypress behavior — extracted from app-controller.

**Exports:** `EditorCoordinator`, `EditorCoordinatorDeps`

**Imports:**
- Same-folder: `window-manager.js`, `render-scheduler.js`, `types.js`, `overlay-manager.js`
- Other src/: `services/content-service.js`, `windows/text-windows.js`, `services/file-actions.js`, `services/editor-service.js`

**Responsibilities:** 1 — Editor lifecycle. Good SRP.

**Code Smells:** None significant.

**Type Safety:** ✅ Good.

**Coupling:** Moderate — needs window manager, overlays, and content service.

**Refactoring:** None needed — well-extracted coordinator.

---

### 13. `empty-states.ts` (11 lines)

**Purpose:** Canonical empty-state strings for consistent wording across windows.

**Exports:** 5 string constants.

**Responsibilities:** 1 — Constants.

**Code Smells:** None.

**Type Safety:** ✅

**Coupling:** Zero.

---

### 14. `grid-canvas.ts` (120 lines)

**Purpose:** Pure 2D string-canvas API for programmatic ASCII drawing.

**Exports:** `blankGrid`, `paintText`, `gridToText`, `paintCentered`, `drawArrow`, `paintLines`, `waveLine`, `bar`

**Imports:** Same-folder: `ansi-utils.js`, `ui-parts.js` (clamp).

**Responsibilities:** 1 — Grid canvas operations.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Low.

**Refactoring:** None needed.

---

### 15. `menu-overlay-manager.ts` (338 lines)

**Purpose:** Manages dropdown menus (File, Edit, View, etc.) and popup context menus.

**Exports:** `MenuOverlayManager`

**Imports:** External: `blessed`. Same-folder: `theme/resolver.js`, `types.js`.

**Responsibilities:** 2 (borderline)
1. Dropdown menu UI
2. Popup/context menu UI

**Code Smells:**
- **`(this.menuList as any).select()`** — 3 `as any` casts to work around blessed type gaps.
- **Long method**: `openMenu()` is ~100 lines — could extract separator/selectable logic.

**Type Safety:** 3 `as any` casts for blessed internals.

**Coupling:** Low — depends only on theme and types.

**Refactoring:** Extract `findNextSelectable` and separator rendering to shared helpers.

---

### 16. `modal.ts` (383 lines)

**Purpose:** Reusable modal positioning, creation, button bars, and toast notifications.

**Exports:** `ModalPosition`, `ModalOptions`, `Modal`, `createModal`, `ButtonDef`, `ButtonBarOptions`, `ButtonBar`, `createButtonBar`, `ToastOptions`, `showToast`

**Imports:** External: `blessed`, `string-width`. Same-folder: `theme/resolver.js`, `types.js`.

**Responsibilities:** 3
1. Modal positioning/creation
2. Button bar primitive
3. Toast notifications

**Code Smells:** None significant — responsibilities are cohesive (all transient UI).

**Type Safety:** 1 `as any` cast (`(screen as any).grabKeys`).

**Coupling:** Low.

**Refactoring:** None needed — good cohesion despite multiple exports.

---

### 17. `overlay-manager.ts` (937 lines)

**Purpose:** Shared transient UI primitives — flash toasts, value/path prompts, list pickers, browser prompts, and file browser dialogs.

**Exports:** `OverlayManager`

**Imports:** External: `blessed`, `node:fs`, `node:path`. Same-folder: `theme/resolver.js`, `empty-states.js`, `modal.js`, `types.js`.

**Responsibilities:** ⚠️ **MANY (SRP violation)**
1. Flash notifications
2. Value prompts (text input)
3. Path prompts (with tab completion)
4. List pickers (centered)
5. Browser prompts (split-pane with search/preview)
6. File browser prompts (directory navigation)
7. Active overlay state tracking

**Code Smells:**
- **God class**: 937 lines with 6 different prompt/dialog types.
- **Long methods**: `openBrowserPrompt()` (~120 lines), `openFileBrowserPrompt()` (~170 lines).
- **Data clumps**: Each prompt method creates similar blessed widget configurations (searchBox, list, preview, footer bar).

**Type Safety:** Multiple `as any` casts for blessed `.selected` property and `(list as List & { selected: number })`.

**Coupling:** Low — only depends on theme/modal.

**Refactoring:**
1. **Extract prompt types** — Each prompt type (browser, file-browser, centered-list) could be its own function in separate files under `src/core/overlays/`.
2. **DRY widget creation** — The search+list+preview pattern is duplicated between `openBrowserPrompt` and `openFileBrowserPrompt`.

---

### 18. `panel-layout.ts` (335 lines)

**Purpose:** Magazine-style panel layout primitives — column and row-flowing grid layout.

**Exports:** `PanelDef`, `PanelNode`, `LayoutResult`, `COL_GAP`, `layoutColumns`, `layoutPanels`, `measureViewport`, `pointerToContent`, `hitPanel`

**Imports:** External: `blessed`. Same-folder: `ui-parts.js` (clamp), `canvas-types.js`.

**Responsibilities:** 2
1. Layout algorithms (column + row-flow)
2. Hit-testing utilities

**Code Smells:** None significant.

**Type Safety:** ✅ Good.

**Coupling:** Low.

**Refactoring:** None needed.

---

### 19. `primitives.ts` (36 lines)

**Purpose:** Auto-generated barrel re-export index for shared reusable primitives.

**Exports:** Re-exports from `render-monitor.js`, `theme/resolver.js`, `theme/types.js`, `ui-parts.js`, `ui-primitives.js`, `window-chrome.js`, `services/animation-service.js`, `services/content-measurement.js`, `services/monster-cam-service.js`, `services/webcam-renderer.js`.

**Responsibilities:** 1 — Re-export aggregation.

**Code Smells:** None — auto-generated.

**Coupling:** High by design — barrel file.

---

### 20. `render-monitor.ts` (126 lines)

**Purpose:** Measures blessed screen render throughput — FPS, frame time, subscription.

**Exports:** `RenderMonitorHandle`, `RenderReading`, `formatRenderReading`, `createRenderMonitor`

**Imports:** None.

**Responsibilities:** 1 — Render performance monitoring.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Zero.

---

### 21. `render-scheduler.ts` (84 lines)

**Purpose:** App-level render invalidation seam — batches sync/persist/render requests into single flushes.

**Exports:** `RenderSchedulerCallbacks`, `RenderScheduler`, `createRenderScheduler`

**Imports:** None.

**Responsibilities:** 1 — Render scheduling.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Zero.

---

### 22. `runtime-stats.ts` (113 lines)

**Purpose:** Runtime stats badge — render FPS, memory, agent activity display.

**Exports:** `RuntimeStatsSnapshot`, `RuntimeStatsController`

**Imports:** External: `blessed`. Same-folder: `render-monitor.js`, `theme/resolver.js`.

**Responsibilities:** 1 — Stats display.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Low.

---

### 23. `shell-chrome.ts` (239 lines)

**Purpose:** Shell-only chrome — desktop wallpaper, identity widgets, status line, dev restart, kaomoji mood rotation.

**Exports:** `ShellChromeController`

**Imports:** External: `blessed`, `string-width`. Same-folder: `cli.js`, `theme/resolver.js`, `types.js`.

**Responsibilities:** 3
1. Status line rendering
2. Desktop wallpaper pattern
3. Kaomoji mood animation

**Code Smells:**
- **Mixed concerns**: Kaomoji mood animation (~80 lines, MOODS array + blink logic) is a fun feature but feels out of place in shell chrome.

**Type Safety:** ✅ Good.

**Coupling:** Low.

**Refactoring:** Consider extracting kaomoji mood engine to a small standalone file.

---

### 24. `skeleton-renderer.ts` (273 lines)

**Purpose:** Renders stick-figure skeletons onto WebcamCell grids from normalised pose landmarks.

**Exports:** `NormalisedLandmarks`, `POSE_CONNECTIONS`, `POSE_PRESETS`, `landmarksFromPreset`, `renderSkeletonAt`

**Imports:** Other src/: `services/webcam-renderer.js` (WebcamCell type).

**Responsibilities:** 2
1. Pose preset definitions (~150 lines of coordinate data)
2. Skeleton rendering logic

**Code Smells:**
- **Data clump**: 150+ lines of hardcoded pose coordinate arrays. Could be loaded from a data file.

**Type Safety:** ✅ Good.

**Coupling:** Low — only depends on WebcamCell type.

**Refactoring:** Consider moving pose presets to a JSON/data file.

---

### 25. `snapshot-registry.ts` (427 lines)

**Purpose:** Compiler-enforced save/restore parity for workspace snapshots — every persistable window type must register handlers.

**Exports:** `SnapshotHandler`, `SnapshotRestoreActions`, `snapshotRegistry`, `registerDynamicSnapshot`, `isPersistable`, `registrySerialize`, `registryRestore`

**Imports:** Same-folder: `types.js`, `window-facade.js`. Other src/: `services/figlet-service.js`.

**Responsibilities:** 2
1. Snapshot handler registry
2. Legacy appType remapping

**Code Smells:**
- `legacyAppTypeRemap` is growing (11 entries) — sign of naming churn.

**Type Safety:** ✅ Good. Uses `satisfies Record<PersistableAppType, SnapshotHandler>` for exhaustive coverage.

**Coupling:** Moderate — knows about all persistable window types.

---

### 26. `tree-widget.ts` (297 lines)

**Purpose:** Reusable tree widget with expand/collapse, keyboard navigation, and callbacks.

**Exports:** `TreeNode`, `TreeWidgetHandle`, `createTreeWidget`

**Imports:** External: `blessed`. Same-folder: `ui-primitives.js`, `theme/resolver.js`.

**Responsibilities:** 1 — Tree widget.

**Code Smells:** None.

**Type Safety:** 1 `as any` cast (`(list as ... & { selected?: number }).selected`).

**Coupling:** Low.

---

### 27. `types.ts` (352 lines)

**Purpose:** Central type definitions — WindowKind, WindowRecord, AppType, DesktopState, MenuConfig, and type guards.

**Exports:** ~30 types/interfaces including `WindowKind`, `WindowRecord`, `DesktopState`, `PersistableAppType`, `AppType`, `FinderController`, `MenuItem`, `MenuConfig`, plus type guards.

**Imports:** External: `blessed`. Other src/: `services/content-measurement.js`.

**Responsibilities:** 1 — Type definitions. 

**Code Smells:**
- **Large interface**: `WindowRecord` has ~25 optional fields spanning editor, finder, microapp, and cross-cutting concerns. This is a "bag of optionals" pattern.

**Type Safety:** ✅ Good — type guards (`isEditorWindow`, `isFinderWindow`, `isMicroappWindow`) properly narrow.

**Coupling:** Low — types are imported everywhere but that's expected.

**Refactoring:** The `WindowRecord` "bag of optionals" is a known limitation. Could use discriminated unions by `kind`, but the cost is high for the benefit.

---

### 28. `ui-parts-data.ts` (438 lines)

**Purpose:** Data display component primitives — key-value panel, log view, data table.

**Exports:** `createKeyValuePanel`, `createLogView`, `createDataTable` (+ types)

**Imports:** External: `blessed`. Same-folder: `theme/resolver.js`, `ui-parts.js`.

**Responsibilities:** 1 — Data display components (cohesive group).

**Code Smells:** None significant.

**Type Safety:** 2 `as any` casts (blessed event typing).

**Coupling:** Low.

---

### 29. `ui-parts-feedback.ts` (275 lines)

**Purpose:** Feedback component primitives — progress bar, spinner, per-window toast.

**Exports:** `createProgressBar`, `createSpinner`, `createToast` (+ types)

**Imports:** External: `blessed`. Same-folder: `theme/resolver.js`, `ui-parts.js`.

**Responsibilities:** 1 — Feedback components.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Low.

---

### 30. `ui-parts-forms.ts` (881 lines)

**Purpose:** Form control primitives — button, checkbox, radio group, select, filterable list, form field, text area.

**Exports:** `createButton`, `createCheckbox`, `createRadioGroup`, `createSelect`, `createFilterableList`, `createFormField`, `createTextArea` (+ types)

**Imports:** External: `blessed`. Same-folder: `theme/resolver.js`, `ui-parts.js`.

**Responsibilities:** 1 — Form controls (cohesive group).

**Code Smells:**
- **Repetition**: Each control follows the same pattern (node creation, getStyle, applyVisuals, layout, update, destroy). A higher-order factory could reduce boilerplate.

**Type Safety:** 3 `as any` casts (blessed textarea getValue/setValue).

**Coupling:** Low.

**Refactoring:** Consider a `createControl()` base helper that handles the common layout/restyle/destroy pattern.

---

### 31. `ui-parts.ts` (2,395 lines)

**Purpose:** Internal layout primitives — stack, row, grid, header/status bars, text block, scroll viewport, collapsible blocks, tabbed container, pattern generators, colour helpers, selectable list, sidebar panel, inline search, restyle bundle.

**Exports:** ~80+ exports including `createStack`, `createRow`, `createGrid`, `pickBreakpoint`, `createScrollViewport`, `createTabs`, `PATTERNS`, `createSidebarPanel`, `createSelectableList`, `createInlineSearch`, `createRestyleBundle`, `createBorderedPanel`, etc.

**Imports:** External: `blessed`. Same-folder: `theme/resolver.js`, `ui-primitives.js`, `theme/types.js`. Other src/: `services/animation-service.js`.

**Responsibilities:** ⚠️ **MANY (SRP violation)**
1. Linear layout (stack/row)
2. Grid layout
3. Responsive breakpoints
4. Chrome primitives (header, status, rule bars)
5. Text display (text block, figlet display)
6. Scroll viewport
7. Button bar
8. Collapsible blocks
9. Content stacking
10. Sidebar panels
11. Selectable list
12. Inline search
13. Restyle bundle
14. Tabbed container
15. Pattern generators (11 patterns)
16. Data simulation helpers
17. Colour/gradient helpers

**Code Smells:**
- **God file**: 2,395 lines with 17+ distinct responsibility groups. The largest file in the folder.
- **Feature creep**: Pattern generators, data simulation helpers, and colour helpers are unrelated to layout primitives.
- **Re-exports**: Lines 1–50 are re-exports from forms/feedback/data sub-files — this barrel pattern is fine but adds to the cognitive load.

**Type Safety:** Multiple `as any` casts (blessed style properties, scrollable types).

**Coupling:** Low — mostly leaf utilities.

**Refactoring:**
1. **Extract pattern generators** → `src/core/patterns.ts` (~100 lines of pattern functions + `PATTERNS` array).
2. **Extract colour helpers** → `src/core/colour-utils.ts` (`hslToRgb`, `ansiGradientLine`).
3. **Extract data simulation helpers** → `src/core/sim-data.ts` (`sinWave`, `randHistory`, `xLabels`).
4. **Extract sidebar/inline-search** → These are substantial UI components (100+ lines each) that warrant their own files.

---

### 32. `ui-primitives.ts` (80 lines)

**Purpose:** Lowest-level helpers — scrollbar creation, style safety, right-click detection, lifecycle timers.

**Exports:** `createScrollbar`, `scrollableStyle`, `safeSetStyle`, `isRightClick`, `createTimer`, `clearTimers`

**Imports:** Same-folder: `theme/resolver.js`.

**Responsibilities:** 1 — Low-level UI helpers.

**Code Smells:** None.

**Type Safety:** 1 `as any` in `safeSetStyle` (necessary for blessed).

**Coupling:** Low.

---

### 33. `unicode-patch.ts` (94 lines)

**Purpose:** Monkey-patch blessed's unicode width detection with `string-width` for correct emoji/CJK handling.

**Exports:** `patchBlessedUnicode`

**Imports:** External: `string-width`.

**Responsibilities:** 1 — Unicode patching.

**Code Smells:**
- **Monkey-patching**: `require("blessed/lib/unicode")` — necessary evil for blessed's limitations.

**Type Safety:** Untyped `require()` call.

**Coupling:** Tight to blessed internals — fragile but necessary.

---

### 34. `window-chrome.ts` (40 lines)

**Purpose:** Chrome sizing math — maps WindowKind to chrome mode and calculates padding.

**Exports:** `ChromeMode`, `ContentSize`, `WindowSize`, `getChromeModeForWindow`, `contentToWindowSize`

**Imports:** Same-folder: `types.js`.

**Responsibilities:** 1 — Chrome sizing.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Zero.

---

### 35. `window-facade.ts` (32 lines)

**Purpose:** Interface contract for all window operations — query, geometry, content.

**Exports:** `WindowFacade` (interface)

**Imports:** Same-folder: `types.js`.

**Responsibilities:** 1 — Interface definition.

**Code Smells:** None.

**Type Safety:** ✅ Good.

**Coupling:** Zero.

---

### 36. `window-manager.ts` (730 lines)

**Purpose:** Manages live window records, z-order stack, focus, drag/resize, and layout. Implements WindowFacade.

**Exports:** `WindowManager`, `EditorWriteHook`, `EditorSaveHook`

**Imports:** External: `blessed`. Same-folder: `ui-parts.js` (clamp), `window-facade.js`, `theme/resolver.js`, `ui-primitives.js`, `render-scheduler.js`, `types.js`.

**Responsibilities:** 4
1. Window lifecycle (create, register, close)
2. Focus management and z-ordering
3. Mouse interaction (drag, resize, click suppression)
4. Layout operations (tile, cascade, maximize)

**Code Smells:**
- **createFrame()** (~100 lines) mixes chrome widget creation with event wiring. Could be split.
- Double-click detection state (`lastTitleClickTime`, `lastTitleClickWindowId`) is hand-rolled — could use a helper.

**Type Safety:** 2 `as any` casts (blessed border property).

**Coupling:** Moderate — depends on theme, types, render scheduler.

**Refactoring:**
1. Extract `createFrame()` chrome creation into a `window-chrome-factory.ts`.
2. Extract drag/resize handlers into a `window-interaction.ts` module.

---

### 37. `workspace-snapshots.ts` (41 lines)

**Purpose:** Workspace snapshot save/restore — thin delegation layer to snapshot-registry.

**Exports:** `serializeWindowSnapshot`, `restoreWindowSnapshot`, `WorkspaceRestoreActions`

**Imports:** Same-folder: `snapshot-registry.js`, `types.js`.

**Responsibilities:** 1 — Snapshot serialization.

**Code Smells:** None — clean delegation.

**Type Safety:** ✅ Good.

**Coupling:** Low.

---

## File Summary Table

| File | Lines | Responsibilities | SRP? | Key Smells | `as any` Count |
|------|------:|:----------------:|:----:|------------|:--------------:|
| ansi-utils.ts | 378 | 1 | ✅ | — | 0 |
| app-controller.ts | 2,244 | 10+ | ❌ | God object, long methods | 3 |
| appearance-service.ts | 24 | 1 | ✅ | Lazy class | 0 |
| canvas-types.ts | 61 | 1 | ✅ | Module dependency inversion | 0 |
| cli.ts | 66 | 1 | ✅ | — | 0 |
| command-catalog.ts | 1,307 | 2 | ⚠️ | 900-line data block | 0 |
| command-registry.ts | 306 | 2 | ⚠️ | Legacy alias map | 0 |
| config.ts | 51 | 1 | ✅ | Deprecated aliases | 0 |
| context-menu-items.ts | 87 | 1 | ✅ | — | 0 |
| custom-cursor.ts | 72 | 1 | ✅ | — | 0 |
| desktop-geometry.ts | 22 | 1 | ✅ | Lazy class | 0 |
| editor-coordinator.ts | 247 | 1 | ✅ | — | 0 |
| empty-states.ts | 11 | 1 | ✅ | — | 0 |
| grid-canvas.ts | 120 | 1 | ✅ | — | 0 |
| menu-overlay-manager.ts | 338 | 2 | ⚠️ | — | 3 |
| modal.ts | 383 | 3 | ⚠️ | — | 1 |
| overlay-manager.ts | 937 | 7 | ❌ | God class | 5+ |
| panel-layout.ts | 335 | 2 | ⚠️ | — | 0 |
| primitives.ts | 36 | 1 | ✅ | — | 0 |
| render-monitor.ts | 126 | 1 | ✅ | — | 0 |
| render-scheduler.ts | 84 | 1 | ✅ | — | 0 |
| runtime-stats.ts | 113 | 1 | ✅ | — | 0 |
| shell-chrome.ts | 239 | 3 | ⚠️ | Mixed concerns | 0 |
| skeleton-renderer.ts | 273 | 2 | ⚠️ | Large data block | 0 |
| snapshot-registry.ts | 427 | 2 | ⚠️ | Growing legacy map | 0 |
| tree-widget.ts | 297 | 1 | ✅ | — | 1 |
| types.ts | 352 | 1 | ✅ | Bag of optionals | 0 |
| ui-parts-data.ts | 438 | 1 | ✅ | — | 2 |
| ui-parts-feedback.ts | 275 | 1 | ✅ | — | 0 |
| ui-parts-forms.ts | 881 | 1 | ✅ | Repetitive pattern | 3 |
| ui-parts.ts | 2,395 | 17 | ❌ | God file | 5+ |
| ui-primitives.ts | 80 | 1 | ✅ | — | 1 |
| unicode-patch.ts | 94 | 1 | ✅ | Monkey-patch | 1 |
| window-chrome.ts | 40 | 1 | ✅ | — | 0 |
| window-facade.ts | 32 | 1 | ✅ | — | 0 |
| window-manager.ts | 730 | 4 | ⚠️ | Mixed create/interact | 2 |
| workspace-snapshots.ts | 41 | 1 | ✅ | — | 0 |

---

## Folder Summary

### Overall Responsibility and Cohesion
`src/core/` serves as the application kernel — it contains the composition root, window management, command system, layout primitives, theme integration, and overlay/modal UI. Cohesion is **moderate**: the core infrastructure files (window-manager, command system, types, render pipeline) belong together, but the UI component library (ui-parts*, modal, tree-widget) and domain-specific renderers (skeleton-renderer, grid-canvas) are less clearly "core".

### Files That Don't Belong
| File | Suggested Location | Reason |
|------|-------------------|--------|
| `skeleton-renderer.ts` | `src/services/` or `src/renderers/` | Domain-specific pose rendering, not core infrastructure |
| `canvas-types.ts` | `src/types/` or kept but fix module dependency | Imports from `modules/` — architectural inversion |
| `grid-canvas.ts` | `src/services/` or `src/util/` | Pure utility, not core infrastructure |
| Pattern generators (in ui-parts.ts) | `src/core/patterns.ts` | Unrelated to layout primitives |
| Colour helpers (in ui-parts.ts) | `src/core/colour-utils.ts` | Unrelated to layout primitives |

### Internal Dependency Patterns

```
types.ts ←─── (everyone)
    │
theme/resolver.js ←─── (most UI files)
    │
ui-primitives.ts ←─── ui-parts*.ts, tree-widget.ts, window-manager.ts
    │
ui-parts.ts ←─── grid-canvas.ts, panel-layout.ts, window-manager.ts
    │
modal.ts ←─── overlay-manager.ts
    │
command-catalog.ts ←─── command-registry.ts ←─── context-menu-items.ts
    │                                              │
    └────────────────────────────────────── app-controller.ts
                                                   │
window-manager.ts ←─── editor-coordinator.ts ──────┘
    │
window-facade.ts ←─── snapshot-registry.ts ←── workspace-snapshots.ts
    │
render-scheduler.ts ←── app-controller.ts, window-manager.ts, editor-coordinator.ts
```

**Key hub files:** `types.ts`, `theme/resolver.js`, `ui-primitives.ts`, `app-controller.ts`

### Cross-Folder Dependencies
- **core → services/**: Heavy dependency from `app-controller.ts` (15+ service imports), `editor-coordinator.ts`, `snapshot-registry.ts`, `primitives.ts`
- **core → windows/**: Heavy dependency from `app-controller.ts` only (10+ window factory imports) — this is correct composition root behavior
- **core → modules/**: `canvas-types.ts` imports from `modules/sy2-chronicles/panel-types.js` — **this is wrong** (core should not depend on modules)

### Top 5 Priority Refactoring Actions

1. **Split `ui-parts.ts` (2,395 lines)** — Extract pattern generators, colour helpers, data simulation helpers, sidebar panel, inline search, and tabbed container into separate files. This is the largest file and has 17 distinct responsibility groups. Impact: dramatically improves discoverability and maintainability. Effort: medium (mechanical extraction, no logic changes).

2. **Slim `app-controller.ts` (2,244 lines)** — Extract `getAppMenuActions()` (~500 lines) into `src/core/action-bridge.ts`, move FX/smear logic to `src/services/fx-service.ts`, move clipboard ops to a service. The composition root should compose, not implement. Impact: makes the controller readable and its role clear. Effort: medium.

3. **Break up `overlay-manager.ts` (937 lines)** — Each overlay type (browser prompt, file browser, centered list) is 100-170 lines of self-contained UI logic. Extract into `src/core/overlays/` directory with one file per prompt type. Impact: reduces the god-class to a thin coordinator. Effort: medium.

4. **Fix `canvas-types.ts` module dependency** — Core should not import from `modules/`. Either move `CEPanelDef` into core/types or create a shared interface that the module implements. Impact: fixes architectural layering violation. Effort: low.

5. **Extract window-manager interaction logic** — Split `createFrame()` chrome creation and drag/resize mouse handling from `window-manager.ts` into focused modules. Impact: makes the 730-line manager more maintainable and testable. Effort: medium.
