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
