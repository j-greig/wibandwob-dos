# WibWobWorld ISO Render Fix — Root Cause & 5 Whys

## What was fixed
WibWobWorld window froze the entire blessed TUI on open when render mode was
`hybrid` or `iso`. The app process stayed alive at 100-150% CPU, the screen
went blank, and the API stopped responding. No crash, no error log — just a
permanent hang.

## The Fix (two lines)

**Fix 1 — correct dimension source** (`wibwobworld/index.ts`, `render()`):
```ts
// BEFORE — returns NaN (blessed stores it as "100%-2" string expression)
const innerW = Math.max(0, Number(win.body.width) || 0);

// AFTER — reads from the frame element which has a real numeric width
const frame = (win.body as any).parent;
const fw = Number(frame?.width);
const innerW = Math.max(0, (Number.isFinite(fw) ? fw : 0) - 6);
if (innerW < 1 || innerH < 1) return; // bail before any setContent
```

**Fix 2 — guard the sidebar update** (`wibwobworld/index.ts`, `render()`):
```ts
// BEFORE — always fires, even when infoBlock is collapsed to width 0
if (sidebarOpen) { infoBlock.update({ text: largeString }); }

// AFTER — only fire when the node is actually visible
if (sidebarOpen && Number(infoBlock.node.width) > 0) {
  infoBlock.update({ text: largeString });
}
```

---

## 5 Whys

### Why did the app freeze?
`host.screen.render()` never returned. The blessed rendering pipeline entered
an infinite loop and never yielded the event loop.

### Why did screen.render() loop infinitely?
`infoBlock.update(text)` was called with a 30-line sidebar string on a node
that had been collapsed to `width: 0`. `infoBlock` is a `scrollable: true`
blessed box. Blessed's word-wrap algorithm for scrollable nodes divides content
into lines by the node width. At width=0 it cannot make progress and loops
forever trying to wrap each character.

### Why was infoBlock at width 0?
In hybrid/iso/firstperson modes, the sidebar is intentionally collapsed —
`applyRect(infoBlock.node, { left: rect.width, width: 0, height: 0 })` — to
hide it without using `.hide()` (which triggers blessed resize event storms).
The guard `if (sidebarOpen)` only checked the toggle flag, not whether the
node actually had space to render into.

### Why was the sidebar toggle flag not enough?
`sidebarOpen` reflects user intent, not layout reality. In hybrid/iso mode the
layout explicitly collapses the sidebar regardless of the flag (there is no
space for it). The flag and the layout were out of sync.

### Why did it take so long to find?
The hang produced no JavaScript error and no crash — `catch` never fired
because the infinite loop was inside blessed's C-binding word-wrap, not in our
JS. The event loop was blocked so the API stopped responding. Debug breadcrumbs
added with `debugWibWobWorld()` + `WIBWOBWORLD_DEBUG=1` narrowed it to
`render:iso-setcontent-done` → hang, but `infoBlock.update()` fires AFTER that
in the same render pass. Adding `render:before-screen-render` finally confirmed
the hang was in `host.screen.render()` which then implicated the blessed
rendering pipeline, not our render logic.

---

## What NOT to do (learned the hard way)

- **Never call `setContent` on a scrollable blessed node with width=0.**
  Word-wrap at width=0 is an infinite loop. Always guard with a width check.

- **Never read `win.body.width` or `win.body.height` for layout math.**
  Blessed resolves these lazily and returns string expressions (`"100%-2"`)
  that `Number()` converts to NaN. Use `(win.body as any).parent.width`
  (the frame element) which is set to a real numeric value by `createWindow`.

- **Never `kill -9` the app.** Use `kill $(cat scratch/wibwob.pid)` or
  `pkill wibwob-dos`. SIGKILL skips blessed cleanup, leaking mouse tracking
  escape codes and the alternate screen sequence into the terminal.

---

## Working state tag
`v-iso-singular-working` — singular ISO mode (full-window), contours, terrain,
firstperson all confirmed working. Hybrid split (50/50) not yet built.
