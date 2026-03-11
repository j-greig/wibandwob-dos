# Dashboard (blessed-contrib grid) vs sy2-chronicles (panel layout)

Two modules that both tile content into a grid, using completely different
strategies. This is a detailed structural comparison.


## Architecture at a glance

                   Dashboard                    sy2-chronicles
  Layout engine    blessed-contrib grid         SDK layoutPanels + PanelDef
  Cell type        contrib widgets (line,       blessed boxes with string
                   bar, gauge, donut, lcd,      content rendered by type
                   sparkline, log, table, map)  dispatcher (text, figlet,
                                                ascii-art, pixel, markdown,
                                                infographic, mixed, webcam,
                                                animated-text)
  Scroll           none (fixed viewport)        scrollable canvas, j/k/wheel
  Interactivity    tab switching (1-7)          drag panels, dbl-click edit,
                                                search, minimap, resize grip,
                                                webcam toggle, agent commands
  Animation        setInterval tick loop        createTimer tick loop (120ms)
  Content origin   inline JS data generators    inline JS + YAML hot-reload
                                                + file-loaded ASCII art
  Lines            655 (v2, was 1201)           2500
  SDK primitives   9 (createTabs, renderFiglet, ~25 (layoutPanels, hitPanel,
                   PATTERNS, sinWave, etc)      pointerToContent, drawArrow,
                                                blankGrid, paintText, bar,
                                                waveLine, createButtonBar,
                                                createInlineSearch,
                                                renderFiglet, renderMarkdown,
                                                renderContour, MonsterCamService,
                                                renderWebcamFrame, clamp,
                                                createTimer, clearTimers, ...)


## How they place things

DASHBOARD uses blessed-contrib's grid object:

    const grid = new contrib.grid({ rows: 12, cols: 12, screen: container });
    const line = grid.set(0, 0, 4, 6, contrib.line, { label: "CPU" });

grid.set(row, col, rowSpan, colSpan, WidgetClass, options) creates a
widget at a fixed fractional position within the container. The grid
owns all placement math. You get back a contrib widget (line chart, bar,
gauge, etc.) and call setData on it each tick.

Advantages:
  - Zero manual coordinate math
  - Widget types have built-in rendering (charts, gauges, sparklines)
  - Dense: 8 widgets in 12 grid.set calls = a full dashboard tab

Disadvantages:
  - contrib widgets are opaque — you cannot control their rendering
  - No scroll, no drag, no resize — it is a fixed viewport
  - The "screen" parameter is a lie: it accepts any blessed box but
    contrib internally assumes screen-level coordinates, causing
    miscalculation when nested inside tabs or offset containers
  - Widget types are limited to what contrib provides (circa 2015)
  - No content export — you cannot captureText from a chart
  - Widgets crash silently if updated while hidden (hence the
    "only update active tab" guard)


SY2-CHRONICLES uses the SDK's layoutPanels:

    const defs: PanelDef[] = panels.map(toPanelDef);
    const layout = layoutPanels(defs, viewportWidth);
    for (const placement of layout.placements) {
      node.frame.left = placement.x;
      node.frame.top = placement.y;
    }

layoutPanels is a row-flow packer: panels go left-to-right, wrapping
when they exceed maxWidth. Each panel is a plain blessed box with string
content rendered by a type dispatcher.

Advantages:
  - Content is just strings — captureText, search, edit all work
  - Scrollable canvas — no viewport size limit
  - Panels are draggable, editable, resizable
  - Hot-reload from YAML files
  - Agent commands can inspect/move/write any panel
  - Arrow overlays between related panels
  - Minimap view

Disadvantages:
  - No built-in chart widgets — you write your own (bar, waveLine, etc)
  - More code per panel (content callback + dimensions)
  - Layout is flow-based, not grid-based — precise 12x12 placement
    requires manual coordinate overrides
  - Complex scroll/focus/mouse management (300+ lines of handlers)


## Where they overlap and diverge

