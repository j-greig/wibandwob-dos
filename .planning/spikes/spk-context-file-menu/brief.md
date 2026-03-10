---
id: spk-context-file-menu
title: Context-Aware File Menu (macOS-style per-app menus)
status: in-progress
branch: spike/spk-context-file-menu
worktree: ~/Repos/spk-context-file-menu
created: 2026-03-10
---

# TL;DR

The current File menu is a static flat list that mixes Open actions for every
app type — confusing when focus is on a text editor (you do not need Open Primer)
or on a primer viewer (you do not need New Editor). Goal: make the File menu
(and potentially Edit) reflect the focused window, like macOS Finder/TextEdit/Preview
switch their menus depending on which app is frontmost.

## Problem Statement

1. File menu today is a static amalgam of every Open/New action regardless of context.
2. "New Editor" and "Open Text File..." sit next to "Open Primer Browser" and
   "Open Markdown File..." — none filtered by what is actually focused.
3. Context menus (right-click) already filter by `windowKinds` — menu bar does not.
4. The blessed menu bar is built ONCE at startup via `buildMenus()`, never rebuilt.

## Questions to Answer

1. Which window types have filesystem semantics (load/save a real file)?
2. What File menu items should each app type show? (inventory)
3. What is the minimal change to `command-registry.ts` / `command-catalog.ts`
   to add per-app-type menu filtering without breaking the static path?
4. Does the menu bar need to be rebuilt on focus change, or can items be
   shown/hidden/relabelled dynamically in blessed?
5. What is the macOS model exactly — different items, different labels, or both?
6. Are there apps with no filesystem semantics that should get a minimal File menu
   (just Close / Quit)?
7. Does Edit menu have the same problem?

## Scope

- Research only — no production code in this spike.
- Produce: app-type inventory, recommended File menu per app type, proposed
  data model change in command-catalog (draft only), one implementation option sketch.
- Out of scope: implementation, Edit menu (mention but do not design).

## Apps with Filesystem Semantics (initial list to verify)

| AppType             | Opens file? | Saves file? | Notes                        |
|---------------------|-------------|-------------|------------------------------|
| text-editor         | yes         | yes         | full read/write              |
| primer-viewer       | yes         | no          | reads .txt/.primer files     |
| reader-viewer       | yes         | no          | reads arbitrary text files   |
| markdown-viewer     | yes         | no          | reads .md files              |
| farjs-file-manager  | yes (nav)   | no          | filesystem browser           |
| backrooms-log-browser | yes       | no          | reads backrooms logs         |
| chrome-browser      | yes (URL)   | no          | web — URL not local file     |
| music-player        | yes         | no          | audio files                  |
| generative-art      | no          | yes (canvas)| export only                  |
| wibwob-agent        | no          | no          | N/A                          |

## Proposed Data Model Sketch (to validate in spike)

Add optional `appTypes?: AppType[]` to `MenuPlacement` in command-catalog.ts,
alongside existing `windowKinds` on contextMenu. Menu builder would then filter
placements whose appTypes include the currently focused window's appType, falling
back to a global/default set when no window is focused or the appType has no
specific items registered.

## Deliverables

- `report.md` in this directory — full findings, per-app menu inventory,
  recommended macOS-style menu spec, implementation option sketch, risks.
- Updated `brief.md` with answers to all Questions to Answer above.

## Agents Dispatched

- Agent A: App inventory — enumerate all AppTypes with filesystem semantics,
  what each currently exposes via contextMenu and menuPlacements.
- Agent B: Menu system analysis — how buildMenus/buildPalette/contextMenuItems
  work, what minimal data model change would support per-focused-app filtering,
  implementation options and tradeoffs.
