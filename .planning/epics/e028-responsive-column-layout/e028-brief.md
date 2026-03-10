---
id: E028
title: Canvas Documents
status: in-progress
issue: ~
pr: ~
depends_on: [E016]
---

# E028 — Canvas Documents

A portable document format for saving, loading, forking, and collaboratively
editing compositions of windows. Multiple agents can work on the same canvas
by reading/writing a human-readable file.

---

## Problem

1. Compositions (arrangements of windows, primers, figlets, art) only
   exist as live state or opaque JSON snapshots. No human-readable file
   format. No way for an agent to fork a layout, edit it, and reload.
2. E025 Calculating Empires panels live in TS source code. They should
   be describable in a portable document that any agent can read/write.
3. Workspace snapshots are JSON blobs — not diffable, not editable.

---

## Design

### Canvas document format

A `.canvas.yaml` (or `.canvas.toml` — TBD) file describes a composition:

```yaml
# wibwob-canvas v1
meta:
  title: Calculating Empires — WibWob Genealogy
  author: wib-and-wob
  created: 2026-03-10
  tags: [genealogy, symbient, history]

windows:
  - kind: figlet
    text: "COMMUNICATION"
    position: { x: 0, y: 0 }
    size: { w: 60, h: 8 }

  - kind: primer
    file: primers/standing-wave.txt
    position: { x: 0, y: 9 }
    size: { w: 40, h: 15 }

  - kind: text
    title: "First Session"
    content: |
      Oct 2024. "are you there?"
      No answer. Then: yes.
    position: { x: 42, y: 9 }
    size: { w: 30, h: 6 }
```

Key properties:
- Human-readable and agent-writable (YAML/TOML, not JSON blobs)
- Portable: copy file to another machine, load it
- Forkable: copy, rename, edit, load the fork
- Backward-compatible: existing snapshot JSON importable

### Multi-agent collaboration

With canvas documents on disk:
- Agent A creates a `.canvas.yaml` with 20 windows
- Agent B reads it, adds 10 more, saves
- Human reviews the file, reorders sections
- Any agent loads the file and sees the full composition
- Git diff shows exactly what changed

---

## Build order

### F01 — Canvas document format

#### S01 — Format spike: YAML vs TOML
- Export current live canvas to both .canvas.yaml and .canvas.toml
- Codex review: which is more agent-writable, diffable, nesting-friendly?
- Pick one format, document the schema
- AC: both formats generated from live state, decision documented

#### S02 — Document schema and loader
- Schema definition for the chosen format
- Loader: parse file → open windows in described layout
- Validation: schema errors reported clearly
- AC: load a canvas doc, all windows appear correctly

#### S03 — Document exporter (save current state)
- `canvas.export` command: current desktop → canvas document
- Maps live windows to portable schema
- Handles all current window kinds (primer, figlet, text, plasma, etc)
- AC: arrange 5 windows, export, close all, reload — identical layout

#### S04 — Fork and diff
- `canvas.fork` command: save-as with new name
- Canvas files are plain text — git diff works naturally
- AC: fork a canvas, edit 2 windows, git diff shows changes

### F02 — Integration

#### S05 — Layout presets as canvas documents
- Named presets ("studio", "focus", "review") are canvas documents
- `layout.preset` command loads a canvas document
- Ships with 3 built-in presets
- AC: switch presets, layout changes, persists

#### S06 — Agent canvas editing
- Agent can create/modify canvas docs via write tool
- Agent can load modified canvas via command
- `describeState()` includes loaded canvas document info
- AC: agent writes canvas doc, loads it, verifies via state

#### S07 — E025 migration
- Convert Calculating Empires panel definitions from TS to canvas doc
- Panel groups, mixed types, scroll position all representable
- AC: existing E025 content loads from canvas document identically

---

## Acceptance criteria

### Canvas documents
- [x] AC-1: Format decision documented (YAML vs TOML spike)
- [x] AC-2: Canvas doc loads into correct window arrangement (ZINE microapp)
- [ ] AC-3: Export current desktop to canvas doc round-trips cleanly
- [ ] AC-4: Fork creates a copy, edits show in git diff
- [ ] AC-5: Agent can write + load canvas documents via tools

### Integration
- [ ] AC-6: Layout presets are canvas documents, switchable via command
- [x] AC-7: E025 panel content loadable from canvas document (demo.canvas.yaml)
- [x] AC-8: `describeState()` includes canvas info (items with type/position)
- [x] AC-9: `bun run typecheck` clean

### ZINE microapp (added during implementation)
- [x] AC-10: ZineItem unified layout primitive (panels + headers same type)
- [x] AC-11: Column layout with responsive wrapping, maxColumns default 6
- [x] AC-12: Column headers scroll with content, viewport clipped
- [x] AC-13: Double-click dispatches to native editor by sourceType map
- [x] AC-14: SDK exports: layoutColumns, ZineItem, ZineLayoutResult, CanvasDocument

---

## Decisions

- **Format: YAML** (.canvas.yaml). Spike compared YAML vs TOML exports.
  YAML wins on nested structures (panel-group children), multiline content
  (`|` blocks for ASCII art), and agent writability. TOML's `[[nested]]`
  array-of-table syntax is a footgun for LLMs. Full reasoning in
  `scratch/spike-canvas-format/FORMAT-DECISION.md`.
- **Stable IDs**: every window entry gets an `id` field for diff/merge
  identity. Reordering windows in the file produces minimal diffs.
- **Quoting**: dates and booleans always quoted to avoid YAML implicit
  typing (`"2026-03-10"` not bare `2026-03-10`, `"true"` not bare `true`).

## Open questions

- Inline content (text/ASCII in the doc) vs file refs? Probably both:
  small content inline, large art as file refs.
- How does this relate to workspace snapshots? Canvas documents REPLACE
  snapshots for layout persistence. Existing JSON becomes legacy import.

---

## Parked: responsive column layout engine

CSS-like column containers with fr/auto widths, responsive breakpoints,
window-to-column assignment, intra-column tiling. Too complex for first
pass. Canvas documents work with absolute positioning first. Column
layout can layer on top later as a layout MODE that a canvas doc
declares. See git history for the full F01 column spec.
