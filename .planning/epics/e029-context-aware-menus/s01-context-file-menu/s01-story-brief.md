---
id: S01
epic: E029
title: Context-aware File menu (appTypes filter)
status: not-started
branch: epic/e029-context-aware-menus
worktree: ~/Repos/wibwob-e029-context-aware-menus
spike: spk-context-file-menu
---

# S01 — Context-aware File menu

## What and why

The File menu today shows nine items regardless of which window is focused.
Add an `appTypes` field to `MenuPlacement` and filter dropdown items at
open-time so each app type sees only the actions that apply to it.

Follows the same pattern as contextMenu's existing `windowKinds` filter
(command-registry.ts:219). No menu bar rebuild needed — the dropdown is
created fresh on every open.

## Acceptance criteria

- [ ] `MenuPlacement` has optional `appTypes?: AppType[]` field
      (command-catalog.ts — interface definition)
- [ ] All File-category commands annotated with correct appTypes per the
      four profiles below, or left unscoped (global fallback)
- [ ] menu-overlay-manager reads focused window appType at dropdown-open
      time and filters items accordingly
- [ ] No focused window → global fallback (all unscoped items shown —
      current behaviour preserved)
- [ ] `Reload Agent Prompt` scoped to `wibwob-agent` only
- [ ] `finderNewFolder` remains excluded (still a stub)
- [ ] Unit test: registry returns correct item set for
      text-editor / primer-viewer / no-focus
- [ ] Smoke: focus text-editor, Alt+F → New Editor | Open Text/Markdown |
      Save | Save As | Close | Quit
- [ ] Smoke: focus primer-viewer, Alt+F → Open Primer | Open Text | Open
      Markdown | Close | Quit
- [ ] Smoke: no focused window, Alt+F → full legacy set

## File menu profiles (from spike report)

OPEN+SAVE (text-editor, workspace-manager):
  New Editor | Open Text File... | Open Markdown File... | --
  Save | Save As... | --
  Save Workspace... | Load Workspace... | --
  Close | Quit

OPEN ONLY (primer-viewer, reader-viewer, markdown-viewer,
           farjs-file-manager, music-player, backrooms-log-browser,
           primer-browser, primer-gallery, backrooms-tv):
  Open Primer... | Open Text File... | Open Markdown File... | --
  Close | Quit

EXPORT ONLY (contour-studio, terrain-lab, generative-art):
  Save Workspace... | -- | Close | Quit

MINIMAL (figlet-banner, companion-widget, monster-cam, wibwob-agent,
         pattern-animation, command-palette, state-inspector,
         chrome-browser):
  Close | Quit
  (+ Reload Agent Prompt for wibwob-agent only)

## Files to change

1. src/core/command-catalog.ts
   — add `appTypes?: AppType[]` to `MenuPlacement` interface (~line 112)
   — annotate all File-category placements with appTypes

2. src/core/menu-overlay-manager.ts
   — inject getFocusedWindow callback
   — filter items by appType at dropdown-open time

3. src/core/command-registry.ts (maybe)
   — expose a filtered-items helper, or thread context into createMenuConfigs

## Tasks

- [ ] T1: add appTypes to MenuPlacement, annotate all file-category commands
- [ ] T2: filter in menu-overlay-manager at open time
- [ ] T3: unit test for filtered item sets
- [ ] T4: smoke (typecheck + manual open of editor/viewer/no-focus)
- [ ] T5: commit + update planning
