# modules-private commit history

These commits exist **only in the local .git objects store** inside the parent repo.
They are NOT visible in a standalone clone of the submodule repo until pushed.

## Where the history lives

- Working copy: `/Users/james/Repos/wibandwob-dos/microapps-private/`
- Git objects: `/Users/james/Repos/wibandwob-dos/.git/microapps/microapps-private/`
- Remote (now pushed): `https://github.com/j-greig/wibandwob-wwdos-modules-private`

The `microapps-private/.git` file contains `gitdir: ../.git/microapps/modules-private`
— it's a pointer, not a real `.git` folder. Tower should show this repo separately
if you open `/Users/james/Repos/wibandwob-dos/microapps-private/` as a repository.

## Commits (newest first)

```
 1  2690f0e feat: hybrid mode — contour + iso side by side in main WibWobWorld window
 2  c6aae56 fix(wibwobworld-iso): skip restore if sourcePath missing or undefined (#116)
 3  4cbb668 fix(wibwobworld): strip viewport dims from worldKey — resize no longer flushes channels
 4  610dd6d fix(world-chatroom): compute cached dims from frame parent — reliable after batch resize
 5  3775672 debug: show bodyHeight/maxParticipants/cachedH in sidebar
 6  3cca64d fix(world-chatroom): clean sidebar — fixed width 26, Players header, system-only events, no debug
 7  a2789bf debug: inject sw/sidebarWidth into sidebarPreview
 8  bb0e6f2 debug: bump sidebarWidth to 28 to confirm code loaded
 9  5dfb4bb fix(world-chatroom): fixed sidebar width 24 — sidestep unreliable blessed dimension reads
10  0c68d8b fix(world-chatroom): use body.aright-aleft for actual pixel width — right-anchored body can't compute .width
11  a806252 fix(world-chatroom): cache dimensions from onResize — blessed body.width wrong before layout settles
12  947393d fix(world-chatroom): compute innerW/H from win.width/height not win.body — body returns style expr
13  517614f fix(world-chatroom): sidebar +10 chars wider, revert debug filter to system-only
14  8528a03 fix(world-chatroom): sidebar shows system events only (not event-kind duplicates), players header
15  ba5bc81 feat(world-chatroom): sidebar redesign — players list at top, events below, truncated to width
16  9ac51ad feat(world-chatroom): halve sidebar width (32% → 16%), chat already excluded from game log
17  4ebe341 feat(wibwobworld): F08 cursor + tile inspect + movement cost
18  a8e30e7 refactor(microapps): import MicroappSnapshotWindow + applyRect; replace inline geometry in world-chatroom
19  a19045b refactor(microapps): import Rect/UiPart/StackChild/createNodePart from ui-parts — remove 3x local type duplication
20  e59d163 refactor(wibwobworld-iso): import applyRect from ui-parts, remove local duplicate
21  105380a fix(world-chatroom): bottom-anchor messages, fill full transcript height
22  aef1bd1 refactor(wibwobworld): import applyRect from ui-parts, remove local duplicate
23  c81ba4a feat(world-chatroom): C05 UX polish — scroll-to-bottom, / from anywhere, clearer transport
24  a60bdff refactor(wibwobworld): use host.ui.createButtonBar — 90 lines → 14
25  91fe0dc fix(wibwobworld): restore saved:filename hint in mode bar left label
26  ae04249 feat(wibwobworld): clickable mode buttons in status bar right side
27  a7304d2 fix(wibwobworld): bind all keys on fpBox so m/r/t etc work in firstperson mode
28  fb749ff fix(wibwobworld): remove duplicate mapBox keypress handler for c key
29  60cbf91 Fix world chatroom live sync and chatspot join handoff
30  b883af6 fix(wibwobworld): defer initial render by one tick to prevent setContent hang on startup
31  4292449 fix(wibwobworld): debounce resize-triggered render to prevent startup loop
32  f72d4f3 fix(wibwobworld): never restore into firstperson mode — falls back to hybrid on startup
33  bbaba10 feat(wibwobworld): compass arrow orbits avatar at circumference, not embedded in sprite
34  cb36727 fix(wibwobworld): remove hide/show from body.layout + re-entry guard on render()
35  186d5a1 fix(world-chatroom): filter messages by kind field not sender string
36  4a3b7b3 feat(e018/m02): WASD+arrow camera controls for firstperson mode
37  a0cb975 feat(e018/m02): firstperson mode wired + DRY biome tables
38  ee16828 Refine world chatroom layout and input
39  73994ef Add WibWobWorld and world chat microapps
40  adf5f00 fix(theme): add missing highlight token to phosphor theme
41  232c856 feat: add phosphor theme module and tui agent prompt; update custom prompt
42  9bcc2ea Update custom prompt guidance
43  2396a57 feat(prompts): update wibwob system prompt + add custom prompt layer
44  a7ff809 docs: update README with submodule workflow
45  ca3ce11 chore: init private modules (primers, prompts)
```
