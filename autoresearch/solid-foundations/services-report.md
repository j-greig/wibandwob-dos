# Services Directory Analysis Report

**Path:** `src/services/`  
**Files:** 44 `.ts` files  
**Total Lines:** 13,277  
**Date:** 2026-03-14

---

## Per-File Analysis

### 1. `agent-session-helpers.ts` (42 lines)

**PURPOSE:** Utility functions for formatting session timestamps and finding Claude Code JSONL files.

**EXPORTS:** `truncatePreview`, `formatRelativeSessionTime`, `findClaudeCodeJsonl`

**IMPORTS:**
- External: `node:fs`, `node:os`, `node:path`

**RESPONSIBILITIES:** 1 — session-related string/file utilities. Clean.

**CODE SMELLS:** None significant. Small, focused utility file.

**TYPE SAFETY:** Good. All functions have explicit parameter and return types.

**COUPLING:** Low. No internal imports. Could live anywhere.

**REFACTORING:** None needed — appropriately small and focused.

---

### 2. `agent-tools.ts` (533 lines)

**PURPOSE:** Defines AgentTool[] for the Wib&Wob chat agent — TUI awareness and control tools.

**EXPORTS:** `TuiToolContext` (interface), `createTuiTools`, `agentToolToDefinition`, `createTuiToolDefinitions`, `formatDesktopSummary`

