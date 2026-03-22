---
title: "E055 — TUI AppleScript Control: agent drives the desktop like a human"
status: in-progress
branch: epic/e055-tui-applescript-control
issue: ~
---

# E055 — TUI AppleScript Control

Make agents reliable operators of the WibWob-DOS TUI via AppleScript mouse/keyboard
combined with API/CLI verification. The goal: any smoke test a human can do by
clicking around, an agent can do with scripts — and verify the results.

## Verification method

Every story is self-testable via the ghostty-control autoresearch benchmark:

```bash
bash autoresearch.sh                                    # run full ghost-user test suite
bash .pi/skills/ghostty-control/scripts/index.sh        # list all scripts
bash .pi/skills/ghostty-control/scripts/wait-for.sh health  # poll example
```

---

## F01 — Clickable element positions in state (the big one)

The system renders buttons, tabs, menu items — but only humans see where they are.
Agents screenshot → parse → guess coords → click. Wrong direction.
The runtime already knows every node's position (blessed tracks it).
Expose it via `describeState()` so agents click by label, not by pixel math.

COAT test: *if a human can click it, the API must know where it is.*

### Stories

- [x] S01 — `host.registerClickable(node, label)` SDK method
  - [ ] Add `registerClickable` to `MicroappHost` interface
  - [ ] Implementation reads `node.atop`, `node.aleft`, `node.width` relative to window body
  - [ ] Recalculates on `resize` event
  - [ ] `describeState()` includes `clickables: [{ label, row, col, width }]`
  - [ ] Verify: `wibwob state` shows clickable positions for a test window

- [ ] S02 — SDK composition helpers auto-register clickables
  - [ ] `createButtonBar` registers each button
  - [ ] `createTabs` registers each tab
  - [ ] `createHeaderBar` buttons (if any) registered
  - [ ] Verify: open figlet banner → `wibwob state` shows [V] All, [S] Favs, [F] Font, [E] Edit positions

- [ ] S03 — `wibwob click <window-id> <label>` CLI command
  - [ ] New command `window.click` in command-catalog
  - [ ] Reads clickable position from window state → converts to cell → calls window click handler
  - [ ] CLI wiring: `wibwob window <id> click --label "Font"`
  - [ ] Verify: `wibwob window 1 click --label "[F] Font"` opens font picker

- [ ] S04 — Overlay button positions in `/overlay/info`
  - [ ] `createButtonBar` in overlay-manager registers button positions
  - [ ] `getActiveOverlayInfo()` includes `buttons: [{ label, row, col }]`
  - [ ] Verify: open figlet prompt → `/overlay/info` shows OK + Cancel positions

---

## F02 — Scriptable-first runtime architecture

The TUI currently renders widgets and hopes agents can find them. The deeper
fix: every interactive surface should be addressable by name, not by position.
Blessed widgets are anonymous nodes — you click by pixel. The runtime should
give every interactive element an identity that survives resize, restyle, and
window rearrangement.

This is the difference between "expose where things are" (F01) and "make things
addressable so position doesn't matter" (this feature).

### Stories

- [ ] S13 — Named action regions on windows
  - [ ] `WindowFacade.registerAction(label, handler)` — registers a named clickable action
  - [ ] Actions are semantic: "toggle-font-picker", "edit-text", "view-all-fonts"
  - [ ] `describeState()` includes `actions: [{ label, id }]` (position optional, identity required)
  - [ ] Verify: figlet banner exposes 4 actions without knowing their pixel positions

- [ ] S14 — `window.action` API command — trigger actions by name
  - [ ] `POST /windows/action { id: N, action: "toggle-font-picker" }`
  - [ ] CLI: `wibwob window 1 action toggle-font-picker`
  - [ ] Bypasses mouse clicks entirely — COAT at its purest
  - [ ] Verify: `wibwob window 1 action edit-text` focuses the text input in figlet

