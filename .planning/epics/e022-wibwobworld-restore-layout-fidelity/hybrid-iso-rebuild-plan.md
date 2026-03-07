# Hybrid ISO Rebuild Plan

## Idea
Rather than debugging the broken hybrid iso implementation, revert the private
module to a clean working state (no hybrid iso), then use codex to extract a
spec from the broken commits, write a clean PRD, and build it fresh.

## Steps

1. Revert modules-private to last known-good commit before hybrid iso was added
   — target: c6aae56 (fix: skip restore if sourcePath missing)
   — this keeps: F08 cursor, world chat, mode buttons, firstperson, contours
   — this removes: hybrid split, inline iso render

2. Use codex-analyst to read the two hybrid commits (2690f0e + 38d25a4) and
   extract a clean spec — what it was TRYING to do, not what it did

3. Write spec to: .planning/prd-hybrid-iso-mode.md
   — WibWobWorld window split 50/50 left=contour right=iso
   — iso rendered inline from live terrain (no file I/O, no separate window)
   — correct dimensions from frame.parent not win.body
   — render only when terrain changes, not every tick
   — no rotation in v1

4. Codex-worker builds it from the PRD against the clean branch
   — agent manages, human never sees the broken state again

## Source commits to analyse
- modules-private 2690f0e — hybrid split added
- modules-private 38d25a4 — rotation added (broke everything)
- renderIso lives in wibwobworld-iso/index.ts
- wibwobworld/index.ts is the host window

## Key constraints codex must respect
- use frame.parent.width/height not win.body.width (returns NaN)
- cache artifact — only recreate when seed/seaLevel/levels/terrainIdx changes
- guard: if innerW < 1 || innerH < 1 bail out of render
- no rotation in v1 — single NE viewpoint only
- default renderMode stays "hybrid" on fresh open
