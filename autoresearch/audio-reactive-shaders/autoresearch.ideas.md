# Autoresearch Ideas — Audio-Reactive Shader Evolution

## Done
- Baseline `audio-reactive-overlay.glsl` — 5 effects (bass pulse, mid wave, treble sparkle, freq tint, edge glow)
- `fft-datastrip.py` — 32-band FFT → terminal ANSI blocks + bar visualizer
- `play-reactive.sh` — end-to-end playback with FFT + shader
- Run artifact system (runs/NNN/ with shader, screenshot, config, fft-snapshot)
- Benchmark script with technical metrics (dynamic range, band coverage)

## Shader Variants to Try

### Spatial frequency mapping
- Map bass→center, mids→middle ring, treble→edges (radial frequency layout)
- Left-right frequency sweep (bass left, treble right) — matches datastrip layout
- Vertical: bass at bottom, treble at top — frequency as height

### Time-domain effects
- Trail/afterglow on bass hits (exponential decay, not instant off)
- Beat detection from bass energy spikes → strobe/flash
- Tempo-locked animation speed (detect BPM from bass interval)
- Rolling history — show last N frames of frequency data as scrolling pattern

### Blend mode experiments
- Per-band blend modes (bass=multiply/darken, treble=screen/glow)
- Energy-adaptive blend (quiet=transparent, loud=opaque)
- Text outline glow that pulses with bass
- Negative/invert on bass drops

### Visual styles
- **Plasma**: bass controls temperature, treble controls turbulence
- **Matrix rain**: speed from treble, density from total energy, color from frequency balance
- **CRT**: scanline gap from bass, phosphor glow from mids, static from treble
- **Waveform**: render actual FFT curve as shader geometry overlay
- **Kaleidoscope**: segment count from band count, rotation from mids
- **Noise field**: Perlin noise driven by bass amplitude, color by freq balance
- **Ring pulse**: concentric rings emit from center on bass hits
- **Particle fountain**: particle density from total energy, color from freq
- **Glitch**: displacement/offset amount from treble intensity
- **Aurora**: curtain wave height from bass, shimmer from treble

### Datastrip improvements
- Multi-row datastrip (2-3 rows) for temporal averaging
- Smoothed vs raw energy comparison
- Peak hold indicators (shader reads max-energy markers)
- Phase/onset detection encoded as brightness spikes

### Multi-shader pipelines
- Audio-reactive + CRT layered (two custom-shader lines in Ghostty)
- Genre-specific reactive shaders (calm for ambient, aggressive for breakcore)
- Time-of-day reactive shader (different palette for different energy levels)

### Scoring refinements
- A/B comparison: show two screenshots side by side, pick winner
- Genre-specific scoring weights (breakcore should look chaotic, ambient should look calm)
- Text readability automated check (OCR accuracy through shader)
- Frame-to-frame variation measurement (capture 3 screenshots, measure delta)

## Test WAVs to Benchmark Against
- `021-cathedral.wav` — slow, harmonic, tests subtlety
- `028-breakcore.wav` — fast, chaotic, tests responsiveness
- `006-ambient.wav` — minimal, tests silence handling
- `002-plasma-acid-techno.wav` — rhythmic, tests beat detection
- `029-spacejazz.wav` — melodic, tests mid-frequency handling

## Wibwob Primer Integration (LATER — human requested)
- Read ASCII art primers from `microapps-private/wibwob-primers/primers/` (175 files)
- Encode primer glyphs into shader as texture patterns
- Figlet text driven by frequency bands (bass = big text, treble = small)
- Primer silhouettes that pulse/breathe with bass energy
- ASCII art fragments that emerge from noise field when energy peaks
- "Wibwobbier" aesthetic — playful, chaotic, character-driven

## Shader-as-substrate + WibWob-DOS overlay (LATER — human requested)
- Run audio-reactive shader as Ghostty BG behind the WibWob-DOS TUI
- Use timeline cues / wibwob CLI to choreograph ASCII art windows ON TOP
- Shader = visual substrate reacting to music underneath
- WibWob windows = dance layer on top, synced via timeline
- Primer windows open/close/move in sync with beats
- Figlet text appears on drops, dissolves on breakdowns
- Theme changes match shader mood (dark↔hot↔nord)
- The terminal text IS the foreground art, shader IS the background canvas
- Pipeline: audio → FFT → shader BG + timeline → WibWob window choreography
