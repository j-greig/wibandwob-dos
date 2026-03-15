---
id: spk-text-editor-consolidation
title: "Spike: consolidate text/editor/reader surfaces"
status: not-started
---

# Spike: Text Editor Consolidation

Investigate merging the overlapping text editing and viewing surfaces
into fewer, better components.

## Problem

Three separate engines render or edit text files:

1. Built-in Editor (editor-service.ts + text-windows.ts + editor-coordinator.ts)
   - Edit + view modes. Markdown view with figlet headings.
   - Weak editing: no gutter, no line numbers, no selection, no find, char-level undo.

2. Slap Editor (microapps/slap-editor/editor-engine.ts)
   - Edit only. Strictly better editing features: gutter, line numbers,
     selection, clipboard, find, grouped undo.
   - No file picker, no markdown view, no save-as.

3. Document Reader (browser-windows.ts openBrowserReaderWindow)
   - View only. Uses renderMarkdownFile (same as built-in editor view mode).
   - Separate window kind ("reader"), dedicated scroll keys.

## Questions to answer

- [ ] Can Slap Editor's EditorEngine replace editor-service.ts?
      What is the migration cost? What features does editor-service
      have that EditorEngine lacks?
- [ ] Can Document Reader be eliminated as a window kind?
      What would break if "reader" opened as an editor in view mode?
      What workspace snapshots reference kind:"reader"?
- [ ] Should syntax highlighting live in the editor engine or in a
      shared highlight service? markdown-service has it for code blocks
      in view mode only.
- [ ] What is the impact on commands, snapshots, agent tools, and
      the control API if window kinds are merged?

## Audit reference

Full comparison table and ASCII architecture diagrams:
  .planning/chores/menu-nav-figlet-audit/chore-audit-text-code-engines.txt

## Acceptance criteria

- [ ] Decision document: merge, keep separate, or hybrid approach
- [ ] If merge: migration plan with subtasks, risk assessment
- [ ] If keep: documented rationale and boundary rules
