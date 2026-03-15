# Shader → Music: Experiment Report

**29 renders · 11 genres · 11 shaders · 27MB of WAV**

A GLSL fragment shader runs headlessly on the GPU via `moderngl`.
Pixel brightness is sampled at beat rate and mapped to pitch, volume,
waveform, and FX parameters. Python (`bricks` toolkit) synthesizes
the audio. The shader IS the score — the visual pattern IS the music.

---

## Scoreboard (Agent)

Scored by automated variety metric (0–100): pitch range, rhythmic
variation, dynamic range, track independence, spectral variety,
silence usage, audio dynamics, headroom.

| Rank | Genre | Shader | BPM | Dur | Score | Killer Feature |
|------|-------|--------|-----|-----|-------|----------------|
| 🥇 | **Cathedral** | cathedral.glsl | 72 | 30s | **90.2** | Harmonic interference → organ+FM bells+glass+choir in Db Lydian |
| 🥈 | Starfield | starfield-superlite.glsl | 110 | 16s | 86.8 | Differentiated layer grids, cross-quadrant sampling |
| 🥉 | Eno×DM×Hyper | eno-depeche-hyper.glsl | 95 | 24s | 83.6 | Eno drones + DM saw pulse + bitcrushed(3) hyper stabs |
| 4 | Lo-fi Hip Hop | cineShader-Lava.glsl | 78 | 20s | 83.1 | Ghostty lava metaballs → Rhodes keys + vinyl crackle |
| 5 | DnB | sin-interference.glsl | 170 | 18s | 81.9 | Ghostty sin-interference → reese bass + breakbeats |
| 6 | Synthwave | galaxy.glsl | 118 | 20s | 81.6 | Ghostty galaxy → delayed arps + dual-osc bass |
| 7 | Acid Techno | plasma-acid.glsl | 135 | 20s | 80.8 | 303 acid bass, filter sweep, PWM acid lead |
| 8 | Ambient | underwater.glsl | 60 | 24s | 77.1 | Ghostty underwater → FM bells + drones + breath |
| 9 | Space Jazz | spacejazz.glsl | 88 | 22s | 76.7 | Walking bass + Rhodes chords + horn + brush |
| 10 | Breakcore | breakcore.glsl | 165 | 18s | 73.3 | Quantized amen chops, distorted bass stabs |
| 11 | Witch House | witchhouse.glsl | 65 | 24s | 72.9 | Dark Bbm fog drone, chopped stabs, occult pulse |
| 12 | Italo Disco | fireworks.glsl | 124 | 20s | 64.6 | Bouncy octave bass, chorus pad, claps |

### What the scores mean (and don't)

The automated scorer measures *variety* — how much the piece changes over
time across multiple dimensions. It does NOT measure:

- Whether it sounds good
- Emotional impact
- Genre authenticity
- Whether you'd listen to it again

A breakcore piece that sounds authentically chaotic scores 73 because
"chaos" reads as "uniform energy." A cathedral piece scores 90 because
it has architectural dynamics. Both might be equally good music.

---

## Scoreboard (Human)

_Your turn. Listen to the shots, rate them however you want._

| Rank | Genre | File | Your Score | Notes |
|------|-------|------|------------|-------|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

---

## Architecture

```
GLSL shader (GPU, headless via moderngl)
  ↓ renders 16×16 RGBA texture per beat step
  ↓ 4 time offsets → 4 independent renders per step
  ↓ cross-quadrant spatial sampling + transfer curves
  ↓
Python (bricks toolkit)
  ↓ brightness → note (from genre-specific scale/chord)
  ↓ brightness → volume, filter cutoff, duty cycle, FX depth
  ↓ genre-specific synth function per track
  ↓ structural dynamics: staggered entrances, sine swells, breakdowns
  ↓
output.wav (mono, 22050Hz, 16-bit)
  ↓ auto-saved to shots/ with manifest entry
```

### Key discoveries

