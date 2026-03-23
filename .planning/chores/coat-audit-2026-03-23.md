# COAT Compliance Audit — 2026-03-23

**Test:** "Would this work without the TUI, using only the API?" If no — it's a bug.

## Summary

| Severity | Count | Notes |
|----------|-------|-------|
| **P1**   | 18    | Mutates meaningful state (playback, selection, mode) |
| **P2**   | 12    | Navigation only |
| **P3**   | 3     | Cosmetic |
| **Total** | 33   | Pattern A: 31, Pattern C: 2 |

## Findings

### COAT-001: Music player stop
- **Pattern:** A (keyboard action with no API equivalent)
- **File:line:** src/windows/music-player-window.ts:1073
- **Severity:** P1 (mutates playback state)
- **Keybind/function:** `s` key → `ctrl.stop()`
- **Fix hint:** Add `music-player.stop` command to catalog, wire to `frame.musicPlayer.stop()` API
- **Status:** [ ] open

### COAT-002: Music player cycle viz mode
- **Pattern:** A
- **File:line:** src/windows/music-player-window.ts:1074
- **Severity:** P3 (cosmetic viz change)
- **Keybind/function:** `v` key → `cycleVizMode()`
- **Fix hint:** Add `music-player.next-viz` command, expose `nextVizMode()` on publicAPI
- **Status:** [ ] open

### COAT-003: Music player volume up
- **Pattern:** A
- **File:line:** src/windows/music-player-window.ts:1076
- **Severity:** P1 (mutates volume state)
- **Keybind/function:** `+`/`=` keys → `ctrl.changeVolume(+10)`
- **Fix hint:** Add `music-player.volume-up` command, wire to `frame.musicPlayer.setVolume(currentVol + 10)`
- **Status:** [ ] open

### COAT-004: Music player volume down
- **Pattern:** A
- **File:line:** src/windows/music-player-window.ts:1077
- **Severity:** P1 (mutates volume state)
- **Keybind/function:** `-` key → `ctrl.changeVolume(-10)`
- **Fix hint:** Add `music-player.volume-down` command, wire to `frame.musicPlayer.setVolume(currentVol - 10)`
- **Status:** [ ] open

### COAT-005: Music player scrub forward
- **Pattern:** A
- **File:line:** src/windows/music-player-window.ts:1078
- **Severity:** P1 (mutates playback position)
- **Keybind/function:** `right` key → `ctrl.scrub(+5)`
- **Fix hint:** Add `music-player.scrub` command with `delta` arg, wire to `frame.musicPlayer.scrub(delta)`
- **Status:** [ ] open

### COAT-006: Music player scrub backward
- **Pattern:** A
- **File:line:** src/windows/music-player-window.ts:1079
- **Severity:** P1 (mutates playback position)
- **Keybind/function:** `left` key → `ctrl.scrub(-5)`
- **Fix hint:** Same as COAT-005, single command with +/- delta
- **Status:** [ ] open

### COAT-007: Music player previous track
- **Pattern:** A
- **File:line:** src/windows/music-player-window.ts:1080
- **Severity:** P1 (mutates track selection and playback)
- **Keybind/function:** `up` key → `ctrl.selectPrev()` + `ctrl.playSelected()`
- **Fix hint:** Add `music-player.prev` command, wire to `frame.musicPlayer.prev()`
- **Status:** [ ] open

### COAT-008: Music player next track
- **Pattern:** A
- **File:line:** src/windows/music-player-window.ts:1081
- **Severity:** P1 (mutates track selection and playback)
- **Keybind/function:** `down` key → `ctrl.selectNext()` + `ctrl.playSelected()`
- **Fix hint:** Add `music-player.next` command, wire to `frame.musicPlayer.next()`
- **Status:** [ ] open

### COAT-009: Music player add file
- **Pattern:** A
- **File:line:** src/windows/music-player-window.ts:1082
- **Severity:** P1 (mutates playlist)
- **Keybind/function:** `o`/`a` keys → `openFileBrowser()`
- **Fix hint:** Add `music-player.add-file` command with `filePath` arg, wire to `frame.musicPlayer.addFiles([filePath])`
- **Status:** [ ] open

