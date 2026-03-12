---
subsystem: workspace
covers: WorkspaceService, workspace save/restore flow, WindowSnapshot schema, default.json
files:
  - src/services/workspace-service.ts
  - src/core/app-controller.ts (saveWorkspace, restoreWorkspace, boot restore)
  - src/core/types.ts (WindowSnapshot)
triggers:
  pre-change: WindowSnapshot schema, restoreFromState, workspace save/load flow
  post-change: save then reload app, verify windows restore at correct positions with correct content
---

## Overview

WorkspaceService handles named JSON workspace files in scratch/workspaces/.
On boot, app-controller restores the default workspace. Windows serialise themselves via
describeState() and restore via per-kind factory functions. The restore flow is synchronous
per window but async callbacks exist; race conditions are the most common failure mode.

## Key Files

- src/services/workspace-service.ts — save(), load(), list(), exists(), path getter
- src/core/app-controller.ts:394 — boot restore (restoreFromWorkspace)
- src/core/app-controller.ts:1719 — loadWorkspace (runtime load)
- src/core/types.ts — WindowSnapshot interface

## Snapshot Schema

Workspace file on disk (scratch/workspaces/<name>.json):

  {
    "version": 2,
    "theme": "wibwob-dark",        // optional — applied on load
    "windows": [WindowSnapshot]
  }

WindowSnapshot — one entry per open window:

  {
    kind: WindowKind,              // "editor", "primer", "browser", etc.
    appType: AppType,              // used to select the restore factory
    title: string,
    left: number,
    top: number,
    width: number,
    height: number,
    focused: boolean,
    filePath?: string,             // for file-backed windows
    details: WindowStateDetails    // window-specific extras (scrollPos, content, etc.)
  }

Backward compat: old files are bare WindowSnapshot[] (no version/theme envelope).
WorkspaceService.load() handles both shapes — workspace-service.ts:32.

Default workspace path: scratch/workspaces/default.json
Alt instance path: scratch/alt/workspaces/default.json (SCRATCH_DIR env)

## Save Flow

1. app-controller calls windowManager.getWindows() to get all WindowRecords
2. For each record: calls record.describeState?.() to get WindowStateDetails
3. Builds WindowSnapshot from record geometry (frame.left/top/width/height) + details
4. WorkspaceService.save(snapshots, currentTheme) writes to <workspaceDir>/<name>.json
5. Transient window types (command-palette, workspace-manager etc) are excluded from save

Windows that don't implement describeState() are saved with minimal state and may not
restore correctly (appType will be missing from details).

## Restore Flow

1. On boot: app-controller checks workspaceService.exists() for default
2. Loads WorkspaceFile via workspaceService.load()
3. If theme present: applies theme before creating windows
4. For each WindowSnapshot in order: calls per-kind restore factory
5. The factory that gets the snapshot is determined by snapshot.kind (not appType)
6. One window is marked focused: after all windows created, focused window gets focus()

Restore factories are registered in app-controller per WindowKind:
  "editor"    → restoreEditorWindow(snapshot)
  "primer"    → restorePrimerWindow(snapshot)
  "browser"   → restoreFinderWindow(snapshot) or restoreBackroomsWindow etc
  "markdown-viewer" → restoreMarkdownWindow(snapshot)
  etc.

RACE CONDITION: if a restore factory is async and calls focus() before all windows are
created, the focused window tracking gets confused. Keep restore factories synchronous
where possible. If async, only call focus() after the full restore loop completes.

## Default Workspace Behaviour

- If scratch/workspaces/default.json does not exist: app starts with Scramble popup only
- If the file is corrupt or version mismatched: app logs error and starts clean
- Alt instance (SCRATCH_DIR=scratch/alt): uses scratch/alt/workspaces/default.json;
  will NOT share workspace state with main instance

## Invariants

1. describeState() MUST return { appType } — workspace restore uses appType to select factory
2. Window geometry at save time is frame.left/top/width/height (integers, pixels) — NOT blessed % values
3. version:2 envelope is the current format; v1 (bare array) is read-only compat
4. WorkspaceService.sanitizeName() lowercases and strips special chars — "My Workspace" → "my-workspace"
5. Only persistable window types (PersistableAppType) should be saved — transient types must be excluded
6. The workspace directory is created automatically by save() if missing

