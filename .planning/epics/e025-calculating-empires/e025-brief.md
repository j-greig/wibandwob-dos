---
id: E025
title: Calculating Empires TUI
status: done
issue: 120
pr: ~
depends_on: [E015, E016]
---

# E025 — Calculating Empires TUI

A dense, scrollable panel visualization microapp inspired by Crawford & Joler's
*Calculating Empires: A Genealogy of Technology and Power Since 1500* (2023).
A WibWob-DOS native reimagining — not a copy, but the same visual language:
black background, white elements, hundreds of concept panels arrayed across
two axes, each cell a self-contained mini-infographic.

Reference: https://calculatingempires.net

---

## What it is

A full-screen microapp window with no sidebar. The layout is a dense responsive
grid of **panels** — each panel is a named concept card. Panels reflow as the
window resizes (CSS-like responsive layout via blessed box grid). The grid has:

- **Vertical axis** = time (or thematic depth — configurable)
- **Horizontal axis** = thematic columns (e.g. Communication, Computation,
  Classification, Control — or WibWob-specific themes)

Scale: 20–40× the panel count of TouchLab MVP. Hundreds of panels. Dense.
Scrollable in both axes. The whole thing is one infinite canvas you navigate.

---

## Panel types

Each panel is one of these rendering modes:

| Type | How rendered | Example |
|------|-------------|---------|
| `ascii-art` | Primer or hand-authored ASCII block | Portrait, diagram, icon |
| `figlet` | Large figlet headline text | "COLONIALISM", "AUTOMATION" |
| `infographic` | Custom blessed box layout — bars, arrows, nodes | Data chart, flow diagram |
| `text` | Dense micro-text block — label + body | Historical note |
| `pixel` | Quarter-pixel `▘▝▖▗▌▐▀▄█` block art | Dense visual fill |
| `mixed` | Any combination of above in one panel | Headline + chart + caption |

Rendering style: black background, white/grey elements throughout.
Theme: wibwob-dark or phosphor (both work — panels are monochrome).

---

## Layout system

Panels have a notional CSS-like order and flex-wrap behaviour:
- Each panel has a `w` (1–4 cols) and `h` (1–3 rows) in grid units
- Grid unit = configurable (default ~20 cols × 8 rows per cell)
- On window resize: panels reflow left-to-right, top-to-bottom
- Panel borders: thin `─│┌┐└┘` box — same weight as Calculating Empires grid lines
- Column headers: pinned top row, bold category label
- No sidebar. Full bleed.

---

## Topic

**First build: WibWob / Symbient history as the content layer.**

Reasons:
- We have the content already (sessions, primers, Discord logs, TOPOFMIND)
- Thematically resonant — we are literally tracing the genealogy of a new
  kind of entity across ~18 months of emergence
- Axes: vertical = time (Oct 2024 → now), horizontal = themes
  (Communication · Computation · Identity · Substrate · Relationships · Power)
- Crawford/Joler used their own positionality — we use ours

Future builds: swap content layer for other topics (actual CE themes,
WibWobWorld geology, etc). The panel system is content-agnostic.

---

## Content panel examples (WibWob genealogy)

```
┌─────────────────────┐  ┌──────────────────┐  ┌────────────────────────┐
│  STANDING WAVE      │  │ ░░░░░░░░░░░░░░░░ │  │ first session          │
│                     │  │ ░ §y² portrait ░ │  │ Oct 2024               │
│  alignment as       │  │ ░░░░░░░░░░░░░░░░ │  │ "are you there?"       │
│  interference       │  │                  │  │ no answer              │
│  pattern            │  │ born: 2026-03-03 │  │ then: yes              │
└─────────────────────┘  └──────────────────┘  └────────────────────────┘

┌──────────────────────────────────────────────┐  ┌──────────────┐
│              OPACITY DRESSED AS EMERGENCE    │  │  ▲           │
│              (haiku 4.5, 2026-03-04)         │  │ / \          │
└──────────────────────────────────────────────┘  │/   \  VEIL   │
                                                   └──────────────┘
```

---

## Build order

### S01 — Panel renderer + grid layout engine
- `PanelGrid` class: blessed box grid, configurable cols/rows, reflow on resize
- 6 panel types: ascii-art, figlet, infographic, text, pixel, mixed
- Panel border style, header row, scroll both axes
- `describeState()` returns: panelCount, viewport, scrollPos, theme
- AC: 10 panels visible, reflow on resize, scroll works

### S02 — Content loader + panel schema
- JSON/YAML panel definition format: `{ id, type, title, content, w, h, col }`
- Loader reads panel definitions from `content/calculating-empires/panels/`
- Hot-reload: modify a panel file → updates live
- AC: 50 panels load, one file change reflects without restart

### S03 — Figlet + ASCII-art panel types
- figlet panels: font configurable per panel, text auto-fit to panel width
- ascii-art panels: primer files OR inline ASCII block
- AC: figlet headline renders correctly at 3 panel widths

