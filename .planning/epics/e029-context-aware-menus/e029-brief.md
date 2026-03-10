---
id: E029
title: Context-Aware Menus
status: in-progress
issue: ~
pr: ~
depends_on: []
spike: spk-context-file-menu
---

# E029 — Context-Aware Menus

Make the File menu (and later Edit) reflect the focused window, like macOS.
Today every window sees the same nine-item File menu. After this epic, the
menu content matches what the focused app actually supports.

## Problem

The File menu is a static flat list built once at startup. "New Editor"
appears when you are in a primer viewer. "Open Primer Browser" appears when
you are in the text editor. "Reload Agent Prompt" appears for everyone.
None of it is filtered by the focused window's appType.

Context menus already filter by windowKinds (command-registry.ts:219).
The menu bar does not.

## Outcome

File menu items shown = the items appropriate to the focused window's appType.
No focused window = safe global fallback (current behaviour preserved).

## Stories

- [~] S01 — Context-aware File menu (appTypes filter on MenuPlacement)

## Out of Scope (this epic)

- Edit menu (Undo/Redo scoping) — note in parking lot, tackle separately
- Dynamic top-level bar labels (macOS app-name menu) — high complexity,
  not needed for the core win
