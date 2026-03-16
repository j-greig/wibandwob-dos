---
id: E044
title: "Journal v4: Dual View, Auto-Capture & Bloat Audit"
status: not-started
issue: ~
pr: ~
depends_on: []
---

# E044 — Journal v4: Dual View, Auto-Capture & Bloat Audit

## Problem

The Journal microapp (`microapps/journal/index.ts`) has two disconnected data
sources — structured entries (CRUD, `scratch/journal-v2/entries/*.json`) and raw
pi session logs (`~/.pi/agent/sessions/`). The toggle between them is a hidden
`Shift+S` shortcut with no visual affordance. Auto-capture of agent sessions as
journal entries doesn't exist yet. The file is bloated at ~1430 lines (hero apps
are 130–425).

## Goals

1. Make the JRN / LOG toggle **visible and clickable** in the header chrome.
2. Add `journal.auto-capture` to bridge raw sessions → structured entries.
3. Cross-link auto-captured entries back to their source session.
4. Expose pi session tree navigation (`/tree` branches) in LOG view.
5. Fix the "No editor window found" flash bug when Journal is focused.
6. Audit and decompose the 1430-line monolith.

## Non-goals

- Real-time streaming of active sessions (future).
- Cross-session analytics (time spent, tool frequency).
- Multi-repo session aggregation.

## Key files

| File | Role |
|------|------|
| `microapps/journal/index.ts` | Main implementation (~1430 lines) |
| `microapps/journal/microapp.json` | Registration metadata |
| `src/core/app-controller.ts:1695` | "No editor window found" flash source |
| `scratch/journal-v2/entries/*.json` | Structured entry storage |
| `~/.pi/agent/sessions/{encoded-cwd}/` | Raw pi session JSONL logs |
| `.planning/spikes/spk-journal-v4-auto-journal/spike.md` | Prior spike with design options |

## Type definitions (current)

```typescript
type ViewMode = "journal" | "sessions";
type Mode = "list" | "read" | "edit";
type Peer = "human" | "agent" | "system";
type EntryKind = "note" | "observation" | "decision" | "discovery" | "question";
```

---

## Features & Stories

### F01 — Visible JRN · LOG Toggle

#### S01 — Header chrome toggle buttons
**Status:** not-started

Replace the hidden `Shift+S` shortcut with visible `JRN · LOG` text in the
top-right of the Journal header bar. Design: Option B from spike — accent colour
on active mode, muted on inactive. Clicking either label switches view mode.
`S` key still works as keyboard shortcut.

- [ ] AC-01: `JRN · LOG` text renders in top-right of header when Journal is open.
  Test: Open Journal → visual verify toggle is visible.
- [ ] AC-02: Clicking `LOG` switches to sessions view; clicking `JRN` switches back.
  Test: Mouse click each label → `describeState().viewMode` changes.
- [ ] AC-03: Active mode uses `theme().accent`, inactive uses `theme().muted`.
  Test: Switch themes → colours follow theme.
- [ ] AC-04: `S` keyboard shortcut still toggles.
  Test: Press `S` in list mode → viewMode toggles.
- [ ] AC-05: Toggle only appears when `~/.pi` exists (graceful degradation).
  Test: Rename `~/.pi` → toggle hidden; restore → toggle visible.

### F02 — Auto-Capture Agent Sessions

#### S02 — `journal.auto-capture` command
**Status:** not-started

Scan `~/.pi/agent/sessions/{encoded-cwd}/` for sessions newer than the last
capture timestamp. For each new session, create a structured journal entry with:
- Title derived from first user message
- Body: summary of what happened (files changed, tools used, key decisions)
- Tags: auto-extracted from file paths and tool names
- Kind: `discovery` (or new `session-summary` kind if we extend the enum)
- Peer: `agent`
- `meta.sessionId`: backlink to raw JSONL filename
- `meta.capturedAt`: ISO timestamp

