---
Status: not-started
Type: milestone
Epic: e018-contour-studio-v2-terrain-foundation
---

# M01 — WibWobWorld First Slice

## Goal

Ship `WibWobWorld` as a deterministic terrain generator with:
- sea level
- water rendering
- vegetation rendering
- terrain / contours / hybrid modes
- semantic `/state` metadata

## Deliverables

- `src/services/terrain-model.ts`
- `src/services/terrain-render.ts`
- new private microapp under `modules-private/`
- semantic terrain state in `describeState()`

## Done Means

- the existing `contour.open` path still opens the old built-in prototype
- `WibWobWorld` opens through its microapp command path
- water appears when sea level rises
- vegetation appears on appropriate land
- `/state` exposes terrain semantics
- the new services are reusable without Blessed
