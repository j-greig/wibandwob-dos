# Hello World v2 — Handover Note

## What exists now (working)

The module is at `modules/hello-world/index.ts`. It typechecks. The app
runs. The following works:

- Responsive layout with 4 breakpoints: XL, L, M, S
- Font cascade: HELLO WIBWOBWORLD at huge sizes, HELLO WORLD with
  larry3d -> slant -> small -> smslant -> digital -> CAPS
- XL: 2-col grid with row spanning (contour spans 2 rows left,
  stats top-right, clock bottom-right)
- L: 2-col (contour left, clock right)
- M: banner + info text
- S: banner only
- Contour art: static sine-field generator, click to regenerate seed
- Toolbar: 1-row black bar at top, visible at L+ sizes. Contains
  app label, compass buttons, regen button, mode indicator.
  CONFIRMED RENDERING in latest screenshot.
- Status bar: bottom row, always visible, shows mode/size/debug info
- multiInstance: false in module.json (prevents duplicate windows)

## What needs fixing

### 1. Compass alignment (banner text positioning)
STATUS: Partially working. The toolbar compass buttons exist and are
clickable. The `applyCompass()` function sets blessed `align`/`valign`
on the bannerBox. We strip trailing whitespace from figlet lines so
horizontal alignment has room to work.

PROBLEM: Not verified visually yet. The bannerBox gets `bannerAllocH`
rows (more than the figlet needs) to give vertical alignment room.
But we haven't confirmed that blessed actually repositions the content
when align/valign are changed after creation.

TEST: Click a compass button (e.g. SE), check if the figlet text
moves to bottom-right of the banner area. If not, we may need to
manually pad the content string (add leading spaces for right-align,
add leading newlines for bottom-align) rather than relying on
blessed's align/valign properties.

FALLBACK: If blessed align/valign don't work reliably, implement
manual content padding in `applyCompass()`:
  - right: pad each line with leading spaces
  - center: pad each line with half-leading spaces
  - bottom: prepend empty lines
  - middle: prepend half the empty lines

### 2. Cats (docked Wib & Wob ASCII art)
STATUS: The dockTo primitive creates the art box, positions it at
bottom-right of root, and calls setFront(). The art IS in the code.

PROBLEM: Not visible in latest screenshots at XL size. The z-order
chain is: content panels -> toolbar.setFront() -> statusBar.setFront()
-> art.node.setFront(). Art should be on top.

POSSIBLE CAUSES:
  a) art.layout(w, h-2) — the h-2 might make the parent dimensions
     too small for the minParentHeight check (ART_H + 10 = 17).
     At h=40, h-2=38, which is > 17. Should be fine.
  b) The art node is behind root's child painting order somehow.
  c) art.visible is false for an unexpected reason.

TEST: Add a debug line to status bar showing art.visible and
art.node.top/left after layout. Or simplify: temporarily set
minParentWidth/Height to 0 to force it visible.

### 3. Toolbar compass button clicks
STATUS: Buttons exist, styled, have click handlers that set
compass state and call doLayout(). Highlight styling toggles.

PROBLEM: Not tested interactively yet. Need to verify:
  - Click on "SE" button highlights it and moves banner text
  - Click on auto button resets to default NW alignment
  - Keyboard keys 1-9 and 0 still work

### 4. Clean up debug traces
The status bar currently shows `tb=true cTop=1` debug info.
Remove these before committing.

## What's done and should not be revisited

- createGrid primitive: works. Row spans, col spans, fr units, gap.
  Validated by the XL grid (contour spans 2 rows).
- dockTo primitive: API is correct. Just needs z-order debugging.
- pickBreakpoint: works perfectly.
- Responsive figlet title: WIBWOBWORLD at huge sizes, HELLO WORLD
  otherwise. 12-line threshold prevents ugly wrapping.
- Toolbar layout and styling: renders correctly at XL.
- Font cascade and figlet integration: solid.

## Logical order of remaining work

1. Fix cats visibility (likely simple — debug art.visible)
2. Test compass alignment visually (click SE, verify text moves)
3. If compass doesn't work, implement manual padding fallback
4. Remove debug traces from status bar
5. Test all 4 breakpoints (resize to XL, L, M, S)
6. Screenshot each mode for the record
7. Commit hello-world v2
8. Update planning docs with findings
9. Add Tailwind responsive patterns to layout audit doc

## Key learnings for future self

- ALWAYS restart the app with kill -9 and a fresh tmux session when
  testing module changes. The old process survives SIGTERM sometimes.
  Check the session ID in /health response.
- blessed's align/valign MAY not work for multi-line content that
  has trailing whitespace. Always trimEnd() lines first.
- blessed z-order: setFront() must be called AFTER all content is
  set, not before. The render order matters.
- The screenshot-window.sh tool captures TEXT only, not colours.
  A black toolbar row is invisible in screenshots unless you look
  at the text content. Use the actual tmux view for colour debugging.
