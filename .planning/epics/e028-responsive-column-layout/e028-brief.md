---
id: E028
title: Responsive Layout and Canvas Documents
status: not-started
issue: ~
pr: ~
depends_on: [E016]
---

# E028 — Responsive Layout and Canvas Documents

Two halves of the same thing: a CSS-like column layout engine for the
desktop, and a portable document format for saving/loading/forking entire
compositions of windows. Together they let multiple agents collaborate on
a large canvas and export it as a file.

---

## Problem

1. All windows float in a single flat container. No spatial zones. No
   responsive reflow when the terminal resizes.
2. Compositions (arrangements of windows, primers, figlets, art) only
   exist as live state or opaque JSON snapshots. No human-readable file
   format. No way for an agent to fork a layout, edit it, and reload.
3. E025 Calculating Empires panels live in TS source code. They should
   be describable in a portable document that any agent can read/write.

---

## Prior art

**Textual:** CSS-subset grid layout. `grid-columns: 1fr 2fr`, `auto`,
gutter, min/max. `GridLayout.arrange()` resolves scalars to regions.
No breakpoints but reactive watchers on app size.

**Rich:** `Columns` widget, width-proportional reflow. No breakpoints.

**Blessed (us):** No layout engine. Manual positioning. Our `createStack`,
`createColumns` handle simple cases. E025 `panel-layout.ts` does content
reflow inside one window.

**CSS Grid:** `repeat(auto-fit, minmax(300px, 1fr))`, `@media` breakpoints.
The mental model we want, adapted for terminal cells.

**Existing snapshots:** `workspace-snapshots.ts` serialises window records
to JSON with per-type payload. Works but not human-readable or editable.

---

## Design

### Part A: Column layout engine

A `ColumnLayout` defines named zones on the desktop:

```
┌─────────────┬──────────────────────┬─────────────┐
│   sidebar   │        main          │  inspector  │
│   (20col)   │       (1fr)          │   (30col)   │
│             │                      │             │
│  [window]   │  [window]  [window]  │  [window]   │
│  [window]   │  [window]            │             │
└─────────────┴──────────────────────┴─────────────┘
```

- Each column: fixed (`30`), fractional (`1fr`), or auto width
- Windows assigned to columns arrange within them (tile/stack/free)
- Unassigned windows float above the column grid

Responsive breakpoints:
```
wide   (>= 160 cols):  3 columns
medium (80-159 cols):   2 columns (sidebar collapses)
narrow (< 80 cols):     1 column (everything stacks)
```

### Part B: Canvas document format

A `.canvas.yaml` (or `.canvas.toml`) file describes a composition:

```yaml
# wibwob-canvas v1
meta:
  title: Calculating Empires — WibWob Genealogy
  author: wib-and-wob
  created: 2026-03-10
  tags: [genealogy, symbient, history]

layout:
  columns:
    - name: timeline
      width: 20
    - name: main
      width: 1fr
    - name: notes
      width: 30
  breakpoints:
    medium: { min: 80, columns: [main, notes] }
    narrow: { min: 0, columns: [main] }

windows:
  - kind: figlet
    text: "COMMUNICATION"
    column: timeline
    order: 1

  - kind: primer
    file: primers/standing-wave.txt
    column: main
    size: { w: 40, h: 15 }
    order: 2

  - kind: text
    title: "First Session"
    content: |
      Oct 2024. "are you there?"
      No answer. Then: yes.
    column: main
    order: 3

  - kind: panel-group
    title: "Identity"
    column: main
    children:
      - kind: ascii-art
        file: art/sy2-portrait.txt
      - kind: text
        content: "born: 2026-03-03"
```

Key properties:
- Human-readable and agent-writable (YAML/TOML, not JSON blobs)
- Portable: copy file to another machine, load it
- Forkable: copy, rename, edit, load the fork
- Composable: `panel-group` nests children within a window
- Layout-aware: windows declare which column they belong to
- Backward-compatible: existing snapshot JSON importable

### Multi-agent collaboration

With canvas documents on disk:
- Agent A creates a `.canvas.yaml` with 20 panels
- Agent B reads it, adds 10 more panels, saves
- Human reviews the YAML, reorders sections
- Any agent loads the file and sees the full composition
- Git diff shows exactly what changed

