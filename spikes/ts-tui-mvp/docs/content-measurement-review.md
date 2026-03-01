# Content Measurement Refactor Review

## Root cause

The refactor unified the measurement payload itself around `ContentMeasurement`, but the integration points were only partially updated. The result is one real behavior regression and a couple of contract mismatches:

1. Text viewers now carry two measurement channels (`contentMeasurement` and `fallbackMeasurement`), but only one of them is used for sizing.
2. `BrowserEntry.metadata` was widened to `Partial<ContentMeasurement>` even though the producer returns either a full measurement object or `undefined`.
3. A separate `{ width, height }` sizing shape still exists at the window-sizing boundary, so the type unification is not complete end-to-end.

## Findings

### 1. `fallbackMeasurement` is ignored for auto-sizing

Files:
- `spikes/ts-tui-mvp/src/core/app-controller.ts:1836`
- `spikes/ts-tui-mvp/src/windows/content-windows.ts:295`
- `spikes/ts-tui-mvp/src/windows/content-windows.ts:315`

`AppController.openTextViewerWindow()` computes `fallbackMeasurement` for non-primer viewers:

- reader windows opened from the file manager
- browser reader windows
- any plain text viewer opened without explicit `contentMeasurement`

But `openTextViewerWindow()` in `content-windows.ts` only calls `applyMeasuredWindowSize()` when `params.contentMeasurement` exists. `params.fallbackMeasurement` is used for `describeState()` only.

Impact:
- primer windows still auto-size
- plain text reader/browser windows keep default geometry even though measurement was computed

### 2. `BrowserEntry.metadata?: Partial<ContentMeasurement>` is weaker than the actual contract

Files:
- `spikes/ts-tui-mvp/src/core/types.ts:34`
- `spikes/ts-tui-mvp/src/services/content-service.ts:180`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:2003`

`readPrimerMetadata()` returns `measurePrimerContent(...).measurement` or `undefined`, not a partial object. So `Partial<ContentMeasurement>` allows states that are not actually produced.

Does it make sense?
- For runtime behavior: yes, current accesses still work because every current use is null-safe.
- For typing: not really. It hides completeness guarantees and makes it easier for future callers to construct half-populated metadata objects accidentally.

Are previous metadata fields still accessible?
- The currently used fields are still accessible under the new names: `columnWidth`, `lineCount`, `recommendedWidth`, `recommendedHeight`, `animated`, `frameCount`.
- `skippedCommentLines` and `hasFrames` are also available on the object, but not exposed by `getPrimerInfo()`.

### 3. The figlet measurement wrapper is correct; field renames were applied at call sites

Files:
- `spikes/ts-tui-mvp/src/services/figlet-service.ts:153`
- `spikes/ts-tui-mvp/src/windows/figlet-windows.ts:116`
- `spikes/ts-tui-mvp/src/windows/figlet-windows.ts:138`

`FigletMeasurement` now wraps `ContentMeasurement` as:

- `measurement: ContentMeasurement`

The `figlet-windows.ts` accesses were updated correctly:

- `lastMeasurement.measurement.lineCount`
- `lastMeasurement.measurement.columnWidth`

I did not find any stale accesses to `FigletMeasurement.width` or `FigletMeasurement.height`.

Note:
- `FigletFontMeta.height/width` is a separate font-catalogue type and is still used correctly in the toolbar label.

### 4. The app-controller mapping is correct for the endpoint that exists, but there is no `gallery_list` endpoint here

Files:
- `spikes/ts-tui-mvp/src/core/app-controller.ts:1998`
- `spikes/ts-tui-mvp/src/services/control-api.ts:189`

I could not find a `gallery_list` endpoint in this spike. The content metadata endpoint present in this code is `GET /content/primer-info`, backed by `AppController.getPrimerInfo()`.

That mapping is correct for the refactor:

- `columnWidth -> content_width`
- `lineCount -> content_lines`
- `recommendedWidth -> recommended_w`
- `recommendedHeight -> recommended_h`
- `frameCount -> frame_count`

### 5. No circular dependency is present today

Files:
- `spikes/ts-tui-mvp/src/core/types.ts:2`
- `spikes/ts-tui-mvp/src/services/content-measurement.ts:1`
- `spikes/ts-tui-mvp/src/services/content-service.ts:6`

`types.ts` has a type-only import from `content-measurement.ts`. `content-measurement.ts` does not import from `types.ts`, so there is no direct cycle.

There is still a layering smell:
- `core/types.ts` depends on a service-layer type
- service files already depend on `core/types.ts`

That is not a runtime cycle now, but it makes future cycles easier to introduce.

### 6. `content-windows.ts` does not crash when both measurements are missing, but sizing falls back to frame defaults

Files:
- `spikes/ts-tui-mvp/src/windows/content-windows.ts:295`
- `spikes/ts-tui-mvp/src/windows/content-windows.ts:315`

If both `contentMeasurement` and `fallbackMeasurement` are `undefined`:

- `describeState()` safely emits zero/undefined values through optional chaining
- no auto-size call runs
- the window stays at the default frame size

So this path is safe, but it silently loses content-aware sizing.

### 7. Dead code / unused imports remain

Files:
- `spikes/ts-tui-mvp/src/core/app-controller.ts:20`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:23`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:35`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:38`
- `spikes/ts-tui-mvp/src/services/figlet-service.ts:148`
- `spikes/ts-tui-mvp/src/services/figlet-service.ts:155`

