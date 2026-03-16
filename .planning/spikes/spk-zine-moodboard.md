# Spike: Zine Moodboard — Interactive Architecture Poster

> Branch: `spike/spk-zine-moodboard`
> Worktree: `~/Repos/wibwob-zine-moodboard`

## TL;DR

Convert the static 249x65 ASCII moodboard (MOODBOARD.md) into an interactive
zine where each logical chunk is a draggable subwindow. Same total canvas size,
but panels can be rearranged, and figlet headers become live figlet windows.

## Slices

### Slice 0: Zine appears in Applications menu again
- [x] Zine microapp.json has `menu.category: "applications"` — already correct
- [ ] Zine tier is `beta` — either promote to `core` or verify it shows in palette
- [ ] Confirm `bun run dev` shows Zine in menu/palette, can open a .canvas.yaml

### Slice 1: COAT + SDK migration
- [ ] Audit `microapps/zine/index.ts` (1003 lines) for direct blessed usage
- [ ] Replace blessed widget creation with SDK Handle API equivalents
- [ ] Ensure `describeState()` and `captureText()` are implemented
- [ ] Ensure `onRestyle()` updates all themed nodes
- [ ] Run `bun run typecheck` and `bun run check-coat` clean

### Slice 2: Moodboard as a .canvas.yaml zine
- [ ] Create `scratch/moodboard.canvas.yaml` defining the moodboard layout
- [ ] Each logical block becomes a zine panel:
  - Title banner (figlet WibWob-DOS) — figlet panel type
  - Philosophy block — text panel
  - Principles block — text panel
  - Castle postcard — art/primer panel
  - Folk cats — art/primer panel
  - COAT diagram + annotation — text panel
  - Peer adapters diagram + annotation — text panel
  - Microapp Lifecycle — text panel
  - SDK Contract — text panel
  - Architecture map — text panel
  - Tiers block — text panel
  - North Star banner — text panel (or figlet)
  - Joan Stark accents (birds, cat, owl, sun) — art panels
- [ ] Each panel positioned to approximate the static moodboard layout
- [ ] Total canvas ~249x65 (same as static version)
- [ ] Panels are subwindows in the zine — can be selected, scrolled, rearranged

### Slice 3: Make it alive
- [ ] Figlet panels use live figlet rendering (font picker?)
- [ ] Mermaid panels could re-render on resize
- [ ] Theme-aware — panels restyle on theme change
- [ ] Keyboard nav between panels (already in zine?)
- [ ] Consider: auto-scroll tour mode that highlights each section in sequence

## Key Files

- `microapps/zine/index.ts` — main zine microapp (1003 lines, uses blessed directly)
- `microapps/zine/microapp.json` — manifest
- `src/core/microapp-registry.ts` — tier assignment (currently `beta`)
- `scratch/generate-moodboard.mjs` — static moodboard generator (reference)
- `scratch/wibwob-dos-moodboard.md` — static output (reference)
- `MOODBOARD.md` — root copy of static moodboard

## Dependencies

- Zine uses shared modules from `microapps/sy2-chronicles/` (content-loader,
  panel-types, panel-layout, canvas-types) — check these exist and work
- SDK components: createStatusBar, createTextViewer, createCanvas, etc.

## Open Questions

- Should zine become `core` tier? It's a creative tool, feels more `beta`.
- How much of the 1003-line index.ts can move to SDK vs needs blessed?
- Can mermaid diagrams render live inside zine panels?
