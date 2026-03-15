# Autoresearch — Audio-Reactive Shader Evolution

## Objective

Evolve audio-reactive Ghostty terminal overlays that respond to music in
real-time. Each iteration creates a new shader variant, runs it with FFT
data piped through the terminal, captures a screenshot + technical metrics,
and scores both axes. Every run's artifacts are preserved in numbered
subdirectories for reproducibility and A/B comparison.

The pipeline: WAV → FFT → terminal datastrip (ANSI blocks) → Ghostty
renders terminal as iChannel0 texture → shader reads frequency band pixels
→ drives visual effects. The shader adapts to the music in real time.

## Metrics

- **Primary**: creative_score (higher is better) — screenshot-based visual
  quality assessment (0-10): energy, coherence with music, text readability,
  visual interest, surprise/delight
- **Secondary**:
  - `responsiveness` — how visibly the shader reacts to frequency changes (0-10)
  - `readability` — terminal text legibility through the shader (0-10)
  - `band_coverage` — how many frequency bands drive distinct visual effects (0-10)
  - `dynamic_range` — difference between quiet and loud visual states (0-10)

## How to Run

`./autoresearch.sh` — generates a shader, runs it with a test WAV, captures
screenshot + metrics, outputs `METRIC name=number` lines.

## The Loop

Each iteration:

1. **Generate** a new shader variant in `shaders/` (modify GLSL)
2. **Activate** the shader via `ghostty-shader.sh on <name>`
3. **Run** FFT datastrip with a reference WAV (cathedral or breakcore — covers
   slow+fast dynamics)
4. **Wait** 3-5 seconds for visual state to develop
5. **Capture** screenshot via `screencapture`
6. **Save artifacts** to `runs/NNN/`:
   - `shader.glsl` — exact shader source used
   - `screenshot.png` — what it looked like
   - `config.json` — params: WAV used, bands, fps, blend mode, shader name
   - `fft-snapshot.json` — frequency band energies at capture time
7. **Score** via screenshot analysis (creative) + FFT responsiveness (technical)
8. **Deactivate** shader

## Files in Scope

| File | Role |
|------|------|
| `shaders/audio-reactive-overlay.glsl` | The shader being evolved |
| `shaders/*-reactive-*.glsl` | Variant shaders (new ones each iteration) |
| `autoresearch/audio-reactive-shaders/autoresearch.sh` | Benchmark runner |
| `autoresearch/audio-reactive-shaders/runs/` | Per-run artifact dirs |
| `autoresearch/shader-music-viz/fft-datastrip.py` | FFT analyzer (read, may tune params) |
| `autoresearch/shader-music-viz/play-reactive.sh` | Playback script |

## Off Limits

- `autoresearch/shader-music/*.glsl` — source music shaders (read-only)
- `autoresearch/shader-music/shader_to_chiptune.py` — music generation
- `scripts/ghostty-shader.sh` — shader management (use as-is)
- `src/` — no app code changes in this loop

## Constraints

- Ghostty 1.3+ required (AppleScript reload)
- Shader must compile in Ghostty (GLSL ES 1.0 compatible)
- Text must remain readable (readability score ≥ 6)
- Each run must save artifacts to `runs/NNN/` for reproducibility
- Use `cathedral` as primary test WAV (slow harmonic = tests subtlety)
- Use `breakcore` as secondary test WAV (fast chaotic = tests responsiveness)
- Screenshot capture via `screencapture -x` (macOS, silent)

## Shader Evolution Dimensions

Things to vary across iterations:

### Visual effects driven by frequency bands
- Bass: radial pulse, screen shake, vignette darkening, color warmth
- Mids: horizontal waves, ripple distortion, brightness modulation
- Treble: sparkle/glitter, edge detection glow, high-freq noise
- Total energy: overall brightness, saturation boost, blur/sharpen

### Blend modes with terminal text
- Luminance mask (current: text in bright areas, viz in dark)
- Additive (glow on top of text)
- Multiply (darken/mood)
- Screen (lighten/dreamy)
- Channel-specific (bass=red channel, treble=blue channel)

### Datastrip reading strategies
- Bottom row only (current)
- Bottom 2-3 rows for temporal smoothing
- Spatial mapping (left=bass, right=treble, height=energy)
- Multiple sample points per band for noise reduction

### Visual styles to explore
- Plasma/lava driven by bass energy
- Matrix rain speed tied to treble
- CRT scanline intensity tied to total energy
- Waveform overlay (FFT bars rendered as shader geometry)
- Kaleidoscope with rotation speed from mids
- Color palette cycling speed from tempo detection

## Run Artifact Format

```
runs/
  001/
    shader.glsl          # exact GLSL used
    screenshot.png       # captured visual state
    config.json          # { wav, bands, fps, blend, shader_name, timestamp }
    fft-snapshot.json    # { band_energies: [...], peak_band, total_energy }
    score.json           # { creative: N, responsiveness: N, readability: N, ... }
  002/
    ...
```

## What's Been Tried

- Run 000 (baseline): `audio-reactive-overlay.glsl` — bass radial pulse,
  mid horizontal wave, treble sparkle, frequency-tinted color, edge glow.
  Luminance blend. Untested with real screenshot scoring.