1. **Shader differentiation matters most.** Per-layer grid density + speed
   in the shader itself was worth more than any synth-side change.

2. **Time offsets decorrelate tracks.** Rendering each track at a different
   `iTime` offset (e.g., 0, 3.7, 7.3, 11.1s) was the single biggest
   independence boost (32 → 80+).

3. **Breakdowns create dynamics.** Two inverse breakdowns (tracks 0,3 dip
   at 50%, tracks 1,2 dip at 20%) gave the best energy arc.

4. **Harmonic interference > fbm noise for music.** The cathedral shader
   uses sine waves at musical ratios (3:2, 5:4, 7:4, 1.01:1) — the visual
   counterpoint directly maps to musical counterpoint.

5. **GPU non-determinism is real.** macOS Metal produces slightly different
   float results between GL context initializations. Shader cache required
   for reproducible experiments.

6. **Genre-authentic ≠ high-scoring.** Breakcore, witch house, and ambient
   score lower because their aesthetics (density, darkness, spaciousness)
   conflict with the variety metric. They sound great.

---

## Manifest Summary

29 renders across 13 genre labels (some genres rendered multiple times
during optimization). Best render per genre:

| Genre | Best Shot | Shader | Key Synth Choices |
|-------|-----------|--------|-------------------|
| Cathedral | 026 | cathedral.glsl | Additive organ (5 stops), FM bells (mod=3.51f), 5-voice detuned choir, glass+tremolo phasing |
| Starfield | 018 | starfield-superlite.glsl | Square(bitcrush 6) + triangle + saw(lp600) + noise, C/Am/F/G chords |
| Eno×DM×Hyper | 020 | eno-depeche-hyper.glsl | 3-sine Eno cluster, saw+sub DM bass, bitcrush(3) hyper squares, D minor |
| Lo-fi | 003 | cineShader-Lava.glsl | sine+overtone Rhodes, noise bitcrush(4) crackle, detuned tri pad, Eb pent |
| DnB | 005 | sin-interference.glsl | Reese(detune=0.01, bitcrush 6), square+saw stabs, E minor |
| Synthwave | 004 | galaxy.glsl | Saw arp+delay, saw+square bass, detuned saw pad, A minor pent |
| Acid Techno | 002 | plasma-acid.glsl | Saw+lp sweep(200+b*3k)+bitcrush(5), square PWM lead, Eb minor |
| Ambient | 006 | underwater.glsl | FM bell(mod=3.01f), 3-sine drone, noise breath, D Lydian |
| Space Jazz | 029 | spacejazz.glsl | Triangle+sine walk, Rhodes chord voicing, square+sine horn+vibrato, Bb7 |
| Breakcore | 028 | breakcore.glsl | Brightness-split amen (kick/snare/hat regions), saw+square bass, C minor |
| Witch House | 027 | witchhouse.glsl | Detuned saw fog(lp250+b*400), pitched-down square chops, Bb minor |
| Italo | 007 | fireworks.glsl | Octave-jumping square bass, detuned saw chord pad, F major |

---

## Questions You Might Want to Ask

- **"Play me the cathedral"** — `shots/026-cathedral.wav` (the 90.2)
- **"Play them all back to back"** — I can concatenate into a mixtape
- **"Which shader would work best for [X genre]?"** — cathedral.glsl pattern (harmonic interference at musical ratios) generalizes well
- **"Can we do this in real-time?"** — yes, ~10ms budget, needs streaming audio output
- **"MIDI export?"** — brightness values → MIDI note-on/off is straightforward
- **"Can the audio feed back into the shader?"** — FFT → shader uniforms, the song reacts to itself
- **"Make a video where we SEE the shader while hearing the music"** — absolutely, render shader frames to PNG sequence + mux with audio
- **"Why does [genre] sound like that?"** — check `manifest.jsonl` for exact params, or ask me to explain any synth function

---

_Generated by shader-music autoresearch · 23 experiments · baseline 71.2 → best 90.2 (+26.7%)_
