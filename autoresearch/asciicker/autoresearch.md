# Autoresearch — Cat in Glasgow

## The Game
You are a cat exploring Glasgow tenements. Isometric 3D, ASCII rendered.
Mostly night time, sometimes day. It rains a lot. You do cat things.

Paperboy-style isometric perspective but you're a wee cat padding around
closes, back courts, bins, walls, rooftops, windowsills. The city is
the world. Rain on cobblestones. Streetlights. Chip shop glow.

## Module
- Path: `modules/asciicker-v2/`
- App type: `wibwob.asciicker-v2`
- Command: `microapp.wibwob.asciicker-v2.open`

## Scoring
5 axes (each 1-10, averaged by LLM scorer):
- **RENDER** — 3D rendering fidelity (depth, occlusion, lighting, projection)
- **WORLD** — terrain variety, objects, biomes, explorable space
- **CONTROLS** — movement, camera, responsiveness, player presence
- **BEAUTY** — visual richness, colour, glyph choices, atmosphere
- **CRAFT** — code quality, multi-file architecture, lifecycle hooks

Starting from 1.0 (empty scaffold).

## Constraints
- Multi-file: each `.ts` < 300 lines
- Must pass `bun run typecheck`
- fps ≤ 8 (125ms+ interval)
- Import only from blessed and `../../src/services/microapp-sdk.js`
- All lifecycle hooks in index.ts

## Reference
- `vendor/reference/ENGINE_ANALYSIS.md` — C++ isometric engine internals
- `vendor/reference/RAYCASTER_REFERENCES.md` — raycaster techniques
- `vendor/reference/asciicker-ideas.md` — what moved the scorer needle before
