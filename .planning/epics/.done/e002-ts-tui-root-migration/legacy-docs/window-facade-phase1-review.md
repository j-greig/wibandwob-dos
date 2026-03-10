# WindowFacade Phase 1 Review

## Root cause

Phase 1 mostly landed, but the boundary is still split between:

- the new id-based `WindowFacade` contract in [window-facade.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-facade.ts)
- the older concrete `WindowManager` usage pattern where many internal callers still pass `WindowRecord` objects into `focusWindow(...)`
- editor write behavior that still depends on `AppController` wiring after construction

So the main issue is contract drift: the facade says "id-based window operations", while the concrete implementation still exposes record-based focus and a best-effort editor-write fallback.

## Findings

### 1. All 11 `WindowFacade` methods exist on `WindowManager`, but one method is only conditionally faithful to the interface

The 11 methods from the PRD Phase 1 section are present on [window-manager.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts): `getWindows`, `getWindowById`, `getLastWindow`, `getFocusedWindow`, `moveWindow`, `resizeWindow`, `focusWindow`, `closeWindow`, `sendInput`, `writeEditorText`, `captureText`.

The caveat is [window-manager.ts#L322](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts#L322): `focusWindow(idOrRecord: number | WindowRecord): boolean`.

The interface contract in [window-facade.ts#L24](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-facade.ts#L24) is `focusWindow(id: number): boolean`. `WindowManager` accepts more than the interface allows. TypeScript permits that here, and `tsc` passes, but behavior is broader than the public contract.

### 2. The `focusWindow(number | WindowRecord)` overload is not fully safe

Current behavior:

- number path: safe, uses `focusWindowById`, returns `false` when the id is missing at [window-manager.ts#L323](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts#L323)
- record path: always returns `true` after calling `focusWindowInternal(...)` at [window-manager.ts#L326](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts#L326)

The unsafe case is an arbitrary `WindowRecord` that is not in `this.windows`. In [window-manager.ts#L223](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts#L223), `focusWindowInternal` does not reject that case. If the record is not found:

- it still sets `this.focusedWindow = record` at [window-manager.ts#L229](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts#L229)
- it still updates borders and renders
- no window in `this.windows` is actually promoted in z-order

That leaves `focusedWindow` pointing at a record the manager does not own.

This is mostly masked today because existing record-based callers are all concrete `WindowManager` users and pass real registered frames, for example:

- [text-windows.ts#L45](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/text-windows.ts#L45)
- [content-windows.ts#L70](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/content-windows.ts#L70)
- [misc-windows.ts#L46](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/misc-windows.ts#L46)
- [wibwob-chat-window.ts#L81](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/wibwob-chat-window.ts#L81)
- [app-controller.ts#L614](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L614)

So there is no current breakage, but the overload is only safe by convention.

### 3. The `EditorWriteHook` pattern is directionally correct, but the fallback is not safe

The PRD explicitly calls for an injected callback for editor mutation + dirty marking. That is implemented via:

- hook type at [window-manager.ts#L6](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts#L6)
- setter at [window-manager.ts#L26](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts#L26)
- wiring in [app-controller.ts#L142](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L142)

The hooked path is correct because [app-controller.ts#L2039](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L2039) does the three required side effects:

- `insertEditorTextState(...)`
- `markEditorDirty(...)`
- `renderEditor(...)`

The fallback in [window-manager.ts#L348](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts#L348) is not equivalent:

- it appends directly to `record.editor.value`
- it does not mark dirty
- it does not render
- it bypasses the canonical editor mutation helper

That means the fallback can create invisible or unsaved edits. It violates the PRD's "no behaviour change" goal more than throwing or returning `false` would.

### 4. No existing callers break from the `focusWindowInternal` rename

I found no external callers of `focusWindowInternal(...)`. The rename is internal-only.

Existing record-based callers were preserved by keeping `focusWindow(frame)` working on the concrete class, and id-based callers still use:

- `focusWindowById(...)` in [app-controller.ts#L2022](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L2022)
- `closeWindowById(...)` in [app-controller.ts#L2080](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L2080)
- `focusWindowById` in [control-api.ts#L275](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/control-api.ts#L275)

So current callers are intact.

### 5. `captureText` returns raw text in the facade path; file export remains outside the facade

The facade contract says raw text in [window-facade.ts#L30](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-facade.ts#L30), and the manager implementation follows that at [window-manager.ts#L356](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-manager.ts#L356) by directly returning `record?.captureText?.()`.

The current `captureText` producers also return strings only:

- terminal capture at [app-controller.ts#L590](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L590)
- xterm transcript capture at [app-controller.ts#L735](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L735)
- chat capture at [wibwob-chat-window.ts#L181](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/wibwob-chat-window.ts#L181)

File export still exists in [app-controller.ts#L2048](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L2048), but that is `captureWindowTextById`, not the facade method. So Phase 1 satisfies the PRD requirement here.

### 6. No obvious facade methods are missing for Phase 1 consumers, but one internal migration seam is still unresolved

For the Phase 1 facade itself, I do not see a missing consumer-facing method. The 11-method shape matches the PRD.

What is still missing is a clean internal replacement for record-based focus. Today, many window constructors still require concrete `WindowManager` and call `focusWindow(frame)`. That means Phase 1 did not yet create a clean separation for "app controller internals" despite the comment in [window-facade.ts#L5](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/window-facade.ts#L5).

## Fix options

### Option A: Keep the overload temporarily, but make it explicit and safe

Change `focusWindow` to proper overload signatures:

```ts
focusWindow(id: number): boolean;
focusWindow(record: WindowRecord): boolean;
focusWindow(idOrRecord: number | WindowRecord): boolean { ... }
```

Then reject unregistered records before mutating `focusedWindow`.

Pros:

- zero churn for current concrete callers
- keeps Phase 1 migration moving

Cons:

- public class still exposes behavior outside the facade contract
- extends the life of record-based focus

### Option B: Split the APIs cleanly now

Make facade `focusWindow(id: number): boolean` only, and add a separate internal helper such as `focusWindowRecord(record: WindowRecord): boolean` or convert concrete callers to `frame.focus()`.

Pros:

- contract and implementation become aligned
- impossible to misuse the facade-shaped method

Cons:

- requires touching many existing window constructors and `AppController`
- slightly more Phase 1 churn

### Option C: Replace setter injection with constructor injection for editor writes

Pass `EditorWriteHook` into the `WindowManager` constructor and require it.

Pros:

- eliminates a partially initialized manager state
- makes wrong wiring impossible

Cons:

- constructor call sites change
- slightly less convenient in tests unless helpers are added

### Option D: If setter injection remains, fail fast when the hook is missing

Keep `setEditorWriteHook`, but in `writeEditorText` do not mutate directly. Either:

- return `false`, or
- throw an invariant error

Recommendation: throw in tests/dev or return `false` in production, but do not silently append.

Pros:

- preserves behavior guarantees
- surfaces broken wiring immediately

Cons:

- stricter than the current fallback
- may require a small test update if any code relied on direct append

## Risks

- The record overload can leave `focusedWindow` pointing to an unmanaged record.
- The direct editor fallback can lose dirty-state tracking and visible render updates.
- The codebase still depends on concrete `WindowManager` in most window constructors, so "every consumer holds a `WindowFacade`" is not true yet.
- `focusWindowById` and `closeWindowById` are still heavily referenced, so Phase 1 is additive rather than a real rename for external surfaces.

## Tests to add

- Facade contract test covering all 11 methods on `WindowManager`, matching the PRD success criteria.
- `focusWindow(record)` safety test: passing an unregistered record must not mutate `focusedWindow` or return success.
- `focusWindow(id)` parity test: focusing by id updates z-order and `getFocusedWindow()` consistently.
- `writeEditorText` wiring test: with hook set, it must update editor content, mark dirty, and render.
- `writeEditorText` missing-hook test: verify the chosen invariant (`false` or throw`) and assert no raw mutation occurs.
- `captureText` test: returns raw text and does not create files.
- Control API export test: `captureWindowTextById` still writes a file path so the non-facade export path stays intact.

## Bottom line

Phase 1 is mostly correct and compiles, but it is not fully closed as a boundary cleanup. The two concrete issues worth fixing now are:

1. make the record-based focus path explicitly safe or split it into a separate internal API
2. remove the silent direct-append fallback from `writeEditorText`
