# E014 — Theme System

Full theme system with live switching across all surfaces.

## Status: IN PROGRESS

## Definitions

- **theme token**: a semantic colour role (e.g. `body`, `header`, `selected`) resolved at runtime
- **variant**: a named set of token values (dark, dark-pastel, light)
- **fleet test**: opening one of every window kind and toggling through all variants
- **surface**: any visible UI element — menu bar, dropdown, popup, window, status line

## Done

- [x] Theme types, resolver, appearance service
- [x] All inline colour literals replaced with `theme()` calls in window factories
- [x] `onRestyle` hook on all window types
- [x] `safeSetStyle` helper (preserves blessed scrollbar/item sub-styles)
- [x] Live toggle via Alt+T / View menu / command palette / API
- [x] Three variants: dark, dark-pastel (Catppuccin Mocha), light
- [x] Cycle order: dark → dark-pastel → light → dark
- [x] Error handling in control API commands/run endpoint

## Theme Parity — Surface Audit

Every surface must use theme tokens. No hardcoded colour strings.

### Shell chrome
- [ ] **Menu bar click targets** — `menu-overlay-manager.ts:40` hardcodes `fg:"black", bg:"white"`
- [ ] **Menu bar hover** — hardcodes `hover: { fg:"white", bg:"blue" }`
- [ ] **Dropdown menus** — `menu-overlay-manager.ts:64` hardcodes white-on-black + cyan selected
- [ ] **Popup/context menus** — `menu-overlay-manager.ts:119` same hardcoded colours
- [ ] **Status line** — verify it restyles on toggle (currently set in toggleTheme)
- [ ] **Menu bar background continuity** — the bar bg and the word bg must match exactly

### Window chrome
- [ ] **Close button** — verify X button uses theme tokens on restyle
- [ ] **Resize grip** — verify grip glyph uses theme tokens on restyle
- [ ] **Unfocused title bar** — verify contrast is readable in all variants

### Per-window-kind audit

Open each, toggle all 3 themes, screenshot, check for hardcoded colours or broken contrast.

- [ ] primer (content viewer)
- [ ] browser (primer browser list)
- [ ] gallery (primer gallery with tabs + filter + preview)
- [ ] editor (text editor)
- [ ] figlet (banner with toolbar)
- [ ] art (generative art canvas)
- [ ] pattern (pattern field canvas)
- [ ] companion (Scramble)
- [ ] workspace (workspace manager)
- [ ] palette (command palette)
- [ ] inspector (state inspector)
- [ ] backrooms (backrooms TV)
- [ ] backrooms-log (log browser)
- [ ] chrome-browser (web browser)
- [ ] wibwob-agent (W&W agent chat)

### Fleet test script
- [ ] Write a script that opens one of each window kind, tiles, toggles all 3 themes, screenshots each
- [ ] Save screenshots to `scratch/screenshots/` with date + variant naming

## Theme Quality

- [ ] **Dark variant** — review contrast, readability, accent visibility
- [ ] **Dark-pastel variant** — review hex→xterm-256 mapping accuracy, tweak if colours look off
- [ ] **Light variant** — review contrast (currently very plain white, could use more warmth)
- [ ] **Scrollbar visibility** — verify scrollbar thumb is visible in all variants
- [ ] **Selected item contrast** — verify selection highlight is readable in all variants

## Future / Parking Lot

- [ ] Theme persistence (save active variant to config, restore on boot)
- [ ] Theme selector command (pick from list, not just cycle)
- [ ] User-defined themes (load variant from JSON/YAML file)
- [ ] `appearance-service.ts` integration (system/light/dark auto-detection)
- [ ] More variants (Nord, Dracula, Solarized, Gruvbox, Tokyo Night)