**IMPORTS:**
- External: `@sinclair/typebox`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-coding-agent`
- Same folder: `chrome-browser-service.ts`, `brave-search-service.ts`, `youtube-transcript-service.ts`
- Other src/: `core/types.ts`, `core/command-registry.ts`, `core/window-facade.ts`

**RESPONSIBILITIES:** 2 — (1) tool definition, (2) web search/content orchestration via `braveService` singleton. The singleton `braveService` instantiation at module level couples search capability to tool loading.

**CODE SMELLS:**
- **Singleton at module scope** (line ~257): `const braveService = new BraveSearchService()` — instantiated on import regardless of whether search tools are used.
- **Long file** — 20 tool definitions in one file. Each tool is small, but navigating is tedious.
- **`any` casts** in `createTuiTools` return type: `AgentTool<any>[]` (line ~392).

**TYPE SAFETY:** 2 `any` casts: return type of `createTuiTools` and parameter of `agentToolToDefinition`.

**COUPLING:** Medium. Depends on 3 same-folder services and 3 core modules. The `TuiToolContext` interface is the clean seam.

**REFACTORING:**
- Extract `braveService` singleton to a shared module or inject it via `TuiToolContext`.
- Consider splitting web-related tools (search, content, YouTube) into a separate file from TUI manipulation tools.

---

### 3. `animation-service.ts` (234 lines)

**PURPOSE:** Reusable frame playback engine for pre-rendered and live-generated animations.

**EXPORTS:** `LiveFrameGenerator`, `FramePlayer`, `AnimatedSurfaceTarget`, `LazyMountedPlayer`, `createPreRenderedPlayer`, `createLivePlayer`, `createLazyMountedPlayer`, `createEmbeddedLivePlayer` + option/interface types

**IMPORTS:** None (self-contained).

**RESPONSIBILITIES:** 1 — animation playback abstraction. Very clean.

**CODE SMELLS:** None. Well-structured with clear factory functions.

**TYPE SAFETY:** Excellent. All functions typed. `@primitive` JSDoc tags mark SDK-stable exports.

**COUPLING:** Zero — no imports. Pure framework code.

**REFACTORING:** None needed. Exemplary service design.

---

### 4. `app-logger.ts` (61 lines)

**PURPOSE:** Daily rotating log file writer with terse, tagged format.

**EXPORTS:** `log` object with methods: `setIdentity`, `app`, `cmd`, `msg`, `sys`, `api`, `err`

**IMPORTS:**
- External: `node:fs`, `node:path`

**RESPONSIBILITIES:** 1 — structured file logging. Clean.

**CODE SMELLS:** Uses `import.meta.url` for path resolution (line 20), which is fine but couples to ESM.

**TYPE SAFETY:** Good. Tag type is a string union.

**COUPLING:** Zero internal. Used widely across the codebase.

**REFACTORING:** None needed.

---

### 5. `ascii-composition.ts` (48 lines)

**PURPOSE:** Compose ASCII art layers with blend modes on a character grid.

**EXPORTS:** `AsciiCompositionRole`, `AsciiBlendMode`, `AsciiCompositionNodeSpec`, `renderAsciiTextBlock`, `composeAsciiLayers`

**IMPORTS:**
- Other src/: `core/grid-canvas.ts`

**RESPONSIBILITIES:** 1 — ASCII composition primitives.

**CODE SMELLS:** `AsciiCompositionNodeSpec` and `AsciiCompositionRole` are exported but appear unused in this file — they seem like a spec for a future composition graph that was never built (**speculative generality**).

**TYPE SAFETY:** Good.

**COUPLING:** Low — single core dependency.

**REFACTORING:** Remove `AsciiCompositionNodeSpec` and `AsciiCompositionRole` if they have no consumers.

---

### 6. `audio-player-controller.ts` (508 lines)

**PURPOSE:** Shared audio playback service wrapping ffplay with play/pause/scrub/volume controls.

**EXPORTS:** `AudioPlayerController`, `sharedPlayer` (singleton), `PlayerSnapshot`, `PlayState`, `fmtTime`, `findAudioFiles`, `resolveAudioPath`, `COMPOSITIONS_DIR`, `BUNDLED_MUSIC_DIR`, `VOLUME_STEP`, `DEFAULT_VOLUME`

**IMPORTS:**
- External: `node:child_process`, `node:fs`, `node:path`
- Other src/: `core/config.ts`

**RESPONSIBILITIES:** 2 — (1) audio playback management, (2) audio file discovery. The file discovery (`findAudioFiles`, `resolveAudioPath`) is a secondary concern.

**CODE SMELLS:**
- **God object tendency**: `AudioPlayerController` at 350+ lines handles process lifecycle, timing, volume, file merging, and event emission.
- **Singleton export** (`sharedPlayer`) — fine for the use case but prevents testing with isolated instances.
- **`opChain` pattern** (line ~199): custom serial operation queue. Clever but not obviously necessary — could use a mutex or simpler guard.

**TYPE SAFETY:** Good. `empty catch {}` blocks scattered (lines 238, 298, etc.) — no error handling.

**COUPLING:** Low — only depends on `core/config.ts` for paths.

**REFACTORING:**
- Extract `findAudioFiles`/`resolveAudioPath`/`refreshFiles` into a separate `audio-library.ts`.
- Consider making `sharedPlayer` a lazy factory instead of eager singleton.

---

### 7. `backrooms-service.ts` (222 lines)

**PURPOSE:** Manages Backrooms session configuration, primer collection, CLI args, and playback file selection.

**EXPORTS:** `BackroomsService`

**IMPORTS:**
- External: `node:fs`, `node:path`
- Other src/: `core/config.ts`, `core/types.ts`

**RESPONSIBILITIES:** 3 — (1) resolve launch mode/paths, (2) collect and link primers, (3) build CLI args and manage playback selection. **SRP violation** — file system operations, primer curation, and CLI orchestration are distinct concerns.

**CODE SMELLS:**
- **Feature envy**: `prepareRunRoot` does heavy filesystem work (mkdir, symlink, copy) that feels like it belongs in a run-manager, not a service.
- **Long method**: `prepareRunRoot` (lines 65–110) does 6+ distinct things.

**TYPE SAFETY:** Good. No `any` casts.

**COUPLING:** Medium — depends on `core/config.ts` for paths.

**REFACTORING:**
- Extract `prepareRunRoot` into a `BackroomsRunManager`.
- Split primer collection (which overlaps with `ContentService.collectPrimerGroups`) into shared code.

---

### 8. `brave-search-service.ts` (235 lines)

**PURPOSE:** Web search and content extraction via Brave Search API with Readability fallback.

**EXPORTS:** `BraveSearchService`, `BraveSearchResult`, `BraveContentResult`

**IMPORTS:**
- External: `@mozilla/readability`, `jsdom`, `turndown`, `turndown-plugin-gfm`

**RESPONSIBILITIES:** 2 — (1) web search, (2) URL content extraction. These are related but distinct operations.

**CODE SMELLS:**
- **Duplicated HTML-to-markdown logic**: `htmlToMarkdown` method is nearly identical to the one in `chrome-browser-service.ts` (same Turndown config, same cleanup rules). **DRY violation**.

**TYPE SAFETY:** 1 `@ts-ignore` for turndown-plugin-gfm import (no types available). Otherwise good.

**COUPLING:** Low — external deps only.

**REFACTORING:**
- Extract `htmlToMarkdown` into a shared `html-to-markdown.ts` utility used by both this and `chrome-browser-service.ts`.

---

### 9. `canvas-document.ts` (263 lines)

**PURPOSE:** Load, save, and restore `.canvas.yaml` desktop composition documents.

**EXPORTS:** `CanvasDocument`, `CanvasMeta`, `CanvasWindowEntry`, `parseCanvasDocument`, `loadCanvasFile`, `restoreCanvas`, `exportCanvasDocument`, `CanvasLoadResult`

**IMPORTS:**
- External: `node:fs`, `node:path`, `yaml`
- Other src/: `core/snapshot-registry.ts`, `core/window-facade.ts`, `core/types.ts`

**RESPONSIBILITIES:** 3 — (1) parsing/validation, (2) restoring windows from document, (3) exporting current desktop to document. Could argue these are facets of one concern (canvas persistence).

**CODE SMELLS:**
- `restoreWindowEntry` uses a `switch` on `entry.kind` with 10 cases (lines 104–143). Each case maps to a different action method. This is a mini command dispatcher that will grow with every new window type. **Divergent change** risk.

**TYPE SAFETY:** Good. No `any` casts.

**COUPLING:** Medium — depends on `SnapshotRestoreActions` interface which is a wide API surface.

**REFACTORING:**
- Replace `restoreWindowEntry` switch with a registry pattern — each window kind registers its own restore handler.

---

### 10. `capability-service.ts` (162 lines)

**PURPOSE:** Probe and cache runtime capability availability (figlet, Chrome, mediapipe, backrooms, API keys).

**EXPORTS:** `CapabilityService`, `capabilityService` (singleton), `CapabilityKey`, `CapabilityStatus`, `CapabilitySnapshot`

**IMPORTS:**
- External: `node:fs`, `node:path`, `node:child_process`
- Same folder: `backrooms-service.ts`, `chrome-browser-service.ts`

**RESPONSIBILITIES:** 2 — (1) capability probing, (2) profile policy loading. Acceptable cohesion.

**CODE SMELLS:**
- Imports `BackroomsService` just to call `resolveBackroomsPath()` — could receive the path as a parameter instead (**inappropriate intimacy**).

**TYPE SAFETY:** Good.

**COUPLING:** Medium — knows about backrooms and chrome services for probing.

**REFACTORING:**
- Accept capability probes as a config/registry instead of hardcoding service imports.

---

### 11. `chrome-browser-service.ts` (1,029 lines)

**PURPOSE:** Auto-launches headless Chrome via puppeteer, navigates URLs, extracts readable markdown content with image support.

**EXPORTS:** `ChromeBrowserService`, `BrowseResult`, `SearchResult`, `findChromeExecutablePath`

**IMPORTS:**
- External: `puppeteer-core`, `@mozilla/readability`, `jsdom`, `turndown`, `turndown-plugin-gfm`, `node:fs`, `node:path`, `node:child_process`
- Same folder: `capability-service.ts`

**RESPONSIBILITIES:** 5+ — (1) Chrome lifecycle management, (2) URL navigation + content extraction, (3) image discovery + ASCII rendering, (4) Google search, (5) history navigation. **Major SRP violation — god class.**

**CODE SMELLS:**
- **God class**: `ChromeBrowserService` at ~900 lines handles connection, navigation, content extraction, image processing, search, and history.
- **Long method**: `navigate()` is ~200 lines with deeply nested try/catch, multiple page evaluations, fallback chains, and image discovery.
- **Duplicated `htmlToMarkdown`**: Same implementation as in `brave-search-service.ts`.
- **`@ts-ignore`** on turndown-plugin-gfm import.
- **4 page evaluations** in a single `navigate()` call — performance concern and code complexity.

**TYPE SAFETY:** 1 `@ts-ignore`. Otherwise decent.

**COUPLING:** Low external coupling but internally monolithic.

**REFACTORING:**
1. Extract `htmlToMarkdown` to shared utility.
2. Extract image discovery/rendering to `image-service.ts`.
3. Extract Google search to `google-search-service.ts`.
4. Split `navigate()` into phases: fetch → clean → extract → enhance images.
5. Consider a pipeline/middleware pattern for the extraction chain.

---

### 12. `content-measurement.ts` (134 lines)

**PURPOSE:** Measure raw text content: line count, column width, frame detection for animated primers.

**EXPORTS:** `ContentMeasurement`, `MeasuredContent`, `measureContent`, `measurePrimerContent`, `measurePlainTextContent`

**IMPORTS:**
- Other src/: `core/ansi-utils.ts`

**RESPONSIBILITIES:** 1 — content measurement. Clean.

**CODE SMELLS:** None.

**TYPE SAFETY:** Excellent.

**COUPLING:** Minimal — single core dependency.

**REFACTORING:** None needed.

---

### 13. `content-service.ts` (228 lines)

**PURPOSE:** Discovers and collects primer/gallery entries from module directories, builds gallery tabs, and provides path completion.

**EXPORTS:** `ContentService`

**IMPORTS:**
- External: `node:fs`, `node:os`, `node:path`
- Same folder: `content-measurement.ts`
- Other src/: `core/config.ts`, `core/types.ts`

**RESPONSIBILITIES:** 3 — (1) primer discovery, (2) gallery tab building, (3) path completion. The path completion (line 115–135) feels out of place.

**CODE SMELLS:**
- **Path completion** (`completePath`) doesn't belong in a content discovery service. It's a generic filesystem utility.
- **Unused method**: `readPrimerMetadata` (line 176) is private and only called nowhere visible — dead code candidate.

**TYPE SAFETY:** Good.

**COUPLING:** Low.

**REFACTORING:**
- Move `completePath` to a shared filesystem utility.
- Remove `readPrimerMetadata` if confirmed dead.

---

### 14. `contour-engine.ts` (790 lines)

**PURPOSE:** Procedural terrain generation (hills, heightmaps) and contour rendering engine with marching-squares and animated ContourPlayer.

**EXPORTS:** `Hill`, `ContourMode`, `terrainNames`, `makeHill`, `heightmap`, `march`, `composite`, `generateOrdered`, `generateHybrid`, `renderFromHills`, `renderContourFromHills`, `renderContour`, `readNodeViewport`, `createContourPlayer`, `ContourPlayer`, `ContourPlayerOptions`

**IMPORTS:**
- Same folder: `animation-service.ts` (for `FramePlayer` type)

**RESPONSIBILITIES:** 4 — (1) hill generation with shapes, (2) heightmap computation, (3) marching-squares contouring + grid rendering, (4) animated ContourPlayer. **SRP violation** — this is an entire rendering engine crammed into one file.

**CODE SMELLS:**
- **God file**: 790 lines covering terrain gen, rendering, and animation.
- **Private PRNG class** `SeededRandom` (lines 37–82) is substantial and reusable — should be extracted.
- **7 terrain factory functions** (lines 217–365) each ~20 lines — repetitive structure.

**TYPE SAFETY:** Good. All functions typed.

**COUPLING:** Low — only imports `FramePlayer` type.

**REFACTORING:**
1. Extract `SeededRandom` to `core/prng.ts` or similar.
2. Split into `contour-math.ts` (heightmap, march, composite), `terrain-factories.ts`, and `contour-player.ts`.
3. The `readNodeViewport` utility has nothing to do with contours — move to `core/`.

---

### 15. `control-api.ts` (795 lines)

**PURPOSE:** HTTP control API surface for the WibWob-DOS TUI (Bun.serve-based REST API).

**EXPORTS:** `ControlApiService`

**IMPORTS:**
- External: `node:fs`, `node:path`
- Same folder: `app-logger.ts`, `strip-ansi.ts`, `world-chat-service.ts`
- Other src/: `core/types.ts`, `core/runtime-stats.ts`, `core/command-registry.ts`, `core/command-catalog.ts`

**RESPONSIBILITIES:** 4 — (1) HTTP server lifecycle, (2) endpoint routing, (3) request handling, (4) OpenAPI spec generation. The routing is hand-rolled with a massive `handleRequest` method.

**CODE SMELLS:**
- **Long method**: `handleRequest` is ~350 lines of if/else routing. Classic candidate for a router framework.
- **`as any` casts**: 15+ instances in request body parsing (e.g., `(body as any).id`).
- **Endpoint duplication**: `ENDPOINT_CATALOGUE` (lines 50–130) defines metadata, then `handleRequest` reimplements each route. The view route shims (lines 490–530) partially bridge this but it's still two sources of truth.
- **Comment at top** explicitly notes this should migrate to Hono.

**TYPE SAFETY:** Poor in the handler — extensive `as any` casting of request bodies. The `ControlApiHandlers` interface is well-typed.

**COUPLING:** High — imports from core/types, core/command-registry, core/command-catalog, plus multiple services.

**REFACTORING:**
1. Migrate to Hono (as noted in the TODO comment) — would eliminate hand-rolled routing and `as any` body parsing.
2. Use Zod/TypeBox schemas for request body validation (already done for some commands via `cmdDef.params`).
3. Extract `normalizeBackroomsChannel` and `scalarDocsHtml` to separate files.

---

### 16. `editor-service.ts` (42 lines)

**PURPOSE:** Pure text editing operations (insert, delete, cursor movement, render) on an EditorState.

**EXPORTS:** `insertText`, `deleteBackward`, `deleteForward`, `moveCursor`, `render`

**IMPORTS:**
- Other src/: `core/types.ts`

**RESPONSIBILITIES:** 1 — text editor primitives. Clean.

**CODE SMELLS:** None. Very focused.

**TYPE SAFETY:** Good. Depends on `EditorState` type from core.

**COUPLING:** Low.

**REFACTORING:** None needed.

---

### 17. `figlet-service.ts` (241 lines)

**PURPOSE:** FIGlet ASCII art rendering via CLI, font catalogue management, responsive font cascade.

**EXPORTS:** `FigletCatalogue`, `FigletFontMeta`, `FigletFontCategory`, `getFigletCatalogue`, `getFigletFontChoices`, `getDefaultFigletFont`, `getFigletFontHeight`, `isFigletAvailable`, `renderFiglet`, `renderFigletLines`, `measureFiglet`, `tryFiglet`, `responsiveFiglet`, `DEFAULT_FONT_CASCADE`, `FontCascadeTier`

**IMPORTS:**
- External: `node:fs`, `node:path`, `node:child_process`
- Same folder: `content-measurement.ts`
- Other src/: `core/config.ts`

**RESPONSIBILITIES:** 3 — (1) font catalogue loading/caching, (2) figlet rendering, (3) responsive font cascade. Related but distinct.

**CODE SMELLS:**
- **Three caches** (`catalogueCache`, `figletAvailableCache`, `figletFontDirCache`) at module scope — hard to reset for testing.
- `tryFigletCache` (line 170) is an unbounded `Map` — potential memory leak with many unique text/font/width combinations.

**TYPE SAFETY:** Good.

**COUPLING:** Low.

**REFACTORING:**
- Add cache size limits or LRU eviction to `tryFigletCache`.
- Consider wrapping caches in a class or using a shared cache utility.

---

### 18. `file-actions.ts` (118 lines)

**PURPOSE:** File dialog actions — prompt for primer/editor files, open primers, save editor windows.

**EXPORTS:** `promptForPrimerFile`, `promptForEditorFile`, `openPrimerFile`, `saveEditorWindow`

**IMPORTS:**
- External: `node:fs`, `node:os`, `node:path`
- Same folder: `content-measurement.ts`, `content-service.ts`
- Other src/: `core/overlay-manager.ts`, `core/types.ts`

**RESPONSIBILITIES:** 2 — (1) file open prompts, (2) file save. Both are UI action orchestrators.

**CODE SMELLS:** None significant. Functions are well-bounded.

**TYPE SAFETY:** Good.

**COUPLING:** Medium — depends on `OverlayManager` and `ContentService`.

**REFACTORING:** None needed.

---

### 19. `markdown-service.ts` (442 lines)

**PURPOSE:** Markdown → ANSI terminal rendering using marked.js lexer, with figlet headings, tables, and syntax highlighting.

**EXPORTS:** `renderMarkdown`, `renderMarkdownFile`, `isMarkdownFile`, `getFileMtime`, `FigletHeadingConfig`, `FigletHeadingLevel`, `DEFAULT_FIGLET_HEADING_CONFIG`, `PLAIN_HEADING_CONFIG`, `RenderMarkdownOptions`

**IMPORTS:**
- External: `marked`, `node:fs`
- Same folder: `syntax-highlight.ts`, `figlet-service.ts`
- Other src/: `core/ansi-utils.ts`

**RESPONSIBILITIES:** 2 — (1) markdown rendering pipeline, (2) figlet heading configuration/rendering. The figlet heading config types are substantial enough to be their own file.

**CODE SMELLS:**
- **`as any` casts**: 10+ in the token rendering code due to marked.js's loosely typed Token union.
- `getFileMtime` (line 377) is a generic utility that doesn't belong in markdown service.

**TYPE SAFETY:** Moderate — many `as any` casts on marked tokens. The public API is well-typed.

**COUPLING:** Medium — depends on figlet and syntax-highlight services.

**REFACTORING:**
- Move `getFileMtime` to a filesystem utility.
- Extract `FigletHeadingConfig` types and `renderFigletHeading` to `figlet-heading-renderer.ts`.

---

### 20. `microapp-sdk.ts` (403 lines)

**PURPOSE:** The ONE canonical import surface for microapp authors — re-exports types and helpers from across the codebase.

**EXPORTS:** ~100+ re-exports from `core/ui-parts.ts`, `core/ui-primitives.ts`, `core/ui-parts-forms.ts`, `core/ui-parts-feedback.ts`, `core/ui-parts-data.ts`, `core/grid-canvas.ts`, `core/panel-layout.ts`, `core/skeleton-renderer.ts`, `core/tree-widget.ts`, `core/render-monitor.ts`, `core/canvas-types.ts`, `core/empty-states.ts`, `core/theme/types.ts`, and various services.

**IMPORTS:** ~20 source files across `core/` and `services/`.

**RESPONSIBILITIES:** 1 — SDK facade/barrel. This is its intended purpose.

**CODE SMELLS:**
- **Massive barrel file** — 400 lines of re-exports. Hard to know what's available without reading the whole file.
- Some original types defined here (`AnimationClock`, `LayoutReporter`, `LayoutReport`, `LayoutRegionSnapshot`, `LayoutRegionRect`) rather than in their own module.

**TYPE SAFETY:** Good — mostly type re-exports.

**COUPLING:** Very high by design — this is the central SDK surface. Changes to any re-exported module require updating this file.

**REFACTORING:**
- Extract `AnimationClock` and `LayoutReporter` implementations to their own files — this file should only re-export.
- Consider organizing re-exports by category with clear section comments (partially done already).

---

### 21. `microapp-loader.ts` (574 lines)

**PURPOSE:** Discovers and loads modules (themes + microapps) from `microapps/` and `microapps-private/`.

**EXPORTS:** `MicroappHost`, `MicroappWindowHandle`, `MicroappSnapshotWindow`, `MicroappHostDeps`, `WorldChatHostAccess`, `loadThemes`, `loadMicroapps`, `loadMicroapps`

**IMPORTS:**
- External: `blessed`, `node:fs`, `node:path`
- Same folder: `world-chat-service.ts`, `world-chat-transport.ts`
- Other src/: `core/config.ts`, `core/theme/resolver.ts`, `core/snapshot-registry.ts`, `core/theme/types.ts`, `core/types.ts`, `core/window-manager.ts`, `core/window-facade.ts`, `core/command-registry.ts`, `core/command-catalog.ts`, `core/ui-parts.ts`, `core/overlay-manager.ts`

**RESPONSIBILITIES:** 4 — (1) module discovery, (2) manifest parsing, (3) MicroappHost implementation, (4) theme/microapp loading. **SRP violation** — the `createMicroappHost` function alone is 150 lines.

**CODE SMELLS:**
- **Long function**: `createMicroappHost` (lines 200–380) creates a large host object with many methods.
- **Wide import surface**: 12 imports from `core/` — this file is the main integration point.
- **Delayed registration pattern** via `queueMicrotask` (line 282) is clever but fragile — relies on microtask ordering.

**TYPE SAFETY:** Good. The `MicroappHost` interface is well-defined.

**COUPLING:** Very high — this is the composition layer between modules and the shell. By design.

**REFACTORING:**
1. Extract `MicroappHost` interface and types to `microapp-types.ts` (they're consumed by many modules).
2. Extract `createMicroappHost` to `microapp-host-factory.ts`.
3. Extract module discovery to `module-discovery.ts`.

---

### 22. `monster-cam-service.ts` (172 lines)

**PURPOSE:** Spawns face detection worker, reads socket frames, emits MonsterCamFrame events.

**EXPORTS:** `MonsterCamService`, `MonsterCamFrame`

**IMPORTS:**
- External: `net`, `path`, `fs`, `url`, `events`, `child_process`

**RESPONSIBILITIES:** 2 — (1) worker lifecycle management, (2) binary frame parsing from Unix socket.

**CODE SMELLS:**
- **Binary protocol parsing** (`_parseFrames`, lines 119–155) is complex but necessary.
- Private methods use `_` prefix convention inconsistently with the rest of the codebase.

**TYPE SAFETY:** Good. `MonsterCamFrame` is well-typed.

**COUPLING:** Low — communicates via Unix socket protocol.

**REFACTORING:** Minor — standardize method naming convention (drop `_` prefix).

---

### 23. `monster-cam-worker.ts` (48 lines)

**PURPOSE:** Thin TS launcher that spawns the Python mediapipe detection worker.

**EXPORTS:** None (entry point script).

**IMPORTS:**
- External: `child_process`, `path`, `url`, `fs`
- Same folder: `capability-service.ts`

**RESPONSIBILITIES:** 1 — spawn Python subprocess.

**CODE SMELLS:** None. Appropriately thin.

**TYPE SAFETY:** Good.

**COUPLING:** Low.

**REFACTORING:** None needed.

---

### 24. `motion-service.ts` (192 lines)

**PURPOSE:** Easing functions and tween animation helpers for windows and numeric values.

**EXPORTS:** `EasingFn`, `EASINGS`, `TweenOpts`, `tween`, `tweenWindowPosition`, `tweenWindowSize`

**IMPORTS:** None.

**RESPONSIBILITIES:** 1 — animation/tweening primitives.

**CODE SMELLS:**
- `readWindowFrame` (lines 107–125) uses `unknown` type with manual property checking — could use a proper type guard or import the actual type.

**TYPE SAFETY:** The `readWindowFrame` function casts `windowManager` to an anonymous type (lines 107–112). Otherwise good.

**COUPLING:** Low — no imports. The window manager interaction is via duck typing.

**REFACTORING:**
- Import `WindowFacade` type instead of duck-typing `windowManager` in `readWindowFrame`.

---

### 25. `pi-session-bridge.ts` (453 lines)

**PURPOSE:** Enables in-app agent to communicate with running pi sessions via Unix socket protocol, plus session server for peer discovery.

**EXPORTS:** `LiveSession`, `LocalSessionInfo`, `SendMode`, `SendResult`, `SessionServerHandle`, `SessionServerTarget`, `listLocalSessions`, `loadSessionMessages`, `listSessions`, `sendToSession`, `sendAndWait`, `getLastMessage`, `startSessionServer`

**IMPORTS:**
- External: `node:net`, `node:fs`, `node:path`, `node:os`, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-agent-core`

