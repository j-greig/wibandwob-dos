---
id: spk-plasma-fullscreen
title: Plasma fullscreen mode — F key, no chrome
status: in-progress
branch: spike/plasma-fullscreen
created: 2026-03-07
---

# Spike: Plasma fullscreen mode

## Goal

Press F inside a Plasma window → fills entire terminal, no chrome (no header,
status bar, divider, info panel). Press F again → back to normal.

## Approach

Single `fullscreen: boolean` flag in openPlasmaWindow closure.

Enter fullscreen:
1. Save current frame rect (top/left/width/height)
2. Move frame to 0,0, resize to screen.cols × screen.rows
3. doLayout() with fullscreen=true — canvas fills body, other parts hidden

Exit fullscreen:
1. Restore saved rect
2. doLayout() with fullscreen=false — normal stack layout

## AC

- [ ] F toggles in/out from canvas, frame.frame, frame.body
- [ ] In fullscreen: header, status bar, divider, info panel not visible
- [ ] Canvas fills full body area
- [ ] Frame covers entire terminal
- [ ] Exit restores exact previous position and size
- [ ] typecheck passes
