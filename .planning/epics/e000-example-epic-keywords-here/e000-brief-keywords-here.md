---
Status: not-started
Type: epic
GitHub issue: —
PR: —
---

# E018 — Chaos vs Order Terrain Generator

## TL;DR

Extend Contour Studio with an "ordered grid" system inspired by the `chaos-vs-order` primer. Binary 0/1 grids cluster and grow using the same hill-placement algorithms as contours. Phase 2 mixes both: contour curves fill hills, ordered grids fill flats/plateaus. The result is a living map where chaos and order coexist.

## Inspiration

From `primers/chaos-vs-order.txt`:
```
  CHAOTIC SYSTEMS    &     ORDERED SYSTEMS    
  ╭─╮  ╭╮ ╭╮   ╭╮          ┌─┬─┬─┬─┬─┬─┬─┬─┐  
  ╰╮╰╮╭╯╰─╯╰╮ ╭╯╰╮         │1│0│1│0│1│0│1│0│  
   ╰╮╰╯   ╭─╯╭╯  │         ├─┼─┼─┼─┼─┼─┼─┼─┤  
```
Contour curves = chaos (organic, flowing). Binary grids = order (rigid, structured).

## Features

### F01 — Ordered Grid Engine
- [ ] Binary grid renderer: `┌─┬─┐ │0│1│ ├─┼─┤` using box-drawing chars
- [ ] Grid clusters placed using same hill-shape algorithms (gaussian, polygon, ellipse, superellipse, asymmetric)
- [ ] Grid "density" parameter: how many cells per cluster, cell size (1x1, 2x2, 3x3)
- [ ] Grid content patterns: checkerboard 0/1, sequential, random bits, hex values
- [ ] Standalone `--terrain ordered` mode in contour_stream.py
- [ ] Grow mode: grid clusters appear one-by-one like hills

### F02 — Hybrid Chaos+Order Mode
- [ ] Height threshold splits: below threshold = grid zones, above = contour zones
- [ ] Or inverse: hilltops are grid plateaus, valleys are contour chaos
- [ ] Compositing: grid cells rendered on top of blank/flat areas, contours rendered where height varies
- [ ] New terrain types: `chaos_order`, `ordered_peaks`, `grid_valley`
- [ ] Configurable chaos/order ratio (key: `c` to shift balance)

### F03 — Contour Studio Integration
- [ ] New key `o` — toggle ordered grid overlay
- [ ] New key `c` — cycle chaos/order balance (0% order → 25% → 50% → 75% → 100%)
- [ ] Status bar shows mode: `CHAOS`, `ORDER`, `CHAOS+ORDER 50%`
- [ ] API params: `mode=chaos|order|hybrid`, `order_ratio=0.5`
- [ ] Triptych: chaos | hybrid | order side-by-side

### F04 — FIGlet Placename Labels (Python-side)
- [ ] Place FIGlet-rendered text labels at terrain features (peaks, valleys, grid clusters)
- [ ] Python shells out to `figlet` binary (same as C++ `figlet_utils` does — no duplication, consistent)
- [ ] Label placement algorithm: find largest flat areas near peaks/clusters, stamp FIGlet text
- [ ] Auto-generate placenames from terrain type + seed (deterministic)
- [ ] Font selection: small fonts (mini, small, banner3) to fit within map features
- [ ] Labels rendered as overlay layer in Python — composited on top of contours/grids before piping
- [ ] `--labels` flag enables labels, `--no-labels` disables (default: off)
- [ ] Key `l` in C++ view — toggles labels, relaunches subprocess with/without `--labels`
- [ ] Graceful fallback: if `figlet` binary not found, skip labels silently

## Architecture

All in Python (same subprocess pattern). The ordered grid is a second rendering pass:

1. Generate heightmap (existing)
2. Threshold into zones: "flat" vs "hilly"
3. Flat zones → binary grid renderer
4. Hilly zones → marching squares contour renderer (existing)
5. Composite both layers

Grid clusters use the same `make_hill()` placement but instead of contributing to a heightmap, they define regions where grid cells appear. The "hill" radius determines grid cluster size, peak determines grid density.

## Open questions

- Should grid cells contain actual data (0/1/hex) or just structural patterns (`┼─┤`)?
- Does the grid need to align to a global grid, or can each cluster have its own local grid?
- Should the chaos/order boundary be hard (threshold) or soft (blend zone with partial grid)?
- Could add animation: grid cells flipping 0→1 over time, contours shifting

## Estimated effort

Medium. F01 is ~1 session (grid renderer + hill placement). F02 is ~1 session (compositing). F03 is small (keys + status bar). Total: 2–3 sessions.