**RESPONSIBILITIES:** 4 — (1) socket-based RPC client, (2) session discovery, (3) session server implementation, (4) local session file listing. **SRP concern** — client and server in one file.

**CODE SMELLS:**
- **Long function**: `startSessionServer` (lines 230–400) is 170 lines with nested socket handling.
- **Mixed concerns**: RPC client functions, session discovery, and full server implementation.

**TYPE SAFETY:** Good. Well-typed interfaces.

**COUPLING:** Medium — depends on pi-agent-core for message types.

**REFACTORING:**
1. Split into `pi-session-client.ts` (RPC, discovery) and `pi-session-server.ts`.
2. Extract the socket protocol handler from `startSessionServer`.

---

### 26. `plasma-engine.ts` (506 lines)

**PURPOSE:** Animated plasma colour-field generator for TUI screensavers with multiple moods and render modes.

**EXPORTS:** `PlasmaMood`, `PLASMA_MOODS`, `moodNames`, `getMood`, `PlasmaRenderMode`, `RENDER_MODES`, `renderPlasmaFrame`, `PlasmaModifiers`, `MoodAnalysis`, `extractMoodFromText`, `PlasmaPlayer`, `PlasmaPlayerOptions`, `PlasmaStatus`, `createPlasmaPlayer`

**IMPORTS:**
- Same folder: `animation-service.ts`

