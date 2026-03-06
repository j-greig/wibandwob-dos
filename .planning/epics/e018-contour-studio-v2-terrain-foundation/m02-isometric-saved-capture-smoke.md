---
Status: not-started
Type: milestone
Epic: e018-contour-studio-v2-terrain-foundation
---

# M02 — Isometric Saved-Capture Smoke

## Goal

Give another agent a narrow, executable smoke target for the quasi-3D / isometric experiment without requiring full world-generation changes first.

The test surface is a renderer that consumes already-saved `WibWobWorld` text captures or contour-derived terrain snapshots and presents them in an isometric / pseudo-3D view.

## Why This Exists

`WibWobWorld` already supports saving captures to `scratch/captures/`.
That gives us a cheap test seam:

- generation stays unchanged
- saved captures become deterministic fixtures
- another agent can focus on the rendering experiment only

This is the safest first step for the quasi-3D idea.

## Inputs

- saved captures from `WibWobWorld`
- optionally saved contour-style text fixtures if they map cleanly to elevation bands
- live API state from `GET /state` when needed to confirm seed / terrain / render mode

Likely fixture directory:
- `/Users/james/Repos/wibandwob-dos/scratch/captures/`

## Expected Smoke Flow

1. Start WibWob-DOS and wait for `GET /health` on `127.0.0.1:8099`.
2. Open `WibWobWorld` through its module command path.
3. Generate at least two distinct terrain captures:
   - one wetter / archipelago-like terrain
   - one hill or ridge-heavy terrain
4. Save captures to `scratch/captures/`.
5. Open the isometric experiment window or renderer against those saved files.
6. Verify the same saved input renders consistently across repeated opens.
7. Verify the renderer does not break desktop behavior: focus, move, resize, close, `/state`.

## Smoke Targets

- load a saved capture without regenerating the world
- render a readable pseudo-3D / isometric terrain silhouette
- water reads lower than land
- hills / peaks read higher than flats
- vegetation does not visually erase elevation shape
- the window still behaves like a normal WibWob-DOS surface

## Minimum Acceptance Criteria

- [ ] opens from a command path as a first-class window
- [ ] can load a specific saved capture file from `scratch/captures/`
- [ ] the same saved file renders deterministically on repeated open
- [ ] water visually reads as lower elevation than land
- [ ] at least one ridge / hill fixture reads with a clear sense of height
- [ ] resize does not crash the app
- [ ] `/state` reports at minimum:
  - source capture path
  - render mode
  - viewport size
  - whether sidebar / metadata panel is open
- [ ] `captureText()` or export path produces a useful artifact for review

## Suggested Agent Procedure

Use the control API, not manual clicking, for the smoke:

```bash
curl -s http://127.0.0.1:8099/health
curl -s http://127.0.0.1:8099/commands/list
curl -s http://127.0.0.1:8099/state
```

Open `WibWobWorld`, save captures, then open the isometric surface.

Always:
- read `GET /state` before move / resize
- use real window ids from live state
- verify parity with a screenshot or exported capture

Useful checks:
- compare the source capture with the isometric output side by side
- test at least one narrow window and one near-fullscreen window
- test sidebar open and closed if the view has a sidebar

## Non-Goals

- no need to solve full gameplay here
- no need to generate new terrain from scratch inside the isometric view
- no need to merge the isometric renderer into the top-down renderer yet
- no need to support arbitrary external files outside the repo

## Deliverable

A smoke-tested isometric / pseudo-3D terrain viewer over saved `WibWobWorld` captures, with enough state parity and stability that it can become a follow-on rendering mode later.
