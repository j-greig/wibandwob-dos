---
Status: not-started
Type: spike
GitHub issue: —
PR: —
---

# SPK01 — Figlet Font Picker Live Preview

## TL;DR

When picking a figlet font, show a live preview of the selected font rendered with the user's text in the right pane. Currently the right pane shows nothing useful. 148 fonts across 7 categories -- you can't pick a font without seeing it.

Same pattern as E003 Finder: list on left, preview on right, updates on selection change.

## What Exists

### Font Picker Flow
1. User opens Applications > Figlet Banner
2. Overlay prompt asks for text (default "WIB WOB")
3. Font picker opens via `openFigletFontPicker` -> `openListPrompt` -> `openBrowserPrompt`
4. `openBrowserPrompt` already has a 38%/62% split: search+list on left, preview box on right
5. User picks from 148 fonts sorted alphabetically, labelled like `doom (10h x 0w)`
6. On select, the figlet window renders with that font

### The Gap
`getFigletFontChoices()` returns items with `label` but NO `preview` field. The preview pane shows the label text only. The infrastructure for preview is already wired -- `openBrowserPrompt` calls `updatePreview()` on every list selection change, and renders `item.preview ?? item.label`.

## Proposed Change

### Minimal (just wire it up)
In `getFigletFontChoices()` or at the call site in `openFigletFontPicker`, populate the `preview` field with `renderFiglet(text, fontName)` for each font.

Problem: rendering 148 figlets upfront (each spawns `figlet` CLI via `spawnSync`) would be slow at open time. ~148 subprocess calls.

### Better (lazy render on selection)
Don't pre-populate preview. Instead, add an `onSelectionChange` callback to `openBrowserPrompt` (or `openListPrompt`) that fires when the highlighted item changes. The figlet picker hooks this to render the selected font on demand and update the preview pane.

This means:
1. Add `onSelectionChange?: (item, index) => string | void` to `openBrowserPrompt` options
2. If it returns a string, set preview content to that string
3. In `openFigletFontPicker`, pass an onSelectionChange that calls `renderFiglet(text, selectedFont)` and returns the rendered output
4. One figlet render per arrow-key press (fast enough -- single spawnSync, <50ms)

### Bonus (debounce for fast scrolling)
If user holds arrow key and scrolls fast through 148 fonts, debounce the render to avoid spawning figlet 30 times per second. 100ms debounce on the preview render, show the label immediately.

## Key Files

- `src/windows/figlet-windows.ts` -- `openFigletFontPicker`, `getFigletFontChoices` call site
- `src/services/figlet-service.ts` -- `renderFiglet`, `getFigletFontChoices`, `measureFiglet`
- `src/core/overlay-manager.ts` -- `openBrowserPrompt` (the 38/62 split modal), `openListPrompt`

## Scope

- This is a spike: prove the lazy preview works, land it, move on
- Do NOT refactor the overlay system or font picker into a new window type
- Do NOT add font categories/tabs/grouping (that's a separate feature)
- Do NOT cache rendered fonts to disk

## Acceptance Criteria

- [ ] AC-1: Font picker shows live rendered figlet preview in right pane when list selection changes
  Test: open figlet banner, type text, arrow through font list, verify right pane updates with rendered font

- [ ] AC-2: Preview renders fast enough that arrow-key scrolling feels responsive
  Test: hold down-arrow through 20+ fonts, no visible lag or hang

- [ ] AC-3: Preview uses the user's actual input text, not a placeholder
  Test: type "HELLO", open font picker, verify preview shows "HELLO" in each font

## Effort

Small. The preview infrastructure exists. This is wiring + one callback + optional debounce. Half day max.