**RESPONSIBILITIES:** 3 — (1) plasma math/rendering, (2) mood analysis from text, (3) PlasmaPlayer lifecycle. Related but distinct.

**CODE SMELLS:**
- **Large data constants**: Mood definitions (lines 25–130) are ~100 lines of inline data.
- `extractMoodFromText` (lines 310–375) is a heuristic classifier — interesting but feels like it belongs in a separate analysis module.

**TYPE SAFETY:** Good.

**COUPLING:** Low — only depends on `FramePlayer` type.

**REFACTORING:**
- Extract mood data to a JSON or separate constants file.
- Extract `extractMoodFromText` to a mood-analysis utility.

---

### 27. `rate-limiter.ts` (19 lines)

**PURPOSE:** Creates a rate-limited wrapper that enforces minimum gaps between async calls.

**EXPORTS:** `createRateLimiter`

**IMPORTS:** None.

**RESPONSIBILITIES:** 1. Perfect single-purpose utility.

**CODE SMELLS:** None.

**TYPE SAFETY:** Good — fully generic.

**COUPLING:** Zero.

**REFACTORING:** None needed.

---

### 28. `scene-layout.ts` (131 lines)

**PURPOSE:** Resolves layout tokens (e.g., "hero-left", "lyric-bar") to absolute cell coordinates for timeline scenes.

