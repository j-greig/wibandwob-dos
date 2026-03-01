# Window Facade Review

## Root Cause

The window-operation contract is not owned by one abstraction. Geometry and stacking live in `WindowManager`, but input, editor mutation, and text capture live on `WindowRecord` hooks and `AppController` helpers. New consumers then receive hand-built subsets of that mixed contract:

- `ControlApiHandlers` in `spikes/ts-tui-mvp/src/services/control-api.ts`
- `TuiToolContext` in `spikes/ts-tui-mvp/src/services/agent-tools.ts`
- `WorkspaceRestoreActions` in `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts`
- `AppController` public `*ById` bridge methods in `spikes/ts-tui-mvp/src/core/app-controller.ts`
- `WindowRecord` capability hooks in `spikes/ts-tui-mvp/src/core/types.ts`

That split causes signature drift, different return semantics, and hidden dependencies on `AppController` for behaviors that the PRD treats as if they already belong to `WindowManager`.

## Catalogue Of Declarations

### Canonical implementation: `WindowManager`

File: `spikes/ts-tui-mvp/src/core/window-manager.ts`

- `getFocusedWindow(): WindowRecord | undefined` at line 21
- `getWindows(): WindowRecord[]` at line 25
- `getWindowById(id: number): WindowRecord | undefined` at line 33
- `focusWindow(record: WindowRecord): void` at line 209
- `moveWindow(id: number, left: number, top: number): boolean` at line 255
- `resizeWindow(id: number, width: number, height: number): boolean` at line 271
- `focusWindowById(id: number): boolean` at line 287
- `closeWindowById(id: number): boolean` at line 296

Observation: `WindowManager` does not currently declare `closeWindow(id)`, `sendInput`, `writeEditorText`, or `captureText`.

### `AppController` public bridge methods

File: `spikes/ts-tui-mvp/src/core/app-controller.ts`

- `focusWindowById(id: number): boolean` at lines 1961-1963
- `moveWindowById(id: number, left: number, top: number): boolean` at lines 1965-1967
- `sendWindowInputById(id: number, input: string): boolean` at lines 1969-1976
- `writeEditorTextById(id: number, text: string): boolean` at lines 1978-1984
- `captureWindowTextById(id: number, name?: string): string | undefined` at lines 1986-1999
- `resizeWindowById(id: number, width: number, height: number): boolean` at lines 2014-2016
- `closeWindowById(id: number): boolean` at lines 2018-2020

### `ControlApiHandlers`

File: `spikes/ts-tui-mvp/src/services/control-api.ts`

- `focusWindowById: (id: number) => boolean;` at line 52
- `moveWindowById: (id: number, left: number, top: number) => boolean;` at line 53
- `resizeWindowById: (id: number, width: number, height: number) => boolean;` at line 54
- `closeWindowById: (id: number) => boolean;` at line 55
- `sendWindowInput: (id: number, input: string) => boolean;` at line 56
- `writeEditorText: (id: number, text: string) => boolean;` at line 57
- `captureWindowText: (id: number, name?: string) => string | undefined;` at line 58

### `TuiToolContext`

File: `spikes/ts-tui-mvp/src/services/agent-tools.ts`

- `closeWindow: (id: number) => boolean;` at line 30
- `moveWindow: (id: number, left: number, top: number, width?: number, height?: number) => boolean;` at lines 31-37
- `focusWindow: (id: number) => boolean;` at line 38
- `sendWindowInput: (id: number, input: string) => boolean;` at line 39
- `captureWindowText: (id: number) => string | undefined;` at line 40
- `writeEditorText: (id: number, text: string) => boolean;` at line 41

### `WorkspaceRestoreActions`

File: `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts`

- `getLastWindow: () => WindowRecord | undefined;` at line 118
- `moveWindow: (id: number, left: number, top: number) => void;` at line 119
- `resizeWindow: (id: number, width: number, height: number) => void;` at line 120

### `WindowRecord` capability hooks

File: `spikes/ts-tui-mvp/src/core/types.ts`

- `close: () => void;` at line 179
- `focus: () => void;` at line 180
- `writeInput?: (input: string) => void;` at line 186
- `captureText?: () => string;` at line 189

Observation: `WindowRecord` is where per-window input and capture capability actually lives today.

## Pass-Through Wrappers In `AppController`

### Public methods that only delegate to `windowManager`

- `focusWindowById` at lines 1961-1963
- `moveWindowById` at lines 1965-1967
- `resizeWindowById` at lines 2014-2016
- `closeWindowById` at lines 2018-2020

### Constructor wiring for `ControlApiService`

File: `spikes/ts-tui-mvp/src/core/app-controller.ts`