Both modules solve the same problem — tile N visual elements into a
bounded area and update them on a tick. The critical difference:

  contrib grid: the WIDGET does the rendering (chart, gauge, map)
  panel layout: the MODULE does the rendering (string callbacks)

This means contrib dashboards are quick to write but opaque. Panel
layouts are verbose but transparent. You can search, edit, serialize,
and agent-control panel content because it is just text. You cannot
do any of that with a contrib sparkline.


## What the dashboard CANNOT do that sy2 can

  - Scroll through more content than fits in the window
  - Drag panels to rearrange them
  - Double-click to inline-edit content
  - Agent commands: panel.list, panel.inspect, panel.move, panel.write
  - Hot-reload content from YAML without restart
  - Arrow overlays between related panels
  - Minimap (z key)
  - Search/filter panels (/ key)
  - Webcam integration
  - Workspace persistence (save/restore scroll position)
  - Resize individual panels (terrain grip)
  - Pause/resume animation


## What the dashboard CAN do that sy2 cannot

  - Real charts: line graphs with axes, legends, data series
  - Real gauges: donut, gauge, gaugeList with animated fills
  - Real sparklines: inline mini-charts
  - LCD displays: segmented digit counters
  - World map: actual Mercator projection with markers
  - Log widgets: scrolling log output with buffering
  - Tables: column-aligned data with selection highlighting
  - Bar charts: labelled bars with auto-scaling

These are all blessed-contrib widgets. They render their own content
using canvas-like drawing into the terminal. Reproducing them as string
callbacks would be a major effort (hundreds of lines per widget type).


## Could they converge?

Partially. Three possible directions:

1. CONTRIB INSIDE PANELS: Use layoutPanels for placement but render
   contrib widgets inside panel frames. This gives scroll + drag +
   search on the chrome while keeping real charts inside. Problem:
   contrib widgets assume they own their container and fight with
   manual sizing. Requires patching contrib or wrapping carefully.

2. TEXT-BASED CHARTS: Write string-based chart renderers (ASCII line
   charts, ASCII bar charts, ASCII gauges). sy2 already has bar() and
   waveLine(). A fuller set would let panels replace contrib for
   simpler cases. The chiptune-studio skill already generates ASCII
   waveform displays. But no amount of ASCII will match a real
   sparkline or donut for information density.

3. HYBRID TAB MODEL: Dashboard tabs 1-4 (data-heavy) stay on contrib
   grids. Tabs 5-7 (creative, mosaic, emoji) move to panel layout
   since they are all string-based anyway. The tab container (now in
   the SDK) makes mixing easy. This is probably the pragmatic path.


## Line-count breakdown

  Dashboard v0 (1201 lines):
    Tab infrastructure:        ~60
    Helper functions:          ~40
    Tab 1 System:             ~100
    Tab 2 Network:            ~100
    Tab 3 App Metrics:        ~120
    Tab 4 World Map:          ~110
    Tab 5 Creative:           ~100
    Tab 6 Mosaic:             ~250 (pattern generators + layout)
    Tab 7 Emoji:              ~150 (test definitions + renderer)
    Lifecycle/setup:           ~70

  Dashboard v2 (655 lines):
    Same structure, SDK primitives absorb ~550 lines.

  sy2-chronicles (2500 lines):
    Panel definitions (inline): ~750 (40+ panels with content callbacks)
    Panel type system:          ~250 (panel-types.ts)
    Content loader:             ~100 (content-loader.ts)
    Window setup + layout:      ~200
    Scroll/mouse/drag handlers: ~300
    Editor/search/minimap:      ~200
    Agent commands (S09):       ~200
    Webcam integration:         ~100
    Restyle/cleanup/snapshot:   ~100
    Donut renderer:              ~50
    Remaining wiring:           ~250

The modules are not comparable on lines alone. sy2 is an interactive
document viewer with agent integration. Dashboard is a data display.
But the comparison shows where the SDK helps and where it does not:
blessed-contrib gets you charts for free, but walling you off from
everything else the SDK provides.
