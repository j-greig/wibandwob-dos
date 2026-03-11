# Known Bugs — Zine Freeform Canvas

## BUG: Arrow key nudge is intermittent

### Symptom
Arrow keys (and hjkl) to move a selected panel work for ~30 seconds,
then stop for ~30 seconds, then work again. Applies to ALL panels
equally — it is not panel-specific. Escape/Tab deselect works when
keys are working, and doesn't when they aren't.

### Five Whys

1. **Why don't arrow keys move the panel?**
   Because the canvas doesn't receive the keypress.

2. **Why doesn't the canvas receive the keypress?**
   Because blessed routes keys to the focused element, and something
   else periodically steals focus from the canvas.

3. **Why does focus get stolen?**
   Unknown. We already set `focusable = false` on panel frames and
   title bars. We call `canvas.focus()` on every panel click. The
   canvas.key bindings and win.onInput handler both bind arrow keys.
   Something else in the app (timer, render cycle, sidebar, status
   bar, toolbar) may be calling focus() on another element.

4. **Why is it periodic (~30s on, ~30s off)?**
   This pattern suggests a timer or interval. The zine has a 1-second
   live-content tick timer. The app may have other periodic processes
   (workspace save, status update, watcher callbacks) that trigger
   re-renders or focus changes.

5. **Why haven't we found the exact cause?**
   The bug is in blessed's focus model interacting with multiple
   elements across the app, not in our code alone. Debugging requires
   instrumenting blessed's focus() to log every caller.

### Attempted Fixes (all helped but none fully solved it)
- Removed `mouse: true` from scrollable canvas (fixed drag event consumption)
- Set `focusable = false` on panel frames and title bars
- Called `canvas.focus()` in panel mousedown handler
- Bound keys on both `canvas.key()` and `win.onInput()`

### Recommended Next Step
Build a minimal test module with ONE draggable box inside a window.
No sidebar, no toolbar, no live tick, no search. Strip away every
variable until arrow-key focus is reliable, then add features back
one at a time to find what steals focus.

This isolates whether the bug is:
  (a) in our zine module complexity
  (b) in the app-controller / window-manager focus model
  (c) in blessed itself
