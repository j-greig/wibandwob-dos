---
Status: not-started
Type: feature
Parent: E018
GitHub issue: —
PR: —
---

# F01 — Controls, Pause, Export & Button Strip

## TL;DR

Add a clickable button strip to Contour Studio, proper pause (freeze frame without killing subprocess), and export-to-file.

## Problem

- Space currently kills the subprocess and relaunches — not a true pause
- No way to save/export the current map to a file
- All controls are hidden keyboard shortcuts — not discoverable
- Users (James) want visible buttons

## Scope

### Pause (SIGSTOP/SIGCONT)
- [ ] Space in grow mode sends `SIGSTOP` to subprocess (true freeze)
- [ ] Space again sends `SIGCONT` (resume from exact frame)
- [ ] Status bar shows `PAUSED` when stopped, `GROWING` when running
- [ ] In static mode, Space does nothing (map is already frozen)

### Export to file
- [ ] Key `s` — save current frame to `exports/contour/<timestamp>_<terrain>_<seed>.txt`
- [ ] Creates `exports/contour/` dir if needed
- [ ] Writes all current `lines_` to file with header (terrain, seed, levels, mode)
- [ ] Status bar flash: "SAVED: <filename>" for 3 seconds
- [ ] Key `a` — batch export all 7 terrains for current seed

### Button strip (TView bar inside window)
- [ ] 1-row control bar between content area and status bar
- [ ] Buttons rendered as `[R:New] [1-7:Terrain] [G:Grow] [T:Tri] [S:Save] [Spc:Pause]`
- [ ] Each button is a clickable region — mouse click triggers same action as keyboard
- [ ] Active button highlighted (e.g. current terrain number, grow mode indicator)
- [ ] Buttons adapt: grow mode shows `[Spc:Pause]`, static mode shows `[Spc:—]`
- [ ] Implementation: custom `TContourButtonBar : public TView` with `draw()` and `handleEvent(evMouseDown)`
  - Track button rects, map click x-position to action
  - Send `evCommand` to owner on click
