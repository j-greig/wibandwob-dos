---
id: S18
epic: E031
title: Migrate textbox prompts to overlays.openValuePrompt
status: done
branch: epic/e031-ui-primitives-brand
---

# S18 — Inline textbox prompts migration

## What and why

Replace raw textbox prompt logic in music player with `overlays.openValuePrompt` to keep prompt lifecycle in the overlay owner path (AC-19).

## Acceptance criteria

- [ ] AC-19: music-player file input prompt uses `overlays.openValuePrompt`.
- [ ] Raw blessed textbox prompt construction is removed from music player window code.
- [ ] Prompt UX (submit/cancel/focus) remains equivalent.
- [ ] AC-27: smoke music player prompt flow.

## Files to change

- `src/windows/music-player-window.ts`
- `src/core/overlay-manager.ts` (only if API extension is required)

## Tasks

- [ ] T1: Swap raw textbox prompt code for `openValuePrompt` call.
- [ ] T2: Preserve existing callback/validation behavior.
- [ ] T3: Remove obsolete prompt lifecycle code.
- [ ] T4: Smoke + `bun run typecheck`.
