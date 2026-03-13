# Autoresearch — Plasma Window

## Objective
Improve Plasma window visual quality, especially the right sidebar panel.
Single file in scope: `src/windows/plasma-window.ts` (247 lines).

## Current State
- Animated plasma pattern fills left ~80% — already colourful and dynamic
- Right sidebar has: Mood, Render, Speed, Smear, FPS, Keys
- Sidebar is plain text with no colour or structure
- Header shows "Plasma: [mood]", right shows render mode
- Status bar has keyboard shortcuts

## Rubric — Five Axes (each 1-10)
Same as other autoresearch runs: LAYOUT, READABILITY, AESTHETIC, COHERENCE, CHARACTER.

## Constraints
- Only modify `src/windows/plasma-window.ts`
- Must pass `bun run typecheck`
- RESTART required after changes (it's in `src/`)
