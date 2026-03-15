# Autoresearch — Shader-Driven Chiptune

## Objective
Use a GLSL starfield shader running headlessly on the GPU to drive a 4-track
chiptune composition via the bricks synthesis toolkit.

## Architecture
```
starfield-superlite.glsl (4 layers → RGBA)
  ↓ moderngl headless render (16×16 tex, sampled at beat rate)
  ↓ per-channel brightness reduction
  ↓
shader_to_chiptune.py
  ↓ brightness → pitch/volume/waveform/FX mapping
  ↓ bricks toolkit synthesis (osc, fx, patterns, canvas)
  ↓
output.wav (4-track mixdown)
```

## Tracks
| Channel | Track   | Mapping                                    |
|---------|---------|--------------------------------------------|
| R       | Lead    | Square wave, bitcrushed, pentatonic scale   |
| G       | Harmony | Triangle wave, one octave down              |
| B       | Bass    | Sawtooth, two octaves down, lowpassed       |
| A       | Perc    | Filtered noise hits                         |

## Metric
**Primary:** Musical variety score (0-100) — measures pitch range, rhythmic
variation, dynamic range, and inter-track independence across the piece.

## Iteration Axes
- Shader parameters: layers, grid density, time mapping
- Musical mapping: scale choice, brightness→note curve, threshold gating
- Synthesis: waveform selection, FX chain, envelope shapes
- Structure: BPM, step rate, track roles, chord progressions
- Advanced: feedback loops (audio features → shader uniforms)

## Files
- `starfield-superlite.glsl` — the shader (4 layers, sparse)
- `shader_to_chiptune.py` — main pipeline script
- `score_music.py` — automated quality scorer
- `output.wav` — latest output
- `shader_data.json` — brightness values from last render
