---
id: spk-plasma-fullscreen
title: Fullscreen + chromeless primitives — plasma F key + desktop right-click
status: done
branch: spike/plasma-fullscreen
created: 2026-03-07
---

# Spike: Fullscreen + Chromeless Primitives

## Two features, same lego bricks

### Feature A — Plasma fullscreen (F key) ✓ DONE
Inside a plasma window, F hides window chrome (header, status, divider, info panel)
and expands the frame to fill the terminal. F again restores.

### Feature B — Desktop chromeless mode (right-click on empty desktop)
Right-click on the desktop background (not on a window) hides the top menubar and
bottom DOS statusbar. Right-click again shows them. Useful for screensaver/display mode.

---

## Shared primitives (extracted from Feature A, reused by Feature B)

### Primitive 1: animation pause guard
Before any geometry mutation on an animated window — pause the player,
do the changes, resume. Prevents blessed element-tree mutations racing
with the animation timer's screen.render() calls.

Pattern established in plasma-window.ts toggleFullscreen:
  if (!wasPaused) player.togglePause()
  ... geometry changes ...
  setTimeout(() => { ... resume if !wasPaused; }, 50)

### Primitive 2: safe chrome hide/show
Don't use visible() callbacks in createStack/createColumns — they run
during the layout engine's inner loop (including inside resizeWindow's
internal refresh() call). Call node.hide() / node.show() manually,
AFTER geometry is settled, outside the layout cycle.

### Primitive 3: fullscreen-aware doLayout
When fullscreen flag is true, bypass root.layout() entirely and use
applyRect(canvas, fullRect) directly. root.layout() calls node.show()
on all children — bypassing it lets hidden chrome nodes stay hidden.

### Primitive 4: desktop chrome toggle (Feature B)
Same pattern as Primitive 2 but for the top-level DOS chrome:
  - menuBar node (top of screen)
  - bottomBar / statusBar node (bottom of screen)
These live in app-controller.ts, not inside a window.
Toggle hides/shows both. No animation to pause — static chrome.
Right-click handler on the desktop blessed.box detects whether click
landed on a window frame (skip) or empty desktop (trigger toggle).

---

## Implementation plan

### S01 — Plasma fullscreen ✓ DONE
commit 8fc6bec on spike/plasma-fullscreen

### S02 — Extract primitives to shared util
Location: src/core/fullscreen-utils.ts (or inline in app-controller)

Extract from plasma-window.ts:
  enterWindowFullscreen(deps, frame, player, savedRectRef, doLayout)
  exitWindowFullscreen(deps, frame, player, savedRectRef, doLayout)

These become reusable for any future animated window (contour, wibwobworld etc).

### S03 — Desktop chromeless mode
- [x] Find where menuBar and bottomBar nodes live in app-controller.ts
- [x] Add `desktopChromeless: boolean` flag to AppController
- [x] Add `toggleDesktopChrome()` — hide/show menuBar + bottomBar + screen.render()
- [x] Wire right-click on desktop.box:
      desktop.on("click", (data) => {
        if (data.button === "right") this.toggleDesktopChrome();
      })
      Check that the click didn't land on a window frame before toggling.
- [x] Add command: desktop.toggle_chrome (so agent can also trigger it)

### S04 — Merge spike → main
- [x] typecheck clean
- [x] Test: F in plasma → fullscreen → F back → restored
- [x] Test: right-click empty desktop → chrome hidden → right-click → restored
- [x] Test: plasma fullscreen + desktop chromeless together (stacked)
- [x] PR + merge

---

## Key architectural lesson

Animated rendering does NOT need to live higher in the app hierarchy.
Keep plasma as a normal window. The fix is:
  1. Centralise render ownership during transitions (pause the ticker)
  2. Never mutate visibility inside the layout cycle
  3. Fullscreen = geometry change + manual chrome hide, not a layout mode

Source: codex architectural analysis 2026-03-08.