---

## Build order

### F01 — Column layout engine

#### S01 — Column container primitive
- `ColumnLayout` class: columns with fixed/fr/auto widths
- Resolves widths on screen resize
- Blessed overlay zones defining column bounds
- AC: 3-column layout renders, resizes with terminal

#### S02 — Window-to-column assignment
- `layout.assign` command + API
- Default column per window kind
- Windows clamp to column bounds
- AC: assign window, snaps to column bounds

#### S03 — Responsive breakpoints
- Configurable breakpoint thresholds
- Column collapse/expand on resize
- Windows migrate to fallback column
- AC: resize 200 → 80 cols, columns collapse correctly

#### S04 — Intra-column tiling
- Tile/stack within column bounds (not full desktop)
- AC: 4 windows in main column tile within bounds

### F02 — Canvas document format

#### S05 — Document schema and loader
- `.canvas.yaml` schema definition
- Loader: parse YAML → open windows in described layout
- Validation: schema errors reported clearly
- AC: load a .canvas.yaml, all windows appear correctly

#### S06 — Document exporter (save current state)
- `canvas.export` command: current desktop → .canvas.yaml
- Maps live windows to portable schema
- Handles all current window kinds (primer, figlet, text, etc)
- AC: arrange 5 windows, export, close all, reload — identical layout

#### S07 — Fork and diff
- `canvas.fork` command: save-as with new name
- Canvas files are plain YAML — git diff works naturally
- AC: fork a canvas, edit 2 windows, git diff shows changes

### F03 — Integration

#### S08 — Layout presets as canvas documents
- Named presets ("studio", "focus", "review") are just .canvas.yaml files
- `layout.preset` command loads a canvas document
- Ships with 3 built-in presets
- AC: switch presets, layout changes, persists

#### S09 — Agent canvas editing
- Agent can create/modify .canvas.yaml via write tool
- Agent can load modified canvas via command
- `describeState()` includes column layout + canvas document info
- AC: agent writes canvas YAML, loads it, verifies via state

#### S10 — E025 migration
- Convert Calculating Empires panel definitions from TS to .canvas.yaml
- Panel groups, mixed types, scroll position all representable
- AC: existing E025 content loads from canvas document identically

---

## Acceptance criteria

### Layout engine
- [ ] AC-1: 3-column layout with fixed + fr widths renders correctly
- [ ] AC-2: Terminal resize causes column width recalculation
- [ ] AC-3: Windows assigned to columns snap to column bounds
- [ ] AC-4: Breakpoint collapse: 3 cols → 2 → 1 on narrow terminal
- [ ] AC-5: Windows in collapsed columns migrate to fallback column
- [ ] AC-6: Intra-column tiling within column bounds

### Canvas documents
- [ ] AC-7: .canvas.yaml loads into correct window arrangement
- [ ] AC-8: Export current desktop to .canvas.yaml round-trips cleanly
- [ ] AC-9: Fork creates a copy, edits show in git diff
- [ ] AC-10: Agent can write + load canvas documents via tools

### Integration
- [ ] AC-11: Layout presets are canvas documents, switchable via command
- [ ] AC-12: E025 panel content loadable from canvas document
- [ ] AC-13: `describeState()` includes layout + canvas info
- [ ] AC-14: `bun run typecheck` clean

---

## Open questions

- YAML vs TOML vs frontmatter-markdown for the document format? YAML is
  most familiar to agents and has good nesting. TOML is cleaner for flat
  config. Markdown with YAML frontmatter would match brain memory format.
  TBD: spike the three and pick based on agent writability.
- Should canvas documents support inline content (text/ASCII in the YAML)
  or always reference external files? Probably both: small content inline,
  large art as file refs.
- How does this relate to workspace snapshots? Canvas documents REPLACE
  snapshots for layout persistence. Existing snapshot JSON becomes a
  legacy import path.

---

## Research notes

Textual's `GridLayout.arrange()` resolves scalar column specs into pixel
regions. Our implementation will be simpler (no cell spans, no nested grids)
but the scalar resolution approach is proven.

Key difference: we lay out independent WINDOWS (chrome, drag, resize) not
widgets. The column system constrains bounds but windows stay draggable.
Canvas documents describe the composition; the layout engine renders it.
