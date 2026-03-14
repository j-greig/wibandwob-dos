---
id: REF-024
title: "Follow-on: Figlet Window Sizing Should Fit Tallest Rendered Glyphs"
status: blocked
owner: codex
depends_on: []
---

# Problem

Some `figlet.open` windows still open with the rendered ASCII art clipped at the
bottom edge. The banner text is present, but the window height is too short for
the actual rendered glyph box.

This is visible in live runtime parity use as well as ad hoc API-driven banners.

# Why This Matters

- the text-first API/control path is supposed to be trustworthy for operator proofs
- clipped figlet banners make `/state` and command success look correct while the
  visible TUI is wrong
- the shared figlet catalogue already knows useful font metadata and should reduce
  guesswork here

# Likely Direction

1. use the central figlet catalogue as the first sizing source
   - known font height
   - tallest-capital / representative glyph inventory where available
2. keep runtime rendering measurement as the fallback truth
   - measure the actual rendered text block width and height for the requested word
   - size the window from the rendered block, not from a generic default
3. keep chrome math in the existing window sizing path
   - content height/width first
   - toolbar/title/border math applied afterward by the existing owner

# Acceptance Criteria

- `figlet.open` with a long/tall banner does not clip the last rendered row
- API-opened figlet windows and menu-opened figlet windows use the same sizing path
- runtime parity screenshots no longer show bottom-clipped figlet text
- if catalogue metadata is missing or wrong for a font, rendered measurement still fits

# Suggested Verification

- open representative banners with tall capitals and descenders:
  - `RUNTIME`
  - `GAME OVER`
  - `WIBWOB`
  - mixed-case or punctuation sample if supported
- verify `/state` size matches visible TUI fit
- capture text screenshot and live tmux pane evidence
