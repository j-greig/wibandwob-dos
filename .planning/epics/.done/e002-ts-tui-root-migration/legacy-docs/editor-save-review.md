# Editor Save Review

Reviewed against `docs/development/spike-editor-save.md`.

## Verdict

The implementation does not satisfy all acceptance criteria.

- Menu, palette, and editor context-menu wiring are present.
- The duplicate `writeEditor` method in `app-controller.ts` is gone.
- The title asterisk survives normal resize/re-render because `WindowManager` does not rebuild or overwrite `titleBar` content during focus, move, resize, tile, or cascade.
- `Save As` cancel is safe: `OverlayManager.openPathPrompt()` only invokes `onSubmit` on non-empty submit, and `Esc`/cancel only closes the prompt.

The remaining gaps are below.

## Findings

### 1. Dirty untitled buffers default to saving as `*Untitled.txt`

Files:

- `spikes/ts-tui-mvp/src/services/file-actions.ts:91`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:1765`

Root cause:

`markEditorDirty()` mutates `window.title` to include a leading `*`. The untitled `Save` path then uses `path.join(params.defaultDir, params.window.title)` as the prompt default without stripping that marker.

Impact:

- `Ctrl-S` on a dirty untitled buffer suggests a filename like `.../*Untitled.txt`.
- If the user accepts the default, the file is written with the `*` in the real filename.
- This affects the main `Save` flow and the editor context-menu `Save` action because both go through `saveEditorWindow()`.

Acceptance criteria impact:

- `"Ctrl-S on an untitled editor prompts for path, writes, renames title"` is only partially satisfied. It writes, but the default path is wrong once the dirty indicator is active.

Fix options:

1. Keep `window.title` as the canonical filename/title and derive the dirty marker only when rendering `titleBar`.
Tradeoff: slightly more code, but it cleanly separates display state from file identity.

2. Keep the current title mutation approach, but strip `^\*` everywhere a filesystem path or basename is derived.
Tradeoff: smaller patch, but fragile because every future path/title use must remember to sanitize.

Recommended:

Option 1.

### 2. Dirty indicator misses one real editor mutation path

Files:

- `spikes/ts-tui-mvp/src/core/app-controller.ts:456`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:2037`

Root cause:

There are two programmatic editor-write paths:

- `writeEditorTextById()` marks dirty.
- The `TuiToolContext.writeEditorText` implementation inside `openWibWobAgentWindow()` inserts text and re-renders, but does not call `markEditorDirty()`.

Impact:

- Agent/tool-driven editor writes can change buffer contents without setting `isDirty` or the `*` title marker.
- `lastSavedContent` becomes stale relative to the visible buffer.

Acceptance criteria impact:

- The stretch AC `"Title bar shows asterisk when buffer has unsaved changes"` is not fully satisfied for all supported mutation paths.

Fix options:

1. Route every programmatic write through `writeEditorTextById()`.
Tradeoff: best consistency, smallest long-term risk.

2. Duplicate the dirty-marking call in the agent context path.
Tradeoff: smaller local change, but keeps two write implementations that can drift again.

Recommended:

Option 1.

### 3. Save/Save As mutate window identity before the write is known to succeed

Files:

- `spikes/ts-tui-mvp/src/services/file-actions.ts:97`
- `spikes/ts-tui-mvp/src/services/file-actions.ts:100`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:1593`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:1597`

Root cause:

Both save flows update `window.filePath` / `window.title` before or alongside `fs.writeFileSync()`, and neither path catches I/O errors.

Impact:

- If `mkdirSync` or `writeFileSync` throws, the buffer may now point at a new `filePath` and title even though nothing was saved.
- The exception can bubble out of the UI callback path and break the current interaction.

Save As cancel behavior:

- Cancel itself is correct.
- Failure after submit is not correct: the state transition is not atomic.

Fix options:

1. Resolve the path, attempt directory creation + write in `try/catch`, and only then commit `window.filePath`, `window.title`, and clean-state updates.
Tradeoff: slightly more code, correct behavior.

2. Keep the current order but roll back `window.filePath` and `window.title` in `catch`.
Tradeoff: more error-prone than committing state only after success.

Recommended:

Option 1.

### 4. `lastSavedContent` is currently write-only

Files:

- `spikes/ts-tui-mvp/src/core/app-controller.ts:1557`
- `spikes/ts-tui-mvp/src/core/app-controller.ts:1761`
- `spikes/ts-tui-mvp/src/core/types.ts:185`

Root cause:

`lastSavedContent` is initialized and updated on save, but nothing reads it. Dirty state is a one-way boolean toggled on first mutation and cleared only on save.

Impact:

- There is no path to clear the dirty state when content returns to the last-saved value.
- If undo is added later, or any API starts replacing editor content wholesale, the current model will misreport dirtiness unless every caller manually manages `isDirty`.

Current status on the requested cases:

- Paste: no dedicated paste handler exists; ordinary inserted text goes through dirty-marking paths.
- Undo: no undo implementation was found.
- Control API write (`writeEditorTextById`): correctly marks dirty.
- Agent tool write (`TuiToolContext.writeEditorText`): missed, see Finding 2.

Fix options:

1. Make dirty state derived: `window.isDirty = window.editor.value !== window.lastSavedContent`.
Tradeoff: more robust semantics; slightly more comparisons.

2. Keep imperative `isDirty`, but remove `lastSavedContent` until it is actually used.
Tradeoff: simpler current code, but weaker foundation for undo/revert semantics.

Recommended:

Option 1 if the stretch dirty indicator is meant to be durable.

## Acceptance Criteria Check

- `Alt-F` File menu contains `Save` and `Save As`: yes.
- `Ctrl-S` on an untitled editor prompts for path, writes, renames title: not fully. Dirty untitled buffers default to `*Untitled.txt`.
- `Ctrl-S` on a named file writes silently, flashes confirmation: yes in the happy path.
- `Save As` always prompts regardless of existing path: yes.
- Command palette includes `Save File` and `Save File As`: yes.
- Right-click on editor shows save actions: yes.
- Title bar shows asterisk for unsaved changes and clears on save: partially. Keyboard edits and control-API writes mark dirty; the agent tool write path does not.
- No duplicate `writeEditor` logic remains in `app-controller.ts`: yes. No `writeEditor` references remain there; only `writeEditorWindow()` exists in `file-actions.ts`.

## Risks And Tests To Add

1. Add a test for dirty untitled save defaults.
Expected: after typing into a fresh untitled editor, `Save` suggests `Untitled.txt`, not `*Untitled.txt`.

2. Add a test for `Save As` cancel.
Expected: cancel leaves `filePath`, `title`, `isDirty`, and editor content unchanged.

3. Add a test for failed writes.
Expected: if `mkdir`/write fails, the window keeps its previous `filePath`/title and remains dirty; the UI surfaces an error flash.

4. Add a test for every editor mutation entry point.
Cover:
`handleFocusedEditorKeypress()` text insert/delete,
`writeEditorTextById()`,
agent `TuiToolContext.writeEditorText()`.

5. Add a test for dirty-title persistence across resize/tile/cascade/repaint.
Expected: once dirty, the `*` remains visible after window-manager layout changes.

6. Add a regression test for workspace round-trip if dirty titles are serialized.
Expected: restoring a clean editor should not rehydrate a literal `*` into the canonical title.
