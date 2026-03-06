---
Status: not-started
Type: milestone
Epic: e018-contour-studio-v2-terrain-foundation
---

# M01 — Contour Studio v2 First Slice

## Goal

Ship `Contour Studio v2` as a deterministic terrain generator with:
- sea level
- water rendering
- vegetation rendering
- terrain / contours / hybrid modes
- semantic `/state` metadata

## Deliverables

- `src/services/terrain-model.ts`
- `src/services/terrain-render.ts`
- updated `src/windows/contour-window.ts`
- semantic terrain state in `describeState()`

## Done Means

- `contour.open` still opens the window normally
- water appears when sea level rises
- vegetation appears on appropriate land
- `/state` exposes terrain semantics
- the new services are reusable without Blessed
