# Autoresearch Loop — 2026-03-22

## Summary

Built a 15-axis ghost-user benchmark for TUI remote control reliability.
Scored 9/12 baseline → 12/12 stable on original axes → 13/15 after expanding.

## Scoring journey

| Run | Score | Key changes |
|-----|-------|-------------|
| Baseline | 9/12 | escape doesn't close menu (status bar false positive), click-text OK flaky, send-to-terminal timeout, full cycle cascade fail |
| Run 2 | 11/12 | Fixed timeout (sleep 2 + 10s poll), overlay render delay. Still: menu close + click-text flaky |
| Run 3 | 12/12 | Fixed menu close check (match "Open Primer..." not "Quit"), overlay confirm via API (COAT path) |
| Stability | 12/12 ×3 | Three consecutive 12/12 runs. Confidence 3.0× noise floor |
| Expanded | 13/15 | Added 3 new axes: multi-app, click-text on widget button, close all windows |

## New axis failures (13→15 gap)

### Test 13: Open second app while first exists — ✗
`menu-click.sh "Demos" "Hello World"` after figlet banner is open. Only 1 window found.

**Root cause:** The benchmark runs lifecycle tests (quit + restart) before multi-app tests. After restart, the figlet banner from earlier tests is gone — fresh instance. The "second app" test opens Hello World but expects 2 windows (figlet + hello). But figlet was closed by the quit/restart cycle.

**Fix needed:** Either reopen figlet before test 13, or restructure test order so multi-app tests run before lifecycle tests.

### Test 14: click-text "[F] Font" — ✗
Tried to click the Font button on the figlet banner, but figlet isn't open after the restart cycle.

**Root cause:** Same as above — the figlet window from earlier tests was destroyed by quit/restart. click-text searches the full desktop screenshot, finds nothing matching "[F] Font".

**Fix needed:** The multi-app tests need their own setup (open the apps they need) rather than depending on state from earlier tests.

## Key design lessons

### Test isolation matters
Tests that depend on state from earlier tests are fragile. Each section should set up its own preconditions. The lifecycle tests (quit + restart) destroy all state — anything after them starts from zero.

### COAT confirms the right design
Replacing `click-text "OK"` with `POST /overlay/confirm` made test 8 go from flaky to rock-solid. The API is the reliable path; mouse clicks are for things that ONLY work via mouse (blessed menus, buttons without API backing).

### `click-text.sh` works but needs the right target
click-text is reliable when the text is actually on screen. The failures here aren't click-text bugs — they're test design bugs (searching for text that doesn't exist because the window was closed).

### Menu close: click-away > escape
Clicking an empty area (col 80, row 30) reliably closes blessed menus. Escape was flaky because blessed needs the menu widget to be focused to receive the key.

### Status bar text causes false positives
The status bar shows "Ctrl-Q Quit" which matches `grep "Quit"`. Menu-close verification must match menu-specific text like "Open Primer..." not generic labels.

## Dead ends confirmed

- Escape for closing blessed menus — unreliable
- click-text for OK/Cancel buttons — flaky, use API overlay/confirm
- `\n` in `input text` — Ghostty doesn't interpret as enter
- `send key "return"` / `"down"` — invalid Ghostty key names
- Python in scripts — replaced with jq + awk + pure bash