**EXPORTS:** `DesktopBounds`, `ResolvedRect`, `resolveLayout`, `listLayoutTokens`

**IMPORTS:**
- Same folder: `timeline-types.ts`

**RESPONSIBILITIES:** 1 — layout token resolution.

**CODE SMELLS:** None. Clean lookup table pattern.

**TYPE SAFETY:** Good.

**COUPLING:** Low.

**REFACTORING:** None needed.

---

### 29. `scene-planner.ts` (160 lines)

**PURPOSE:** Diffs desired scene state against live desktop state to produce ordered transition operations.

**EXPORTS:** `OpClose`, `OpOpen`, `OpMove`, `OpTheme`, `OpCommand`, `SceneOp`, `PlanOptions`, `planSceneTransition`

**IMPORTS:**
- Same folder: `timeline-types.ts`, `scene-layout.ts`
- Other src/: `core/types.ts`

**RESPONSIBILITIES:** 1 — scene transition planning. Clean.

**CODE SMELLS:** `matchWindowToRole` uses a switch on `open.type` (lines 62–76) — grows with every new window type.

**TYPE SAFETY:** Good.

**COUPLING:** Low.

**REFACTORING:** None significant.

---

### 30. `scramble-brain.ts` (368 lines)

**PURPOSE:** Scramble AI cat agent — manages LLM session, slash commands, voice filtering, and session socket.

**EXPORTS:** `ScrambleBrain`, `ScrambleStatus`, `ScrambleMessage`

