# Component Inventory (v0 seed)

Source of truth: `src/services/microapp-sdk.ts`

Status legend:
- ✅ inventoried
- 🟡 needs parity/depth audit
- ⛔ candidate cut/merge/deprecate

## A) Runtime + host integration

✅ `createAnimationClock`, `createLayoutReporter`  
✅ `fetchRuntimeCommands`, `fetchRuntimeHealth`, `fetchRuntimeInspection`, `getRuntimeControlApiBaseUrl`  
✅ `MicroappHost`, `MicroappWindowHandle`, `MicroappSnapshotWindow` types

## B) Layout foundations (primitives)

✅ `applyRect`, `createNodePart`  
✅ `createStack`, `createRow`, `createGrid`, `createScrollViewport`  
✅ `pickBreakpoint`, `DEFAULT_BREAKPOINTS`  
✅ `createRestyleBundle`, `deferRender`

## C) Chrome / structural UI

✅ `createLayoutHeaderBar`, `createLayoutStatusBar`, `createLayoutRule`  
✅ `createBorderedPanel`, `createCollapsibleBlock`, `createContentStack`, `createSidebarPanel`  
✅ `resolveSidebarWidth`  
✅ `createLayoutButtonBar`  
✅ `createLayoutTabs`

## D) Text / content presentation

✅ `createTextBlock`, `createFigletDisplay`, `createLayoutInputLine`, `createMessageHistory`  
✅ `renderMarkdown`, `renderMarkdownFile`  
✅ `renderFiglet`, `renderFigletLines`, `measureFiglet`, `responsiveFiglet`, `getFigletCatalogue`, `getFigletFontChoices`, `getDefaultFigletFont`, `getFigletWindowContentSize`  
✅ `highlightCode`, `HIGHLIGHTED_LANGUAGES`

## E) Navigation and selection

✅ `createSelectableList`, `createInlineSearch`  
✅ `createFilterableList`, `createSelect`, `createSegmentedControl`, `createRadioGroup`

## F) Forms / inputs

✅ `createButton`  
✅ `createCheckbox`  
✅ `createToggleSwitch`  
✅ `createFormField`  
✅ `createTextArea`

## G) Feedback / status

✅ `createProgressBar`, `createSpinner`, `createToast`  
🟡 missing canonical banner/alert surface in SDK (check overlap with existing status bars)

## H) Data display

✅ `createKeyValuePanel`, `createLogView`, `createDataTable`  
🟡 table ergonomics and sorting/filtering parity review required

## I) Animation / motion / telemetry

✅ `tween`, `tweenWindowPosition`, `tweenWindowSize`, `EASINGS`  
✅ `createRenderMonitor`

## J) Drawing / ASCII composition

✅ `blankGrid`, `paintText`, `paintCentered`, `paintLines`, `drawArrow`, `gridToText`, `waveLine`, `bar`  
✅ `composeAsciiLayers`, `renderAsciiTextBlock`

## K) Panel/canvas layout engines

✅ `layoutPanels`, `layoutColumns`, `pointerToContent`, `hitPanel`, `measureViewport`, `COL_GAP`

## L) Utility + lifecycle safety

✅ `createTimer`, `clearTimers`  
✅ `safeDestroy`, `safeDestroyAll`  
✅ `createScrollbar`, `scrollableStyle`

## M) Composition helper layer (`src/sdk/composition-helpers.ts`)

✅ `createStatusBar`, `createTextViewer`, `createListPanel`, `createSplitView`, `createButtonBar`, `createHeaderBar`, `createScrollView`, `createTabs`, `createRule`, `createInputLine`, `createCanvas`

## N) Advanced/specialised (non-core third-party author path)

🟡 `MonsterCamService`, `renderWebcamFrame`, `gridToBlessedContent`  
🟡 `landmarksFromPreset`, `POSE_PRESETS`, `POSE_CONNECTIONS`, `renderSkeletonAt`  
🟡 `renderContourFromHills`

---

## Initial crispness flags (to drive triage)

1. Duplicate naming strata (`createLayout*` vs composition helpers) needs a canonical policy.
2. “Advanced internals” exports may be too broad for default SDK surface; likely split needed.
3. Contrib/canvas safeguards should be represented as explicit SDK helper patterns (not demo-local hacks).
4. Feedback category lacks clear alert/banner primitive guidance.
