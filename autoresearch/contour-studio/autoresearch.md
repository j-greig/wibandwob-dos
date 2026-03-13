# Autoresearch — Contour Studio

## Objective
Improve Contour Studio visual quality — status bars, headers, mode display.
Single file: `src/windows/contour-window.ts` (~398 lines).

## Current State
- Solo mode: full canvas + 1-line status bar with mode/terrain/seed/levels/keys
- Triptych mode: 3 panels + header "TRIPTYCH" + status bar
- Art itself is stunning generative contour maps
- Chrome is minimal — just functional status text

## Rubric
5-axis: LAYOUT, READABILITY, AESTHETIC, COHERENCE, CHARACTER — each 1-10, averaged.

## Constraints
- Only modify `src/windows/contour-window.ts`
- Must pass `bun run typecheck`
- RESTART required after changes
- Don't clutter the art — it's the star
