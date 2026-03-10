---
id: E032
title: Smart Editor — one window, mode-aware rendering
status: not-started
area: editor
---

# E032 — Smart Editor

## Problem

WibWob-DOS has two overlapping text-display surfaces:

- `text-windows.ts` → `openEditorWindow` → WindowKind `editor`, appType `text-editor`
- `markdown-viewer-window.ts` → `openMarkdownViewerWindow` → WindowKind `reader`, appType `reader`

Every IDE treats file type as a rendering signal, not a reason for a separate window.
An `.md` file opened in the editor should render with markdown formatting.
A `.py` file should open as plain editable text.
The user should never have to choose `editor.open` vs `markdown.open` — the file extension decides.

## Goal

One window type. One command (`editor.open`). Two render modes:

- **edit** — writable editor widget (current text-windows.ts behavior)
- **view** — formatted read-only scroll view (current markdown-viewer behavior)

`.md` / `.markdown` / `.mdx` files open in view mode by default.
All other files open in edit mode.
A key toggle (`e` / `v`) switches modes for any file.

`markdown.open` command becomes an alias for `editor.open` and is deprecated.
`WindowKind "reader"` (just renamed from `markdown-viewer` in E031 S21) is retired.
`markdown-viewer-window.ts` is deleted.

## Acceptance criteria

- [ ] AC-1: `editor.open` with a `.md` path opens in view mode (formatted, figlet headings optional).
- [ ] AC-2: `editor.open` with any other file opens in edit mode (current behavior).
- [ ] AC-3: `e` key in view mode switches to edit mode. `v` key in edit mode switches to view mode for .md files.
- [ ] AC-4: `WindowKind "reader"` no longer exists. Retired via legacy snapshot alias.
- [ ] AC-5: `markdown-viewer-window.ts` deleted; all imports/call sites removed.
- [ ] AC-6: `markdown.open` command and `/view/reader/open` route still work as aliases (backward compat).
- [ ] AC-7: Workspace restore: old snapshots with `appType: "reader"` and `appType: "markdown-viewer"` load as the new `text-editor` window in view mode.
- [ ] AC-8: `bun run typecheck` passes. Existing tests pass.
- [ ] AC-9: View mode status bar shows filename, scroll position, pct, key hints.
- [ ] AC-10: `h` key toggles figlet headings in view mode (matches current reader behavior).

## Out of scope

- Syntax highlighting for non-markdown files (that is a separate story).
- Live file-watch auto-reload (keep existing behavior — render on open).
- Line numbers, gutters, split panes.

## Design

### Window state

```typescript
interface EditorWindowState {
  // existing
  widget: Box;           // edit-mode editor widget
  value: string;
  cursor: number;

  // new
  viewMode?: "edit" | "view";   // undefined = always edit (non-md)
  scrollBox?: Box;               // present only when viewMode is used
  statusBar?: Box;
  figletEnabled?: boolean;
  cachedLines?: string[];
}
```

### Mode switch

Both widgets live in `frame.body` simultaneously. Only one is visible at a time
(`node.hide()` / `node.show()`). Switching modes re-renders the active widget and
calls `frame.focus()` to re-wire keyboard focus.

### appType and WindowKind

`frame.kind` is always `"editor"`. `appType` is always `"text-editor"`.
The `viewMode` is serialised into the snapshot payload alongside `filePath`.

### Snapshot backward compat

`legacyAppTypeRemap` in `snapshot-registry.ts`:
  `"reader"` → `"text-editor"` (already has `"markdown-viewer"` → `"reader"` from E031)

The `text-editor` snapshot handler reads `payload.viewMode` (defaults to `"view"`
when the file is `.md`, `"edit"` otherwise) and calls `openEditorWindow`.

## Files to change

- `src/windows/text-windows.ts` — extend with view mode logic (merge markdown-viewer)
- `src/windows/markdown-viewer-window.ts` — DELETE after migration
- `src/core/types.ts` — remove `"reader"` from `WindowKind` union
- `src/core/command-catalog.ts` — `markdown.open` becomes alias comment; keep entry
- `src/core/app-controller.ts` — retire `openMarkdownViewerWindow`, route `.md` opens through `openEditorWindow`
- `src/core/snapshot-registry.ts` — add `"reader"` → `"text-editor"` remap; update `text-editor` handler to restore viewMode
- `src/services/control-api.ts` — `/view/reader/open` kept as alias (already done in E031 S20)

## Stories

- S01: Extend editor window with view mode (merge markdown-viewer into text-windows.ts)
- S02: Retire reader WindowKind + markdown-viewer-window.ts
- S03: Snapshot backward compat for reader/markdown-viewer appTypes

## Branch

`epic/e032-smart-editor`