**IMPORTS:**
- External: `node:fs`, `node:path`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-coding-agent`
- Same folder: `pi-session-bridge.ts`, `rate-limiter.ts`, `slash-router.ts`

**RESPONSIBILITIES:** 4 — (1) LLM agent lifecycle, (2) message handling with rate limiting, (3) slash command routing, (4) voice filtering/personality. **SRP concern** — personality and LLM management are entangled.

**CODE SMELLS:**
- **Long method**: `send()` (lines 110–180) handles slash commands, sleeping, rate limiting, prompt building, and error handling.
- **Hardcoded system prompt** at module level (lines 20–26).
- `idleQuips` array (lines 75–90) is personality data embedded in logic.

**TYPE SAFETY:** Good.

**COUPLING:** Medium — depends on pi-agent-core for LLM, pi-session-bridge for networking.

**REFACTORING:**
- Extract personality data (system prompt, idle quips, voice filter) to a config/data file.
- Split `send()` into smaller methods: `handleSlashCommand`, `handleSleeping`, `promptLLM`.

---

### 31. `slash-router.ts` (40 lines)

**PURPOSE:** Simple slash-command router for text chat interfaces.

**EXPORTS:** `SlashHandler`, `SlashRouter`, `createSlashRouter`

**IMPORTS:** None.

**RESPONSIBILITIES:** 1. Perfect utility.

**CODE SMELLS:** None.

**TYPE SAFETY:** Good.

**COUPLING:** Zero.

**REFACTORING:** None needed.

---

### 32. `state-service.ts` (161 lines)

**PURPOSE:** Canonical live desktop state snapshot builder with caching and persistence.

**EXPORTS:** `StateService`

**IMPORTS:**
- External: `node:fs`, `node:path`
- Same folder: `capability-service.ts`
- Other src/: `core/types.ts`, `core/theme/resolver.ts`

**RESPONSIBILITIES:** 2 — (1) state snapshot building, (2) persistence to disk. Acceptable cohesion.

**CODE SMELLS:**
- `describeWindow` logs a warning when `describeState` is missing (line 120) — good defensive coding.

**TYPE SAFETY:** Good.

**COUPLING:** Medium — depends on theme resolver and capability service for state enrichment.

**REFACTORING:** None significant.

---

### 33. `strip-ansi.ts` (95 lines)

**PURPOSE:** Strip ANSI escape sequences and blessed chrome characters from text.

**EXPORTS:** `stripAnsi`, `stripBlessedChrome`

**IMPORTS:** None.

**RESPONSIBILITIES:** 1 — text sanitization.

**CODE SMELLS:** The extensive `BOX_MAP` constant (lines 26–70) is necessary but bulky.

**TYPE SAFETY:** Good.

**COUPLING:** Zero.

**REFACTORING:** None needed.

---

### 34. `syntax-highlight.ts` (177 lines)

**PURPOSE:** Regex-based terminal syntax highlighter for Python, TypeScript/JavaScript, and Bash.

**EXPORTS:** `highlightCode`, `HIGHLIGHTED_LANGUAGES`

**IMPORTS:** None.

**RESPONSIBILITIES:** 1 — syntax highlighting.

**CODE SMELLS:**
- **Destructuring overload**: `applyPython` destructures 14 capture groups (line 108). Hard to read but functional.

**TYPE SAFETY:** Good.

**COUPLING:** Zero.

**REFACTORING:** None significant — regex-based highlighters are inherently complex.

---

### 35. `terrain-model.ts` (394 lines)

**PURPOSE:** Procedural terrain model with biome classification, object placement, and elevation-based terrain generation.

**EXPORTS:** `TerrainBiome`, `TerrainObject`, `TerrainCell`, `TerrainMap`, `TerrainPoint`, `SavedTerrainArtifact`, `createTerrainMap`, `getTerrainFocusPoint`, `createSavedTerrainArtifact`, `isSavedTerrainArtifact`

**IMPORTS:**
- Same folder: `contour-engine.ts`

**RESPONSIBILITIES:** 3 — (1) terrain model generation, (2) biome/object classification, (3) artifact serialization.

**CODE SMELLS:**
- **Long function**: `createTerrainMap` (lines 100–200) does heightmap, biome classification, object placement all inline.
- Many private helper functions (`cellNoise`, `coarseNoise`, `slopeAt`, `moistureAt`, `classifyBiome`, `placeObject`) — well-decomposed internally.

**TYPE SAFETY:** Good.

**COUPLING:** Depends on contour-engine for hills/heightmap.

**REFACTORING:**
- Consider splitting `SavedTerrainArtifact` types to `terrain-types.ts` — they're serialization concerns, not model concerns.

---

### 36. `terrain-render.ts` (657 lines)

**PURPOSE:** Renders terrain maps as ASCII with multiple modes: terrain glyphs, contour lines, hybrid, and first-person 3D voxel view.

**EXPORTS:** `TerrainRenderMode`, `TerrainRenderOptions`, `BIOME_GLYPHS`, `BIOME_COLORS`, `findTerrainPeak`, `renderTerrainMap`

**IMPORTS:**
- Same folder: `contour-engine.ts`, `terrain-model.ts`

**RESPONSIBILITIES:** 2 — (1) 2D map rendering, (2) first-person 3D rendering. The first-person renderer (lines 130–530) is a completely separate rendering engine.

**CODE SMELLS:**
- **God function**: `renderFirstPerson` is ~400 lines with raycasting, sky rendering (5 layers), foreground fill, object sprites, and atmospheric effects.
- **Large inline data**: Sprite definitions (`FP_OBJ_SPRITE_NEAR/MID/FAR`), biome colour tables, and surface glyph tables total ~80 lines of constants.

**TYPE SAFETY:** Good.

**COUPLING:** Medium — depends on contour-engine and terrain-model.

**REFACTORING:**
1. Extract `renderFirstPerson` to `terrain-render-firstperson.ts`.
2. Extract sky rendering to `sky-renderer.ts`.
3. Move constant tables (sprites, colours) to data files.

---

### 37. `timeline-service.ts` (390 lines)

**PURPOSE:** Parse, validate, resolve, and execute VJ timeline files synced to audio.

**EXPORTS:** `ParseResult`, `PlaybackCallbacks`, `PlaybackHandle`, `parseTimeline`, `runTimeline`

**IMPORTS:**
- External: `node:fs`, `node:path`, `node:child_process`
- Same folder: `timeline-types.ts`, `scene-planner.ts`, `scene-layout.ts`

**RESPONSIBILITIES:** 3 — (1) timeline parsing/validation, (2) timing resolution, (3) playback execution. Related pipeline stages.

**CODE SMELLS:**
- **`require("js-yaml")`** (line 62) — dynamic require for YAML support. Should use `await import()` or declare as a dependency.
- `executePatch` (line 330) has a placeholder comment "In full implementation, maintain a role→windowId map" — incomplete implementation.

**TYPE SAFETY:** Good.

**COUPLING:** Medium — depends on scene-planner and scene-layout.

**REFACTORING:**
- Replace `require("js-yaml")` with proper async import.
- Complete the `executePatch` role→window mapping.

---

### 38. `timeline-types.ts` (229 lines)

**PURPOSE:** Type definitions for the VJ timeline system — scenes, cues, beat maps, layout tokens.

**EXPORTS:** All types — `BeatMap`, `BeatMapEntry`, `SectionEntry`, `LayoutToken`, `ExplicitLayout`, `ProportionalLayout`, `SceneLayout`, `SceneWindow`, `SceneDefinition`, `CueTiming`, `Cue`, `CuePatch`, `TimelineFile`, `PrimerPaletteEntry`, `TimelineOptions`, `ResolvedCue`, `ResolvedTimeline`

**IMPORTS:** None.

**RESPONSIBILITIES:** 1 — type definitions. Pure types file.

**CODE SMELLS:** None. Well-documented with JSDoc.

**TYPE SAFETY:** Excellent.

**COUPLING:** Zero.

**REFACTORING:** None needed.

---

### 39. `webcam-renderer.ts` (233 lines)

**PURPOSE:** Pure ASCII render functions for webcam frames with face/hand/pose overlays.

**EXPORTS:** `WebcamCell`, `WebcamRenderOptions`, `renderWebcamFrame`, `gridToBlessedContent`

**IMPORTS:**
- Same folder: `monster-cam-service.ts`
- Other src/: `core/skeleton-renderer.ts`

**RESPONSIBILITIES:** 1 — webcam frame rendering.

**CODE SMELLS:** None significant. Well-structured.

**TYPE SAFETY:** Good. `@primitive` JSDoc tags.

**COUPLING:** Low.

**REFACTORING:** None needed.

---

### 40. `wibwob-agent-session.ts` (1,063 lines)

**PURPOSE:** Native Wib&Wob agent/chat session — model selection, prompt loading, jailed coding tools, TUI tools, session bridge, and event handling.

**EXPORTS:** `WibWobAgentSession`

**IMPORTS:**
- External: `@mariozechner/pi-agent-core`, `@mariozechner/pi-coding-agent`, `@sinclair/typebox`, `node:fs`, `node:path`, `node:child_process`
- Same folder: `agent-tools.ts`, `pi-session-bridge.ts`, `app-logger.ts`, `audio-player-controller.ts`
- Other src/: `core/config.ts`, `core/types.ts`

**RESPONSIBILITIES:** 7+ — (1) agent lifecycle, (2) model selection, (3) prompt loading, (4) tool registration (jailed + TUI + session + music), (5) session event handling, (6) transcript management, (7) session server integration. **Major SRP violation — god class.**

**CODE SMELLS:**
- **God class**: 1,063 lines. The largest file in the folder.
- **Long method**: `initialize()` (lines 350–500) is 150 lines of setup.
- **6 tool factory functions** (`createJailedCodingTools`, `createPiSessionTools`, `createMusicTools`) defined at module level — should be separate files.
- **`any` casts**: 15+ occurrences across tool definitions and event handling.
- **Mixed concerns**: `formatToolCall` (lines 120–155) and `formatToolResult` (lines 157–168) are display utilities embedded in session logic.
- **`jailPath` function** (lines 48–55) is a security-critical utility buried in this file.

**TYPE SAFETY:** Poor — extensive `any` casts in tool handlers and event processing.

**COUPLING:** Very high — imports from 8+ modules, integrates tools from 4 different sources.

**REFACTORING:**
1. Extract `createJailedCodingTools` + `jailPath` to `jailed-tools.ts`.
2. Extract `createPiSessionTools` to `session-tools.ts`.
3. Extract `createMusicTools` to `music-tools.ts`.
4. Extract `formatToolCall`/`formatToolResult` to `tool-formatting.ts`.
5. Extract prompt loading to `prompt-loader.ts`.
6. Extract `handleSessionEvent` to a separate event handler class.

---

### 41. `workspace-service.ts` (62 lines)

**PURPOSE:** Save and load workspace layouts as JSON files.

**EXPORTS:** `WorkspaceService`, `WorkspaceFile`

**IMPORTS:**
- External: `node:fs`, `node:path`
- Other src/: `core/types.ts`

**RESPONSIBILITIES:** 1 — workspace persistence. Clean.

**CODE SMELLS:** None.

**TYPE SAFETY:** Good.

**COUPLING:** Low.

**REFACTORING:** None needed.

---

### 42. `workspace-ui.ts` (42 lines)

**PURPOSE:** UI prompts for workspace save/load using overlay manager.

**EXPORTS:** `promptForWorkspaceSave`, `promptForWorkspaceLoad`

**IMPORTS:**
- External: `node:fs`, `node:path`
- Same folder: `workspace-service.ts`
- Other src/: `core/overlay-manager.ts`

**RESPONSIBILITIES:** 1 — workspace UI orchestration.

**CODE SMELLS:** None.

**TYPE SAFETY:** Good.

**COUPLING:** Low.

**REFACTORING:** None needed.

---

### 43. `world-chat-service.ts` (336 lines)

**PURPOSE:** In-memory world chat system with chatspots, channels, message logging, and transport integration.

**EXPORTS:** `Chatspot`, `WorldMessage`, `WorldChannel`, `WorldChatSnapshot`, `WorldChatChangeEvent`, `worldChatService` (singleton), `formatWorldChannelText`

**IMPORTS:**
- External: `node:fs`, `node:path`
- Same folder: `world-chat-transport.ts`
- Other src/: `core/config.ts`

**RESPONSIBILITIES:** 3 — (1) chat state management, (2) transport bridge, (3) log file writing.

**CODE SMELLS:**
- **Module-level singleton** with constructor side effects (transport creation).
- **Duplicated message append logic** between `applyOutgoingMessage` and `applyIncomingMessage` — nearly identical.

**TYPE SAFETY:** Good.

**COUPLING:** Medium — tightly coupled to transport layer.

**REFACTORING:**
- Deduplicate `applyOutgoingMessage`/`applyIncomingMessage` into a shared `appendMessage` method.

---

### 44. `world-chat-transport.ts` (170 lines)

**PURPOSE:** IRC transport layer for world chat with local fallback.

**EXPORTS:** `WorldChatTransport`, `WorldChatTransportStatus`, `WorldChatTransportEvent`, `createWorldChatTransport`

**IMPORTS:**
- External: `irc-framework`

**RESPONSIBILITIES:** 2 — (1) local no-op transport, (2) IRC transport implementation. Strategy pattern.

**CODE SMELLS:**
- `(client as any)` cast for nick-in-use handler (line 78) — irc-framework types incomplete.

**TYPE SAFETY:** 1 `as any` cast. Otherwise good.

**COUPLING:** Low — isolated behind interface.

**REFACTORING:** None significant.

---

### 45. `youtube-transcript-service.ts` (75 lines)

**PURPOSE:** Fetches YouTube video transcripts without API keys.

**EXPORTS:** `TranscriptEntry`, `TranscriptResult`, `fetchYoutubeTranscript`

**IMPORTS:**
- External: `youtube-transcript-plus`

**RESPONSIBILITIES:** 1 — transcript fetching.

**CODE SMELLS:** `@ts-ignore` for missing types on youtube-transcript-plus.

**TYPE SAFETY:** 1 `@ts-ignore`.

**COUPLING:** Zero internal.

**REFACTORING:** None needed.

---

## Folder Summary

### Overall Responsibility and Cohesion

The `src/services/` folder is a **catch-all service layer** containing 44 files spanning:
- **Agent/AI**: `wibwob-agent-session`, `scramble-brain`, `agent-tools`, `agent-session-helpers`
- **Rendering engines**: `contour-engine`, `plasma-engine`, `terrain-model`, `terrain-render`, `webcam-renderer`, `animation-service`
- **External integrations**: `chrome-browser-service`, `brave-search-service`, `youtube-transcript-service`, `world-chat-transport`
- **Infrastructure**: `control-api`, `state-service`, `capability-service`, `app-logger`, `microapp-loader`
- **Content**: `content-service`, `content-measurement`, `markdown-service`, `figlet-service`, `syntax-highlight`
- **Persistence**: `workspace-service`, `canvas-document`
- **Timeline/VJ**: `timeline-service`, `timeline-types`, `scene-layout`, `scene-planner`
- **Media**: `audio-player-controller`, `monster-cam-service`, `monster-cam-worker`
- **Utilities**: `strip-ansi`, `rate-limiter`, `slash-router`, `editor-service`, `motion-service`

**Cohesion is low.** The folder conflates rendering engines, API surfaces, AI agents, media controllers, and pure utilities. It's the project's de facto "everything that isn't core or windows" bucket.

### Files That Don't Belong

| File | Suggested Location |
|------|-------------------|
| `strip-ansi.ts` | `core/` — pure text utility |
| `rate-limiter.ts` | `core/` — generic utility |
| `slash-router.ts` | `core/` — generic utility |
| `editor-service.ts` | `core/` — pure state operations |
| `motion-service.ts` | `core/` — animation primitive |
| `contour-engine.ts` | `engines/` — full rendering engine |
| `plasma-engine.ts` | `engines/` — full rendering engine |
| `terrain-model.ts` + `terrain-render.ts` | `engines/terrain/` |
| `timeline-types.ts` | Could be `core/types/` — pure type definitions |
| `microapp-sdk.ts` | Root or `sdk/` — it's the public API surface |

### Internal Dependency Patterns

```
wibwob-agent-session ──→ agent-tools ──→ brave-search-service
                     ──→ pi-session-bridge     ──→ youtube-transcript-service
                     ──→ audio-player-controller
                     ──→ app-logger

