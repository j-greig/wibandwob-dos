---
Status: not-started
Type: feature
Parent: E018
GitHub issue: —
PR: —
---

# F07 — Help Modal with Visual Terrain Guide

## TL;DR

Press `H` (or click `[?:Help]` in the button strip) to open a modal dialog showing all 7 terrain types as tiny ASCII art thumbnails with 1–2 sentence descriptions, plus a key reference card.

## Design

Modal `TDialog` centred on screen, ~70×30 chars. Scrollable if needed.

### Layout sketch

```
╔══════════════════════ Contour Studio Help ═══════════════════════╗
║                                                                  ║
║  TERRAINS                                                        ║
║  ─────────                                                       ║
║  1  ARCHIPELAGO        2  SADDLE PASS        3  RIDGE VALLEY     ║
║     ╭╮  ╭─╮              ╭──╮ ╭──╮             ────────────      ║
║     ╰╯ ╭╯ ╰╮             ╰╮╭╯ ╰╮╭╯            ╭╮╭╮╭╮╭╮╭╮      ║
║     ╭─╮╰──╮│             ╭╯╰───╯╰╮            ╰╯╰╯╰╯╰╯╰╯      ║
║  Scattered islands     Two peaks with       Long parallel        ║
║  in open water.        a pass between.      ridges and valleys.  ║
║                                                                  ║
║  4  CALDERA            5  LONE PEAK          6  MEADOW           ║
║     ╭╮╭╮╭╮               ╭──╮                  ╭─╮ ╭╮           ║
║     │╰╯╰╯│               │╭╮│                 ╭╯ ╰╮╰╯╭╮        ║
║     ╰╮  ╭╯               ╰╰╯╯                 ╰──╮╰──╯│        ║
║  Volcanic ring with    Single dominant       Gentle rolling      ║
║  central depression.   peak with foothills.  hills, soft edges.  ║
║                                                                  ║
║  7  TWIN PEAKS                                                   ║
║     ╭──╮ ╭──╮                                                    ║
║     │╭╮│ │╭╮│            MODES                                   ║
║     ╰╰╯╯ ╰╰╯╯            g  Static/Grow toggle                  ║
║  Two peaks side          t  Triptych (3 panels)                  ║
║  by side.                o  Ordered grid overlay (E018)          ║
║                          c  Chaos/order balance (E018)           ║
║  CONTROLS                                                        ║
║  ─────────                                                       ║
║  r        New random seed     +/-  Contour levels (2–12)         ║
║  1-7      Select terrain      TAB  Cycle terrain                 ║
║  Space    Pause/resume grow   s    Save to file                  ║
║  a        Batch save all      l    Toggle labels (F04)           ║
║  H        This help           Esc  Close window                  ║
║                                                                  ║
║                              [ OK ]                              ║
╚══════════════════════════════════════════════════════════════════╝
```

### Implementation

- `showContourHelpDialog()` — builds a `TDialog` with `TStaticText` blocks
- Terrain thumbnails: pre-rendered at 12×3 chars using `generate()` with fixed seeds
  - Could be hardcoded strings (simplest) or generated once at dialog open
- Key `H` in `TContourMapView::handleEvent()` calls `showContourHelpDialog()`
- Button strip includes `[?]` button that triggers same dialog
- Dialog is read-only modal — OK or Esc to dismiss

## AC

- AC-01: H key opens help dialog from Contour Studio view
  - Test: press H, verify dialog appears with terrain thumbnails and key list
- AC-02: All 7 terrains shown with visual thumbnail and description
  - Test: count terrain entries, verify names match `kTerrainNames[]`
- AC-03: Key reference matches actual keybindings
  - Test: verify each listed key works as described
- AC-04: Button strip `[?]` opens same dialog
  - Test: click `[?]`, verify dialog opens
