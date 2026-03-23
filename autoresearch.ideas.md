# TUI Control — Ideas Backlog

## Highest impact (likely to improve score)
- `menu-click.sh` add `--close-first` flag — click empty area before opening menu, prevents stale menu state from previous test
- Increase `sleep` after File > Quit before checking health — the double-click might need more time for blessed to process quit
- Add `wibwob` CLI menu close command (`menu.close`) — more reliable than click-away

## Script improvements
- `click-text.sh --window-id N` to search only that window's text
- `menu-click.sh` detect if a menu is already open and close it first
- `wait-for-window.sh <title-pattern>` — poll until a window appears (eliminates sleep guessing)
- `wait-for-overlay.sh` — poll until overlay is active/inactive (eliminates sleep guessing)

## API enrichments  
- `POST /overlay/set-text` accept `confirm: true` to set-and-confirm in one call
- Menu close via API command (reliable alternative to click-away/escape)

## Robustness (don't pursue yet — score is the priority)
- Test with multiple Ghostty windows open
- Test with different screen sizes  
- Test with a microapp already open (dirty state)

## Dead ends
- Escape key for closing blessed menus — doesn't reliably reach the menu widget
- click-text for OK/Cancel buttons — position-dependent, timing-sensitive. Use API overlay/confirm instead (COAT principle)
- `\n` in `input text` — Ghostty doesn't interpret it as enter
- `send key "return"` / `"down"` — invalid key names in Ghostty

## The big one: clickable element positions in describeState()
- Every SDK composition helper (createButtonBar, createTabs, createHeaderBar) auto-registers clickable regions
- `describeState()` includes `clickables: [{ label, row, col, width }]`
- host.registerClickable(node, label) SDK method — reads blessed node position
- Recalculates on resize
- Eliminates click-text.sh for SDK widgets — agent reads position from state, clicks directly
- COAT: if a human can click it, the API must know where it is
- Would also enable: `wibwob click <window-id> <label>` CLI command

## Parked: TUI projection mapping via Ghostty shaders
- Cell-aligned grid shader works well (round() fix for sub-pixel drift)
- 3D cube rotation proof-of-concept built but not visually compelling
- The approach works: ray-box intersection, per-face TUI window drawing, theme-matched colours
- Needs better visual design / use case to justify the complexity
- Assets: `wibwob-window-cube.glsl`, `wibwob-3d-tilt.glsl` (keep for reference)