## Failure Modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Windows don't restore on boot | default.json missing or corrupt | Check scratch/workspaces/default.json exists and is valid JSON |
| Window restores at wrong position | Frame geometry saved as blessed "%" strings instead of integers | Ensure Number(frame.left) used at save time, not raw frame.left |
| Window type missing after restore | describeState() not implemented or returns wrong appType | Implement describeState() returning exact AppType string |
| Theme not restored | theme field missing from WorkspaceFile | Ensure app-controller passes currentTheme to workspaceService.save() |
| Focused window wrong after restore | focus() called mid-restore before all windows created | Move focus() call to after the full restore loop |
| Alt instance restores main workspace | SCRATCH_DIR env not set for alt instance | Set SCRATCH_DIR=scratch/alt when starting alt instance |
| Workspace name mangled | Special chars in name | WorkspaceService.sanitizeName() is intentional — use kebab-case names |

## Do / Don't

DO: implement describeState() on every persistable window — it is the only source of truth for restore
DON'T: skip describeState() and hope kind alone is enough — appType is required

DO: save Number(frame.left), Number(frame.top), Number(frame.width), Number(frame.height)
DON'T: save blessed % or string values — they don't round-trip correctly

DO: exclude transient window types from workspace snapshots
DON'T: save command-palette, workspace-manager, state-inspector — they should not persist

DO: verify restore with a real restart after any snapshot schema change
DON'T: only test save — save can succeed while restore silently produces wrong windows

DO: use workspaceService.list() to enumerate available workspaces in the UI
DON'T: read the workspaces directory directly — list() handles missing dir gracefully

## Branch and Planning Discipline (from agentic-devlog 2026-03-10)

These are not workspace bugs but were the most repeated agent failures in the session
logs. They belong here because they affect save/restore state correctness and commit hygiene.

### Always check branch before any code change

Three times during E028 sessions, an agent was on `main` instead of the epic branch.
Files were committed to wrong branches. Module directories vanished after wrong-branch reverts.

BEFORE any edit, run/confirm:

  git branch --show-current     → must match current epic (e.g. epic/e028-canvas-documents)

If on main: `git checkout <epic-branch>` BEFORE any edit. Do not edit on main.

### planning:sync must run after any .planning/epics/ change

EPIC_STATUS.md drifts silently if planning:sync is not run after closing/updating epics.
After any edit to .planning/epics/*/e*-brief.md: run `bun run planning:sync`.
After merging an epic to main: run `bun run planning:sync` and commit the result.
This is a hook candidate — pre-commit hook on .planning/epics/ should auto-run it.

### content-loader.ts — do not rewrite what already exists

Before writing any YAML/panel parsing: check modules/sy2-chronicles/content-loader.ts.
It already exports loadCanvas() for .canvas.yaml files.
panel-layout.ts, panel-types.ts, grid-canvas.ts — all exist. Read before writing.

## Change Checklist

When changing WindowSnapshot schema:
- [ ] Update types.ts WindowSnapshot interface
- [ ] Update save path in app-controller (collect new field from describeState/record)
- [ ] Update all restore factories to read new field from snapshot
- [ ] Test: save → restart → verify restored window has new field applied
- [ ] Consider backward compat for old workspace files missing the new field

When adding a new persistable window type:
- [ ] Add to PersistableAppType in types.ts
- [ ] Implement describeState() returning the new appType + any restore-needed fields in details
- [ ] Add restore factory in app-controller keyed to the new kind/appType
- [ ] Test full round-trip: open → save → restart → verify restored

## Agent Notes
<!-- Append-only. Agents write here during sessions using their edit tool.
     Do not modify the spec body directly. Human consolidates into body quarterly.
     Format: one row per finding. Types: failure-mode | invariant | correction | gotcha | do-dont -->

| Date | Type | Subsystem | Finding | Triggered by |
|------|------|-----------|---------|--------------|
