# E035 Layout SDK Buildout

Working through the epic brief at `.planning/epics/e035-layout-sdk-buildout/e035-brief.md`.

## Goals
- Implement F00 through F08 of the Layout SDK Buildout
- Commit in logical parcels
- Mark tasks [x] as completed in the brief

## Current Focus: F00 + F01 — Canon surface lock + Core renames

## Checklist

### F00 — Canon surface lock
- [ ] Freeze the public vocabulary from layout-guide-final.md
- [ ] Confirm implementation target names
- [ ] Record migration notes in planning docs

### F01 — Core renames and composition foundation
- [ ] Rename `UiPart` to `LayoutPart` across SDK and internals
- [ ] Rename `createColumns` to `createRow` across codebase
- [ ] Extract `FlexChild` type
- [ ] Extract `GridChild` type
- [ ] Ensure flex helpers accept `LayoutPart` children and return `LayoutPart`
- [ ] Export `Rect`, `LayoutPart`, `FlexChild`, `GridChild` from microapp-sdk
- [ ] Typecheck passes, no module regressions

### F02 — createGrid
- [ ] Implement createGrid in ui-parts.ts
- [ ] templateRows/templateColumns with TrackSize
- [ ] gap support
- [ ] Object-form grid.set
- [ ] justify/align with fixed screen axes
- [ ] Grid accepts LayoutPart children and returns LayoutPart
- [ ] Export from microapp-sdk
- [ ] Port dashboard module to createGrid as first proof

### F03 — Responsive helpers
- [ ] Implement pickBreakpoint
- [ ] Export breakpoint types/utilities
- [ ] Document width-first responsive switching

### F04 — Scroll support helper
- [ ] Export createScrollbar() and scrollableStyle() from microapp-sdk
- [ ] Implement createScrollViewport in ui-parts.ts

### F05 — Safety and internals cleanup
- [ ] Fix createTextBlock zero-width crash
- [ ] Clean up resize double-fire

### F06-F08 — Proof ports, migration, docs (later phases)
