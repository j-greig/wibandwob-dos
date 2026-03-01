SPIKE: Editor Save — Surface and Complete
WibWob-DOS / ts-tui-mvp
Status: DRAFT
Date: 2026-03-01


CURRENT STATE

Save IS implemented at the code level.

  Ctrl-S calls saveFocusedEditor() in app-controller.ts
  line 1541. That calls saveEditorWindow() in
  services/file-actions.ts line 81.

  If the buffer has a filePath, it writes immediately.
  If it is untitled (no filePath), it opens a path
  prompt, then writes and renames the window title.

The implementation is correct. The problems are:

  1. UNDISCOVERABLE. Save only exists as a keyboard
     shortcut. It appears in the status bar hint text
     as "Ctrl-S Save" but nowhere in the menus.

  2. FILE MENU HAS NO SAVE ITEM. The File menu in
     menu-config.ts has: Browse Primers, Open Primer,
     Open Text File, New Text Buffer, Save Workspace,
     Load Workspace, Open Art, Open Terminal, Quit.
     No Save File. No Save File As.

  3. COMMAND PALETTE HAS NO SAVE ITEM. The palette
     in createPaletteCommands has workspace saves and
     all the open-* commands. No Save File.

  4. CONTEXT MENU HAS NO SAVE ITEM. Right-clicking an
     editor window offers nothing save-related.

  5. DUPLICATE writeEditor. app-controller.ts has a
     private writeEditor() method (line 1565) that
     duplicates the logic in writeEditorWindow() in
     file-actions.ts. One of these should not exist.

  6. NO SAVE AS. There is only one save path — if a
     file has a filePath, Ctrl-S overwrites silently.
     There is no way to save a copy to a different
     location without manually clearing the path.

  7. NO DIRTY INDICATOR. Unsaved changes are invisible.
     The title bar shows "Untitled.txt" or the filename
     but gives no signal that content has changed since
     last save.


WHAT NEEDS DOING

Step 1 — Add saveFocusedEditor and saveAsFocusedEditor
to AppMenuActions interface (menu-config.ts).

Step 2 — Wire them in app-controller.ts getAppMenuActions.
  saveFocusedEditor already exists as a private method.
  saveAsFocusedEditor: temporarily clears window.filePath
  then calls saveEditor, which will prompt for a new path.

Step 3 — Add to File menu (menu-config.ts):
  After "New Text Buffer":
    { label: "Save",    action: actions.saveFocusedEditor }
    { label: "Save As", action: actions.saveAsFocusedEditor }

Step 4 — Add to command palette (menu-config.ts):
    { label: "Save File",    action: actions.saveFocusedEditor }
    { label: "Save File As", action: actions.saveAsFocusedEditor }

Step 5 — Add to editor context menu.
  The right-click context menu for editor windows should
  include Save and Save As. Look at openWindowContextMenu
  in app-controller.ts and add conditionally when
  window.kind === "editor".

Step 6 — Remove duplicate writeEditor from
  app-controller.ts. Replace its two call sites with
  calls to the saveEditor private method or directly to
  writeEditorWindow from file-actions.ts.

Step 7 (stretch) — Dirty indicator.
  Track a lastSavedContent string in the editor state
  or a isDirty boolean on WindowRecord.
  Set dirty on any keypress that modifies content.
  Clear on save.
  Show a marker in the title bar — conventional choices
  are a leading asterisk (*Untitled.txt) or a dot.
  The titleBar setContent call in writeEditorWindow is
  the right place to clear it. The keypress handler in
  handleFocusedEditorKeypress is the right place to set.


FILES TO CHANGE

  core/menu-config.ts
    AppMenuActions interface: add saveFocusedEditor,
    saveAsFocusedEditor.
    createMenuConfigs File menu: add Save, Save As items.
    createPaletteCommands: add Save File, Save File As.

  core/app-controller.ts
    getAppMenuActions: wire saveFocusedEditor (already
    exists as private method), add saveAsFocusedEditor.
    openWindowContextMenu: add Save / Save As for editors.
    Remove private writeEditor() (duplicate), update
    its two call sites.

  services/file-actions.ts
    Add saveAsEditorWindow() that accepts a window,
    clears filePath temporarily, delegates to
    saveEditorWindow. OR handle inline in controller.

  core/types.ts (stretch)
    Add isDirty?: boolean to WindowRecord.


EFFORT

  Steps 1-5: ~45 minutes. Entirely additive, low risk.
  Step 6: 20 minutes. Removes ~15 lines.
  Step 7: ~1 hour. Touches editor keypress handler,
    title bar render, and WindowRecord type.

  Total without dirty indicator: ~1 hour.
  Total with dirty indicator: ~2 hours.


ACCEPTANCE CRITERIA

  - Alt-F opens File menu, Save and Save As are present
  - Ctrl-S on an untitled editor prompts for path,
    writes, renames title
  - Ctrl-S on a named file writes silently, flashes
    confirmation
  - Save As always prompts for path regardless of
    whether file is already named
  - Command palette includes Save File and Save File As
  - Right-click on editor window shows Save option
  - (stretch) Title bar shows asterisk when buffer
    has unsaved changes, clears on save
  - No duplicate writeEditor logic remains in
    app-controller.ts
