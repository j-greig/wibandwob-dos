# Bug Sweep — 2026-03-16

Rapid-fire bug list from first launch on main after E042-E047 merges.

## Bugs

### BUG-001: xterm-256color.Setulc terminfo parse error on startup
- **Severity:** low (cosmetic warning, app still runs)
- **Repro:** `bun run src/app.ts`
- **Error:** `Error on xterm-256color.Setulc` — blessed's terminfo compiler chokes on the underline-colour escape `\e[58::2::...m`
- **Cause:** blessed's terminfo parser doesn't handle the `58` SGR (underline colour) sub-params used by modern terminals (Ghostty, iTerm2, kitty)
- **Status:** [ ] open

### BUG-002: TypeError on theme switch — scrollbar.fg undefined
- **Severity:** high (crashes render cycle)
- **Repro:** cycle theme (Ctrl+T or command palette)
- **Error:** `TypeError: undefined is not an object (evaluating 'this.style.scrollbar.fg')` at blessed element.js:2117
- **Cause:** theme variant missing `scrollbar` style block, or blessed element created without scrollbar style defaults — when theme hot-swaps, elements with scrollbar rendering hit undefined
- **Fix:** added `scrollbar: createScrollbar()` + `scrollableStyle()` to 6 scrollable widgets missing scrollbar sub-styles across overlay-manager (4), music-player (1), file-manager-window (1)
- **Status:** [x] fixed

### BUG-003: Core Apps menu empty despite tier registry
- **Severity:** medium (menu exists but shows no items until microapps load)
- **Notes:** need to verify — the header exists, tier system routes `core` microapps there, but host-registered commands (non-microapp) still use `category: "applications"`. Some core things like Web Browser, Wib&Wob Chat, Browse Primers are in Applications not Core Apps.
- **Status:** [ ] needs-triage

## Notes
- Branch: `spike/bug-sweep-march-16`
- All found during first `bun run dev` on main post-merge