### COAT-010: Terrain Lab cycle mode
- **Pattern:** A
- **File:line:** src/windows/terrain-lab-window.ts:201
- **Severity:** P1 (mutates generation mode)
- **Keybind/function:** `m` key → `cycleMode()` (internal closure, not bridged)
- **Fix hint:** Add `terrain-lab.cycle-mode` command, expose `setMode(mode)` on describeState API or bridge as `_setMode` hook
- **Status:** [ ] open

### COAT-011: Terrain Lab next terrain
- **Pattern:** A
- **File:line:** src/windows/terrain-lab-window.ts:202
- **Severity:** P1 (mutates terrain type)
- **Keybind/function:** `t`/`tab` keys → `player.setTerrain(player.terrainIdx + 1)`
- **Fix hint:** Add `terrain-lab.next-terrain` command, bridge to `_nextTerrain` hook
- **Status:** [ ] open

### COAT-012: Terrain Lab reroll seed
- **Pattern:** A
- **File:line:** src/windows/terrain-lab-window.ts:203
- **Severity:** P1 (mutates generation seed)
- **Keybind/function:** `r` key → `player.reroll()`
- **Fix hint:** Add `terrain-lab.reroll` command, bridge to `_reroll` hook
- **Status:** [ ] open

### COAT-013: Terrain Lab increase detail
- **Pattern:** A
- **File:line:** src/windows/terrain-lab-window.ts:204
- **Severity:** P1 (mutates contour levels)
- **Keybind/function:** `+`/`=` keys → `player.setLevels(player.levels + 1)`
- **Fix hint:** Add `terrain-lab.set-levels` command with `delta` arg, bridge to `_adjustLevels(delta)` hook
- **Status:** [ ] open

### COAT-014: Terrain Lab decrease detail
- **Pattern:** A
- **File:line:** src/windows/terrain-lab-window.ts:205
- **Severity:** P1 (mutates contour levels)
- **Keybind/function:** `-` key → `player.setLevels(player.levels - 1)`
- **Fix hint:** Same as COAT-013, single command with +/- delta
- **Status:** [ ] open

### COAT-015: Terrain Lab save frame
- **Pattern:** A
- **File:line:** src/windows/terrain-lab-window.ts:206
- **Severity:** P3 (export action, no state mutation)
- **Keybind/function:** `s` key → `saveFrame()` (writes to scratch/captures/)
- **Fix hint:** Add `terrain-lab.save` command, bridge to `_saveFrame` hook or use `window.export_text` with auto-filename
- **Status:** [ ] open

### COAT-016: Backrooms log browser open replay
- **Pattern:** A
- **File:line:** src/windows/backrooms-log-browser-window.ts:167
- **Severity:** P1 (triggers replay session)
- **Keybind/function:** `enter` key → `params.onOpenReplay(entry.path, entry.name)`
- **Fix hint:** Add `backrooms-log-browser.open-replay` command with `logPath` arg, wire through describeState selection
- **Status:** [ ] open

### COAT-017: Backrooms log browser save snippet
- **Pattern:** A
- **File:line:** src/windows/backrooms-log-browser-window.ts:173
- **Severity:** P2 (export action, navigation consequence)
- **Keybind/function:** `s` key → `params.onSaveSnippet(entry.name, previewContent)`
- **Fix hint:** Add `backrooms-log-browser.save-snippet` command, use current selection from describeState
- **Status:** [ ] open

### COAT-018: Backrooms log browser refresh
- **Pattern:** A
- **File:line:** src/windows/backrooms-log-browser-window.ts:179
- **Severity:** P2 (refresh directory scan)
- **Keybind/function:** `r` key → `refreshList()` (re-scans logs dir)
- **Fix hint:** Add `backrooms-log-browser.refresh` command, bridge to `_refresh` hook
- **Status:** [ ] open

### COAT-019: Markdown viewer scroll down
- **Pattern:** A
- **File:line:** src/windows/text-windows.ts:229
- **Severity:** P2 (navigation only)
- **Keybind/function:** `j`/`down` keys → `scrollBy(1)`
- **Fix hint:** Add `markdown.scroll` command with `delta` arg, bridge to `_scroll(delta)` hook
- **Status:** [ ] open