- `focusWindowById: (id) => this.focusWindowById(id)` at line 172
- `moveWindowById: (id, left, top) => this.moveWindowById(id, left, top)` at line 173
- `resizeWindowById: (id, width, height) => this.resizeWindowById(id, width, height)` at line 174
- `closeWindowById: (id) => this.closeWindowById(id)` at line 175
- `sendWindowInput: (id, input) => this.sendWindowInputById(id, input)` at line 176
- `writeEditorText: (id, text) => this.writeEditorTextById(id, text)` at line 177
- `captureWindowText: (id, name) => this.captureWindowTextById(id, name)` at line 178

### `TuiToolContext` wrappers

File: `spikes/ts-tui-mvp/src/core/app-controller.ts`

- `closeWindow: (id) => this.windowManager.closeWindowById(id)` at line 426
- `moveWindow: ...` wrapper at lines 427-433
- `focusWindow: (id) => this.windowManager.focusWindowById(id)` at line 434
- `sendWindowInput` wrapper at lines 435-440
- `writeEditorText` wrapper at lines 450-456
- `captureWindowText` wrapper at lines 457-459

Only `closeWindow` and `focusWindow` are pure pass-throughs. The others adapt behavior.

### `WorkspaceRestoreActions` wrappers

File: `spikes/ts-tui-mvp/src/core/app-controller.ts`

- `getLastWindow: () => this.windowManager.getWindows().at(-1)` at line 1876
- `moveWindow: (id, left, top) => this.windowManager.moveWindow(id, left, top)` at line 1877
- `resizeWindow: (id, width, height) => this.windowManager.resizeWindow(id, width, height)` at line 1878

## Consumer Map

- `ControlApiService` consumes `ControlApiHandlers` via its constructor in `spikes/ts-tui-mvp/src/services/control-api.ts:70`. `AppController` builds that handler object at `spikes/ts-tui-mvp/src/core/app-controller.ts:151-179`.
- `WibWobAgentSession` consumes `TuiToolContext` through its constructor at `spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts:239`, then calls `createTuiTools(this.tuiContext)` at `spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts:259`.
- `restoreWindowSnapshot` consumes `WorkspaceRestoreActions` at `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts:120`. `AppController.loadWorkspaceNamed` assembles that object at `spikes/ts-tui-mvp/src/core/app-controller.ts:1841-1879`.
- `AppController` itself consumes `WindowManager` directly throughout the file for internal UI behaviors.
- `WindowRecord` capability hooks are consumed by:
  - `WindowManager.focusWindowById` and `closeWindowById` through `record.focus()` and `record.close()` at `spikes/ts-tui-mvp/src/core/window-manager.ts:287-303`
  - `AppController.sendWindowInputById` through `window.writeInput` at `spikes/ts-tui-mvp/src/core/app-controller.ts:1969-1976`
  - `AppController.captureWindowTextById` through `window.captureText` at `spikes/ts-tui-mvp/src/core/app-controller.ts:1986-1999`
  - `TuiToolContext.sendWindowInput` and `captureWindowText` wrappers at `spikes/ts-tui-mvp/src/core/app-controller.ts:435-459`

## Semantic Differences Across “Same” Operations

### Move

- `WindowManager.moveWindow(id, left, top): boolean` only moves.
- `AppController.moveWindowById(id, left, top): boolean` is a thin alias for the manager version.
- `TuiToolContext.moveWindow(id, left, top, width?, height?): boolean` is a combined move-and-optional-resize operation.
- `WorkspaceRestoreActions.moveWindow(id, left, top): void` discards success/failure.

### Resize

- `WindowManager.resizeWindow(id, width, height): boolean` reports failure.
- `WorkspaceRestoreActions.resizeWindow(id, width, height): void` hides failure.
- `TuiToolContext` has no separate resize method; resize is folded into `moveWindow`.

### Focus

- `WindowManager.focusWindow(record: WindowRecord): void` is record-based and internal.
- `WindowManager.focusWindowById(id): boolean` is id-based.
- `TuiToolContext.focusWindow(id): boolean` matches the id-based variant but changes naming.
- `WindowRecord.focus(): void` is the per-window primitive that the manager delegates to.

### Close

- `WindowManager.closeWindowById(id): boolean` is manager-level.
- `TuiToolContext.closeWindow(id): boolean` matches behavior but changes naming.
- `WindowRecord.close(): void` is the underlying per-window primitive.

### Send Input

- `ControlApiHandlers.sendWindowInput` and `TuiToolContext.sendWindowInput` both return `boolean`.
- The implementation is not on `WindowManager`; both wrappers inspect `WindowRecord.writeInput`.
- No shared manager method exists today.

### Capture Text

