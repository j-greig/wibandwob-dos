## F04 — Channel Controls

Status: not-started
GitHub issue: #103
PR: —

### Summary

In-window controls for the Backrooms TV: set theme, set primers, set turns, play/pause/skip. Exposed as both keyboard shortcuts within the focused window and as IPC/registry commands for agent control.

### Stories

- [ ] **S13**: Hotkeys — `Space` = pause/resume, `N` = next (restart with same config), `T` = prompt for theme
- [ ] **S14**: Status bar at bottom of view — shows current theme, turn N/M, state (playing/paused/idle)
- [ ] **S15**: IPC commands — `backrooms_tv_set_theme`, `backrooms_tv_set_primers`, `backrooms_tv_play`, `backrooms_tv_pause`
- [ ] **S16**: Preset channels — configurable list of theme+primer combos, cycle with `←`/`→`

### Acceptance Criteria

AC-F04-1: Space toggles between playing and paused states.
Test: Open window, press Space, verify status shows "paused", press again, verify "playing".

AC-F04-2: `N` key kills current generation and starts a new one with same config.
Test: Press N, verify new subprocess PID differs from previous.

AC-F04-3: Status bar displays current theme and turn progress.
Test: Screenshot shows status line with theme name and turn counter.

AC-F04-4: IPC `backrooms_tv_set_theme` changes theme and restarts generation.
Test: Send command via API, verify new theme in status bar.
