---
id: sdk-audit-2026-03
title: Microapp SDK Audit — March 2026
status: done
created: 2026-03-09
---

# Microapp SDK Audit — March 2026

TL;DR: The SDK was missing six categories of exports that modules were reaching
around it to get. All six gaps have been patched in this session. TouchLab-MVP
also carries local copies of grid-canvas utils — that's the one remaining debt.

---

## Context

Triggered by E025 (§y² Chronicles) landing S07–S09 and introducing new patterns.
sy2-chronicles, e026-demo, and panel-types.ts were all importing directly from
`src/core/` and `src/services/` rather than going through `microapp-sdk.ts`.

Audit method: grep all `from "../../src/"` imports across modules/, map to SDK
surface, identify gaps.

---

## E025 AC Status (as of this audit)

| AC | Status | Notes |
|----|--------|-------|
| AC-1 Panel grid full-screen | [x] done | |
| AC-2 7+ panel types | [x] done | text figlet ascii-art pixel infographic markdown mixed + webcam |
| AC-3 Grid reflow on resize | [ ] NOT done | onResize calls renderLayoutAndContent but doesn't rebuild panels |
| AC-4 62 panels scroll | [x] done | blessed fixed:true solved scroll-jump |
| AC-5 Figlet auto-size | [x] done | |
| AC-6 ASCII/primer panels | [x] done | |
| AC-7 Panel search | [ ] needs verify | / key + title filter coded — unchecked in brief |
| AC-8 Zoom (dropped) | [-] dropped | replaced with z=minimap overlay |
| AC-9 describeState | [x] done | panels[], scrollY, panelCount all present |
| AC-10 typecheck clean | [x] done | |
| AC-11 Panel drag by mouse | [ ] needs verify | S07 handleDragMouse coded, unverified against running app |
| AC-12 Agent panel commands | [x] done | sy2.panel.{list,inspect,focus,move,reset,write,append,clear} |
| AC-13 Double-click edit | [ ] needs verify | S08 enterEditMode + textarea coded, unverified |
| AC-14 Click-while-scrolled jump | [ ] needs verify | _scrollIntoView override coded, unverified |
| AC-15 SDK exports complete | [x] done | this audit — see SDK Gaps section below |

[ ] Remaining to close E025: verify AC-7, AC-11, AC-13, AC-14; fix AC-3
    (call buildPanels() on resize, not just renderLayoutAndContent()).

---

## SDK Gaps Found and Patched

### [x] 1. Timer / animation loop helpers
Missing: `createTimer`, `clearTimers`, `createScrollbar`, `scrollableStyle`,
`safeSetStyle`, `isRightClick` from `src/core/ui-primitives.ts`.

Impact: sy2-chronicles and e026-demo both imported `createTimer`/`clearTimers`
directly. Every module needs lifecycle-safe tick loops.

Added: all six exports now in SDK under the "Timer helpers" section.

### [x] 2. Figlet raw renderers
Missing: `renderFiglet`, `renderFigletLines`, `measureFiglet`, `isFigletAvailable`,
`getFigletFontChoices`, `getFigletFontHeight`, `getDefaultFigletFont`.

Only `createFigletDisplay` (the UI part) was in SDK. The raw renderers are needed
for panel types, status bars, and anywhere a full UI part is overkill.

Impact: sy2-chronicles panel-types.ts and index.ts both imported from figlet-service
directly.

Added: all seven raw figlet exports + FigletMeasurement/FigletFontMeta types.

### [x] 3. Markdown rendering
Missing: `renderMarkdown`, `renderMarkdownFile`, `isMarkdownFile`, `getFileMtime`,
`PLAIN_HEADING_CONFIG`, `DEFAULT_FIGLET_HEADING_CONFIG`.

The markdown panel type in sy2-chronicles uses `PLAIN_HEADING_CONFIG` (suppress
figlet headings in narrow panel spaces) — a useful pattern for any panel surface.

Impact: sy2-chronicles/panel-types.ts imported markdown-service directly.

Added: all six + RenderMarkdownOptions/FigletHeadingConfig types.

### [x] 4. Contour / terrain low-level renderers
Missing: `renderContour`, `renderContourFromHills`, `renderFromHills`,
`generateTerrainHills`, `heightmap`, `march`, `makeHill`.

