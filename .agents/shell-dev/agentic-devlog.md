---
id: spk-agentic-tui-runtime-roadmap-agentic-devlog
title: Agentic Devlog
status: in-progress
created: 2026-03-08
updated: 2026-03-14
depends_on: [spk-agentic-tui-runtime-roadmap]
---

# Agentic Devlog

Current week: `devlogs/W12.md` (starts Mon Mar 16)
Standing notes: `devlogs/standing.md`
Archive: `devlogs/W11.md`

New entry? Add to this week's file under `## YYYY-MM-DD — Title`.
New week starts Monday. File pattern: `devlogs/W{nn}.md` (ISO week number).
Standing notes are rolling — prune when items land or die.

## 2026-03-15 — Journal v2 Autoresearch Session

### Variable scoping crashes in microapps
- `const`/`let` declared after `function` declarations that reference them → TDZ crashes at runtime
- Blessed widget declarations must be ordered BEFORE render functions that hide/show them
- Bun caches compiled TS — `scripts/restart.sh --tmux` required, not `microapps.reload`
- Workspace restore triggers render on startup — if the journal was open when workspace saved, any crash in render blocks app startup entirely
- Fix: `rm -f scratch/workspace.json` before restart when debugging render crashes

### Process manager refactor (other agent)
- `scripts/lib/process-manager.sh` — new shared abstraction for direct/tmux dual-mode
- `scripts/restart.sh` now defaults to `--direct` mode (no tmux)
- Direct mode runs app in background PTY — `screencapture` can't capture it
- Autoresearch needs `--tmux` mode for screenshot-based scoring: `bash scripts/restart.sh --tmux`

### Journal v2 architecture
- Each entry = individual JSON file in `scratch/journal-v2/entries/<id>.json`
- Modes: LIST (two-pane), READ (full-screen), EDIT (title + body textarea)
- 8 API commands: open, create, read, update, list, delete, export-markdown, import-legacy
- `describeState` includes recentEntries with previews + currentEntry in read mode
- `_liveRefresh` callback pattern: module-level ref, set in openJournal, cleared onCleanup
- blessed.list `setItems` triggers `select item` event → use `rendering` guard to prevent recursion
