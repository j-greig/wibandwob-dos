# WindowFacade Migration Full Review

Scope reviewed:

- `spikes/ts-tui-mvp/src/core/window-facade.ts`
- `spikes/ts-tui-mvp/src/core/window-manager.ts`
- `spikes/ts-tui-mvp/src/core/app-controller.ts`
- `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts`
- `spikes/ts-tui-mvp/src/services/control-api.ts`
- `spikes/ts-tui-mvp/src/services/agent-tools.ts`
- `docs/architecture/prd-window-facade-modularity.md`

TypeScript verification:

- `bun run typecheck` in `spikes/ts-tui-mvp` passes cleanly.

## Findings

### 1. PRD success criterion 6 is not fully met: empty captured text is treated as failure in the control API

Files:

- `spikes/ts-tui-mvp/src/services/control-api.ts:182`
- `spikes/ts-tui-mvp/src/services/control-api.ts:321`

Evidence:

- `GET /windows/text` does `ok: Boolean(text)`.
- `POST /windows/text/export` does `if (!text) return { ok: false, path: null }`.

Impact:

- A readable window that legitimately captures `""` is reported as failure on `/windows/text`.
- The export route refuses to export empty-but-valid captured text.
- This is a semantic leak from truthiness checks, not from the facade itself. The facade returns raw text correctly, but the control API misinterprets it.

Root cause:

- The migration moved file export out of the facade correctly, but the control API still conflates `undefined` with empty string.

Fix options:

1. Preferred: treat only `undefined` as failure.
   - Change `Boolean(text)` to `text !== undefined`.
   - Change `if (!text)` to `if (text === undefined)`.
   - Tradeoff: minimal change, preserves raw-text semantics exactly.
2. Alternative: return richer capture status from the facade.
   - Example: `{ ok: boolean, text?: string }`.
   - Tradeoff: stronger semantics, but it expands the facade and violates the PRD's simpler contract.

Risks:

- Existing callers may currently assume empty text means unreadable; this change could alter edge-case behavior.

Tests to add:

- `/windows/text` returns `{ ok: true, text: "" }` when `captureText` returns empty string.
- `/windows/text/export` writes an empty file and returns success when `captureText` returns empty string.
- `/windows/text` returns failure only when `captureText` returns `undefined`.

### 2. PRD Phase 3 tool-schema requirement is not met: `tui_move_window` still silently drops partial resize requests

File:

- `spikes/ts-tui-mvp/src/services/agent-tools.ts:138`

Evidence:

- Schema declares `width` and `height` independently optional.
- Execution only resizes when both are present:
  `if (params.width !== undefined && params.height !== undefined) { ... }`

Impact:

- A tool call with `width` only or `height` only succeeds as `"moved"` and silently ignores the resize half.
- This is the exact failure mode the PRD called out and said to reject at the schema level.

Root cause:

- The migration split execution into `moveWindow` plus `resizeWindow`, but it did not finish the schema/validation update that was supposed to make partial resize requests invalid.

Fix options:

1. Preferred: enforce the invariant in the schema/tool layer.
   - Keep `width` and `height` both absent for move-only.
   - Reject one-sided resize requests before execution.
   - Tradeoff: needs either a union schema or explicit validation logic, but matches the PRD.
2. Minimal: keep the current schema and add a runtime error for partial resize.
   - Example: return `"width and height must be provided together"`.
   - Tradeoff: behavior becomes correct, but the schema remains over-permissive.

Risks:

- Agents or scripts may already be sending partial resize arguments and currently getting a misleading success response.

Tests to add:

- `tui_move_window` with `width` only is rejected.
- `tui_move_window` with `height` only is rejected.
- `tui_move_window` move-only calls `moveWindow` and not `resizeWindow`.
- `tui_move_window` move+resize calls `moveWindow` then `resizeWindow`.

### 3. PRD Phase 2 async-restore race is still present

Files:

- `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts:237`
- `spikes/ts-tui-mvp/src/core/workspace-snapshots.ts:113`

Evidence:

- Async openers still return `void | Promise<void>`:
  `openTerminalWindow`, `openXTermShellWindow`, `openPiChatWindow`.
- `restoreWindowSnapshot()` still applies geometry by calling:
  `const restored = actions.windows.getLastWindow()`
  and then moving/resizing that window.

Impact:

- If a restore opener completes asynchronously after another window opens, `getLastWindow()` can target the wrong window.
- The migration removed move/resize from `WorkspaceRestoreActions`, but it did not solve the race the PRD explicitly identified.

Root cause:

- The refactor collapsed interfaces but kept the old "open first, then discover the restored window by last-opened identity" algorithm.

Fix options:

1. Preferred: make restore openers return the created `WindowRecord` or `Promise<WindowRecord>`.
   - `restoreWindowSnapshot` can then move/resize the exact restored window.
   - Tradeoff: more invasive signature changes, but it actually fixes the race and matches the PRD.
2. Alternative: let openers accept geometry and apply it internally during creation.
   - Tradeoff: avoids `getLastWindow()`, but spreads geometry behavior back across many opener implementations, weakening the "one place for window semantics" goal.
3. Minimal: await async openers before reading `getLastWindow()`.
   - Tradeoff: only safe if each opener resolves after the window is registered. Still weaker than returning the exact record.

Risks:

- Workspace restore can misplace or resize the wrong window under concurrent/asynchronous restore paths.

Tests to add:

