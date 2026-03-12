---
id: spk-file-open-save-consolidation
title: "Spike: consolidate file open/save UI paths"
status: not-started
---

# Spike: File Open/Save Consolidation

Investigate standardising how users open and save files across all
applications and modules.

## Problem

Three different file-open UIs exist:

1. OverlayManager.openFileBrowserPrompt() -- modal overlay
   Used by: editor, reader, primer, music player

2. createSidebarPanel() + createSelectableList() -- sidebar file list
   Used by: zine, patchbay-lab, world-chatroom, wibwobworld

3. openFileManagerWindow() -- full dedicated Far-JS file manager
   Used by: standalone file browsing, opens files into editor

Save paths are also fragmented:
  - EditorCoordinator: save / save-as via overlay prompt
  - Slap Editor: Ctrl-S with EditorEngine.saveFile() (no save-as)
  - WibWobWorld: auto-save terrain to scratch/worlds/

## Questions to answer

- [ ] Should the Zine sidebar be replaced by File menu open?
      What is the UX tradeoff? Sidebar gives fast switching;
      File menu is cleaner but slower. Could sidebar be off by
      default, toggled on?
- [ ] Should Slap Editor get a file picker on open?
      Currently only opens via command args.
- [ ] Can we standardise a single "open file for this app" SDK
      primitive that modules call? Shape: host.openFile(opts)?
- [ ] Should save-as be added to Slap Editor, or should the
      built-in editor own all save paths?
- [ ] Is the File Manager window still needed if the overlay
      file picker is good enough?

## Audit reference

Full table of all apps with file open/save:
  .planning/chores/menu-nav-figlet-audit/chore-audit-file-open-save.txt

## Acceptance criteria

- [ ] Decision document: which UI is the primary open path, which secondary
- [ ] If consolidating: migration plan per module
- [ ] If adding SDK primitive: interface spec for host.openFile / host.saveFile
