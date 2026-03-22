# TUI Control — Ideas Backlog

## Script improvements
- `click-text.sh` could accept `--window-id N` to search only that window's text
- `menu-click.sh` could detect if a menu is already open and close it first
- Add `--timeout` to `send-to-terminal.sh` with configurable wait
- `wait-for-window.sh <title-pattern>` — poll until a window matching the pattern appears
- `wait-for-overlay.sh` — poll until overlay is active/inactive

## API enrichments  
- `GET /overlay/info` should include button positions (OK/Cancel row+col) so click-text isn't needed
- Menu item highlight marker in text screenshots (unicode char on active item)
- `POST /overlay/set-text` could accept `confirm: true` to set-and-confirm in one call

## Robustness
- Test with multiple Ghostty windows open (not just one)
- Test with different screen sizes (resize Ghostty window mid-test)
- Test with a microapp already open (state isn't clean)
- Escape key doesn't always close blessed widgets — investigate focus requirements

## Benchmark improvements
- Add timing per test step as secondary metrics
- Test click-text reliability on buttons that move (different window sizes)
- Test rapid sequential menu clicks (currently flaky)