### COAT-020: Markdown viewer scroll up
- **Pattern:** A
- **File:line:** src/windows/text-windows.ts:230
- **Severity:** P2 (navigation only)
- **Keybind/function:** `k`/`up` keys → `scrollBy(-1)`
- **Fix hint:** Same as COAT-019, single command with +/- delta
- **Status:** [ ] open

### COAT-021: Markdown viewer page down
- **Pattern:** A
- **File:line:** src/windows/text-windows.ts:231
- **Severity:** P2 (navigation only)
- **Keybind/function:** `d`/`pagedown` keys → `scrollBy(viewHeight/2)`
- **Fix hint:** Same as COAT-019, or separate `markdown.page-down` command
- **Status:** [ ] open

### COAT-022: Markdown viewer page up
- **Pattern:** A
- **File:line:** src/windows/text-windows.ts:232
- **Severity:** P2 (navigation only)
- **Keybind/function:** `u`/`pageup` keys → `scrollBy(-viewHeight/2)`
- **Fix hint:** Same as COAT-019, or separate `markdown.page-up` command
- **Status:** [ ] open

### COAT-023: Markdown viewer scroll to top
- **Pattern:** A
- **File:line:** src/windows/text-windows.ts:233
- **Severity:** P2 (navigation only)
- **Keybind/function:** `g`/`home` keys → `scrollBox.scrollTo(0)`
- **Fix hint:** Add `markdown.scroll-to-top` command, bridge to `_scrollToTop()` hook
- **Status:** [ ] open

### COAT-024: Markdown viewer scroll to bottom
- **Pattern:** A
- **File:line:** src/windows/text-windows.ts:234
- **Severity:** P2 (navigation only)
- **Keybind/function:** `G`/`end` keys → `scrollBox.scrollTo(maxLines)`
- **Fix hint:** Add `markdown.scroll-to-bottom` command, bridge to `_scrollToBottom()` hook
- **Status:** [ ] open

### COAT-025: Markdown viewer switch to edit mode
- **Pattern:** A
- **File:line:** src/windows/text-windows.ts:235
- **Severity:** P1 (changes view mode state)
- **Keybind/function:** `e` key → `applyMode("edit")`
- **Fix hint:** Add `markdown.edit-mode` command, bridge to `_setViewMode("edit")` hook
- **Status:** [ ] open

### COAT-026: Editor switch to view mode
- **Pattern:** A
- **File:line:** src/windows/text-windows.ts:248
- **Severity:** P1 (changes view mode state)
- **Keybind/function:** `v` key → `applyMode("view")`
- **Fix hint:** Add `markdown.view-mode` command, bridge to `_setViewMode("view")` hook
- **Status:** [ ] open

### COAT-027: Markdown viewer copy code block
- **Pattern:** A
- **File:line:** src/windows/text-windows.ts:237
- **Severity:** P2 (clipboard operation, no state mutation)
- **Keybind/function:** `y` key → finds nearest code block, copies to clipboard
- **Fix hint:** Add `markdown.yank-code` command, bridge to `_yankCode()` hook
- **Status:** [ ] open

### COAT-028: Scramble expand/collapse missing syncState
- **Pattern:** C (bridge hook missing `context.syncState()`)
- **File:line:** src/windows/scramble-window.ts:542
- **Severity:** P1 (state mutation not reflected in /state response)
- **Keybind/function:** `_scrambleExpand` bridge hook → `applyMode()` but doesn't call `onStateChanged()`
- **Fix hint:** Add `onStateChanged?.();` before return in `_scrambleExpand` hook
- **Status:** [ ] open

