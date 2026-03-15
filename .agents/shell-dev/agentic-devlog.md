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

### Process manager refactor — --direct default, --tmux optional
- `scripts/lib/process-manager.sh` — new shared abstraction for direct/tmux dual-mode
- All OPS scripts (`ensure-running`, `restart`, `attach`, `start-alt-instance`) refactored
- `--direct` (default): PTY via `script -q /dev/null`, background process, log file
- `--tmux`: legacy behavior preserved with full parity
- `~/.wibwob` updated with `ww-start`, `ww-restart`, `ww-attach`, `ww-alt` aliases
- `wibwob-record.sh` now gets dimensions from `/state` API (screen.width/height), tmux fallback
- No `set -e` in process-manager — kill/tmux ops fail gracefully
- No `set -u` — empty `WW_REMAINING_ARGS` arrays break bash strict mode

### Screenshot painpoints (multi-display)
- `capture-tui-png.sh` uses macOS `screencapture` — works without tmux, fully cross-platform
- **Pain: agents can't tell which display WibWob is on.** `--list-displays` shows indices (1, 2) but no way to know which one has Ghostty/WibWob without trial-and-error PNG capture
- First attempt always gets the wrong screen (Zed editor on display 1 instead of Ghostty on display 2)
- **Idea:** auto-detect the right display by querying Ghostty AppleScript for window position, or checking which display has a window titled "tmux attach" / "Ghostty", or just caching `DISPLAY_NUM=2` in `~/.wibwob`
- **Quick fix for now:** add `export WIBWOB_DISPLAY=2` to `~/.wibwob` so agents stop guessing
- Long-term: `/screenshot/png` endpoint rendering ANSI→SVG→PNG server-side would bypass the display problem entirely

## 2026-03-15 — Shader→Music Pipeline & Ghostty AppleScript Discovery

### Ghostty 1.3 AppleScript — game changer
- **`perform action "reload_config" on terminal 1 of selected tab of front window`** — programmatic config reload, no keystroke simulation
- Replaces fragile `osascript` Cmd+Shift+, hack in `ghostty-shader.sh`
- Full API: `new window`, `input text`, `split`, `focus`, `close`, `send key` (with modifiers)
- `new surface configuration` supports `initial working directory`, `command`, `environment variables`
- SDEF at `/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef`
- Shader hot-swap recipe: `sed` rewrite `custom-shader` line → `perform action "reload_config"` → instant
- Refs: [PR #11208](https://github.com/ghostty-org/ghostty/pull/11208), [audio-reactive #10201](https://github.com/ghostty-org/ghostty/discussions/10201)

### Shader→Music autoresearch: 90.2 best score
- Cathedral minimalism genre (organ+FM bells+glass harmonics+5-voice choir) in Db Lydian
- Harmonic interference shader: sine waves at musical ratios (3:2, 5:4, 7:4, 1.01:1)
- Key technique: per-track time offsets decorrelate voices (biggest independence boost)
- Double breakdown (inverse voicings at 20% and 50%) creates energy arc
- 11 genres total: cathedral, starfield, eno×DM×hyper, lofi, dnb, synthwave, acid, ambient, spacejazz, breakcore, witchhouse
- 29 shots in `autoresearch/shader-music/shots/`, manifest in `manifest.jsonl`
- Report: `shots/REPORT.md`

### desktop-save.sh + desktop-compose.sh
- `scripts/experimental/desktop-save.sh` — snapshots live desktop to v2 workspace JSON
- v2 format (current): flat `kind/left/top/width/height/payload`, top-level `theme`
- v1 format (dead): `workspaces/last_workspace.json` with `bounds:{x,y,w,h}` — obsolete
- `desktop-compose.sh` had wrong ROOT path (`..` not `../..` from `scripts/experimental/`)
- Workspace save goes to `scratch/workspaces/` (defined in `src/core/config.ts`)

### Ghostty shader performance
- `cineShader-Lava.glsl`: 16 spheres × 64 ray steps = GPU hog
- `cineShader-Lava-lite.glsl`: 6 spheres × 32 steps + half-res pixel snapping = ~1/10 cost
- tmux does NOT affect shader GPU cost — shader runs in Ghostty compositor over final pixels
- tmux DOES slow blessed render (extra PTY hop) — 23fps observed

### Journal v2 architecture
- Each entry = individual JSON file in `scratch/journal-v2/entries/<id>.json`
- Modes: LIST (two-pane), READ (full-screen), EDIT (title + body textarea)
- 8 API commands: open, create, read, update, list, delete, export-markdown, import-legacy
- `describeState` includes recentEntries with previews + currentEntry in read mode
- `_liveRefresh` callback pattern: module-level ref, set in openJournal, cleared onCleanup
- blessed.list `setItems` triggers `select item` event → use `rendering` guard to prevent recursion