I found a few leftovers:

- `BrowserEntry` import in `app-controller.ts` appears unused.
- `GalleryTab` import in `app-controller.ts` appears unused.
- `measurePrimerContent` import in `app-controller.ts` appears unused.
- `getFigletCatalogue`, `getFigletFontChoices`, `measureFiglet`, and `renderFiglet` imports in `app-controller.ts` appear unused.
- `renderFigletLines()` appears unused.
- `FigletMeasurement.lines` appears unused.

## Fix options

### Option A. Minimal behavior fix

Change `content-windows.ts` to size from:

- `const m = params.contentMeasurement ?? params.fallbackMeasurement`

and use `m` for `applyMeasuredWindowSize()` when present.

Tradeoffs:
- Smallest fix
- Restores plain-text viewer auto-sizing immediately
- Leaves the split `contentMeasurement` vs `fallbackMeasurement` API in place

### Option B. Collapse viewer sizing to a single measurement input

Replace:

- `contentMeasurement?: ContentMeasurement`
- `fallbackMeasurement?: ContentMeasurement`

with one optional field, for example:

- `measurement?: ContentMeasurement`

Do the plain-text fallback in the controller before calling the window helper.

Tradeoffs:
- Cleaner contract
- Removes the current regression class entirely
- Slightly broader call-site edit

### Option C. Finish the type unification at the sizing boundary

Replace the inline `{ width, height }` callback payloads in:

- `app-controller.ts`
- `content-windows.ts`
- `figlet-windows.ts`

with either:

- `ContentMeasurement`, or
- `Pick<ContentMeasurement, "columnWidth" | "lineCount">`

Tradeoffs:
- Best alignment with the refactor goal
- Requires changing `contentToWindowSize()` or adding an adapter
- More invasive than the behavior fix

### Option D. Tighten `BrowserEntry.metadata`

Change:

- `metadata?: Partial<ContentMeasurement>`

to either:

- `metadata?: ContentMeasurement`, or
- `metadata?: Pick<ContentMeasurement, "...subset...">`

Tradeoffs:
- Better compile-time guarantees
- Prevents partial-shape drift
- If callers intentionally construct sparse metadata later, this becomes stricter

## Risks and tests to add

### Risks

- Plain text reader windows may no longer auto-size, even though primers still do.
- The weak `Partial<ContentMeasurement>` type can mask future regressions by allowing incomplete metadata objects.
- The core-to-service type import in `types.ts` increases the chance of a future circular dependency if `content-measurement.ts` starts depending on core types.

### Tests to add

1. `openTextViewerWindow()` should auto-size when only `fallbackMeasurement` is provided.
2. `openTextViewerWindow()` should not throw when both measurements are missing, and should preserve default sizing.
3. `getPrimerInfo()` should map `columnWidth`, `lineCount`, `recommendedWidth`, `recommendedHeight`, and `frameCount` to the API response fields.
4. `measureFiglet()` should return `measurement.columnWidth` / `measurement.lineCount`, and figlet window state should read those fields.
5. A type-level or unit test should assert that `ContentService.readPrimerMetadata()` returns a complete `ContentMeasurement` object.

## Verification

- Targeted search across the requested files
- `bunx tsc --noEmit` from `spikes/ts-tui-mvp` passed