### COAT-029: Scramble pop-out missing return value
- **Pattern:** C (bridge hook doesn't follow command contract)
- **File:line:** src/windows/scramble-window.ts:546
- **Severity:** P2 (async action, should return status)
- **Keybind/function:** `_scramblePopOut` → `deps.onPopOut?.()` with no return value
- **Fix hint:** Return `{ ok: true, popped: true }` or similar status object
- **Status:** [ ] open

### COAT-030: Plasma next mood
- **Pattern:** A
- **File:line:** microapps/plasma/index.ts:249
- **Severity:** P1 (mutates plasma mood state)
- **Keybind/function:** `m` key → `player.nextMood()`
- **Fix hint:** Register `microapp.wibwob.plasma.next-mood` command, bridge to player API
- **Status:** [ ] open

### COAT-031: Plasma next render mode
- **Pattern:** A
- **File:line:** microapps/plasma/index.ts:250
- **Severity:** P1 (mutates render mode state)
- **Keybind/function:** `r` key → `player.nextRenderMode()`
- **Fix hint:** Register `microapp.wibwob.plasma.next-render-mode` command
- **Status:** [ ] open

### COAT-032: Plasma toggle pause
- **Pattern:** A
- **File:line:** microapps/plasma/index.ts:251
- **Severity:** P1 (mutates playback state)
- **Keybind/function:** `p` key → `player.togglePause()`
- **Fix hint:** Register `microapp.wibwob.plasma.toggle-pause` command
- **Status:** [ ] open

### COAT-033: Plasma save frame
- **Pattern:** A
- **File:line:** microapps/plasma/index.ts:252
- **Severity:** P3 (export action, no state mutation)
- **Keybind/function:** `s` key → `saveFrame()` (writes to scratch/captures/)
- **Fix hint:** Register `microapp.wibwob.plasma.save-frame` command
- **Status:** [ ] open

## Notes

### Branch name
`chore/coat-audit`

### Implementation strategy

Three-phase fix:

**Phase 1: Critical state mutations (P1 — 18 findings)**
- Music player playback control (stop, prev, next, scrub, volume)
- Terrain Lab generation control (mode, terrain, seed, levels)
- Backrooms replay trigger
- Markdown/editor view mode switching
- Plasma state control (mood, render mode, pause)
- Scramble expand missing syncState

**Phase 2: Navigation (P2 — 12 findings)**
- Markdown scroll commands
- Backrooms browser navigation/refresh
- Scramble pop-out return value

**Phase 3: Cosmetic/export (P3 — 3 findings)**
- Viz mode cycling
- Save frame operations

### Bridge hook pattern

For internal closure functions, use this pattern:

```typescript
// Expose action via bridge hook
(frame as unknown as Record<string, unknown>)._hookName = () => {
  // ... perform action ...
  onStateChanged?.();  // ← REQUIRED for Pattern C compliance
  return { ok: true };  // ← Optional but recommended for debugging
};
```

Then register a command that calls it:

```typescript
{
  id: "app.action",
  actionKey: "appAction",
  api: true,
  agent: true,
  action: () => {
    const win = this.windowManager.getFocusedWindow();
    const hook = (win as unknown as Record<string, unknown>)._hookName;
    if (typeof hook === "function") return (hook as () => unknown)();
    return { ok: false, error: "No compatible window focused" };
  }
}
```

### Test validation

For each fix:
1. Add command to catalog with `api: true, agent: true`
2. Wire action handler in app-controller
3. Test via keyboard (regression check)
4. Test via `curl localhost:8099/command -d '{"id":"...", "args":{}}'` (COAT check)
5. Verify `/state` reflects mutation (for P1/P2)
6. Update CHANGELOG.md with "COAT compliance" fix entry

### Audit coverage

**Audited:**
- music-player-window.ts (11 keybinds)
- terrain-lab-window.ts (6 keybinds)
- backrooms-log-browser-window.ts (3 keybinds)
- text-windows.ts (9 keybinds for view mode + 1 for edit mode)
- scramble-window.ts (2 bridge hooks)
- microapps/plasma/index.ts (4 keybinds)

**Not yet audited:**
- file-manager-window.ts (multiple keypress handlers — needs separate review)
- primer-gallery-window.ts (1 keypress handler)
- chrome-browser-window.ts (2 keypress handlers)
- wibwob-agent-window.ts (2 keypress handlers)
- microapps/journal/index.ts (17+ keybinds)
- Other microapps (llm-orch-studio, runtime-inspector, pi-sessions, etc.)

These should be covered in a follow-up audit pass (COAT-034+).

### Related docs
- PHILOSOPHY.md (COAT principle)
- ARCHITECTURE.md (command catalog, API-first design)
- SDK-MICROAPP-DEV.md (host.registerCommand pattern for microapps)