`createContourPlayer` was already in SDK but `renderContour` (the one-shot renderer
used by the terrain panel in sy2-chronicles) was not.

Impact: sy2-chronicles/index.ts (the Contour Study panel) imported directly.

Added: all seven low-level contour exports + ContourMode/Hill types.

### [x] 5. Motion / tween
Missing: `tween`, `tweenWindowPosition`, `tweenWindowSize`, `EASINGS`, `EasingFn`,
`TweenOpts`.

e026-demo imported motion-service directly for animated window choreography.
This is a first-class creative primitive for VJ timelines and dramatic reveals.

Added: all exports + types.

### [x] 6. Tree widget
Missing: `createTreeWidget`, `TreeNode`, `TreeWidgetHandle`.

e026-demo imported tree-widget directly. Any module building a file browser or
hierarchical data surface needs this.

Added: all exports + types.

---

## [ ] Remaining Debt — TouchLab-MVP local copies

TouchLab-MVP (`modules/touchlab-mvp/index.ts`) has private copies of:
  blankGrid, gridToText, paintText, drawArrow, waveSource

These ARE exported by the SDK (blankGrid, gridToText, paintText, drawArrow from
grid-canvas). TouchLab-MVP predates the grid-canvas SDK exports and was never
updated. Low priority (it works) but messy. Could be cleaned up in a single
refactor pass: remove the local definitions, add the SDK imports.

Note: `waveSource` is TouchLab-specific (different signature from SDK's `waveLine`)
so it stays local.

---

## [ ] Patterns Worth Formalising (not yet in SDK)

These patterns appear across multiple modules but exist only as copy-paste or
inline code. Candidates for SDK extraction in a future pass:

### [ ] CEPanelDef panel schema + renderers
`modules/sy2-chronicles/panel-types.ts` defines a rich panel authoring API:
eight panel types (text, figlet, ascii-art, pixel, infographic, markdown, mixed,
webcam), `toPanelDef()` converter, `renderPanel()` dispatcher with type-safe
switching and graceful fallbacks.

Any future magazine-layout app (CE-style, dashboard, timeline viewer) would
benefit from this as an SDK export. Candidate path: `src/core/panel-schema.ts`.

### [ ] Content file loader + hot-reload watcher
`modules/sy2-chronicles/content-loader.ts` has `loadPanelsFromDir` and
`watchPanelDir`. A two-function portable pattern for any app that loads content
from JSON/markdown files and wants hot-reload. Generalises easily to any content
type (panel defs, deck slides, config files).

### [ ] Drag-to-move panel pattern — createDragHandler()
The `screen.on("mouse")` + `hitPanel` + position override map pattern in
sy2-chronicles S07 is the canonical way to make panels draggable. It wraps the
`pointerToContent` + `hitPanel` SDK exports with a state machine (mousedown,
mousemove, mouseup, safePointerToContent guard). Could be a `createDragHandler()`
SDK helper.

### [ ] Webcam toggle pattern — createWebcamToggle()
The `camActive` flag + `MonsterCamService` singleton + `on("frame", listener)`
pattern appears in sy2-chronicles. A `createWebcamToggle(host, panelNode, key)`
helper would let any module add a live webcam panel in two lines.

### [ ] Double-click edit mode — createDoubleClickEditor()
The `lastClickTime` + `DBLCLICK_MS` + inline blessed.textarea pattern in S08.
Could be `createDoubleClickEditor(frame, content, host, opts)` returning
`{ enterEdit, exitEdit, onSave }`.

---

## [x] Summary of SDK changes made this session

  src/services/microapp-sdk.ts — added 6 export sections, ~50 new exports:
    [x] Timer helpers (createTimer, clearTimers, createScrollbar, scrollableStyle,
        safeSetStyle, isRightClick)
    [x] Figlet raw renderers (renderFiglet, renderFigletLines, measureFiglet, ...)
    [x] Markdown rendering (renderMarkdown, PLAIN_HEADING_CONFIG, ...)
    [x] Contour low-level (renderContour, renderContourFromHills, ...)
    [x] Motion / tween (tween, tweenWindowPosition, tweenWindowSize, EASINGS, ...)
    [x] Tree widget (createTreeWidget, TreeNode, TreeWidgetHandle)

  typecheck: clean.
