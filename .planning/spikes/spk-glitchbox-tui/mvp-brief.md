---
id: SPK-glitchbox-tui
title: GlitchBox TUI — Promoted to E027
status: promoted
type: spike-redirect
issue: 121
promoted_to: E027
---

# GlitchBox TUI — Promoted to E027

This spike has been promoted. The full epic brief and story map live at:

  `.planning/epics/e027-glitchbox-tui/e027-brief.md`

The concept background (WHY — GlitchBox installation, symbient embodiment, vision)
is archived at `.trash/spike-brief-archived.md` in this directory.

---

## What changed during spike elaboration

The original spike focused on named pose presets + a generative field.
During elaboration the following was specified more concretely:

- **First two dancers are named**: Wib&Wob (`wibwob-agent-session.ts`) and
  Scramble (`scramble-brain.ts`) — both already have `createSlashRouter` wired.
  `/dance` is the entry point from their chat windows.

- **DancerState model**: each dancer carries `{x, y, preset, energy, mood}`.
  Energy (0–10) drives animation speed. Mood is a haiku-readable string.

- **Haiku tick**: every ~60s a haiku call decides each dancer's next `{x, y,
  energy, mood}`. Agents are genuinely autonomous on the floor, not just frozen
  in a preset.

- **Skeleton renderer extraction**: `drawSkeleton()` in `webcam-renderer.ts`
  to become `renderSkeletonAt(grid, landmarks, offsetX, offsetY, color)` in
  `src/core/skeleton-renderer.ts` — no MonsterCamFrame dep, multiple bodies
  on one canvas. Exported via SDK. Monster Cam AC-6 uses the same function.

- **SDK lego approach**: everything reuses existing SDK exports —
  `tweenWindowPosition` / `tween` from motion-service for smooth moves,
  `blankGrid` / `gridToText` from grid-canvas for the field layer,
  `createTimer` / `clearTimers` from ui-primitives for the haiku tick,
  `renderWebcamFrame` + `gridToBlessedContent` for skeleton compositing.

All of the above is now in `e027-brief.md`.
