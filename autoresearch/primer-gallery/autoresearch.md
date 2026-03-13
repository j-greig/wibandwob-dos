# Autoresearch — Primer Gallery

## Objective
Improve Primer Gallery visual quality — tabs, list, preview pane.
Single file in scope: `src/windows/browser-windows.ts` (lines 113-320 approx).

## Current State
- Tab bar: "1 A-E  2 F-J  3 K-O  4 P-T  5 U-Z  6 Search"
- Left: file list with .txt filenames
- Right: ASCII art preview of selected primer
- Header row with tab section + filename
- No colour in list or tab bar

## Rubric
Same 5-axis: LAYOUT, READABILITY, AESTHETIC, COHERENCE, CHARACTER.

## Constraints
- Only modify `src/windows/browser-windows.ts` (gallery section)
- Must pass `bun run typecheck`
- RESTART required after changes
