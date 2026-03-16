# HANDOVER — Zine Moodboard Spike

> Read this first. Then read the files listed below.

## What is this

A spike to convert the static ASCII architecture moodboard (MOODBOARD.md) into
an interactive zine microapp where each section is a live, rearrangeable panel.

## Branch and worktree

- Branch: `spike/spk-zine-moodboard` (off main @ 79ab6cb6)
- Worktree: `~/Repos/wibwob-zine-moodboard`
- Parent repo: `~/Repos/wibandwob-dos`

## Three goals

1. **Zine in menus** — tier is `beta` in `src/core/microapp-registry.ts`, so it
   only shows in command palette, not menus. Promote to `core` or add explicit
   menu placement to make it visible in Applications.

2. **COAT + SDK migration** — `microapps/zine/index.ts` (1003 lines) imports
   blessed directly. Migrate to SDK Handle API. Must pass `bun run check-coat`.

3. **Moodboard as zine** — create `scratch/moodboard.canvas.yaml` that defines
   each moodboard section as a zine panel. ~15 panels covering: title figlet,
   philosophy, principles, COAT diagram + explanation, peer adapters diagram +
   explanation, SDK contract, microapp lifecycle, architecture map, tiers,
   north star, and art accents (folk cats, castle, Joan Stark pieces).

## Read these files

1. `.planning/spikes/spk-zine-moodboard.md` — full spike plan with slices
2. `MOODBOARD.md` — the static moodboard to decompose into panels
3. `scratch/generate-moodboard.mjs` — generator showing exact layout positions
4. `microapps/zine/index.ts` — current zine implementation
5. `microapps/zine/microapp.json` — manifest
6. `src/core/microapp-registry.ts` — tier assignments
7. `PHILOSOPHY.md` — source text for philosophy/principles panels
8. `AGENTS.md` — COAT explanation, architecture overview

## How to run

```bash
cd ~/Repos/wibwob-zine-moodboard
bun install
bun run typecheck
bun run dev
```

Then open Zine from command palette (Ctrl+P, type "zine").

## What was done before this handover

- Merged E047 branches (wibwob-pi + file-manager-v3) to main
- Fixed scrollbar crash on theme switch (6 widgets patched)
- Created the static moodboard with figlet, mermaid, hand-drawn blocks,
  Wib&Wob primers, and Joan Stark art accents
- All on `spike/bug-sweep-march-16` (pushed to origin)

## Zine panel types (from existing canvas.yaml format)

The zine reads `.canvas.yaml` files with panel definitions. Check
`microapps/sy2-chronicles/` for the shared content-loader and panel-types
modules to understand the YAML schema. Each panel has: type, position (x,y),
size (w,h), content, optional title, optional style.
