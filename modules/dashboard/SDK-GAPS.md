# Dashboard SDK Gaps

What the dashboard builds by hand that could live in the microapp SDK,
making this module (and future ones) shorter and quicker to write.

Current index.ts: ~1200 lines. Estimated with these primitives: ~400-500.


## 1. Tabbed container

The dashboard spends ~60 lines building tab infrastructure from scratch:
a tab bar box, a content area box, a renderTabBar function, a switchTab
function, and per-digit key bindings. Every future tabbed microapp would
copy-paste the same thing.

SDK shape:

    const tabs = host.ui.createTabs(win.body, {
      tabs: [
        { name: "System", build: (container) => { ... } },
        { name: "Network", build: (container) => { ... } },
      ],
      keys: true,          // wire 1-9 automatically
      style: host.theme(), // re-applied on restyle
    });

    tabs.switchTo(2);
    tabs.active;           // current index
    tabs.onSwitch((idx) => { ... });

Returns the tab bar widget and per-tab containers. Handles show/hide,
key bindings, and the inverse-highlight tab bar rendering. The module
just provides the build callback per tab.

Lines saved: ~60 per tabbed module.


## 2. Tick loop via createTimer

The dashboard uses raw setInterval for its tick loop and manages a
timers array manually. The SDK already exports createTimer/clearTimers
but the dashboard predates that and never adopted it.

Not a new primitive, just a migration. But worth noting because the
current code leaks timers if close races the interval. createTimer
with the Set pattern handles that.

Lines saved: ~10, but eliminates a leak.


## 3. Figlet helper

The dashboard shells out to figlet via spawnSync on every tick for the
clock, and caches figlet renders for the mosaic. The SDK already has
host.ui.createFigletDisplay but the dashboard does not use it. If the
SDK figlet primitive also offered a plain string-returning function
(not just a widget), the dashboard could drop its own figlet helper
and the spawnSync import.

SDK shape (addition to existing):

    import { renderFiglet } from "../../src/services/microapp-sdk.js";

    const text = renderFiglet("HELLO", "slant");
    // returns string, no widget created, cached internally

Lines saved: ~10, removes child_process import.


## 4. Animated pattern box

The mosaic tab defines 11 pattern generator functions and a layout grid
of boxes that each run a generator on tick. This is a general concept:
a box that shows a ticking text pattern. The SDK could offer it as a
primitive, since glitchbox, the poetry clock, and other modules also
do animated text fills.

SDK shape:

    const pat = host.ui.createPatternBox(parent, {
      top: 0, left: 0, width: 20, height: 10,
      generator: (w, h, tick) => string[],  // return lines
      border: true,
      label: "Waves",
    });

    pat.tick(n);        // update content
    pat.destroy();

The 11 built-in patterns could ship as a patterns library importable
from the SDK, so any module can use them without copying 200 lines of
generator functions.

Lines saved: ~250 (pattern functions + box creation + update wiring).


## 5. contrib grid shorthand

Every tab that uses blessed-contrib follows the same pattern:
create container, create grid, call grid.set N times with nearly
identical options, wire update. A thin wrapper would cut the
boilerplate.

SDK shape:

    const { widgets } = host.ui.createContribGrid(container, {
      rows: 12, cols: 12,
      cells: [
        { row: 0, col: 0, rowSpan: 4, colSpan: 6,
          type: contrib.line,
          options: { label: " CPU ", showLegend: true } },
        { row: 0, col: 6, rowSpan: 4, colSpan: 6,
          type: contrib.bar,
          options: { label: " Network I/O " } },
      ],
    });

    // widgets[0] is the line, widgets[1] is the bar, typed
    widgets[0].setData(...);

This is a light convenience, not a deep abstraction. It just removes
the repetitive grid.set calls and collects the widgets into an array.

Lines saved: ~80 across 4 tabs that use contrib grids.


## 6. Data simulation helpers

sinWave, randHistory, xLabels are general-purpose fake data generators
useful for any dashboard or demo module. They are small but get
copy-pasted.

SDK shape:

    import { sinWave, randHistory, xLabels } from "../../src/services/microapp-sdk.js";

Tiny, but removes 20 lines and prevents divergent copies.


## 7. ANSI gradient line

The Creative tab builds ANSI true-colour gradient strings with an
hslToRgb helper. This is useful for any module that wants colour
bands or gradient fills in a plain box.

SDK shape:

    import { ansiGradientLine, hslToRgb } from "../../src/services/microapp-sdk.js";

    const line = ansiGradientLine(width, hueStart, hueEnd);

Lines saved: ~25, and other modules get gradients for free.


## Priority ranking

| Gap              | Lines saved | Reuse potential | Complexity to build |
|------------------|-------------|-----------------|---------------------|
| Tabbed container | ~60         | High            | Low                 |
| Pattern box      | ~250        | Medium          | Medium              |
| Contrib grid     | ~80         | Medium          | Low                 |
| Figlet function  | ~10         | High            | Trivial             |
| Gradient line    | ~25         | Medium          | Trivial             |
| Data sim helpers | ~20         | Low             | Trivial             |
| createTimer      | ~10         | Already exists  | Zero (migration)    |

The tabbed container is the highest-value addition: low effort, high
reuse, and it is the kind of structural boilerplate that discourages
people from building tabbed modules at all.