- `TuiToolContext.captureWindowText(id): string | undefined` returns in-memory text.
- `AppController.captureWindowTextById(id, name?): string | undefined` returns a filesystem path after writing a capture file.
- `ControlApiHandlers.captureWindowText(id, name?): string | undefined` therefore means “export capture and return path,” not “return text.”
- `WindowRecord.captureText(): string` is the actual raw text producer.

This is the largest semantic mismatch in the current design.

## Bugs And Inconsistencies

### 1. Workspace restore is still race-prone for async window opens

`WorkspaceRestoreActions` explicitly allows async openers:

- `openTerminalWindow: () => void | Promise<void>` at `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts:111`
- `openXTermShellWindow: () => void | Promise<void>` at `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts:112`
- `openPiChatWindow: () => void | Promise<void>` at `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts:113`

But `restoreWindowSnapshot` is synchronous and immediately does:

- `const restored = actions.getLastWindow();` at `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts:226`
- `actions.moveWindow(...)` at line 228
- `actions.resizeWindow(...)` at line 229

For async opens, `getLastWindow()` can point to the wrong window or `undefined`. This is a hidden dependency the PRD does not call out.

### 2. `TuiToolContext.moveWindow` can silently ignore partial resize requests

The tool schema exposes `width` and `height` independently in `spikes/ts-tui-mvp/src/services/agent-tools.ts:156-160`, but the wrapper only resizes when both are present at `spikes/ts-tui-mvp/src/core/app-controller.ts:429-430`. A request with only `width` or only `height` is accepted by the schema, reported as `"moved"`, and the resize half is dropped.

### 3. Capture semantics differ by consumer

- Agent tools expect raw text at `spikes/ts-tui-mvp/src/services/agent-tools.ts:213-214`.
- Control API exports to disk through `AppController.captureWindowTextById` at `spikes/ts-tui-mvp/src/core/app-controller.ts:1986-1999`.
- `GET /windows/text` also performs that export side effect at `spikes/ts-tui-mvp/src/services/control-api.ts:183-186`.

The same logical verb means two different things: read text vs export capture.

### 4. `WorkspaceRestoreActions` hides failure from callers

`moveWindow` and `resizeWindow` are typed as `void` in `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts:119-120`, even though the underlying manager returns `boolean`. Restore logic cannot detect or log geometry application failure.

### 5. The PRD overstates what `WindowManager` already owns

The proposed interface in `docs/architecture/prd-window-facade-modularity.md:66-82` says `WindowManager` already has the full facade “mostly renaming.” That is not true:

- no `closeWindow(id)` method, only `closeWindowById`
- no `focusWindow(id)` method, only `focusWindowById` plus the internal record-based `focusWindow(record)`
- no `sendInput`
- no `writeEditorText`
- no `captureText`

Phase 1 is therefore behavior extraction, not just interface declaration.

## Fix Options With Tradeoffs

### Option A: Clean facade, adapt consumers

Recommended if the goal is an actual canonical abstraction.

```ts
export interface WindowFacade {
  getLastWindow(): WindowRecord | undefined;
  moveWindow(id: number, left: number, top: number): boolean;
  resizeWindow(id: number, width: number, height: number): boolean;
  focusWindow(id: number): boolean;
  closeWindow(id: number): boolean;
  sendInput(id: number, input: string): boolean;
  writeEditorText(id: number, text: string): boolean;
  captureText(id: number): string | undefined;
}
```

Tradeoffs:

- Pros: one clear contract; names become consistent; raw text capture is separated from export concerns.
- Pros: Control API can own file-export formatting instead of baking it into the facade.
- Cons: requires updating `agent-tools.ts` to call `moveWindow` and `resizeWindow` separately.
- Cons: requires either moving editor/input/capture logic into `WindowManager` or wrapping `WindowManager` in a dedicated facade implementation.

### Option B: Drop-in facade matching current consumers

Recommended only if minimizing migration churn matters more than API cleanliness.

```ts
export interface WindowFacade {
  getLastWindow(): WindowRecord | undefined;
  moveWindow(
    id: number,
    left: number,
    top: number,
    width?: number,
    height?: number,
  ): boolean;
  resizeWindow(id: number, width: number, height: number): boolean;
  focusWindow(id: number): boolean;
  closeWindow(id: number): boolean;
  sendWindowInput(id: number, input: string): boolean;
  writeEditorText(id: number, text: string): boolean;
  captureWindowText(id: number, name?: string): string | undefined;
}
```

Tradeoffs:

- Pros: easier adoption by `ControlApiService`, `agent-tools.ts`, and `restoreWindowSnapshot`.
- Cons: preserves the current semantic leakage and mixed responsibilities.
- Cons: `captureWindowText` still means “raw text” for one consumer and “path to exported file” for another unless the implementation stays consumer-specific.

