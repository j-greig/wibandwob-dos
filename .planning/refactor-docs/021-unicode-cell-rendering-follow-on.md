## Unicode Cell Rendering Follow-On

Status: draft
GitHub issue: —
PR: —

## TL;DR

Post-refactor follow-on: replace string-based complex-text repainting with a
cell-aware text rendering path for Unicode-heavy surfaces. Current glitch
evidence points to width and invalidation mismatches around emoji, variation
selectors, and other non-ASCII glyphs.

## Why This Exists

The current TS TUI spike still renders most text surfaces by:

1. measuring width with `string-width`
2. fitting/padding strings to viewport width
3. handing those padded strings to `blessed`

That is workable for plain ASCII and many simple Unicode cases, but it is not
robust enough for:

- emoji
- variation selector sequences
- combining characters
- zero-width characters
- mixed box-drawing plus emoji lines

Observed symptom:

- stale glyph fragments remain on screen after resize, repaint, or content
  change
- dragging another window over the area often clears the problem
- this strongly suggests partial repaint / stale-cell behavior rather than bad
  file content

## Investigation Summary

Microsprint evidence from live app state and source files:

- viewer windows were showing content from:
  - `/Users/james/Repos/wibandwob-dos/microapps-private/wibwob-primers/primers/conscious-matrix-1.txt`
  - `/Users/james/Repos/wibandwob-dos/microapps-private/wibwob-primers/primers/cosmic-horror.txt`
- current control API could not export those viewer windows as text, so the
  audit used:
  - live `/state`
  - source file inspection
  - width audit with `string-width`

Most suspicious content from `conscious-matrix-1.txt`:

- `∑(👁️,👂,👃,👅) → 🧠(∞)`
- `||👁️◄►👂👃👅||`
- `||👁️👂👃👅🧠||`
- `🌈👅🌈👅🌈👅🌈`

Other unusual Unicode from `cosmic-horror.txt`:

- `༼;´༎ຶ ۝ ༎ຶ༽`

Strong working hypothesis:

- `string-width` and the terminal/blessed repaint path disagree on actual cell
  occupancy for some Unicode sequences
- row padding alone is not enough to clear the previous footprint of complex
  glyphs

## External Clues

Relevant Turbo Vision / tvision guidance:

- `writeStr` is only correct for plain text
- complex Unicode should go through a cell-aware draw path (`drawStr`)
- wide and zero-width characters need explicit cell semantics
- `wcwidth` agreement matters for glitch-free rendering

Reference:

- [tvision README: Displaying Unicode text](https://github.com/magiblot/tvision?tab=readme-ov-file#displaying-unicode-text)
- [tvision README: Unicode](https://github.com/magiblot/tvision?tab=readme-ov-file#unicode)

## Target Outcome

Build a reusable text-to-cells layer for Unicode-aware rendering.

The important contract:

- generators/parsers output cells, not raw strings
- windows render cell rows, not best-effort padded strings
- repaint logic clears the full previous cell footprint

This is aligned with:

- `020-target-architecture.md`
- `015-window-manager-reference-and-repair-plan.md`
- future animation/text/paint reuse

## Proposed Architecture Slice

### New shared primitives

- `src/core/text-cell-types.ts`
  - canonical text-cell and row types
- `src/services/text-cell-renderer.ts`
  - grapheme -> cell expansion
  - width handling
  - trailing-cell clearing
- `src/services/text-layout.ts`
  - wrap, clip, pad, viewport slicing on top of cell rows

### Rendering rules

- plain text path may still use fast string rendering for ASCII-safe content
- complex Unicode path must use cell-aware rendering
- surfaces with known risky content should opt into the cell path explicitly

### First consumers

- text viewer windows
- primer gallery preview
- file-manager preview
- document reader

Later consumers:

- editor display
- animation subtitle overlays
- paint/text surfaces

## Scope For First Pass

1. detect risky Unicode sequences in a line
2. route those lines through a cell-aware renderer
3. clear entire rendered row footprint on repaint
4. add regression captures for the known glitch primers

## Non-Goals

- full terminal emulator
- universal grapheme-perfect rendering for every Unicode edge case on day one
- redesigning all text surfaces before proving the shared renderer on viewers

## Tests / Verification

Minimum verification before calling this landed:

- A/B test against `conscious-matrix-1.txt` with emoji-heavy lines intact
- same file after resize, move, expose, and overlap should leave no stale
  glyphs
- `cosmic-horror.txt` should not leave stray Unicode fragments after repaint
- text export / capture path should expose enough state to inspect glitched
  rows in future debugging

Suggested regression artifacts:

- live state snapshot
- exported viewer text
- tmux or control-API capture after resize/repaint

## Relationship To Other Docs

- `020-target-architecture.md`
  - canonical architecture; this doc is a focused follow-on slice
- `015-window-manager-reference-and-repair-plan.md`
  - repaint/invalidation work complements this cell-rendering work
- `008-theme-system-and-desktop-rendering.md`
  - appearance/chrome side of repaint correctness
- `009-paint-canvas-system.md`
  - future cell/canvas reuse, if revived later