control-api ──→ app-logger
            ──→ strip-ansi
            ──→ world-chat-service ──→ world-chat-transport

microapp-loader ──→ world-chat-service
              ──→ world-chat-transport

scramble-brain ──→ pi-session-bridge
               ──→ rate-limiter
               ──→ slash-router

contour-engine ──→ animation-service
plasma-engine ──→ animation-service
terrain-model ──→ contour-engine
terrain-render ──→ contour-engine, terrain-model

timeline-service ──→ timeline-types, scene-planner, scene-layout
scene-planner ──→ timeline-types, scene-layout

content-service ──→ content-measurement
figlet-service ──→ content-measurement
markdown-service ──→ syntax-highlight, figlet-service

microapp-sdk ──→ (almost everything)

capability-service ──→ backrooms-service, chrome-browser-service
```

### Cross-Folder Dependencies

| Service | core/ imports |
|---------|--------------|
| `microapp-loader.ts` | 12 core/ imports (highest) |
| `wibwob-agent-session.ts` | `config.ts`, `types.ts` |
| `control-api.ts` | `types.ts`, `command-registry.ts`, `command-catalog.ts`, `runtime-stats.ts` |
| `microapp-sdk.ts` | ~15 core/ imports (barrel re-exports) |
| `state-service.ts` | `types.ts`, `theme/resolver.ts` |
| `canvas-document.ts` | `snapshot-registry.ts`, `window-facade.ts`, `types.ts` |
| Most rendering engines | 0–1 core/ imports |

### Top 5 Priority Refactoring Actions

| # | Action | Impact | Effort | Files |
|---|--------|--------|--------|-------|
| 1 | **Split `wibwob-agent-session.ts`** into 5–6 focused files (jailed tools, session tools, music tools, tool formatting, prompt loader, session class) | High — 1,063-line god class is the #1 maintenance burden | Medium | `wibwob-agent-session.ts` |
| 2 | **Split `chrome-browser-service.ts`** into extraction pipeline, image service, search, and shared `htmlToMarkdown` utility | High — 1,029-line god class with duplicated HTML→markdown logic shared with `brave-search-service.ts` | Medium | `chrome-browser-service.ts`, `brave-search-service.ts` |
| 3 | **Migrate `control-api.ts` to Hono** (or at minimum extract route handlers) | High — 350-line `handleRequest` with 15+ `as any` casts is fragile and hard to test | High | `control-api.ts` |
| 4 | **Extract rendering engines** (`contour-engine`, `plasma-engine`, `terrain-*`) to `src/engines/` subfolder | Medium — reduces folder noise, clarifies architecture boundaries | Low | 4 files moved, import paths updated |
| 5 | **Move pure utilities** (`strip-ansi`, `rate-limiter`, `slash-router`, `editor-service`, `motion-service`) to `core/` | Medium — these are framework-level primitives misplaced in a services folder | Low | 5 files moved |

### Type Safety Summary

| Severity | Count | Worst Offenders |
|----------|-------|-----------------|
| `as any` casts | ~35+ | `control-api.ts` (~15), `wibwob-agent-session.ts` (~15), `markdown-service.ts` (~10) |
| `@ts-ignore` | 3 | `brave-search-service.ts`, `chrome-browser-service.ts`, `youtube-transcript-service.ts` (all for missing type packages) |
| Untyped `catch {}` | ~20 | Scattered across audio, filesystem, and network code |

### Singleton Inventory

| Singleton | File | Scope |
|-----------|------|-------|
| `sharedPlayer` | `audio-player-controller.ts` | Process-wide audio |
| `capabilityService` | `capability-service.ts` | Cached capabilities |
| `braveService` | `agent-tools.ts` (module scope) | Search service |
| `worldChatService` | `world-chat-service.ts` | Chat state |
| `catalogueCache` | `figlet-service.ts` | Font catalogue |

All singletons are module-scoped and cannot be replaced for testing. Consider dependency injection for the most-used ones.