- Restore with an async opener followed by another window open still applies geometry to the intended window.
- Restore returns the created window record for async openers.
- A regression test for `getLastWindow()` no longer being relied on for async restore identity.

### 4. Old migration names still exist as orphaned aliases/helpers

Files:

- `spikes/ts-tui-mvp/src/core/window-manager.ts:301`
- `spikes/ts-tui-mvp/src/core/window-manager.ts:310`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:143`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:2006`

Evidence:

- `WindowManager` still exposes `focusWindowById()` and `closeWindowById()` as aliases.
- `AppController` still uses a private `writeEditorTextById()` helper for the editor write hook.

Impact:

- No immediate functional bug found.
- The interface reduction is mostly complete, but old naming remains in implementation seams and can confuse future edits.

Root cause:

- The migration removed public bridge methods and external interface duplication first, but did not do a final cleanup pass on internal alias/helper naming.

Fix options:

1. Preferred: rename the private helper and remove dead aliases if no longer needed.
   - Example: `writeEditorTextById` -> `writeEditorText`.
   - Remove `focusWindowById` / `closeWindowById` once all internal call sites use the final names.
   - Tradeoff: small cleanup, low risk.
2. Keep aliases as compatibility shims temporarily.
   - Tradeoff: lower churn now, but leaves the old contract vocabulary in active code.

Risks:

- Future contributors may reintroduce split interfaces or call the alias methods directly.

Tests to add:

- None required for the rename itself beyond existing facade contract coverage.

## Success Criteria Check

1. `WorkspaceRestoreActions` contains zero move/resize ops: **PASS**
   - The interface now keeps only open-window callbacks plus `windows: WindowFacade`.

2. `TuiToolContext` contains zero window-op re-declarations: **PASS**
   - It now exposes `windows: WindowFacade` instead of duplicating close/focus/move/send/capture methods.

3. `ControlApiHandlers` contains zero window-op callbacks: **PASS**
   - Window operations are routed through `handlers.windows`.

4. `AppController` has zero public `*ById` bridge methods: **PASS**
   - No public `*ById` bridge methods remain.
   - Note: a private `writeEditorTextById()` helper still exists.

5. A change to `moveWindow` semantics requires editing exactly one file: **PASS, with one caveat**
   - Callers in `control-api.ts`, `agent-tools.ts`, and `workspace-snapshots.ts` call `windows.moveWindow(...)` without duplicating move logic.
   - The caveat is that `agent-tools.ts` still contains separate tool-level resize coupling logic, so move semantics are centralized but move-plus-resize request validation is not fully correct.

6. `captureText` means raw text everywhere; file export is only a control API concern: **PARTIAL FAIL**
   - The facade path is raw-text only, which is correct.
   - The control API export path owns file writing, which is correct.
   - But the control API interprets empty raw text as failure, so the end-to-end raw-text semantics are not preserved correctly.

7. TypeScript compiles clean: **PASS**
   - Verified via `bun run typecheck`.

## Additional Checks

### Orphaned references to old interface fields

Found:

- `focusWindowById` alias remains in `window-manager.ts`.
- `closeWindowById` alias remains in `window-manager.ts`.
- `writeEditorTextById` private helper remains in `app-controller.ts`.

Not found:

- No remaining old `ControlApiHandlers` window-op callback fields.
- No remaining old `TuiToolContext` window-op fields.
- No remaining `captureWindowText` / `sendWindowInput` style external interface fields in the reviewed runtime code.

### `/windows/text` raw text behavior

Current result:

- It calls `handlers.windows.captureText(id)` directly, which is correct.
- It returns the raw `text` field, but `ok` is wrong for empty string because it uses `Boolean(text)`.

Conclusion:

- Raw text wiring is correct.
- Success/failure reporting is wrong for empty-string captures.

### `/windows/text/export` file export behavior

Current result:

- File writing now lives in `ControlApiService`, which matches the PRD.
- It is still wrong for empty-string captures because `if (!text)` treats empty text as unreadable.

Conclusion:

- Ownership is correct.
- Empty-text semantics are wrong.

### `tui_move_window` split into `moveWindow` + `resizeWindow`

Current result:

- The tool does call `moveWindow()` first and `resizeWindow()` second.
- That split is architecturally correct.
- The validation layer is incomplete because partial resize requests are silently accepted and partially ignored.

Conclusion:

- Split execution: correct.
- Request validation / contract: incorrect.

### Regressions from the `focusWindowInternal` rename

Current result:

- No regressions found in the reviewed call graph.
- Internal record-based focus flows now route through `focusWindowInternal(record)`.
- External id-based callers route through `focusWindow(id)`.

Conclusion:

- No direct regression found from the rename itself.
- The remaining `focusWindowById` alias is cleanup debt, not a confirmed behavioral bug.

## Overall Root Cause

The migration succeeded at reducing duplicated interfaces, but several PRD goals were only completed at the shape level. The remaining issues come from semantic cleanup not being carried through:

- truthiness checks were left in place after `captureText` became raw-text-only,
- the tool schema was not tightened after splitting move and resize,
- and the workspace restore implementation kept the old `getLastWindow()` identity strategy, so the async race described in the PRD still exists.

## Recommended Next Step Order

1. Fix `control-api.ts` empty-text handling.
2. Fix `agent-tools.ts` partial resize validation.
3. Finish the restore race fix by making restore openers return the actual restored window, or by pushing geometry application into the opener.
4. Remove leftover old-name aliases/helpers.