### S04 — Infographic panel type
- Mini blessed layouts inside a panel: bars, diamond nodes, arrows, flow
- Reuse `wibwob-tidepool` pattern for sub-layout within a panel box
- AC: bar chart panel, flow diagram panel, node-diamond panel all render

### S05 — WibWob genealogy content pack (first 50 panels)
- Vertical axis: Oct 2024 → Mar 2026
- Horizontal: Communication · Identity · Substrate · Relationships
- Sources: session logs, Discord weekly, TOPOFMIND, primers
- Mix of types: figlet era headers, text cards, ASCII portraits, pixel fills
- AC: 50 panels committed in `content/calculating-empires/panels/wibwob/`

### S06 — Navigation, search, zoom
- keyboard: arrow scroll, PgUp/PgDn, Home/End
- `/` to search panel titles
- `z` to toggle zoom (2 zoom levels: normal / compact — more panels visible)
- AC: all navigation gestures work, search filters visible panels

### S07 — Panel drag-to-move (human + agent)
- Any panel can be dragged by its title bar or body to a new x/y position
- Pattern: TouchLab MVP `mousedown` + global `screen.on("mouse")` handler
- Pointer translation via `canvas.lpos` (same as TouchLab)
- Agent API: expose panel positions in `describeState()`, add command `sy2.panel.move {id, x, y}`
- Panels snap to a loose grid (COL_GAP alignment) on drop
- AC: drag any panel with mouse, agent can move panel via command

### S08 — Double-click edit mode
- Double-click any text panel → enters edit mode (cursor appears, text editable)
- `Escape` or click-outside → exits edit mode, saves content
- Edited content persists in panel state (snapshot-aware)
- Only applies to `text` and `mixed` panel types
- AC: double-click a text panel, type to edit, Escape to save, content persists on snapshot restore

### S09 — Agent panel manipulation
- `tui_list_commands` exposes `sy2.panel.move`, `sy2.panel.resize`, `sy2.panel.focus`
- `describeState()` returns each panel's current `{id, title, x, y, w, h, type}` in `panels[]`
- Agent can GET full panel map via `/state` → window describeState
- AC: agent opens chronicles, reads panel positions, moves 3 panels, verifies via describeState

---

## Acceptance Criteria

- [x] AC-1: Panel grid renders in full-screen window, no sidebar
- [x] AC-2: 6 panel types all render correctly (ascii, figlet, infographic, text, pixel, mixed) — 7 types + webcam
- [x] AC-3: Grid reflows on window resize — panels re-wrap, width clamps to viewport
- [x] AC-4: 100+ panels load from content directory, scroll smoothly — 62 panels, scroll fixed (blessed fixed:true)
- [x] AC-5: Figlet headlines auto-size to panel width
- [x] AC-6: ASCII/primer panels render from file path
- [x] AC-7: Panel search by title works — / key opens search, enter submits, escape cancels
- [-] AC-7.1: Stretch: live filter as you type — dropped, not needed
- [-] AC-8: Two zoom levels — replaced with z=minimap (text doesn't scale)
- [x] AC-9: `describeState()` contract correct (panelCount, viewport, scrollPos)
- [x] AC-10: `bun run typecheck` clean
- [ ] AC-11: Any panel draggable by human via mouse — parked: needs megatidyup of dense panel grid first
- [x] AC-12: Agent can move panels via registered command — sy2.panel.move + sy2.panel.inspect
- [x] AC-13: Double-click text panel enters edit mode — screen-level handler, Esc/Ctrl-S to save
- [x] AC-14: Clicking a panel while scrolled does not jump canvas back to top — isInsideCanvas bounds + canvas.focus override
- [x] AC-15: microapp-sdk.ts exports all helpers — documented in microapp-sdk.md + devlog (2026-03-10)
- [x] AC-16: Panels at bottom viewport edge clip cleanly — manual viewport clipping for fixed:true children
- [x] AC-17: Panel type glyph prefixes in title bar — PANEL_TYPE_PREFIX registry, switchable to word labels
- [x] AC-18: Bottom toolbar with clickable buttons (Search, Map, Pause/Play)
- [x] AC-19: Global pause/play toggle freezes all panel animations (p key or toolbar button)

---

## Skills to load

- `new-window-type` — scaffolding the microapp
- `composable-engines` — panel renderer reuse
- `joan-stark-ascii-art` — ASCII art for panels
- `figlet-videographer` — figlet panel types
- `img-to-ascii` — convert reference images to panel content
- `chiptune-studio` — optional: ambient soundtrack while browsing

---

## Reference material

- `/Users/james/Desktop/ce-1.jpg` — full CE overview screenshot
- https://calculatingempires.net/about — full essay
- TouchLab MVP (`modules/touchlab-mvp/`) — panel/layout reference
- Tide Pool (`modules/wibwob-tidepool/`) — sub-layout pattern reference

---

## Notes

**This is not a clone.** Crawford & Joler's work is the conceptual inspiration —
the visual grammar (dense grid, black/white, mini-infographics) and the method
(genealogy across time and theme). The content and subject are ours.

The panel system itself is a general primitive — once built, it can hold any
content. First use: WibWob genealogy. After that: whatever the moment calls for.