### Option C: Split the problem into two interfaces

```ts
export interface WindowGeometryFacade {
  getLastWindow(): WindowRecord | undefined;
  moveWindow(id: number, left: number, top: number): boolean;
  resizeWindow(id: number, width: number, height: number): boolean;
  focusWindow(id: number): boolean;
  closeWindow(id: number): boolean;
}

export interface WindowContentFacade {
  sendInput(id: number, input: string): boolean;
  writeEditorText(id: number, text: string): boolean;
  captureText(id: number): string | undefined;
}
```

Tradeoffs:

- Pros: matches the current implementation split more honestly.
- Pros: lets read-only or geometry-only consumers avoid over-broad access.
- Cons: more migration work than a single facade.

## PRD Phase Review

### Phase 1

Partially correct, but understated.

- Correct: `getLastWindow()` is missing and would help restore logic.
- Missing: `WindowManager` cannot satisfy the proposed facade without adding new methods for input, editor writes, and text capture.
- Missing: `focusWindow(record)` collides semantically with proposed `focusWindow(id)`.
- Hidden dependency: editor writes currently rely on `renderEditor` in `AppController`, not on `WindowManager`.

### Phase 2

Direction is correct, but the current restore API should be made async first.

- `restoreWindowSnapshot` must either become `async` and await async openers, or the opener callbacks must return the created `WindowRecord`.
- Passing only a facade does not solve the existing `getLastWindow()` race by itself.

### Phase 3

Correct in spirit, but not a pure injection change.

- `TuiToolContext.moveWindow` is not equivalent to the manager contract.
- The tool layer must either validate `width` and `height` as an all-or-nothing pair or expose a separate resize tool.
- `captureText` should return raw text here; the tool consumer does not need file export.

### Phase 4

Incomplete.

- The PRD only calls out replacing the four geometry methods in `ControlApiHandlers` at `docs/architecture/prd-window-facade-modularity.md:115-123`.
- `sendWindowInput`, `writeEditorText`, and `captureWindowText` are also duplicated control-surface methods and need the same treatment or an explicit reason to stay outside the facade.
- Control API capture/export behavior should be handled at the service layer, not forced into the facade shape.

### Phase 5

Mostly correct after the earlier phases are fixed.

- The public `*ById` family can go away once consumers stop depending on `AppController` as the broker.
- The line reduction estimate is plausible, but only after replacing both the public methods and the constructor-time wrapper lambdas.

### Missing migration steps

- Add an async-safe restore path before any facade swap.
- Decide whether `captureText` means raw text or exported file path.
- Decide whether editor rendering moves into the facade implementation or stays in an adapter over `WindowRecord`.
- Add a compatibility adapter for agent tools if the move+resize combo is removed.

## Risks And Tests To Add

### Risks

- Breaking `ControlApiService` capture behavior if `captureText` is normalized to raw text without re-adding export logic.
- Breaking agent tools if `moveWindow` loses the combined move+resize behavior without tool updates.
- Reintroducing workspace restore geometry bugs if async terminal opens are not handled first.
- Pulling editor mutation into `WindowManager` may couple it to editor service logic that currently lives in `AppController`.

### Tests To Add

- Contract test for facade semantics:
  - missing window id returns `false` for move/resize/focus/close/sendInput/writeEditorText
  - unreadable windows return `undefined` for capture
- Agent tool test for `tui_move_window`:
  - move only
  - move plus resize
  - width-only and height-only requests should fail validation or be rejected explicitly
- Control API test for capture routes:
  - `GET /windows/text`
  - `POST /windows/text/export`
  - confirm whether response is raw text or exported path and keep it consistent
- Workspace restore integration test:
  - restore normal windows and async terminal windows
  - verify restored geometry and focus are applied to the intended window
- Regression test for editor writes:
  - `writeEditorText` updates buffer contents and causes a render-visible change

## Recommended Minimal Facade

If the goal is the smallest sane interface after consumer cleanup, use Option A:

```ts
import type { WindowRecord } from "./types.js";

export interface WindowFacade {
  getLastWindow(): WindowRecord | undefined;
  moveWindow(id: number, left: number, top: number): boolean;
  resizeWindow(id: number, width: number, height: number): boolean;
  focusWindow(id: number): boolean;
  closeWindow(id: number): boolean;
  sendInput(id: number, input: string): boolean;
  writeEditorText(id: number, text: string): boolean;
  captureText(id: number): string | undefined;
}
```

That is not a drop-in shape for the current code. It is the smallest coherent target once:

- agent tools stop overloading `moveWindow` with resize
- Control API owns file export separately from text capture
- restore becomes async-safe
- `WindowManager` gains or is wrapped by an implementation for input/editor/capture operations
