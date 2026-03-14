---
id: chore-figlet-audit
title: Figlet usage audit — every .ts file, every pattern, SDK gaps
status: not-started
parent: chore-menu-nav-figlet-audit
---

# Figlet usage audit

Complete inventory of every TypeScript file that references figlet,
classified by role (core service, window, module, SDK, agent tool,
test, config). Feeds the SDK extraction plan in the parent chore.


## 1. Core services (the engine room)

### src/services/figlet-service.ts
THE canonical figlet wrapper. Owns CLI invocation, font catalogue,
measurement, and caching.

Exports:
  renderFiglet(text, font?, width?)       -> string
  renderFigletLines(text, font?, width?)  -> string[]
  measureFiglet(text, font?, width?)      -> FigletMeasurement
  isFigletAvailable()                     -> boolean
  getFigletCatalogue()                    -> FigletCatalogue
  getFigletFontChoices()                  -> {value,label}[]
  getDefaultFigletFont()                  -> string
  getFigletFontHeight(font)               -> number

Types: FigletFontMeta, FigletFontCategory, FigletCatalogue, FigletMeasurement

NOTE: This is the RIGHT place to put tryFiglet and responsiveFiglet
when we extract them. Everything figlet-related funnels here.


### src/services/markdown-service.ts
Figlet heading renderer for markdown. Has its own tryFiglet (private,
cached, width-aware) and renderFigletHeading (per-level font cascade).

Private functions (NOT exported):
  tryFiglet(text, font, width)                    -> string[] | null
  renderFigletHeading(text, level, width, config)  -> string[]

Exports:
  FigletHeadingLevel (type)
  FigletHeadingConfig (type)
  DEFAULT_FIGLET_HEADING_CONFIG
  PLAIN_HEADING_CONFIG

DUPLICATION: tryFiglet here duplicates logic that should live in
figlet-service.ts. The caching and width-overflow check are useful
but belong in the shared service.


### src/services/capability-service.ts
Checks whether figlet binary exists on PATH. Reports bin.figlet
capability status. Consumer only, no rendering.


## 2. SDK exports (what modules can import)

### src/services/microapp-sdk.ts
Re-exports from figlet-service:
  renderFiglet, renderFigletLines, measureFiglet, isFigletAvailable
  FigletMeasurement (type)

Re-exports from markdown-service:
  renderMarkdown, renderMarkdownFile, PLAIN_HEADING_CONFIG
  RenderMarkdownOptions (type)

Previously NOT exported (now fixed):
  [x] tryFiglet (width-aware render with null on overflow)
  [x] responsiveFiglet (cascade font selection)
  [x] FontCascadeTier type
  [x] DEFAULT_FONT_CASCADE constant
  [x] DEFAULT_FIGLET_HEADING_CONFIG
  [x] FigletHeadingConfig type
  Still not exported (lower priority):
  [ ] getFigletFontHeight
  [ ] getFigletCatalogue
  [ ] getFigletFontChoices

### src/core/ui-parts.ts -> createFigletDisplay()
UI primitive. Takes a renderText callback (text -> string).
Does NOT receive width in the callback. Not responsive.
Exported via SDK (microapp-sdk.ts, primitives.ts).

### src/services/microapp-loader.ts
Wires createFigletDisplay into the host.ui namespace for modules.


## 3. Windows (built-in window types)

### src/windows/figlet-windows.ts
Standalone figlet banner window. Uses:
  measureFiglet, renderFiglet, getDefaultFigletFont,
  getFigletCatalogue, getFigletFontChoices
Has resize handler (rerenderFiglet) but uses SAME font on resize,
just re-wraps. No font cascade.

### src/windows/text-windows.ts
Smart editor with markdown view mode. Uses:
  DEFAULT_FIGLET_HEADING_CONFIG, PLAIN_HEADING_CONFIG,
  FigletHeadingConfig (type)
Toggle figlet headings with 'h' key. Re-renders on resize.
Responsive WITHIN heading tier (uses markdown-service cascade).

### src/windows/chrome-browser-window.ts
Web browser. Uses:
  renderMarkdown, DEFAULT_FIGLET_HEADING_CONFIG, PLAIN_HEADING_CONFIG,
  FigletHeadingConfig (type)
Toggle figlet with 'h' key. Re-renders on resize.
Same responsive behaviour as text-windows (within-tier).

### src/windows/monster-cam-model.ts
Monster Cam. Uses:
  renderFiglet (for emotion label, "small" font)
Not responsive. Decorative use.


## 4. Modules (dynamically loaded microapps)

### microapps/hello-world/index.ts
NEWLY responsive (this chore). Has local tryFiglet and responsiveFiglet
with font cascade: larry3d -> slant -> small -> smslant -> digital -> CAPS.
Uses raw spawnSync. Should migrate to SDK primitives.