- [ ] S15 — Blessed menus become action-addressable
  - [ ] Each menu item gets an action ID (its command catalog ID)
  - [ ] `POST /menu/activate { item: "microapp.wibwob.figlet.open" }` triggers directly
  - [ ] No mouse click, no position calculation, no double-click blessed workaround
  - [ ] Verify: `wibwob cmd menu.activate --item microapp.wibwob.figlet.open` opens figlet

- [ ] S16 — Overlay inputs become named fields
  - [ ] Each overlay input/button gets a field name: "text-input", "ok", "cancel"
  - [ ] `POST /overlay/field { name: "text-input", value: "GHOST" }` (generalises set-text)
  - [ ] Future overlays with multiple inputs (e.g. form dialogs) work automatically
  - [ ] Verify: `/overlay/info` shows `fields: [{ name, type, value }]`

---

## F03 — Reliable menu interaction

Blessed menus need double-click, escape doesn't close them, and there's no
API-backed menu close. Fix these at the source.

### Stories

- [ ] S05 — `menu.close` API command
  - [ ] Add to command-catalog + app-controller
  - [ ] Calls `menuUi.closeMenus()` (already exists internally)
  - [ ] Verify: open File menu → `wibwob cmd menu.close` → menu gone from screenshot

- [ ] S06 — `/menu/list` includes open/closed state and highlighted item
  - [ ] `getOpenMenuLabel()` already exists — expose in menu.list response
  - [ ] When menu open: include `{ open: true, highlighted: N }` 
  - [ ] Verify: open File menu → `/menu/list` shows `open: true`

- [ ] S07 — `menu-click.sh` uses `menu.close` + `wait-for.sh`
  - [ ] Close any open menu before clicking (--close-first becomes default)
  - [ ] Replace `sleep 0.5` with `wait-for.sh text "Open Primer"` after opening
  - [ ] Verify: autoresearch menu tests pass without any sleep calls

---

## F03 — wait-for.sh polish + integration

Replace sleep-and-hope with observe-and-proceed everywhere.

### Stories

- [ ] S08 — Fix wait-for.sh arg parsing (--timeout before/after condition arg)
  - [ ] Parse all `--flags` first, then positional args
  - [ ] Verify: `wait-for.sh overlay --timeout 2` correctly times out at 2s

- [ ] S09 — Integrate wait-for.sh into autoresearch.sh
  - [ ] Replace every `sleep N` with appropriate `wait-for.sh` condition
  - [ ] Benchmark runs faster (no wasted sleep) and more reliably (no race conditions)
  - [ ] Verify: autoresearch.sh has zero bare `sleep` calls

- [ ] S10 — Integrate wait-for.sh into other scripts
  - [ ] `menu-click.sh`: wait-for text after menu click instead of sleep
  - [ ] `send-to-terminal.sh`: optional `--wait` flag that polls health after sending
  - [ ] Verify: `send-to-terminal.sh wibandwob-dos "bun run dev" --wait` blocks until healthy

---

## F04 — Script hardening

### Stories

- [ ] S11 — `click-text.sh --window-id N` searches single window
  - [ ] Use `wibwob screenshot <id>` instead of full desktop screenshot
  - [ ] Avoids false matches from other windows' content
  - [ ] Verify: with 3 windows open, `click-text.sh "OK" --window-id 2` only searches window 2

- [ ] S12 — Error messages with actionable hints
  - [ ] `calibrate.sh` failure: "is Ghostty running? is WibWob-DOS started?"
  - [ ] `menu-click.sh` item not found: print available items from `/menu/list`
  - [ ] `click-text.sh` text not found: print first 5 lines of screenshot for debug
  - [ ] Verify: each script's error path tested manually

---

## Done criteria

- [ ] Autoresearch benchmark 15/15 stable (3 consecutive runs)
- [ ] Zero `sleep` calls in autoresearch.sh (all replaced with wait-for.sh)
- [ ] `wibwob state` shows clickable positions for figlet banner buttons
- [ ] `wibwob window 1 click --label "[F] Font"` works end-to-end
- [ ] All scripts pass `autoresearch.checks.sh` (no python, no hardcoded ports, @desc present)