Auto-captured entries display a `⚡` icon in the JRN list.

- [ ] AC-06: `journal.auto-capture` command exists and is API-callable.
  Test: `POST /commands/run { "id": "journal.auto-capture" }` → `{ ok, captured: N }`.
- [ ] AC-07: New sessions since last capture produce entries in `scratch/journal-v2/entries/`.
  Test: Run a pi session, then auto-capture → new `.json` file with `meta.sessionId`.
- [ ] AC-08: Running auto-capture twice doesn't duplicate entries.
  Test: Run twice → entry count unchanged.
- [ ] AC-09: Auto-captured entries show `⚡` icon in Journal list view.
  Test: Visual verify icon next to auto-captured entry.
- [ ] AC-10: Entry body includes files changed and tools used.
  Test: Read entry → body contains file paths and tool names from session.

#### S03 — Cross-link: `⚡` entry → LOG view filtered to source session
**Status:** not-started

When reading an auto-captured entry in JRN view, a keybind (e.g. `L`) or
clickable `⚡` icon jumps to LOG view filtered to that specific session.

- [ ] AC-11: Pressing `L` on an auto-captured entry switches to LOG view showing that session.
  Test: Select `⚡` entry → press `L` → viewMode = "sessions", selected session matches `meta.sessionId`.
- [ ] AC-12: Non-auto-captured entries ignore the `L` key.
  Test: Select a human entry → press `L` → nothing happens.

### F03 — Session Tree Navigation

#### S04 — Tree view for branched session logs
**Status:** not-started

Pi sessions are stored as trees — `/tree` navigates branches, all branches live
in a single file. Expose this in LOG view: show branch points, allow navigating
to any previous point, filter by message type, bookmark labels.

- [ ] AC-13: LOG view detects session files with tree structure (multiple branches).
  Test: Open a session with branches → tree indicator visible.
- [ ] AC-14: Branch points are navigable — user can select a branch to follow.
  Test: Navigate to branch point → list of branches shown → select one.
- [ ] AC-15: Filter by message type (user, assistant, tool_call, tool_result).
  Test: Apply filter → only matching messages shown.
- [ ] AC-16: Entries can be bookmarked/labelled within a session.
  Test: Press `B` on a message → bookmark icon appears; bookmarks persist across reloads.

### F04 — Bug Fixes & Bloat Audit

#### S05 — Fix "No editor window found" flash
**Status:** not-started

When Journal is the focused window and an `editor.write` command fires (e.g.
from agent tools), the Journal window doesn't have `writeInput`, so
`app-controller.ts:1695` flashes "No editor window found". Fix: either add
`writeInput` to Journal (so it can receive text in edit mode) or make the flash
smarter (skip non-editor windows gracefully, try other windows).

- [ ] AC-17: With Journal focused, `editor.write` does not flash error.
  Test: Focus Journal → `POST /commands/run { "id": "editor.write", "args": { "text": "hello" } }` → no flash.
- [ ] AC-18: If Journal is in edit mode, `editor.write` inserts text into the edit textarea.
  Test: Journal edit mode focused → editor.write → text appears in body field.

#### S06 — Journal bloat audit & decomposition
**Status:** not-started

Break `microapps/journal/index.ts` (~1430 lines) into sub-modules. Target: main
file < 500 lines, with extracted modules for session logic, rendering, and
entry CRUD.

- [ ] AC-19: Main `index.ts` is under 500 lines.
  Test: `wc -l microapps/journal/index.ts` < 500.
- [ ] AC-20: Extracted modules: `journal-sessions.ts`, `journal-render.ts`, `journal-entries.ts`.
  Test: Files exist and are imported by `index.ts`.
- [ ] AC-21: All existing commands still work after decomposition.
  Test: `bun run test` + manual verify create/read/update/delete/list/export/import.
- [ ] AC-22: `captureText()` and `writeInput()` methods added.
  Test: `describeState()` and `captureText()` return valid data.