### microapps/wibwob-poetry-clock/index.ts
Fixed font ("chunky"). Local renderFigletTime using raw spawnSync.
Uses createFigletDisplay SDK primitive but not responsive.
Should use SDK renderFiglet instead of raw spawnSync.

### microapps/dashboard/index.ts
Uses SDK renderFiglet for clock and marquee (big, slant fonts).
Static figlet cells in mosaic grid. Not responsive.

### microapps/dashboard/index_v0.ts
Legacy version. Local figlet() using raw spawnSync.
Same mosaic pattern. Should be deleted or migrated.

### microapps/dashboard-xxl/index.ts
Virtual canvas mosaic. Local figlet() using raw spawnSync.
Static cells pre-rendered at build time. Not responsive.
Should use SDK renderFiglet.

### microapps/sy2-chronicles/index.ts + panel-types.ts
Multi-panel narrative. Uses SDK renderFiglet via panel-types.ts.
Panel type "figlet" with configurable font per panel definition.
renderFigletPanel calls renderFiglet(text, font, width).
Has width-awareness but no font cascade. Good citizen.

### microapps/zine/index.ts
Only a scaffold slot comment for future figlet panel type.
No actual figlet usage yet.


## 5. Agent tools and API

### src/services/agent-tools.ts
tui_open_figlet tool. Calls ctx.openFigletWindow(text, font).
Consumer only.

### src/services/control-api.ts
POST /view/figlet/open endpoint. Maps to figlet.open command.
Consumer only.

### src/services/wibwob-agent-session.ts
Formats figlet tool call for display: `figlet "text" [font]`.
Consumer only.


## 6. Commands and registry

### src/core/command-catalog.ts
  figlet.open           -> openFigletBanner (requires bin.figlet)
  markdown.toggle_figlet -> toggleMarkdownFiglet

### src/core/app-controller.ts
Imports from figlet-service: getDefaultFigletFont, getFigletCatalogue,
getFigletFontChoices, measureFiglet, renderFiglet.
Imports from figlet-windows: openFigletFontPicker, openFigletWindow,
promptForFigletText.
Wires everything into the command action map.


## 7. Supporting files

### src/core/snapshot-registry.ts
Workspace snapshot for "figlet-banner" kind. Saves text + font.
Uses getDefaultFigletFont for restore fallback.

### src/core/canvas-types.ts
ZineSourceType includes "figlet".

### src/services/canvas-document.ts
Canvas open/save handles figlet panel type.

### src/services/scene-planner.ts
VJ timeline scene matching for figlet windows.

### src/services/timeline-types.ts
Timeline cue type includes { type: "figlet", text, font? }.

### src/core/primitives.ts
Re-exports createFigletDisplay from ui-parts.ts.

### src/tests/microapp-workspace-roundtrip.test.ts
Test mock for openFigletBanner.


## 8. Raw spawnSync("figlet"...) calls (to consolidate)

Files that bypass figlet-service and call the CLI directly:

  src/services/markdown-service.ts:95    tryFiglet (private, cached)
  microapps/hello-world/index.ts:25        tryFiglet (local)
  microapps/wibwob-poetry-clock/index.ts:60  renderFigletTime (local)
  microapps/dashboard-xxl/index.ts:79      figlet() (local)
  microapps/dashboard/index_v0.ts:40       figlet() (local, legacy)

Five call sites. All should route through figlet-service.ts.
markdown-service.ts is special (needs caching + null return) but
the underlying spawn should still delegate to figlet-service.


## 9. SDK extraction plan (subtasks)

[x] 9a. Add tryFiglet to figlet-service.ts (width-aware, cached, null on overflow)
[x] 9b. Refactor markdown-service tryFiglet to delegate to figlet-service
[x] 9c. Add FontCascade type + DEFAULT_FONT_CASCADE to figlet-service.ts
[x] 9d. Add responsiveFiglet(text, width, cascade?) to figlet-service.ts
[x] 9e. Export new functions + types from microapp-sdk.ts
[x] 9f. Also export: DEFAULT_FIGLET_HEADING_CONFIG, FigletHeadingConfig
[ ] 9g. Add width param to createFigletDisplay renderText callback
         (or create createResponsiveFigletDisplay)
[x] 9h. Migrate hello-world to use SDK responsiveFiglet
[x] 9i. Migrate poetry-clock to use SDK renderFiglet
[x] 9j. Migrate dashboard-xxl to use SDK renderFiglet
[ ] 9k. Delete dashboard/index_v0.ts (legacy, not loaded)
[ ] 9l. Document font tiers in .agents/microapp-sdk.md
