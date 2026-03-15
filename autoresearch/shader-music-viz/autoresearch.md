# Autoresearch — Shader Music Viz

## Objective

Synchronized shader + chiptune playback in WibWob-DOS. The same GLSL shader
that composed the music runs live as a Ghostty terminal overlay — audio and
visuals from one source, displayed simultaneously. The shader IS the score,
and you see the score while hearing it.

Full plan: `autoresearch/shader-music/ghostty-shader-music-viz/PLAN.md`

## Phases

- **P0** `make-overlay.py` — wrap any music shader as Ghostty terminal overlay
- **P1** `shader-music.play` command — single shot playback (manifest → shader → WAV → cleanup)
- **P2** Shader cue type in timeline-service — `{ "shader": "cathedral" }` as a timeline cue
- **P3** DJ set timeline generator — concatenate WAVs, auto-generate timeline JSON
- **P4** Desktop choreography — TUI windows react to genre (theme, layout, primer art)

## Metrics

- **Primary**: quality_score (higher is better) — end-to-end verification score:
  overlay renders correctly, audio plays, shader swaps work, timeline cues fire
- **Secondary**: overlay_blend (text readability through shader), swap_latency_ms

## How to Run

`./autoresearch.sh` — outputs `METRIC name=number` lines.

## Files in Scope

| File | Role |
|------|------|
| `autoresearch/shader-music-viz/make-overlay.py` | P0: shader → terminal overlay wrapper |
| `autoresearch/shader-music-viz/test-overlay.sh` | P0: verify overlay renders in Ghostty |
| `src/services/timeline-types.ts` | P2: add shader cue type |
| `src/services/timeline-service.ts` | P2: execute shader cues |
| `src/core/command-catalog.ts` | P1: register shader-music.play command |
| `scripts/ghostty-shader.sh` | existing shader hot-swap script |
| `shaders/` | output directory for generated overlays |
| `autoresearch/shader-music/shots/` | source WAVs + manifest.jsonl |
| `autoresearch/shader-music/*.glsl` | source music shaders |

## Off Limits

- `autoresearch/shader-music/shader_to_chiptune.py` — music generation engine (read-only reference)
- `autoresearch/shader-music/score_music.py` — scoring engine (read-only)
- `src/app.ts` Ghostty detection (already works)
- Ghostty config file (managed by ghostty-shader.sh)

## Constraints

- `bun run typecheck` must pass
- Ghostty 1.3+ required (AppleScript `perform action` API)
- Overlay must preserve terminal text readability (luminance mask blending)
- No new npm dependencies
- Shader hot-swap via `ghostty-shader.sh` or AppleScript — no direct config mutation
- WAV playback via `ffplay -nodisp -autoexit` (existing pattern)

## Key Infrastructure

- **29 WAVs** in `autoresearch/shader-music/shots/` with `manifest.jsonl`
- **Ghostty AppleScript** confirmed working: `perform action "reload_config"`
- **ghostty-shader.sh** handles config include files + reload
- **Timeline service** already supports scene/patch/command cues at exact timestamps
- **Multi-shader pipelines** — Ghostty stacks multiple `custom-shader` lines

## What's Been Tried

(starting fresh — this is P0)
